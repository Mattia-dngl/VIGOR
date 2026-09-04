# VIGOR — Test live dell'app (mobile + desktop), 02/09/2026

A differenza dei report precedenti (letture del codice), questa volta ho fatto girare l'app vera in un browser reale (Chromium via Playwright), creato un profilo di prova completo e navigato le schermate come farebbe una persona nuova, sia su viewport mobile (390×844) che desktop (1440×900). Ho applicato le euristiche della skill UI/UX Pro Max (accessibilità, touch, layout responsive, navigazione) a quello che ho visto sullo schermo, non solo al codice.

**Limite tecnico da segnalare subito**: dalla sandbox in cui giro non riesco a raggiungere il tuo Supabase reale (la rete della sandbox risponde `403` per policy) — l'ho verificato con una richiesta diretta prima di iniziare. Ho quindi testato l'app nella sua modalità locale/offline già prevista dal codice (`js/config.js` con `url`/`chiave` vuoti — modifica fatta solo nella copia in esecuzione, mai su git, già ripristinata), che usa lo stesso identico codice e la stessa interfaccia della modalità online, con dati salvati sul dispositivo invece che su Supabase. Quello che segue riguarda quindi l'esperienza reale dell'app, con l'unica accortezza che due o tre dettagli specifici del flusso di login online (quello con email+password verso Supabase) non li ho potuti ripercorrere allo stesso modo e vanno riletti con questo in mente, dove lo segnalo.

## Un bug reale, non legato al mio test: un font che non carica blocca tutta l'app

In `index.html` (righe 31-41) c'è una rete di sicurezza che intercetta *qualunque* risorsa che fallisce il caricamento — `<script>`, `<link>`, immagini — e, se scatta, copre l'intera app con una schermata di errore fissa ("Si è verificato un errore imprevisto...", solo un pulsante Ricarica). Il commento nel codice dice che è pensata per un `<script src>` bloccato (una libreria essenziale che non parte). Il problema è che il listener non distingue: l'ho visto scattare per il CSS di Google Fonts, una risorsa puramente decorativa. Ho controllato dietro l'overlay: **l'app sotto si era caricata perfettamente**, schermata di login inclusa, semplicemente con un font di riserva al posto di quello scelto.

Su rete reale questo succede con qualunque ad-blocker o estensione privacy che filtra `fonts.googleapis.com` (uBlock Origin con le liste di default, Brave Shields, diverse estensioni "anti-tracking", alcune reti aziendali) — casi tutt'altro che rari. Chi si trova in questa situazione non vede l'app che funziona sotto: vede solo un errore tecnico intimidatorio, con "Ricarica" come unica opzione — che non risolve nulla, perché il font resta bloccato a ogni tentativo. La skill UX conferma: un elemento decorativo che fallisce non dovrebbe mai bloccare l'esperienza (è la stessa logica per cui un'icona senza etichetta è un problema di accessibilità — qui è un problema di robustezza).

**Correzione mirata**: la rete di sicurezza dovrebbe restare solo su `<script>` (il caso per cui è stata scritta, leggendo il commento), oppure trattare in modo diverso un `<link rel="stylesheet">` di un font — al massimo un avviso non bloccante, mai la schermata intera.

## Home dice "nessuna scheda attiva", Scheda dice il contrario

Su un profilo appena creato, la Home mostra la card "NESSUNA SCHEDA ATTIVA — Crea la tua prima scheda". Aprendo il tab Scheda, però, c'è già una card **"La mia scheda"** con etichetta verde **"ATTIVO"** (e "Giorni/settimana: 0"). Le due schermate si contraddicono nello stesso istante, sullo stesso profilo, senza che l'utente abbia fatto nulla: sembra che venga creata una scheda vuota di default che la Home non riconosce come "attiva" (probabilmente perché ha 0 giorni), mentre la schermata Scheda la mostra comunque come attiva. Per chi apre l'app per la prima volta è un piccolo cortocircuito proprio nel primo minuto: "ho una scheda o no?"

## "Registro allenamento" ora appare su tre schermate, non più due

