import { GoogleGenerativeAI } from "@google/generative-ai";

let aiClient;

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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return false;
  }
  aiClient = new GoogleGenerativeAI(apiKey);
  return true;
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
    .filter((word) => word.length >= 3 && !ITALIAN_STOPWORDS.has(word));
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

function scoreSentence(sentence, keywords, question) {
  const lower = sentence.toLowerCase();
  const hasNumberQuestion = /(quanti|quante|numero|quanti articoli|quanto)/i.test(question);
  const baseScore = keywords.reduce((acc, keyword) => acc + (lower.includes(keyword) ? 1 : 0), 0);
  const numberBoost = hasNumberQuestion && /\d+/.test(lower) ? 2 : 0;
  const articleBoost = /articol[oi]/i.test(question) && /articol[oi]/i.test(lower) ? 3 : 0;
  const tocPenalty = /(indice|titolo\s+[ivx]+|sezione\s+[ivx]+)/i.test(lower) ? -3 : 0;
  const lengthPenalty = sentence.length > 260 ? -2 : 0;
  return baseScore + numberBoost + articleBoost + tocPenalty + lengthPenalty;
}

function extractCountAnswer(question, context) {
  if (!/(quanti|quante|numero|compost[aoei].*articol|articol[oi])/i.test(question)) {
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

function buildLocalAnswer(question, context) {
  const countAnswer = extractCountAnswer(question, context);
  if (countAnswer) {
    return {
      answer: countAnswer,
      qualityScore: 4,
      feedback: "Risposta locale basata sul contenuto del documento"
    };
  }
  const sentences = splitIntoSentences(context);
  if (sentences.length === 0) {
    return {
      answer:
        "Non trovo contenuto leggibile nel documento selezionato. Prova con un PDF testuale oppure carica un file DOCX/TXT.",
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
      answer:
        "Nel documento non trovo una frase chiaramente collegata alla domanda. Riprova con una domanda più specifica o un documento con testo più leggibile.",
      qualityScore: 2,
      feedback: "Informazione non trovata nel contesto"
    };
  }
  const support = ranked
    .slice(1, 3)
    .filter((item) => item.score > 0)
    .map((item) => item.sentence);
  const supportText = support.length ? `\nDettagli utili: ${support.join(" ")}` : "";
  return {
    answer: `Dal documento risulta: ${top.sentence}${supportText}`,
    qualityScore: 4,
    feedback: "Risposta locale basata sul contenuto del documento"
  };
}

async function askAI(question, context = "", learningStyle = "visual") {
  if (!aiClient) {
    return buildLocalAnswer(question, context);
  }

  try {
    const model = aiClient.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = [
      "Sei un tutor scolastico per studenti italiani.",
      "Rispondi in italiano in modo chiaro, ordinato e motivante.",
      "Usa prima di tutto gli estratti dei documenti forniti nel contesto.",
      "Se la risposta non è presente nel contesto, dichiaralo esplicitamente e non inventare.",
      "Quando possibile, cita in forma breve i punti del documento usati.",
      `Stile di apprendimento preferito: ${learningStyle}.`,
      context ? `Contesto didattico: ${context}` : "",
      `Domanda dello studente: ${question}`
    ]
      .filter(Boolean)
      .join("\n");

    const result = await model.generateContent(prompt);
    const answer = result.response.text();
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
