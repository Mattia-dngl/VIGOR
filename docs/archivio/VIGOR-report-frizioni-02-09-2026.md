# VIGOR — Cosa è fastidioso, poco chiaro o macchinoso (02/09/2026)

Report mirato: non "tutto quello che si potrebbe aggiungere", ma solo i punti che, usando l'app dal vivo (profilo di prova, mobile e desktop), danno fastidio, fanno fermare a capire cosa succede, o richiedono più passaggi/attenzione del necessario. Ordinati per quanto pesano sull'esperienza, dal più al meno fastidioso.

## 1. Un font che non carica blocca *tutta* l'app (il più grave)

In `index.html` (righe 31-41), qualunque risorsa che fallisce il caricamento — script, font, immagine — fa comparire una schermata di errore fissa su tutto lo schermo, con solo un pulsante "Ricarica". L'ho visto scattare per il CSS di Google Fonts: dietro l'errore, l'app si era caricata ed era **perfettamente utilizzabile**, semplicemente con un font di riserva. Chi ha un ad-blocker o un'estensione privacy che blocca `fonts.googleapis.com` (uBlock, Brave Shields, diverse estensioni anti-tracking — casi comuni, non rari) vede solo un muro rosso di errore, e "Ricarica" non risolve nulla perché il font resta bloccato a ogni tentativo. È il tipo di problema che fa pensare "l'app non funziona" a chi in realtà avrebbe potuto usarla normalmente.

## 2. Al primo utilizzo, Home e Scheda si contraddicono

Su un profilo appena creato, la Home dice "NESSUNA SCHEDA ATTIVA — Crea la tua prima scheda". Aprendo subito dopo il tab Scheda, però, c'è già una card **"La mia scheda"** con etichetta verde **"ATTIVO"**. Le due schermate raccontano due cose diverse nello stesso istante, senza che l'utente abbia fatto nulla — proprio nel primo minuto in cui si sta ancora orientando. È il momento peggiore per un dettaglio così: fa dubitare se l'app stia funzionando bene.

## 3. Due cronometri uno sopra l'altro in "Registra allenamento", solo uno spiegato

Aprendo Registra → Allenamento libero, in cima alla schermata c'è una barra con un tempo grande ("1:30"), tre scorciatoie (1:00 / 1:30 / 2:00) e un pulsante "Avvia" — **senza nessuna etichetta che dica cos'è**. Subito sotto c'è una seconda card, questa sì intitolata "Cronometro allenamento", che parte da sola e mostra "Allenamento in corso". Risultato: due timer visibili insieme, uno muto e uno etichettato, prima ancora di aver scelto un esercizio. Chi apre questa schermata per la prima volta non ha modo di capire a colpo d'occhio che quello in alto è il recupero tra le serie (si intuisce solo more avanti, quando è collegato a un esercizio) e quello sotto è la durata totale dell'allenamento. Basterebbe un'etichetta tipo "Timer recupero" sopra la barra in alto.

## 4. "Allenamento libero" mostrato come se fosse un avviso di errore

Nella stessa schermata, subito sotto il selettore "Che giorno hai fatto?", la modalità **"ALLENAMENTO LIBERO"** — una scelta normale e voluta, fatta pochi secondi prima dal menu "Cosa vuoi registrare?" — è mostrata dentro un badge color ambra con un'icona di avviso ⚠️, lo stesso linguaggio visivo che di solito segnala "attenzione, qualcosa non va". Chi sceglie deliberatamente l'allenamento libero rischia di chiedersi se ha sbagliato qualcosa, quando in realtà sta semplicemente usando la funzione come previsto.

## 5. "Registro allenamento" appare anche sopra la schermata Dieta

L'intestazione "Registro allenamento" con la striscia dei giorni della settimana — pensata per Scheda — compare identica anche in cima a **Dieta**, prima di qualunque contenuto sull'alimentazione. Toccando "Dieta" dalla barra in basso, per un istante la parte alta dello schermo sembra ancora quella di un'altra sezione. Chi cambia spesso tab può leggerlo come "non è cambiato niente" e chiedersi se il tocco sia andato a buon fine.

## 6. Un "+" senza alcuna spiegazione nella card del Personal Trainer

In Scheda, la card "Il mio Personal Trainer" ha solo un pulsante rotondo "+", senza una riga di testo che dica cosa succede toccandolo (cercare un PT? invitarne uno? collegare un codice?). È l'unico punto dell'app, tra quelli visitati, dove un'azione importante non ha nemmeno una parola di descrizione.

## 7. Su desktop l'app resta identica a mobile, con molto spazio vuoto

Aprendo VIGOR su un monitor normale (1440px), il contenuto resta largo quanto su telefono — una colonna centrale di circa 700px, margini vuoti enormi ai lati — e la barra di navigazione in basso in stile app-da-telefono resta il modo principale per muoversi, anche se c'è tutto lo spazio per una barra laterale. Non è un problema se l'uso previsto è solo il telefono in palestra, ma un personal trainer che apre l'app dal PC per gestire i clienti oggi trova un'esperienza che sembra un errore di layout più che una scelta voluta.

## Cose che invece funzionano bene (per bilanciare il quadro)

Vale la pena dirlo perché non è scontato: il form "+ Nuova scheda" spiega bene ogni campo (durata facoltativa, note, come funziona l'autocompletamento degli esercizi, dove gestire il database esercizi), con un piccolo suggerimento a comparsa che indica il prossimo passo ("aggiungi il primo giorno"). Impostazioni ha titoli di sezione chiari (Sicurezza e account / Allenamento / Supporto) con icone colorate e una riga di descrizione per ogni voce — nessuna confusione qui. Anche il bottom-sheet "Cosa vuoi registrare?" è ben fatto, con scrim scuro e opzioni descritte in una riga ciascuna.

## In sintesi

Se dovessi scegliere solo due cose da sistemare per prime: il bug del gestore errori (punto 1, perché può nascondere un'app che funziona dietro un errore falso) e la contraddizione Home/Scheda al primo utilizzo (punto 2, perché capita nel primo minuto di chiunque). I punti 3 e 4 (i due timer, il badge "libero" con l'aria di un errore) sono piccoli interventi — un'etichetta, un colore diverso — con effetto sproporzionato su quanto la schermata di registrazione sembra chiara al primo sguardo.
