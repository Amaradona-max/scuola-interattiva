// State Management Module
let currentUser = null;
let subjects = [];
let documents = [];
let speechRecognition = null;
let isVoiceActive = false;
let quizSession = null;
const stopWords = new Set([
  "alla", "alle", "anche", "avere", "con", "come", "dalla", "dalle", "degli", "della", "delle",
  "dello", "dentro", "dopo", "dove", "fare", "fino", "gli", "hanno", "il", "in", "la", "le", "lo",
  "ma", "nei", "nel", "nella", "nelle", "nello", "non", "noi", "per", "piu", "poi", "puo", "quale",
  "quali", "quando", "questo", "quindi", "senza", "sono", "sopra", "sotto", "sua", "sue", "sul", "sulla",
  "sulle", "sullo", "tra", "una", "uno", "un", "voi", "che", "del", "dei", "di", "da", "ed", "e"
]);

// State getters and setters
function getCurrentUser() {
  return currentUser;
}

function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("user");
  }
}

function getSubjects() {
  return [...subjects]; // Return copy to prevent direct mutation
}

function setSubjects(newSubjects) {
  subjects = [...newSubjects];
}

function getDocuments() {
  return [...documents]; // Return copy to prevent direct mutation
}

function setDocuments(newDocuments) {
  documents = [...newDocuments];
}

function getQuizSession() {
  return quizSession ? { ...quizSession } : null; // Return copy
}

function setQuizSession(session) {
  quizSession = session ? { ...session } : null;
}

// Guide checklist state management
function getGuideState() {
  return JSON.parse(localStorage.getItem("guideChecklistState") || "{}");
}

function setGuideState(state) {
  localStorage.setItem("guideChecklistState", JSON.stringify(state));
}

function updateGuideProgress() {
  const checkboxes = Array.from(document.querySelectorAll("#guideChecklist input[type='checkbox']"));
  const completed = checkboxes.filter((cb) => cb.checked).length;
  const progressEl = document.getElementById("guideProgress");
  if (progressEl) {
    progressEl.textContent = `Completati ${completed}/7 passaggi`;
  }
}

// Export state management functions
window.state = {
  getCurrentUser,
  setCurrentUser,
  getSubjects,
  setSubjects,
  getDocuments,
  setDocuments,
  getQuizSession,
  setQuizSession,
  getGuideState,
  setGuideState,
  updateGuideProgress,
  stopWords
};