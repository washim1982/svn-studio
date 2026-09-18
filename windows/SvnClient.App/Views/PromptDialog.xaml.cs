using System.Windows;
using System.Windows.Input;

namespace SvnClient.App.Views;

public partial class PromptDialog : Window
{
    public string? ResultText { get; private set; }

    public PromptDialog(string label, string title, string? defaultValue = null)
    {
        InitializeComponent();
        Title = title;
        PromptLabel.Text = label;
        InputBox.Text = defaultValue ?? "";
        Loaded += (_, _) =>
        {
            InputBox.Focus();
            InputBox.SelectAll();
        };
    }

    private void Ok_Click(object sender, RoutedEventArgs e)
    {
        ResultText = InputBox.Text;
        DialogResult = true;
    }

    private void Cancel_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
    }

    private void InputBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) Ok_Click(sender, e);
        else if (e.Key == Key.Escape) Cancel_Click(sender, e);
    }
}

/// <summary>Static convenience wrapper so view models can prompt for text without taking a WPF dependency beyond this call.</summary>
public static class PromptDialogHelper
{
    public static string? Show(string label, string title, string? defaultValue = null)
    {
        var dialog = new PromptDialog(label, title, defaultValue) { Owner = Application.Current.MainWindow };
        return dialog.ShowDialog() == true ? dialog.ResultText : null;
    }
}
