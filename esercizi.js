// ============================================================
// LIBRERIA ESERCIZI — sorgente unica per Scheda, Registra e Glossario.
// g = gruppo muscolare (stessa tassonomia dell'app)
// slugs = zone anatomiche della figura su cui l'esercizio compare
// tempo = true se si misura in secondi invece che ripetizioni x kg
// ============================================================
const EX_LIB = [
  // ---------- PETTO ----------
  {n:"Panca inclinata con bilanciere", g:"Petto", slugs:["chest-alto"], d:"Spinta su panca a 30-45°. Carica la parte alta del pettorale, sotto la clavicola.", v:"https://www.muscleandstrength.com/exercises/incline-bench-press.html"},
  {n:"Panca inclinata con manubri", g:"Petto", slugs:["chest-alto"], d:"Come la inclinata col bilanciere ma con più libertà di movimento e maggiore allungamento.", v:"https://www.muscleandstrength.com/exercises/incline-dumbbell-bench-press.html"},
  {n:"Croci ai cavi dal basso", g:"Petto", slugs:["chest-alto"], d:"Cavi bassi, mani che salgono verso l'alto davanti al petto. Isola la parte alta."},
  {n:"Spinte inclinate alla macchina", g:"Petto", slugs:["chest-alto"], d:"Versione guidata della inclinata, utile per chi inizia o per le serie finali."},
  {n:"Panca piana con bilanciere", g:"Petto", slugs:["chest-medio"], d:"L'esercizio base di spinta orizzontale. Coinvolge anche deltoide anteriore e tricipite.", v:"https://www.muscleandstrength.com/exercises/barbell-bench-press.html"},
  {n:"Panca piana con manubri", g:"Petto", slugs:["chest-medio"], d:"Più escursione della versione con bilanciere e lavoro indipendente dei due lati.", v:"https://www.muscleandstrength.com/exercises/dumbbell-bench-press.html"},
  {n:"Chest press", g:"Petto", slugs:["chest-medio"], d:"Spinta orizzontale guidata alla macchina. Traiettoria fissa, facile da caricare in sicurezza."},
  {n:"Pectoral machine", g:"Petto", slugs:["chest-medio"], d:"Adduzione delle braccia alla macchina. Isola il pettorale togliendo il tricipite."},
  {n:"Croci su panca piana", g:"Petto", slugs:["chest-medio"], d:"Apertura e chiusura delle braccia con manubri. Lavoro in allungamento sul pettorale."},
  {n:"Piegamenti (push-up)", tipo:"corpo", g:"Petto", slugs:["chest-medio"], d:"Spinta a corpo libero. Regolabile alzando mani o piedi per cambiare difficoltà."},
  {n:"Panca declinata", g:"Petto", slugs:["chest-basso"], d:"Spinta con panca inclinata verso il basso. Enfasi sui fasci inferiori."},
  {n:"Dip alle parallele (busto avanti)", tipo:"corpo", g:"Petto", slugs:["chest-basso"], d:"Con il busto inclinato in avanti il carico si sposta dal tricipite al petto basso."},
  {n:"Croci ai cavi dall'alto", g:"Petto", slugs:["chest-basso"], d:"Cavi alti, mani che scendono incrociandosi in basso. Isola la parte bassa."},
  {n:"Push-up con piedi rialzati", tipo:"corpo", g:"Petto", slugs:["chest-basso"], d:"Piegamento con i piedi su un rialzo: sposta il carico verso il basso del pettorale."},

  // ---------- SCHIENA ----------
  {n:"Trazioni alla sbarra", tipo:"corpo", g:"Schiena", slugs:["upper-back"], d:"Tirata verticale a corpo libero. Il miglior esercizio per l'ampiezza del dorsale.", v:"https://www.muscleandstrength.com/exercises/pull-up"},
  {n:"Lat machine", g:"Schiena", slugs:["upper-back"], d:"Versione guidata e regolabile della trazione, adatta a ogni livello.", v:"https://www.muscleandstrength.com/exercises/lat-pull-down.html"},
  {n:"Rematore con bilanciere", g:"Schiena", slugs:["upper-back","lower-back"], d:"Tirata orizzontale a busto inclinato. Spessore della schiena e tenuta lombare."},
  {n:"Rematore con manubrio", tipo:"passi", g:"Schiena", slugs:["upper-back"], d:"Un braccio alla volta in appoggio sulla panca. Ottimo per correggere asimmetrie."},
  {n:"Rematore alla macchina", g:"Schiena", slugs:["upper-back"], d:"Tirata orizzontale guidata, con il petto in appoggio: toglie carico alla lombare."},
  {n:"Pulley basso", g:"Schiena", slugs:["upper-back"], d:"Tirata orizzontale ai cavi da seduto. Enfasi su romboidi e parte centrale.", v:"https://www.muscleandstrength.com/exercises/seated-row.html"},
  {n:"Pull-over", g:"Schiena", slugs:["upper-back"], d:"Braccia tese che scendono dietro la testa. Allunga e carica il dorsale."},
  {n:"Scrollate con bilanciere", g:"Schiena", slugs:["trapezius"], d:"Sollevamento delle spalle verso le orecchie. Isola il trapezio superiore.", v:"https://www.muscleandstrength.com/exercises/barbell-shrug.html"},
  {n:"Scrollate con manubri", g:"Schiena", slugs:["trapezius"], d:"Come le scrollate col bilanciere, con presa più naturale ai lati del corpo.", v:"https://www.muscleandstrength.com/exercises/dumbbell-shrugs.html"},
  {n:"Face pull", g:"Schiena", slugs:["trapezius","deltoids"], d:"Tirata alta verso il viso. Fondamentale per la salute della spalla e la postura.", v:"https://www.muscleandstrength.com/exercises/cable-face-pull"},
  {n:"Stacco da terra", g:"Schiena", slugs:["lower-back","gluteal","hamstring"], d:"Sollevamento da terra a schiena neutra. Il più completo: catena posteriore intera.", v:"https://www.muscleandstrength.com/exercises/deadlifts.html"},
  {n:"Iperestensioni", tipo:"corpo", g:"Schiena", slugs:["lower-back","gluteal"], d:"Estensione del busto alla panca romana. Rinforza i lombari in sicurezza."},
  {n:"Good morning", g:"Schiena", slugs:["lower-back","hamstring"], d:"Flessione del busto con bilanciere alto sulla schiena. Carica lombari e femorali."},
  {n:"Bird dog", tipo:"corpo", g:"Schiena", slugs:["lower-back","abs"], d:"A quattro zampe, braccio e gamba opposti estesi. Stabilità della colonna."},

  // ---------- SPALLE ----------
  {n:"Military press", g:"Spalle", slugs:["deltoids"], d:"Spinta sopra la testa in piedi. L'esercizio base per la forza delle spalle.", v:"https://www.muscleandstrength.com/exercises/military-press.html"},
  {n:"Shoulder press manubri", g:"Spalle", slugs:["deltoids"], d:"Spinta verticale con manubri, seduto o in piedi. Più naturale per la spalla."},
  {n:"Shoulder press machine", g:"Spalle", slugs:["deltoids"], d:"Spinta verticale guidata. Traiettoria fissa e schienale d'appoggio."},
  {n:"Arnold press", g:"Spalle", slugs:["deltoids"], d:"Spinta con rotazione dei polsi. Coinvolge anteriore e laterale in un unico gesto."},
  {n:"Alzate laterali", g:"Spalle", slugs:["deltoids"], d:"Braccia che salgono ai lati fino all'altezza spalla. Isola il deltoide laterale.", v:"https://www.muscleandstrength.com/exercises/dumbbell-lateral-raise.html"},
  {n:"Alzate frontali", g:"Spalle", slugs:["deltoids"], d:"Braccia che salgono davanti. Isola il deltoide anteriore."},
  {n:"Alzate posteriori", g:"Spalle", slugs:["deltoids","upper-back"], d:"A busto flesso, braccia che si aprono indietro. Deltoide posteriore, spesso trascurato."},
  {n:"Rematore al mento", g:"Spalle", slugs:["deltoids","trapezius"], d:"Tirata verticale con presa stretta. Deltoide laterale e trapezio insieme.", v:"https://www.muscleandstrength.com/exercises/upright-row.html"},

  // ---------- BICIPITI E AVAMBRACCI ----------
  {n:"Curl con bilanciere", g:"Bicipiti", slugs:["biceps"], d:"Flessione dei gomiti con bilanciere. L'esercizio base per il bicipite."},
  {n:"Curl con manubri", g:"Bicipiti", slugs:["biceps"], d:"Come il curl col bilanciere ma con rotazione del polso e lavoro indipendente."},
  {n:"Curl a martello", g:"Bicipiti", slugs:["biceps","forearm"], d:"Presa neutra, palmi che si guardano. Carica anche brachiale e avambraccio.", v:"https://www.muscleandstrength.com/exercises/standing-hammer-curl.html"},
  {n:"Curl su panca inclinata", g:"Bicipiti", slugs:["biceps"], d:"Braccia dietro il corpo: massimo allungamento del capo lungo del bicipite."},
  {n:"Curl ai cavi", g:"Bicipiti", slugs:["biceps"], d:"Tensione costante per tutta l'escursione, cosa che i pesi liberi non danno."},
  {n:"Curl concentrato", tipo:"passi", g:"Bicipiti", slugs:["biceps"], d:"Gomito appoggiato all'interno coscia. Isolamento massimo, un braccio alla volta."},
  {n:"Panca Scott", g:"Bicipiti", slugs:["biceps"], d:"Braccia appoggiate al leggio: impedisce di barare con lo slancio del busto.", v:"https://www.muscleandstrength.com/exercises/preacher-curl.html"},
  {n:"Curl inverso", g:"Bicipiti", slugs:["forearm","biceps"], d:"Presa prona. Sposta il lavoro su brachioradiale ed estensori dell'avambraccio."},
  {n:"Curl ai polsi", g:"Bicipiti", slugs:["forearm"], d:"Flessione dei soli polsi con avambracci appoggiati. Isola i flessori."},
  {n:"Farmer's walk", tipo:"tempo", g:"Bicipiti", slugs:["forearm","trapezius"], d:"Camminata con pesi pesanti nelle mani. Presa, trapezio e stabilità del core."},
  {n:"Dead hang alla sbarra", tipo:"tempo", g:"Bicipiti", slugs:["forearm"], d:"Restare appesi alla sbarra. Presa, spalle e decompressione della colonna."},

  // ---------- TRICIPITI ----------
  {n:"French press", g:"Tricipiti", slugs:["triceps"], d:"Estensione dei gomiti da sdraiato. Carica bene il capo lungo del tricipite.", v:"https://www.muscleandstrength.com/exercises/ez-bar-skullcrusher.html"},
  {n:"Push down ai cavi", g:"Tricipiti", slugs:["triceps"], d:"Spinta verso il basso ai cavi. Il più semplice da eseguire correttamente.", v:"https://www.muscleandstrength.com/exercises/tricep-extension.html"},
  {n:"Dip alle parallele", tipo:"corpo", g:"Tricipiti", slugs:["triceps","chest-basso"], d:"A busto verticale il carico resta sul tricipite. A corpo libero o assistito."},
  {n:"Kickback", tipo:"passi", g:"Tricipiti", slugs:["triceps"], d:"Braccio esteso indietro a busto flesso. Isolamento in massima contrazione."},
  {n:"Panca a presa stretta", g:"Tricipiti", slugs:["triceps","chest-medio"], d:"Panca con mani vicine. Spinta pesante che sposta il carico sul tricipite."},
  {n:"Estensioni sopra la testa", g:"Tricipiti", slugs:["triceps"], d:"Braccia sopra la testa che si estendono. Massimo allungamento del capo lungo."},

  // ---------- QUADRICIPITI E ADDUTTORI ----------
  {n:"Back squat", g:"Quadricipiti", slugs:["quadriceps","gluteal","adductors"], d:"Bilanciere sulle spalle. L'esercizio più completo per le gambe."},
  {n:"Front squat", g:"Quadricipiti", slugs:["quadriceps","abs"], d:"Bilanciere davanti: busto più verticale e più carico sul quadricipite."},
  {n:"Leg press", g:"Quadricipiti", slugs:["quadriceps","gluteal"], d:"Spinta guidata con le gambe. Permette carichi alti senza caricare la schiena.", v:"https://www.muscleandstrength.com/exercises/45-degree-leg-press.html"},
  {n:"Leg extension", g:"Quadricipiti", slugs:["quadriceps"], d:"Estensione del ginocchio alla macchina. Isola completamente il quadricipite."},
  {n:"Affondi", tipo:"passi", g:"Quadricipiti", slugs:["quadriceps","gluteal"], d:"Passo avanti con discesa del ginocchio. Lavoro su una gamba e sull'equilibrio.", v:"https://www.muscleandstrength.com/exercises/dumbbell-lunge.html"},
  {n:"Hack squat", g:"Quadricipiti", slugs:["quadriceps"], d:"Squat guidato alla macchina, schiena appoggiata. Enfasi sul quadricipite."},
  {n:"Squat bulgaro", tipo:"passi", g:"Quadricipiti", slugs:["quadriceps","gluteal"], d:"Piede posteriore su rialzo. Molto intenso su quadricipite e gluteo.", v:"https://www.muscleandstrength.com/exercises/one-leg-barbell-squat.html"},
  {n:"Squat a presa larga", g:"Quadricipiti", slugs:["adductors","gluteal"], d:"Piedi larghi e punte aperte: coinvolge molto gli adduttori."},
  {n:"Affondi laterali", tipo:"passi", g:"Quadricipiti", slugs:["adductors","gluteal"], d:"Passo di lato con discesa su una gamba. Allunga e carica l'adduttore."},
  {n:"Adductor machine", g:"Quadricipiti", slugs:["adductors"], d:"Chiusura delle gambe alla macchina. Isolamento diretto degli adduttori."},
  {n:"Copenhagen plank", tipo:"tempo", g:"Quadricipiti", slugs:["adductors","abs"], d:"Plank laterale con gamba in appoggio alto. Adduttori in isometria."},

  // ---------- FEMORALI ----------
  {n:"Stacco rumeno", g:"Femorali", slugs:["hamstring","gluteal","lower-back"], d:"Discesa a gambe quasi tese e schiena neutra. Il migliore per i femorali.", v:"https://www.muscleandstrength.com/exercises/romanian-deadlift"},
  {n:"Leg curl sdraiato", g:"Femorali", slugs:["hamstring"], d:"Flessione del ginocchio da prono. Isola il femorale.", v:"https://www.muscleandstrength.com/exercises/leg-curl.html"},
  {n:"Leg curl seduto", g:"Femorali", slugs:["hamstring"], d:"Come il leg curl sdraiato ma con anca flessa: allungamento diverso."},
  {n:"Nordic curl", tipo:"corpo", g:"Femorali", slugs:["hamstring"], d:"Discesa lenta con caviglie bloccate. Molto intenso, ottimo in prevenzione."},

  // ---------- GLUTEI ----------
  {n:"Hip thrust", g:"Glutei", slugs:["gluteal"], d:"Spinta del bacino con schiena appoggiata alla panca. Il più efficace per il gluteo.", v:"https://www.muscleandstrength.com/exercises/barbell-hip-thrust"},
  {n:"Glute bridge", tipo:"corpo", g:"Glutei", slugs:["gluteal"], d:"Ponte da terra. Versione base dell'hip thrust, senza attrezzatura."},
  {n:"Abduzioni ai cavi", g:"Glutei", slugs:["gluteal"], d:"Gamba che si allontana lateralmente. Isola medio e piccolo gluteo."},
  {n:"Step up", tipo:"passi", g:"Glutei", slugs:["gluteal","quadriceps"], d:"Salita su un rialzo con una gamba. Gluteo e controllo del ginocchio."},

  // ---------- POLPACCI ----------
  {n:"Calf raise in piedi", g:"Polpacci", slugs:["calves"], d:"Sollevamento sulle punte a gamba tesa. Enfasi sul gastrocnemio.", v:"https://www.muscleandstrength.com/exercises/standing-calf-raise.html"},
  {n:"Calf raise da seduto", g:"Polpacci", slugs:["calves"], d:"Sollevamento sulle punte a ginocchio piegato. Enfasi sul soleo."},
  {n:"Calf raise alla leg press", g:"Polpacci", slugs:["calves"], d:"Spinta di punta alla pressa. Permette carichi elevati in sicurezza."},
  {n:"Salto della corda", tipo:"distanza", g:"Polpacci", slugs:["calves"], d:"Lavoro elastico e cardio insieme. Ottimo riscaldamento."},
  {n:"Tibialis raise al muro", tipo:"corpo", g:"Polpacci", slugs:["tibialis"], d:"Punta del piede che sale con schiena al muro. Previene shin splints."},
  {n:"Camminata sui talloni", tipo:"distanza", g:"Polpacci", slugs:["tibialis"], d:"Camminare sui talloni con punte sollevate. Rinforza il tibiale anteriore."},

  // ---------- CORE ----------
  {n:"Plank", tipo:"tempo", g:"Core/Addome", slugs:["abs","obliques"], d:"Isometria sugli avambracci con corpo in linea. Tenuta del core.", v:"https://www.muscleandstrength.com/exercises/hover.html"},
  {n:"Side plank", tipo:"tempo", g:"Core/Addome", slugs:["obliques"], d:"Plank laterale su un avambraccio. Isola gli obliqui."},
  {n:"Crunch", tipo:"corpo", g:"Core/Addome", slugs:["abs"], d:"Flessione del busto da sdraiato. Il classico per il retto addominale.", v:"https://www.muscleandstrength.com/exercises/ab-crunch"},
  {n:"Sit-up", tipo:"corpo", g:"Core/Addome", slugs:["abs"], d:"Salita completa del busto. Più ampio del crunch, coinvolge anche i flessori d'anca."},
  {n:"Sollevamento gambe", tipo:"corpo", g:"Core/Addome", slugs:["abs"], d:"Gambe che salgono da sdraiato o appeso. Enfasi sulla parte bassa dell'addome."},
  {n:"Cable crunch", tipo:"corpo", g:"Core/Addome", slugs:["abs"], d:"Crunch in ginocchio ai cavi. Permette di aggiungere carico progressivo.", v:"https://www.muscleandstrength.com/exercises/cable-crunch.html"},
  {n:"Ab wheel", tipo:"corpo", g:"Core/Addome", slugs:["abs","lower-back"], d:"Rotella che scivola in avanti. Molto intenso: da introdurre gradualmente."},
  {n:"Russian twist", tipo:"corpo", g:"Core/Addome", slugs:["obliques"], d:"Rotazione del busto da seduto. Lavoro sugli obliqui in rotazione."},
  {n:"Pallof press", tipo:"tempo", g:"Core/Addome", slugs:["obliques","abs"], d:"Spinta ai cavi resistendo alla rotazione. Il core che frena, non che muove."},
  {n:"Woodchopper ai cavi", g:"Core/Addome", slugs:["obliques"], d:"Diagonale dall'alto al basso ai cavi. Rotazione sotto carico."},
  {n:"Crunch obliquo", tipo:"corpo", g:"Core/Addome", slugs:["obliques"], d:"Crunch con rotazione verso il ginocchio opposto."},
  {n:"Flessioni del collo con resistenza", tipo:"corpo", g:"Core/Addome", slugs:["neck"], d:"Flessione del capo contro resistenza leggera. Utile negli sport di contatto."},
  {n:"Isometria laterale del collo", tipo:"tempo", g:"Core/Addome", slugs:["neck"], d:"Spinta laterale della testa contro la mano, senza movimento."},
  // ---------- AGGIUNTE: cavi, macchine e varianti per ogni gruppo ----------
  // PETTO
  {n:"Croci su panca inclinata", g:"Petto", slugs:["chest-alto"], d:"Apertura con manubri su panca a 30°. Allunga la parte alta del pettorale.", v:"https://www.muscleandstrength.com/exercises/incline-dumbbell-flys.html"},
  {n:"Spinte ai cavi dal basso", g:"Petto", slugs:["chest-alto"], d:"Spinta in diagonale verso l'alto ai cavi bassi. Tensione costante sul petto alto."},
  {n:"Crossover ai cavi all'altezza del petto", g:"Petto", slugs:["chest-medio"], d:"Cavi all'altezza delle spalle, mani che si incrociano davanti. Isola il ventre centrale.", v:"https://www.muscleandstrength.com/exercises/cable-crossovers.html"},
  {n:"Panca piana al multipower", g:"Petto", slugs:["chest-medio"], d:"Spinta su binario guidato: utile per andare vicino al cedimento in sicurezza."},
  {n:"Chest press declinato", g:"Petto", slugs:["chest-basso"], d:"Spinta guidata in discesa. Carica i fasci bassi senza gestire l'equilibrio."},
  {n:"Dip alla macchina assistita", tipo:"corpo", g:"Petto", slugs:["chest-basso","triceps"], d:"Dip con contrappeso: permette di lavorare la parte bassa anche da principianti."},

  // SCHIENA
  {n:"Lat machine presa inversa", g:"Schiena", slugs:["upper-back","biceps"], d:"Presa supina alla lat machine. Coinvolge di più la parte bassa del dorsale e il bicipite."},
  {n:"Pulldown a braccia tese ai cavi", g:"Schiena", slugs:["upper-back"], d:"Braccia tese che scendono ai cavi alti. Isola il dorsale togliendo il bicipite.", v:"https://www.muscleandstrength.com/exercises/straight-arm-lat-pull-down.html"},
  {n:"Rematore ai cavi con corda", g:"Schiena", slugs:["upper-back","trapezius"], d:"Tirata ai cavi con corda verso l'addome. Enfasi su romboidi e trapezio medio."},
  {n:"Rematore T-bar", g:"Schiena", slugs:["upper-back","lower-back"], d:"Tirata con bilanciere incastrato. Ottimo per lo spessore della schiena."},
  {n:"Trazioni assistite alla macchina", tipo:"corpo", g:"Schiena", slugs:["upper-back","biceps"], d:"Trazione con contrappeso: stessa traiettoria delle trazioni ma alla portata di tutti."},
  {n:"Scrollate ai cavi", g:"Schiena", slugs:["trapezius"], d:"Scrollate ai cavi bassi. Tensione costante anche in allungamento."},
  {n:"Pull through ai cavi", g:"Schiena", slugs:["lower-back","gluteal","hamstring"], d:"Cavo basso fra le gambe, spinta d'anca. Insegna il movimento dello stacco senza carico sulla schiena."},
  {n:"Reverse hyperextension", tipo:"corpo", g:"Schiena", slugs:["lower-back","gluteal"], d:"Gambe che salgono con busto fermo. Lombari e glutei con poca compressione sulla colonna."},

  // SPALLE
  {n:"Alzate laterali ai cavi", g:"Spalle", slugs:["deltoids"], d:"Alzata laterale un braccio alla volta al cavo basso. Tensione costante, molto efficace.", v:"https://www.muscleandstrength.com/exercises/two-arm-cable-lateral-raise.html"},
  {n:"Alzate frontali ai cavi", g:"Spalle", slugs:["deltoids"], d:"Alzata frontale al cavo basso. Carica il deltoide anteriore su tutta l'escursione."},
  {n:"Croci inverse ai cavi", g:"Spalle", slugs:["deltoids","upper-back"], d:"Cavi incrociati che si aprono all'altezza del viso. Il migliore per il deltoide posteriore."},
  {n:"Rematore al mento ai cavi", g:"Spalle", slugs:["deltoids","trapezius"], d:"Tirata verticale al cavo basso. Più fluida della versione col bilanciere."},
  {n:"Alzate laterali alla macchina", g:"Spalle", slugs:["deltoids"], d:"Alzata guidata: elimina lo slancio del busto e isola il deltoide laterale.", v:"https://www.muscleandstrength.com/exercises/machine-lateral-raise.html"},
  {n:"Reverse pec deck", g:"Spalle", slugs:["deltoids","upper-back"], d:"Pectoral machine al contrario. Isola il deltoide posteriore in sicurezza."},

  // BICIPITI E AVAMBRACCI
  {n:"Curl alla corda ai cavi", g:"Bicipiti", slugs:["biceps","forearm"], d:"Curl al cavo con corda, presa neutra. Bicipite e brachiale con tensione costante."},
  {n:"Curl con bilanciere EZ", g:"Bicipiti", slugs:["biceps"], d:"Impugnatura angolata: stesso lavoro del curl classico ma più gentile sui polsi.", v:"https://www.muscleandstrength.com/exercises/ez-bar-curl.html"},
  {n:"Curl ai cavi da dietro", g:"Bicipiti", slugs:["biceps"], d:"Gomito dietro il corpo al cavo basso. Massimo allungamento del capo lungo."},
  {n:"Estensioni dei polsi", g:"Bicipiti", slugs:["forearm"], d:"Estensione dei polsi con avambracci appoggiati. Bilancia il lavoro dei flessori."},
  {n:"Presa a pinza con dischi", tipo:"tempo", g:"Bicipiti", slugs:["forearm"], d:"Tenere due dischi lisci fra pollice e dita. Costruisce la presa di pinza."},

  // TRICIPITI
  {n:"Push down alla corda", g:"Tricipiti", slugs:["triceps"], d:"Push down con corda e apertura finale. Contrazione più completa del capo laterale."},
  {n:"Push down presa inversa", g:"Tricipiti", slugs:["triceps"], d:"Push down con presa supina. Sposta il lavoro sul capo mediale."},
  {n:"Estensioni sopra la testa ai cavi", g:"Tricipiti", slugs:["triceps"], d:"Estensione al cavo con braccia sopra la testa. Capo lungo in allungamento e tensione costante."},
  {n:"Diamond push-up", tipo:"corpo", g:"Tricipiti", slugs:["triceps","chest-medio"], d:"Piegamento con mani vicine a formare un rombo. Tricipiti a corpo libero."},

  // QUADRICIPITI E ADDUTTORI
  {n:"Goblet squat", g:"Quadricipiti", slugs:["quadriceps","gluteal"], d:"Squat con manubrio o kettlebell al petto. Ottimo per imparare la tecnica."},
  {n:"Squat al multipower", g:"Quadricipiti", slugs:["quadriceps"], d:"Squat guidato: permette di spingere sul quadricipite senza problemi di equilibrio."},
  {n:"Affondo inverso al cavo", tipo:"passi", g:"Quadricipiti", slugs:["quadriceps","gluteal"], d:"Affondo indietro con cavo basso davanti. Il cavo aiuta a restare in equilibrio."},
  {n:"Sissy squat", tipo:"corpo", g:"Quadricipiti", slugs:["quadriceps"], d:"Ginocchia avanti e busto indietro. Isolamento estremo del quadricipite, da introdurre piano."},
  {n:"Adduzioni ai cavi", g:"Quadricipiti", slugs:["adductors"], d:"Gamba che si porta verso il centro al cavo basso. Isola l'adduttore in piedi."},
  {n:"Stacco sumo", g:"Quadricipiti", slugs:["adductors","gluteal","quadriceps"], d:"Stacco a gambe larghe. Coinvolge molto adduttori e glutei."},

  // FEMORALI
  {n:"Stacco rumeno ai cavi", g:"Femorali", slugs:["hamstring","gluteal"], d:"Stacco rumeno al cavo basso: tensione costante anche in cima al movimento."},
  {n:"Leg curl al cavo", g:"Femorali", slugs:["hamstring"], d:"Cavigliera al cavo basso, tallone che va al gluteo. Alternativa alla macchina."},
  {n:"Stacco a gamba singola", tipo:"passi", g:"Femorali", slugs:["hamstring","gluteal"], d:"Stacco su una gamba sola. Femorale, gluteo ed equilibrio insieme."},
  {n:"Slider leg curl", tipo:"corpo", g:"Femorali", slugs:["hamstring","gluteal"], d:"Talloni che scivolano su un panno da supino. Femorali a corpo libero, molto intenso."},

  // GLUTEI
  {n:"Kickback ai cavi", tipo:"passi", g:"Glutei", slugs:["gluteal"], d:"Gamba che spinge indietro al cavo basso. Isolamento diretto del gran gluteo."},
  {n:"Hip thrust ai cavi", g:"Glutei", slugs:["gluteal"], d:"Spinta d'anca con resistenza al cavo. Utile se la panca con bilanciere è occupata."},
  {n:"Abduzioni alla macchina", g:"Glutei", slugs:["gluteal"], d:"Apertura delle gambe da seduto. Medio gluteo, importante per la stabilità del bacino."},
  {n:"Affondo camminato", tipo:"passi", g:"Glutei", slugs:["gluteal","quadriceps"], d:"Affondi in avanzamento. Gluteo sotto tensione a lungo e lavoro cardiovascolare."},

  // POLPACCI E TIBIALE
  {n:"Calf raise al cavo", g:"Polpacci", slugs:["calves"], d:"Sollevamento sulle punte con cavo in spalla o alla cintura. Tensione costante."},
  {n:"Calf raise su una gamba", tipo:"passi", g:"Polpacci", slugs:["calves"], d:"Su un gradino, una gamba alla volta. Corregge le differenze fra destra e sinistra."},
  {n:"Calf raise su gradino a corpo libero", tipo:"corpo", g:"Polpacci", slugs:["calves"], d:"Massima escursione con il tallone che scende sotto il gradino.", v:"https://www.muscleandstrength.com/exercises/bodyweight-standing-calf-raise.html"},
  {n:"Dorsiflessioni al cavo", g:"Polpacci", slugs:["tibialis"], d:"Punta del piede che tira verso di sé contro il cavo. Isola il tibiale anteriore."},

  // CORE
  {n:"Rotazioni ai cavi in piedi", g:"Core/Addome", slugs:["obliques"], d:"Rotazione del busto al cavo con braccia tese. Obliqui sotto carico progressivo."},
  {n:"Side bend ai cavi", g:"Core/Addome", slugs:["obliques"], d:"Inclinazione laterale al cavo basso. Lavoro diretto sul quadrato dei lombi."},
  {n:"Sollevamento ginocchia alla sbarra", tipo:"corpo", g:"Core/Addome", slugs:["abs"], d:"Appeso alla sbarra, ginocchia al petto. Addome basso e presa insieme.", v:"https://www.muscleandstrength.com/exercises/hanging-leg-raise.html"},
  {n:"Bicycle crunch", tipo:"corpo", g:"Core/Addome", slugs:["obliques","abs"], d:"Crunch alternato gomito-ginocchio opposto. Addome e obliqui in un solo gesto."},
  {n:"Hollow hold", tipo:"tempo", g:"Core/Addome", slugs:["abs"], d:"Da supino, braccia e gambe sollevate a barca. Tenuta totale del core."},
  {n:"Mountain climber", tipo:"tempo", g:"Core/Addome", slugs:["abs","obliques"], d:"Da plank, ginocchia che corrono al petto. Core e fiato."},
  {n:"Estensioni del collo con resistenza", tipo:"corpo", g:"Core/Addome", slugs:["neck"], d:"Estensione del capo contro resistenza leggera. Bilancia il lavoro dei flessori."},

  // ---------- schede trovate su Muscle & Strength, con video ----------
  {n:"Panca declinata con manubri", g:"Petto", slugs:["chest-basso"], d:"Spinta su panca declinata con manubri: più escursione della versione col bilanciere.", v:"https://www.muscleandstrength.com/exercises/decline-dumbbell-bench-press.html"},
  {n:"Trazioni presa larga", tipo:"corpo", g:"Schiena", slugs:["upper-back"], d:"Trazione con presa più larga delle spalle. Enfasi sull'ampiezza del dorsale.", v:"https://www.muscleandstrength.com/exercises/wide-grip-pull-up.html"},
  {n:"Trazioni con presa a triangolo", tipo:"corpo", g:"Schiena", slugs:["upper-back","biceps"], d:"Trazione a presa neutra e stretta: più escursione e meno stress sulle spalle.", v:"https://www.muscleandstrength.com/exercises/v-bar-pull-up.html"},
  {n:"Lat machine presa stretta", g:"Schiena", slugs:["upper-back","biceps"], d:"Lat machine con presa stretta: lavora la parte bassa del dorsale.", v:"https://www.muscleandstrength.com/exercises/close-grip-pull-down.html"},
  {n:"Lat machine con triangolo", g:"Schiena", slugs:["upper-back"], d:"Lat machine con maniglia a V, presa neutra. Comoda per chi ha spalle sensibili.", v:"https://www.muscleandstrength.com/exercises/v-bar-pull-down"},
  {n:"Alzate laterali da seduto", g:"Spalle", slugs:["deltoids"], d:"Alzata laterale seduto: elimina lo slancio delle gambe e isola il deltoide.", v:"https://www.muscleandstrength.com/exercises/seated-dumbbell-lateral-raise.html"},
  {n:"Alzata laterale al cavo a un braccio", tipo:"passi", g:"Spalle", slugs:["deltoids"], d:"Un braccio alla volta al cavo basso, passando davanti al corpo. Tensione costante.", v:"https://www.muscleandstrength.com/exercises/one-arm-cable-lateral-raise.html"},
  {n:"Alzate laterali parziali", g:"Spalle", slugs:["deltoids"], d:"Alzate a mezza escursione, di solito in fondo alla serie per prolungare lo sforzo.", v:"https://www.muscleandstrength.com/exercises/lateral-raise-partials"},
  {n:"Rematore al mento con manubri", g:"Spalle", slugs:["deltoids","trapezius"], d:"Tirata verticale con manubri: traiettoria più libera del bilanciere.", v:"https://www.muscleandstrength.com/exercises/dumbbell-upright-row.html"},
  {n:"Panca Scott con bilanciere EZ", g:"Bicipiti", slugs:["biceps"], d:"Panca Scott con impugnatura angolata: più gentile sui polsi.", v:"https://www.muscleandstrength.com/exercises/ez-bar-preacher-curl.html"},
  {n:"Curl a martello su panca Scott", g:"Bicipiti", slugs:["biceps","forearm"], d:"Presa neutra sul leggio: isola brachiale e avambraccio senza slancio.", v:"https://www.muscleandstrength.com/exercises/dumbbell-hammer-preacher-curl.html"},
  {n:"Curl con hammer bar su panca Scott", g:"Bicipiti", slugs:["biceps","forearm"], d:"Come il curl a martello ma con barra a presa neutra: carichi più alti.", v:"https://www.muscleandstrength.com/exercises/hammer-bar-preacher-curl.html"},
  {n:"Stacco a gambe tese", g:"Femorali", slugs:["hamstring","lower-back"], d:"Discesa a gambe quasi rigide: allunga molto il femorale. Richiede buon controllo della schiena.", v:"https://www.muscleandstrength.com/exercises/stiff-leg-deadlift-aka-romanian-deadlift.html"},
  {n:"Stacco a gambe tese con manubri", g:"Femorali", slugs:["hamstring","gluteal"], d:"Versione con manubri: più libertà di traiettoria e facile da caricare in progressione.", v:"https://www.muscleandstrength.com/exercises/dumbbell-stiff-leg-deadlift.html"},
  {n:"Squat bulgaro con manubri", tipo:"passi", g:"Quadricipiti", slugs:["quadriceps","gluteal"], d:"Piede posteriore su panca, manubri ai lati. Più semplice da equilibrare del bilanciere.", v:"https://www.muscleandstrength.com/exercises/one-leg-dumbbell-squat-aka-bulgarian-squat.html"},
  {n:"Split squat con manubri", tipo:"passi", g:"Quadricipiti", slugs:["quadriceps","gluteal"], d:"Passo fisso, si scende e si risale sul posto. Ottimo per imparare prima degli affondi.", v:"https://www.muscleandstrength.com/exercises/dumbbell-split-squat"},
  {n:"Affondi con bilanciere", tipo:"passi", g:"Quadricipiti", slugs:["quadriceps","gluteal"], d:"Affondo con bilanciere sulle spalle: permette carichi più alti dei manubri.", v:"https://www.muscleandstrength.com/exercises/barbell-lunge.html"},
  {n:"Calf raise alla macchina", g:"Polpacci", slugs:["calves"], d:"Sollevamento sulle punte con pad sulle spalle. Carichi elevati in sicurezza.", v:"https://www.muscleandstrength.com/exercises/standing-machine-calf-raise"},
  {n:"Crunch con sovraccarico", tipo:"corpo", g:"Core/Addome", slugs:["abs"], d:"Crunch tenendo un disco al petto: permette di progredire quando il corpo libero non basta più.", v:"https://www.muscleandstrength.com/exercises/weighted-crunch.html"},
  {n:"Crunch ai cavi in piedi", tipo:"corpo", g:"Core/Addome", slugs:["abs"], d:"Crunch al cavo alto restando in piedi. Alternativa a quello in ginocchio.", v:"https://www.muscleandstrength.com/exercises/standing-cable-crunch.html"},
];
