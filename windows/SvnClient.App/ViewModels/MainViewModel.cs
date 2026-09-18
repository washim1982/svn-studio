using System.Collections.ObjectModel;
using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using SvnClient.App.Models;
using SvnClient.App.Services;
using SvnClient.App.Views;

namespace SvnClient.App.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly SvnCliService _svnService;
    private readonly SettingsService _settingsService;

    [ObservableProperty]
    private FileTreeItemViewModel? rootItem;

    [ObservableProperty]
    private FileTreeItemViewModel? selectedItem;

    [ObservableProperty]
    private string editorText = "";

    [ObservableProperty]
    private string diffText = "";

    [ObservableProperty]
    private bool showDiff;

    [ObservableProperty]
    private bool isEditable = true; // Windows app is editable by default per spec

    [ObservableProperty]
    private bool isBusy;

    [ObservableProperty]
    private string statusMessage = "";

    [ObservableProperty]
    private bool isConfigured;

    [ObservableProperty]
    private string commitMessage = "";

    [ObservableProperty]
    private bool isHistoryVisible;

    [ObservableProperty]
    private string? historyScopePath;

    public ObservableCollection<ChangedFileViewModel> ChangedFiles { get; } = new();
    public ObservableCollection<SvnLogEntry> HistoryEntries { get; } = new();

    private AppSettings _settings;

    public MainViewModel(SvnCliService svnService, SettingsService settingsService)
    {
        _svnService = svnService;
        _settingsService = settingsService;
        _settings = _settingsService.Load();
    }

    public async Task InitializeAsync() => await RefreshTreeAsync();

    private bool HasWorkingCopy => !string.IsNullOrWhiteSpace(_settings.WorkingCopyPath);

    [RelayCommand]
    public async Task RefreshTreeAsync()
    {
        _settings = _settingsService.Load();
        if (!HasWorkingCopy)
        {
            IsConfigured = false;
            StatusMessage = "SVN isn't configured yet. Open Settings to link a working copy.";
            RootItem = null;
            return;
        }
        IsBusy = true;
        try
        {
            var tree = await _svnService.GetTreeAsync(_settings);
            RootItem = new FileTreeItemViewModel(tree);
            IsConfigured = true;
            StatusMessage = "";
            RebuildChangedFiles(tree);
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void RebuildChangedFiles(SvnTreeNode node)
    {
        if (node == RootItem?.Node) ChangedFiles.Clear();
        if (node.Status != SvnItemStatus.Normal)
        {
            ChangedFiles.Add(new ChangedFileViewModel(node.Path, node.Status));
        }
        foreach (var child in node.Children) RebuildChangedFiles(child);
    }

    /// <summary>True only when the selection is an actual file, so the center panel
    /// doesn't render an empty editor when a folder (or nothing) is selected.</summary>
    public bool IsFileSelected => SelectedItem is { IsDirectory: false };

    partial void OnSelectedItemChanged(FileTreeItemViewModel? value)
    {
        OnPropertyChanged(nameof(IsFileSelected));
        if (value == null || value.IsDirectory)
        {
            EditorText = "";
            DiffText = "";
            ShowDiff = false;
            return;
        }
        _ = LoadFileAsync(value.Path);
    }

    private async Task LoadFileAsync(string path)
    {
        IsBusy = true;
        try
        {
            EditorText = await _svnService.GetFileContentAsync(_settings, path);
            DiffText = await _svnService.GetDiffAsync(_settings, path);
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task SaveFileAsync()
    {
        if (SelectedItem == null || SelectedItem.IsDirectory) return;
        IsBusy = true;
        try
        {
            await _svnService.WriteFileContentAsync(_settings, SelectedItem.Path, EditorText);
            StatusMessage = "File saved.";
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void ToggleDiff() => ShowDiff = !ShowDiff;

    [RelayCommand]
    private async Task UploadAsync(object? targetFolderObj)
    {
        var targetFolder = targetFolderObj as string ?? "";
        var dialog = new OpenFileDialog { Multiselect = true, Title = "Select file(s) to upload into the working copy" };
        if (dialog.ShowDialog() != true) return;

        IsBusy = true;
        try
        {
            foreach (var sourcePath in dialog.FileNames)
            {
                var fileName = System.IO.Path.GetFileName(sourcePath);
                var relativePath = string.IsNullOrEmpty(targetFolder) ? fileName : $"{targetFolder}/{fileName}";
                var destPath = System.IO.Path.Combine(_settings.WorkingCopyPath, relativePath.Replace('/', System.IO.Path.DirectorySeparatorChar));
                System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(destPath)!);
                System.IO.File.Copy(sourcePath, destPath, overwrite: true);
                await _svnService.AddAsync(_settings, relativePath);
            }
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UploadFolderAsync(object? targetFolderObj)
    {
        var targetFolder = targetFolderObj as string ?? "";
        var dialog = new OpenFolderDialog { Title = "Select a folder to upload into the working copy" };
        if (dialog.ShowDialog() != true) return;

        IsBusy = true;
        try
        {
            await CopyAndAddFolderAsync(dialog.FolderName, targetFolder);
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task CopyAndAddFolderAsync(string sourceDir, string targetFolder)
    {
        var folderName = new System.IO.DirectoryInfo(sourceDir).Name;
        var relativePath = string.IsNullOrEmpty(targetFolder) ? folderName : $"{targetFolder}/{folderName}";
        var destPath = System.IO.Path.Combine(_settings.WorkingCopyPath, relativePath.Replace('/', System.IO.Path.DirectorySeparatorChar));
        CopyDirectoryRecursive(sourceDir, destPath);
        await _svnService.AddRecursiveAsync(_settings, relativePath);
    }

    private static void CopyDirectoryRecursive(string sourceDir, string destDir)
    {
        System.IO.Directory.CreateDirectory(destDir);
        foreach (var file in System.IO.Directory.GetFiles(sourceDir))
        {
            System.IO.File.Copy(file, System.IO.Path.Combine(destDir, System.IO.Path.GetFileName(file)), overwrite: true);
        }
        foreach (var subDir in System.IO.Directory.GetDirectories(sourceDir))
        {
            CopyDirectoryRecursive(subDir, System.IO.Path.Combine(destDir, System.IO.Path.GetFileName(subDir)));
        }
    }

    public async Task UploadDroppedFilesAsync(string targetFolder, IEnumerable<string> sourcePaths)
    {
        IsBusy = true;
        try
        {
            foreach (var sourcePath in sourcePaths)
            {
                if (System.IO.Directory.Exists(sourcePath))
                {
                    await CopyAndAddFolderAsync(sourcePath, targetFolder);
                    continue;
                }
                var fileName = System.IO.Path.GetFileName(sourcePath);
                var relativePath = string.IsNullOrEmpty(targetFolder) ? fileName : $"{targetFolder}/{fileName}";
                var destPath = System.IO.Path.Combine(_settings.WorkingCopyPath, relativePath.Replace('/', System.IO.Path.DirectorySeparatorChar));
                System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(destPath)!);
                System.IO.File.Copy(sourcePath, destPath, overwrite: true);
                await _svnService.AddAsync(_settings, relativePath);
            }
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task CreateFolderAsync(object? targetFolderObj)
    {
        var targetFolder = targetFolderObj as string ?? "";
        var name = PromptDialogHelper.Show("New folder name:", "Create Folder");
        if (string.IsNullOrWhiteSpace(name)) return;
        var relativePath = string.IsNullOrEmpty(targetFolder) ? name : $"{targetFolder}/{name}";

        IsBusy = true;
        try
        {
            await _svnService.CreateFolderAsync(_settings, relativePath);
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task DeleteAsync(object? pathObj)
    {
        var path = pathObj as string ?? SelectedItem?.Path;
        if (string.IsNullOrEmpty(path)) return;
        var confirm = MessageBox.Show($"Delete \"{path}\"?", "Confirm Delete", MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (confirm != MessageBoxResult.Yes) return;

        IsBusy = true;
        try
        {
            await _svnService.DeleteAsync(_settings, path);
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RenameAsync(object? pathObj)
    {
        var path = pathObj as string ?? SelectedItem?.Path;
        if (string.IsNullOrEmpty(path)) return;
        var parts = path.Split('/');
        var currentName = parts[^1];
        var newName = PromptDialogHelper.Show("Rename to:", "Rename", currentName);
        if (string.IsNullOrWhiteSpace(newName) || newName == currentName) return;
        var toPath = string.Join("/", parts[..^1].Append(newName));

        IsBusy = true;
        try
        {
            await _svnService.RenameAsync(_settings, path, toPath);
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task CommitAsync()
    {
        var selectedPaths = ChangedFiles.Where(f => f.IsChecked).Select(f => f.Path).ToList();
        if (selectedPaths.Count == 0 || string.IsNullOrWhiteSpace(CommitMessage)) return;

        IsBusy = true;
        try
        {
            await _svnService.CommitAsync(_settings, selectedPaths, CommitMessage);
            CommitMessage = "";
            StatusMessage = "Commit succeeded.";
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UpdateAsync()
    {
        IsBusy = true;
        try
        {
            await _svnService.UpdateAsync(_settings);
            StatusMessage = "Working copy updated.";
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RevertAsync(object? pathObj)
    {
        var paths = pathObj is string p ? new[] { p } : ChangedFiles.Where(f => f.IsChecked).Select(f => f.Path).ToArray();
        IsBusy = true;
        try
        {
            await _svnService.RevertAsync(_settings, paths);
            StatusMessage = "Reverted.";
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task ViewHistoryAsync(object? pathObj)
    {
        var path = pathObj as string;
        HistoryScopePath = path;
        IsHistoryVisible = true;
        IsBusy = true;
        try
        {
            var entries = await _svnService.GetLogAsync(_settings, path);
            HistoryEntries.Clear();
            foreach (var entry in entries) HistoryEntries.Add(entry);
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void CloseHistory() => IsHistoryVisible = false;

    [RelayCommand]
    private async Task LockAsync(object? pathObj)
    {
        var path = pathObj as string ?? SelectedItem?.Path;
        if (string.IsNullOrEmpty(path)) return;
        IsBusy = true;
        try
        {
            await _svnService.LockAsync(_settings, path);
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UnlockAsync(object? pathObj)
    {
        var path = pathObj as string ?? SelectedItem?.Path;
        if (string.IsNullOrEmpty(path)) return;
        IsBusy = true;
        try
        {
            await _svnService.UnlockAsync(_settings, path);
            await RefreshTreeAsync();
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }
}
