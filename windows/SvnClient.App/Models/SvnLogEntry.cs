namespace SvnClient.App.Models;

public class SvnLogPathChange
{
    public required string Path { get; init; }
    public required string Action { get; init; }
}

public class SvnLogEntry
{
    public required string Revision { get; init; }
    public required string Author { get; init; }
    public required DateTime Date { get; init; }
    public required string Message { get; init; }
    public List<SvnLogPathChange> Paths { get; init; } = new();
}
