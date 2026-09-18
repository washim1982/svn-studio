import type { SvnTreeNode } from "../types/svn";

export interface FlatEntry {
  path: string;
  name: string;
  isDirectory: boolean;
}

export function flattenTree(node: SvnTreeNode | null, out: FlatEntry[] = []): FlatEntry[] {
  if (!node) return out;
  if (node.path) out.push({ path: node.path, name: node.name, isDirectory: node.isDirectory });
  node.children?.forEach((child) => flattenTree(child, out));
  return out;
}
