namespace SvnClient.App.Models;

public class AppSettings
{
    public string RepoUrl { get; set; } = "";
    public string Username { get; set; } = "";
    /// <summary>DPAPI-protected (CurrentUser scope) ciphertext, base64-encoded. Never the raw password.</summary>
    public string? ProtectedPassword { get; set; }
    public string WorkingCopyPath { get; set; } = "";
    public bool DarkTheme { get; set; } = true;
}
