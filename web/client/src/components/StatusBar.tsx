import { IconAlert, IconCheck, IconSourceControl } from "./icons";
import "./StatusBar.css";

interface StatusBarProps {
  configured: boolean;
  repoLabel: string;
  changedCount: number;
  conflictedCount: number;
  busy: boolean;
  theme: "dark" | "light";
  language: string;
}

export function StatusBar({ configured, repoLabel, changedCount, conflictedCount, busy, theme, language }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-bar__left">
        <span className="status-bar__item">
          <IconSourceControl size={13} />
          {configured ? repoLabel : "no working copy"}
        </span>
        {configured && (
          <>
            <span className="status-bar__item">
              <IconCheck size={13} />
              {changedCount}
            </span>
            <span className={`status-bar__item ${conflictedCount > 0 ? "status-bar__item--danger" : ""}`}>
              <IconAlert size={13} />
              {conflictedCount}
            </span>
          </>
        )}
      </div>
      <div className="status-bar__right">
        <span className="status-bar__item">{busy ? "Syncing…" : "Up to date"}</span>
        <span className="status-bar__item">{theme === "dark" ? "Dark" : "Light"}</span>
        <span className="status-bar__item">UTF-8</span>
        <span className="status-bar__item">LF</span>
        <span className="status-bar__item">{language}</span>
        <span className="status-bar__item">Web</span>
      </div>
    </div>
  );
}
