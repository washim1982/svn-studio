import { Router } from "express";
import * as settingsStore from "../services/settingsStore.js";
import * as aiService from "../services/aiService.js";
import { buildAiContext } from "../services/aiContext.js";
import { assertSafeRelativePath } from "../services/pathSafety.js";

export const aiRouter = Router();

// Tests an endpoint from the Settings form before it's saved; a blank apiKey falls back
// to the stored one so the user doesn't have to re-type it just to re-test.
aiRouter.post("/test", async (req, res) => {
  try {
    const stored = await settingsStore.loadSettings();
    const endpoint = String(req.body?.endpoint || stored?.aiEndpoint || settingsStore.DEFAULT_AI_ENDPOINT);
    const apiKey = String(req.body?.apiKey || stored?.aiApiKey || "");
    const models = (await aiService.listModels({ endpoint, apiKey })).filter(aiService.isChatModel);
    res.json({ ok: true, models });
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? String(err) });
  }
});

// Body: { files?: string[], folders?: string[], changes?: string[], question?: string, model?: string }
aiRouter.post("/review", async (req, res) => {
  try {
    const settings = await settingsStore.loadSettings();
    if (!settings?.workingCopyPath) {
      res.status(400).json({ error: "SVN is not configured yet. Visit Settings to link a working copy." });
      return;
    }
    const safeList = (value: unknown): string[] =>
      (Array.isArray(value) ? value : []).map((p) => assertSafeRelativePath(settings.workingCopyPath, String(p)));
    const scope = { files: safeList(req.body?.files), folders: safeList(req.body?.folders), changes: safeList(req.body?.changes) };
    if (scope.files.length + scope.folders.length + scope.changes.length === 0) {
      res.status(400).json({ error: "Nothing in scope. Open a file, or use + to add a folder or your changes." });
      return;
    }

    const { context, truncated, fileCount } = await buildAiContext(settings, scope, aiService.MAX_CONTEXT_CHARS);
    if (!context.trim()) {
      res.status(400).json({ error: "No readable text in the selected scope (binary files, empty folders and oversized files are skipped)." });
      return;
    }
    const model = String(req.body?.model ?? "").trim() || settings.aiModel;
    const result = await aiService.reviewCode(
      { endpoint: settings.aiEndpoint, model, apiKey: settings.aiApiKey },
      context,
      String(req.body?.question ?? "")
    );
    res.json({ ...result, truncated, fileCount });
  } catch (err: any) {
    const message = err?.name === "TimeoutError" ? "The model took too long to respond (5 min timeout)." : err.message ?? String(err);
    res.status(502).json({ error: message });
  }
});
