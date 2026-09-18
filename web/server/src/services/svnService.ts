import { execFile } from "node:child_process";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type {
  CommandResult,
  SvnLogEntry,
  SvnSettings,
  SvnStatusEntry,
  SvnTreeNode,
} from "../types/svn.types.js";

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/**
 * Runs an `svn` CLI command with argv passed as an array (never through a shell),
 * which rules out shell-injection regardless of what the caller puts in paths/messages.
 */
function runSvn(args: string[], cwd?: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      "svn",
      args,
      { cwd, maxBuffer: 1024 * 1024 * 64 },
      (error, stdout, stderr) => {
        const code = (error as any)?.code ?? 0;
        if (error && typeof code !== "number") {
          reject(error);
          return;
        }
        resolve({ stdout, stderr, code: typeof code === "number" ? code : 0 });
      }
    );
  });
}

function authArgs(settings: SvnSettings): string[] {
  const args = ["--non-interactive", "--trust-server-cert"];
  if (settings.username) args.push("--username", settings.username);
  // NOTE: passing --password on argv is visible to other local processes (e.g. `ps`).
  // For production hardening, prefer a pre-seeded svn auth cache or a credential helper
  // instead of passing the password on every invocation.
  if (settings.password) args.push("--password", settings.password);
  return args;
}

function assertOk(result: CommandResult, action: string): void {
  if (result.code !== 0) {
    throw new Error(`svn ${action} failed: ${result.stderr || result.stdout}`);
  }
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

// ---- status --------------------------------------------------------------

// `svn status --xml` reports the wc-status `item` attribute as a full word
// ("added", "modified", ...), not the single-letter codes `svn status` prints in its
// plain-text porcelain output — those are a different format and don't apply here.
const VALID_ITEM_STATUSES = new Set<SvnStatusEntry["status"]>([
  "normal", "modified", "added", "deleted", "unversioned", "missing",
  "replaced", "conflicted", "ignored", "external", "incomplete", "merged", "obstructed",
]);

function parseItemStatus(item: string | undefined): SvnStatusEntry["status"] {
  if (item && (VALID_ITEM_STATUSES as Set<string>).has(item)) return item as SvnStatusEntry["status"];
  return "normal";
}

export async function getStatus(settings: SvnSettings): Promise<SvnStatusEntry[]> {
  const result = await runSvn(["status", "--xml", ...authArgs(settings)], settings.workingCopyPath);
  assertOk(result, "status");
  const parsed = xmlParser.parse(result.stdout);
  const entries = parsed?.status?.target?.entry;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
  return list.map((entry: any) => {
    const wcStatus = entry["wc-status"];
    return {
      path: toPosix(entry["@_path"]),
      status: parseItemStatus(wcStatus?.["@_item"]),
      locked: Boolean(wcStatus?.["@_locked"] === "true" || wcStatus?.lock),
      revision: wcStatus?.["@_revision"],
      isDirectory: wcStatus?.["@_kind"] === "dir",
    };
  });
}

// ---- tree (svn list -R merged with status) --------------------------------

export async function getTree(settings: SvnSettings): Promise<SvnTreeNode> {
  const listResult = await runSvn(["list", "-R", "--xml", ...authArgs(settings)], settings.workingCopyPath);
  assertOk(listResult, "list");
  const parsed = xmlParser.parse(listResult.stdout);
  const entries = parsed?.lists?.list?.entry;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];

  const statusEntries = await getStatus(settings).catch(() => [] as SvnStatusEntry[]);
  const statusMap = new Map(statusEntries.map((e) => [e.path, e]));

  const root: SvnTreeNode = { path: "", name: "/", isDirectory: true, status: "normal", locked: false, children: [] };
  const dirIndex = new Map<string, SvnTreeNode>([["", root]]);

  function ensureDir(dirPath: string): SvnTreeNode {
    if (dirIndex.has(dirPath)) return dirIndex.get(dirPath)!;
    const parentPath = dirPath.split("/").slice(0, -1).join("/");
    const parent = ensureDir(parentPath);
    const name = dirPath.split("/").pop()!;
    const node: SvnTreeNode = { path: dirPath, name, isDirectory: true, status: "normal", locked: false, children: [] };
    parent.children!.push(node);
    dirIndex.set(dirPath, node);
    return node;
  }

  for (const entry of list) {
    const entryPath: string = toPosix(entry["@_path"] ?? entry.name);
    const kind: string = entry["@_kind"];
    const isDirectory = kind === "dir";
    const parentPath = entryPath.split("/").slice(0, -1).join("/");
    const parent = ensureDir(parentPath);
    const name = entryPath.split("/").pop()!;
    const statusEntry = statusMap.get(entryPath);
    const node: SvnTreeNode = {
      path: entryPath,
      name,
      isDirectory,
      status: statusEntry?.status ?? "normal",
      locked: statusEntry?.locked ?? false,
      revision: entry.commit?.["@_revision"],
      children: isDirectory ? [] : undefined,
    };
    if (isDirectory) dirIndex.set(entryPath, node);
    parent.children!.push(node);
  }

  // Fold in unversioned/added/missing paths that `svn list` doesn't report (it queries
  // the *repository*, so brand-new local adds never show up in it) so new/modified/
  // deleted files and folders still show in the tree.
  //
  // Directories go through ensureDir(), which is idempotent and keyed by path: whether
  // a new folder's own status entry is processed before or after a file inside it, the
  // folder ends up as a single node with the correct status (previously, a hardcoded
  // `isDirectory: false` here meant new folders got pushed as fake leaf files, and if a
  // child file's status was processed first, ensureDir() would then create a *second*,
  // wrongly-"normal" directory node for the same path).
  for (const status of statusEntries) {
    if (status.isDirectory) {
      const dirNode = ensureDir(status.path);
      dirNode.status = status.status;
      dirNode.locked = status.locked;
      continue;
    }
    const alreadyPresent = list.some((e: any) => toPosix(e["@_path"] ?? e.name) === status.path);
    if (alreadyPresent) continue;
    const parentPath = status.path.split("/").slice(0, -1).join("/");
    const parent = ensureDir(parentPath);
    if (parent.children!.some((c) => c.path === status.path)) continue;
    parent.children!.push({
      path: status.path,
      name: status.path.split("/").pop()!,
      isDirectory: false,
      status: status.status,
      locked: status.locked,
    });
  }

  return root;
}

