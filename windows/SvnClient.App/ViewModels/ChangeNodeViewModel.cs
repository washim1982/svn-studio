using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using SvnClient.App.Models;

namespace SvnClient.App.ViewModels;

/// <summary>
/// One row in the commit panel's nested changes tree. Unlike FileTreeItemViewModel,
/// IsChecked here is a pure projection of the owning MainViewModel's checked-paths set:
/// every toggle rebuilds the whole tree from that set rather than mutating VM state
/// in place, which keeps tri-state (checked/unchecked/indeterminate) cascades trivial
/// to reason about — see MainViewModel.RebuildChangesTree.
/// </summary>
public partial class ChangeNodeViewModel : ObservableObject
{
    public SvnTreeNode Node { get; }
    public string Name => Node.Name;
    public bool IsDirectory => Node.IsDirectory;
    public SvnItemStatus Status => Node.Status;
    public bool IsOwnChange => Node.Status != SvnItemStatus.Normal;

    /// <summary>Every path (self and/or descendants) in this subtree that is itself a
    /// change and therefore a valid commit/revert target.</summary>
    public List<string> ChangedPaths { get; }

    public ObservableCollection<ChangeNodeViewModel> Children { get; } = new();

    [ObservableProperty]
    private bool? isChecked;

    private readonly Action<ChangeNodeViewModel, bool> _onToggle;

    public ChangeNodeViewModel(SvnTreeNode node, HashSet<string> checkedPaths, Action<ChangeNodeViewModel, bool> onToggle)
    {
        Node = node;
        _onToggle = onToggle;
        ChangedPaths = new List<string>();
        CollectChangedPaths(node, ChangedPaths);

        foreach (var child in node.Children.OrderByDescending(c => c.IsDirectory).ThenBy(c => c.Name, StringComparer.OrdinalIgnoreCase))
        {
            Children.Add(new ChangeNodeViewModel(child, checkedPaths, onToggle));
        }

        var total = ChangedPaths.Count;
        var checkedCount = ChangedPaths.Count(checkedPaths.Contains);
        // Set the backing field directly (not the property) so this doesn't fire
        // OnIsCheckedChanged and re-enter the toggle callback during construction.
        isChecked = total == 0 ? false : checkedCount == 0 ? false : checkedCount == total ? true : null;
    }

    partial void OnIsCheckedChanged(bool? value)
    {
        // IsThreeState is off in the view, so user interaction only ever produces
        // true/false here — null only ever appears as a computed, non-interactive state.
        if (value.HasValue) _onToggle(this, value.Value);
    }

    private static void CollectChangedPaths(SvnTreeNode node, List<string> output)
    {
        if (node.Status != SvnItemStatus.Normal && !string.IsNullOrEmpty(node.Path)) output.Add(node.Path);
        foreach (var child in node.Children) CollectChangedPaths(child, output);
    }
}
