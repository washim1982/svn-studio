import { IconFiles, IconHistory, IconSettings, IconSourceControl } from "./icons";
import "./ActivityBar.css";

export type ActivityView = "explorer" | "commit" | "history";

interface ActivityBarProps {
  active: ActivityView;
  onSelect: (view: ActivityView) => void;
  onOpenSettings: () => void;
  changedCount: number;
}

export function ActivityBar({ active, onSelect, onOpenSettings, changedCount }: ActivityBarProps) {
  return (
    <div className="activity-bar">
      <div className="activity-bar__items">
        <ActivityItem
          icon={<IconFiles size={20} />}
          active={active === "explorer"}
          title="Explorer"
          onClick={() => onSelect("explorer")}
        />
        <ActivityItem
          icon={<IconSourceControl size={20} />}
          active={active === "commit"}
          title="Source Control"
          badge={changedCount > 0 ? changedCount : undefined}
          onClick={() => onSelect("commit")}
        />
        <ActivityItem
          icon={<IconHistory size={20} />}
          active={active === "history"}
          title="History"
          onClick={() => onSelect("history")}
        />
      </div>
      <div className="activity-bar__footer">
        <ActivityItem icon={<IconSettings size={20} />} active={false} title="Settings" onClick={onOpenSettings} />
      </div>
    </div>
  );
}

function ActivityItem({
  icon,
  active,
  title,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  active: boolean;
  title: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button className={`activity-item ${active ? "activity-item--active" : ""}`} title={title} onClick={onClick}>
      {active && <span className="activity-item__indicator" />}
      {icon}
      {badge !== undefined && <span className="activity-item__badge">{badge}</span>}
    </button>
  );
}
