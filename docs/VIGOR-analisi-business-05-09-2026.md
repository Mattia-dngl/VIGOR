# VIGOR — Giudice, Giuria e Boia
### Analisi di fattibilità come business — 05/09/2026

Questo documento non è un report tecnico come quelli in `docs/archivio/`. La domanda
qui è una sola: **VIGOR può diventare un piccolo business vincente?** Tutto ciò che
segue è al servizio di quella risposta.

Base dell'analisi: lettura integrale della struttura (`js/` ~11.150 righe su 34 file,
`index.html` 1.986 righe, `css/style.css` 2.545 righe), della specifica
`multi-palestra-preview/specifica-multi-palestra.pdf`, dei sei report in
`docs/archivio/`, della storia git (143 commit) ed esecuzione della suite di test
(**327 test, 327 passati**).

---

## 1. GIUDICE — i fatti, senza giudizio

### Cos'è VIGOR oggi, tecnicamente

Una PWA vanilla (nessun framework, nessun build step) con Supabase come backend
(auth email/password + Google OAuth, Postgres, Edge Functions, Web Push con VAPID).
Nessuna dipendenza runtime di terze parti a parte il client Supabase, Chart.js e xlsx.

### Superficie funzionale reale

Non è un prototipo. È un prodotto con:

**Lato atleta**
- Schede di allenamento multi-giorno con editor completo, categorie, scadenza
- Registrazione allenamento con cronometro, timer di recupero con audio, dropset,
  record personali, riscaldamento suggerito automaticamente dai gruppi muscolari
  del giorno (`suggerisciRiscaldamento`, `js/core/costanti.js`)
- Glossario di **171 esercizi** con descrizioni, esercizi personalizzati, video
  (con import/export Excel)
- Mappa muscolare anatomica interattiva (versione uomo e donna) con **19 zone fini**
  e tassonomia che si riaggrega su 10 gruppi per il grafico volume
- Dieta: **~180 alimenti italiani** con macro, calcolo calorico con formula
  dichiarata, scanner codice a barre via OpenFoodFacts, contatore acqua, pasti
- Storico: calendario allenamenti, grafico volume per gruppo muscolare con soglie,
  misurazioni corporee, record
- Funzionamento offline reale (service worker `vigor-v96`), notifiche push

**Lato Personal Trainer**
- Area PT con elenco clienti e "cose da guardare oggi" (clienti fermi da 7+ giorni,
  schede scadute) — `segnaliPT()` in `js/pt/pt-area.js`
- Editing inline della scheda e della dieta del cliente
- Check-in periodici configurabili (peso, foto, sensazione, nota)
- Chat PT↔cliente e chat di gruppo multi-partecipante
- Progressione automatica dei carichi

**Lato piattaforma**
- Pannello amministratore: approvazione account, blocco, nomina PT, eliminazione
  definitiva via Edge Function

### Qualità dell'esecuzione

- **327 test automatici, tutti verdi.** Per un'app costruita da una persona sola in
  ~10 giorni di lavoro intenso, questo è fuori scala rispetto alla norma.
- Il codice è commentato in italiano con il *perché* delle scelte, non il *cosa*.
  Diversi commenti registrano il bug che ha motivato la riga. È manutenibile.
- Sei cicli di audit già fatti e archiviati, con correzioni verificate dal vivo.

### Cosa NON c'è, nel repository

- Nessuna integrazione di pagamento (nessuna traccia di Stripe o simili)
- Nessuna analytics, nessun evento, nessun funnel misurato
- Nessuno schema SQL né migrazione versionata: le tabelle e le **policy RLS
  esistono solo dentro la dashboard Supabase**
