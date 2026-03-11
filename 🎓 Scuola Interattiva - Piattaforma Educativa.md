# 🎓 Scuola Interattiva - Piattaforma Educativa

Una piattaforma educativa moderna, semplice e affidabile per studenti e docenti con AI integrata.

## ✨ Caratteristiche

- ✅ **Autenticazione Utenti**: Registrazione e login semplici
- ✅ **Chat AI**: Risposte intelligenti con Google Gemini
- ✅ **Gestione Documenti**: Caricamento materiali didattici
- ✅ **Sistema Crediti**: Gamification con XP e badge
- ✅ **Dashboard**: Statistiche e progresso personale
- ✅ **Responsive Design**: Funziona su desktop e mobile
- ✅ **Database SQLite**: Persistenza dati locale
- ✅ **API REST**: Backend Express completo

## 🚀 Quick Start

### 1. Installazione

```bash
# Clona il progetto
cd /home/ubuntu/scuola-interattiva

# Installa dipendenze
npm install

# Copia il file .env
cp .env.example .env
```

### 2. Configurazione

Modifica il file `.env`:

```env
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=your-api-key-here
```

### 3. Avvio

```bash
# Avvia il server
npm run dev

# Il server sarà disponibile su http://localhost:3001
```

### 4. Accesso

Apri il browser e vai a `http://localhost:3001`

## 📁 Struttura Progetto

```
scuola-interattiva/
├── server/
│   ├── index.js          # Server Express principale
│   ├── db.js             # Gestione database SQLite
│   ├── ai.js             # Integrazione Gemini AI
│   └── routes.js         # Definizione API routes
├── public/
│   └── index.html        # Frontend HTML/CSS/JS
├── data/
│   └── scuola.db         # Database SQLite (creato automaticamente)
├── package.json          # Dipendenze Node.js
├── .env.example          # Variabili ambiente
└── README.md             # Questo file
```

## 🔌 API Endpoints

### Autenticazione
- `POST /api/users/register` - Registrazione nuovo utente
- `POST /api/users/login` - Login utente
- `GET /api/users/:id` - Profilo utente

### Materie
- `GET /api/subjects` - Lista materie
- `POST /api/subjects` - Crea nuova materia

### Documenti
- `GET /api/documents` - Lista documenti
- `POST /api/documents` - Carica documento
- `GET /api/documents/:id` - Dettagli documento

### Domande & AI
- `POST /api/questions/ask` - Fai una domanda all'AI
- `GET /api/questions/user/:userId` - Domande utente

### Crediti & Badge
- `GET /api/credits/:userId` - Crediti utente
- `GET /api/badges/:userId` - Badge utente
- `POST /api/badges` - Sblocca badge

### Valutazione
- `POST /api/evaluate` - Valuta risposta

### Statistiche
- `GET /api/stats/user/:userId` - Statistiche utente

## 🎯 Guida Utente

### Per gli Studenti

1. **Registrazione**: Clicca su "Registrati" e compila il modulo
2. **Login**: Accedi con le tue credenziali
3. **Dashboard**: Visualizza i tuoi crediti e streak
4. **Fai Domande**: Seleziona una materia e scrivi la tua domanda
5. **Ricevi Risposte**: L'AI ti risponderà istantaneamente
6. **Guadagna Crediti**: Accumula XP e sblocca badge

### Per i Docenti

1. **Registrazione**: Registrati come "Docente"
2. **Login**: Accedi al tuo account
3. **Carica Documenti**: Vai al "Pannello Docenti"
4. **Seleziona Materia**: Scegli la materia per il documento
5. **Aggiungi Contenuto**: Incolla il testo del documento
6. **Pubblica**: Clicca "Carica Documento"

## 🤖 Integrazione Gemini AI

L'app utilizza Google Gemini per fornire risposte intelligenti:

1. Ottieni un API key da [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Aggiungi la chiave al file `.env`: `GEMINI_API_KEY=your-key`
3. L'AI sarà automaticamente disponibile

## 🗄️ Database

Il progetto usa SQLite per semplicità:

- **Tabelle**: users, subjects, documents, questions, badges, credits
- **File**: `data/scuola.db` (creato automaticamente)
- **Backup**: Copia il file `scuola.db` per fare backup

## 🔧 Troubleshooting

### Porta già in uso
```bash
# Cambia la porta nel file .env
PORT=3002
```

### Errore AI non disponibile
```bash
# Verifica che GEMINI_API_KEY sia configurata nel .env
# Verifica che la chiave sia valida
```

### Database corrotto
```bash
# Elimina il file data/scuola.db e riavvia
rm data/scuola.db
npm run dev
```

## 📚 Tecnologie Utilizzate

- **Backend**: Node.js + Express
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Database**: SQLite3
- **AI**: Google Generative AI (Gemini)
- **API**: REST

## 📝 Licenza

Questo progetto è fornito come-è per scopi educativi.

## 🤝 Supporto

Per problemi o domande, consulta la sezione "Guida" nell'app.

---

**Versione**: 1.0  
**Ultimo Aggiornamento**: Marzo 2024  
**Stato**: Production Ready ✅