// ---- file content ----------------------------------------------------------

export async function getFileContent(settings: SvnSettings, relativePath: string): Promise<string> {
  const absPath = path.join(settings.workingCopyPath, relativePath);
  const result = await runSvn(["cat", absPath, ...authArgs(settings)], settings.workingCopyPath).catch(async () => {
    // Fall back to reading the working-copy file directly (covers unversioned/added files
    // that `svn cat` cannot serve since they have no repository revision yet).
    const { promises: fs } = await import("node:fs");
    const content = await fs.readFile(absPath, "utf8");
    return { stdout: content, stderr: "", code: 0 };
  });
  return result.stdout;
}

export async function writeFileContent(settings: SvnSettings, relativePath: string, content: string): Promise<void> {
  const absPath = path.join(settings.workingCopyPath, relativePath);
  const { promises: fs } = await import("node:fs");
  await fs.writeFile(absPath, content, "utf8");
}

// ---- mutations ---------------------------------------------------------------

export async function addPath(settings: SvnSettings, relativePath: string): Promise<void> {
  const absPath = path.join(settings.workingCopyPath, relativePath);
  const result = await runSvn(["add", "--parents", absPath], settings.workingCopyPath);
  assertOk(result, "add");
}

export async function createFile(settings: SvnSettings, relativePath: string): Promise<void> {
  const absPath = path.join(settings.workingCopyPath, relativePath);
  const { promises: fs } = await import("node:fs");
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, "", { flag: "wx" });
  await addPath(settings, relativePath);
}

export async function deletePath(settings: SvnSettings, relativePath: string, force = true): Promise<void> {
  const absPath = path.join(settings.workingCopyPath, relativePath);
  const args = ["delete", "--force", absPath];
  const result = await runSvn(args, settings.workingCopyPath);
  assertOk(result, "delete");
}

