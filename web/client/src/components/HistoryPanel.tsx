import type { SvnLogEntry } from "../types/svn";

interface HistoryPanelProps {
  entries: SvnLogEntry[];
  loading: boolean;
  scopedPath: string | null;
  onClose: () => void;
  onLockToggle: (path: string, lock: boolean) => void;
}

export function HistoryPanel({ entries, loading, scopedPath, onClose, onLockToggle }: HistoryPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="panel__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>History {scopedPath ? `— ${scopedPath}` : ""}</span>
        <button className="icon-btn" onClick={onClose}>
          ✕
        </button>
      </div>
      {scopedPath && (
        <div style={{ display: "flex", gap: 8, padding: 10 }}>
          <button className="icon-btn" onClick={() => onLockToggle(scopedPath, true)}>
            🔒 Lock
          </button>
          <button className="icon-btn" onClick={() => onLockToggle(scopedPath, false)}>
            🔓 Unlock
          </button>
        </div>
      )}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading && <div style={{ padding: 14, color: "var(--color-text-muted)" }}>Loading history…</div>}
        {!loading && entries.length === 0 && (
          <div style={{ padding: 14, color: "var(--color-text-muted)" }}>No revisions found.</div>
        )}
        {entries.map((entry) => (
          <div key={entry.revision} style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-muted)" }}>
              <span>r{entry.revision}</span>
              <span>{new Date(entry.date).toLocaleString()}</span>
            </div>
            <div style={{ fontWeight: 600, margin: "4px 0" }}>{entry.author}</div>
            <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{entry.message || "(no message)"}</div>
            {entry.paths.length > 0 && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--color-link)" }}>
                  {entry.paths.length} path(s) changed
                </summary>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {entry.paths.map((p, i) => (
                    <li key={i} style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
                      [{p.action}] {p.path}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
