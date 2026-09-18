import { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "../context/ThemeContext";
import { monacoLanguageFromPath } from "../utils/language";
import { IconCode } from "./icons";

interface FileViewerProps {
  path: string | null;
  content: string;
  diff: string | null;
  editable: boolean;
  loading: boolean;
  onContentChange?: (value: string) => void;
  onSave?: () => void;
}

export function FileViewer({ path, content, diff, editable, loading, onContentChange, onSave }: FileViewerProps) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<"source" | "diff">("source");
  const language = useMemo(() => monacoLanguageFromPath(path), [path]);
  const monacoTheme = theme === "dark" ? "vs-dark" : "light";

  if (!path) {
    return (
      <div className="editor-empty-state">
        <div className="editor-empty-state__icon">
          <IconCode size={28} />
        </div>
        <div className="editor-empty-state__title">Your working copy, under control</div>
        <div className="editor-empty-state__subtitle">
          Select a file from Explorer, or run Update / Commit from the SVN panel to get started.
        </div>
      </div>
    );
  }

  const segments = path.split("/");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="editor-header">
        <div className="editor-breadcrumb">
          {segments.map((segment, i) => (
            <span key={i} className="editor-breadcrumb__segment">
              {i > 0 && <span className="editor-breadcrumb__sep">/</span>}
              {segment}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`icon-btn ${mode === "source" ? "tree-node__row--selected" : ""}`} onClick={() => setMode("source")}>
            Source
          </button>
          <button
            className={`icon-btn ${mode === "diff" ? "tree-node__row--selected" : ""}`}
            onClick={() => setMode("diff")}
            disabled={!diff}
          >
            Diff
          </button>
          {editable && (
            <button className="primary-btn" onClick={onSave}>
              Save
            </button>
          )}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 20, color: "var(--color-text-muted)" }}>Loading…</div>
        ) : mode === "diff" && diff ? (
          // Rendered as a unified-diff text listing (svn diff output) rather than a
          // side-by-side DiffEditor, since svn only gives us the patch text, not
          // separate "before"/"after" documents to feed a real diff view.
          <Editor
            height="100%"
            language="plaintext"
            theme={monacoTheme}
            value={diff}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, fontFamily: "var(--font-mono)" }}
          />
        ) : (
          <Editor
            height="100%"
            language={language}
            theme={monacoTheme}
            value={content}
            onChange={(value) => onContentChange?.(value ?? "")}
            options={{
              readOnly: !editable,
              minimap: { enabled: true },
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
}
