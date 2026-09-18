import { useCallback, useState } from "react";

// Panel widths are a per-viewer layout preference, so localStorage is the right home.
// Storage can be unavailable (private mode, blocked site data) — fall back silently.
function readStored(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: number) {
  try {
    localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // ignore — the width still applies for this session
  }
}

export function usePanelWidth(storageKey: string, defaultWidth: number) {
  const [width, setWidthState] = useState(() => readStored(storageKey) ?? defaultWidth);

  const setWidth = useCallback(
    (next: number) => {
      setWidthState(next);
      writeStored(storageKey, next);
    },
    [storageKey]
  );

  const reset = useCallback(() => setWidth(defaultWidth), [setWidth, defaultWidth]);

  return [width, setWidth, reset] as const;
}
