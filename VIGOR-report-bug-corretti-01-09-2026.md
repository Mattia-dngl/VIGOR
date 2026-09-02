# VIGOR — Report bug corretti (01/09/2026)

Elenco separato, dedicato solo ai bug trovati e corretti durante la revisione generale dell'app richiesta il 01/09/2026 (le proposte di miglioramento sono nel report a parte, `VIGOR-report-audit-01-09-2026.md`). Per ogni bug: dove si trova, cosa succedeva in pratica, come è stato corretto, come è stato verificato. Modifiche sul branch `claude/app-audit-improvements-o9xw8u`, commit `05e8168`.

Legenda gravità: 🔴 alta (sicurezza/accesso) · 🟠 media (affidabilità/qualità) · 🟡 bassa (pulizia).

---

## 🔴 1. Il recupero password locale scavalcava un account bloccato o non approvato

**File:** `js/onboarding/recupero-codici.js`, gestore di `recuperoBtn` (righe 83-113 dopo la modifica)

**Cosa succedeva:** nell'app offline (profili sul telefono, senza account online), il pulsante "Password dimenticata?" nella schermata di accesso apre un modulo dove si inserisce il codice di recupero e si sceglie una nuova password. Il codice controllava correttamente il codice di recupero e la nuova password, la salvava, e chiamava subito `enterProfile(prof.id)` per far entrare nell'app.

Il problema: **non veniva mai controllato se quel profilo fosse `bloccato` (sospeso da un amministratore) o non ancora `approvato`** — gli stessi due controlli che invece `trySubmitPassword()` (il percorso normale con la password) esegue sempre prima di far entrare qualcuno. Chi conosceva il proprio codice di recupero (annotato al momento della creazione del profilo) poteva quindi:
1. farsi sospendere l'account da un amministratore,
2. andare su "Password dimenticata?", inserire il proprio codice e una password qualunque,
3. entrare comunque nell'app, blocco bypassato.

Stesso discorso per un account appena creato e ancora "in attesa di approvazione": con questo percorso entrava subito, senza aspettare nessuno.

