import {
  IconChevronLeft,
  IconChevronRight,
  IconMoon,
  IconPanelLeft,
  IconPanelRight,
  IconSearch,
  IconSettings,
  IconSun,
} from "./icons";
import "./TitleBar.css";

interface TitleBarProps {
  onOpenPalette: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  editable: boolean;
  onToggleEditable: (value: boolean) => void;
  error: string | null;
}

export function TitleBar({
  onOpenPalette,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  leftPanelVisible,
  rightPanelVisible,
  onToggleLeftPanel,
  onToggleRightPanel,
  theme,
  onToggleTheme,
  onOpenSettings,
  editable,
  onToggleEditable,
  error,
}: TitleBarProps) {
  return (
    <div className="title-bar">
      <div className="title-bar__left">
        <div className="title-bar__brand">
          <div className="title-bar__logo">S</div>
          <span>SVN STUDIO</span>
        </div>
        <button className="title-bar__nav-btn" disabled={!canGoBack} onClick={onBack} title="Back">
          <IconChevronLeft size={16} />
        </button>
        <button className="title-bar__nav-btn" disabled={!canGoForward} onClick={onForward} title="Forward">
          <IconChevronRight size={16} />
        </button>
      </div>

      <button className="title-bar__search" onClick={onOpenPalette}>
        <IconSearch size={14} />
        <span>Search files, symbols, or commands</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="title-bar__right">
        {error && <span className="title-bar__error" title={error}>⚠ {error}</span>}
        <label className="title-bar__toggle">
          <input type="checkbox" checked={editable} onChange={(e) => onToggleEditable(e.target.checked)} />
          Editable
        </label>
        <button className="title-bar__icon-btn" onClick={onToggleTheme} title="Toggle theme">
          {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
        <button
          className={`title-bar__icon-btn ${leftPanelVisible ? "title-bar__icon-btn--active" : ""}`}
          onClick={onToggleLeftPanel}
          title="Toggle explorer"
        >
          <IconPanelLeft size={16} />
        </button>
        <button
          className={`title-bar__icon-btn ${rightPanelVisible ? "title-bar__icon-btn--active" : ""}`}
          onClick={onToggleRightPanel}
          title="Toggle SVN panel"
        >
          <IconPanelRight size={16} />
        </button>
        <button className="title-bar__icon-btn" onClick={onOpenSettings} title="Settings">
          <IconSettings size={16} />
        </button>
      </div>
    </div>
  );
}
