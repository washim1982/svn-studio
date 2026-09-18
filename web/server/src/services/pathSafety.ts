import path from "node:path";

/**
 * Resolves a client-supplied relative path against the working copy root and
 * throws if it would escape that root (blocks "../" traversal).
 */
export function assertSafeRelativePath(workingCopyPath: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const resolvedRoot = path.resolve(workingCopyPath);
  const resolvedTarget = path.resolve(resolvedRoot, normalized);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error("Path escapes the working copy root");
  }
  return normalized;
}
