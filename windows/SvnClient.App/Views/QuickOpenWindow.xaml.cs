using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace SvnClient.App.Views;

public class QuickOpenItem
{
    public required string DisplayText { get; init; }
    public string? SubText { get; init; }
    public string? FilePath { get; init; }
    public Action? CommandAction { get; init; }
}

public partial class QuickOpenWindow : Window
{
    private readonly List<QuickOpenItem> _allItems;

    /// <summary>Set when the user picked a file; null if they ran a command or cancelled.</summary>
    public string? SelectedFilePath { get; private set; }

    public QuickOpenWindow(IEnumerable<string> filePaths, IEnumerable<(string Label, Action Action)> commands)
    {
        InitializeComponent();

        var commandItems = commands.Select(c => new QuickOpenItem { DisplayText = c.Label, CommandAction = c.Action });
        var fileItems = filePaths.Select(p => new QuickOpenItem
        {
            DisplayText = p.Split('/').Last(),
            SubText = p,
            FilePath = p,
        });
        _allItems = commandItems.Concat(fileItems).ToList();

        ResultsList.ItemsSource = _allItems;
        Loaded += (_, _) =>
        {
            QueryBox.Focus();
            if (ResultsList.Items.Count > 0) ResultsList.SelectedIndex = 0;
        };
    }

    private void QueryBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        var query = QueryBox.Text.Trim().ToLowerInvariant();
        var filtered = query.Length == 0
            ? _allItems
            : _allItems.Where(i => i.DisplayText.ToLowerInvariant().Contains(query) || (i.SubText?.ToLowerInvariant().Contains(query) ?? false)).ToList();
        ResultsList.ItemsSource = filtered;
        if (filtered.Count > 0) ResultsList.SelectedIndex = 0;
    }

    private void QueryBox_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        switch (e.Key)
        {
            case Key.Down:
                if (ResultsList.SelectedIndex < ResultsList.Items.Count - 1) ResultsList.SelectedIndex++;
                e.Handled = true;
                break;
            case Key.Up:
                if (ResultsList.SelectedIndex > 0) ResultsList.SelectedIndex--;
                e.Handled = true;
                break;
            case Key.Enter:
                Activate((QuickOpenItem?)ResultsList.SelectedItem);
                e.Handled = true;
                break;
            case Key.Escape:
                DialogResult = false;
                e.Handled = true;
                break;
        }
    }

    private void ResultsList_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        Activate((QuickOpenItem?)ResultsList.SelectedItem);
    }

    private void Activate(QuickOpenItem? item)
    {
        if (item == null) return;
        if (item.CommandAction != null)
        {
            item.CommandAction();
            DialogResult = true;
            return;
        }
        SelectedFilePath = item.FilePath;
        DialogResult = true;
    }
}