**Corretto:** dopo aver verificato codice e nuova password, ora si applicano — nello stesso ordine di `trySubmitPassword()` — i controlli su `prof.bloccato` (mostra la schermata dedicata "Account bloccato", con l'unica via d'uscita "Torna alla lista profili") e `prof.approvato` (mostra l'avviso "non ancora approvato" e riporta alla lista). La password viene comunque aggiornata (il codice era corretto), ma l'ingresso resta negato.

**Verificato con:** 3 test nuovi in `test/recupero-codice-bloccato.test.js` — profilo bloccato, profilo mai approvato, profilo regolare (verifica che il caso normale continui a funzionare).

---

## 🔴 2. HTML/script injection diffuso — un nome scelto in registrazione poteva eseguire codice nel browser di chi lo legge

**File principale:** `js/core/costanti.js`, funzione `escapeAttr` — più i punti che non la usavano affatto: `js/ui/profile-gate.js`, `js/admin/gestione-utenti.js` (variante online e offline), `js/pt/pt-area.js`, e `customConfirm()` in `js/core/stato.js`.

**Cosa succedeva:** `escapeAttr()` è la funzione richiamata in oltre 65 punti del codice per inserire in sicurezza un testo (nome, nota, messaggio...) dentro l'HTML della pagina. Il suo codice era:

```js
function escapeAttr(s){ return String(s==null ? "" : s).replace(/"/g,'&quot;'); }
```

Sostituiva **solo il carattere `"`**. Non toccava `<` e `>` — che sono i due caratteri che aprono un vero tag HTML. Un testo come `<img src=x onerror="rubaDatiOVattene()">` scritto in un campo qualsiasi non veniva mostrato come stringa: **il browser lo interpretava come un tag `<img>` vero e lo eseguiva**, appena qualcuno apriva la schermata che lo mostra.

Il punto più diretto, legato proprio a Registrati: il modulo di creazione profilo (`js/ui/profile-gate.js`, `createProfileBtn`) accetta qualunque nome (solo `.trim()`, nessuna validazione di contenuto). Quel nome finiva, **senza alcun escape** (nemmeno quello rotto):
- nella **lista profili** mostrata nella schermata di accesso — visibile a chiunque apra l'app, ancora prima del login;
- nel **pannello "Gestione utenti"** che un amministratore usa per approvare i nuovi account — eseguito proprio nella sessione dell'amministratore, nel momento in cui guarda le richieste in attesa.

In pratica: bastava registrarsi con un nome "ostile" per far eseguire codice nel browser di chiunque aprisse la lista profili o il pannello di approvazione — inclusa la persona con i permessi di amministratore.

Altri punti colpiti dallo stesso difetto di fondo (uso di `escapeAttr()` per inserire testo, non solo attributi, mentre la funzione proteggeva solo gli attributi):
- messaggi di chat PT↔cliente (`js/pt/pt-collegamento.js`),
- nomi di esercizi, note, giorni della scheda (`js/registra/registra.js`, `js/scheda/scheda-editor.js`),
- ogni popup di conferma dell'app (`customConfirm()` in `js/core/stato.js`, che inseriva il messaggio ricevuto direttamente in HTML senza alcun escape) — usato per decine di messaggi come "Eliminare il profilo di X?", "Bloccare l'accesso a X?", che contengono nome/email di un profilo.

**Corretto:**
- `escapeAttr()` ora sostituisce tutti e cinque i caratteri speciali HTML (`& < > " '`), il che la rende sicura sia nei punti dove era già usata (dentro attributi `="..."`) sia dove viene usata per inserire testo visibile — un'unica modifica che mette in sicurezza automaticamente tutti i 65+ punti dell'app che già la richiamavano, chat PT↔cliente incluse.
- `customConfirm()` ora applica l'escape al messaggio prima di costruire l'HTML del popup (con un piccolo effetto collaterale positivo: gli "a capo" scritti con `\n` nei messaggi ora si vedono davvero, prima venivano collassati in uno spazio dall'HTML).
- Aggiunto l'escape mancante (prima assente del tutto) in: lista profili locali, pannello "Gestione utenti" (sia la versione locale sia quella online), lista "Scegli il tuo Personal Trainer" e le card di richieste/clienti nell'area riservata PT.

**Cosa resta aperto (non corretto in questo giro):** alcune schermate secondarie del pannello PT — dettaglio cliente: nome della scheda assegnata, note su un esercizio, testo del giorno libero in dieta — interpolano ancora testo del cliente senza `escapeAttr()`. Il rischio è più contenuto (serve un rapporto PT↔cliente già accettato da entrambi, non basta essersi registrati), ma andrebbero chiuse con lo stesso pattern in un prossimo giro.

**Verificato con:** 5 test nuovi in `test/escape-html-sicurezza.test.js` — usano un payload `<img src=x onerror=alert(1)>` e controllano che non produca mai un tag `<img>` reale nel DOM, né nella lista profili, né nel pannello admin, né in un popup di conferma; più un test dedicato che verifica che gli "a capo" restino leggibili.

---

## 🟠 3. `npm test` restava bloccato per sempre, senza mai dare un esito

**File:** `package.json` (script `test`)

**Cosa succedeva:** diversi test avviano il cronometro dell'allenamento (che usa `setInterval` per aggiornarsi ogni secondo) ma non lo fermano esplicitamente prima di chiudere la finestra di test. L'interval restava attivo, e Node.js — per regola — non termina un processo finché ci sono timer ancora "vivi". Il comando `npm test`, così come definito nel progetto, si bloccava quindi **a tempo indeterminato**, senza mai stampare un risultato: chiunque (persona o sistema automatico) lo avesse lanciato sarebbe rimasto in attesa per sempre, credendo magari a un problema della propria macchina.

Non è legato a un mio cambiamento: succedeva già sul branch principale, prima di qualunque modifica di questo giro — l'ho verificato ripristinando temporaneamente il codice originale.

**Corretto:** aggiunta l'opzione `--test-force-exit` allo script `test` in `package.json`. Node.js ora termina il processo appena tutti i test hanno dato il proprio esito, anche se restano timer di sfondo non ripuliti — la suite completa (264 test) impiega circa 60 secondi e restituisce sempre un risultato chiaro.

**Verificato con:** l'intera suite (`npm test`) eseguita più volte fino alla fine, con esito 264/264 verdi.

---

## 🟡 4. Due test che dipendevano dal giorno della settimana reale del computer

**File:** `test/banner-stato-registra-31-08.test.js`, `test/dieta-fase3-31-08.test.js`

**Cosa succedeva:** entrambi i test costruivano una scheda con un giorno fisso (es. "previsto di Lunedì") ma lasciavano che l'app leggesse la **data vera** del computer su cui girava il test, invece di una data fissa. Risultato: il test passava o falliva **a seconda di che giorno della settimana capitava di lanciarlo** — il 01/09/2026 (martedì) entrambi fallivano, non per un problema dell'app ma perché quel giorno il calcolo "oggi" non coincideva più con l'ipotesi scritta nel test. Gli stessi autori del progetto conoscevano già questa categoria di errore (c'è un commento esplicito in `test/registra-cronometro-navigazione-31-08.test.js` che la spiega), ma è sfuggita in questi due file.

Il rischio pratico: con test così, una vera regressione futura in quelle due zone (banner di stato in "Registra", piano alimentare del PT mostrato "per oggi" in Dieta) avrebbe potuto passare inosservata quanto un normale fallimento "capita solo di martedì", inducendo a ignorarlo.

**Corretto:** entrambi i test ora calcolano il giorno della settimana **reale** al momento dell'esecuzione e costruiscono la scheda/dieta di conseguenza, così il risultato non dipende più da quando vengono lanciati.

**Verificato con:** gli stessi due test, ora verdi indipendentemente dal giorno.

---

## 🟡 5. File di test per una funzione (carosello esercizi) rimossa da tempo

**File:** `test/carosello-esercizi.test.js` (rimosso)

**Cosa succedeva:** l'app aveva in passato un carosello per mostrare un esercizio alla volta in "Registra"; è stato sostituito il 31/08/2026 con una lista verticale (tutti gli esercizi visibili insieme), su richiesta esplicita ("toglierei il carosello... così da non avere bug di nessun tipo"). Il file di test che copriva il vecchio carosello avrebbe dovuto essere eliminato in quel momento — il file che lo sostituisce (`test/esercizi-lista-verticale-31-08.test.js`) lo dice esplicitamente nel proprio commento iniziale ("sostituisce... vedi il vecchio file, rimosso") — ma non era mai stato tolto per davvero: 8 test rompevano la suite ad ogni esecuzione, testando funzioni (`inizializzaCarosello`, `mostraEsercizio`...) che non esistono più nel codice.

**Corretto:** rimosso il file. La copertura di quella funzionalità resta intatta in `test/esercizi-lista-verticale-31-08.test.js`.

---

## Riepilogo

| # | Bug | Gravità | File principale | Test |
|---|-----|---------|------------------|------|
| 1 | Recupero password bypassa blocco/approvazione | 🔴 | `js/onboarding/recupero-codici.js` | `recupero-codice-bloccato.test.js` |
| 2 | HTML/script injection (`escapeAttr` e `customConfirm`) | 🔴 | `js/core/costanti.js`, `js/core/stato.js` + 4 file | `escape-html-sicurezza.test.js` |
| 3 | `npm test` bloccato per sempre | 🟠 | `package.json` | intera suite |
| 4 | Test legati al giorno reale della settimana | 🟡 | 2 file di test | stessi 2 file |
| 5 | Test per funzione già rimossa | 🟡 | `test/carosello-esercizi.test.js` | rimosso |

**Esito finale:** suite completa **264/264 test verdi**, ~60 secondi. Nessuna regressione rilevata sulle funzionalità esistenti.
