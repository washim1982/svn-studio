using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using SvnClient.App.Models;
using SvnClient.App.Services;

namespace SvnClient.App.ViewModels;

public partial class SettingsViewModel : ObservableObject
{
    private readonly SettingsService _settingsService;
    private readonly SvnCliService _svnService;

    [ObservableProperty]
    private string repoUrl = "";

    [ObservableProperty]
    private string username = "";

    [ObservableProperty]
    private string password = "";

    [ObservableProperty]
    private string workingCopyPath = "";

    [ObservableProperty]
    private string statusMessage = "";

    [ObservableProperty]
    private bool isBusy;

    public event Action? SettingsSaved;

    public SettingsViewModel(SettingsService settingsService, SvnCliService svnService)
    {
        _settingsService = settingsService;
        _svnService = svnService;
        var settings = _settingsService.Load();
        RepoUrl = settings.RepoUrl;
        Username = settings.Username;
        WorkingCopyPath = settings.WorkingCopyPath;
    }

    [RelayCommand]
    private void BrowseFolder()
    {
        var dialog = new OpenFolderDialog { Title = "Select local working-copy folder" };
        if (dialog.ShowDialog() == true)
        {
            WorkingCopyPath = dialog.FolderName;
        }
    }

    private AppSettings BuildSettings()
    {
        var settings = _settingsService.Load();
        settings.RepoUrl = RepoUrl;
        settings.Username = Username;
        settings.WorkingCopyPath = WorkingCopyPath;
        if (!string.IsNullOrEmpty(Password))
        {
            _settingsService.SetPlainPassword(settings, Password);
        }
        return settings;
    }

    [RelayCommand]
    private void Save()
    {
        var settings = BuildSettings();
        _settingsService.Save(settings);
        StatusMessage = "Settings saved.";
        SettingsSaved?.Invoke();
    }

    [RelayCommand]
    private async Task CheckoutAsync()
    {
        IsBusy = true;
        StatusMessage = "Checking out repository…";
        try
        {
            var settings = BuildSettings();
            _settingsService.Save(settings);
            await _svnService.CheckoutAsync(settings);
            StatusMessage = "Checkout complete.";
            SettingsSaved?.Invoke();
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
    private async Task RelinkAsync()
    {
        IsBusy = true;
        StatusMessage = "Relinking working copy…";
        try
        {
            if (!await _svnService.IsWorkingCopyAsync(WorkingCopyPath))
            {
                StatusMessage = "That folder is not a valid SVN working copy.";
                return;
            }
            var settings = _settingsService.Load();
            settings.WorkingCopyPath = WorkingCopyPath;
            _settingsService.Save(settings);
            StatusMessage = "Working copy relinked.";
            SettingsSaved?.Invoke();
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
