// API Service Layer
const API_URL = `${window.location.origin}/api`;

async function fetchJSON(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new Error("Connessione non riuscita. Controlla la rete e riprova.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Operazione non riuscita");
  }
  return payload;
}

function isSessionError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("sessione non valida") || text.includes("utente non trovato");
}

async function ensureCurrentUserValid() {
  if (!currentUser?.id) {
    return;
  }
  try {
    await fetchJSON(`/users/${currentUser.id}`);
  } catch (error) {
    if (!isSessionError(error.message)) {
      throw error;
    }
    currentUser = null;
    localStorage.removeItem("user");
    toggleAuth(true);
    toggleTeacherTopActions();
    showMessage("accessMessage", "Sessione scaduta. Seleziona di nuovo accesso rapido.", false);
    throw new Error("Sessione scaduta. Seleziona di nuovo accesso rapido.");
  }
}

async function loadSubjects() {
  subjects = await fetchJSON("/subjects");
  const selects = [document.getElementById("questionSubject"), document.getElementById("docSubject")];
  selects.forEach((select) => {
    select.innerHTML = `<option value="">Seleziona materia</option>`;
    subjects.forEach((s) => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = `${s.icon || "📘"} ${s.name}`;
      select.appendChild(option);
    });
    if (!select.value && subjects.length > 0) {
      select.value = String(subjects[0].id);
    }
  });
  handleQuestionSubjectChange();
  renderFileSubjectMapping();
}

async function loadStats() {
  const stats = await fetchJSON(`/stats/user/${currentUser.id}`);
  const credits = await fetchJSON(`/credits/${currentUser.id}`);
  document.getElementById("userSummary").textContent =
    `Utente: ${currentUser.username} · Ruolo: ${currentUser.role} · Crediti: ${credits.totalCredits}`;
  document.getElementById("statsSummary").textContent =
    `Domande totali: ${stats.totalQuestions} · Qualità media: ${stats.averageQualityScore}`;
  const creditsList = document.getElementById("creditsList");
  creditsList.innerHTML = "";
  if (!credits.history || credits.history.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nessun credito registrato al momento.";
    creditsList.appendChild(li);
    return;
  }
  credits.history.slice(0, 5).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `+${item.amount} crediti · ${item.description}`;
    creditsList.appendChild(li);
  });
}

