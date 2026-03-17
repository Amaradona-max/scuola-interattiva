// RAG (Retrieval-Augmented Generation) Utility Functions
// Extracted from routes.js for better maintainability and testability

/**
 * Normalizes text for matching by removing accents and converting to lowercase
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
function normalizeForMatch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Extracts words from text (length >= 3)
 * @param {string} text - Input text
 * @returns {string[]} Array of words
 */
function extractWords(text) {
  return normalizeForMatch(text)
    .split(/[^a-z0-9]+/g)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);
}

/**
 * Scores how relevant a subject is to given text
 * @param {Object} subject - Subject object with name and description
 * @param {string} text - Text to score against
 * @returns {number} Relevance score
 */
function scoreSubjectInText(subject, text) {
  const normalizedText = normalizeForMatch(text);
  if (!normalizedText) {
    return 0;
  }
  const name = normalizeForMatch(subject.name);
  const description = normalizeForMatch(subject.description || "");
  const nameTokens = extractWords(name);
  const descriptionTokens = extractWords(description).slice(0, 8);
  let score = 0;
  if (name && new RegExp(`\\b${name}\\b`, "i").test(normalizedText)) {
    score += 16;
  }
  nameTokens.forEach((token) => {
    if (new RegExp(`\\b${token}\\b`, "i").test(normalizedText)) {
      score += 6;
    }
  });
  descriptionTokens.forEach((token) => {
    if (new RegExp(`\\b${token}\\b`, "i").test(normalizedText)) {
      score += 2;
    }
  });
  return score;
}

function scoreSubjectAliases(subject, text) {
  const normalizedText = normalizeForMatch(text);
  if (!normalizedText) {
    return 0;
  }
  const aliasesBySubject = {
    diritto: ["legge", "leggi", "costituzione", "codice", "decreto", "articolo", "norma", "norme", "giurisprudenza", "parlamento", "cittadinanza"],
    matematica: ["equazione", "equazioni", "funzione", "funzioni", "teorema", "teoremi", "algebra", "geometria", "analisi", "calcolo"],
    italiano: ["letteratura", "poesia", "grammatica", "narrativa", "autore", "romanzo", "testo argomentativo"],
    inglese: ["english", "grammar", "vocabulary", "reading", "listening", "speaking", "present perfect"],
    fisica: ["forza", "forze", "energia", "moto", "velocita", "accelerazione", "termodinamica", "elettricita"],
    chimica: ["atomo", "atomi", "molecola", "molecole", "reazione", "reazioni", "tavola periodica", "elemento", "elementi"],
    storia: ["medioevo", "rinascimento", "rivoluzione", "guerra", "impero", "civilta", "novecento"],
    geografia: ["continente", "continenti", "territorio", "clima", "cartografia", "popolazione", "paesaggio"]
  };
  const subjectName = normalizeForMatch(subject.name);
  const aliases = aliasesBySubject[subjectName] || [];
  let score = 0;
  aliases.forEach((alias) => {
    if (new RegExp(`\\b${normalizeForMatch(alias)}\\b`, "i").test(normalizedText)) {
      score += 6;
    }
  });
  return score;
}

/**
 * Detects subject for a file based on filename and content
 * @param {Object} params - Parameters containing fileName, content, and subjects
 * @returns {number|null} Detected subject ID or null
 */
function detectSubjectForFile({ fileName, content, subjects }) {
  const normalizedFileName = normalizeForMatch(fileName);
  const normalizedContent = normalizeForMatch(content).slice(0, 12000);
  let winner = null;
  for (const subject of subjects) {
    const fileScore = scoreSubjectInText(subject, normalizedFileName);
    const contentScore = scoreSubjectInText(subject, normalizedContent);
    const aliasScore = scoreSubjectAliases(subject, `${normalizedFileName} ${normalizedContent}`);
    const totalScore = fileScore * 2 + contentScore + aliasScore;
    if (!winner || totalScore > winner.score) {
      winner = { subjectId: subject.id, score: totalScore };
    }
  }
  if (!winner || winner.score < 8) {
    return null;
  }
  return winner.subjectId;
}

