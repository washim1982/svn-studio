using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
using SvnClient.App.Services;

namespace SvnClient.App.Views;

public partial class AiReviewWindow : Window
{
    private readonly DispatcherTimer _timer = new() { Interval = TimeSpan.FromSeconds(1) };
    private readonly DateTime _started = DateTime.Now;

    /// <summary>Raised when the user asks to fix their AI settings from an error.</summary>
    public event Action? OpenSettingsRequested;

    public AiReviewWindow(string scopeLabel, string question)
    {
        InitializeComponent();
        ScopeText.Text = $"Scope: {scopeLabel} · {(string.IsNullOrWhiteSpace(question) ? "general code review" : $"“{question.Trim()}”")}";
        UpdateLoadingText();
        _timer.Tick += (_, _) => UpdateLoadingText();
        _timer.Start();
        Closed += (_, _) => _timer.Stop();
    }

    private void UpdateLoadingText() =>
        LoadingText.Text = $"Asking the local model… {(int)(DateTime.Now - _started).TotalSeconds}s";

    public void ShowResult(AiReviewResult result)
    {
        _timer.Stop();
        LoadingPanel.Visibility = Visibility.Collapsed;
        ResultText.Visibility = Visibility.Visible;
        ResultText.Foreground = (Brush)FindResource("TextBrush");
        ResultText.Text = result.Review;
        MetaText.Text = $"{result.Model} · {result.FileCount} file(s){(result.Truncated ? " · context truncated to fit the model" : "")}";
        CopyButton.Visibility = Visibility.Visible;
    }

    public void ShowError(string message)
    {
        _timer.Stop();
        LoadingPanel.Visibility = Visibility.Collapsed;
        ResultText.Visibility = Visibility.Visible;
        ResultText.Foreground = (Brush)FindResource("DangerBrush");
        ResultText.Text = message + "\n\nMake sure your local server is running (e.g. llama-server -m model.gguf --port 8080) and the endpoint in Settings is correct.";
        OpenSettingsButton.Visibility = Visibility.Visible;
    }

    private void Copy_Click(object sender, RoutedEventArgs e) => Clipboard.SetText(ResultText.Text);

    private void OpenSettings_Click(object sender, RoutedEventArgs e)
    {
        Close();
        OpenSettingsRequested?.Invoke();
    }

    private void Close_Click(object sender, RoutedEventArgs e) => Close();
}
