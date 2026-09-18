using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using SvnClient.App.Services;
using SvnClient.App.ViewModels;

namespace SvnClient.App.Views;

public partial class MainWindow : Window
{
    private readonly MainViewModel _viewModel;
    private readonly SettingsService _settingsService;
    private readonly SvnCliService _svnService;

    public MainWindow(MainViewModel viewModel, SettingsService settingsService, SvnCliService svnService)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _settingsService = settingsService;
        _svnService = svnService;
        DataContext = _viewModel;
    }

    private void Settings_Click(object sender, RoutedEventArgs e)
    {
        var settingsWindow = new SettingsWindow(_settingsService, _svnService) { Owner = this };
        if (settingsWindow.ShowDialog() == true)
        {
            _ = _viewModel.RefreshTreeCommand.ExecuteAsync(null);
        }
    }

    private void QuickOpen_Click(object sender, RoutedEventArgs e)
    {
        var commands = new List<(string Label, Action Action)>
        {
            ("SVN: Update working copy", () => _viewModel.UpdateCommand.Execute(null)),
            ("SVN: Show Source Control panel", () => _viewModel.CloseHistoryCommand.Execute(null)),
            ("SVN: Show History", () => _viewModel.ViewHistoryCommand.Execute(null)),
            ("Explorer: Refresh Tree", () => _viewModel.RefreshTreeCommand.Execute(null)),
            ("Preferences: Open Settings", () => Settings_Click(sender, e)),
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
