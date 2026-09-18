using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Text;
using System.Xml.Linq;
using SvnClient.App.Models;

namespace SvnClient.App.Services;

public record SvnCommandResult(string StdOut, string StdErr, int ExitCode);

/// <summary>
/// Wraps the `svn` command-line client via Process.Start. Every method shells out
/// to the real SVN CLI so behavior matches what a developer would get on the
/// command line, and credentials are passed as argv (never through a shell string)
/// to avoid injection via paths, messages, or URLs.
/// </summary>
public class SvnCliService
{
    private readonly SettingsService _settingsService;

    public SvnCliService(SettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    private async Task<SvnCommandResult> RunAsync(IEnumerable<string> args, string? workingDirectory = null)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "svn",
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        foreach (var arg in args) psi.ArgumentList.Add(arg);

        using var process = new Process { StartInfo = psi };
        process.Start();
        var stdOutTask = process.StandardOutput.ReadToEndAsync();
        var stdErrTask = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        var stdOut = await stdOutTask;
        var stdErr = await stdErrTask;
        return new SvnCommandResult(stdOut, stdErr, process.ExitCode);
    }

    private List<string> AuthArgs(AppSettings settings)
    {
        var args = new List<string> { "--non-interactive", "--trust-server-cert" };
        if (!string.IsNullOrEmpty(settings.Username)) args.AddRange(new[] { "--username", settings.Username });
        var password = _settingsService.GetPlainPassword(settings);
        if (!string.IsNullOrEmpty(password)) args.AddRange(new[] { "--password", password });
        return args;
    }

    private static void EnsureOk(SvnCommandResult result, string action)
    {
        if (result.ExitCode != 0)
            throw new InvalidOperationException($"svn {action} failed: {(string.IsNullOrWhiteSpace(result.StdErr) ? result.StdOut : result.StdErr)}");
    }

    private static string ToPosix(string p) => p.Replace('\\', '/');

    // ---- status ----------------------------------------------------------

    public async Task<List<SvnStatusEntry>> GetStatusAsync(AppSettings settings)
    {
        var args = new List<string> { "status", "--xml" };
        args.AddRange(AuthArgs(settings));
        var result = await RunAsync(args, settings.WorkingCopyPath);
        EnsureOk(result, "status");

        var doc = XDocument.Parse(result.StdOut);
        var entries = new List<SvnStatusEntry>();
        foreach (var entry in doc.Descendants("entry"))
        {
            var path = ToPosix(entry.Attribute("path")?.Value ?? "");
            var wcStatus = entry.Element("wc-status");
            var code = wcStatus?.Attribute("item")?.Value;
            entries.Add(new SvnStatusEntry
            {
                Path = path,
                Status = SvnStatusEntry.ParseCode(code),
                Locked = wcStatus?.Element("lock") != null,
                Revision = wcStatus?.Attribute("revision")?.Value,
                IsDirectory = wcStatus?.Attribute("kind")?.Value == "dir",
            });
        }
        return entries;
    }

    // ---- tree (svn list -R merged with status) ----------------------------