export async function renamePath(settings: SvnSettings, fromPath: string, toPath: string): Promise<void> {
  const absFrom = path.join(settings.workingCopyPath, fromPath);
  const absTo = path.join(settings.workingCopyPath, toPath);
  const result = await runSvn(["move", "--parents", absFrom, absTo], settings.workingCopyPath);
  assertOk(result, "move");
}

export async function createFolder(settings: SvnSettings, relativePath: string): Promise<void> {
  const absPath = path.join(settings.workingCopyPath, relativePath);
  const result = await runSvn(["mkdir", "--parents", absPath], settings.workingCopyPath);
  assertOk(result, "mkdir");
}

export async function commit(settings: SvnSettings, paths: string[], message: string): Promise<CommandResult> {
  const absPaths = paths.map((p) => path.join(settings.workingCopyPath, p));
  const result = await runSvn(
    ["commit", "-m", message, ...absPaths, ...authArgs(settings)],
    settings.workingCopyPath
  );
  assertOk(result, "commit");
  return result;
}

export async function update(settings: SvnSettings): Promise<CommandResult> {
  const result = await runSvn(["update", "--accept", "postpone", ...authArgs(settings)], settings.workingCopyPath);
  assertOk(result, "update");
  return result;
}

export async function revert(settings: SvnSettings, paths: string[]): Promise<CommandResult> {
  const absPaths = paths.length
    ? paths.map((p) => path.join(settings.workingCopyPath, p))
    : [settings.workingCopyPath];
  const args = paths.length ? ["revert", ...absPaths] : ["revert", "-R", settings.workingCopyPath];
  const result = await runSvn(args, settings.workingCopyPath);
  assertOk(result, "revert");
  return result;
}

export async function getLog(settings: SvnSettings, relativePath?: string, limit = 100): Promise<SvnLogEntry[]> {
  const target = relativePath ? path.join(settings.workingCopyPath, relativePath) : settings.workingCopyPath;
  const result = await runSvn(
    ["log", "--xml", "-v", "-l", String(limit), target, ...authArgs(settings)],
    settings.workingCopyPath
  );
  assertOk(result, "log");
  const parsed = xmlParser.parse(result.stdout);
  const entries = parsed?.log?.logentry;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
  return list.map((entry: any) => {
    const paths = entry.paths?.path;
    const pathList = Array.isArray(paths) ? paths : paths ? [paths] : [];
    return {
      revision: entry["@_revision"],
      author: entry.author ?? "(unknown)",
      date: entry.date,
      message: entry.msg ?? "",
      paths: pathList.map((p: any) => ({ path: p["#text"] ?? p, action: p["@_action"] })),
    };
  });
}

export async function getDiff(settings: SvnSettings, relativePath: string): Promise<string> {
  const absPath = path.join(settings.workingCopyPath, relativePath);
  const result = await runSvn(["diff", absPath, ...authArgs(settings)], settings.workingCopyPath);
  return result.stdout;
}

export async function lockPath(settings: SvnSettings, relativePath: string, message?: string): Promise<void> {
  const absPath = path.join(settings.workingCopyPath, relativePath);
  const args = ["lock", absPath, ...authArgs(settings)];
  if (message) args.push("-m", message);
  const result = await runSvn(args, settings.workingCopyPath);
  assertOk(result, "lock");
}

export async function unlockPath(settings: SvnSettings, relativePath: string): Promise<void> {
  const absPath = path.join(settings.workingCopyPath, relativePath);
  const result = await runSvn(["unlock", absPath, ...authArgs(settings)], settings.workingCopyPath);
  assertOk(result, "unlock");
}

export async function checkout(settings: SvnSettings): Promise<CommandResult> {
  const result = await runSvn(
    ["checkout", settings.repoUrl, settings.workingCopyPath, ...authArgs(settings)],
    undefined
  );
  assertOk(result, "checkout");
  return result;
}

export async function isWorkingCopy(workingCopyPath: string): Promise<boolean> {
  const result = await runSvn(["info", workingCopyPath], undefined).catch(() => ({ code: 1 } as CommandResult));
  return result.code === 0;
}
