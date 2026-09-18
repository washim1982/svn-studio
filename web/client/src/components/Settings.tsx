import { useEffect, useState } from "react";
import { svnApi } from "../api/svnApi";
import type { SvnSettingsPublic } from "../types/svn";

interface SettingsProps {
  onClose: () => void;
  onSaved: () => void;
}

export function Settings({ onClose, onSaved }: SettingsProps) {
  const [settings, setSettings] = useState<SvnSettingsPublic | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [workingCopyPath, setWorkingCopyPath] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    svnApi.getSettings().then((s) => {
      setSettings(s);
      setRepoUrl(s.repoUrl);
      setUsername(s.username);
      setWorkingCopyPath(s.workingCopyPath);
    });
  }, []);

  async function handleSave() {
    setBusy(true);
    setStatus(null);
    try {
      const saved = await svnApi.saveSettings({ repoUrl, username, password: password || undefined, workingCopyPath });
      setSettings(saved);
      setStatus("Settings saved.");
      onSaved();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-panel)",
          padding: 24,
        }}
      >
        <h2 style={{ marginTop: 0 }}>SVN Settings</h2>

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

        {status && <div style={{ margin: "8px 0", fontSize: 13, color: "var(--color-text-muted)" }}>{status}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
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
      <StyledInputWrapper>{children}</StyledInputWrapper>
    </div>
  );
}

function StyledInputWrapper({ children }: { children: React.ReactNode }) {
  return <div className="settings-input">{children}</div>;
}
