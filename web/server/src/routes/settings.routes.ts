import { Router } from "express";
import * as settingsStore from "../services/settingsStore.js";
import * as svnService from "../services/svnService.js";
import type { SvnSettings } from "../types/svn.types.js";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  const settings = await settingsStore.loadSettings();
  res.json(settingsStore.toPublic(settings));
});

settingsRouter.put("/", async (req, res) => {
  const { repoUrl, username, password, workingCopyPath } = req.body ?? {};
  if (!repoUrl || !workingCopyPath) {
    res.status(400).json({ error: "repoUrl and workingCopyPath are required" });
    return;
  }
  const existing = await settingsStore.loadSettings();
  const merged: SvnSettings = {
    repoUrl,
    username: username ?? existing?.username ?? "",
    password: password || existing?.password || "",
    workingCopyPath,
  };
  await settingsStore.saveSettings(merged);
  res.json(settingsStore.toPublic(merged));
});

settingsRouter.post("/checkout", async (_req, res) => {
  const settings = await settingsStore.loadSettings();
  if (!settings) {
    res.status(400).json({ error: "Configure SVN settings first" });
    return;
  }
  try {
    const result = await svnService.checkout(settings);
    res.json({ success: true, output: result.stdout });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.post("/relink", async (req, res) => {
  const { workingCopyPath } = req.body ?? {};
  if (!workingCopyPath) {
    res.status(400).json({ error: "workingCopyPath is required" });
    return;
  }
  const isWc = await svnService.isWorkingCopy(workingCopyPath);
  if (!isWc) {
    res.status(400).json({ error: "That folder is not a valid SVN working copy" });
    return;
  }
  const existing = await settingsStore.loadSettings();
  const merged: SvnSettings = {
    repoUrl: existing?.repoUrl ?? "",
    username: existing?.username ?? "",
    password: existing?.password ?? "",
    workingCopyPath,
  };
  await settingsStore.saveSettings(merged);
  res.json(settingsStore.toPublic(merged));
});
