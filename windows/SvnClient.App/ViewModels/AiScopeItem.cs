namespace SvnClient.App.ViewModels;

public enum AiScopeKind
{
    File,
    Folder,
    Changes,
}

/// <summary>One chip in the AI review box's scope row.</summary>
public class AiScopeItem
{
    public required AiScopeKind Kind { get; init; }
    /// <summary>Working-copy-relative path; "" for a folder means the whole working copy.</summary>
    public required string Path { get; init; }
    /// <summary>True for the default "currently open file" chip.</summary>
    public bool IsAuto { get; init; }
    public int ChangeCount { get; init; }

    public string Icon => Kind switch { AiScopeKind.File => "📄", AiScopeKind.Folder => "📁", _ => "±" };

    public string Label => Kind switch
    {
        AiScopeKind.Changes => $"Changes ({ChangeCount})",
        AiScopeKind.Folder when Path.Length == 0 => "Whole working copy",
        _ => Path.Split('/').Last(),
    };

    public string ToolTip => Kind == AiScopeKind.Changes ? "Checked changes in the list above" : Path.Length == 0 ? "Whole working copy" : Path;
}
