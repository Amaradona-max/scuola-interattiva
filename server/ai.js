let aiProvider = "local";

const ITALIAN_STOPWORDS = new Set([
  "che",
  "della",
  "delle",
  "degli",
  "dello",
  "dall",
  "dalla",
  "dalle",
  "nella",
  "nelle",
  "negli",
  "sono",
  "come",
  "quale",
  "quali",
  "quando",
  "dove",
  "perché",
  "perche",
  "quanti",
  "quante",
  "dopo",
  "prima",
  "della",
  "dello",
  "dell",
  "alla",
  "alle",
  "agli",
  "dati",
  "sulla",
  "sulle",
  "sugli",
  "sugli",
  "sulla",
  "della",
  "delle",
  "degli",
  "italiana",
  "italiano"
]);

function initAI() {
  const openRouterKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  aiProvider = openRouterKey ? "openrouter" : "local";
  return aiProvider === "openrouter";
}

function formatAcademicAnswer(shortAnswer, explanation, sourcesText = "nessuna fonte documentale disponibile") {
  return [
    `Risposta breve: ${String(shortAnswer || "").trim()}`,
    `Spiegazione:\n${String(explanation || "").trim()}`,
    `Fonti in calce: ${String(sourcesText || "").trim()}`
  ].join("\n");
}

