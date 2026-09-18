using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using SvnClient.App.Services;
using SvnClient.App.ViewModels;

namespace SvnClient.App.Views;

public partial class MainWindow : Window
{
    private readonly MainViewModel _viewModel;
    private readonly SettingsService _settingsService;
    private readonly SvnCliService _svnService;
    private readonly AiReviewService _aiService;

    public MainWindow(MainViewModel viewModel, SettingsService settingsService, SvnCliService svnService, AiReviewService aiService)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _settingsService = settingsService;
        _svnService = svnService;
        _aiService = aiService;
        DataContext = _viewModel;
        Closing += (_, _) => _viewModel.SaveLayout();
    }

    private void Settings_Click(object sender, RoutedEventArgs e) => OpenSettings();

    private void OpenSettings()
    {
        var settingsWindow = new SettingsWindow(_settingsService, _svnService, _aiService) { Owner = this };
        if (settingsWindow.ShowDialog() == true)
        {
            _ = _viewModel.RefreshTreeCommand.ExecuteAsync(null);
        }
    }

    private async void AiReview_Click(object sender, RoutedEventArgs e)
    {
        if (!_viewModel.CanAiReview) return;
        // Non-modal, so it can show a live "asking… Ns" state while the model runs.
        var window = new AiReviewWindow(_viewModel.AiScopeLabel, _viewModel.AiQuestion) { Owner = this };
        window.OpenSettingsRequested += OpenSettings;
        window.Show();
        try
        {
            var result = await _viewModel.RunAiReviewAsync();
            if (window.IsLoaded) window.ShowResult(result);
        }
        catch (Exception ex)
        {
            if (window.IsLoaded) window.ShowError(ex.Message);
        }
    }

    private void AiQuestionBox_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && !Keyboard.Modifiers.HasFlag(ModifierKeys.Shift))
        {
            e.Handled = true;
            AiReview_Click(sender, e);
        }
    }

    /// <summary>The "+" menu is built on click so its labels and enabled states reflect
    /// what's currently open and already in scope.</summary>
    private void AiAddScope_Click(object sender, RoutedEventArgs e)
    {
        var menu = new ContextMenu();
        var openFile = _viewModel.CurrentFilePath;

        MenuItem Item(string header, bool enabled, Action onClick)
        {
            var item = new MenuItem { Header = header, IsEnabled = enabled };
            item.Click += (_, _) => onClick();
            return item;
        }

        menu.Items.Add(Item(
            openFile != null ? $"📄 Open file: {openFile.Split('/').Last()}" : "📄 Open file (none open)",
            openFile != null && !_viewModel.IsInAiScope(AiScopeKind.File, openFile),
            () => _viewModel.AddToAiScope(AiScopeKind.File, openFile!)));

        var openDir = openFile != null && openFile.Contains('/') ? openFile[..openFile.LastIndexOf('/')] : null;
        if (openDir != null)
        {
            menu.Items.Add(Item(
                $"📁 Folder of open file: {openDir.Split('/').Last()}",
                !_viewModel.IsInAiScope(AiScopeKind.Folder, openDir),
                () => _viewModel.AddToAiScope(AiScopeKind.Folder, openDir)));
        }

        menu.Items.Add(Item("📁 Working folder…", true, PickAiFolder));

        menu.Items.Add(Item(
            $"± Checked changes ({_viewModel.SelectedChangedCount})",
            _viewModel.SelectedChangedCount > 0 && !_viewModel.IsInAiScope(AiScopeKind.Changes, ""),
            () => _viewModel.AddToAiScope(AiScopeKind.Changes, "")));

        menu.PlacementTarget = AiAddScopeButton;
        menu.Placement = System.Windows.Controls.Primitives.PlacementMode.Top;
        menu.IsOpen = true;
    }

    private void PickAiFolder()
    {
        // Reuses the quick-open picker: folders as the searchable list, plus a
        // "whole working copy" entry at the top.
        var commands = new List<(string Label, Action Action)>
        {
            ("📁 Whole working copy", () => _viewModel.AddToAiScope(AiScopeKind.Folder, "")),
        };
        var dialog = new QuickOpenWindow(_viewModel.FlattenFolderPaths(), commands)
        {
            Owner = this,
            Title = "Add a working folder to the AI review scope",
        };
        if (dialog.ShowDialog() == true && dialog.SelectedFilePath != null)
        {
            _viewModel.AddToAiScope(AiScopeKind.Folder, dialog.SelectedFilePath);
        }
        AiQuestionBox.Focus();
    }

    private void LeftSplitter_DoubleClick(object sender, MouseButtonEventArgs e) => _viewModel.ResetLeftPanelWidth();

    private void RightSplitter_DoubleClick(object sender, MouseButtonEventArgs e) => _viewModel.ResetRightPanelWidth();

    private void QuickOpen_Click(object sender, RoutedEventArgs e)
    {
        var commands = new List<(string Label, Action Action)>
        {
            ("SVN: Update working copy", () => _viewModel.UpdateCommand.Execute(null)),
            ("SVN: Show Source Control panel", () => _viewModel.CloseHistoryCommand.Execute(null)),
            ("SVN: Show History", () => _viewModel.ViewHistoryCommand.Execute(null)),
            ("Explorer: Refresh Tree", () => _viewModel.RefreshTreeCommand.Execute(null)),
            ("Preferences: Open Settings", OpenSettings),
        };
        var dialog = new QuickOpenWindow(_viewModel.FlattenFilePaths(), commands) { Owner = this };
        if (dialog.ShowDialog() == true && dialog.SelectedFilePath != null)
        {
            _viewModel.NavigateToFileByPath(dialog.SelectedFilePath);
        }
    }

    private void FileTreeView_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
    {
        _viewModel.SelectedItem = e.NewValue as FileTreeItemViewModel;
    }

    private void FileTreeView_PreviewDragOver(object sender, DragEventArgs e)
    {
        e.Effects = e.Data.GetDataPresent(DataFormats.FileDrop) ? DragDropEffects.Copy : DragDropEffects.None;
        e.Handled = true;
    }

    private void FileTreeView_PreviewDrop(object sender, DragEventArgs e)
    {
        if (!e.Data.GetDataPresent(DataFormats.FileDrop)) return;
        var files = (string[])e.Data.GetData(DataFormats.FileDrop)!;

        var targetItem = FindAncestorTreeViewItem(e.OriginalSource as DependencyObject);
        var targetFolder = targetItem?.DataContext as FileTreeItemViewModel;
        var targetPath = targetFolder != null
            ? (targetFolder.IsDirectory ? targetFolder.Path : System.IO.Path.GetDirectoryName(targetFolder.Path)?.Replace('\\', '/') ?? "")
            : "";

        _ = _viewModel.UploadDroppedFilesAsync(targetPath, files);
        e.Handled = true;
    }

    private static TreeViewItem? FindAncestorTreeViewItem(DependencyObject? source)
    {
        while (source != null && source is not TreeViewItem)
        {
            source = VisualTreeHelper.GetParent(source);
        }
        return source as TreeViewItem;
    }
}
