import type { SvnTreeNode } from "../types/svn";

// Keeps a node only if it changed itself, or is an ancestor of something that did —
// so the commit panel can show real folder structure for context without listing
// every untouched file in the working copy.
export function pruneToChanges(node: SvnTreeNode): SvnTreeNode | null {
  const children = (node.children ?? [])
    .map(pruneToChanges)
    .filter((c): c is SvnTreeNode => c !== null);
  if (node.status !== "normal" || children.length > 0) {
    return { ...node, children };
  }
  return null;
}

// All paths (files and folders) within this subtree that are themselves changed —
// i.e. valid `svn commit`/`svn revert` targets, as opposed to unchanged ancestor
// folders kept around purely to show where a change lives.
export function collectChangedPaths(node: SvnTreeNode, out: string[] = []): string[] {
  if (node.status !== "normal" && node.path) out.push(node.path);
  node.children?.forEach((child) => collectChangedPaths(child, out));
  return out;
}
