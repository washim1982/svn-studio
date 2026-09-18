import { Router, type Request, type Response, type NextFunction } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { upload } from "../middleware/upload.js";
import * as settingsStore from "../services/settingsStore.js";
import * as svnService from "../services/svnService.js";
import { assertSafeRelativePath } from "../services/pathSafety.js";
import type { SvnSettings } from "../types/svn.types.js";

export const svnRouter = Router();

declare module "express-serve-static-core" {
  interface Request {
    svnSettings?: SvnSettings;
  }
}

async function requireSettings(req: Request, res: Response, next: NextFunction) {
  const settings = await settingsStore.loadSettings();
  if (!settings || !settings.workingCopyPath) {
    res.status(400).json({ error: "SVN is not configured yet. Visit Settings to link a working copy." });
    return;
  }
  req.svnSettings = settings;
  next();
}

svnRouter.use(requireSettings);

function handleError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: message });
}

svnRouter.get("/tree", async (req, res) => {
  try {
    const tree = await svnService.getTree(req.svnSettings!);
    res.json(tree);
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.get("/status", async (req, res) => {
  try {
    const status = await svnService.getStatus(req.svnSettings!);
    res.json(status);
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.get("/file", async (req, res) => {
  try {
    const relativePath = assertSafeRelativePath(req.svnSettings!.workingCopyPath, String(req.query.path ?? ""));
    const content = await svnService.getFileContent(req.svnSettings!, relativePath);
    res.type("text/plain").send(content);
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.put("/file", async (req, res) => {
  try {
    const settings = req.svnSettings!;
    const relativePath = assertSafeRelativePath(settings.workingCopyPath, String(req.body.path ?? ""));
    const content = String(req.body.content ?? "");
    await svnService.writeFileContent(settings, relativePath, content);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.get("/diff", async (req, res) => {
  try {
    const relativePath = assertSafeRelativePath(req.svnSettings!.workingCopyPath, String(req.query.path ?? ""));
    const diff = await svnService.getDiff(req.svnSettings!, relativePath);
    res.type("text/plain").send(diff);
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.get("/history", async (req, res) => {
  try {
    const relativePath = req.query.path ? assertSafeRelativePath(req.svnSettings!.workingCopyPath, String(req.query.path)) : undefined;
    const log = await svnService.getLog(req.svnSettings!, relativePath);
    res.json(log);
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const settings = req.svnSettings!;
    const targetFolder = String(req.body.path ?? "");
    const files = (req.files as Express.Multer.File[]) ?? [];
    // For a whole-folder upload the client sends each file's path relative to the
    // chosen folder (from webkitRelativePath) so the on-disk structure is preserved
    // instead of flattening every file into targetFolder.
    let relativePaths: string[] | null = null;
    if (req.body.relativePaths) {
      try {
        const parsed = JSON.parse(String(req.body.relativePaths));
        if (Array.isArray(parsed) && parsed.length === files.length) relativePaths = parsed;
      } catch {
        relativePaths = null;
      }
    }
    const added: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileRelativePath = relativePaths ? relativePaths[i] : file.originalname;
      const relativePath = assertSafeRelativePath(settings.workingCopyPath, path.join(targetFolder, fileRelativePath));
      const destAbsPath = path.join(settings.workingCopyPath, relativePath);
      await fs.mkdir(path.dirname(destAbsPath), { recursive: true });
      await fs.copyFile(file.path, destAbsPath);
      await fs.unlink(file.path).catch(() => {});
      await svnService.addPath(settings, relativePath);
      added.push(relativePath);
    }
    res.json({ success: true, added });
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.post("/create-file", async (req, res) => {
  try {
    const relativePath = assertSafeRelativePath(req.svnSettings!.workingCopyPath, String(req.body.path ?? ""));
    await svnService.createFile(req.svnSettings!, relativePath);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.post("/create-folder", async (req, res) => {
  try {
    const relativePath = assertSafeRelativePath(req.svnSettings!.workingCopyPath, String(req.body.path ?? ""));
    await svnService.createFolder(req.svnSettings!, relativePath);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.post("/delete", async (req, res) => {
  try {
    const relativePath = assertSafeRelativePath(req.svnSettings!.workingCopyPath, String(req.body.path ?? ""));
    await svnService.deletePath(req.svnSettings!, relativePath);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.post("/rename", async (req, res) => {
  try {
    const settings = req.svnSettings!;
    const fromPath = assertSafeRelativePath(settings.workingCopyPath, String(req.body.fromPath ?? ""));
    const toPath = assertSafeRelativePath(settings.workingCopyPath, String(req.body.toPath ?? ""));
    await svnService.renamePath(settings, fromPath, toPath);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.post("/commit", async (req, res) => {
  try {
    const { paths, message } = req.body ?? {};
    if (!message || !Array.isArray(paths) || paths.length === 0) {
      res.status(400).json({ error: "paths[] and message are required" });
      return;
    }
    const settings = req.svnSettings!;
    const safePaths = paths.map((p: string) => assertSafeRelativePath(settings.workingCopyPath, p));
    const result = await svnService.commit(settings, safePaths, message);
    res.json({ success: true, output: result.stdout });
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.post("/update", async (req, res) => {
  try {
    const result = await svnService.update(req.svnSettings!);
    res.json({ success: true, output: result.stdout });
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.post("/revert", async (req, res) => {
  try {
    const settings = req.svnSettings!;
    const paths: string[] = Array.isArray(req.body?.paths) ? req.body.paths : [];
    const safePaths = paths.map((p) => assertSafeRelativePath(settings.workingCopyPath, p));
    const result = await svnService.revert(settings, safePaths);
    res.json({ success: true, output: result.stdout });
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.post("/lock", async (req, res) => {
  try {
    const relativePath = assertSafeRelativePath(req.svnSettings!.workingCopyPath, String(req.body.path ?? ""));
    await svnService.lockPath(req.svnSettings!, relativePath, req.body.message);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

svnRouter.post("/unlock", async (req, res) => {
  try {
    const relativePath = assertSafeRelativePath(req.svnSettings!.workingCopyPath, String(req.body.path ?? ""));
    await svnService.unlockPath(req.svnSettings!, relativePath);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});
