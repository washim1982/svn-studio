// Talks to any OpenAI-compatible chat endpoint. llama.cpp's `llama-server` serves this
// API at /v1 out of the box, as do Ollama (/v1) and LM Studio, so one client covers them.

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // local models on CPU can take minutes on a big diff
// ~3.5k tokens of code context, leaving room for the prompt and the reply inside a typical
// 8192-token llama.cpp context (--ctx-size 8192) without triggering context overflow.
export const MAX_CONTEXT_CHARS = 12_000;

/** Embedding-only models show up in /models but can't answer chat requests. */
export function isChatModel(id: string): boolean {
  return !/embed/i.test(id);
}

export interface AiConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

/** Accepts "http://host:8080", ".../v1", or a full ".../v1/chat/completions" URL. */
function baseUrl(endpoint: string): string {
  let url = endpoint.trim().replace(/\/+$/, "");
  if (!url) throw new Error("No AI endpoint configured. Set one in Settings.");
  url = url.replace(/\/chat\/completions$/, "").replace(/\/models$/, "");
  if (!/\/v\d+$/.test(url)) url += "/v1";
  return url;
}

function headers(apiKey: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    // OpenAI-style servers read Authorization; many gateways read x-api-key instead.
    h.Authorization = `Bearer ${apiKey}`;
    h["x-api-key"] = apiKey;
  }
  return h;
}

async function readError(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) {
    // Common with llama-server --api-key: /models is often open while chat is not.
    return `${res.status}: the AI server requires an API key (or rejected the one provided). Enter it under Settings → Local AI → API key`;
  }
  const text = await res.text().catch(() => "");
  return `${res.status} ${res.statusText}${text ? `: ${text.slice(0, 300)}` : ""}`;
}

export async function listModels(config: Pick<AiConfig, "endpoint" | "apiKey">): Promise<string[]> {
  const res = await fetch(`${baseUrl(config.endpoint)}/models`, {
    headers: headers(config.apiKey),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Model list request failed (${await readError(res)})`);
  const body: any = await res.json();
  const models: any[] = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
  return models.map((m) => String(m.id ?? m.name ?? m.model)).filter(Boolean);
}

const REVIEW_SYSTEM_PROMPT = `You are a senior software engineer reviewing code from a Subversion working copy.
You will receive source files and/or unified diffs as context, followed by the user's request.
If the user asks a specific question, answer it directly using the provided context.
If the request is a general review (or empty), report, grouped by file:
- Bugs and logic errors
- Security issues (injection, secrets, unsafe input handling)
- Risky or breaking changes
- Concrete improvement suggestions
Be specific and concise; quote the relevant line when useful. If the code looks fine, say so briefly.
For a general review, finish with a one-line verdict: "Looks good", "Minor fixes suggested", or "Needs changes".`;

export const DEFAULT_REVIEW_REQUEST = "Review this code.";

/**
 * Sends pre-built code context plus the user's request (a question, or blank for a
 * general review). `config.model` may be a per-request override from the review box.
 */
export async function reviewCode(
  config: AiConfig,
  context: string,
  request: string
): Promise<{ review: string; model: string }> {
  const userContent = `Context:\n\n${context}\nRequest: ${request.trim() || DEFAULT_REVIEW_REQUEST}`;

  const model = await resolveModel(config);
  const res = await fetch(`${baseUrl(config.endpoint)}/chat/completions`, {
    method: "POST",
    headers: headers(config.apiKey),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      stream: false,
      messages: [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI review request failed (${await readError(res)})`);
  const data: any = await res.json();
  // Reasoning models (e.g. Phi-4-mini-reasoning, Qwen3) may inline their chain of
  // thought in <think> tags; only the final answer belongs in the review.
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  const review = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!review) throw new Error("The model returned an empty response.");
  return { review, model: data?.model ?? model };
}

/**
 * A single-model llama-server ignores `model`, but llama.cpp's router mode, Ollama and
 * LM Studio all route on it — so when none is configured, use the first chat-capable
 * model the server advertises rather than sending a made-up name.
 */
async function resolveModel(config: AiConfig): Promise<string> {
  const wanted = config.model.trim();
  const models = await listModels(config).catch(() => [] as string[]);
  if (!wanted) return models.find(isChatModel) ?? "local-model";
  if (models.length === 0 || models.includes(wanted)) return wanted;
  // Gateways often list IDs with a hash suffix ("gemma-4-E4B-it-Q4_K_M-f43219f"), so a
  // name typed or saved without it would be rejected — map it to the listed ID.
  const lower = wanted.toLowerCase();
  return models.find((m) => m.toLowerCase() === lower) ?? models.find((m) => m.toLowerCase().startsWith(lower)) ?? wanted;
}
