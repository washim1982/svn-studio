import { useCallback, useEffect, useMemo, useState } from "react";
import { svnApi } from "./api/svnApi";
import { useTheme } from "./context/ThemeContext";
import { TitleBar } from "./components/TitleBar";
import { ActivityBar, type ActivityView } from "./components/ActivityBar";
import { CommandPalette, type PaletteCommand } from "./components/CommandPalette";
import { StatusBar } from "./components/StatusBar";
import { FileTree, type FileTreeActions } from "./components/FileTree";
import { FileViewer } from "./components/FileViewer";
import { CommitPanel } from "./components/CommitPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { Settings } from "./components/Settings";
import type { SvnLogEntry, SvnTreeNode } from "./types/svn";
import { flattenTree } from "./utils/treeUtils";
import { displayLanguageFromPath } from "./utils/language";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [tree, setTree] = useState<SvnTreeNode | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [diff, setDiff] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [editable, setEditable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeView, setActiveView] = useState<ActivityView>("explorer");
  const [historyEntries, setHistoryEntries] = useState<SvnLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyScope, setHistoryScope] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [repoName, setRepoName] = useState("");
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Simple back/forward navigation over visited files, like an editor's file history.
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [navIndex, setNavIndex] = useState(-1);

  const refreshTree = useCallback(async () => {
    try {
      const t = await svnApi.getTree();
      setTree(t);
      setConfigured(true);
      setError(null);
    } catch (err: any) {
      setConfigured(false);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refreshTree();
    svnApi.getSettings().then((s) => {
      const parts = s.workingCopyPath.split(/[/\\]/).filter(Boolean);
      setRepoName(parts[parts.length - 1] ?? "");
    });
  }, [refreshTree]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function loadFile(path: string) {
    setLoadingFile(true);
    setDiff(null);
    try {
      const [content, diffText] = await Promise.all([
        svnApi.getFile(path),
        svnApi.getDiff(path).catch(() => ""),
      ]);
      setDraftContent(content);
      setDiff(diffText || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingFile(false);
    }
  }

  function navigateToFile(path: string) {
    setSelectedPath(path);
    setNavHistory((prev) => {
      const truncated = prev.slice(0, navIndex + 1);
      truncated.push(path);
      setNavIndex(truncated.length - 1);
      return truncated;
    });
    loadFile(path);
  }

  function goBack() {
    if (navIndex <= 0) return;
    const newIndex = navIndex - 1;
    setNavIndex(newIndex);
    setSelectedPath(navHistory[newIndex]);
    loadFile(navHistory[newIndex]);
  }

  function goForward() {
    if (navIndex >= navHistory.length - 1) return;
    const newIndex = navIndex + 1;
    setNavIndex(newIndex);
    setSelectedPath(navHistory[newIndex]);
    loadFile(navHistory[newIndex]);
  }

  async function handleSaveFile() {
    if (!selectedPath) return;
    setBusy(true);
    try {
      await svnApi.saveFile(selectedPath, draftContent);
      await refreshTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refreshTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadHistory(path?: string) {
    setActiveView("history");
    setHistoryLoading(true);
    setHistoryScope(path ?? null);
    try {
      const entries = await svnApi.getHistory(path);
      setHistoryEntries(entries);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  const treeActions: FileTreeActions = {
    onSelectFile: navigateToFile,
    onUpload: (targetFolder, files) => withBusy(async () => {
      await svnApi.uploadFiles(targetFolder, files);
    }),
    onUploadFolder: (targetFolder, files) => withBusy(async () => {
      await svnApi.uploadFolder(targetFolder, files);
    }),
    onCreateFile: (targetFolder) => {
      const name = prompt("New file name:");
      if (!name) return;
      const fullPath = targetFolder ? `${targetFolder}/${name}` : name;
      withBusy(async () => {
        await svnApi.createFile(fullPath);
      });
    },
    onCreateFolder: (targetFolder) => {
      const name = prompt("New folder name:");
      if (!name) return;
      const fullPath = targetFolder ? `${targetFolder}/${name}` : name;
      withBusy(async () => {
        await svnApi.createFolder(fullPath);
      });
    },
    onDelete: (path) => {
      if (!confirm(`Delete "${path}"? This cannot be undone once committed.`)) return;
      withBusy(async () => {
        await svnApi.deletePath(path);
        if (selectedPath === path) setSelectedPath(null);
      });
    },
    onRename: (path) => {
      const parts = path.split("/");
      const currentName = parts.pop() ?? path;
      const newName = prompt("Rename to:", currentName);
      if (!newName || newName === currentName) return;
      const toPath = [...parts, newName].join("/");
      withBusy(async () => {
        await svnApi.renamePath(path, toPath);
      });
    },
    onCommitSelected: () => setActiveView("commit"),
    onRevert: (path) => withBusy(async () => {
      await svnApi.revert([path]);
    }),
    onViewHistory: (path) => loadHistory(path),
  };

  const changedCount = useMemo(() => {
    let count = 0;
    function walk(node: SvnTreeNode | null) {
      if (!node) return;
      if (node.status !== "normal") count++;
      node.children?.forEach(walk);
    }
    walk(tree);
    return count;
  }, [tree]);

  const conflictedCount = useMemo(() => {
    let count = 0;
    function walk(node: SvnTreeNode | null) {
      if (!node) return;
      if (node.status === "conflicted") count++;
      node.children?.forEach(walk);
    }
    walk(tree);
    return count;
  }, [tree]);

  const flatFiles = useMemo(() => flattenTree(tree), [tree]);

  const paletteCommands: PaletteCommand[] = [
    { id: "update", label: "SVN: Update working copy", run: () => withBusy(async () => { await svnApi.update(); }) },
    { id: "commit-view", label: "SVN: Show Commit panel", run: () => setActiveView("commit") },
    { id: "history-view", label: "SVN: Show History", run: () => loadHistory(undefined) },
    { id: "toggle-theme", label: "Preferences: Toggle Theme", run: toggleTheme },
    { id: "settings", label: "Preferences: Open Settings", run: () => setSettingsOpen(true) },
    { id: "refresh", label: "Explorer: Refresh Tree", run: () => refreshTree() },
  ];

  return (
    <div className="app-shell">
      <TitleBar
        onOpenPalette={() => setPaletteOpen(true)}
        canGoBack={navIndex > 0}
        canGoForward={navIndex < navHistory.length - 1}
        onBack={goBack}
        onForward={goForward}
        leftPanelVisible={leftPanelVisible}
        rightPanelVisible={rightPanelVisible}
        onToggleLeftPanel={() => setLeftPanelVisible((v) => !v)}
        onToggleRightPanel={() => setRightPanelVisible((v) => !v)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        editable={editable}
        onToggleEditable={setEditable}
        error={error}
      />

      <div className="workspace">
        <ActivityBar
          active={activeView}
          onSelect={(view) => (view === "history" ? loadHistory(historyScope ?? undefined) : setActiveView(view))}
          onOpenSettings={() => setSettingsOpen(true)}
          changedCount={changedCount}
        />

        {leftPanelVisible && (
          <div className="panel">
            {!configured ? (
              <div style={{ padding: 16, color: "var(--color-text-muted)" }}>
                SVN isn't configured yet. Open <button className="icon-btn" onClick={() => setSettingsOpen(true)}>Settings</button> to link a working copy.
              </div>
            ) : (
              <FileTree root={tree} selectedPath={selectedPath} repoName={repoName} onRefresh={refreshTree} {...treeActions} />
            )}
          </div>
        )}

        <div className="center-panel">
          <FileViewer
            path={selectedPath}
            content={draftContent}
            diff={diff}
            editable={editable}
            loading={loadingFile}
            onContentChange={setDraftContent}
            onSave={handleSaveFile}
          />
        </div>

        {rightPanelVisible && (
          <div className="panel panel--right">
            {activeView === "history" ? (
              <HistoryPanel
                entries={historyEntries}
                loading={historyLoading}
                scopedPath={historyScope}
                onClose={() => setActiveView("commit")}
                onLockToggle={(path, lock) => withBusy(async () => {
                  if (lock) await svnApi.lock(path);
                  else await svnApi.unlock(path);
                })}
              />
            ) : (
              <CommitPanel
                tree={tree}
                busy={busy}
                onCommit={(paths, message) => withBusy(async () => {
                  await svnApi.commit(paths, message);
                })}
                onUpdate={() => withBusy(async () => {
                  await svnApi.update();
                })}
                onRevert={(paths) => withBusy(async () => {
                  await svnApi.revert(paths);
                })}
              />
            )}
          </div>
        )}
      </div>

      <StatusBar
        configured={configured}
        repoLabel={repoName || "working copy"}
        changedCount={changedCount}
        conflictedCount={conflictedCount}
        busy={busy}
        theme={theme}
        language={displayLanguageFromPath(selectedPath)}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        files={flatFiles}
        commands={paletteCommands}
        onSelectFile={navigateToFile}
      />

      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            refreshTree();
            svnApi.getSettings().then((s) => {
              const parts = s.workingCopyPath.split(/[/\\]/).filter(Boolean);
              setRepoName(parts[parts.length - 1] ?? "");
            });
          }}
        />
      )}
    </div>
  );
}
