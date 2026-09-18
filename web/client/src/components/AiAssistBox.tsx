import { useEffect, useMemo, useRef, useState } from "react";
import { svnApi } from "../api/svnApi";
import type { AiScope } from "../types/svn";
import { IconPlus, IconSend } from "./icons";
import "./AiAssistBox.css";

type ScopeItem = { kind: "file" | "folder" | "changes"; path: string };

interface AiAssistBoxProps {
  openFilePath: string | null;
  checkedChanges: string[];
  folders: string[];
  busy: boolean;
  onSubmit: (scope: AiScope, question: string, model: string, scopeLabel: string) => void;
}

const baseName = (p: string) => p.split("/").pop() || p;
const parentOf = (p: string) => p.split("/").slice(0, -1).join("/");
const folderLabel = (p: string) => (p === "" ? "Whole working copy" : baseName(p));

export function AiAssistBox({ openFilePath, checkedChanges, folders, busy, onSubmit }: AiAssistBoxProps) {
  const [question, setQuestion] = useState("");
  const [manual, setManual] = useState<ScopeItem[]>([]);
  // The open file is in scope by default; this remembers if the user removed it for
  // *that* file, so opening a different file brings the default back.
  const [autoRemovedFor, setAutoRemovedFor] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folderFilter, setFolderFilter] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    Promise.all([svnApi.aiModels().catch(() => ({ models: [] as string[] })), svnApi.getSettings().catch(() => null)]).then(
      ([{ models: list }, settings]) => {
        setModels(list);
        // Saved names may lack the gateway's hash suffix, so match on prefix too.
        const saved = (settings?.aiModel ?? "").toLowerCase();
        setModel(saved ? list.find((m) => m.toLowerCase() === saved) ?? list.find((m) => m.toLowerCase().startsWith(saved)) ?? "" : "");
      }
    );
  }, []);

  useEffect(() => {
    if (!menuOpen && !pickerOpen) return;
    function onDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen, pickerOpen]);

  const autoFile = openFilePath && autoRemovedFor !== openFilePath ? openFilePath : null;
  const items: (ScopeItem & { auto?: boolean })[] = useMemo(() => {
    const list: (ScopeItem & { auto?: boolean })[] = [];
    if (autoFile && !manual.some((m) => m.kind === "file" && m.path === autoFile)) {
      list.push({ kind: "file", path: autoFile, auto: true });
    }
    return [...list, ...manual];
  }, [autoFile, manual]);

  const has = (kind: ScopeItem["kind"], p: string) => items.some((i) => i.kind === kind && i.path === p);

  function addItem(item: ScopeItem) {
    if (!has(item.kind, item.path)) setManual((m) => [...m, item]);
    if (item.kind === "file" && item.path === openFilePath) setAutoRemovedFor(null);
    setMenuOpen(false);
    setPickerOpen(false);
    textareaRef.current?.focus();
  }

  function removeItem(item: ScopeItem & { auto?: boolean }) {
    if (item.auto) setAutoRemovedFor(item.path);
    else setManual((m) => m.filter((x) => !(x.kind === item.kind && x.path === item.path)));
    if (item.kind === "file" && item.path === openFilePath) setAutoRemovedFor(item.path);
  }

  const scope: AiScope = {
    files: items.filter((i) => i.kind === "file").map((i) => i.path),
    folders: items.filter((i) => i.kind === "folder").map((i) => i.path),
    changes: items.some((i) => i.kind === "changes") ? checkedChanges : [],
  };
  const scopeEmpty = scope.files.length + scope.folders.length + scope.changes.length === 0;
  const canSend = !busy && !scopeEmpty;

  function submit() {
    if (!canSend) return;
    const label = items.map((i) => (i.kind === "changes" ? `${checkedChanges.length} change(s)` : i.kind === "folder" ? folderLabel(i.path) : baseName(i.path))).join(", ");
    onSubmit(scope, question, model, label);
  }

  const filteredFolders = useMemo(() => {
    const q = folderFilter.trim().toLowerCase();
    return ["", ...folders].filter((f) => !q || f.toLowerCase().includes(q)).slice(0, 60);
  }, [folders, folderFilter]);

  return (
    <div className="ai-box">
      <div className="ai-box__chips">
        {items.length === 0 && <span className="ai-box__hint">No scope — open a file or use + to add a folder</span>}
        {items.map((item) => (
          <span key={`${item.kind}:${item.path}`} className={`ai-chip ai-chip--${item.kind}`} title={item.kind === "changes" ? checkedChanges.join("\n") : item.path || "Whole working copy"}>
            <span className="ai-chip__icon">{item.kind === "file" ? "📄" : item.kind === "folder" ? "📁" : "±"}</span>
            <span className="ai-chip__label">
              {item.kind === "changes" ? `Changes (${checkedChanges.length})` : item.kind === "folder" ? folderLabel(item.path) : baseName(item.path)}
            </span>
            {item.auto && <span className="ai-chip__tag">open</span>}
            <button className="ai-chip__remove" onClick={() => removeItem(item)} title="Remove from scope">
              ×
            </button>
          </span>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        className="ai-box__input"
        placeholder="Ask anything, or leave blank for a code review…"
        value={question}
        rows={2}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />

      <div className="ai-box__footer">
        <div className="ai-box__left" ref={popoverRef}>
          <button className="ai-box__plus" onClick={() => { setMenuOpen((o) => !o); setPickerOpen(false); }} title="Add to review scope">
            <IconPlus size={14} />
          </button>

          {menuOpen && (
            <div className="ai-popover">
              <button className="ai-popover__item" disabled={!openFilePath || has("file", openFilePath)} onClick={() => openFilePath && addItem({ kind: "file", path: openFilePath })}>
                📄 Open file{openFilePath ? `: ${baseName(openFilePath)}` : " (none open)"}
              </button>
              {openFilePath && parentOf(openFilePath) !== "" && (
                <button className="ai-popover__item" disabled={has("folder", parentOf(openFilePath))} onClick={() => addItem({ kind: "folder", path: parentOf(openFilePath) })}>
                  📁 Folder of open file: {baseName(parentOf(openFilePath))}
                </button>
              )}
              <button className="ai-popover__item" onClick={() => { setMenuOpen(false); setPickerOpen(true); setFolderFilter(""); }}>
                📁 Working folder…
              </button>
              <button className="ai-popover__item" disabled={checkedChanges.length === 0 || has("changes", "")} onClick={() => addItem({ kind: "changes", path: "" })}>
                ± Checked changes ({checkedChanges.length})
              </button>
            </div>
          )}

          {pickerOpen && (
            <div className="ai-popover ai-popover--picker">
              <input
                autoFocus
                className="ai-popover__filter"
                placeholder="Filter folders…"
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setPickerOpen(false);
                  if (e.key === "Enter" && filteredFolders.length > 0) addItem({ kind: "folder", path: filteredFolders[0] });
                }}
              />
              <div className="ai-popover__list">
                {filteredFolders.map((f) => (
                  <button key={f || "(root)"} className="ai-popover__item" disabled={has("folder", f)} onClick={() => addItem({ kind: "folder", path: f })} title={f || "Whole working copy"}>
                    📁 {f === "" ? "Whole working copy" : f}
                  </button>
                ))}
                {filteredFolders.length === 0 && <div className="ai-popover__empty">No matching folders</div>}
              </div>
            </div>
          )}

          <select className="ai-box__model" value={model} onChange={(e) => setModel(e.target.value)} title="Model for this review">
            <option value="">{models.length ? "Auto model" : "Default model"}</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <button className="ai-box__send" disabled={!canSend} onClick={submit} title="Run AI review (Enter)">
          {busy ? <span className="ai-spinner" /> : <IconSend size={14} />}
        </button>
      </div>
    </div>
  );
}
