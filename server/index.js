import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { initDatabase } from "./db.js";
import { initAI } from "./ai.js";
import { setupRoutes } from "./routes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3001);

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

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

setupRoutes(app);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.use((error, req, res, next) => {
  const message = error?.message || "Errore interno del server";
  res.status(500).json({ error: message });
});

await initDatabase();
await tryLoadGeminiKeyFromDesktopProject();
initAI();

app.listen(port, () => {
  console.log("🎓 Scuola Interattiva - Server avviato");
  console.log(`📍 http://localhost:${port}`);
  console.log(`🔗 API: http://localhost:${port}/api`);
});