/**
 * Sanitizes text by normalizing line breaks and trimming
 * @param {string} text - Input text
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Strips HTML tags from text
 * @param {string} raw - Raw HTML text
 * @returns {string} Plain text
 */
function stripHtml(raw) {
  return sanitizeText(
    String(raw || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
  );
}

/**
 * Tokenizes text for search (lowercase, alphanumeric + Italian accents, length >= 4 or 1-3 digits)
 * @param {string} text - Input text
 * @returns {string[]} Array of tokens
 */
function tokenizeForSearch(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-zàèéìòù0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => /^\d{1,3}$/.test(word) || word.length >= 4);
}

/**
 * Extracts requested article number from question (e.g., "articolo 5" -> 5)
 * @param {string} question - Input question
 * @returns {number|null} Article number or null
 */
function extractRequestedArticle(question) {
  const match = String(question || "").match(/(?:art\.?|articolo)\s*(\d{1,3})\b/i);
  if (!match?.[1]) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 1 || value > 300) {
    return null;
  }
  return value;
}

/**
 * Determines if question is asking about article count
 * @param {string} question - Input question
 * @returns {boolean} True if asking about article count
 */
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

/**
 * Splits text into chunks with overlap for better context retrieval
 * @param {string} text - Input text
 * @param {number} chunkSize - Target chunk size (default: 900)
 * @param {number} overlap - Overlap between chunks (default: 180)
 * @returns {string[]} Array of text chunks
 */
function splitTextIntoChunks(text, chunkSize = 900, overlap = 180) {
  const normalized = sanitizeText(text);
  if (!normalized) {
    return [];
  }
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return [];
  }
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }
    if (current) {
      chunks.push(current);
      const tail = current.slice(Math.max(0, current.length - overlap)).trim();
      current = tail ? `${tail}\n\n${paragraph}` : paragraph;
      if (current.length > chunkSize) {
        chunks.push(current.slice(0, chunkSize));
        current = current.slice(Math.max(0, chunkSize - overlap));
      }
      continue;
    }
    chunks.push(paragraph.slice(0, chunkSize));
    current = paragraph.slice(Math.max(0, chunkSize - overlap));
  }
  if (current) {
    chunks.push(current);
  }
  return chunks.map((item) => item.trim()).filter(Boolean);
}

/**
 * Calculates score for a text chunk based on various factors
 * @param {Object} params - Parameters for scoring
 * @returns {number} Calculated score
 */
function calculateChunkScore({
  chunk,
  tokens,
  normalizedQuestion,
  normalizedTitle,
  keyPhrase,
  isCountQuestion,
  requestedArticle,
  chunkIndex,
  totalChunks
}) {
  const lower = chunk.toLowerCase();
  
  // Count matched tokens
  const matchedTokenCount = tokens.reduce((acc, token) => {
    if (/^\d{1,3}$/.test(token)) {
      return acc + (new RegExp(`\\b${token}\\b`).test(lower) ? 1 : 0);
    }
    return acc + (lower.includes(token) ? 1 : 0);
  }, 0);
  
  const keywordScore = matchedTokenCount * 2;
  const coverageBoost = tokens.length > 0 ? (matchedTokenCount / tokens.length) * 5 : 0;
  const titleBoost = tokens.some((token) => normalizedTitle.includes(token)) ? 4 : 0;
  const phraseBoost = keyPhrase && lower.includes(keyPhrase) ? 5 : 0;
  const questionSentenceBoost = normalizedQuestion && normalizeForMatch(chunk).includes(normalizedQuestion) ? 4 : 0;
  const articleBoost = isCountQuestion && /art\.?\s*\d{1,3}|articolo\s+\d{1,3}/i.test(chunk) ? 3 : 0;
  const edgeBoost = isCountQuestion && (chunkIndex === 0 || chunkIndex === totalChunks - 1) ? 2 : 0;
  const exactArticleBoost = requestedArticle && new RegExp(`(?:^|\\n)\\s*Art\\.?\\s*${requestedArticle}\\b`, "i").test(chunk)
    ? 12
    : 0;
  const hasOtherArticleHeading = requestedArticle && new RegExp("(?:^|\\n)\\s*Art\\.?\\s*(\\d{1,3})\\b", "i").test(chunk)
    && !new RegExp(`(?:^|\\n)\\s*Art\\.?\\s*${requestedArticle}\\b`, "i").test(chunk);
  const otherArticlePenalty = hasOtherArticleHeading ? -4 : 0;
  const tocPenalty = /indice|titolo\s+[ivx]+|sezione\s+[ivx]+/i.test(lower) ? -3 : 0;
  
  return keywordScore
    + coverageBoost
    + titleBoost
    + phraseBoost
    + questionSentenceBoost
    + articleBoost
    + edgeBoost
    + exactArticleBoost
    + otherArticlePenalty
    + tocPenalty;
}

