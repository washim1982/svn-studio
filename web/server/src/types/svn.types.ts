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
  path: string; // path relative to working copy root, "/" separated
  name: string;
  isDirectory: boolean;
  status: SvnItemStatus;
  locked: boolean;
  revision?: string;
  children?: SvnTreeNode[];
}

export interface SvnStatusEntry {
  path: string;
  status: SvnItemStatus;
  locked: boolean;
  revision?: string;
  isDirectory: boolean;
}

export interface SvnLogEntry {
  revision: string;
  author: string;
  date: string;
  message: string;
  paths: { path: string; action: string }[];
}

export interface SvnSettings {
  repoUrl: string;
  username: string;
  password: string; // encrypted at rest, decrypted only in-process
  workingCopyPath: string;
  aiEndpoint: string; // OpenAI-compatible base URL, e.g. llama.cpp's http://localhost:8080/v1
  aiModel: string;
  aiApiKey: string; // encrypted at rest; optional (llama.cpp needs none by default)
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

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}
