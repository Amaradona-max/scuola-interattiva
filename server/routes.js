import { askAI } from "./ai.js";
import { run, get, all } from "./db.js";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import path from "path";

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    totalCredits: user.totalCredits,
    dailyStreak: user.dailyStreak,
    learningStyle: user.learningStyle
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10
  }
});

function sanitizeText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(raw) {
  return sanitizeText(
    String(raw || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
  );
}

async function extractFileContent(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();
  if ([".txt", ".md", ".csv", ".json", ".html", ".htm"].includes(ext)) {
    const raw = file.buffer.toString("utf8");
    if (ext === ".html" || ext === ".htm") {
      return stripHtml(raw);
    }
    return sanitizeText(raw);
  }
  if (mime.startsWith("text/")) {
    return sanitizeText(file.buffer.toString("utf8"));
  }
  if (ext === ".pdf" || mime === "application/pdf") {
    const data = await pdfParse(file.buffer);
    return sanitizeText(data.text || "");
  }
  if (
    ext === ".docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const data = await mammoth.extractRawText({ buffer: file.buffer });
    return sanitizeText(data.value || "");
  }
  throw new Error("Formato non supportato");
}

function splitTextIntoChunks(text, chunkSize = 900, overlap = 180) {
  const normalized = sanitizeText(text);
  if (!normalized) {
    return [];
  }
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + chunkSize);
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

function tokenizeForSearch(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-zàèéìòù0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => /^\d{1,3}$/.test(word) || word.length >= 4);
}

function isArticleCountQuestion(question) {
  const normalized = String(question || "").toLowerCase();
  return (
    /(quanti|quante)\s+articol/.test(normalized) ||
    /numero\s+(totale\s+)?(degli?\s+)?articol/.test(normalized) ||
    /totale\s+articol/.test(normalized) ||
    /compost[aoei]\s+(?:da\s+)?\d{0,4}\s*articol/.test(normalized) ||
    /da\s+quanti\s+articoli/.test(normalized)
  );
}

