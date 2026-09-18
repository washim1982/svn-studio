import multer from "multer";
import os from "node:os";

// Files land in the OS temp dir first; routes move them into the working copy
// themselves so we can control the final relative path and run `svn add`.
export const upload = multer({ dest: os.tmpdir() });
