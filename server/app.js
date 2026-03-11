import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { initDatabase } from "./db.js";
import { initAI } from "./ai.js";
import { setupRoutes } from "./routes.js";

dotenv.config();

function extractGeminiKeyFromText(text) {
  const byVar = String(text || "").match(/GEMINI_API_KEY\s*[:=]\s*["']?([A-Za-z0-9_-]{20,})["']?/i);
  if (byVar?.[1]) {
    return byVar[1];
  }
  const byPrefix = String(text || "").match(/\b(AIza[0-9A-Za-z_-]{20,})\b/);
  return byPrefix?.[1] || null;
}

async function tryLoadGeminiKeyFromDesktopProject() {
  if (process.env.GEMINI_API_KEY) {
    return;
  }
  const baseDir = "/Users/prova/Desktop/Progetto Didattico";
  const candidates = [
    path.join(baseDir, ".env"),
    path.join(baseDir, ".env.local"),
    path.join(baseDir, "frontend/.env"),
    path.join(baseDir, "frontend/.env.local"),
    path.join(baseDir, "GUIDA.md"),
    path.join(baseDir, "Guida_Docenti_EduMind.md"),
    path.join(baseDir, "wrangler.toml")
  ];
  for (const filePath of candidates) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const key = extractGeminiKeyFromText(content);
      if (key) {
        process.env.GEMINI_API_KEY = key;
        return;
      }
    } catch {
      continue;
    }
  }
}

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(path.join(process.cwd(), "public")));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  setupRoutes(app);

  app.get("*", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public/index.html"));
  });

  app.use((error, req, res, next) => {
    const message = error?.message || "Errore interno del server";
    res.status(500).json({ error: message });
  });

  return app;
}

let initPromise;

async function initServerContext() {
  if (!initPromise) {
    initPromise = (async () => {
      await initDatabase();
      await tryLoadGeminiKeyFromDesktopProject();
      initAI();
    })();
  }
  return initPromise;
}

export { createApp, initServerContext };
