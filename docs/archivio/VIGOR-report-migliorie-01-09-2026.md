# VIGOR — Proposte di miglioramento (01/09/2026)

Report separato, dedicato solo alle proposte di cosa migliorare/implementare in VIGOR, sulla base di ricerca online sulle migliori app di settore. Il report sui bug trovati e corretti nella stessa revisione è in un documento a parte (`VIGOR-report-bug-corretti-01-09-2026.md`).

Ricerca fatta su: app di tracking allenamento (Hevy, Strong, Fitbod), app per personal trainer (Trainerize, PT Distinction), e best practice generali di login/onboarding/retention 2026. VIGOR copre già bene le basi che queste app considerano indispensabili — registro allenamenti, dieta, rapporto PT↔cliente, promemoria, storico — quello che segue sono gap specifici rispetto a cosa fanno gli altri.

---

## Accesso e onboarding

- **Passkey / accesso biometrico.** Nel 2026 le password stanno diventando l'eccezione, non la norma: Face ID/Touch ID più una chiave crittografica al posto della password è ormai lo standard atteso su mobile. VIGOR ha già "Accedi con Google"; aggiungere un accesso biometrico (via WebAuthn/passkey) per il ritorno nell'app ridurrebbe l'attrito ad ogni apertura, specialmente per chi ha un account online.
- **Occhio per mostrare la password.** I moduli attuali (Accedi, Registrati, recupero) non hanno il tasto "mostra password" — una delle quattro cause più comuni di abbandono nei moduli di login secondo le linee guida UX 2026, insieme a messaggi d'errore poco chiari (che VIGOR invece gestisce già bene, vedi `traduciErrore`).
- **Un solo campo per iniziare.** Le migliori pratiche di registrazione partono da un solo campo (email) e chiedono il resto dopo, per ridurre l'abbandono. Il modulo "Registrati" di VIGOR chiede nome, email e password tutti insieme: non è un problema grave (sono solo 3 campi), ma separare "nome" nel primo giro di onboarding (che già esiste per sesso/età/altezza) potrebbe alzare leggermente il tasso di completamento.

## Allenamento

- **Suggerimenti di progressione automatica.** Fitbod e, più di recente, anche Hevy (con "Hevy Trainer") calcolano da soli il prossimo peso/ripetizioni in base allo storico, invece di lasciare che sia sempre la persona a deciderlo. VIGOR ha "Riporta ultima volta" (ripete i valori precedenti) ma non suggerisce un progresso — potrebbe essere un'estensione naturale della stessa funzione, es. "+2,5 kg rispetto a due settimane fa perché hai completato tutte le serie".
- **Integrazione con smartwatch/wearable.** Gli utenti del 2026 si aspettano che i dati compaiano dove già guardano (Apple Watch, Wear OS) — utile soprattutto per il cronometro allenamento che VIGOR ha già.

## Dieta

- Il report di usabilità del 31/08 (`VIGOR-report-usabilita-31-08-2026.md`) segnala già che non è ovvio quale pasto si sta compilando — resta valido. Aggiungo: app come Cronometer/MyFitnessPal mostrano un riepilogo macro (proteine/carboidrati/grassi) accanto alle kcal in ogni riga del diario, non solo nel totale giornaliero. VIGOR ha tolto di recente l'anello P/C/F a favore dell'anello kcal singolo (cambio dell'01/09 in `dieta-fase3`), il che è coerente con la scelta "un solo numero, più leggibile", ma vale la pena verificare che chi segue una dieta specifica per obiettivo (es. bulk/cut con target proteico) non senta la mancanza del dettaglio macro a colpo d'occhio.

## Area Personal Trainer

- **Programmazione con periodizzazione.** Trainerize/PT Distinction permettono al PT di impostare tempo di esecuzione, tecniche di intensità e note per singola serie con automazioni di progressione. VIGOR ha già dropset/superset/rest-pause e note per esercizio (buona base); manca ancora una progressione automatica settimana-per-settimana pianificata dal PT (es. "settimana 3: +5% carico") — oggi il PT deve modificare la scheda a mano ogni volta.
- **Check-in e moduli ricorrenti.** Le app PT più complete offrono moduli di check-in periodici (peso, foto, sensazioni) che il cliente compila e il PT rivede in un colpo d'occhio. VIGOR ha le misurazioni corporee ma non un vero "check-in" strutturato con promemoria automatico verso il cliente.

## Retention e coinvolgimento

- **Streak/serie di costanza.** Le app con meccaniche di continuità (giorni di fila allenati, obiettivi settimanali) hanno un tasso di ritorno a 30 giorni sensibilmente più alto di quelle senza. VIGOR ha lo storico e il calendario ma non evidenzia esplicitamente una "serie" attiva — potrebbe essere un piccolo indicatore in Home ("4 settimane di fila senza saltare"), coerente con l'auto-skip già esistente che già distingue "saltato" da "non registrato".
- **La cosa più efficace, secondo le stesse ricerche, resta però ridurre l'attrito tra "dovrei allenarmi" e "sto allenandomi"** — non aggiungere meccaniche — che è esattamente la direzione presa dai cambi recenti dell'app (carosello→lista verticale, popup allenamento a tempo solo quando serve, timer con scorciatoie): continuare su questa linea vale probabilmente più di qualunque nuova funzione.

## Sicurezza (oltre ai bug già corretti nel report a parte)

- Applicare lo stesso `escapeAttr()` ai punti residui nel pannello PT (dettaglio cliente: nome scheda, note su un esercizio, testo del giorno libero in dieta) — vedi il report bug per il dettaglio di cosa resta aperto.
- Se in futuro arriverà un vero backend condiviso per i profili locali (oggi solo `localStorage` sul dispositivo), sostituire `simpleHash` con un hash con salt prima di quel momento.

---

*Fonti consultate: confronto Hevy/Strong/Fitbod 2026, guide a Trainerize/PT Distinction, linee guida UX di login/registrazione 2026, ricerche su retention e gamification nelle app fitness — tutte tramite ricerca web, nessuna citazione diretta di contenuto protetto.*
