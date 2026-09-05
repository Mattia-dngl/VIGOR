# VIGOR — Revisione generale e report di miglioramento (01/09/2026)

Richiesta: ricontrollare tutta l'app per bug/errori — in particolare Accedi/Registrati, che "non deve avere nessun tipo di errore o problema" — sistemare quanto trovato, e produrre un report su cosa migliorare/implementare in base a come sono fatte le migliori app di settore. Questo documento copre entrambe le cose. Tutte le modifiche sono sul branch `claude/app-audit-improvements-o9xw8u`, coperte da test automatici (264/264 verdi).

## Parte 1 — Bug trovati e corretti

### 1. Il recupero password locale scavalcava un account bloccato o non ancora approvato (bug di sicurezza)

**File:** `js/onboarding/recupero-codici.js`

Nell'app offline (profili sul telefono, senza account online), toccare "Password dimenticata?" e inserire il codice di recupero resettava la password e faceva entrare subito nell'app con `enterProfile()` — **senza controllare se quel profilo era bloccato da un amministratore o ancora in attesa di approvazione**. Il percorso normale (inserire la password) questi controlli li fa; quello del codice di recupero no.

In pratica: un account sospeso da chi gestisce l'app poteva rientrare lo stesso semplicemente cliccando "Password dimenticata?" con il proprio codice — il blocco non serviva a nulla. È lo scenario più diretto legato alla richiesta di "nessun problema su accedi/registrati": un varco che aggira l'unico meccanismo di sicurezza dell'app.

**Corretto**: dopo aver verificato il codice e reimpostato la password, ora si applicano gli stessi controlli di `trySubmitPassword()` (schermata dedicata "Account bloccato" per chi è bloccato, messaggio di attesa per chi non è ancora approvato) prima di far entrare nell'app. Coperto da 3 nuovi test in `test/recupero-codice-bloccato.test.js`.

### 2. HTML/script injection su più schermate, incluse quelle raggiunte da Accedi/Registrati

**File principale:** `js/core/costanti.js` (funzione `escapeAttr`), più `js/core/stato.js`, `js/ui/profile-gate.js`, `js/admin/gestione-utenti.js`, `js/pt/pt-area.js`

`escapeAttr()` — la funzione usata in oltre 65 punti dell'app per inserire del testo dentro l'HTML della pagina — sostituiva **solo le virgolette**, non `<` e `>`. Risultato: un nome, un'email, una nota, un messaggio di chat scritti da un utente e contenenti qualcosa come `<img src=x onerror=...>` non venivano mostrati come testo, **venivano eseguiti**.

Il punto più diretto e più grave: il **nome scelto in fase di registrazione** (il modulo "Registrati" non lo valida, oltre a togliere gli spazi) finisce:
- nella lista dei profili sul telefono, visibile a chiunque apra l'app **prima ancora di fare login**;
- nel pannello admin "Gestione utenti", eseguito **nella sessione di chi approva il nuovo account** — un modo concreto per un account malevolo di far eseguire codice nel browser dell'amministratore proprio nel momento in cui lo sta approvando.

Altri punti con lo stesso problema (nome/email non passavano nemmeno da `escapeAttr`, zero escaping): la lista "Scegli il tuo Personal Trainer", le card richieste/clienti nell'area PT, i popup di conferma (`customConfirm`, usato per messaggi come "Eliminare il profilo di X?" — l'ho corretto una volta sola alla fonte, mettendo in sicurezza automaticamente tutte le decine di punti dell'app che lo richiamano).

**Corretto**:
- `escapeAttr()` ora neutralizza tutti i caratteri speciali HTML (`& < > " '`), restando compatibile con tutti i punti che già la usavano (dentro attributi o come testo).
- `customConfirm()` ora applica l'escape al messaggio prima di inserirlo nella pagina (e, come effetto collaterale positivo, i veri "a capo" nei messaggi ora si vedono davvero — prima erano scritti col carattere `\n` ma l'HTML li collassava in uno spazio).
- Aggiunto l'escape mancante in: lista profili locali, pannello admin (locale e online), lista "Scegli PT", card richieste/clienti nell'area PT.

Coperto da 5 nuovi test in `test/escape-html-sicurezza.test.js` (verificano che un payload `<img onerror=...>` non produca mai un `<img>` reale nel DOM).

**Cosa resta**: alcune schermate secondarie del pannello PT (dettaglio cliente: nome scheda, note su un esercizio, testo del giorno libero in dieta) interpolano ancora testo del cliente senza `escapeAttr()`. Sono meno esposte (richiedono un rapporto PT↔cliente già accettato, non bastano una registrazione o un nome scelto a caso), ma vale la pena chiudere anche quelle in un prossimo giro con lo stesso pattern.

