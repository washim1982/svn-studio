using System.Windows;
using System.Windows.Controls;
using SvnClient.App.Services;
using SvnClient.App.ViewModels;

namespace SvnClient.App.Views;

public partial class SettingsWindow : Window
{
    private readonly SettingsViewModel _viewModel;

    public SettingsWindow(SettingsService settingsService, SvnCliService svnService, AiReviewService aiService)
    {
        InitializeComponent();
        _viewModel = new SettingsViewModel(settingsService, svnService, aiService);
        DataContext = _viewModel;
        _viewModel.SettingsSaved += () => DialogResult = true;
    }

    // PasswordBox.Password isn't bindable (by design, so secrets don't sit in bindings).
    private void PasswordInput_PasswordChanged(object sender, RoutedEventArgs e)
    {
        _viewModel.Password = ((PasswordBox)sender).Password;
    }

    private void AiApiKeyInput_PasswordChanged(object sender, RoutedEventArgs e)
    {
        _viewModel.AiApiKey = ((PasswordBox)sender).Password;
    }
}