/**
 * Builds RAG context from question and documents
 * @param {string} question - User question
 * @param {Array} documents - Array of document objects
 * @returns {Object} Context and sources for RAG
 */
function buildRagContext(question, documents) {
  const tokens = tokenizeForSearch(question);
  const normalizedQuestion = normalizeForMatch(question);
  const keyPhrase = tokens.slice(0, 3).join(" ");
  const isCountQuestion = isArticleCountQuestion(question);
  const requestedArticle = extractRequestedArticle(question);
  const articleHeadings = [];
  const rankedChunks = [];
  
  // Process each document
  for (const doc of documents) {
    const normalizedTitle = normalizeForMatch(doc.title || "");
    
    // Handle article count questions
    if (isCountQuestion) {
      const matches = Array.from(String(doc.content || "").matchAll(/(?:^|\n)\s*Art\.?\s*(\d{1,3})\b/gim))
        .map((item) => Number(item[1]))
        .filter((value) => Number.isFinite(value) && value >= 20 && value <= 200);
      if (matches.length > 0) {
        articleHeadings.push(Math.max(...matches));
      }
    }
    
    // Split document into chunks
    const chunks = splitTextIntoChunks(doc.content, 900, 180);
    
    // Score each chunk
    chunks.forEach((chunk, index) => {
      const score = calculateChunkScore({
        chunk,
        tokens,
        normalizedQuestion,
        normalizedTitle,
        keyPhrase,
        isCountQuestion,
        requestedArticle,
        chunkIndex: index + 1,
        totalChunks: chunks.length
      });
      
      rankedChunks.push({
        score,
        chunk,
        chunkIndex: index + 1,
        id: doc.id,
        title: doc.title
      });
    });
  }
  
  // Sort chunks by score (descending)
  rankedChunks.sort((a, b) => b.score - a.score);
  
  // Select top chunks
  const topChunks = rankedChunks.filter((item) => item.score > 0).slice(0, 6);
  const fallbackChunks = topChunks.length > 0 ? topChunks : rankedChunks.slice(0, 3);
  
  // Build header for article count questions
  const header = articleHeadings.length
    ? `Indicazione dai documenti: il numero massimo di articolo rilevato è ${Math.max(...articleHeadings)}.`
    : "";
  
  // Build context string
  const context = [header, ...fallbackChunks
    .map((item) => `[Documento: ${item.title} · Estratto ${item.chunkIndex}]\n${item.chunk}`)
  ]
    .filter(Boolean)
    .join("\n\n");
  
  // Build sources list (avoid duplicates)
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
  
  return { context: context.slice(0, 6500), sources };
}

export {
  normalizeForMatch,
  extractWords,
  scoreSubjectInText,
  detectSubjectForFile,
  sanitizeText,
  stripHtml,
  tokenizeForSearch,
  extractRequestedArticle,
  isArticleCountQuestion,
  splitTextIntoChunks,
  calculateChunkScore,
  buildRagContext
};