    public async Task<SvnTreeNode> GetTreeAsync(AppSettings settings)
    {
        var args = new List<string> { "list", "-R", "--xml" };
        args.AddRange(AuthArgs(settings));
        var result = await RunAsync(args, settings.WorkingCopyPath);
        EnsureOk(result, "list");

        var doc = XDocument.Parse(result.StdOut);
        var listEntries = doc.Descendants("entry").ToList();

        List<SvnStatusEntry> statusEntries;
        try { statusEntries = await GetStatusAsync(settings); }
        catch { statusEntries = new List<SvnStatusEntry>(); }
        var statusMap = statusEntries.ToDictionary(e => e.Path, e => e);

        var root = new SvnTreeNode { Path = "", Name = "/", IsDirectory = true };
        var dirIndex = new Dictionary<string, SvnTreeNode> { [""] = root };

        SvnTreeNode EnsureDir(string dirPath)
        {
            if (dirIndex.TryGetValue(dirPath, out var existing)) return existing;
            var parentPath = string.Join("/", dirPath.Split('/')[..^1]);
            var parent = EnsureDir(parentPath);
            var name = dirPath.Split('/').Last();
            var node = new SvnTreeNode { Path = dirPath, Name = name, IsDirectory = true };
            parent.Children.Add(node);
            dirIndex[dirPath] = node;
            return node;
        }

        var seenPaths = new HashSet<string>();
        foreach (var entry in listEntries)
        {
            var entryPath = ToPosix(entry.Attribute("path")?.Value ?? entry.Element("name")?.Value ?? "");
            if (string.IsNullOrEmpty(entryPath)) continue;
            seenPaths.Add(entryPath);
            var isDirectory = entry.Attribute("kind")?.Value == "dir";
            var parentPath = string.Join("/", entryPath.Split('/')[..^1]);
            var parent = EnsureDir(parentPath);
            var name = entryPath.Split('/').Last();
            statusMap.TryGetValue(entryPath, out var statusEntry);
            var node = new SvnTreeNode
            {
                Path = entryPath,
                Name = name,
                IsDirectory = isDirectory,
                Status = statusEntry?.Status ?? SvnItemStatus.Normal,
                Locked = statusEntry?.Locked ?? false,
                Revision = entry.Element("commit")?.Attribute("revision")?.Value,
            };
            if (isDirectory) dirIndex[entryPath] = node;
            parent.Children.Add(node);
        }

        // Add unversioned/added/missing paths that `svn list` doesn't surface (it queries
        // the *repository*, so brand-new local adds never appear in it).
        //
        // Directories route through EnsureDir(), which is idempotent and keyed by path:
        // regardless of whether a new folder's own status entry is processed before or
        // after a file inside it, the folder ends up as a single node with the correct
        // status. Previously this loop always created a leaf `IsDirectory = false` node,
        // so a new folder either showed as a fake file, or — if a child file's status was
        // processed first and EnsureDir() had already created a directory placeholder for
        // it — got skipped by the dirIndex check below and stayed stuck at "Normal".
        foreach (var status in statusEntries)
        {
            if (status.IsDirectory)
            {
                var dirNode = EnsureDir(status.Path);
                dirNode.Status = status.Status;
                dirNode.Locked = status.Locked;
                continue;
            }
            if (seenPaths.Contains(status.Path)) continue;
            var parentPath = string.Join("/", status.Path.Split('/')[..^1]);
            var parent = EnsureDir(parentPath);
            if (parent.Children.Any(c => c.Path == status.Path)) continue;
            parent.Children.Add(new SvnTreeNode
            {
                Path = status.Path,
                Name = status.Path.Split('/').Last(),
                IsDirectory = false,
                Status = status.Status,
                Locked = status.Locked,
            });
        }

        return root;
    }

    // ---- content -----------------------------------------------------------

