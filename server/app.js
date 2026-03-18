import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { requestLogger, errorLogger } from "./utils/logger.js";
import { initDatabase } from "./db.js";
import { initAI } from "./ai.js";
import { setupRoutes } from "./routes.js";
import fs from "fs";

dotenv.config({ override: true });

function createApp() {
  const app = express();
  
  const logsDir = process.env.VERCEL ? path.join("/tmp", "logs") : path.join(process.cwd(), "logs");
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch {
  }
  
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "https:", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"]
        }
      }
    })
  );
  app.use(cors());
  
  // Request logging
  app.use(requestLogger);
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 100, // limite di 100 richieste per finestra
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
  
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
  // Log the error
  errorLogger(error, req, res, () => {
    const message = error?.message || "Errore interno del server";
    res.status(500).json({ error: message });
  });
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
