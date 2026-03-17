import { askAI } from "./ai.js";
import { run, get, all, ensureDefaultSubjects } from "./db.js";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import path from "path";
import Joi from "joi";
import { userSchema, documentSchema, questionSchema, answerSchema, validate } from "./validation/schemas.js";
import { buildRagContext, normalizeForMatch, extractWords, scoreSubjectInText, detectSubjectForFile, sanitizeText, stripHtml, tokenizeForSearch, extractRequestedArticle, isArticleCountQuestion, splitTextIntoChunks } from "./utils/rag.js";

function isUniqueViolation(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("unique") || String(error?.code || "") === "23505";
}

function isConstraintViolation(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return message.includes("sqlite_constraint") || code === "23503" || code === "23505";
}

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
    fileSize: 50 * 1024 * 1024,
    files: 10
  }
});

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

function setupRoutes(app) {
  async function clearAllDataForTeacher(userId) {
    if (!userId) {
      return { ok: false, status: 400, error: "Utente docente obbligatorio" };
    }
    const user = await get("SELECT id, role FROM users WHERE id = ?", [userId]);
    if (!user || user.role !== "teacher") {
      return { ok: false, status: 403, error: "Operazione consentita solo ai docenti" };
    }
    await run("DELETE FROM questions");
    await run("DELETE FROM documents");
    await run("DELETE FROM subjects");
    await run("DELETE FROM credits");
    await run("DELETE FROM badges");
    await run("UPDATE users SET totalCredits = 0, dailyStreak = 0");
    await ensureDefaultSubjects();
    return {
      ok: true,
      payload: {
        success: true,
        message: "Pulizia completa eseguita. Puoi ricaricare i documenti da zero."
      }
    };
  }

app.post("/api/users/quick-access", validate(Joi.object({ role: Joi.string().valid('student', 'teacher').default('student') })), async (req, res, next) => {
  try {
    const requestedRole = String(req.body?.role || "student").toLowerCase();
    const role = requestedRole === "teacher" ? "teacher" : "student";
    const username = role === "teacher" ? "accesso_docente" : "accesso_studente";
    const email = role === "teacher" ? "accesso_docente@scuola.app" : "accesso_studente@scuola.app";
    const existing = await get("SELECT * FROM users WHERE username = ?", [username]);
    if (existing) {
      res.json(sanitizeUser(existing));
      return;
    }
    await run(
      "INSERT INTO users (username, email, password, role, learningStyle) VALUES (?, ?, ?, ?, ?)",
      [username, email, "accesso_libero", role, "visual"]
    );
    const created = await get("SELECT * FROM users WHERE username = ?", [username]);
    res.status(201).json(sanitizeUser(created));
  } catch (error) {
    if (isUniqueViolation(error)) {
      const requestedRole = String(req.body?.role || "student").toLowerCase();
      const username = requestedRole === "teacher" ? "accesso_docente" : "accesso_studente";
      const user = await get("SELECT * FROM users WHERE username = ?", [username]);
      if (user) {
        res.json(sanitizeUser(user));
        return;
      }
    }
    next(error);
  }
});

  app.post("/api/admin/clear-all", async (req, res, next) => {
    try {
      const outcome = await clearAllDataForTeacher(req.body?.userId);
      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.payload);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/reset-subjects", async (req, res, next) => {
    try {
      const outcome = await clearAllDataForTeacher(req.body?.userId);
      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.payload);
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

  app.get("/api/ai/status", async (req, res, next) => {
    try {
      const rows = await all(
        `SELECT s.id, s.name, COUNT(d.id) as documentCount
         FROM subjects s
         LEFT JOIN documents d ON d.subjectId = s.id
         GROUP BY s.id, s.name
         ORDER BY s.name ASC`
      );
      const coverage = rows.map((item) => ({
        subjectId: Number(item.id),
        subjectName: item.name,
        documentCount: Number(item.documentCount || 0)
      }));
      const uncovered = coverage.filter((item) => item.documentCount === 0).map((item) => item.subjectName);
      const provider = "openrouter";
      const aiEnabled = Boolean(process.env.OPENROUTER_API_KEY);
      const model = String(process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini");
      res.json({
        aiEnabled,
        provider,
        model,
        documentTotal: coverage.reduce((acc, item) => acc + item.documentCount, 0),
        coverage,
        uncoveredSubjects: uncovered
      });
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
      if (isUniqueViolation(error)) {
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

app.post("/api/documents", validate(documentSchema), async (req, res, next) => {
  try {
    const { title, subjectId, uploadedBy, content } = req.body;
    const cleanTitle = title.trim();
    const existing = await get(
      "SELECT id FROM documents WHERE lower(title) = lower(?) AND subjectId = ? AND uploadedBy = ? LIMIT 1",
      [cleanTitle, subjectId, uploadedBy]
    );
    if (existing) {
      res.status(409).json({ error: "Documento già caricato per questa materia." });
      return;
    }
    const result = await run(
      "INSERT INTO documents (title, subjectId, uploadedBy, content) VALUES (?, ?, ?, ?)",
      [cleanTitle, subjectId, uploadedBy, content.trim()]
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
      const autoAssignSubject = String(req.body.autoAssignSubject || "false").toLowerCase() === "true";
      let fileSubjectIds = [];
      if (typeof req.body.fileSubjectIds === "string" && req.body.fileSubjectIds.trim().length > 0) {
        try {
          const parsed = JSON.parse(req.body.fileSubjectIds);
          if (!Array.isArray(parsed)) {
            res.status(400).json({ error: "Formato mapping file non valido" });
            return;
          }
          fileSubjectIds = parsed;
        } catch {
          res.status(400).json({ error: "Formato mapping file non valido" });
          return;
        }
      }
      const files = req.files || [];
      if (!uploadedBy || files.length === 0) {
        res.status(400).json({ error: "Docente e file sono obbligatori" });
        return;
      }
      const user = await get("SELECT id FROM users WHERE id = ?", [uploadedBy]);
      if (!user) {
        res.status(401).json({ error: "Sessione non valida. Effettua nuovamente il login." });
        return;
      }
      const subjects = await all("SELECT id, name, description FROM subjects ORDER BY name ASC");
      if (!Array.isArray(subjects) || subjects.length === 0) {
        res.status(400).json({ error: "Nessuna materia disponibile per il caricamento." });
        return;
      }
      const subjectIdsSet = new Set(subjects.map((item) => Number(item.id)));
      const manualSubjectIds = files.map((_, index) => {
        const raw = Number(fileSubjectIds[index]);
        if (!Number.isFinite(raw) || raw <= 0) {
          return null;
        }
        return raw;
      });
      const invalidManualId = manualSubjectIds.find((id) => id && !subjectIdsSet.has(id));
      if (invalidManualId) {
        res.status(400).json({ error: "Una materia manuale selezionata non è valida." });
        return;
      }
      const hasManualSelection = manualSubjectIds.some((id) => Number(id) > 0);
      if (!autoAssignSubject && !subjectId && !hasManualSelection) {
        res.status(400).json({ error: "Seleziona una materia fallback oppure assegna almeno una materia manuale." });
        return;
      }
      if (subjectId && !subjectIdsSet.has(subjectId)) {
        res.status(400).json({ error: "Materia non valida. Ricarica la pagina e seleziona di nuovo la materia." });
        return;
      }
      if (!autoAssignSubject && subjectId) {
        const subject = await get("SELECT id FROM subjects WHERE id = ?", [subjectId]);
        if (!subject) {
          res.status(400).json({ error: "Materia non valida. Ricarica la pagina e seleziona di nuovo la materia." });
          return;
        }
      }
      const created = [];
      const skipped = [];
      for (const [index, file] of files.entries()) {
        try {
          const content = await extractFileContent(file);
          if (!content) {
            skipped.push({
              fileName: file.originalname,
              reason: "Contenuto vuoto dopo elaborazione"
            });
            continue;
          }
          const manualSubjectId = manualSubjectIds[index];
          const detectedSubjectId = autoAssignSubject
            ? detectSubjectForFile({
              fileName: file.originalname || "",
              content,
              subjects
            })
            : null;
          const finalSubjectId = manualSubjectId || (autoAssignSubject ? detectedSubjectId || (subjectId || null) : subjectId);
          if (!finalSubjectId) {
            skipped.push({
              fileName: file.originalname,
              reason: "Materia non riconosciuta automaticamente. Inserisci il nome materia nel file o seleziona una materia di fallback."
            });
            continue;
          }
          const finalSubject = subjects.find((item) => item.id === finalSubjectId);
          if (!finalSubject) {
            skipped.push({
              fileName: file.originalname,
              reason: "Materia non valida"
            });
            continue;
          }
          const title = path.basename(file.originalname, path.extname(file.originalname));
          const duplicate = await get(
            "SELECT id FROM documents WHERE lower(title) = lower(?) AND subjectId = ? AND uploadedBy = ? LIMIT 1",
            [title, finalSubjectId, uploadedBy]
          );
          if (duplicate) {
            skipped.push({
              fileName: file.originalname,
              reason: "Documento già presente in questa materia"
            });
            continue;
          }
          const result = await run(
            "INSERT INTO documents (title, subjectId, uploadedBy, content) VALUES (?, ?, ?, ?)",
            [title, finalSubjectId, uploadedBy, content]
          );
          const document = await get("SELECT * FROM documents WHERE id = ?", [result.id]);
          created.push({
            id: document.id,
            title: document.title,
            fileName: file.originalname,
            subjectId: finalSubjectId,
            subjectName: finalSubject.name
          });
        } catch (error) {
          const constraintError = isConstraintViolation(error);
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
        skipped,
        autoAssigned: autoAssignSubject
      });
    } catch (error) {
      next(error);
    }
  });

app.post("/api/questions/ask", validate(questionSchema), async (req, res, next) => {
  try {
    const { userId, subjectId, question, documentId = null, learningStyle = "visual" } = req.body;
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
