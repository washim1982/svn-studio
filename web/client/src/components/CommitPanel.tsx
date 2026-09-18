import { useEffect, useMemo, useState } from "react";
import type { SvnTreeNode } from "../types/svn";
import { IconCheck, IconDownload, IconSend } from "./icons";
import { ChangesTree } from "./ChangesTree";
import { collectChangedPaths, pruneToChanges } from "../utils/changesTree";

interface CommitPanelProps {
  tree: SvnTreeNode | null;
  onCommit: (paths: string[], message: string) => void;
  onUpdate: () => void;
  onRevert: (paths: string[]) => void;
  busy: boolean;
}

export function CommitPanel({ tree, onCommit, onUpdate, onRevert, busy }: CommitPanelProps) {
  const changesTree = useMemo(() => (tree ? pruneToChanges(tree) : null), [tree]);
  const changedPaths = useMemo(() => (changesTree ? collectChangedPaths(changesTree) : []), [changesTree]);
  const [message, setMessage] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Default every change to selected so it's actually ready to commit as soon as it
  // shows up here, instead of silently doing nothing when Commit is clicked with
  // nothing ticked. Re-syncs whenever the underlying set of changed paths changes,
  // without clobbering an in-progress selection on every unrelated re-render.
  const changedPathsKey = changedPaths.slice().sort().join(" ");
  useEffect(() => {
    setChecked(new Set(changedPaths));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changedPathsKey]);

  function handleToggle(paths: string[], value: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      paths.forEach((p) => (value ? next.add(p) : next.delete(p)));
      return next;
    });
  }

  function toggleAll() {
    setChecked(checked.size === changedPaths.length ? new Set() : new Set(changedPaths));
  }

  const selectedPaths = Array.from(checked);
  const canCommit = !busy && message.trim().length > 0 && selectedPaths.length > 0;

  function handleCommit() {
    if (!canCommit) return;
    onCommit(selectedPaths, message);
    setMessage("");
    setChecked(new Set());
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="panel__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="svn-panel__status">
          <span className={`svn-panel__dot ${changedPaths.length > 0 ? "svn-panel__dot--dirty" : "svn-panel__dot--clean"}`} />
          {changedPaths.length > 0 ? `${changedPaths.length} change${changedPaths.length === 1 ? "" : "s"}` : "Clean"}
        </span>
        <button className="icon-btn" onClick={onUpdate} disabled={busy} title="svn update">
          <IconDownload size={13} /> Update
        </button>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {changedPaths.length === 0 && (
          <div style={{ padding: 14, color: "var(--color-text-muted)" }}>Working copy is clean.</div>
        )}
        {changedPaths.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px 0" }}>
            <button className="icon-btn" onClick={toggleAll} style={{ padding: "2px 6px" }}>
              {checked.size === changedPaths.length ? "Unselect all" : "Select all"}
            </button>
          </div>
        )}
        {changesTree && <ChangesTree root={changesTree} checked={checked} onToggle={handleToggle} />}
      </div>

      <div className="composer">
        <div className="composer__quick-actions">
          <button className="composer__pill" disabled={busy || selectedPaths.length === 0} onClick={handleCommit}>
            <IconCheck size={13} /> Commit
          </button>
          <span className="composer__dot">·</span>
          <button className="composer__pill" disabled={busy} onClick={onUpdate}>
            <IconDownload size={13} /> Update
          </button>
          <span className="composer__dot">·</span>
          <button className="composer__pill" disabled={busy || selectedPaths.length === 0} onClick={() => onRevert(selectedPaths)}>
            Revert
          </button>
        </div>
        <div className="composer__input-row">
          <textarea
            className="composer__textarea"
            placeholder="Describe this commit…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCommit();
            }}
          />
          <button className="composer__send" disabled={!canCommit} onClick={handleCommit} title="Commit (Ctrl+Enter)">
            <IconSend size={15} />
          </button>
        </div>
        <div className="composer__hint">
          {selectedPaths.length} of {changedPaths.length} item(s) selected · Ctrl+Enter to commit
        </div>
      </div>
    </div>
  );
}
