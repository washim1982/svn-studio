import { useEffect, useRef } from "react";
import "./FileTree.css";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  separator?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("contextmenu", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("contextmenu", handleClick);
    };
  }, [onClose]);

  return (
    <div className="context-menu" style={{ left: x, top: y }} ref={ref}>
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="context-menu__separator" />
        ) : (
          <button
            key={i}
            className="context-menu__item"
            style={item.danger ? { color: "var(--color-danger)" } : undefined}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
