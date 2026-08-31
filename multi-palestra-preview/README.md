# Prototipo isolato — Multi-palestra

Questa cartella è un **prototipo autonomo**, separato dal resto di VIGOR.
Non è collegata a `index.html` dell'app: nessun link, nessuno script
condiviso, nessuna dipendenza da `js/config.js`, da Supabase o da
`css/style.css`. Si apre da sola nel browser, senza server né build:

```
open multi-palestra-preview/index.html
```

(oppure un semplice `python3 -m http.server` dentro la cartella, se il
browser non carica bene i `<script src>` con `file://`).

Serve a progettare, testare e rifinire la parte **utente** della
specifica multi-palestra (`specifica-multi-palestra.pdf`, in questa
stessa cartella — punti 3, 4 e 7) senza toccare né rendere visibile
l'app attuale.

## Cosa c'è (e cosa NON c'è)

Implementato, con dati finti (mock), navigabile e testabile:

- **Switcher "Le Tue Palestre"** (punto 4) — elenco delle iscrizioni
  attive, righe "in attesa di approvazione", stato vuoto, pulsante "+".
- **Aggiungi palestra** (punto 3) — flusso con codice o ricerca
  nell'elenco; in entrambi i casi crea una richiesta `in_attesa`,
  mai un'accettazione automatica.
- **Badge stile HeyConad** (punto 7) — schermata di transizione con
  tessera che si trascina/tocca per aprirsi, codice a barre decorativo,
  alternativa "Continua senza badge".

**Non** implementato (fuori scopo per questa parte, riguarda i punti
5/6 della specifica — pannelli di ruolo, non "interfaccia utente"):
pannelli proprietario/segreteria/PT, gestione abbonamenti, permessi
veri, registrazione palestre, tabelle Supabase reali. Il file PDF resta
il riferimento quando si affronterà quella parte.

Le due immagini di riferimento citate nel PDF
(`riferimento-1-heyconad.jpg`, `riferimento-2-switcher-palestre.jpg`)
non erano allegate a questa sessione: le schermate sono state costruite
dalla loro descrizione testuale. Se recuperi le immagini, confrontale
con `schermataBadge`/`schermataSwitcher` e aggiusta i dettagli visivi.

## Struttura dei file

```
multi-palestra-preview/
  index.html                     punto d'ingresso: assembla le 4 schermate
  css/
    multi-palestra.css           tutto lo stile, classi prefissate .mp-
  js/
    icone.js                     libreria di icone SVG inline riutilizzabili
    dati-mock.js                 layer dati finto — VEDI SOTTO, è il file chiave
    stato.js                     store centrale + pub/sub tra schermate
    schermata-switcher.js        logica "Le Tue Palestre"
    schermata-aggiungi.js        logica "Aggiungi palestra"
    schermata-badge.js           logica badge/tessera
    schermata-placeholder.js     schermata "sei entrato in X" — solo prototipo
    main.js                      boot, router tra schermate, toast, pannello test
  README.md                      questo file
```

Ogni schermata è un modulo indipendente (`MP.schermataX`) con due sole
funzioni pubbliche: `inizializza()` (collega gli eventi, una volta sola)
e `render()` (ridisegna in base allo stato corrente). Nessuna schermata
importa direttamente le altre: comunicano solo tramite `MP.stato`.

## Pannello di test

In basso a sinistra c'è un pannello "Simula scenario" che cambia i dati
mock (nessuna palestra, una sola, più palestre, con richiesta in attesa)
per verificare rapidamente ogni caso. **È solo per il prototipo**: va
rimosso in integrazione (vedi sotto).

## Guida all'integrazione futura

Quando si deciderà di portare questa parte dentro l'app vera, i pezzi
da spostare/collegare sono questi:

1. **`js/dati-mock.js` → sostituire.** È l'unico file "sporco" di
   finzione. Le funzioni esposte (`profiloCorrente`, `elencoIscrizioni`,
   `palestreDisponibili`, `richiediIscrizione`, `richiediPerCodice`) sono
   il contratto: nelle schermate reali diventano chiamate a Supabase
   sulle tabelle `palestre` e `iscrizioni` descritte al punto 2 della
   specifica (`profilo_id`, `palestra_id`, `ruolo`, `stato`,
   `richiesta_il`/`approvata_il`/`rimossa_il`). Chi chiama queste
   funzioni (le schermate) non cambia.
2. **`js/schermata-*.js` → spostare così come sono** dentro `js/` (es.
   `js/multi-palestra/`), agganciandoli al sistema di
   overlay/schermate già usato in `index.html` invece che al piccolo
   router di `main.js` di questo prototipo.
3. **`css/multi-palestra.css` → deduplicare i token.** Le variabili
   `--mp-*` in cima al file sono una copia di quelle già definite in
   `css/style.css` (`--bg`, `--accent`, `--r-lg`, ecc.). A integrazione
   avvenuta vanno tolte e le classi `.mp-*` devono puntare alle
   variabili globali esistenti, per non avere due fonti di verità sui
   colori.
4. **`js/icone.js` → riusabile as-is**, o unito alla libreria di icone
   che l'app userà (oggi VIGOR usa perlopiù immagini in
   `assets/icons/`; le icone qui sono SVG inline per restare senza
   dipendenze da asset esterni durante il prototipo).
5. **`js/schermata-placeholder.js` → va eliminato.** Esiste solo per
   chiudere il flusso di navigazione durante i test; al suo posto,
   dopo il badge, deve aprirsi la home reale dell'app (già in
   `index.html`), passandole quale palestra è stata selezionata.
6. **Punto di innesto nel flusso di login reale**: lo switcher va
   mostrato dopo il login solo se `iscrizioniAttive().length > 1`
   (punto 4 della specifica); con 0 o 1 iscrizione il comportamento
   reale sarà diverso (qui, per poter testare tutto liberamente, si
   naviga sempre a mano tramite il pannello di test).
7. **Non ancora affrontato**: le tabelle `palestre`/`iscrizioni` su
   Supabase (punto 2), il flusso di approvazione lato
   proprietario/segreteria (punto 3, seconda metà), i pannelli di
   ruolo e i permessi (punto 5), il tracciamento abbonamenti (punto 6).
   Da riprendere dal PDF quando si passerà a quella parte.