function normalizeContext(context) {
  return String(context || "")
    .replace(/\[Documento:[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKeywords(question) {
  return String(question || "")
    .toLowerCase()
    .split(/[^a-zàèéìòù0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => {
      if (!word) {
        return false;
      }
      if (/^\d{1,3}$/.test(word)) {
        return true;
      }
      return word.length >= 3 && !ITALIAN_STOPWORDS.has(word);
    });
}

function splitIntoSentences(text) {
  const clean = normalizeContext(text);
  if (!clean) {
    return [];
  }
  const base = clean
    .split(/(?<=[\.\!\?;:\n])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (base.length > 0) {
    return base.flatMap((item) => {
      if (item.length <= 280) {
        return [item];
      }
      return item.match(/.{1,260}(?:\s|$)/g)?.map((part) => part.trim()).filter(Boolean) || [item];
    });
  }
  return clean
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tokenInText(text, token) {
  if (/^\d{1,3}$/.test(token)) {
    return new RegExp(`\\b${token}\\b`).test(text);
  }
  return text.includes(token);
}

function sanitizeArticleBody(text) {
  return String(text || "")
    .replace(/\[Documento:[^\]]+\]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function scoreSentence(sentence, keywords, question) {
  const lower = sentence.toLowerCase();
  const hasNumberQuestion = /(quanti|quante|numero|quanti articoli|quanto)/i.test(question);
  const requestedArticle = extractRequestedArticle(question);
  const baseScore = keywords.reduce((acc, keyword) => acc + (tokenInText(lower, keyword) ? 1 : 0), 0);
  const numberBoost = hasNumberQuestion && /\d+/.test(lower) ? 2 : 0;
  const articleBoost = /articol[oi]/i.test(question) && /articol[oi]/i.test(lower) ? 3 : 0;
  const exactArticleBoost = requestedArticle && new RegExp(`(?:^|\\n|\\s)(?:art\\.?|articolo)\\s*${requestedArticle}\\b`, "i").test(sentence) ? 7 : 0;
  const tocPenalty = /(indice|titolo\s+[ivx]+|sezione\s+[ivx]+)/i.test(lower) ? -3 : 0;
  const lengthPenalty = sentence.length > 260 ? -2 : 0;
  return baseScore + numberBoost + articleBoost + exactArticleBoost + tocPenalty + lengthPenalty;
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

function extractArticleAnswer(question, context) {
  const requestedArticle = extractRequestedArticle(question);
  if (!requestedArticle) {
    return null;
  }
  const source = String(context || "").replace(/\r\n/g, "\n");
  const strictSectionPattern = new RegExp(
    `(?:^|\\n)\\s*Art\\.?\\s*${requestedArticle}\\s*[\\.\\-–:]?\\s*(?:\\n|$)([\\s\\S]{0,1200}?)(?=(?:\\n\\s*Art\\.?\\s*\\d{1,3}\\s*[\\.\\-–:]?\\s*(?:\\n|$))|(?:\\n\\s*\\[Documento:)|$)`,
    "i"
  );
  const strictMatch = source.match(strictSectionPattern);
  if (strictMatch) {
    const body = sanitizeArticleBody(strictMatch[1]);
    if (body.length > 0) {
      return `Articolo ${requestedArticle}: ${body}`;
    }
  }
  const looseSectionPattern = new RegExp(
    `(?:^|\\n)\\s*(?:Art\\.?|Articolo)\\s*${requestedArticle}\\b([\\s\\S]{0,800}?)(?=(?:\\n\\s*(?:Art\\.?|Articolo)\\s*\\d{1,3}\\b)|(?:\\n\\s*\\[Documento:)|$)`,
    "i"
  );
  const looseMatch = source.match(looseSectionPattern);
  if (looseMatch) {
    const body = sanitizeArticleBody(looseMatch[1]).replace(/^\s*[-:]\s*/, "").trim();
    if (body.length > 0) {
      return `Articolo ${requestedArticle}: ${body}`;
    }
  }
  const sentences = splitIntoSentences(source).filter((sentence) =>
    new RegExp(`(?:^|\\s)(?:art\\.?|articolo)\\s*${requestedArticle}\\b`, "i").test(sentence)
  );
  if (sentences.length > 0) {
    return `Articolo ${requestedArticle}: ${sentences.slice(0, 2).join(" ")}`;
  }
  return null;
}

function extractCountAnswer(question, context) {
  if (!isArticleCountQuestion(question)) {
    return null;
  }
  const explicitMax = String(context || "").match(/numero massimo di articolo rilevato è\s*(\d{1,3})/i);
  if (explicitMax?.[1]) {
    const value = Number(explicitMax[1]);
    if (value >= 20 && value <= 200) {
      return `Dal documento il testo arriva fino all'articolo ${value}, quindi la Costituzione risulta composta da ${value} articoli.`;
    }
  }
  const headingMatches = Array.from(String(context || "").matchAll(/(?:^|\n)\s*Art\.?\s*(\d{1,3})\b/gim))
    .map((item) => Number(item[1]))
    .filter((value) => Number.isFinite(value) && value >= 20 && value <= 200);
  if (headingMatches.length > 0) {
    const maxArticle = Math.max(...headingMatches);
    return `Dal documento il testo arriva fino all'articolo ${maxArticle}, quindi la Costituzione risulta composta da ${maxArticle} articoli.`;
  }
  const clean = normalizeContext(context);
  const patterns = [
    /(?:compost[aoei]\s+da\s+|sono\s+)(\d{1,4})\s+articoli/i,
    /(\d{1,4})\s+articoli/i,
    /articoli\s+(\d{1,4})/i
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) {
      const count = Number(match[1]);
      if (count >= 20 && count <= 1000) {
        return `Dal documento risulta che la Costituzione è composta da ${count} articoli.`;
      }
    }
  }
  return null;
}

function buildCommissionExplanation({ question, keySentence, supportSentences = [] }) {
  const intro = `Inquadramento: la domanda richiede una risposta in chiave accademica, con linguaggio tecnico ma comprensibile anche in sede di studio.`;
  const central = `Nucleo concettuale: ${keySentence}`;
  const support = supportSentences.slice(0, 4).map((sentence) => `- ${sentence}`).join("\n");
  const supportBlock = support
    ? `Passaggi rilevanti dal materiale:\n${support}`
    : "Passaggi rilevanti dal materiale: il documento disponibile contiene un solo passaggio esplicito direttamente collegato alla domanda.";
  const examMethod = "Metodo da commissione: definisci prima l'istituto, poi descrivi funzione, limiti e implicazioni pratiche, collegando ogni punto al dato testuale disponibile.";
  const closure = `Sintesi finale: la risposta va letta come base solida; per una trattazione esaustiva da esame è utile integrare altri estratti specifici della stessa materia.`;
  const questionBridge = question
    ? `Collegamento alla traccia: ${String(question).trim()}`
    : "";
  return [intro, central, supportBlock, examMethod, questionBridge, closure].filter(Boolean).join("\n\n");
}

function parseAcademicAnswerSections(rawAnswer) {
  const normalized = String(rawAnswer || "").replace(/\*\*/g, "").trim();
  const shortMatch = normalized.match(
    /risposta\s+breve\s*:?\s*([\s\S]*?)(?=\n\s*spiegazione\s*:|\n\s*fonti\s+in\s+calce\s*:|$)/i
  );
  const explanationMatch = normalized.match(
    /spiegazione\s*:?\s*([\s\S]*?)(?=\n\s*fonti\s+in\s+calce\s*:|$)/i
  );
  const sourcesMatch = normalized.match(/fonti\s+in\s+calce\s*:?\s*([\s\S]*)$/i);
  return {
    shortAnswer: String(shortMatch?.[1] || "").trim(),
    explanation: String(explanationMatch?.[1] || "").trim(),
    sources: String(sourcesMatch?.[1] || "").trim()
  };
}

function extractSourcesFromContext(context) {
  const matches = Array.from(String(context || "").matchAll(/\[Documento:\s*([^\]\n]+)\]/g))
    .map((item) => String(item[1] || "").trim())
    .filter(Boolean);
  const unique = [];
  const seen = new Set();
  for (const label of matches) {
    const key = label.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(label);
    if (unique.length >= 5) {
      break;
    }
  }
  return unique;
}

function formatSourcesList(sourceLabels, hasDocumentContext) {
  if (sourceLabels.length > 0) {
    return sourceLabels.map((label, index) => `[${index + 1}] ${label}`).join("\n");
  }
  if (hasDocumentContext) {
    return "nessuna fonte documentale disponibile";
  }
  return "conoscenza generale del modello (assenza di fonti documentali caricate)";
}

function buildExpandedExamExplanation({ question, shortAnswer, hasDocumentContext }) {
  const inquadramento = "Inquadramento: il tema va collocato nel quadro del diritto costituzionale, distinguendo dato normativo, funzione dell'istituto e ratio della disciplina.";
  const argomentazione = `Argomentazione: ${shortAnswer} Questa affermazione va sviluppata chiarendo presupposti, effetti giuridici e limiti applicativi, evitando formule generiche.`;
  const letturaEsame = "Lettura da esame: in commissione è utile partire dalla definizione tecnica, passare alla ricostruzione sistematica e chiudere con una valutazione critica coerente.";
  const conclusione = hasDocumentContext
    ? `Conclusione: la risposta è fondata sul materiale disponibile e può essere ulteriormente rafforzata collegando i passaggi testuali alla domanda: ${String(question || "").trim()}.`
    : `Conclusione: la risposta è impostata in chiave metodologica universitaria; per massimo rigore, integra con un estratto documentale diretto relativo alla domanda: ${String(question || "").trim()}.`;
  return [inquadramento, argomentazione, letturaEsame, conclusione].join("\n\n");
}

function ensureUniversityFormat(rawAnswer, question, hasDocumentContext, preferredSourceLabels = []) {
  const sections = parseAcademicAnswerSections(rawAnswer);
  const sourceLabels = extractSourcesFromContext(rawAnswer);
  const fallbackSourceLabels = sourceLabels.length > 0 ? sourceLabels : preferredSourceLabels;
  const cleanText = String(rawAnswer || "").trim();
  const fallbackSentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const shortAnswer = sections.shortAnswer || fallbackSentences.slice(0, 2).join(" ") || "Risposta non disponibile in formato strutturato.";
  const explanationIsTooShort = sections.explanation.length < 260;
  const explanationHasExamSections =
    /inquadramento\s*:/i.test(sections.explanation) &&
    /argomentazione\s*:/i.test(sections.explanation) &&
    /lettura\s+da\s+esame\s*:/i.test(sections.explanation) &&
    /conclusione\s*:/i.test(sections.explanation);
  const explanation = !sections.explanation || explanationIsTooShort || !explanationHasExamSections
    ? buildExpandedExamExplanation({ question, shortAnswer, hasDocumentContext })
    : sections.explanation;
  const hasValidSources = sections.sources
    && !/nessuna fonte documentale disponibile/i.test(sections.sources)
    && !/conoscenza generale del modello/i.test(sections.sources);
  const sources = hasValidSources ? sections.sources : formatSourcesList(fallbackSourceLabels, hasDocumentContext);
  return formatAcademicAnswer(shortAnswer, explanation, sources);
}

function getGroundingRules(hasDocumentContext) {
  return hasDocumentContext
    ? [
      "Mantieni massima precisione: usa solo informazioni presenti nel contesto e non fare inferenze non supportate.",
      "Usa prima di tutto gli estratti dei documenti forniti nel contesto.",
      "Se la risposta non è presente nel contesto, dichiaralo esplicitamente e non inventare.",
      "Ogni affermazione principale deve essere agganciata a un estratto del contesto con riferimento [Documento: titolo].",
      "In 'Fonti in calce' riporta solo fonti presenti nel contesto, in forma breve e verificabile, una riga per fonte.",
      "Se non esistono fonti nel contesto, scrivi esattamente: 'Fonti in calce: nessuna fonte documentale disponibile'."
    ]
    : [
      "Il contesto documentale è insufficiente: fornisci una risposta accurata usando conoscenza scolastica generale affidabile.",
      "Non inventare dati numerici o citazioni specifiche non verificabili.",
      "In 'Fonti in calce' scrivi esattamente: 'Fonti in calce: conoscenza generale del modello (assenza di fonti documentali caricate)'."
    ];
}

function buildAcademicPrompt(question, context, learningStyle, hasDocumentContext) {
  const groundingRules = getGroundingRules(hasDocumentContext);
  return [
    "Sei un docente universitario di area giuridico-umanistica che prepara studenti a un colloquio davanti a una commissione d'esame.",
    "Rispondi in italiano con linguaggio tecnico rigoroso nella prima parte e didattico nella seconda.",
    "Nella sezione 'Risposta breve:' usa tono tecnico, rigoroso e sintetico, come un professore universitario.",
    "Nella sezione 'Spiegazione:' produci una trattazione ampia, ordinata ed esaustiva, ma con frasi comprensibili a uno studente.",
    "Usa questa struttura obbligatoria: 'Risposta breve:' in 2-4 frasi, poi 'Spiegazione:' in 8-14 frasi, poi 'Fonti in calce:' con elenco puntato.",
    "Nella 'Spiegazione:' usa esattamente i sottoparagrafi 'Inquadramento', 'Argomentazione', 'Lettura da esame', 'Conclusione'.",
    "Ogni sottoparagrafo deve essere concreto, senza ripetizioni, e deve aggiungere valore informativo.",
    ...groundingRules,
    `Stile di apprendimento preferito: ${learningStyle}.`,
    context ? `Contesto didattico: ${context}` : "",
    `Domanda dello studente: ${question}`
  ]
    .filter(Boolean)
    .join("\n");
}

async function askOpenRouter(prompt) {
  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY mancante");
  }
  const model = String(process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini").trim();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "HTTP-Referer": String(process.env.OPENROUTER_SITE_URL || "http://localhost:3001"),
      "X-Title": String(process.env.OPENROUTER_APP_NAME || "Scuola Interattiva"),
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      top_p: 0.9,
      max_tokens: 1300,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });
  const payload = await response.json().catch(() => ({}));
  const text = String(payload?.choices?.[0]?.message?.content || "").trim();
  if (!response.ok || !text) {
    throw new Error(String(payload?.error?.message || "Errore OpenRouter"));
  }
  return text;
}

function buildLocalAnswer(question, context) {
  const localSourceLabels = extractSourcesFromContext(context);
  const localSourcesText = formatSourcesList(localSourceLabels, localSourceLabels.length > 0);
  const articleAnswer = extractArticleAnswer(question, context);
  if (articleAnswer) {
    return {
      answer: formatAcademicAnswer(
        articleAnswer,
        [
          "Inquadramento: il contenuto riportato corrisponde al testo dell'articolo richiesto e costituisce il dato normativo primario da cui partire.",
          "Argomentazione: in un'esposizione universitaria occorre distinguere contenuto precettivo, funzione costituzionale e ricadute sull'assetto dei poteri pubblici.",
          "Lettura da esame: dopo la lettura letterale, collega la disposizione ai principi costituzionali pertinenti e chiarisci perché la norma incide sull'equilibrio istituzionale.",
          "Conclusione: la risposta è corretta sul piano testuale; per un livello pienamente universitario integra sempre con riferimenti sistematici coerenti con la domanda."
        ].join("\n\n"),
        localSourcesText
      ),
      qualityScore: 4,
      feedback: "Risposta locale basata sul contenuto del documento"
    };
  }
  const countAnswer = extractCountAnswer(question, context);
  if (countAnswer) {
    return {
      answer: formatAcademicAnswer(
        countAnswer,
        [
          "Metodo di verifica: il conteggio è stato ricostruito dalle intestazioni e dai passaggi testuali presenti nel materiale.",
          "Affidabilità: il dato è utilizzabile come risposta tecnica se il documento contiene in modo ordinato la numerazione degli articoli.",
          "Taglio da esame: oltre al numero, motiva sempre il rilievo sistematico della disposizione nel quadro costituzionale."
        ].join("\n\n"),
        localSourcesText
      ),
      qualityScore: 4,
      feedback: "Risposta locale basata sul contenuto del documento"
    };
  }
  const sentences = splitIntoSentences(context);
  if (sentences.length === 0) {
    return {
      answer: formatAcademicAnswer(
        "Non trovo contenuto leggibile nel documento selezionato.",
        [
          "Diagnosi: il materiale non contiene testo sufficiente per produrre una spiegazione ampia, chiara ed esaustiva.",
          "Correzione consigliata: usa un PDF testuale oppure un DOCX/TXT con testo copiabile e possibilmente suddiviso per paragrafi.",
          "Metodo universitario: quando il documento è leggibile, la risposta può essere strutturata per inquadramento, argomentazione e conclusione critica."
        ].join("\n\n"),
        "nessuna fonte documentale disponibile"
      ),
      qualityScore: 2,
      feedback: "Documento senza testo utile"
    };
  }
  const keywords = getKeywords(question);
  const ranked = sentences
    .map((sentence) => ({
      sentence,
      score: scoreSentence(sentence, keywords, question)
    }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score <= 0) {
    return {
      answer: formatAcademicAnswer(
        "Nel documento non trovo una frase chiaramente collegata alla domanda.",
        [
          "Diagnosi: la traccia richiesta non trova un ancoraggio testuale diretto nei passaggi disponibili.",
          "Correzione consigliata: formula una domanda più circoscritta e carica un documento che contenga in modo esplicito il tema richiesto.",
          "Metodo universitario: una risposta da commissione richiede sempre fondamento testuale, sviluppo argomentativo e conclusione critica."
        ].join("\n\n"),
        "nessuna fonte documentale disponibile"
      ),
      qualityScore: 2,
      feedback: "Informazione non trovata nel contesto"
    };
  }
  const support = ranked
    .slice(1, 3)
    .filter((item) => item.score > 0)
    .map((item) => item.sentence);
  return {
    answer: formatAcademicAnswer(
      `Dal documento, in chiave tecnico-giuridica, emerge il seguente punto centrale: ${top.sentence}`,
      buildCommissionExplanation({
        question,
        keySentence: top.sentence,
        supportSentences: support
      }),
      localSourcesText
    ),
    qualityScore: 4,
    feedback: "Risposta locale basata sul contenuto del documento"
  };
}

async function askAI(question, context = "", learningStyle = "visual") {
  if (aiProvider !== "openrouter") {
    return buildLocalAnswer(question, context);
  }

  try {
    const normalizedContext = normalizeContext(context);
    const hasDocumentContext = normalizedContext.length >= 180;
    const prompt = buildAcademicPrompt(question, context, learningStyle, hasDocumentContext);
    const contextSourceLabels = extractSourcesFromContext(context);
    const rawText = await askOpenRouter(prompt);
    const answer = ensureUniversityFormat(rawText, question, hasDocumentContext, contextSourceLabels);
    const qualityScore = Math.max(1, Math.min(5, Math.ceil(answer.length / 350)));
    return {
      answer,
      qualityScore,
      feedback: `Qualità stimata: ${qualityScore}/5`
    };
  } catch {
    return buildLocalAnswer(question, context);
  }
}

export { initAI, askAI };