async function loadQuestions() {
  const questions = await fetchJSON(`/questions/user/${currentUser.id}`);
  const questionsList = document.getElementById("questionsList");
  questionsList.innerHTML = "";
  if (!questions || questions.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Non hai ancora inviato domande.";
    questionsList.appendChild(li);
    return;
  }
  questions.slice(0, 5).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.subjectName}: ${item.question}`;
    questionsList.appendChild(li);
  });
}

async function loadDocuments() {
  documents = await fetchJSON("/documents");
  const list = document.getElementById("docsList");
  list.innerHTML = "";
  documents.forEach((doc) => {
    const li = document.createElement("li");
    li.textContent = `${doc.title} · ${doc.subjectName} · ${doc.teacherName}`;
    list.appendChild(li);
  });
  refreshQuestionDocuments();
}

async function loadAiStatus() {
  const notice = document.getElementById("aiStatusNotice");
  notice.className = "";
  notice.textContent = "";
  try {
    const status = await fetchJSON("/ai/status");
    const uncovered = Array.isArray(status.uncoveredSubjects) ? status.uncoveredSubjects : [];
    if (!status.aiEnabled) {
      notice.className = "msg err";
      notice.textContent =
        "AI avanzata non attiva: imposta OPENROUTER_API_KEY per risposte migliori e più approfondite.";
      return;
    }
    if (uncovered.length > 0) {
      const preview = uncovered.slice(0, 4).join(", ");
      const suffix = uncovered.length > 4 ? ", ..." : "";
      notice.className = "msg err";
      notice.textContent =
        `AI attiva (${status.model}). Materie senza documenti: ${preview}${suffix}. Carica fonti per migliorare precisione e fonti in calce.`;
      return;
    }
    notice.className = "msg ok";
    notice.textContent = `AI attiva (${status.model}) e copertura documentale completa su tutte le materie.`;
  } catch {
    notice.className = "msg err";
    notice.textContent = "Impossibile verificare lo stato AI in questo momento.";
  }
}

async function quickAccess(role, options = {}) {
  const { silent = false } = options;
  clearMessage("accessMessage");
  try {
    currentUser = await fetchJSON("/users/quick-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });
    localStorage.setItem("user", JSON.stringify(currentUser));
    const roleLabel = currentUser.role === "teacher" ? "Docente" : "Studente";
    if (!silent) {
      showMessage("accessMessage", `Accesso effettuato come ${roleLabel}.`);
    }
    await loadDashboard();
  } catch (error) {
    showMessage("accessMessage", error.message, false);
  }
}

async function askQuestion() {
  clearMessage("dashboardMessage");
  try {
    const documentValue = document.getElementById("questionDocument").value;
    const questionText = document.getElementById("questionText").value.trim();
    const subjectId = Number(document.getElementById("questionSubject").value);
    if (!questionText) {
      showMessage("dashboardMessage", "Scrivi una domanda prima di inviare.", false);
      return;
    }
    if (!subjectId) {
      showMessage("dashboardMessage", "Seleziona una materia prima di inviare la domanda.", false);
      return;
    }
    const payload = {
      userId: currentUser.id,
      subjectId,
      question: questionText,
      documentId: documentValue ? Number(documentValue) : null,
      learningStyle: "visual"
    };
    const result = await fetchJSON("/questions/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const normalizedAnswer = removeInlineSources(result.answer);
    document.getElementById("questionResponse").innerHTML = buildAcademicResponse(result);
    const chatHistory = document.getElementById("chatHistory");
    const userBubble = document.createElement("div");
    userBubble.className = "bubble user";
    userBubble.textContent = `Tu: ${payload.question}`;
    const aiBubble = document.createElement("div");
    aiBubble.className = "bubble ai";
    const sourceText = Array.isArray(result.sources) && result.sources.length
      ? `\nFonti in calce:\n${result.sources
        .slice(0, 5)
        .map((source, index) => `[${index + 1}] ${source.title}`)
        .join("\n")}`
      : "\nFonti in calce:\nNessuna fonte documentale disponibile.";
    aiBubble.textContent = `AI: ${normalizedAnswer}${sourceText}`;
    chatHistory.prepend(aiBubble);
    chatHistory.prepend(userBubble);
    document.getElementById("questionText").value = "";
    await loadStats();
    await loadQuestions();
  } catch (error) {
    showMessage("dashboardMessage", error.message, false);
  }
}

async function clearAllData() {
  clearMessage("dashboardMessage");
  if (!currentUser || currentUser.role !== "teacher") {
    showMessage("dashboardMessage", "Solo i docenti possono usare 'Pulire tutto'.", false);
    return;
  }
  const confirmed = window.confirm(
    "Confermi la pulizia completa? Verranno cancellati documenti, domande, crediti, badge e materie personalizzate. Le materie base verranno ricreate automaticamente."
  );
  if (!confirmed) {
    return;
  }
  try {
    await fetchJSON("/admin/clear-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id })
    });
    document.getElementById("chatHistory").innerHTML = "";
    document.getElementById("questionResponse").innerHTML = "";
    showMessage("dashboardMessage", "Pulizia completata. Puoi ricaricare i documenti da zero.");
    await loadDashboard();
  } catch (error) {
    showMessage("dashboardMessage", error.message, false);
  }
}

async function uploadDocument() {
  clearMessage("teacherMessage");
  if (currentUser.role !== "teacher") {
    showMessage("teacherMessage", "Solo i docenti possono caricare documenti.", false);
    return;
  }
  try {
    const fileInput = document.getElementById("docFiles");
    const autoSubjectEnabled = document.getElementById("docAutoSubject").checked;
    const selectedFiles = Array.from(fileInput.files || []);
    const mappedSubjects = getFileSubjectMappingValues();
    const subjectId = Number(document.getElementById("docSubject").value);
    if (selectedFiles.length > 0) {
      if (!subjectId && !autoSubjectEnabled) {
        const hasManualSelection = mappedSubjects.some((value) => Number(value) > 0);
        if (!hasManualSelection) {
          showMessage("teacherMessage", "Seleziona prima una materia oppure assegna manualmente la materia ai file.", false);
          return;
        }
      }
      const allowedExtensions = [".pdf", ".docx", ".txt", ".md", ".csv", ".json", ".html", ".htm"];
      const maxBytes = 50 * 1024 * 1024;
      const invalidFiles = [];
      const validFiles = [];
      selectedFiles.forEach((file, index) => {
        const lowerName = String(file.name || "").toLowerCase();
        const isAllowed = allowedExtensions.some((ext) => lowerName.endsWith(ext));
        if (!isAllowed) {
          invalidFiles.push(`${file.name || "file"} (Formato non supportato)`);
          return;
        }
        if (Number(file.size || 0) > maxBytes) {
          invalidFiles.push(`${file.name || "file"} (File troppo grande: max 50MB)`);
          return;
        }
        validFiles.push({
          file,
          subjectId: parseOptionalId(mappedSubjects[index])
        });
      });
      if (validFiles.length === 0) {
        showMessage("teacherMessage", `Nessun file valido da caricare. ${invalidFiles.join(", ")}`, false);
        return;
      }
      const form = new FormData();
      if (subjectId) {
        form.append("subjectId", String(subjectId));
      }
      form.append("uploadedBy", String(currentUser.id));
      form.append("autoAssignSubject", autoSubjectEnabled ? "true" : "false");
      form.append("fileSubjectIds", JSON.stringify(validFiles.map((item) => item.subjectId || null)));
      validFiles.forEach((item) => form.append("files", item.file));
      const result = await fetchJSON("/documents/upload", {
        method: "POST",
        body: form
      });
      const uploadedCount = Number(result.uploadedCount || 0);
      const skippedCount = Number(result.skippedCount || 0) + invalidFiles.length;
      const skippedServer = Array.isArray(result.skipped)
        ? result.skipped.map((item) => `${item.fileName || "file"} (${item.reason || "Errore"})`)
        : [];
      const failedTextItems = [...invalidFiles, ...skippedServer];
      const failedText = failedTextItems.length ? ` Errori: ${failedTextItems.join(", ")}.` : "";
      const assignedSubjects = (Array.isArray(result.uploaded) ? result.uploaded : [])
        .map((item) => `${item.fileName} → ${item.subjectName}`)
        .slice(0, 6);
      showMessage("teacherMessage", `Caricati ${uploadedCount} documenti. Saltati ${skippedCount}.${failedText}`, uploadedCount > 0);
      await loadDocuments();
      await loadAiStatus();
      fileInput.value = "";
    }
  } catch (error) {
    showMessage("teacherMessage", error.message, false);
  }
}

// Export functions for use in other modules
window.api = {
  fetchJSON,
  isSessionError,
  ensureCurrentUserValid,
  loadSubjects,
  loadStats,
  loadQuestions,
  loadDocuments,
  loadAiStatus,
  quickAccess,
  askQuestion,
  clearAllData,
  uploadDocument
};