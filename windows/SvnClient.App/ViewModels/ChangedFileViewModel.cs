using CommunityToolkit.Mvvm.ComponentModel;
using SvnClient.App.Models;

namespace SvnClient.App.ViewModels;

public partial class ChangedFileViewModel : ObservableObject
{
    public string Path { get; }
    public SvnItemStatus Status { get; }

    [ObservableProperty]
    private bool isChecked;

    // Defaults to checked so a change is actually ready to commit as soon as it
    // appears in the list, matching the web client's behavior.
    public ChangedFileViewModel(string path, SvnItemStatus status, bool isChecked = true)
    {
        Path = path;
        Status = status;
        this.isChecked = isChecked;
    }
}
