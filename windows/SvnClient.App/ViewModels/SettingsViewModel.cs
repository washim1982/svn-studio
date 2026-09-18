using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using SvnClient.App.Models;
using SvnClient.App.Services;

namespace SvnClient.App.ViewModels;

public record AiProviderPreset(string Label, string Url);

public partial class SettingsViewModel : ObservableObject
{
    private readonly SettingsService _settingsService;
    private readonly SvnCliService _svnService;
    private readonly AiReviewService _aiService;

    // All of these speak the OpenAI-compatible API, so only the base URL differs.
    public IReadOnlyList<AiProviderPreset> AiPresets { get; } = new[]
    {
        new AiProviderPreset("llama.cpp gateway", "http://127.0.0.1:8181/v1"),
        new AiProviderPreset("llama-server (direct)", "http://127.0.0.1:8080/v1"),
        new AiProviderPreset("Ollama", "http://127.0.0.1:11434/v1"),
        new AiProviderPreset("LM Studio", "http://127.0.0.1:1234/v1"),
    };

    // "localhost" and "127.0.0.1" (and a trailing slash) point at the same server.
    private static string NormalizeUrl(string url) =>
        url.Trim().TrimEnd('/').Replace("://localhost", "://127.0.0.1", StringComparison.OrdinalIgnoreCase).ToLowerInvariant();

    public ObservableCollection<string> AiModels { get; } = new();

    [ObservableProperty]
    private string aiEndpoint = "";

    [ObservableProperty]
    private string aiModel = "";

    [ObservableProperty]
    private string aiApiKey = "";

    [ObservableProperty]
    private string aiStatus = "";

    [ObservableProperty]
    private bool hasStoredAiApiKey;

    [ObservableProperty]
    private AiProviderPreset? selectedAiPreset;

    partial void OnSelectedAiPresetChanged(AiProviderPreset? value)
    {
        if (value != null) AiEndpoint = value.Url;
    }

    [RelayCommand]
    private async Task TestAiConnectionAsync()
    {
        AiStatus = "Connecting…";
        try
        {
            var key = string.IsNullOrEmpty(AiApiKey) ? _settingsService.GetPlainAiApiKey(_settingsService.Load()) : AiApiKey;
            var models = (await _aiService.ListModelsAsync(AiEndpoint, key)).Where(AiReviewService.IsChatModel).ToList();
            AiModels.Clear();
            foreach (var m in models) AiModels.Add(m);
            if (string.IsNullOrWhiteSpace(AiModel) && models.Count > 0) AiModel = models[0];
            AiStatus = $"Connected — {models.Count} model(s) available.";
        }
        catch (Exception ex)
        {
            AiModels.Clear();
            AiStatus = $"Error: {ex.Message}";
        }
    }

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

    public SettingsViewModel(SettingsService settingsService, SvnCliService svnService, AiReviewService aiService)
    {
        _settingsService = settingsService;
        _svnService = svnService;
        _aiService = aiService;
        var settings = _settingsService.Load();
        RepoUrl = settings.RepoUrl;
        Username = settings.Username;
        WorkingCopyPath = settings.WorkingCopyPath;
        AiEndpoint = settings.AiEndpoint;
        AiModel = settings.AiModel;
        HasStoredAiApiKey = !string.IsNullOrEmpty(settings.ProtectedAiApiKey);
        selectedAiPreset = AiPresets.FirstOrDefault(p => NormalizeUrl(p.Url) == NormalizeUrl(settings.AiEndpoint));
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
        settings.AiEndpoint = AiEndpoint.Trim();
        settings.AiModel = AiModel.Trim();
        // Blank means "keep the stored key", matching how the SVN password behaves.
        if (!string.IsNullOrEmpty(AiApiKey))
        {
            _settingsService.SetPlainAiApiKey(settings, AiApiKey);
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