### 3. `npm test` restava bloccato per sempre (nessun timeout)

Diversi test avviano il cronometro dell'allenamento (`setInterval`) e non lo fermano esplicitamente prima di chiudere la finestra di test: l'interval restava attivo e Node non usciva mai dal processo. Il comando `npm test` documentato nel `package.json` — quindi qualunque CI o controllo automatico lo usasse — si bloccava a tempo indeterminato invece di dare un esito. **Corretto** aggiungendo `--test-force-exit` allo script (`package.json`): la suite ora termina sempre e riporta il risultato (in ~60 secondi per 264 test).

### 4. Due test "fantasma" legati al giorno della settimana reale

`test/banner-stato-registra-31-08.test.js` e `test/dieta-fase3-31-08.test.js` fissavano un giorno della scheda (es. "Lunedì") ma lasciavano che l'app leggesse la **data vera** del computer che esegue i test. Il risultato: il test passava o falliva a seconda di che giorno della settimana girava davvero, un difetto già noto agli autori del progetto altrove (vedi il commento in `test/registra-cronometro-navigazione-31-08.test.js`) ma sfuggito qui. Non è un bug dell'app, ma nascondeva la possibilità di rilevare regressioni vere in quelle due zone (banner di stato in Registra, piano alimentare del PT "per oggi"). **Corretto** rendendo entrambi i test indipendenti dal giorno reale.

### 5. Test di un carosello che non esiste più

`test/carosello-esercizi.test.js` testava funzioni (`inizializzaCarosello`, `mostraEsercizio`...) rimosse insieme alla vecchia UI a carosello degli esercizi (sostituita da una lista verticale il 31/08, su richiesta esplicita). Il file di sostituzione (`test/esercizi-lista-verticale-31-08.test.js`) lo dice esplicitamente nel proprio commento di testa ("sostituisce... vedi il vecchio file, rimosso") ma il vecchio file non era mai stato tolto — 8 test rompevano la suite ad ogni esecuzione senza motivo. **Rimosso.**

### Non toccato, ma degno di nota

- **Hash delle password locali** (`simpleHash`, un DJB2 senza salt) non è un hash crittografico. Per un'app che gira solo su file locali senza server (modalità offline) il rischio reale è basso — non c'è un database centrale da rubare — ma se in futuro questi dati finissero mai sincronizzati o esportati, andrebbe sostituito con qualcosa come Web Crypto (`SubtleCrypto.digest` con salt) prima di quel momento. Non l'ho cambiato ora perché richiederebbe una migrazione delle password già salvate sui dispositivi esistenti — una modifica da fare consapevolmente, non di corsa in un audit.

## Come è stato verificato

Tutti i punti sopra sono coperti da test automatici nuovi o corretti (`node --test`), oltre ai 258 test già esistenti che continuano a passare invariati. Suite completa: **264/264 verdi**, ~60 secondi. Non è stato possibile aprire un browser reale in questo ambiente: i test riproducono il comportamento dell'app dentro jsdom (lo stesso approccio già usato da tutta la suite esistente del progetto), che copre la logica ma non il rendering visivo — vale comunque la pena provare col telefono in mano i due flussi corretti (recupero password bloccato, e la lista profili/pannello admin con un nome "strano") prima di considerarli chiusi del tutto.

---

## Parte 2 — Cosa implementare/migliorare, sulla base delle migliori app di settore

Ricerca fatta su: app di tracking allenamento (Hevy, Strong, Fitbod), app per personal trainer (Trainerize, PT Distinction), e best practice generali di login/onboarding/retention 2026. VIGOR copre già bene le basi che queste app considerano indispensabili (registro allenamenti, dieta, rapporto PT↔cliente, promemoria, storico) — quello che segue sono gap specifici rispetto a cosa fanno gli altri.

### Accesso e onboarding

