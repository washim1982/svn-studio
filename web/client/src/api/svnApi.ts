import type { SvnLogEntry, SvnSettingsPublic, SvnTreeNode } from "../types/svn";

const BASE = "/api";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  return (contentType.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

export const svnApi = {
  getTree: () => request<SvnTreeNode>("/svn/tree"),
  getFile: (path: string) => request<string>(`/svn/file?path=${encodeURIComponent(path)}`),
  getDiff: (path: string) => request<string>(`/svn/diff?path=${encodeURIComponent(path)}`),
  saveFile: (path: string, content: string) =>
    request<{ success: boolean }>("/svn/file", { method: "PUT", body: JSON.stringify({ path, content }) }),
  getHistory: (path?: string) =>
    request<SvnLogEntry[]>(`/svn/history${path ? `?path=${encodeURIComponent(path)}` : ""}`),

  createFile: (path: string) =>
    request<{ success: boolean }>("/svn/create-file", { method: "POST", body: JSON.stringify({ path }) }),
  createFolder: (path: string) =>
    request<{ success: boolean }>("/svn/create-folder", { method: "POST", body: JSON.stringify({ path }) }),
  deletePath: (path: string) =>
    request<{ success: boolean }>("/svn/delete", { method: "POST", body: JSON.stringify({ path }) }),
  renamePath: (fromPath: string, toPath: string) =>
    request<{ success: boolean }>("/svn/rename", { method: "POST", body: JSON.stringify({ fromPath, toPath }) }),
  commit: (paths: string[], message: string) =>
    request<{ success: boolean; output: string }>("/svn/commit", {
      method: "POST",
      body: JSON.stringify({ paths, message }),
    }),
  update: () => request<{ success: boolean; output: string }>("/svn/update", { method: "POST" }),
  revert: (paths: string[]) =>
    request<{ success: boolean; output: string }>("/svn/revert", { method: "POST", body: JSON.stringify({ paths }) }),
  lock: (path: string, message?: string) =>
    request<{ success: boolean }>("/svn/lock", { method: "POST", body: JSON.stringify({ path, message }) }),
  unlock: (path: string) =>
    request<{ success: boolean }>("/svn/unlock", { method: "POST", body: JSON.stringify({ path }) }),

  uploadFiles: async (path: string, files: FileList | File[]) => {
    const form = new FormData();
    form.append("path", path);
    Array.from(files).forEach((file) => form.append("files", file));
    const res = await fetch(`${BASE}/svn/upload`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error ?? "Upload failed");
    }
    return res.json();
  },

  // Uploads a whole folder (FileList from a <input webkitdirectory> picker or a folder
  // drag-drop), preserving the folder's internal structure under `path`.
  uploadFolder: async (path: string, files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const form = new FormData();
    form.append("path", path);
    const relativePaths = fileArray.map((file) => (file as any).webkitRelativePath || file.name);
    form.append("relativePaths", JSON.stringify(relativePaths));
    fileArray.forEach((file) => form.append("files", file));
    const res = await fetch(`${BASE}/svn/upload`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error ?? "Upload failed");
    }
    return res.json();
  },

  getSettings: () => request<SvnSettingsPublic>("/settings"),
  saveSettings: (settings: { repoUrl: string; username: string; password?: string; workingCopyPath: string }) =>
    request<SvnSettingsPublic>("/settings", { method: "PUT", body: JSON.stringify(settings) }),
  checkoutRepository: () => request<{ success: boolean; output: string }>("/settings/checkout", { method: "POST" }),
  relinkWorkingCopy: (workingCopyPath: string) =>
    request<SvnSettingsPublic>("/settings/relink", { method: "POST", body: JSON.stringify({ workingCopyPath }) }),
};
