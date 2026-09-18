using System.Windows;
using SvnClient.App.Services;
using SvnClient.App.ViewModels;
using SvnClient.App.Views;

namespace SvnClient.App;

public partial class App : System.Windows.Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var settingsService = new SettingsService();
        var svnService = new SvnCliService(settingsService);
        var aiService = new AiReviewService();
        var mainViewModel = new MainViewModel(svnService, settingsService, aiService);

        var mainWindow = new MainWindow(mainViewModel, settingsService, svnService, aiService);
        MainWindow = mainWindow;
        mainWindow.Show();

        _ = mainViewModel.InitializeAsync();
    }
}
