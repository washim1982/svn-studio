import { useEffect, useState } from "react";
import { svnApi } from "../api/svnApi";
import type { SvnSettingsPublic } from "../types/svn";

interface SettingsProps {
  onClose: () => void;
  onSaved: () => void;
}

// All of these speak the OpenAI-compatible API, so only the base URL differs.
const AI_PRESETS: { label: string; url: string }[] = [
  { label: "llama.cpp gateway", url: "http://127.0.0.1:8181/v1" },
  { label: "llama-server (direct)", url: "http://127.0.0.1:8080/v1" },
  { label: "Ollama", url: "http://127.0.0.1:11434/v1" },
  { label: "LM Studio", url: "http://127.0.0.1:1234/v1" },
];

// "localhost" and "127.0.0.1" (and a trailing slash) point at the same server, so a
// saved "http://localhost:8181/v1" should still show as the gateway preset.
const normalizeUrl = (u: string) => u.trim().replace(/\/+$/, "").replace("://localhost", "://127.0.0.1").toLowerCase();

export function Settings({ onClose, onSaved }: SettingsProps) {
  const [settings, setSettings] = useState<SvnSettingsPublic | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [workingCopyPath, setWorkingCopyPath] = useState("");
  const [aiEndpoint, setAiEndpoint] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [aiStatus, setAiStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    svnApi.getSettings().then((s) => {
      setSettings(s);
      setRepoUrl(s.repoUrl);
      setUsername(s.username);
      setWorkingCopyPath(s.workingCopyPath);
      setAiEndpoint(s.aiEndpoint);
      setAiModel(s.aiModel);
    });
  }, []);

  const presetValue = AI_PRESETS.find((p) => normalizeUrl(p.url) === normalizeUrl(aiEndpoint))?.url ?? "custom";

  async function handleSave() {
    setBusy(true);
    setStatus(null);
    try {
      const saved = await svnApi.saveSettings({
        repoUrl,
        username,
        password: password || undefined,
        workingCopyPath,
        aiEndpoint,
        aiModel,
        aiApiKey: aiApiKey || undefined,
      });
      setSettings(saved);
      setStatus("Settings saved.");
      onSaved();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleTestAi() {
    setAiStatus({ ok: true, text: "Connecting…" });
    try {
      const { models } = await svnApi.testAi(aiEndpoint, aiApiKey || undefined);
      setAiModels(models);
      if (!aiModel && models.length > 0) setAiModel(models[0]);
      setAiStatus({ ok: true, text: `Connected — ${models.length} model(s) available.` });
    } catch (err: any) {
      setAiModels([]);
      setAiStatus({ ok: false, text: err.message });
    }
  }

  async function handleCheckout() {
    setBusy(true);
    setStatus("Checking out repository…");
    try {
      await handleSave();
      await svnApi.checkoutRepository();
      setStatus("Checkout complete.");
      onSaved();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRelink() {
    setBusy(true);
    setStatus("Relinking working copy…");
    try {
      const saved = await svnApi.relinkWorkingCopy(workingCopyPath);
      setSettings(saved);
      setStatus("Working copy relinked.");
      onSaved();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Settings</h2>

        <div className="settings-section-title">SVN repository</div>
        <Field label="Repository URL">
          <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://svn.example.com/repo/trunk" />
        </Field>
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={settings?.hasPassword ? "•••••••• (unchanged)" : ""}
          />
        </Field>
        <Field label="Local working-copy folder">
          <input value={workingCopyPath} onChange={(e) => setWorkingCopyPath(e.target.value)} placeholder="C:\svn\my-project" />
        </Field>

        <div className="settings-section-title">Local AI (code review)</div>
        <Field label="Provider">
          <select
            value={presetValue}
            onChange={(e) => {
              if (e.target.value !== "custom") setAiEndpoint(e.target.value);
            }}
          >
            {AI_PRESETS.map((p) => (
              <option key={p.url} value={p.url}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom OpenAI-compatible endpoint</option>
          </select>
        </Field>
        <Field label="Endpoint URL">
          <input value={aiEndpoint} onChange={(e) => setAiEndpoint(e.target.value)} placeholder="http://127.0.0.1:8181/v1" />
        </Field>
        <Field label="Model — click Test connection to list the server's models (blank = first available)">
          <input value={aiModel} onChange={(e) => setAiModel(e.target.value)} list="ai-model-options" placeholder="e.g. Qwen3.5-9B-Q4_K_M" />
          <datalist id="ai-model-options">
            {aiModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="API key (optional)">
          <input
            type="password"
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            placeholder={settings?.hasAiApiKey ? "•••••••• (unchanged)" : "Only if your server requires one"}
          />
        </Field>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <button className="icon-btn" onClick={handleTestAi} disabled={!aiEndpoint}>
            Test connection
          </button>
          {aiStatus && (
            <span style={{ fontSize: 12, color: aiStatus.ok ? "var(--color-text-muted)" : "var(--color-danger)" }}>{aiStatus.text}</span>
          )}
        </div>

        {status && <div style={{ margin: "8px 0", fontSize: 13, color: "var(--color-text-muted)" }}>{status}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button className="primary-btn" onClick={handleSave} disabled={busy}>
            Save
          </button>
          <button className="icon-btn" onClick={handleCheckout} disabled={busy || !repoUrl || !workingCopyPath}>
            Checkout Repository
          </button>
          <button className="icon-btn" onClick={handleRelink} disabled={busy || !workingCopyPath}>
            Relink Working Copy
          </button>
          <button className="icon-btn" onClick={onClose} style={{ marginLeft: "auto" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>{label}</label>
      <div className="settings-input">{children}</div>
    </div>
  );
}