- Nessuna CI, nessuna pipeline di deploy, nessun file di hosting
- Nessuna landing page (la home è direttamente il login dell'app)
- Nessun Termini di Servizio; `privacy.html` esiste ma è minima
- Nessuna presenza su App Store / Play Store: solo PWA

---

## 2. GIURIA — cosa vale davvero (e non sono complimenti)

Quattro cose che un concorrente non può copiarti in un pomeriggio.

**1. L'italianità profonda.** Non è "l'app tradotta". Il database alimenti è
italiano vero (pane carasau, farina di mais per polenta, riso venere), la
terminologia degli esercizi è quella che si usa in palestra qui, i testi sono
scritti da qualcuno che parla la lingua. Trainerize, TrueCoach ed Everfit sono
prodotti americani venduti in dollari con un database alimentare americano. È il
tuo unico vantaggio strutturale e vale più di dieci funzionalità.

**2. Il ciclo PT↔atleta è chiuso.** Scheda + dieta + check-in con foto + chat +
notifiche push, nella stessa app, con l'atleta che non deve installare niente di
diverso dal PT. Molti concorrenti hanno due app separate. Questo è il vero prodotto.

**3. La mappa muscolare + volume per gruppo.** È la cosa che si vede in dieci
secondi in una demo e che fa dire "ah, però". Non è la funzione più utile, ma è
quella che vende.

**4. La disciplina di sviluppo.** 327 test verdi, sei audit archiviati, commenti che
spiegano le decisioni. Significa che puoi ancora andare veloce fra sei mesi. La
maggior parte dei progetti a questo stadio non può.

**La giuria riconosce**: il prodotto non è il problema. È già oltre la soglia
minima per essere venduto.

---

## 3. BOIA — i capi d'accusa

Qui non ci sono "migliorie". Ci sono muri. Li metto in ordine di quanto uccidono.

### Capo 1 — L'architettura a blob unico non regge un cliente pagante

Tutto lo stato di una persona (schede, storico, misure, pasti, check-in, foto) vive
in **una singola colonna JSONB**, `profili.dati`, e ogni salvataggio riscrive
l'intero oggetto:

```js
// js/account/account.js:631
await sb.from('profili')
  .update({ dati: mio, nome: mio.name, aggiornato_il: ... })
  .eq('id', utenteOnline.id);
```

Conseguenze concrete:

- **Nessuna query possibile.** Non puoi chiedere al database "quanti allenamenti
  ha fatto la mia base utenti questo mese", "quali esercizi sono più usati",
  "quanti PT hanno più di 5 clienti attivi". Ogni domanda di business richiede di
  scaricare tutti i blob e ciclarli in JavaScript. Non potrai mai fare né analytics,
  né report per il PT, né fatturazione basata sull'uso.
- **Ogni tasto premuto rimanda tutto.** In `Registra`, ogni modifica chiama `save()`
  → `programmaInvio()` → upload dell'intero storico. Con sei mesi di allenamenti è
  un upload da megabyte ogni 1,2 secondi di digitazione, sulla rete mobile di una
  palestra interrata.

### Capo 2 — Le foto di check-in in base64 sono una bomba a orologeria

`js/pt/checkin-cliente.js` ridimensiona la foto a 1920px, qualità 0.9, e la salva
come **data URL dentro il profilo**:

```js
_checkinFotoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
...
prof.checkins.push({ ..., fotoUrl: _checkinFotoDataUrl, ... });
```

Ordine di grandezza: un JPEG 1920px q.0.9 sta sui 400–800 KB; in base64 diventa
550 KB – 1,1 MB. Un check-in a settimana per sei mesi = 26 foto = **15–25 MB dentro
una riga di database e dentro localStorage**.

Ma localStorage ha un tetto di circa 5 MB. E il fallimento è **silenzioso**:

```js
// js/core/stato.js:98
function scriviStatoLocaleSubito(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
}
```

Superata la quota, la `catch` vuota inghiotte l'errore: l'app continua a sembrare
funzionante, i dati non si salvano più in locale, e nessuno lo sa. Sul settimo o
ottavo check-in con foto, un cliente pagante comincia a perdere dati senza un
messaggio. Questo, da solo, è motivo sufficiente per non far pagare nessuno oggi.

### Capo 3 — PT e cliente si sovrascrivono a vicenda

Il PT lavora su una copia in memoria del cliente (`_clienteBuffer`) e la riscrive
intera:

```js
// js/pt/pt-area.js:777
await sb.from('profili')
  .update({ dati: _clienteBuffer, aggiornato_il: ... })
  .eq('id', ...);
```

Non c'è controllo di versione, né confronto su `aggiornato_il`, né merge. Scenario
reale e per niente esotico: il PT apre la scheda del cliente alle 18:00 per
modificarla; il cliente si allena alle 18:20 e registra le serie; il PT salva alle
18:30. **L'allenamento del cliente sparisce.** Silenziosamente. Chi paga per questo
prodotto — un PT che vende la propria professionalità — non può permetterselo una
volta sola.

### Capo 4 — La sicurezza non è verificabile, e questo è già un problema

Le policy RLS non sono nel repository. Non posso verificarle da qui, ma il codice
lascia domande aperte pesanti:

- Il client **inserisce da solo la propria riga** `profili`, campo `approvato`
  incluso (`js/account/account.js:530-539`). Se la policy di INSERT non blocca le
  colonne `approvato` e `is_pt`, chiunque può registrarsi e auto-promuoversi ad
  account approvato e a Personal Trainer.
- `js/pt/pt-collegamento.js:394` legge `dati` di un profilo per id. La policy che lo
  consente dev'essere strettissima (solo verso i propri clienti con rapporto attivo).
  Se è larga, ogni utente autenticato può leggere peso, misure, dieta e **foto del
  corpo** di tutti gli altri.
- L'email amministratore è hardcoded in `js/core/costanti.js:21`, e c'è anche una
  `PASSWORD_INGRESSO_INIZIALE = "ALLENATIOra26"` in chiaro nel sorgente pubblico.

Tradotto in linguaggio di business: **finché non hai verificato e versionato le RLS,
non puoi accettare un euro.** Stai trattando dati sanitari e foto del corpo di
persone identificate.

### Capo 5 — Non esiste un business, esiste un'app

- **Nessun pagamento.** La card abbonamento in `js/account/account.js:206` è un
  segnaposto: dice "appena la tua palestra lo attiva" e il pulsante "Rinnova" fa un
  toast che dice di telefonare alla palestra. Zero incasso possibile.
- **Nessuna analytics.** Non sai quante persone si registrano, quante tornano il
  giorno dopo, dove abbandonano. Stai costruendo al buio.
- **Approvazione manuale obbligatoria.** Ogni nuovo account resta bloccato su
  "In attesa di approvazione" finché tu, personalmente, non lo approvi. E ogni PT
  deve essere promosso a mano dal tuo pannello. A 20 utenti è controllo di qualità.
  A 500 è la fine: le persone si registrano di sera, tu approvi la mattina dopo, e
  metà se n'è già andata. **Questa è la singola cosa che più impedisce la crescita.**

### Capo 6 — Il processo di rilascio è artigianale

Nessuna CI, nessun deploy automatico. Per pubblicare bisogna ricordarsi di alzare a
mano `VERSIONE` in `sw.js` e di tenere allineata a mano la lista `DA_TENERE` con i
file effettivamente presenti — un disallineamento ha già prodotto un bug
(commit `3397403`, "riallinea la cache offline"). I 327 test esistono ma nessuno li
esegue automaticamente prima di una pubblicazione.

### Capo 7 — La posizione legale non regge una vendita B2B

`privacy.html` è onesta ma insufficiente per incassare: manca l'identità legale del
titolare (denominazione, P.IVA, sede), mancano le basi giuridiche, i tempi di
conservazione, l'elenco dei sub-responsabili, i trasferimenti extra-UE. Soprattutto:
peso, misure e **foto del corpo** sono dati relativi alla salute, categoria
particolare ai sensi dell'art. 9 GDPR, e la pagina non li tratta come tali. Non
esistono Termini di Servizio. E nel momento in cui una palestra ti paga, quella
palestra diventa titolare e tu responsabile del trattamento: serve un **accordo ex
art. 28** che oggi non hai. Per incassare serve anche una posizione fiscale
(P.IVA, verosimilmente regime forfettario).

---

## 4. IL VERDETTO

> **Sì, VIGOR può diventare un piccolo business vincente.**
> **No, non nella direzione verso cui lo stai portando.**
> **E non prima di aver demolito e ricostruito il modo in cui salva i dati.**

Scomposto:

| Domanda | Risposta |
|---|---|
| Il prodotto è abbastanza buono da essere venduto? | **Sì.** È già oltre la soglia. |
| È abbastanza solido da reggere clienti paganti? | **No.** Capi 1, 2, 3, 4. |
| Esiste un business intorno ad esso? | **No.** Non c'è modo di incassare, né di misurare, né di far entrare qualcuno senza il tuo intervento manuale. |
| La direzione multi-palestra è quella giusta? | **No.** È la trappola. Vedi sotto. |
| C'è una direzione che funziona? | **Sì.** Il PT indipendente italiano. |

**La condanna**: il progetto non muore per mancanza di prodotto. Muore, se muore,
perché stai per investire i prossimi tre mesi nella specifica multi-palestra —
tabelle, ruoli, permessi, pannelli proprietario/segreteria, badge in stile HeyConad
— invece che nelle cinque cose che trasformano un'app in un'attività.

---

## 5. PERCHÉ IL MULTI-PALESTRA È LA TRAPPOLA

La specifica è ben ragionata: ruoli per iscrizione e non globali, nessuna
accettazione automatica, l'account personale che sopravvive all'abbandono della
palestra. Sono le scelte giuste. Il problema non è la qualità del disegno, è il
mercato che apre.

**1. Vendere a una palestra significa vendere un gestionale.** Una palestra non
compra "l'app per i soci". Compra: anagrafica, contratti, incassi e scadenze, SEPA,
fatturazione elettronica, corrispettivi, controllo accessi con tornello e badge,
turni dello staff, sale corsi e prenotazioni. Se le manca una di queste cose,
continua a usare il gestionale che ha già — e allora tu sei un secondo sistema che
raddoppia il lavoro della segreteria. In Italia questo spazio è già occupato
(GymOS, Sportigo, Managify e altri) da aziende con anni di rapporti con i centri.

**2. Il ciclo di vendita è field sales.** Le palestre si conquistano di persona, con
un commerciale, una demo, una prova, una migrazione dei dati, un contratto annuale
e assistenza telefonica. Sei una persona sola. Non è una questione di quanto sei
bravo: non ci sono abbastanza ore.

**3. Il badge HeyConad è puro costo.** Schermata di transizione con tessera che si
trascina e codice a barre decorativo: bellissima, e non porta un euro finché non c'è
un controllo accessi vero dall'altra parte, che è hardware, non software.

**4. Ti allontana dal tuo unico vantaggio.** L'italianità e il ciclo PT↔atleta
servono al *coaching*, non alla gestione amministrativa di un centro.

**Cosa salvare della specifica**: il modello dati `iscrizioni` con ruolo per
iscrizione e stato è ottimo e **va tenuto** — ma applicato a "studi/team" invece che
a "palestre". Un PT che ha uno studio con due collaboratori è esattamente lo stesso
schema, ed è un cliente che sai raggiungere. Rimanda tutto il resto (pannelli
proprietario/segreteria, badge, abbonamenti della palestra) a dopo i primi 50 clienti
paganti. Se quel giorno arriva, la specifica sarà lì ad aspettarti.

---

## 6. DOVE PUNTARE: il PT indipendente italiano

### Il cliente

Un personal trainer italiano indipendente con 5–40 clienti, che oggi lavora con
**Excel + WhatsApp + PDF**. Non parla inglese abbastanza bene da essere a suo agio
con un software americano, non vuole pagare in dollari, e non ha un cliente che
scarichi una seconda app.

### Perché paga

Non paga per la mappa muscolare. Paga per: (a) risparmiare due o tre ore a settimana
di schede fatte a mano; (b) sembrare più professionale davanti al proprio cliente;
(c) sapere chi si è fermato prima che disdica.

Quel terzo punto **ce l'hai già costruito** ed è la funzione più preziosa che hai
scritto: la vista "cose da guardare oggi" con clienti fermi da 7 giorni e schede
scadute (`segnaliPT()`). Un PT che perde un cliente da 200 €/mese perché non si è
accorto che era sparito ha appena perso venti volte il tuo canone. Questo è il tuo
argomento di vendita. Non la mappa muscolare.

### Il prezzo

Il riferimento internazionale, per una configurazione paragonabile: **TrueCoach**
20 $/mese fino a 5 clienti, 53 $ fino a 20, 107 $ fino a 50; **Everfit** gratis fino
a 5, poi da 19 $/mese, con moduli a pagamento sopra (piani alimentari, automazioni,
pagamenti) fino a ~134–148 $/mese a 50 clienti; **Trainerize** da 19,80 $ fino a
250 $+ per illimitato, con supplementi per nutrizione e video.

La tua posizione:

| Piano | Prezzo | Contenuto |
|---|---|---|
| Atleta | **Gratis, per sempre** | Tutto il lato atleta. È acquisizione, non beneficenza. |
| PT | **19 €/mese** | Fino a 15 clienti seguiti |
| PT Pro | **39 €/mese** | Clienti illimitati + team/studio (il modello `iscrizioni`) |

Tre ragioni per questa struttura:
- **L'atleta non deve mai pagare.** Chi tiene un diario di allenamento ha già Hevy o
  Strong gratis: quel mercato non si monetizza. Ogni atleta gratuito è però un canale
  verso il suo PT.
- **Sotto i concorrenti, in euro, e senza moduli aggiuntivi.** "Metà del prezzo di
  Trainerize, in italiano, con la nutrizione inclusa" è una frase che si capisce in
  cinque secondi.
- **Nessun costo per cliente sul PT.** Il PT compra un canone fisso, i suoi clienti
  entrano gratis. Elimina la sua obiezione principale.

### Il canale

Instagram e TikTok dei PT italiani, i gruppi Facebook di categoria, i corsi ISSA e
NonSoloFitness, il passaparola. I primi dieci li recluti **a mano, uno per uno**,
offrendo tre mesi gratis in cambio di una chiamata di mezz'ora al mese. Non servono
annunci a pagamento finché non sai quanto vale un cliente.

---

## 7. PIANO A 90 GIORNI

L'ordine conta. Ogni fase è inutile senza la precedente.

### Settimane 1–3 — Rendere il prodotto vendibile (non nuove funzioni)

1. **Foto fuori dal blob.** Le foto di check-in vanno su Supabase Storage; nel
   profilo resta solo il percorso del file. Serve anche una migrazione per le foto
   già esistenti. *Sblocca: il capo 2.*
2. **Spezzare il blob.** Almeno `logs` (storico allenamenti), `measurements` e
   `checkins` in tabelle proprie, con scrittura per riga. `programs` e `dati`
   possono restare JSON per ora. *Sblocca: il capo 1 e ogni analytics futura.*
3. **Concorrenza PT/cliente.** Confronto ottimistico su `aggiornato_il`: se la riga
   è cambiata da quando il PT l'ha aperta, ricarica e riconcilia invece di
   sovrascrivere. *Sblocca: il capo 3.*
4. **Togliere la `catch` vuota** su localStorage: se il salvataggio locale fallisce,
   l'utente deve vederlo.

### Settimana 4 — Sicurezza e legale

5. **Portare lo schema e le RLS nel repository** come migrazioni SQL versionate, e
   rivedere ogni policy con la domanda: "un utente autenticato qualsiasi cosa può
   leggere e scrivere?". In particolare bloccare `approvato` e `is_pt` in INSERT e
   UPDATE lato client.
6. **Togliere `PASSWORD_INGRESSO_INIZIALE` dal sorgente**, sostituire l'admin
   hardcoded con un flag `ruolo` sulla riga del profilo.
7. **Privacy v2 + Termini di Servizio + modello di accordo art. 28**, con i dati di
   salute trattati come categoria particolare. **Apertura P.IVA.**

### Settimane 5–7 — Costruire il business

8. **Stripe**: abbonamento PT, prova di 14 giorni senza carta, portale di
   fatturazione.
9. **Uccidere l'approvazione manuale.** Registrazione self-serve: chiunque entra
   subito; chi si dichiara PT ottiene il ruolo e la prova gratuita, senza aspettarti.
   Ti resta il potere di bloccare, non quello di far entrare.
10. **Analytics** (Plausible o Umami, cookieless, non serve banner): registrazioni,
    attivazione, ritorno a 7 e 30 giorni, allenamenti registrati.
11. **Landing page vera** su un dominio, separata dall'app: cos'è, per chi, prezzo,
    tre schermate, un pulsante. Oggi un PT che riceve il link atterra su un login e
    non ha idea di cosa stia guardando.

### Settimane 8–12 — Vendere

12. Dieci PT reclutati a mano. Una chiamata a testa. Ascoltare, non presentare.
13. Chiudere la CI (test automatici prima di ogni pubblicazione) e il deploy.

### Criterio di verità, da fissare adesso

**Al giorno 90: 10 PT che hanno inserito una carta e pagano 19 €.** Non 10 iscritti,
non 10 "molto interessati". Dieci pagamenti.

- Se ci arrivi: il modello funziona, si scala sul canale.
- Se arrivi a 3–5: il prodotto va bene ma il prezzo o il messaggio no. Si corregge.
- Se arrivi a 0 dopo aver parlato con almeno trenta PT: il mercato ti sta dicendo
  che il problema non fa abbastanza male. Allora VIGOR resta un progetto personale
  eccellente per il tuo portfolio — che è comunque un risultato, non un fallimento.

---

## 8. QUANTO PUÒ VALERE, REALISTICAMENTE

Nessuna promessa, solo aritmetica.

| Scenario | PT paganti | Ricavo mensile ricorrente |
|---|---|---|
| Pessimistico | 20 | ~400 € |
| Realistico a 12 mesi | 80–150 | **1.900–3.500 €** |
| Buono a 24 mesi | 300 | ~7.500 € |

Con costi di infrastruttura che a questi volumi restano nell'ordine delle decine di
euro al mese, è margine quasi pieno.

Non è un'azienda finanziata da investitori. **È esattamente "un piccolo business
vincente"**: uno stipendio serio, costruito e gestito da una persona sola, in una
nicchia dove i concorrenti globali sono strutturalmente svantaggiati perché non
parleranno mai italiano come lo parli tu.

Ed è raggiungibile. Ma non passando dal multi-palestra.

---

## 9. LE CINQUE FRASI DA RICORDARE

1. Il prodotto è pronto; **il modo in cui salva i dati no**, e quello va sistemato
   prima di ogni altra cosa.
2. Le **foto in base64 dentro il profilo** faranno perdere dati al primo cliente
   pagante che fa check-in con costanza.
3. **L'approvazione manuale degli account** è il tappo che tiene fermo tutto:
   toglilo.
4. **Non vendere alle palestre. Vendi ai personal trainer**, in italiano, a 19 €, con
   i loro clienti gratis.
5. La funzione che vende non è la mappa muscolare, è **"questi tre clienti non si
   allenano da una settimana"**.

---

### Fonti esterne consultate

- [Everfit vs Trainerize vs TrueCoach (FitBudd, 2026)](https://www.fitbudd.com/insights/everfit-vs-trainerize-vs-truecoach)
- [Trainerize, TrueCoach, Everfit Pricing: Real Costs (2026)](https://assistantcoach.fit/blog/real-cost-fitness-coaching-software/)
- [Fitness Coaching App Pricing Compared (My PT Hub, 2026)](https://www.mypthub.net/blog/fitness-coaching-app-pricing-compared/)
- [GymOS — gestionale palestre Italia](https://www.gymos.it/)
- [Sportigo — prezzi gestionale palestra](https://www.sportigo.io/it/prezzi)
