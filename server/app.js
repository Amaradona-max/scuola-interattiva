import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { initDatabase } from "./db.js";
import { initAI } from "./ai.js";
import { setupRoutes } from "./routes.js";

dotenv.config({ override: true });

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    if (req.method === "GET" && (req.path === "/" || req.path.endsWith(".html"))) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  });
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
      initAI();
    })();
  }
  return initPromise;
}

export { createApp, initServerContext };
