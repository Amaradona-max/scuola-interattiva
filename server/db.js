import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const usePostgres = Boolean(databaseUrl);
const defaultPath = process.env.VERCEL ? "/tmp/scuola.db" : "./data/scuola.db";
const configuredPath = process.env.DATABASE_PATH || defaultPath;
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.join(__dirname, "..", configuredPath);

let db;
let pool;

function toPostgresSql(sql) {
  let position = 0;
  return String(sql || "").replace(/\?/g, () => {
    position += 1;
    return `$${position}`;
  });
}

function normalizeWriteSqlForPostgres(sql) {
  const trimmed = String(sql || "").trim().replace(/;$/, "");
  if (/^insert\s+/i.test(trimmed) && !/\breturning\b/i.test(trimmed)) {
    return `${trimmed} RETURNING id`;
  }
  return trimmed;
}

function getPostgresPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

function getDb() {
  if (!db) {
    db = new sqlite3.Database(dbPath);
    db.run("PRAGMA foreign_keys = ON");
  }
  return db;
}

async function run(sql, params = []) {
  if (usePostgres) {
    const result = await getPostgresPool().query(
      normalizeWriteSqlForPostgres(toPostgresSql(sql)),
      params
    );
    const id = result.rows?.[0]?.id ?? null;
    return { id, changes: result.rowCount || 0 };
  }
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

async function get(sql, params = []) {
  if (usePostgres) {
    const result = await getPostgresPool().query(toPostgresSql(sql), params);
    return result.rows?.[0] || null;
  }
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

async function all(sql, params = []) {
  if (usePostgres) {
    const result = await getPostgresPool().query(toPostgresSql(sql), params);
    return result.rows || [];
  }
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
  if (!usePostgres) {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
  }

  const idColumn = usePostgres ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
  const dateType = usePostgres ? "TIMESTAMP" : "DATETIME";

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id ${idColumn},
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      learningStyle TEXT NOT NULL DEFAULT 'visual',
      totalCredits INTEGER NOT NULL DEFAULT 0,
      dailyStreak INTEGER NOT NULL DEFAULT 0,
      createdAt ${dateType} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id ${idColumn},
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      color TEXT,
      description TEXT,
      createdAt ${dateType} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS documents (
      id ${idColumn},
      title TEXT NOT NULL,
      subjectId INTEGER NOT NULL,
      uploadedBy INTEGER NOT NULL,
      content TEXT NOT NULL,
      createdAt ${dateType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subjectId) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS questions (
      id ${idColumn},
      userId INTEGER NOT NULL,
      documentId INTEGER,
      subjectId INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      qualityScore INTEGER NOT NULL DEFAULT 3,
      creditsEarned INTEGER NOT NULL DEFAULT 10,
      createdAt ${dateType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE SET NULL,
      FOREIGN KEY (subjectId) REFERENCES subjects(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS badges (
      id ${idColumn},
      userId INTEGER NOT NULL,
      badgeType TEXT NOT NULL,
      unlockedAt ${dateType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

   await run(`
     CREATE TABLE IF NOT EXISTS credits (
       id ${idColumn},
       userId INTEGER NOT NULL,
       amount INTEGER NOT NULL,
       type TEXT NOT NULL,
       description TEXT,
       createdAt ${dateType} NOT NULL DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
     )
   `);

   // Create indexes for better query performance
   await run("CREATE INDEX IF NOT EXISTS idx_documents_subjectId ON documents(subjectId)");
   await run("CREATE INDEX IF NOT EXISTS idx_documents_uploadedBy ON documents(uploadedBy)");
   await run("CREATE INDEX IF NOT EXISTS idx_documents_createdAt ON documents(createdAt)");
   await run("CREATE INDEX IF NOT EXISTS idx_questions_userId ON questions(userId)");
   await run("CREATE INDEX IF NOT EXISTS idx_questions_subjectId ON questions(subjectId)");
   await run("CREATE INDEX IF NOT EXISTS idx_questions_createdAt ON questions(createdAt)");
   await run("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)");

  await ensureDefaultSubjects();
}

async function ensureDefaultSubjects() {
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

export { initDatabase, ensureDefaultSubjects, run, get, all };
