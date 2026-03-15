// Utility Functions Module

// Stop words for Italian text processing (duplicated from state for utility independence)
const ITALIAN_STOP_WORDS = new Set([
  "alla", "alle", "anche", "avere", "con", "come", "dalla", "dalle", "degli", "della", "delle",
  "dello", "dentro", "dopo", "dove", "fare", "fino", "gli", "hanno", "il", "in", "la", "le", "lo",
  "ma", "nei", "nel", "nella", "nelle", "nello", "non", "noi", "per", "piu", "poi", "puo", "quale",
  "quali", "quando", "questo", "quindi", "senza", "sono", "sopra", "sotto", "sua", "sue", "sul", "sulla",
  "sulle", "sullo", "tra", "una", "uno", "un", "voi", "che", "del", "dei", "di", "da", "ed", "e"
]);

// Text normalization and processing functions
function normalizeForToken(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractTopKeywords(text, limit = 14) {
  const counts = new Map();
  const words = normalizeForToken(text)
    .split(/[^a-z0-9]+/g)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !ITALIAN_STOP_WORDS.has(word));
  words.forEach((word) => {
    counts.set(word, (counts.get(word) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function createSentenceCandidates(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 50 && item.length <= 220 && item.split(/\s+/).length >= 8);
}

function pickFallbackKeyword(sentence) {
  const tokens = extractTopKeywords(sentence, 6);
  return tokens[0] || "";
}

function shuffleList(items) {
  const list = Array.isArray(items) ? [...items] : [];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function buildQuestionFromSentence(sentence, keywordPool) {
  if (!sentence) {
    return null;
  }
  const normalized = normalizeForToken(sentence);
  let correctAnswer = keywordPool.find((word) => new RegExp(`\\b${word}\\b`, "i").test(normalized)) || "";
  if (!correctAnswer) {
    correctAnswer = pickFallbackKeyword(sentence);
  }
  if (!correctAnswer) {
    return null;
  }
  const maskRegex = new RegExp(`\\b${correctAnswer}\\b`, "i");
  const maskedSentence = sentence.replace(maskRegex, "_____");
  const distractors = keywordPool.filter((word) => word !== correctAnswer).slice(0, 8);
  while (distractors.length < 3) {
    distractors.push(`termine${distractors.length + 1}`);
  }
  const options = shuffleList([correctAnswer, ...distractors.slice(0, 3)]);
  return { maskedSentence, correctAnswer, options };
}

function buildQuestionSet(sentences, keywordPool, count) {
  const shuffledSentences = shuffleList(sentences);
  const questions = [];
  const usedSignatures = new Set();
  for (const sentence of shuffledSentences) {
    const question = buildQuestionFromSentence(sentence, keywordPool);
    if (!question) {
      continue;
    }
    const signature = `${normalizeForToken(question.maskedSentence)}::${question.correctAnswer}`;
    if (usedSignatures.has(signature)) {
      continue;
    }
    usedSignatures.add(signature);
    questions.push(question);
    if (questions.length >= count) {
      break;
    }
  }
  let fallbackIndex = 0;
  while (questions.length < count && shuffledSentences.length > 0 && fallbackIndex < shuffledSentences.length * 5) {
    const sentence = shuffledSentences[fallbackIndex % shuffledSentences.length];
    const question = buildQuestionFromSentence(sentence, keywordPool);
    if (question) {
      questions.push(question);
    }
    fallbackIndex += 1;
  }
  return questions.slice(0, count);
}

// Quiz rendering functions
function renderQuizQuestion({ subject, question, index, total, score = 0, mode = "single" }) {
  const optionButtons = question.options
    .map(
      (option) =>
        `<button type="button" class="quiz-option" data-option="${escapeHtml(option)}">${escapeHtml(option)}</button>`
    )
    .join("");
  const progress =
    total > 1
      ? `<div class="quiz-meta"><strong>Domanda ${index + 1}/${total}</strong> · Punteggio attuale: ${score}</div>`
      : "";
  const nextButton = total > 1
    ? `<div class="quiz-actions"><button id="quizNextButton" type="button" class="hidden" data-quiz-action="next">Prossima domanda</button></div>`
    : "";
  document.getElementById("quizBox").innerHTML = `
    <div class="small"><strong>Materia:</strong> ${escapeHtml(`${subject?.icon || "📘"} ${subject?.name || ""}`)}</div>
    ${progress}
    <p style="margin: 8px 0;"><strong>Domanda:</strong> Completa la frase con il termine corretto.</p>
    <p style="margin: 8px 0;">${escapeHtml(question.maskedSentence)}</p>
    <div>${optionButtons}</div>
    <div id="quizFeedback" class="quiz-feedback hidden"></div>
    ${nextButton}
  `;
  const quizBox = document.getElementById("quizBox");
  quizBox.dataset.correct = question.correctAnswer;
  quizBox.dataset.answered = "false";
  quizBox.dataset.mode = mode;
}

function renderQuizFinalResult() {
  if (!quizSession) {
    return;
  }
  const { score, questions, subject } = quizSession;
  const total = questions.length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percent >= 60;
  document.getElementById("quizBox").innerHTML = `
    <div class="small"><strong>Materia:</strong> ${escapeHtml(`${subject?.icon || "📘"} ${subject?.name || ""}`)}</div>
    <div class="quiz-feedback ${passed ? "ok" : "err"}" style="margin-top: 10px;">
      Test completato: ${score}/${total} corrette (${percent}%)
    </div>
    <div class="quiz-actions">
      <button type="button" data-quiz-action="restart-5">Rifai test da 5</button>
      <button type="button" data-quiz-action="quick-test">Crea test rapido</button>
    </div>
  `;
}

function buildQuiz() {
  clearMessage("dashboardMessage");
  quizSession = null;
  const base = extractQuizBaseData();
  if (!base) {
    return;
  }
  const questions = buildQuestionSet(base.sentences, base.keywordPool, 1);
  if (questions.length === 0) {
    showMessage("dashboardMessage", "Impossibile creare una domanda valida con i contenuti attuali.", false);
    return;
  }
  renderQuizQuestion({
    subject: base.subject,
    question: questions[0],
    index: 0,
    total: 1,
    mode: "single"
  });
}

function startQuizSession(totalQuestions = 5) {
  clearMessage("dashboardMessage");
  const base = extractQuizBaseData();
  if (!base) {
    return;
  }
  const questions = buildQuestionSet(base.sentences, base.keywordPool, totalQuestions);
  if (questions.length < totalQuestions) {
    showMessage("dashboardMessage", "Impossibile creare un test completo da 5 domande con i contenuti attuali.", false);
    return;
  }
  quizSession = {
    subject: base.subject,
    questions,
    currentIndex: 0,
    score: 0
  };
  renderQuizQuestion({
    subject: quizSession.subject,
    question: quizSession.questions[0],
    index: 0,
    total: quizSession.questions.length,
    score: 0,
    mode: "session"
  });
}

function handleQuizSelection(event) {
  const actionButton = event.target.closest("[data-quiz-action]");
  if (actionButton) {
    const action = String(actionButton.dataset.quizAction || "");
    if (action === "next" && quizSession) {
      const nextIndex = quizSession.currentIndex + 1;
      if (nextIndex >= quizSession.questions.length) {
        renderQuizFinalResult();
        return;
      }
      quizSession.currentIndex = nextIndex;
      renderQuizQuestion({
        subject: quizSession.subject,
        question: quizSession.questions[nextIndex],
        index: nextIndex,
        total: quizSession.questions.length,
        score: quizSession.score,
        mode: "session"
      });
    }
    if (action === "restart-5") {
      startQuizSession(5);
    }
    if (action === "quick-test") {
      buildQuiz();
    }
    return;
  }
  const button = event.target.closest(".quiz-option");
  if (!button) {
    return;
  }
  const quizBox = document.getElementById("quizBox");
  if (!quizBox || quizBox.dataset.answered === "true") {
    return;
  }
  const selected = String(button.dataset.option || "");
  const correct = String(quizBox.dataset.correct || "");
  const options = Array.from(quizBox.querySelectorAll(".quiz-option"));
  options.forEach((item) => {
    const value = String(item.dataset.option || "");
    item.disabled = true;
    if (value === correct) {
      item.classList.add("correct");
    }
    if (value === selected && value !== correct) {
      item.classList.add("wrong");
    }
  });
  const feedback = document.getElementById("quizFeedback");
  const isCorrect = selected === correct;
  feedback.classList.remove("hidden");
  feedback.classList.remove("ok", "err");
  feedback.classList.add(isCorrect ? "ok" : "err");
  feedback.textContent = isCorrect
    ? `Risposta corretta: ${correct}`
    : `Risposta errata. Corretta: ${correct}`;
  quizBox.dataset.answered = "true";
  if (quizBox.dataset.mode === "session" && quizSession) {
    if (isCorrect) {
      quizSession.score += 1;
    }
    const nextButton = document.getElementById("quizNextButton");
    if (nextButton) {
      const isLast = quizSession.currentIndex >= quizSession.questions.length - 1;
      nextButton.classList.remove("hidden");
      nextButton.textContent = isLast ? "Mostra punteggio finale" : "Prossima domanda";
    }
  }
}

// Concept map generation
function generateConceptMap() {
  clearMessage("dashboardMessage");
  const subjectId = getSelectedSubjectId();
  if (!subjectId) {
    showMessage("dashboardMessage", "Seleziona una materia per creare la mappa concettuale.", false);
    return;
  }
  const subject = pickSubjectById(subjectId);
  const docs = getDocumentsForSelectedSubject();
  if (docs.length === 0) {
    showMessage("dashboardMessage", "Carica almeno un documento della materia per creare la mappa concettuale.", false);
    return;
  }
  const corpus = docs.map((doc) => `${doc.title}\n${doc.content || ""}`).join("\n\n");
  const subjectTokens = extractTopKeywords(`${subject?.name || ""} ${subject?.description || ""}`, 10);
  const keywords = extractTopKeywords(corpus, 24)
    .filter((word) => !subjectTokens.includes(word))
    .slice(0, 8);
  if (keywords.length === 0) {
    showMessage("dashboardMessage", "Contenuti troppo brevi: non riesco a costruire la mappa concettuale.", false);
    return;
  }
  const nodesHtml = keywords
    .map((word) => `<div class="concept-node">${escapeHtml(word)}</div>`)
    .join("");
  document.getElementById("conceptMapBox").innerHTML = `
    <div class="concept-map">
      <div class="concept-center">${escapeHtml(`${subject?.icon || "📘"} ${subject?.name || "Materia"}`)}</div>
      <div class="concept-branches">${nodesHtml}</div>
    </div>
  `;
}

// Helper functions (these need to be implemented or imported from other modules)
function getSelectedSubjectId() {
  return Number(document.getElementById("questionSubject").value);
}

function getDocumentsForSelectedSubject() {
  const subjectId = getSelectedSubjectId();
  if (!subjectId) {
    return [];
  }
  return documents.filter((doc) => Number(doc.subjectId) === subjectId);
}

function pickSubjectById(subjectId) {
  return subjects.find((item) => Number(item.id) === Number(subjectId)) || null;
}

function extractQuizBaseData() {
  const subjectId = getSelectedSubjectId();
  if (!subjectId) {
    showMessage("dashboardMessage", "Seleziona una materia per creare il test.", false);
    return null;
  }
  const subject = pickSubjectById(subjectId);
  const docs = getDocumentsForSelectedSubject();
  if (docs.length === 0) {
    showMessage("dashboardMessage", "Carica almeno un documento della materia per creare il test.", false);
    return null;
  }
  const corpus = docs.map((doc) => `${doc.title}\n${doc.content || ""}`).join("\n\n");
  const keywordPool = extractTopKeywords(corpus, 30);
  const sentences = createSentenceCandidates(corpus);
  if (sentences.length === 0) {
    showMessage("dashboardMessage", "Non ci sono frasi sufficienti per generare il test. Aggiungi contenuti più estesi.", false);
    return null;
  }
  return { subject, sentences, keywordPool };
}

// Message handling (simplified versions)
function showMessage(id, text, ok = true) {
  const el = document.getElementById(id);
  el.className = `msg ${ok ? "ok" : "err"}`;
  el.textContent = text;
}

function clearMessage(id) {
  const el = document.getElementById(id);
  el.className = "";
  el.textContent = "";
}

// HTML escaping utility
function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convert text to HTML lines
function toHtmlLines(text) {
  return escapeHtml(String(text || "")).replace(/\n+/g, "<br>");
}

// Academic response splitting
function splitAcademicSections(answer) {
  const normalized = String(answer || "").replace(/\*\*/g, "").trim();
  const shortMatch = normalized.match(
    /risposta\s+breve\s*:?\s*([\s\S]*?)(?=\n\s*spiegazione\s*:|\n\s*fonti\s+in\s+calce\s*:|$)/i
  );
  const explanationMatch = normalized.match(
    /spiegazione\s*:?\s*([\s\S]*?)(?=\n\s*fonti\s+in\s+calce\s*:|$)/i
  );
  const shortAnswer = String(shortMatch?.[1] || "").trim();
  const explanationRaw = String(explanationMatch?.[1] || "").trim();
  if (shortAnswer) {
    return {
      shortAnswer,
      explanation: explanationRaw || "La spiegazione dettagliata non è disponibile per questa risposta."
    };
  }
  const noSources = removeInlineSources(normalized);
  const sectionMatch = noSources.match(
    /risposta\s+breve\s*:?\s*([\s\S]*?)\s*(?:spiegazione\s*:?\s*([\s\S]*))?$/i
  );
  if (sectionMatch) {
    const fallbackShort = String(sectionMatch[1] || "").trim();
    const fallbackExplanation = String(sectionMatch[2] || "").trim();
    if (fallbackShort) {
      return {
        shortAnswer: fallbackShort,
        explanation: fallbackExplanation || "La spiegazione dettagliata non è disponibile per questa risposta."
      };
    }
  }
  const sentences = noSources
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (sentences.length === 0) {
    return {
      shortAnswer: "Non sono riuscito a generare una risposta valida.",
      explanation: "Riprova con una domanda più specifica o carica un documento di riferimento."
    };
  }
  const fallbackShortAnswer = sentences.slice(0, 2).join(" ");
  const fallbackExplanation = sentences.slice(2).join(" ") || "La risposta essenziale è riportata nella sezione precedente.";
  return { shortAnswer: fallbackShortAnswer, explanation: fallbackExplanation };
}

function removeInlineSources(answer) {
  const text = String(answer || "").trim();
  const markerIndex = text.toLowerCase().indexOf("fonti in calce");
  if (markerIndex === -1) {
    return text;
  }
  return text.slice(0, markerIndex).trim();
}

function buildAcademicResponse(result) {
  const { shortAnswer, explanation } = splitAcademicSections(result.answer);
  const sourceFooter = buildSourcesFooter(result.sources);
  return `<div class="msg ok"><strong>Risposta breve</strong><br>${toHtmlLines(shortAnswer)}<br><br><strong>Spiegazione estesa</strong><br>${toHtmlLines(explanation)}${sourceFooter}<br><br>Crediti: +${result.creditsEarned}</div>`;
}

function buildSourcesFooter(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return `<br><br><strong>Fonti in calce</strong><br>• Nessuna fonte documentale disponibile.`;
  }
  const items = sources.slice(0, 5).map((source, index) => {
    const title = escapeHtml(source?.title || `Documento ${index + 1}`);
    const excerpt = escapeHtml(String(source?.excerpt || "").replace(/\s+/g, " ").trim()).slice(0, 170);
    const suffix = excerpt ? ` — ${excerpt}` : "";
    return `• [${index + 1}] ${title}${suffix}`;
  });
  return `<br><br><strong>Fonti in calce</strong><br>${items.join("<br>")}`;
}

// Export utility functions
window.utils = {
  normalizeForToken,
  extractTopKeywords,
  createSentenceCandidates,
  pickFallbackKeyword,
  shuffleList,
  buildQuestionFromSentence,
  buildQuestionSet,
  renderQuizQuestion,
  renderQuizFinalResult,
  buildQuiz,
  startQuizSession,
  handleQuizSelection,
  generateConceptMap,
  getSelectedSubjectId,
  getDocumentsForSelectedSubject,
  pickSubjectById,
  extractQuizBaseData,
  showMessage,
  clearMessage,
  escapeHtml,
  toHtmlLines,
  splitAcademicSections,
  removeInlineSources,
  buildAcademicResponse,
  buildSourcesFooter
};