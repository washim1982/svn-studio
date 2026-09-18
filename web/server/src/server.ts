import "dotenv/config";
import express from "express";
import cors from "cors";
import { svnRouter } from "./routes/svn.routes.js";
import { settingsRouter } from "./routes/settings.routes.js";
import { aiRouter } from "./routes/ai.routes.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/settings", settingsRouter);
app.use("/svn", svnRouter);
app.use("/ai", aiRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`SVN client API listening on http://localhost:${PORT}`);
});
