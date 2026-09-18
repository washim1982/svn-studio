namespace SvnClient.App.Models;

public class AppSettings
{
    public string RepoUrl { get; set; } = "";
    public string Username { get; set; } = "";
    /// <summary>DPAPI-protected (CurrentUser scope) ciphertext, base64-encoded. Never the raw password.</summary>
    public string? ProtectedPassword { get; set; }
    public string WorkingCopyPath { get; set; } = "";
    public bool DarkTheme { get; set; } = true;

    /// <summary>OpenAI-compatible base URL — defaults to the local llama.cpp gateway.</summary>
    public string AiEndpoint { get; set; } = "http://127.0.0.1:8181/v1";
    public string AiModel { get; set; } = "";
    /// <summary>DPAPI-protected, like ProtectedPassword. Optional: only needed for llama-server --api-key.</summary>
    public string? ProtectedAiApiKey { get; set; }

    public double LeftPanelWidth { get; set; } = 280;
    public double RightPanelWidth { get; set; } = 380;
}
