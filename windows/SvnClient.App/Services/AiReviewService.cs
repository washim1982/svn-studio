using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SvnClient.App.Services;

public record AiReviewResult(string Review, string Model, bool Truncated, int FileCount);

/// <summary>
/// Client for any OpenAI-compatible chat endpoint. llama.cpp's llama-server serves this
/// API at /v1 out of the box (as do Ollama and LM Studio), so one client covers them all.
/// Mirrors the web backend's aiService.ts so both apps behave identically.
/// </summary>
public class AiReviewService
{
    // ~3.5k tokens of code context, leaving room for the prompt and reply inside a typical
    // 8192-token llama.cpp context (--ctx-size 8192).
    public const int MaxContextChars = 12_000;
    public const string DefaultReviewRequest = "Review this code.";

    // Local models on CPU can take minutes on a big diff.
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(5) };

    private const string ReviewSystemPrompt =
        """
        You are a senior software engineer reviewing code from a Subversion working copy.
        You will receive source files and/or unified diffs as context, followed by the user's request.
        If the user asks a specific question, answer it directly using the provided context.
        If the request is a general review (or empty), report, grouped by file:
        - Bugs and logic errors
        - Security issues (injection, secrets, unsafe input handling)
        - Risky or breaking changes
        - Concrete improvement suggestions
        Be specific and concise; quote the relevant line when useful. If the code looks fine, say so briefly.
        For a general review, finish with a one-line verdict: "Looks good", "Minor fixes suggested", or "Needs changes".
        """;

    /// <summary>Embedding-only models show up in /models but can't answer chat requests.</summary>
    public static bool IsChatModel(string id) => !id.Contains("embed", StringComparison.OrdinalIgnoreCase);

    /// <summary>Accepts "http://host:8080", ".../v1", or a full ".../v1/chat/completions" URL.</summary>
    private static string BaseUrl(string endpoint)
    {
        var url = endpoint.Trim().TrimEnd('/');
        if (url.Length == 0) throw new InvalidOperationException("No AI endpoint configured. Set one in Settings.");
        if (url.EndsWith("/chat/completions", StringComparison.OrdinalIgnoreCase)) url = url[..^"/chat/completions".Length];
        if (url.EndsWith("/models", StringComparison.OrdinalIgnoreCase)) url = url[..^"/models".Length];
        if (!Regex.IsMatch(url, @"/v\d+$")) url += "/v1";
        return url;
    }

    private static HttpRequestMessage NewRequest(HttpMethod method, string url, string apiKey)
    {
        var request = new HttpRequestMessage(method, url);
        if (!string.IsNullOrEmpty(apiKey))
        {
            // OpenAI-style servers read Authorization; many gateways read x-api-key instead.
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            request.Headers.Add("x-api-key", apiKey);
        }
        return request;
    }

    private static async Task<string> DescribeErrorAsync(HttpResponseMessage response)
    {
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            // Common with llama-server --api-key: /models is often open while chat is not.
            return $"{(int)response.StatusCode}: the AI server requires an API key (or rejected the one provided). Enter it under Settings → Local AI → API key";
        }
        var body = await response.Content.ReadAsStringAsync();
        if (body.Length > 300) body = body[..300];
        return $"{(int)response.StatusCode} {response.ReasonPhrase}{(body.Length > 0 ? ": " + body : "")}";
    }

    public async Task<List<string>> ListModelsAsync(string endpoint, string apiKey)
    {
        using var request = NewRequest(HttpMethod.Get, $"{BaseUrl(endpoint)}/models", apiKey);
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        using var response = await Http.SendAsync(request, cts.Token);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Model list request failed ({await DescribeErrorAsync(response)})");

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var models = new List<string>();
        var root = doc.RootElement;
        var array = root.TryGetProperty("data", out var data) ? data : root.TryGetProperty("models", out var m) ? m : default;
        if (array.ValueKind != JsonValueKind.Array) return models;
        foreach (var item in array.EnumerateArray())
        {
            foreach (var key in new[] { "id", "name", "model" })
            {
                if (item.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String)
                {
                    models.Add(v.GetString()!);
                    break;
                }
            }
        }
        return models;
    }

    /// <summary>
    /// A single-model llama-server ignores `model`, but llama.cpp's router mode, Ollama and
    /// LM Studio all route on it — so when none is configured, use the first chat-capable
    /// model the server advertises rather than sending a made-up name.
    /// </summary>
    private async Task<string> ResolveModelAsync(string endpoint, string model, string apiKey)
    {
        var wanted = model.Trim();
        List<string> models;
        try { models = await ListModelsAsync(endpoint, apiKey); }
        catch { models = new List<string>(); }

        if (wanted.Length == 0) return models.FirstOrDefault(IsChatModel) ?? "local-model";
        if (models.Count == 0 || models.Contains(wanted)) return wanted;
        return MatchModel(models, wanted) ?? wanted;
    }

    /// <summary>
    /// Gateways often list IDs with a hash suffix ("gemma-4-E4B-it-Q4_K_M-f43219f"), so a name
    /// typed or saved without it would be rejected — map it to the listed ID.
    /// </summary>
    public static string? MatchModel(IEnumerable<string> models, string wanted)
    {
        var list = models.ToList();
        return list.FirstOrDefault(m => m.Equals(wanted, StringComparison.OrdinalIgnoreCase))
               ?? list.FirstOrDefault(m => m.StartsWith(wanted, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Sends pre-built code context plus the user's request (a question, or blank for a
    /// general review). <paramref name="model"/> may be a per-request override.
    /// </summary>
    public async Task<(string Review, string Model)> ReviewCodeAsync(string endpoint, string model, string apiKey, string context, string userRequest)
    {
        var userContent = $"Context:\n\n{context}\nRequest: {(string.IsNullOrWhiteSpace(userRequest) ? DefaultReviewRequest : userRequest.Trim())}";

        var resolvedModel = await ResolveModelAsync(endpoint, model, apiKey);
        var payload = JsonSerializer.Serialize(new
        {
            model = resolvedModel,
            temperature = 0.2,
            stream = false,
            messages = new[]
            {
                new { role = "system", content = ReviewSystemPrompt },
                new { role = "user", content = userContent },
            },
        });

        using var request = NewRequest(HttpMethod.Post, $"{BaseUrl(endpoint)}/chat/completions", apiKey);
        request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
        HttpResponseMessage response;
        try
        {
            response = await Http.SendAsync(request);
        }
        catch (TaskCanceledException)
        {
            throw new InvalidOperationException("The model took too long to respond (5 min timeout).");
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"AI review request failed ({await DescribeErrorAsync(response)})");

            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var root = doc.RootElement;
            var raw = root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0
                      && choices[0].TryGetProperty("message", out var message)
                      && message.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.String
                ? content.GetString()!
                : "";
            // Reasoning models may inline their chain of thought in <think> tags; keep only the answer.
            var review = Regex.Replace(raw, @"<think>[\s\S]*?</think>", "", RegexOptions.IgnoreCase).Trim();
            if (review.Length == 0) throw new InvalidOperationException("The model returned an empty response.");
            var usedModel = root.TryGetProperty("model", out var mv) && mv.ValueKind == JsonValueKind.String ? mv.GetString()! : resolvedModel;
            return (review, usedModel);
        }
    }
}