function buildRagContext(question, documents) {
  const tokens = tokenizeForSearch(question);
  const isCountQuestion = isArticleCountQuestion(question);
  const articleHeadings = [];
  const rankedChunks = [];
  for (const doc of documents) {
    if (isCountQuestion) {
      const matches = Array.from(String(doc.content || "").matchAll(/(?:^|\n)\s*Art\.?\s*(\d{1,3})\b/gim))
        .map((item) => Number(item[1]))
        .filter((value) => Number.isFinite(value) && value >= 20 && value <= 200);
      if (matches.length > 0) {
        articleHeadings.push(Math.max(...matches));
      }
    }
    const chunks = splitTextIntoChunks(doc.content, 900, 180);
    chunks.forEach((chunk, index) => {
      const lower = chunk.toLowerCase();
      const keywordScore = tokens.reduce((acc, token) => acc + (lower.includes(token) ? 1 : 0), 0);
      const articleBoost = isCountQuestion && /art\.?\s*\d{1,3}|articolo\s+\d{1,3}/i.test(chunk) ? 3 : 0;
      const edgeBoost = isCountQuestion && (index === 0 || index === chunks.length - 1) ? 2 : 0;
      const tocPenalty = /indice|titolo\s+[ivx]+|sezione\s+[ivx]+/i.test(lower) ? -3 : 0;
      const score = keywordScore + articleBoost + edgeBoost + tocPenalty;
      rankedChunks.push({
        score,
        chunk,
        chunkIndex: index + 1,
        id: doc.id,
        title: doc.title
      });
    });
  }
  rankedChunks.sort((a, b) => b.score - a.score);
  const topChunks = rankedChunks.filter((item) => item.score > 0).slice(0, 5);
  const fallbackChunks = topChunks.length > 0 ? topChunks : rankedChunks.slice(0, 3);
  const header = articleHeadings.length
    ? `Indicazione dai documenti: il numero massimo di articolo rilevato è ${Math.max(...articleHeadings)}.`
    : "";
  const context = [header, ...fallbackChunks
    .map((item) => `[Documento: ${item.title} · Estratto ${item.chunkIndex}]\n${item.chunk}`)
  ]
    .filter(Boolean)
    .join("\n\n");
  const sources = [];
  const seen = new Set();
  fallbackChunks.forEach((item) => {
    if (seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    sources.push({
      documentId: item.id,
      title: item.title,
      excerpt: item.chunk.slice(0, 220)
    });
  });
  return { context: context.slice(0, 4500), sources };
}

function setupRoutes(app) {
  app.post("/api/users/register", async (req, res, next) => {
    try {
      const { username, email, password, role = "student", learningStyle = "visual" } = req.body;
      if (!username || !email || !password) {
        res.status(400).json({ error: "Campi obbligatori mancanti" });
        return;
      }
      const result = await run(
        "INSERT INTO users (username, email, password, role, learningStyle) VALUES (?, ?, ?, ?, ?)",
        [username.trim(), email.trim(), password, role, learningStyle]
      );
      const user = await get("SELECT * FROM users WHERE id = ?", [result.id]);
      res.status(201).json(sanitizeUser(user));
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) {
        res.status(409).json({ error: "Username o email già registrati" });
        return;
      }
      next(error);
    }
  });

  app.post("/api/users/login", async (req, res, next) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: "Inserisci username e password" });
        return;
      }
      const user = await get(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        [username.trim(), password]
      );
      if (!user) {
        res.status(401).json({ error: "Credenziali non valide" });
        return;
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/users/reset-password", async (req, res, next) => {
    try {
      const { username, email, newPassword } = req.body;
      if (!username || !email || !newPassword) {
        res.status(400).json({ error: "Inserisci username, email e nuova password" });
        return;
      }
      if (String(newPassword).trim().length < 6) {
        res.status(400).json({ error: "La nuova password deve avere almeno 6 caratteri" });
        return;
      }
      const user = await get("SELECT id FROM users WHERE username = ? AND email = ?", [
        username.trim(),
        email.trim()
      ]);
      if (!user) {
        res.status(404).json({ error: "Utente non trovato con username ed email indicati" });
        return;
      }
      await run("UPDATE users SET password = ? WHERE id = ?", [newPassword, user.id]);
      res.json({ success: true, message: "Password reimpostata con successo" });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/reset-subjects", async (req, res, next) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        res.status(400).json({ error: "Utente docente obbligatorio" });
        return;
      }
      const user = await get("SELECT id, role FROM users WHERE id = ?", [userId]);
      if (!user || user.role !== "teacher") {
        res.status(403).json({ error: "Operazione consentita solo ai docenti" });
        return;
      }
      await run("DELETE FROM questions");
      await run("DELETE FROM documents");
      await run("DELETE FROM credits");
      await run("DELETE FROM badges");
      await run("UPDATE users SET totalCredits = 0, dailyStreak = 0");
      res.json({
        success: true,
        message: "Materie e progressi azzerati con successo"
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users/:id", async (req, res, next) => {
    try {
      const user = await get("SELECT * FROM users WHERE id = ?", [req.params.id]);
      if (!user) {
        res.status(404).json({ error: "Utente non trovato" });
        return;
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/subjects", async (req, res, next) => {
    try {
      const subjects = await all("SELECT * FROM subjects ORDER BY name ASC");
      res.json(subjects);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/subjects", async (req, res, next) => {
    try {
      const { name, icon = "📘", color = "#f97316", description = "" } = req.body;
      if (!name) {
        res.status(400).json({ error: "Nome materia obbligatorio" });
        return;
      }
      const result = await run(
        "INSERT INTO subjects (name, icon, color, description) VALUES (?, ?, ?, ?)",
        [name.trim(), icon, color, description]
      );
      const subject = await get("SELECT * FROM subjects WHERE id = ?", [result.id]);
      res.status(201).json(subject);
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) {
        res.status(409).json({ error: "Materia già esistente" });
        return;
      }
      next(error);
    }
  });

  app.get("/api/documents", async (req, res, next) => {
    try {
      const rows = await all(
        `SELECT d.*, s.name as subjectName, u.username as teacherName
         FROM documents d
         JOIN subjects s ON s.id = d.subjectId
         JOIN users u ON u.id = d.uploadedBy
         ORDER BY d.createdAt DESC`
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/documents", async (req, res, next) => {
    try {
      const { title, subjectId, uploadedBy, content } = req.body;
      if (!title || !subjectId || !uploadedBy || !content) {
        res.status(400).json({ error: "Campi documento mancanti" });
        return;
      }
      const result = await run(
        "INSERT INTO documents (title, subjectId, uploadedBy, content) VALUES (?, ?, ?, ?)",
        [title.trim(), subjectId, uploadedBy, content.trim()]
      );
      const doc = await get("SELECT * FROM documents WHERE id = ?", [result.id]);
      res.status(201).json(doc);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/documents/upload", upload.array("files", 10), async (req, res, next) => {
    try {
      const subjectId = Number(req.body.subjectId);
      const uploadedBy = Number(req.body.uploadedBy);
      const files = req.files || [];
      if (!subjectId || !uploadedBy || files.length === 0) {
        res.status(400).json({ error: "Subject, docente e file sono obbligatori" });
        return;
      }
      const user = await get("SELECT id FROM users WHERE id = ?", [uploadedBy]);
      if (!user) {
        res.status(401).json({ error: "Sessione non valida. Effettua nuovamente il login." });
        return;
      }
      const subject = await get("SELECT id FROM subjects WHERE id = ?", [subjectId]);
      if (!subject) {
        res.status(400).json({ error: "Materia non valida. Ricarica la pagina e seleziona di nuovo la materia." });
        return;
      }
      const created = [];
      const skipped = [];
      for (const file of files) {
        try {
          const content = await extractFileContent(file);
          if (!content) {
            skipped.push({
              fileName: file.originalname,
              reason: "Contenuto vuoto dopo elaborazione"
            });
            continue;
          }
          const title = path.basename(file.originalname, path.extname(file.originalname));
          const result = await run(
            "INSERT INTO documents (title, subjectId, uploadedBy, content) VALUES (?, ?, ?, ?)",
            [title, subjectId, uploadedBy, content]
          );
          const document = await get("SELECT * FROM documents WHERE id = ?", [result.id]);
          created.push({
            id: document.id,
            title: document.title,
            fileName: file.originalname
          });
        } catch (error) {
          const constraintError = String(error?.message || "").includes("SQLITE_CONSTRAINT");
          skipped.push({
            fileName: file.originalname,
            reason: constraintError ? "Sessione non valida. Effettua logout e nuovo login." : error.message || "Errore elaborazione"
          });
        }
      }
      if (created.length === 0) {
        res.status(400).json({
          error: "Nessun documento caricato",
          skipped
        });
        return;
      }
      res.status(201).json({
        uploadedCount: created.length,
        skippedCount: skipped.length,
        uploaded: created,
        skipped
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/questions/ask", async (req, res, next) => {
    try {
      const { userId, subjectId, question, documentId = null, learningStyle = "visual" } = req.body;
      if (!userId || !subjectId || !question) {
        res.status(400).json({ error: "Campi obbligatori mancanti" });
        return;
      }
      const cleanQuestion = question.trim();
      let selectedDocumentId = documentId ? Number(documentId) : null;
      let docsForRag = [];
      if (selectedDocumentId) {
        const doc = await get(
          "SELECT id, title, content FROM documents WHERE id = ? AND subjectId = ?",
          [selectedDocumentId, subjectId]
        );
        if (doc) {
          docsForRag = [doc];
        } else {
          selectedDocumentId = null;
        }
      }
      if (!selectedDocumentId) {
        docsForRag = await all(
          "SELECT id, title, content FROM documents WHERE subjectId = ? ORDER BY createdAt DESC LIMIT 8",
          [subjectId]
        );
      }
      const rag = buildRagContext(cleanQuestion, docsForRag);
      const aiResult = await askAI(cleanQuestion, rag.context, learningStyle);
      const creditsEarned = aiResult.qualityScore * 5;
      const saveResult = await run(
        `INSERT INTO questions (userId, documentId, subjectId, question, answer, qualityScore, creditsEarned)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, selectedDocumentId, subjectId, cleanQuestion, aiResult.answer, aiResult.qualityScore, creditsEarned]
      );
      await run("UPDATE users SET totalCredits = totalCredits +  ? WHERE id = ?", [creditsEarned, userId]);
      await run(
        "INSERT INTO credits (userId, amount, type, description) VALUES (?, ?, ?, ?)",
        [userId, creditsEarned, "question", "Crediti per domanda AI"]
      );
      res.status(201).json({
        questionId: saveResult.id,
        answer: aiResult.answer,
        qualityScore: aiResult.qualityScore,
        creditsEarned,
        feedback: aiResult.feedback,
        sources: rag.sources
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/questions/user/:userId", async (req, res, next) => {
    try {
      const rows = await all(
        `SELECT q.*, s.name as subjectName
         FROM questions q
         JOIN subjects s ON s.id = q.subjectId
         WHERE q.userId = ?
         ORDER BY q.createdAt DESC`,
        [req.params.userId]
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/credits/:userId", async (req, res, next) => {
    try {
      const user = await get(
        "SELECT totalCredits, dailyStreak FROM users WHERE id = ?",
        [req.params.userId]
      );
      if (!user) {
        res.status(404).json({ error: "Utente non trovato" });
        return;
      }
      const history = await all(
        "SELECT amount, type, description, createdAt FROM credits WHERE userId = ? ORDER BY createdAt DESC LIMIT 20",
        [req.params.userId]
      );
      res.json({ ...user, history });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/badges/:userId", async (req, res, next) => {
    try {
      const badges = await all(
        "SELECT id, badgeType, unlockedAt FROM badges WHERE userId = ? ORDER BY unlockedAt DESC",
        [req.params.userId]
      );
      res.json(badges);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/badges", async (req, res, next) => {
    try {
      const { userId, badgeType } = req.body;
      if (!userId || !badgeType) {
        res.status(400).json({ error: "Parametri badge mancanti" });
        return;
      }
      const result = await run("INSERT INTO badges (userId, badgeType) VALUES (?, ?)", [userId, badgeType]);
      res.status(201).json({ id: result.id, userId, badgeType });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/stats/user/:userId", async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const asked = await get("SELECT COUNT(*) as total FROM questions WHERE userId = ?", [userId]);
      const documents = await get("SELECT COUNT(*) as total FROM documents WHERE uploadedBy = ?", [userId]);
      const avg = await get("SELECT AVG(qualityScore) as avgScore FROM questions WHERE userId = ?", [userId]);
      res.json({
        totalQuestions: asked?.total || 0,
        uploadedDocuments: documents?.total || 0,
        averageQualityScore: Number(avg?.avgScore || 0).toFixed(2)
      });
    } catch (error) {
      next(error);
    }
  });
}

export { setupRoutes };