Il report del 31/08 segnalava che l'intestazione "Registro allenamento" (con la striscia dei giorni) appariva identica in cima a Scheda e Registra. Nel test live ho trovato la stessa intestazione anche in cima a **Dieta** — prima ancora del contenuto sul cibo, appare "Registro allenamento" con la striscia dei giorni della scheda. È lo stesso componente condiviso, riusato anche dove il contenuto non c'entra (alimentazione, non allenamento), e rinforza esattamente la confusione già segnalata: toccando Dieta dalla barra in basso, la parte alta dello schermo sembra ancora quella di un'altra sezione.

## Un "+" senza etichetta nella card del Personal Trainer

Nella schermata Scheda, la card "Il mio Personal Trainer" contiene solo un pulsante rotondo "+" — nessun testo, nessuna descrizione di cosa succede toccandolo (collegare un PT? invitarlo? cercarlo?). È esattamente il pattern che le linee guida di accessibilità segnalano come "Severity: High": un pulsante solo-icona senza etichetta accessibile. Bastano una riga di sottotitolo sotto il titolo della card (es. "Nessun PT collegato — invitane uno") o un `aria-label` sul pulsante per chiarire l'azione prima ancora di doverla scoprire toccandola.

## Su desktop l'app resta un'app da telefono, con molto spazio sprecato

Ho aperto l'app anche a 1440px di larghezza (un normale monitor). Il contenuto resta largo quanto su mobile — una colonna centrale di circa 700px — con enormi margini vuoti a sinistra e a destra, e **la barra di navigazione in basso stile app-mobile resta il metodo di navigazione principale** anche su schermo grande, dove ci si aspetterebbe una barra laterale o una nav in alto più adatta allo spazio disponibile. Non è necessariamente un problema se VIGOR è pensata solo per il telefono in palestra (probabile, visto il contesto d'uso), ma se qualcuno la apre da PC — cosa più che plausibile per un personal trainer che gestisce più clienti — oggi trova un'esperienza che sembra un errore di layout più che una scelta.

## Cose che sono migliorate rispetto al report del 31/08 (verificate dal vivo)

Vale la pena segnalarle perché confermano che gli interventi hanno funzionato, non solo sulla carta:

- **Il pannello Account ora ha titoli di sezione.** Il report del 31/08 lamentava tendine di Account "tutte uguali, senza titolo che separi". Nel test live ho visto chiaramente "INFORMAZIONI IMPORTANTI" e "IL TUO PROFILO" come intestazioni distinte, con Impostazioni spostata su un'icona a parte (⚙ in alto), separata dal resto. Il problema descritto in quel report non si ripresenta più così.
- **Il codice di recupero ora si vede subito dopo la creazione del profilo**, non più sepolto in due tendine. Nel flusso locale che ho testato, appena create le credenziali appare una schermata dedicata "Salva il codice di recupero" con il codice ben visibile, un pulsante "Copia il codice" e un checkbox obbligatorio ("L'ho salvato") che sblocca "Continua" solo dopo la conferma — un buon pattern, impossibile da saltare per sbaglio. **Da verificare**: se il flusso di creazione account online (email+password verso Supabase, che non ho potuto testare da qui) mostra lo stesso schema subito dopo la registrazione — se non lo fa già, vale la pena portarcelo, perché risolverebbe direttamente il problema del codice "sepolto" descritto nel report precedente.

## Nota minore: password da 4 caratteri

Il campo password nella creazione profilo accetta un minimo di 4 caratteri ("Almeno 4 caratteri"). Per un'app che tiene dati di salute/allenamento non è un rischio drammatico (non ci sono pagamenti), ma è un minimo molto basso — vale la pena valutare se alzarlo (es. 8 caratteri) sia una scelta consapevole o solo mai rivista.

## In sintesi

Il colpo d'occhio generale dell'app è buono — schermata Home curata (illustrazione, card scura per la CTA principale, mappa del corpo interattiva), bottom-sheet "Cosa vuoi registrare?" ben fatto con scrim e opzioni chiare, schermata Dieta ricca e trasparente sul calcolo calorico (cita la formula usata, con disclaimer). I problemi più concreti trovati in questo giro di test live sono: il bug del gestore errori troppo aggressivo (il più serio, perché può nascondere un'app perfettamente funzionante dietro un errore inesistente), la contraddizione Home/Scheda sulla scheda attiva al primo utilizzo, e l'assenza di un layout desktop dedicato.
