using System.Windows;
using System.Windows.Controls;
using SvnClient.App.Services;
using SvnClient.App.ViewModels;

namespace SvnClient.App.Views;

public partial class SettingsWindow : Window
{
    private readonly SettingsViewModel _viewModel;

    public SettingsWindow(SettingsService settingsService, SvnCliService svnService)
    {
        InitializeComponent();
        _viewModel = new SettingsViewModel(settingsService, svnService);
        DataContext = _viewModel;
        _viewModel.SettingsSaved += () => DialogResult = true;
    }

    private void PasswordInput_PasswordChanged(object sender, RoutedEventArgs e)
    {
        _viewModel.Password = ((PasswordBox)sender).Password;
    }
}