    public async Task<string> GetFileContentAsync(AppSettings settings, string relativePath)
    {
        var absPath = Path.Combine(settings.WorkingCopyPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var args = new List<string> { "cat", absPath };
        args.AddRange(AuthArgs(settings));
        var result = await RunAsync(args, settings.WorkingCopyPath);
        if (result.ExitCode != 0)
        {
            // Unversioned/added files have no repository revision yet; read from disk instead.
            return await File.ReadAllTextAsync(absPath);
        }
        return result.StdOut;
    }

    public async Task WriteFileContentAsync(AppSettings settings, string relativePath, string content)
    {
        var absPath = Path.Combine(settings.WorkingCopyPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        await File.WriteAllTextAsync(absPath, content);
    }

    public async Task<string> GetDiffAsync(AppSettings settings, string relativePath)
    {
        var absPath = Path.Combine(settings.WorkingCopyPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var args = new List<string> { "diff", absPath };
        args.AddRange(AuthArgs(settings));
        var result = await RunAsync(args, settings.WorkingCopyPath);
        return result.StdOut;
    }

    // ---- mutations -----------------------------------------------------------

    public async Task AddAsync(AppSettings settings, string relativePath)
    {
        var absPath = Path.Combine(settings.WorkingCopyPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var result = await RunAsync(new[] { "add", "--parents", absPath }, settings.WorkingCopyPath);
        EnsureOk(result, "add");
    }

    /// <summary>
    /// Schedules a directory and everything inside it for addition in one call
    /// (svn recurses into unversioned children of a directory by default).
    /// Used after copying a whole folder into the working copy.
    /// </summary>
    public async Task AddRecursiveAsync(AppSettings settings, string relativePath)
    {
        var absPath = Path.Combine(settings.WorkingCopyPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var result = await RunAsync(new[] { "add", "--parents", "--force", absPath }, settings.WorkingCopyPath);
        EnsureOk(result, "add");
    }

    public async Task DeleteAsync(AppSettings settings, string relativePath)
    {
        var absPath = Path.Combine(settings.WorkingCopyPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var result = await RunAsync(new[] { "delete", "--force", absPath }, settings.WorkingCopyPath);
        EnsureOk(result, "delete");
    }

    public async Task RenameAsync(AppSettings settings, string fromPath, string toPath)
    {
        var absFrom = Path.Combine(settings.WorkingCopyPath, fromPath.Replace('/', Path.DirectorySeparatorChar));
        var absTo = Path.Combine(settings.WorkingCopyPath, toPath.Replace('/', Path.DirectorySeparatorChar));
        var result = await RunAsync(new[] { "move", "--parents", absFrom, absTo }, settings.WorkingCopyPath);
        EnsureOk(result, "move");
    }

    public async Task CreateFolderAsync(AppSettings settings, string relativePath)
    {
        var absPath = Path.Combine(settings.WorkingCopyPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var result = await RunAsync(new[] { "mkdir", "--parents", absPath }, settings.WorkingCopyPath);
        EnsureOk(result, "mkdir");
    }

    public async Task<SvnCommandResult> CommitAsync(AppSettings settings, IEnumerable<string> relativePaths, string message)
    {
        var args = new List<string> { "commit", "-m", message };
        args.AddRange(relativePaths.Select(p => Path.Combine(settings.WorkingCopyPath, p.Replace('/', Path.DirectorySeparatorChar))));
        args.AddRange(AuthArgs(settings));
        var result = await RunAsync(args, settings.WorkingCopyPath);
        EnsureOk(result, "commit");
        return result;
    }

    public async Task<SvnCommandResult> UpdateAsync(AppSettings settings)
    {
        var args = new List<string> { "update", "--accept", "postpone" };
        args.AddRange(AuthArgs(settings));
        var result = await RunAsync(args, settings.WorkingCopyPath);
        EnsureOk(result, "update");
        return result;
    }

    public async Task<SvnCommandResult> RevertAsync(AppSettings settings, IEnumerable<string> relativePaths)
    {
        var paths = relativePaths.ToList();
        List<string> args;
        if (paths.Count == 0)
        {
            args = new List<string> { "revert", "-R", settings.WorkingCopyPath };
        }
        else
        {
            args = new List<string> { "revert" };
            args.AddRange(paths.Select(p => Path.Combine(settings.WorkingCopyPath, p.Replace('/', Path.DirectorySeparatorChar))));
        }
        var result = await RunAsync(args, settings.WorkingCopyPath);
        EnsureOk(result, "revert");
        return result;
    }

    public async Task<List<SvnLogEntry>> GetLogAsync(AppSettings settings, string? relativePath = null, int limit = 100)
    {
        var target = relativePath is null
            ? settings.WorkingCopyPath
            : Path.Combine(settings.WorkingCopyPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var args = new List<string> { "log", "--xml", "-v", "-l", limit.ToString(CultureInfo.InvariantCulture), target };
        args.AddRange(AuthArgs(settings));
        var result = await RunAsync(args, settings.WorkingCopyPath);
        EnsureOk(result, "log");

        var doc = XDocument.Parse(result.StdOut);
        var entries = new List<SvnLogEntry>();
        foreach (var logEntry in doc.Descendants("logentry"))
        {
            var paths = logEntry.Element("paths")?.Elements("path")
                .Select(p => new SvnLogPathChange { Path = p.Value, Action = p.Attribute("action")?.Value ?? "" })
                .ToList() ?? new List<SvnLogPathChange>();

            entries.Add(new SvnLogEntry
            {
                Revision = logEntry.Attribute("revision")?.Value ?? "",
                Author = logEntry.Element("author")?.Value ?? "(unknown)",
                Date = DateTime.TryParse(logEntry.Element("date")?.Value, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var d) ? d : DateTime.MinValue,
                Message = logEntry.Element("msg")?.Value ?? "",
                Paths = paths,
            });
        }
        return entries;
    }

    public async Task LockAsync(AppSettings settings, string relativePath, string? message = null)
    {
        var absPath = Path.Combine(settings.WorkingCopyPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var args = new List<string> { "lock", absPath };
        if (!string.IsNullOrEmpty(message)) args.AddRange(new[] { "-m", message });
        args.AddRange(AuthArgs(settings));
        var result = await RunAsync(args, settings.WorkingCopyPath);
        EnsureOk(result, "lock");
    }

    public async Task UnlockAsync(AppSettings settings, string relativePath)
    {
        var absPath = Path.Combine(settings.WorkingCopyPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var args = new List<string> { "unlock", absPath };
        args.AddRange(AuthArgs(settings));
        var result = await RunAsync(args, settings.WorkingCopyPath);
        EnsureOk(result, "unlock");
    }

    public async Task<SvnCommandResult> CheckoutAsync(AppSettings settings)
    {
        var args = new List<string> { "checkout", settings.RepoUrl, settings.WorkingCopyPath };
        args.AddRange(AuthArgs(settings));
        var result = await RunAsync(args, null);
        EnsureOk(result, "checkout");
        return result;
    }

    public async Task<bool> IsWorkingCopyAsync(string workingCopyPath)
    {
        var result = await RunAsync(new[] { "info", workingCopyPath }, null);
        return result.ExitCode == 0;
    }
}
