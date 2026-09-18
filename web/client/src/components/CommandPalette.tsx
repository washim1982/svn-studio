import { useEffect, useMemo, useRef, useState } from "react";
import type { FlatEntry } from "../utils/treeUtils";
import { IconSearch } from "./icons";
import "./CommandPalette.css";

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  files: FlatEntry[];
  commands: PaletteCommand[];
  onSelectFile: (path: string) => void;
}

type ResultItem =
  | { kind: "file"; path: string; name: string }
  | { kind: "command"; id: string; label: string; hint?: string; run: () => void };

export function CommandPalette({ open, onClose, files, commands, onSelectFile }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    const fileResults: ResultItem[] = files
      .filter((f) => !f.isDirectory && (q === "" || f.path.toLowerCase().includes(q)))
      .slice(0, 30)
      .map((f) => ({ kind: "file", path: f.path, name: f.name }));
    const commandResults: ResultItem[] = commands
      .filter((c) => q === "" || c.label.toLowerCase().includes(q))
      .map((c) => ({ kind: "command", id: c.id, label: c.label, hint: c.hint, run: c.run }));
    return q === "" ? [...commandResults, ...fileResults] : [...commandResults, ...fileResults];
  }, [query, files, commands]);

  useEffect(() => setActiveIndex(0), [results.length]);

  function activate(item: ResultItem) {
    if (item.kind === "file") onSelectFile(item.path);
    else item.run();
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      activate(results[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette__input-row">
          <IconSearch size={16} />
          <input
            ref={inputRef}
            className="palette__input"
            placeholder="Search files, symbols, or commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="palette__kbd">Esc</kbd>
        </div>
        <div className="palette__results">
          {results.length === 0 && <div className="palette__empty">No matches.</div>}
          {results.map((item, i) => (
            <button
              key={item.kind === "file" ? `f:${item.path}` : `c:${item.id}`}
              className={`palette__item ${i === activeIndex ? "palette__item--active" : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => activate(item)}
            >
              {item.kind === "file" ? (
                <>
                  <span className="palette__item-icon">📄</span>
                  <span className="palette__item-label">{item.name}</span>
                  <span className="palette__item-hint">{item.path}</span>
                </>
              ) : (
                <>
                  <span className="palette__item-icon">›</span>
                  <span className="palette__item-label">{item.label}</span>
                  {item.hint && <span className="palette__item-hint">{item.hint}</span>}
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