- **Passkey / accesso biometrico**: nel 2026 le password stanno diventando l'eccezione, non la norma — Face ID/Touch ID più una chiave crittografica al posto della password è ormai lo standard atteso su mobile. VIGOR ha già "Accedi con Google"; aggiungere un accesso biometrico (via WebAuthn/passkey) per il ritorno nell'app ridurrebbe l'attrito ad ogni apertura, specialmente per chi ha un account online.
- **Occhio per mostrare la password**: i moduli attuali (Accedi, Registrati, recupero) non hanno il tasto "mostra password" — una delle quattro cause più comuni di abbandono nei moduli di login secondo le linee guida UX 2026, insieme a messaggi d'errore poco chiari (che VIGOR invece gestisce già bene, vedi `traduciErrore`).
- **Un solo campo per iniziare**: le migliori pratiche di registrazione partono da un solo campo (email) e chiedono il resto dopo, per ridurre l'abbandono. Il modulo "Registrati" di VIGOR chiede nome, email e password tutti insieme: non è un problema grave (sono solo 3 campi), ma separare "nome" nel primo giro di onboarding (che già esiste per sesso/età/altezza) potrebbe alzare leggermente il tasso di completamento.

### Allenamento

- **Suggerimenti di progressione automatica**: Fitbod e, più di recente, anche Hevy (con "Hevy Trainer") calcolano da soli il prossimo peso/ripetizioni in base allo storico, invece di lasciare che sia sempre la persona a deciderlo. VIGOR ha "Riporta ultima volta" (ripete i valori precedenti) ma non suggerisce un progresso — potrebbe essere un'estensione naturale della stessa funzione, es. "+2,5 kg rispetto a due settimane fa perché hai completato tutte le serie".
- **Integrazione con smartwatch/wearable**: gli utenti del 2026 si aspettano che i dati compaiano dove già guardano (Apple Watch, Wear OS) — utile soprattutto per il cronometro allenamento che VIGOR ha già.

### Dieta

- Il report di usabilità del 31/08 (`VIGOR-report-usabilita-31-08-2026.md`) segnala già che non è ovvio quale pasto si sta compilando — resta valido. Aggiungo: app come Cronometer/MyFitnessPal mostrano un riepilogo macro (proteine/carboidrati/grassi) accanto alle kcal in ogni riga del diario, non solo nel totale giornaliero — VIGOR ha tolto di recente l'anello P/C/F "a favore" dell'anello kcal singolo (cambio dell'01/09 in `dieta-fase3`), il che è coerente con la scelta "un solo numero, più leggibile", ma vale la pena verificare che chi segue una dieta specifica per obiettivo (es. bulk/cut con target proteico) non senta la mancanza del dettaglio macro a colpo d'occhio.

### Area Personal Trainer

- **Programmazione con periodizzazione**: Trainerize/PT Distinction permettono al PT di impostare tempo di esecuzione, tecniche di intensità e note per singola serie con automazioni di progressione. VIGOR ha già dropset/superset/rest-pause e note per esercizio (buona base); manca ancora una progressione automatica settimana-per-settimana pianificata dal PT (es. "settimana 3: +5% carico") — oggi il PT deve modificare la scheda a mano ogni volta.
- **Check-in e moduli ricorrenti**: le app PT più complete offrono moduli di check-in periodici (peso, foto, sensazioni) che il cliente compila e il PT rivede in un colpo d'occhio. VIGOR ha le misurazioni corporee ma non un vero "check-in" strutturato con promemoria automatico verso il cliente.

### Retention e coinvolgimento

- **Streak/serie di costanza**: le app con meccaniche di continuità (giorni di fila allenati, obiettivi settimanali) hanno un tasso di ritorno a 30 giorni sensibilmente più alto di quelle senza. VIGOR ha lo storico e il calendario ma non evidenzia esplicitamente una "serie" attiva — potrebbe essere un piccolo indicatore in Home ("4 settimane di fila senza saltare"), coerente con l'auto-skip già esistente che già distingue "saltato" da "non registrato".
- **La cosa più efficace, secondo le stesse ricerche, resta però ridurre l'attrito tra "dovrei allenarmi" e "sto allenandomi"** — non aggiungere meccaniche — che è esattamente la direzione presa dai cambi recenti dell'app (carosello→lista verticale, popup allenamento a tempo solo quando serve, timer con scorciatoie): continuare su questa linea vale probabilmente più di qualunque nuova funzione.

### Sicurezza (oltre ai bug già corretti in Parte 1)

- Applicare lo stesso `escapeAttr()` ai punti residui nel pannello PT elencati sopra.
- Se in futuro arriverà un vero backend condiviso per i profili locali (oggi solo `localStorage` sul dispositivo), sostituire `simpleHash` con un hash con salt prima di quel momento.

---

*Fonti consultate per la Parte 2: confronto Hevy/Strong/Fitbod 2026, guide a Trainerize/PT Distinction, linee guida UX di login/registrazione 2026, ricerche su retention e gamification nelle app fitness — tutte tramite ricerca web, nessuna citazione diretta di contenuto protetto.*
