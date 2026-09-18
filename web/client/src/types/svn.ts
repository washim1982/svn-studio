export type SvnItemStatus =
  | "normal"
  | "modified"
  | "added"
  | "deleted"
  | "unversioned"
  | "missing"
  | "replaced"
  | "conflicted"
  | "ignored"
  | "external"
  | "incomplete"
  | "merged"
  | "obstructed";

export interface SvnTreeNode {
  path: string;
  name: string;
  isDirectory: boolean;
  status: SvnItemStatus;
  locked: boolean;
  revision?: string;
  children?: SvnTreeNode[];
}

export interface SvnLogEntry {
  revision: string;
  author: string;
  date: string;
  message: string;
  paths: { path: string; action: string }[];
}

export interface SvnSettingsPublic {
  repoUrl: string;
  username: string;
  workingCopyPath: string;
  hasPassword: boolean;
  aiEndpoint: string;
  aiModel: string;
  hasAiApiKey: boolean;
}

export interface AiReviewResult {
  review: string;
  model: string;
  truncated: boolean;
  fileCount: number;
}

/** What the AI reviewer looks at. "" in folders means the whole working copy. */
export interface AiScope {
  files: string[];
  folders: string[];
  changes: string[];
}
