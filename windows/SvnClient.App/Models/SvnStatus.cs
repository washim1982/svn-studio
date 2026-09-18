namespace SvnClient.App.Models;

public enum SvnItemStatus
{
    Normal,
    Modified,
    Added,
    Deleted,
    Unversioned,
    Missing,
    Replaced,
    Conflicted,
    Ignored,
    External,
    Obstructed,
}

public class SvnStatusEntry
{
    public required string Path { get; init; }
    public SvnItemStatus Status { get; init; }
    public bool Locked { get; init; }
    public string? Revision { get; init; }
    public bool IsDirectory { get; init; }

    public static SvnItemStatus ParseCode(string? code) => code switch
    {
        "modified" => SvnItemStatus.Modified,
        "added" => SvnItemStatus.Added,
        "deleted" => SvnItemStatus.Deleted,
        "unversioned" => SvnItemStatus.Unversioned,
        "missing" => SvnItemStatus.Missing,
        "replaced" => SvnItemStatus.Replaced,
        "conflicted" => SvnItemStatus.Conflicted,
        "ignored" => SvnItemStatus.Ignored,
        "external" => SvnItemStatus.External,
        "obstructed" => SvnItemStatus.Obstructed,
        _ => SvnItemStatus.Normal,
    };
}
