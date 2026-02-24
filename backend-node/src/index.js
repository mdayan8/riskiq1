import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import { ensurePgConnection } from "./db/postgres.js";
import { ensureFixedAdminUser, ensurePlatformSchema, syncReferenceData } from "./db/bootstrap.js";
import authRoutes from "./routes/auth.js";
import coreRoutes from "./routes/core.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const uploadDir = path.resolve(process.cwd(), env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

app.use("/auth", authRoutes);
app.use("/", coreRoutes);

app.use((err, _req, res, _next) => {
  if (err.name === "ZodError") {
    return res.status(400).json({ error: "Validation error", issues: err.issues });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error", detail: err.message });
});

async function boot() {
  await ensurePgConnection();
  await ensurePlatformSchema();
  await ensureFixedAdminUser();
  await syncReferenceData();
  await connectMongo();

  app.listen(env.port, () => {
    console.log(`Node API listening on port ${env.port}`);
  });
}

boot().catch((error) => {
  console.error("Failed to boot Node API", error);
  process.exit(1);
});
