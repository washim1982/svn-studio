import { useState } from "react";
import type { SvnTreeNode } from "../types/svn";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { IconFilePlus, IconFolderPlus, IconFolderUp, IconPencil, IconPlus, IconRefresh, IconTrash, IconUpload } from "./icons";
import { nameClass, STATUS_ICON, statusBadgeClass } from "../utils/statusStyle";
import "./FileTree.css";

export interface FileTreeActions {
  onSelectFile: (path: string) => void;
  onUpload: (targetFolder: string, files: FileList | File[]) => void;
  onUploadFolder: (targetFolder: string, files: FileList) => void;
  onCreateFile: (targetFolder: string) => void;
  onCreateFolder: (targetFolder: string) => void;
  onDelete: (path: string) => void;
  onRename: (path: string) => void;
  onCommitSelected: (path: string) => void;
  onRevert: (path: string) => void;
  onViewHistory: (path: string) => void;
}

interface FileTreeProps extends FileTreeActions {
  root: SvnTreeNode | null;
  selectedPath: string | null;
  repoName: string;
  onRefresh: () => void;
}

export function FileTree({ root, selectedPath, repoName, onRefresh, ...actions }: FileTreeProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  return (
    <div>
      <div className="explorer-header">
        <span className="explorer-header__label">EXPLORER</span>
        <div className="explorer-header__actions">
          <button className="explorer-icon-btn" title="New File" onClick={() => actions.onCreateFile("")}>
            <IconFilePlus size={14} />
          </button>
          <button className="explorer-icon-btn" title="New Folder" onClick={() => actions.onCreateFolder("")}>
            <IconFolderPlus size={14} />
          </button>
          <button className="explorer-icon-btn" title="Refresh" onClick={onRefresh}>
            <IconRefresh size={14} />
          </button>
        </div>
      </div>
      {repoName && <div className="explorer-project">{repoName}</div>}
      <div className="tree-toolbar">
        <button className="explorer-icon-btn" title="Upload file(s) to root" onClick={() => triggerUpload("", actions.onUpload)}>
          <IconUpload size={14} /> Upload
        </button>
        <button className="explorer-icon-btn" title="Upload folder to root" onClick={() => triggerFolderUpload("", actions.onUploadFolder)}>
          <IconFolderUp size={14} /> Folder
        </button>
      </div>
      {root ? (
        <TreeNode
          node={root}
          depth={0}
          selectedPath={selectedPath}
          onContextMenu={(x, y, items) => setMenu({ x, y, items })}
          {...actions}
        />
      ) : (
        <div style={{ padding: 16, color: "var(--color-text-muted)" }}>No working copy loaded.</div>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={menu.items} />}
    </div>
  );
}

function buildMenuItems(node: SvnTreeNode, actions: FileTreeActions): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  if (node.isDirectory) {
    items.push({ label: "Upload file(s) here", onClick: () => triggerUpload(node.path, actions.onUpload) });
    items.push({ label: "Upload folder here", onClick: () => triggerFolderUpload(node.path, actions.onUploadFolder) });
    items.push({ label: "New file", onClick: () => actions.onCreateFile(node.path) });
    items.push({ label: "New folder", onClick: () => actions.onCreateFolder(node.path) });
    items.push({ separator: true, label: "", onClick: () => {} });
  }
  items.push({ label: "Commit selected", onClick: () => actions.onCommitSelected(node.path) });
  items.push({ label: "Revert", onClick: () => actions.onRevert(node.path) });
  items.push({ label: "View history", onClick: () => actions.onViewHistory(node.path) });
  items.push({ separator: true, label: "", onClick: () => {} });
  items.push({ label: "Rename", onClick: () => actions.onRename(node.path) });
  items.push({ label: "Delete", danger: true, onClick: () => actions.onDelete(node.path) });
  return items;
}

function uploadMenuItems(node: SvnTreeNode, actions: FileTreeActions): ContextMenuItem[] {
  return [
    { label: "Upload file(s) here", onClick: () => triggerUpload(node.path, actions.onUpload) },
    { label: "Upload folder here", onClick: () => triggerFolderUpload(node.path, actions.onUploadFolder) },
  ];
}

function triggerUpload(targetFolder: string, onUpload: FileTreeActions["onUpload"]) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.onchange = () => {
    if (input.files && input.files.length > 0) onUpload(targetFolder, input.files);
  };
  input.click();
}

function triggerFolderUpload(targetFolder: string, onUploadFolder: FileTreeActions["onUploadFolder"]) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  // webkitdirectory has no typed JSX prop; every Chromium/Firefox browser honors it as an attribute.
  input.setAttribute("webkitdirectory", "");
  input.setAttribute("directory", "");
  input.onchange = () => {
    if (input.files && input.files.length > 0) onUploadFolder(targetFolder, input.files);
  };
  input.click();
}

interface TreeNodeProps extends FileTreeActions {
  node: SvnTreeNode;
  depth: number;
  selectedPath: string | null;
  onContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
}

function TreeNode({ node, depth, selectedPath, onContextMenu, ...actions }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [dragOver, setDragOver] = useState(false);
  const isSelected = selectedPath === node.path;

  function handleClick() {
    if (node.isDirectory) setExpanded((e) => !e);
    else actions.onSelectFile(node.path);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!node.isDirectory) return;
    if (e.dataTransfer.files.length > 0) actions.onUpload(node.path, e.dataTransfer.files);
  }

  return (
    <div className="tree-node">
      <div
        className={`tree-node__row ${isSelected ? "tree-node__row--selected" : ""} ${
          dragOver ? "tree-node__row--dragover" : ""
        }`}
        style={{ paddingLeft: 8 + depth * 4 }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e.clientX, e.clientY, buildMenuItems(node, actions));
        }}
        onDragOver={(e) => {
          if (!node.isDirectory) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {node.isDirectory ? <span className="tree-node__caret">{expanded ? "▾" : "▸"}</span> : <span className="tree-node__caret" />}
        <span className="tree-node__icon">{node.isDirectory ? "📁" : "📄"}</span>
        <span className={`tree-node__name ${nameClass(node.status)}`}>{node.name}</span>
        {node.locked && <span className="tree-node__lock" title="Locked">🔒</span>}
        {node.status !== "normal" && (
          <span className={statusBadgeClass(node.status)}>{STATUS_ICON[node.status] ?? node.status}</span>
        )}
        <span className="tree-node__row-actions">
          {node.isDirectory && (
            <button
              className="tree-node__row-action"
              title="Upload file(s) or folder here"
              onClick={(e) => {
                e.stopPropagation();
                onContextMenu(e.clientX, e.clientY, uploadMenuItems(node, actions));
              }}
            >
              <IconPlus size={12} />
            </button>
          )}
          <button
            className="tree-node__row-action"
            title="Rename"
            onClick={(e) => {
              e.stopPropagation();
              actions.onRename(node.path);
            }}
          >
            <IconPencil size={12} />
          </button>
          <button
            className="tree-node__row-action tree-node__row-action--danger"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              actions.onDelete(node.path);
            }}
          >
            <IconTrash size={12} />
          </button>
        </span>
      </div>
      {node.isDirectory && expanded && node.children && (
        <div className="tree-node__children">
          {node.children
            .slice()
            .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
            .map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onContextMenu={onContextMenu}
                {...actions}
              />
            ))}
        </div>
      )}
    </div>
  );
}
