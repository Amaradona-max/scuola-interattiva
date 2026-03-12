import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultPath = process.env.VERCEL ? "/tmp/scuola.db" : "./data/scuola.db";
const configuredPath = process.env.DATABASE_PATH || defaultPath;
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.join(__dirname, "..", configuredPath);

let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(dbPath);
    db.run("PRAGMA foreign_keys = ON");
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });
}

async function initDatabase() {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      learningStyle TEXT NOT NULL DEFAULT 'visual',
      totalCredits INTEGER NOT NULL DEFAULT 0,
      dailyStreak INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      color TEXT,
      description TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subjectId INTEGER NOT NULL,
      uploadedBy INTEGER NOT NULL,
      content TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subjectId) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      documentId INTEGER,
      subjectId INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      qualityScore INTEGER NOT NULL DEFAULT 3,
      creditsEarned INTEGER NOT NULL DEFAULT 10,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE SET NULL,
      FOREIGN KEY (subjectId) REFERENCES subjects(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      badgeType TEXT NOT NULL,
      unlockedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS credits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const defaultSubjects = [
    ["Matematica", "📐", "#f97316", "Algebra, geometria e analisi"],
    ["Italiano", "📖", "#ea580c", "Letteratura, grammatica e scrittura"],
    ["Inglese", "🌍", "#fb923c", "Lettura, comprensione e conversazione"],
    ["Diritto", "⚖️", "#c2410c", "Norme giuridiche, cittadinanza e costituzione"],
    ["Chimica", "⚗️", "#0ea5e9", "Struttura della materia, reazioni e legami chimici"],
    ["Fisica", "🧲", "#0284c7", "Forze, energia, onde ed elettromagnetismo"],
    ["Storia", "🏛️", "#7c3aed", "Eventi storici, civiltà e periodizzazioni"],
    ["Tea", "🍵", "#16a34a", "Percorsi tematici interdisciplinari e attività espressive"]
  ];

  for (const subject of defaultSubjects) {
    const [name, icon, color, description] = subject;
    const exists = await get("SELECT id FROM subjects WHERE lower(name) = lower(?)", [name]);
    if (!exists) {
      await run(
        "INSERT INTO subjects (name, icon, color, description) VALUES (?, ?, ?, ?)",
        [name, icon, color, description]
      );
    }
  }
}

export { initDatabase, run, get, all };
