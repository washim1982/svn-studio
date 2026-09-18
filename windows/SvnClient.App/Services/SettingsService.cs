using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using SvnClient.App.Models;

namespace SvnClient.App.Services;

/// <summary>
/// Persists app settings to %AppData%\SvnStudio\settings.json. The SVN password is
/// protected with Windows DPAPI (CurrentUser scope) before it ever touches disk, so
/// the file is unreadable outside this Windows account.
/// </summary>
public class SettingsService
{
    private static readonly string SettingsDir =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SvnStudio");
    private static readonly string SettingsPath = Path.Combine(SettingsDir, "settings.json");
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("SvnStudio.v1.settings");

    public AppSettings Load()
    {
        if (!File.Exists(SettingsPath)) return new AppSettings();
        var json = File.ReadAllText(SettingsPath);
        return JsonSerializer.Deserialize<AppSettings>(json) ?? new AppSettings();
    }

    public void Save(AppSettings settings)
    {
        Directory.CreateDirectory(SettingsDir);
        var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(SettingsPath, json);
    }

    public void SetPlainPassword(AppSettings settings, string plainPassword)
    {
        if (string.IsNullOrEmpty(plainPassword))
        {
            settings.ProtectedPassword = null;
            return;
        }
        var protectedBytes = ProtectedData.Protect(Encoding.UTF8.GetBytes(plainPassword), Entropy, DataProtectionScope.CurrentUser);
        settings.ProtectedPassword = Convert.ToBase64String(protectedBytes);
    }

    public string GetPlainPassword(AppSettings settings)
    {
        if (string.IsNullOrEmpty(settings.ProtectedPassword)) return "";
        try
        {
            var bytes = Convert.FromBase64String(settings.ProtectedPassword);
            var plainBytes = ProtectedData.Unprotect(bytes, Entropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(plainBytes);
        }
        catch (CryptographicException)
        {
            // Protected blob from a different user/machine — treat as no password rather than crash.
            return "";
        }
    }
}
