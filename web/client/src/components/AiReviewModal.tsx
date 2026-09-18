import { useEffect, useState } from "react";
import type { AiReviewResult } from "../types/svn";

export type AiReviewState =
  | { status: "loading"; scopeLabel: string; question: string }
  | { status: "done"; result: AiReviewResult; scopeLabel: string; question: string }
  | { status: "error"; error: string };

interface AiReviewModalProps {
  state: AiReviewState;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function AiReviewModal({ state, onClose, onOpenSettings }: AiReviewModalProps) {
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.status !== "loading") return;
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [state.status]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={state.status === "loading" ? undefined : onClose}>
      <div className="modal ai-review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-review-modal__header">
          <h2 style={{ margin: 0, fontSize: 18 }}>AI Review</h2>
          {state.status === "done" && (
            <span className="ai-review-modal__meta">
              {state.result.model} · {state.result.fileCount} file(s)
              {state.result.truncated ? " · context truncated to fit the model" : ""}
            </span>
          )}
        </div>

        {state.status !== "error" && (
          <div className="ai-review-modal__meta">
            Scope: {state.scopeLabel}
            {state.question.trim() ? ` · “${state.question.trim()}”` : " · general code review"}
          </div>
        )}

        {state.status === "loading" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--color-text-muted)", fontSize: 13 }}>
            <span className="ai-spinner" />
            Asking the local model… {elapsed}s
            <span style={{ fontSize: 12 }}>(CPU-only models can take a minute or more)</span>
          </div>
        )}

        {state.status === "error" && (
          <div className="ai-review-modal__body" style={{ color: "var(--color-danger)" }}>
            {state.error}
            {"\n\n"}
            <span style={{ color: "var(--color-text-muted)" }}>
              Make sure your local server is running (e.g. <code>llama-server -m model.gguf --port 8080</code>) and the endpoint in
              Settings is correct.
            </span>
          </div>
        )}

        {state.status === "done" && <div className="ai-review-modal__body">{renderReview(state.result.review)}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {state.status === "error" && (
            <button className="icon-btn" onClick={onOpenSettings}>
              Open Settings
            </button>
          )}
          {state.status === "done" && (
            <button className="icon-btn" onClick={() => copy(state.result.review)}>
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button className="primary-btn" onClick={onClose} disabled={state.status === "loading"}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Minimal rendering: fenced code blocks become <pre>, everything else stays as
// pre-wrapped text. Model output is only ever rendered as text nodes, never as HTML.
function renderReview(text: string): React.ReactNode[] {
  const parts = text.split(/```[a-zA-Z0-9_-]*\n?/);
  return parts.map((part, i) => (i % 2 === 1 ? <pre key={i}>{part.replace(/\n$/, "")}</pre> : <span key={i}>{part}</span>));
}
