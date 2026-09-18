import { useEffect, useRef } from "react";
import type { SvnTreeNode } from "../types/svn";
import { collectChangedPaths } from "../utils/changesTree";
import { nameClass, statusBadgeClass, STATUS_ICON } from "../utils/statusStyle";
import "./FileTree.css";
import "./ChangesTree.css";

interface ChangesTreeProps {
  root: SvnTreeNode;
  checked: Set<string>;
  onToggle: (paths: string[], value: boolean) => void;
}

export function ChangesTree({ root, checked, onToggle }: ChangesTreeProps) {
  return (
    <div className="changes-tree">
      {(root.children ?? [])
        .slice()
        .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
        .map((child) => (
          <ChangeRow key={child.path} node={child} depth={0} checked={checked} onToggle={onToggle} />
        ))}
    </div>
  );
}

function ChangeRow({
  node,
  depth,
  checked,
  onToggle,
}: {
  node: SvnTreeNode;
  depth: number;
  checked: Set<string>;
  onToggle: (paths: string[], value: boolean) => void;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const changedInSubtree = collectChangedPaths(node);
  const allChecked = changedInSubtree.length > 0 && changedInSubtree.every((p) => checked.has(p));
  const someChecked = changedInSubtree.some((p) => checked.has(p));
  const isOwnChange = node.status !== "normal";

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  return (
    <div className="tree-node">
      <div className="tree-node__row" style={{ paddingLeft: 8 + depth * 14, cursor: "default" }}>
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={allChecked}
          disabled={changedInSubtree.length === 0}
          onChange={() => onToggle(changedInSubtree, !allChecked)}
          style={{ marginRight: 2 }}
        />
        <span className="tree-node__icon">{node.isDirectory ? "📁" : "📄"}</span>
        <span className={`tree-node__name ${isOwnChange ? nameClass(node.status) : ""}`}>{node.name}</span>
        {isOwnChange && (
          <span className={statusBadgeClass(node.status)}>{STATUS_ICON[node.status] ?? node.status}</span>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="tree-node__children">
          {node.children
            .slice()
            .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
            .map((child) => (
              <ChangeRow key={child.path} node={child} depth={depth + 1} checked={checked} onToggle={onToggle} />
            ))}
        </div>
      )}
    </div>
  );
}
