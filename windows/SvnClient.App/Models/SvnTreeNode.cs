namespace SvnClient.App.Models;

public class SvnTreeNode
{
    public required string Path { get; init; } // "/" separated, relative to working copy root
    public required string Name { get; init; }
    public bool IsDirectory { get; init; }
    // Settable (not init): getTree()'s fold-in pass patches these after a directory
    // node has already been created via EnsureDir(), once its own status entry is seen.
    public SvnItemStatus Status { get; set; }
    public bool Locked { get; set; }
    public string? Revision { get; init; }
    public List<SvnTreeNode> Children { get; init; } = new();
}
