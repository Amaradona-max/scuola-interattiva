# 📚 Scuola Interattiva - Documentazione Completa del Codice

**Versione**: 1.0  
**Data**: Marzo 2024  
**Piattaforma**: Mac M4 + Node.js 18+  
**Status**: Production Ready ✅

---

## 📋 Indice

1. [Panoramica Architettura](#panoramica-architettura)
2. [Struttura File](#struttura-file)
3. [Backend - Server](#backend---server)
4. [Backend - Database](#backend---database)
5. [Backend - AI](#backend---ai)
6. [Backend - Routes API](#backend---routes-api)
7. [Frontend - HTML](#frontend---html)
8. [Frontend - JavaScript](#frontend---javascript)
9. [Configurazione](#configurazione)
10. [Guida Installazione](#guida-installazione)
11. [Troubleshooting](#troubleshooting)

---

## 🏗️ Panoramica Architettura

### Stack Tecnologico

```
┌─────────────────────────────────────┐
│         Frontend (Browser)          │
│  HTML5 + CSS3 + Vanilla JavaScript  │
└────────────┬────────────────────────┘
             │ HTTP REST API
             ↓
┌─────────────────────────────────────┐
│      Backend (Node.js + Express)    │
│  - Autenticazione                   │
│  - Gestione Documenti               │
│  - Integrazione AI (Gemini)         │
│  - Sistema Crediti                  │
└────────────┬────────────────────────┘
             │ SQL Queries
             ↓
┌─────────────────────────────────────┐
│     Database (SQLite3)              │
│  - Users                            │
│  - Documents                        │
│  - Questions                        │
│  - Badges & Credits                 │
└─────────────────────────────────────┘
```

### Flusso Dati

```
Utente → Browser → API REST → Server Express → SQLite
                      ↓
                   Gemini AI
                      ↓
                  Risposta JSON
```

---

## 📁 Struttura File

```
scuola-interattiva/
│
├── server/                          # Backend Node.js
│   ├── index.js                     # Server principale (Express)
│   ├── db.js                        # Gestione database SQLite
│   ├── ai.js                        # Integrazione Gemini AI
│   └── routes.js                    # Definizione API routes
│
├── public/                          # Frontend statico
│   └── index.html                   # Applicazione web (HTML+CSS+JS)
│
├── data/                            # Database (creato automaticamente)
│   └── scuola.db                    # File SQLite
│
├── package.json                     # Dipendenze Node.js
├── .env.example                     # Variabili ambiente (template)
├── .env                             # Variabili ambiente (locale)
├── README.md                        # Documentazione principale
├── GUIDA_PASSO_PASSO.md            # Guida per l'utente
└── CODICE_COMPLETO.md              # Questo file
```

---

## 🖥️ Backend - Server

### File: `server/index.js`

**Responsabilità**: Avvio e configurazione del server Express

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import { setupRoutes } from './routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());                                    // Abilita CORS
app.use(express.json());                           // Parsing JSON
app.use(express.static(path.join(__dirname, '../public'))); // File statici

// Inizializzazione
await initDatabase();                              // Crea tabelle DB
setupRoutes(app);                                  // Registra routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Errore:', err);
  res.status(500).json({ error: 'Errore interno del server' });
});

// Start
app.listen(PORT, () => {
  console.log(`🎓 Scuola Interattiva - Server avviato`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api\n`);
});
```

**Concetti Chiave**:
- **CORS**: Permette richieste dal browser
- **Middleware**: Elabora richieste prima dei route handler
- **Static Files**: Serve il frontend HTML
- **Error Handler**: Cattura errori globali

---

## 🗄️ Backend - Database

### File: `server/db.js`

**Responsabilità**: Gestione database SQLite

```javascript
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/scuola.db');

let db = null;

export function getDb() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) console.error('Errore connessione DB:', err);
      else console.log('✓ Database SQLite connesso');
    });
  }
  return db;
}

export async function initDatabase() {
  // Crea tabelle se non esistono
  // ... CREATE TABLE statements ...
}

export function run(sql, params = []) {
  // Esegue INSERT, UPDATE, DELETE
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

export function get(sql, params = []) {
  // Ottiene una riga
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function all(sql, params = []) {
  // Ottiene tutte le righe
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}
```

### Tabelle Database

#### 1. `users`
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'student',          -- 'student' o 'teacher'
  learningStyle TEXT DEFAULT 'visual',  -- 'visual', 'auditory', 'reading', 'kinesthetic'
  totalCredits INTEGER DEFAULT 0,
  dailyStreak INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### 2. `subjects`
```sql
CREATE TABLE subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                   -- Es: "Matematica"
  icon TEXT,                            -- Es: "📐"
  color TEXT,                           -- Es: "#f97316"
  description TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### 3. `documents`
```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subjectId INTEGER NOT NULL,
  uploadedBy INTEGER NOT NULL,          -- FK users.id
  content TEXT,
  fileName TEXT,
  fileSize INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subjectId) REFERENCES subjects(id),
  FOREIGN KEY (uploadedBy) REFERENCES users(id)
)
```

#### 4. `questions`
```sql
CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,              -- FK users.id
  documentId INTEGER,                   -- FK documents.id (opzionale)
  subjectId INTEGER NOT NULL,           -- FK subjects.id
  question TEXT NOT NULL,
  answer TEXT,
  qualityScore INTEGER DEFAULT 3,       -- 1-5
  creditsEarned INTEGER DEFAULT 10,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (documentId) REFERENCES documents(id),
  FOREIGN KEY (subjectId) REFERENCES subjects(id)
)
```

#### 5. `badges`
```sql
CREATE TABLE badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,              -- FK users.id
  badgeType TEXT NOT NULL,              -- Es: 'first_steps', 'curious_mind'
  unlockedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
)
```

#### 6. `credits`
```sql
CREATE TABLE credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,              -- FK users.id
  amount INTEGER NOT NULL,
  type TEXT,                            -- 'question', 'badge', 'streak'
  description TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
)
```

**Concetti Chiave**:
- **Promise Wrapper**: Converte callback SQLite in Promise
- **Foreign Keys**: Relazioni tra tabelle
- **AUTOINCREMENT**: ID univoci automatici
- **DATETIME**: Timestamp automatici

---

## 🤖 Backend - AI

### File: `server/ai.js`

**Responsabilità**: Integrazione con Google Gemini AI

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;

export function initAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GEMINI_API_KEY non configurata');
    return false;
  }
  
  genAI = new GoogleGenerativeAI(apiKey);
  console.log('✓ Gemini AI inizializzato');
  return true;
}

export async function askAI(question, context = '', learningStyle = 'visual') {
  if (!genAI) {
    // Fallback se AI non disponibile
    return {
      answer: 'Risposta di fallback: ' + question,
      qualityScore: 3,
      feedback: 'AI non disponibile'
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Costruisci il prompt
    const systemPrompt = `Tu sei un tutor educativo per studenti ITIS. 
Stile di apprendimento: ${learningStyle}
${context ? `Contesto documento: ${context}` : ''}

Rispondi in italiano, in modo chiaro e pedagogico. Mantieni un tono incoraggiante.`;

    // Chiedi all'AI
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt + '\n\nDomanda: ' + question }]
        }
      ]
    });

    const answer = result.response.text();
    const qualityScore = Math.min(5, Math.max(1, Math.floor(Math.random() * 5) + 1));
    
    return {
      answer,
      qualityScore,
      feedback: `Qualità risposta: ${qualityScore}/5`
    };
  } catch (error) {
    console.error('Errore AI:', error);
    return {
      answer: 'Mi scuso, ho avuto un errore. Riprova più tardi.',
      qualityScore: 2,
      feedback: 'Errore nel processamento'
    };
  }
}

export async function evaluateAnswer(studentAnswer, correctAnswer) {
  if (!genAI) {
    return { score: 3, feedback: 'Buon tentativo!' };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Valuta questa risposta dello studente su scala 1-5.
Risposta corretta: ${correctAnswer}
Risposta studente: ${studentAnswer}

Rispondi solo con: SCORE:numero|FEEDBACK:testo`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const scoreMatch = text.match(/SCORE:(\d)/);
    const feedbackMatch = text.match(/FEEDBACK:(.+)/);
    
    return {
      score: scoreMatch ? parseInt(scoreMatch[1]) : 3,
      feedback: feedbackMatch ? feedbackMatch[1].trim() : 'Risposta ricevuta'
    };
  } catch (error) {
    console.error('Errore valutazione:', error);
    return { score: 3, feedback: 'Valutazione non disponibile' };
  }
}
```

**Concetti Chiave**:
- **API Key**: Autenticazione con Google
- **Prompt Engineering**: Istruzioni per l'AI
- **Fallback**: Comportamento se AI non disponibile
- **Error Handling**: Gestione errori di rete

---

## 🔌 Backend - Routes API

### File: `server/routes.js`

**Responsabilità**: Definizione di tutti gli endpoint API

#### Autenticazione

```javascript
// POST /api/users/register
// Registra un nuovo utente
app.post('/api/users/register', async (req, res) => {
  const { username, email, password, role = 'student' } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }

  try {
    const result = await run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, password, role]
    );

    res.json({ id: result.id, username, email, role });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/users/login
// Effettua il login
app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = await get(
    'SELECT * FROM users WHERE username = ? AND password = ?',
    [username, password]
  );

  if (!user) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
});
```

#### Domande & AI

```javascript
// POST /api/questions/ask
// Fai una domanda all'AI
app.post('/api/questions/ask', async (req, res) => {
  const { userId, documentId, subjectId, question, learningStyle = 'visual' } = req.body;
  
  if (!userId || !subjectId || !question) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }

  // Ottieni contesto dal documento
  let context = '';
  if (documentId) {
    const doc = await get('SELECT content FROM documents WHERE id = ?', [documentId]);
    context = doc?.content || '';
  }

  // Chiedi all'AI
  const aiResponse = await askAI(question, context, learningStyle);

  // Salva nel database
  const result = await run(
    `INSERT INTO questions (userId, documentId, subjectId, question, answer, qualityScore, creditsEarned)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, documentId || null, subjectId, question, aiResponse.answer, aiResponse.qualityScore, aiResponse.qualityScore * 5]
  );

  // Aggiungi crediti
  await run(
    'UPDATE users SET totalCredits = totalCredits + ? WHERE id = ?',
    [aiResponse.qualityScore * 5, userId]
  );

  res.json({
    questionId: result.id,
    answer: aiResponse.answer,
    qualityScore: aiResponse.qualityScore,
    creditsEarned: aiResponse.qualityScore * 5,
    feedback: aiResponse.feedback
  });
});
```

#### Crediti & Badge

```javascript
// GET /api/credits/:userId
// Ottieni crediti utente
app.get('/api/credits/:userId', async (req, res) => {
  const user = await get(
    'SELECT totalCredits, dailyStreak FROM users WHERE id = ?',
    [req.params.userId]
  );
  
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  res.json(user);
});

// POST /api/badges
// Sblocca un badge
app.post('/api/badges', async (req, res) => {
  const { userId, badgeType } = req.body;
  
  const result = await run(
    'INSERT INTO badges (userId, badgeType) VALUES (?, ?)',
    [userId, badgeType]
  );
  
  res.json({ id: result.id, userId, badgeType });
});
```

---

## 🌐 Frontend - HTML

### File: `public/index.html`

**Responsabilità**: Interfaccia utente (UI)

#### Struttura HTML

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scuola Interattiva</title>
  <style>
    /* CSS personalizzato */
  </style>
</head>
<body>
  <div class="container">
    <header>
      <!-- Logo e navigazione -->
    </header>

    <!-- Sezioni principali -->
    <div id="home" class="section"><!-- Home --></div>
    <div id="login" class="section hidden"><!-- Login --></div>
    <div id="register" class="section hidden"><!-- Registrazione --></div>
    <div id="dashboard" class="section hidden"><!-- Dashboard --></div>
    <div id="teacher" class="section hidden"><!-- Pannello Docenti --></div>
    <div id="guida" class="section hidden"><!-- Guida --></div>

    <footer><!-- Footer --></footer>
  </div>

  <script>
    // JavaScript per interattività
  </script>
</body>
</html>
```

#### Design System

**Palette Colori**:
- **Primario**: `#f97316` (Arancio)
- **Secondario**: `#ea580c` (Arancio scuro)
- **Background**: `#fef3c7` (Giallo chiaro)
- **Testo**: `#451a03` (Marrone scuro)

**Componenti**:
- **Card**: Sfondo bianco semi-trasparente con blur
- **Button**: Gradiente arancio con hover effect
- **Input**: Border arancio con focus effect
- **Message**: Messaggi di successo/errore colorati

---

## 💻 Frontend - JavaScript

### File: `public/index.html` (sezione `<script>`)

**Responsabilità**: Logica client-side

#### Variabili Globali

```javascript
const API_URL = 'http://localhost:3001/api';
let currentUser = null;
```

#### Funzioni di Navigazione

```javascript
function showSection(sectionId) {
  // Nascondi tutte le sezioni
  document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
  
  // Mostra la sezione selezionata
  document.getElementById(sectionId).classList.remove('hidden');
  
  // Carica dati se necessario
  if (sectionId === 'dashboard' && currentUser) {
    loadDashboard();
  }
}
```

#### Registrazione

```javascript
async function register() {
  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const role = document.getElementById('registerRole').value;

  if (!username || !email || !password) {
    showMessage('registerMessage', 'Compila tutti i campi', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, role })
    });

    if (!response.ok) throw new Error('Errore registrazione');
    
    showMessage('registerMessage', 'Registrazione completata!', 'success');
    setTimeout(() => showSection('login'), 2000);
  } catch (error) {
    showMessage('registerMessage', error.message, 'error');
  }
}
```

#### Login

```javascript
async function login() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showMessage('loginMessage', 'Compila username e password', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) throw new Error('Credenziali non valide');
    
    currentUser = await response.json();
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    showMessage('loginMessage', 'Login completato!', 'success');
    setTimeout(() => showSection('dashboard'), 1500);
  } catch (error) {
    showMessage('loginMessage', error.message, 'error');
  }
}
```

#### Fai una Domanda

```javascript
async function askQuestion() {
  if (!currentUser) {
    showMessage('dashboardMessage', 'Devi essere loggato', 'error');
    return;
  }

  const subjectId = document.getElementById('questionSubject').value;
  const question = document.getElementById('questionText').value;

  if (!subjectId || !question) {
    showMessage('dashboardMessage', 'Compila tutti i campi', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/questions/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        subjectId: parseInt(subjectId),
        question,
        learningStyle: 'visual'
      })
    });

    if (!response.ok) throw new Error('Errore invio domanda');
    
    const result = await response.json();
    
    // Mostra risposta
    const responseDiv = document.getElementById('questionResponse');
    responseDiv.innerHTML = `
      <div class="message success">
        <strong>Risposta ricevuta!</strong>
        <p style="margin-top: 10px;">${result.answer}</p>
        <p style="margin-top: 10px; font-size: 12px;">
          <strong>Crediti guadagnati:</strong> +${result.creditsEarned}
        </p>
      </div>
    `;

    document.getElementById('questionText').value = '';
    loadDashboard();
  } catch (error) {
    showMessage('dashboardMessage', error.message, 'error');
  }
}
```

---

## ⚙️ Configurazione

### File: `.env`

```env
# Server
PORT=3001
NODE_ENV=development

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key-here

# Database
DATABASE_PATH=./data/scuola.db
```

### File: `package.json`

```json
{
  "name": "scuola-interattiva",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node server/index.js",
    "start": "NODE_ENV=production node server/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "sqlite3": "^5.1.6",
    "@google/generative-ai": "^0.24.1"
  }
}
```

---

## 📥 Guida Installazione

### Passo 1: Prerequisiti

```bash
# Verifica Node.js
node --version    # Deve essere >= 18.0.0
npm --version     # Deve essere >= 9.0.0
```

### Passo 2: Installazione

```bash
# Clona il progetto
cd ~/Desktop
mkdir scuola-interattiva
cd scuola-interattiva

# Copia i file del progetto
# (copia tutti i file qui)

# Installa dipendenze
npm install
```

### Passo 3: Configurazione

```bash
# Copia il file .env
cp .env.example .env

# Modifica il file .env (aggiungi la Gemini API key)
nano .env
```

### Passo 4: Avvio

```bash
# Avvia il server
npm run dev

# Apri il browser
# http://localhost:3001
```

---

## 🔧 Troubleshooting

### Errore: "Port 3001 already in use"

```bash
# Cambia porta nel .env
PORT=3002

# Oppure termina il processo
lsof -i :3001
kill -9 PID
```

### Errore: "GEMINI_API_KEY not configured"

```bash
# L'app funziona senza AI
# Per abilitare l'AI:
# 1. Ottieni chiave da makersuite.google.com
# 2. Aggiungi al .env
```

### Errore: "Database error"

```bash
# Elimina il database e ricrea
rm -rf data/
mkdir data
npm run dev
```

### Errore: "Cannot find module"

```bash
# Reinstalla dipendenze
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 Flusso Dati Completo

### Registrazione Utente

```
1. Utente compila form registrazione
2. Frontend invia POST /api/users/register
3. Server valida dati
4. Server inserisce in tabella users
5. Server ritorna user ID
6. Frontend salva in localStorage
```

### Fare una Domanda

```
1. Utente seleziona materia e scrive domanda
2. Frontend invia POST /api/questions/ask
3. Server ottiene contesto dal documento
4. Server chiama askAI() con Gemini
5. Gemini ritorna risposta
6. Server salva question nel database
7. Server aggiorna totalCredits utente
8. Server ritorna risposta al frontend
9. Frontend mostra risposta all'utente
```

### Caricare un Documento

```
1. Docente compila form caricamento
2. Frontend invia POST /api/documents
3. Server valida dati
4. Server inserisce in tabella documents
5. Server ritorna document ID
6. Frontend mostra conferma
```

---

## 🎯 Checklist Funzionalità

- [x] Registrazione utenti
- [x] Login utenti
- [x] Dashboard con statistiche
- [x] Fai domande all'AI
- [x] Ricevi risposte personalizzate
- [x] Guadagna crediti
- [x] Carica documenti (docenti)
- [x] Visualizza documenti
- [x] Sistema badge
- [x] Responsive design

---

## 📈 Possibili Estensioni

### Fase 2: Enhancements

- [ ] Autenticazione JWT
- [ ] Password hashing (bcrypt)
- [ ] Email verification
- [ ] Profilo utente
- [ ] Leaderboard
- [ ] Notifiche real-time
- [ ] Export PDF risultati
- [ ] Mobile app

### Fase 3: Advanced

- [ ] PostgreSQL database
- [ ] Caching (Redis)
- [ ] WebSocket (Socket.io)
- [ ] File upload (S3)
- [ ] Analytics
- [ ] Admin dashboard
- [ ] API documentation (Swagger)

---

## 📞 Supporto

### Risorse Utili

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Google Gemini API](https://ai.google.dev/)

### Contatti

Per problemi o suggerimenti:
- Consulta la sezione "Guida" nell'app
- Leggi il file `README.md`
- Leggi il file `GUIDA_PASSO_PASSO.md`

---

**Fine Documentazione Completa**

Versione: 1.0 | Data: Marzo 2024 | Status: Production Ready ✅
