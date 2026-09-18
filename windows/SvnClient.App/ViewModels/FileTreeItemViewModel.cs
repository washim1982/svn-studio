using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using SvnClient.App.Models;

namespace SvnClient.App.ViewModels;

public partial class FileTreeItemViewModel : ObservableObject
{
    public SvnTreeNode Node { get; }

    public string Path => Node.Path;
    public string Name => Node.Name;
    public bool IsDirectory => Node.IsDirectory;
    public SvnItemStatus Status => Node.Status;
    public bool Locked => Node.Locked;

    [ObservableProperty]
    private bool isExpanded;

    [ObservableProperty]
    private bool isSelected;

    public ObservableCollection<FileTreeItemViewModel> Children { get; } = new();

    public FileTreeItemViewModel(SvnTreeNode node, int depth = 0)
    {
        Node = node;
        IsExpanded = depth < 1;
        foreach (var child in node.Children.OrderByDescending(c => c.IsDirectory).ThenBy(c => c.Name, StringComparer.OrdinalIgnoreCase))
        {
            Children.Add(new FileTreeItemViewModel(child, depth + 1));
        }
    }
}
