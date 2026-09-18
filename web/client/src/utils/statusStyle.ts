import type { SvnItemStatus } from "../types/svn";

export const STATUS_ICON: Record<string, string> = {
  modified: "●",
  added: "+",
  deleted: "−",
  conflicted: "⚠",
  unversioned: "?",
  missing: "!",
  replaced: "↻",
  normal: "",
};

export function statusBadgeClass(status: string): string {
  if (["modified", "added", "deleted", "conflicted", "unversioned"].includes(status)) {
    return `badge badge--${status}`;
  }
  return "";
}

// Newly added (or not-yet-added) items read as blue; committed/unmodified items stay
// the default text color; other statuses keep their own color.
export function nameClass(status: SvnItemStatus | string): string {
  switch (status) {
    case "added":
    case "unversioned":
      return "tree-node__name--added";
    case "modified":
      return "tree-node__name--modified";
    case "deleted":
    case "missing":
      return "tree-node__name--deleted";
    case "conflicted":
      return "tree-node__name--conflicted";
    default:
      return "";
  }
}
