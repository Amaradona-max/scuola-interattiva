# 📖 Guida Passo-Passo: Scuola Interattiva

Una guida completa e semplice per configurare e utilizzare Scuola Interattiva su Mac M4.

---

## 🎯 Indice

1. [Prerequisiti](#prerequisiti)
2. [Installazione](#installazione)
3. [Configurazione](#configurazione)
4. [Avvio](#avvio)
5. [Primo Accesso](#primo-accesso)
6. [Utilizzo Studenti](#utilizzo-studenti)
7. [Utilizzo Docenti](#utilizzo-docenti)
8. [Risoluzione Problemi](#risoluzione-problemi)

---

## 🔧 Prerequisiti

Prima di iniziare, assicurati di avere:

### 1. Node.js Installato

Verifica se hai Node.js:

```bash
node --version
npm --version
```

Se non lo hai, scaricalo da [nodejs.org](https://nodejs.org/) (versione LTS consigliata).

### 2. Editor di Testo

Consigliato: **Visual Studio Code** (gratuito)
- Scarica da [code.visualstudio.com](https://code.visualstudio.com/)

### 3. Terminale

Su Mac, usa **Terminal** (preinstallato) o **iTerm2** (migliore)

### 4. Google Gemini API Key (Opzionale ma Consigliato)

L'app funziona anche senza, ma per avere l'AI:

1. Vai a [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Clicca "Create API Key"
3. Copia la chiave (la userai dopo)

---

## 📥 Installazione

### Passo 1: Scarica il Progetto

Apri il Terminale e esegui:

```bash
# Vai nella directory dove vuoi il progetto
cd ~/Desktop

# Crea la cartella del progetto
mkdir scuola-interattiva
cd scuola-interattiva
```

### Passo 2: Copia i File

Copia tutti i file del progetto in questa cartella:
- `package.json`
- `server/` (cartella)
- `public/` (cartella)
- `.env.example`
- `README.md`

### Passo 3: Installa le Dipendenze

Nel Terminale, nella cartella del progetto:

```bash
npm install
```

Questo scaricherà tutte le librerie necessarie (può durare 1-2 minuti).

---

## ⚙️ Configurazione

### Passo 1: Crea il File .env

Nel Terminale:

```bash
cp .env.example .env
```

### Passo 2: Modifica il File .env

Apri il file `.env` con un editor di testo:

```bash
# Usa VS Code
code .env

# Oppure usa nano (editor da terminale)
nano .env
```

Dovresti vedere:

```env
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=your-gemini-api-key-here
DATABASE_PATH=./data/scuola.db
```

### Passo 3: Aggiungi la Gemini API Key (Opzionale)

Se hai ottenuto una API key:

1. Sostituisci `your-gemini-api-key-here` con la tua chiave
2. Salva il file

Se non hai una API key, lascia il valore di default. L'app funzionerà comunque.

### Passo 4: Salva il File

Se usi `nano`:
- Premi `Ctrl + X`
- Premi `Y` per confermare
- Premi `Enter`

---

## 🚀 Avvio

### Passo 1: Avvia il Server

Nel Terminale, nella cartella del progetto:

```bash
npm run dev
```

Dovresti vedere:

```
🎓 Scuola Interattiva - Server avviato
📍 http://localhost:3001
🔗 API: http://localhost:3001/api
```

### Passo 2: Apri il Browser

Apri il tuo browser preferito (Chrome, Safari, Firefox) e vai a:

```
http://localhost:3001
```

Dovresti vedere la home page di Scuola Interattiva!

### Passo 3: Mantieni il Server Attivo

**Importante**: Non chiudere il Terminale! Il server deve rimanere attivo.

Per fermare il server: Premi `Ctrl + C` nel Terminale.

---

## 👤 Primo Accesso

### Passo 1: Registrazione

1. Clicca su **"Accedi o Registrati"** nella home page
2. Clicca su **"Registrati"**
3. Compila il modulo:
   - **Username**: Scegli un nome utente (es: `mario123`)
   - **Email**: La tua email (es: `mario@example.com`)
   - **Password**: Una password sicura
   - **Ruolo**: Scegli "Studente" o "Docente"
4. Clicca **"Registrati"**

### Passo 2: Login

1. Clicca su **"Accedi"**
2. Inserisci username e password
3. Clicca **"Accedi"**

Perfetto! Sei dentro! 🎉

---

## 📚 Utilizzo Studenti

### Come Fare una Domanda

1. Accedi al tuo account
2. Vai a **"Dashboard"**
3. Nella sezione "Fai una Domanda":
   - **Materia**: Seleziona una materia (es: Matematica)
   - **La tua Domanda**: Scrivi la tua domanda (es: "Come si risolve un'equazione di secondo grado?")
4. Clicca **"Invia Domanda"**

### Cosa Succede

1. L'AI elabora la tua domanda (1-2 secondi)
2. Ricevi una risposta dettagliata
3. Guadagni crediti (XP)
4. La domanda viene salvata nella tua cronologia

### Guadagnare Crediti

- Ogni domanda: **5-25 crediti** (dipende dalla qualità della risposta)
- Streak giornaliero: **10 crediti al giorno** (se accedi ogni giorno)
- Badge sbloccati: **50-100 crediti**

---

## 👨‍🏫 Utilizzo Docenti

### Come Caricare un Documento

1. Accedi come Docente
2. Vai a **"Docenti"** (Pannello Docenti)
3. Compila il modulo:
   - **Materia**: Seleziona la materia
   - **Titolo Documento**: Es: "Lezione di Storia - Il Rinascimento"
   - **Contenuto**: Incolla il testo del documento
4. Clicca **"Carica Documento"**

### Cosa Possono Fare gli Studenti

Gli studenti potranno:
- Visualizzare i tuoi documenti
- Fare domande basate su questi documenti
- Ricevere risposte AI più precise (perché contestuali)

### Esempio di Documento

```
Titolo: Lezione di Matematica - Equazioni di Secondo Grado

Contenuto:
Un'equazione di secondo grado ha la forma: ax² + bx + c = 0

La formula risolutiva è:
x = (-b ± √(b² - 4ac)) / 2a

Dove:
- a, b, c sono coefficienti
- Δ = b² - 4ac è il discriminante

Se Δ > 0: due soluzioni reali
Se Δ = 0: una soluzione reale
Se Δ < 0: nessuna soluzione reale
```

---

## 🔍 Risoluzione Problemi

### Problema: "Connessione Rifiutata"

**Causa**: Il server non è avviato

**Soluzione**:
```bash
# Nel Terminale, nella cartella del progetto
npm run dev
```

### Problema: "Porta 3001 già in uso"

**Causa**: Un altro programma usa la porta 3001

**Soluzione 1**: Cambia porta nel `.env`
```env
PORT=3002
```

**Soluzione 2**: Termina il processo che usa la porta
```bash
# Trova il processo
lsof -i :3001

# Termina il processo (sostituisci PID con il numero)
kill -9 PID
```

### Problema: "GEMINI_API_KEY non configurata"

**Causa**: Non hai aggiunto la API key

**Soluzione**: L'app funziona comunque, ma senza AI avanzata. Se vuoi l'AI:
1. Ottieni una chiave da [makersuite.google.com](https://makersuite.google.com/app/apikey)
2. Aggiungi al file `.env`

### Problema: "Database non trovato"

**Causa**: La cartella `data/` non esiste

**Soluzione**: Viene creata automaticamente al primo avvio. Se il problema persiste:
```bash
mkdir -p data
npm run dev
```

### Problema: "npm: command not found"

**Causa**: Node.js non è installato

**Soluzione**: Scarica e installa Node.js da [nodejs.org](https://nodejs.org/)

### Problema: "Errore di connessione al database"

**Causa**: Permessi insufficienti

**Soluzione**:
```bash
# Dai permessi alla cartella data
chmod -R 755 data/
npm run dev
```

### Problema: "La pagina non carica"

**Causa**: Browser cache

**Soluzione**:
1. Premi `Cmd + Shift + R` (refresh forzato)
2. Oppure apri una finestra in incognito
3. Oppure svuota la cache del browser

---

## 💡 Tips & Tricks

### Tip 1: Crea Materie di Prova

Prima di usare l'app, crea alcune materie di prova:

1. Apri il Terminale
2. Usa curl per creare materie:

```bash
curl -X POST http://localhost:3001/api/subjects \
  -H "Content-Type: application/json" \
  -d '{"name":"Matematica","icon":"📐","color":"#f97316"}'

curl -X POST http://localhost:3001/api/subjects \
  -H "Content-Type: application/json" \
  -d '{"name":"Italiano","icon":"📖","color":"#ea580c"}'

curl -X POST http://localhost:3001/api/subjects \
  -H "Content-Type: application/json" \
  -d '{"name":"Inglese","icon":"🌍","color":"#fb923c"}'
```

### Tip 2: Usa il Terminale per Test

Testa l'API direttamente:

```bash
# Verifica che il server è attivo
curl http://localhost:3001/api/health

# Dovresti vedere: {"status":"ok","timestamp":"..."}
```

### Tip 3: Backup Dati

Il database è in `data/scuola.db`. Per fare backup:

```bash
cp data/scuola.db data/scuola.db.backup
```

### Tip 4: Modalità Sviluppo

Per sviluppare e testare, usa:

```bash
npm run dev
```

Il server si riavvierà automaticamente se cambi i file.

---

## 📞 Supporto

### Domande Frequenti

**D: Posso usare l'app su mobile?**
R: Sì! L'app è responsive e funziona su mobile, tablet e desktop.

**D: Posso usare l'app offline?**
R: No, al momento richiede una connessione internet per l'AI.

**D: Come cambio la password?**
R: Attualmente non c'è un'opzione. Contatta un amministratore.

**D: Posso esportare i miei dati?**
R: I dati sono nel file `data/scuola.db`. Puoi fare backup copiando il file.

**D: Quanti utenti può supportare?**
R: SQLite supporta fino a migliaia di utenti. Per milioni, considera PostgreSQL.

### Contatti

Per problemi o suggerimenti:
- Consulta la sezione "Guida" nell'app
- Leggi il file `README.md`

---

## ✅ Checklist di Configurazione

Usa questa checklist per verificare che tutto è configurato correttamente:

- [ ] Node.js installato (`node --version`)
- [ ] Progetto scaricato e cartelle create
- [ ] Dipendenze installate (`npm install`)
- [ ] File `.env` creato
- [ ] Server avviato (`npm run dev`)
- [ ] Browser aperto su `http://localhost:3001`
- [ ] Registrazione completata
- [ ] Login completato
- [ ] Dashboard caricata
- [ ] Materie visibili
- [ ] Prima domanda inviata

Se tutti i punti sono spuntati, sei pronto! 🎉

---

**Fine Guida Passo-Passo**

Versione: 1.0 | Data: Marzo 2024 | Piattaforma: Mac M4
