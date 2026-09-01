
// ============================================================
// COSTANTI
// ============================================================
const WEEKDAYS = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
const WD_ORDER = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];
// Categoria del giorno di scheda (Storico, 15° giro): puramente descrittiva, scelta
// da chi compila la scheda in fase di editor — non cambia nessun calcolo esistente,
// serve solo a mostrare l'etichetta colorata nella card del giorno in Storico.
// I giorni creati PRIMA di questa modifica non hanno "categoria" (undefined): si
// mostrano con l'etichetta generica "Allenamento", mai una categoria indovinata.
const CATEGORIE_ALLENAMENTO = {
  forza:     { label: "Forza",     classe: "cat-forza" },
  cardio:    { label: "Cardio",    classe: "cat-cardio" },
  mobilita:  { label: "Mobilità",  classe: "cat-mobilita" },
  misto:     { label: "Misto",     classe: "cat-misto" }
};
const NOMI_MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const STORAGE_KEY = "gymTrackerPersonaleState_v1";
// unico account che può gestire l'app: password d'ingresso, profili, reimpostazioni
const EMAIL_AMMINISTRATORE = "dangelomattia2002@gmail.com";
const PASSWORD_INGRESSO_INIZIALE = "ALLENATIOra26";
const OLD_STORAGE_KEY = "gymTrackerPersonaleState_v0";
const MUSCLE_GROUPS = ["Petto","Schiena","Spalle","Bicipiti","Tricipiti","Quadricipiti","Femorali","Glutei","Polpacci","Core/Addome"];
// Zone fini della mappa muscolare (stesse di corpo.js/ZONE_LABEL più sotto): usate per
// taggare gli esercizi (di base e personali) con la stessa precisione della figura anatomica,
// invece dei 10 gruppi generici qui sopra (quelli restano solo per il grafico Volume, più
// leggibile con poche categorie larghe).
const MUSCLE_ZONES_FINE = ["chest-alto","chest-medio","chest-basso","upper-back","lower-back","trapezius",
  "deltoids","biceps","forearm","triceps","abs","obliques","neck",
  "quadriceps","adductors","hamstring","gluteal","calves","tibialis"];
// stessa tassonomia di ZONE_GROUP più sotto, duplicata qui per evitare dipendenze d'ordine
// fra le due costanti (entrambe const a livello di script, valutate in ordine di riga)
const ZONE_TO_MUSCLE_GROUP = {
  "chest-alto":"Petto","chest-medio":"Petto","chest-basso":"Petto","chest":"Petto",
  "upper-back":"Schiena","lower-back":"Schiena","trapezius":"Schiena",
  "deltoids":"Spalle","biceps":"Bicipiti","forearm":"Bicipiti","triceps":"Tricipiti",
  "abs":"Core/Addome","obliques":"Core/Addome","neck":"Core/Addome",
  "quadriceps":"Quadricipiti","adductors":"Quadricipiti","hamstring":"Femorali",
  "gluteal":"Glutei","calves":"Polpacci","tibialis":"Polpacci"
};
function etichettaZonaFine(slug){
  const mappa = {"chest-alto":"Petto alto","chest-medio":"Petto medio","chest-basso":"Petto basso",
    "upper-back":"Dorsali","lower-back":"Lombari","trapezius":"Trapezio","deltoids":"Deltoidi",
    "biceps":"Bicipiti","forearm":"Avambracci","triceps":"Tricipiti","abs":"Addominali",
    "obliques":"Obliqui","neck":"Collo","quadriceps":"Quadricipiti","adductors":"Adduttori",
    "hamstring":"Femorali","gluteal":"Glutei","calves":"Polpacci","tibialis":"Tibiale ant."};
  return mappa[slug] || slug;
}
// Un esercizio può avere muscoli "vecchio formato" (nomi generici tipo "Petto", salvati
// prima di questo aggiornamento) o "nuovo formato" (zone fini tipo "chest-medio"). Le due
// funzioni sotto normalizzano l'uno o l'altro a seconda di chi lo deve usare.
function zoneFiniValide(lista){ return (lista||[]).filter(m=>MUSCLE_ZONES_FINE.includes(m)); }
function eFormatoFine(lista){ return (lista||[]).length>0 && (lista||[]).every(m=>MUSCLE_ZONES_FINE.includes(m)); }
function gruppiDaMuscoli(lista){
  if(!lista || lista.length===0) return [];
  if(eFormatoFine(lista)) return [...new Set(lista.map(z=>ZONE_TO_MUSCLE_GROUP[z]).filter(Boolean))];
  return lista.filter(m=>MUSCLE_GROUPS.includes(m));   // già in formato vecchio (gruppi generici)
}
const VOLUME_THRESHOLDS = { low: 8, high: 20 }; // <8 basso, 8-20 ottimale, >20 alto

// ============================================================
// RISCALDAMENTO SUGGERITO (01/09/2026, richiesta esplicita): niente da
// costruire a mano in scheda — in Registra proponiamo 2-3 movimenti leggeri
// scelti dai gruppi muscolari REALMENTE coinvolti quel giorno (ex.muscles di
// ogni esercizio, stessa tassonomia del grafico Volume), non da una sezione
// separata da compilare. Un movimento per gruppo, nell'ordine in cui i gruppi
// compaiono nella scheda, fino a un massimo di 3 per non appesantire l'avvio
// dell'allenamento; se il giorno non ha ancora nessun muscolo taggato (schede
// vecchie, o "Allenamento libero" prima di scegliere un esercizio) si propone
// un riscaldamento cardio generico.
// ============================================================
const RISCALDAMENTO_PER_GRUPPO = {
  "Petto":        [{n:"Croci leggere a vuoto", target:"10 rip."}, {n:"Rotazioni delle braccia", target:"20 rip."}],
  "Schiena":      [{n:"Cat-cow", target:"30 sec"}, {n:"Face pull leggero (o slancio braccia indietro)", target:"12 rip."}],
  "Spalle":       [{n:"Rotazioni delle spalle", target:"30 sec"}, {n:"Alzate laterali a vuoto", target:"12 rip."}],
  "Bicipiti":     [{n:"Curl a vuoto", target:"12 rip."}, {n:"Rotazioni dei polsi", target:"20 rip."}],
  "Tricipiti":    [{n:"Push-up lenti sulle ginocchia", target:"8 rip."}, {n:"Rotazioni delle braccia", target:"20 rip."}],
  "Quadricipiti": [{n:"Squat a corpo libero", target:"12 rip."}, {n:"Affondi leggeri", target:"10 rip. per lato"}],
  "Femorali":     [{n:"Slanci gamba avanti/indietro", target:"10 rip. per lato"}, {n:"Affondi leggeri", target:"10 rip. per lato"}],
  "Glutei":       [{n:"Glute bridge", target:"15 rip."}, {n:"Squat a corpo libero", target:"12 rip."}],
  "Polpacci":     [{n:"Calf raise a corpo libero", target:"15 rip."}, {n:"Camminata sulle punte", target:"30 sec"}],
  "Core/Addome":  [{n:"Cat-cow", target:"30 sec"}, {n:"Plank leggero", target:"20 sec"}]
};
const RISCALDAMENTO_GENERICO = [{n:"Salto della corda", target:"2 min"}, {n:"Camminata veloce", target:"3 min"}];

function suggerisciRiscaldamento(day){
  const gruppi = [];
  (day && day.exercises || []).forEach(ex=>{
    gruppiDaMuscoli(ex.muscles).forEach(g=>{ if(!gruppi.includes(g)) gruppi.push(g); });
  });
  const scelti = [];
  gruppi.forEach(g=>{
    if(scelti.length>=3) return;
    const opz = RISCALDAMENTO_PER_GRUPPO[g];
    if(opz && opz[0] && !scelti.some(s=>s.n===opz[0].n)) scelti.push(opz[0]);
  });
  return scelti.length ? scelti : RISCALDAMENTO_GENERICO.slice(0,2);
}

// Esercizi comuni da palestra -> gruppi muscolari coinvolti (checked automaticamente alla selezione,
// poi modificabile a mano: utile se un macchinario specifico della tua palestra lavora anche altro).
const EXERCISE_MUSCLE_MAP = {
  "panca piana": ["Petto","Tricipiti"],
  "panca inclinata": ["Petto","Spalle"],
  "panca declinata": ["Petto"],
  "chest press": ["Petto","Tricipiti"],
  "croci ai cavi": ["Petto"],
  "croci su panca": ["Petto"],
  "pectoral machine": ["Petto"],
  "piegamenti (push-up)": ["Petto","Tricipiti"],
  "dip petto": ["Petto","Tricipiti"],
  "trazioni": ["Schiena","Bicipiti"],
  "lat machine": ["Schiena","Bicipiti"],
  "rematore bilanciere": ["Schiena","Bicipiti"],
  "rematore manubrio": ["Schiena","Bicipiti"],
  "rematore machine": ["Schiena"],
  "pulley basso": ["Schiena","Bicipiti"],
  "stacco da terra": ["Schiena","Femorali","Glutei"],
  "pull-over": ["Schiena","Petto"],
  "iperestensioni": ["Schiena","Glutei"],
  "military press": ["Spalle","Tricipiti"],
  "shoulder press machine": ["Spalle","Tricipiti"],
  "alzate laterali": ["Spalle"],
  "alzate frontali": ["Spalle"],
  "alzate posteriori": ["Spalle"],
  "face pull": ["Spalle","Schiena"],
  "arnold press": ["Spalle","Tricipiti"],
  "curl bilanciere": ["Bicipiti"],
  "curl manubri": ["Bicipiti"],
  "curl a martello": ["Bicipiti"],
  "curl panca inclinata": ["Bicipiti"],
  "curl ai cavi": ["Bicipiti"],
  "curl concentrato": ["Bicipiti"],
  "preacher curl": ["Bicipiti"],
  "french press": ["Tricipiti"],
  "push down": ["Tricipiti"],
  "dip tricipiti": ["Tricipiti"],
  "kickback tricipiti": ["Tricipiti"],
  "panca presa stretta": ["Tricipiti","Petto"],
  "overhead extension": ["Tricipiti"],
  "squat": ["Quadricipiti","Glutei"],
  "leg press": ["Quadricipiti","Glutei"],
  "leg extension": ["Quadricipiti"],
  "affondi": ["Quadricipiti","Glutei"],
  "hack squat": ["Quadricipiti","Glutei"],
  "leg curl": ["Femorali"],
  "stacco rumeno": ["Femorali","Glutei"],
  "good morning": ["Femorali","Glutei"],
  "hip thrust": ["Glutei"],
  "glute bridge": ["Glutei"],
  "calf raise in piedi": ["Polpacci"],
  "calf raise seduto": ["Polpacci"],
  "plank": ["Core/Addome"],
  "crunch": ["Core/Addome"],
  "sit-up": ["Core/Addome"],
  "russian twist": ["Core/Addome"],
  "sollevamento gambe": ["Core/Addome"],
  "cable crunch": ["Core/Addome"],
  "ab wheel": ["Core/Addome"],
  "side plank": ["Core/Addome"],
};

// Esercizi isometrici: si registrano in secondi di tenuta, non in ripetizioni×kg
const TIME_BASED_EXERCISES = ["plank", "side plank"];

// ============================================================
// TIPI DI MISURA
// Ogni esercizio si registra in modo diverso: ripetizioni e carico per i pesi,
// secondi per plank e isometrie, chilometri per la corsa, e così via.
//
// Il passo dei campi "kg" (31/08/2026, terzo giro): era stato portato a 5
// il 25/08 perché il massimale stimato (formula di Epley) mostrava cifre
// con la virgola che sembravano inventate. Ma passo:5 (un intero) fa sì
// che i telefoni mostrino la tastiera numerica SENZA punto decimale
// (vedi inputmode più sotto, dove buildFieldsHtml() lo decide da
// campo.passo < 1): impossibile scrivere 15,5 o 17,5 kg, pesi reali con
// i dischi da mezzo chilo. Richiesta esplicita: l'utente deve poter
// registrare QUALSIASI peso, è solo il numero CALCOLATO da noi (il
// massimale stimato) che va arrotondato — non l'input. Passo tornato a
// 0.5 qui, e recordPersonale()/il grafico più sotto ora arrotondano il
// risultato all'intero invece che al decimale.
// ============================================================
const TIPI_MISURA = {
  "peso":     { nome:"Ripetizioni e carico (es. panca, squat)", breve:"rip × kg",  campi:[
                  {chiave:"reps",    etichetta:"rip.", unita:"",    passo:1},
                  {chiave:"kg",      etichetta:"kg",   unita:"kg",  passo:0.5}] },
  "corpo":    { nome:"Solo ripetizioni, a corpo libero (es. addominali, push-up)", breve:"ripetizioni", campi:[
                  {chiave:"reps",    etichetta:"rip.", unita:"",    passo:1}] },
  "tempo":    { nome:"A tempo, in secondi (es. plank breve)", breve:"secondi", campi:[
                  {chiave:"seconds", etichetta:"secondi", unita:"sec", passo:5}] },
  "tempo_min":{ nome:"A tempo, in minuti (es. camminata, cyclette)", breve:"minuti", campi:[
                  {chiave:"seconds", etichetta:"minuti", unita:"min", passo:1, moltiplicatore:60}] },
  "tempo_ore":{ nome:"A tempo, in ore (es. escursione, sport lungo)", breve:"ore", campi:[
                  {chiave:"seconds", etichetta:"ore", unita:"h", passo:0.25, moltiplicatore:3600}] },
  "tempopeso":{ nome:"A tempo in secondi, con carico (es. plank zavorrato)", breve:"sec × kg", campi:[
                  {chiave:"seconds", etichetta:"secondi", unita:"sec", passo:5},
                  {chiave:"kg",      etichetta:"kg",   unita:"kg",  passo:0.5}] },
  "tempopeso_min":{ nome:"A tempo in minuti, con carico (es. trasporto pesi)", breve:"min × kg", campi:[
                  {chiave:"seconds", etichetta:"minuti", unita:"min", passo:1, moltiplicatore:60},
                  {chiave:"kg",      etichetta:"kg",   unita:"kg",  passo:0.5}] },
  "distanza": { nome:"Distanza e durata (es. corsa, bici, cardio)", breve:"km + minuti", campi:[
                  {chiave:"km",      etichetta:"km",   unita:"km",  passo:0.1},
                  {chiave:"minuti",  etichetta:"min",  unita:"min", passo:1}] },
  "passi":    { nome:"Ripetizioni per lato (es. affondi, step up)", breve:"rip. per lato", campi:[
                  {chiave:"reps",    etichetta:"rip. lato", unita:"", passo:1},
                  {chiave:"kg",      etichetta:"kg",   unita:"kg",  passo:0.5}] }
};
const CAMPI_SERIE = ["reps","kg","seconds","km","minuti"];

// Tipo di un esercizio: prima la scelta dell'utente, poi quella della libreria,
// infine un'ipotesi dal nome (per gli esercizi vecchi o scritti a mano).
function tipoMisura(nome){
  const n = (nome||'').trim().toLowerCase();
  if(!n) return "peso";
  const prof = activeProfile();
  if(prof && prof.customExercises && prof.customExercises[n] && prof.customExercises[n].tipo)
    return prof.customExercises[n].tipo;
  if(state.baseExerciseTipi && state.baseExerciseTipi[n]) return state.baseExerciseTipi[n];
  const lib = (typeof libFind === 'function') ? libFind(n) : null;
  if(lib && lib.tipo) return lib.tipo;
  if(/\bplank\b|\bwall sit\b|\bhollow\b|\bdead hang\b|isometri|hold\b/.test(n)) return "tempo";
  if(/corsa|corri|tapis|camminat|bici|cyclette|ellittic|vogatore|nuoto|salto della corda/.test(n)) return "distanza";
  if(/affond|bulgar|split squat|step up|kickback|alzate laterali al cavo|un braccio|gamba singola/.test(n)) return "passi";
  if(/push-?up|piegament|trazioni|dip |dip\b|crunch|sit-up|russian|mountain|bird dog|superman/.test(n)) return "corpo";
  return "peso";
}
function campiDi(nome){ return (TIPI_MISURA[tipoMisura(nome)] || TIPI_MISURA.peso).campi; }

// Etichetta e valore di partenza del campo "target" nell'editor scheda
// (Serie/Rip.), adattati al vero tipo dell'esercizio invece del fisso
// "Rip."/10 di sempre — un plank deve chiedere secondi, non ripetizioni.
function etichettaCampoPrincipale(nome){
  const c = campiDi(nome)[0];
  const et = c ? c.etichetta : 'rip.';
  return et.charAt(0).toUpperCase() + et.slice(1);
}
function defaultTargetFor(nome){
  const t = tipoMisura(nome);
  if(t==='tempo' || t==='tempopeso') return '30';
  if(t==='tempo_min' || t==='tempopeso_min' || t==='tempo_ore') return '1';
  if(t==='distanza') return '2';
  return '10';
}
// Riepilogo "3×10"/"3×30 sec" ecc. usato in vista scheda, editor, Registra e
// area PT: stessa unità del vero tipo dell'esercizio invece del sempre muto
// "3×10" che non diceva se erano ripetizioni, secondi o chilometri.
function descriviTargetSerie(ex){
  if(!ex) return '';
  const c = campiDi(ex.name)[0];
  const unita = (c && c.unita) ? ' '+c.unita : '';
  return `${ex.sets||0}×${ex.reps||''}${unita}`;
}

// converto fra il valore "vero" salvato (sempre in secondi, per non rompere storico/grafici)
// e quello mostrato nel campo (secondi, minuti o ore, secondo il tipo dell'esercizio)
function moltiplicatoreCampo(nome, chiave){
  const c = campiDi(nome).find(c=>c.chiave===chiave);
  return (c && c.moltiplicatore) ? c.moltiplicatore : 1;
}
function mostraValoreCampo(nome, chiave, grezzo){
  if(grezzo === '' || grezzo === undefined || grezzo === null) return '';
  const m = moltiplicatoreCampo(nome, chiave);
  if(m === 1) return grezzo;
  const n = parseFloat(grezzo);
  if(isNaN(n)) return grezzo;
  return (Math.round((n/m)*100)/100).toString();
}
function valoreDaCampo(nome, chiave, digitato){
  if(digitato === '' || digitato === undefined || digitato === null) return '';
  const m = moltiplicatoreCampo(nome, chiave);
  if(m === 1) return digitato;
  const n = parseFloat(digitato);
  if(isNaN(n)) return digitato;
  return Math.round(n*m).toString();
}

// resta per compatibilità con il resto dell'app
function isTimeBasedExercise(nome){
  const t = tipoMisura(nome);
  return t === "tempo" || t === "tempopeso";
}

// ============================================================
// RECORD PERSONALI (PR)
// Calcolati al volo dai log, mai salvati a parte: stessa fonte di verità
// del grafico "Progressi per esercizio" in Storico (evita di avere due
// numeri diversi da tenere sincronizzati). Per gli esercizi a tempo è la
// durata massima mai registrata; per gli altri è il massimale stimato con
// la formula di Epley del set più pesante di ogni sessione (kg*(1+reps/30)),
// così una sessione a ripetizioni alte e una a ripetizioni basse restano
// confrontabili fra loro.
// ============================================================
function recordPersonale(prof, exName){
  if(!prof || !prof.logs) return null;
  const timeBased = isTimeBasedExercise(exName);
  let migliore = null;
  prof.logs.forEach(l=>{
    const ex = l.exercises && l.exercises.find(e=>e.name===exName);
    if(!ex) return;
    const valore = timeBased
      ? Math.max(0, ...ex.sets.map(s=>parseFloat(s.seconds)||0))
      : Math.max(0, ...ex.sets.map(s=>{
          const kg = parseFloat(s.kg), reps = parseFloat(s.reps);
          return (kg>0 && reps>0) ? kg*(1+reps/30) : 0;
        }));
    if(valore>0 && (!migliore || valore>migliore.valore)) migliore = { valore: Math.round(valore), data: l.date };
  });
  return migliore;
}


// Database alimenti: kcal/proteine/carboidrati/grassi per 100g
const FOOD_DATABASE = {
  // ---- Cereali e derivati ----
  "pasta di semola": {kcal:366, p:13, c:75, f:1.5},
  "pasta integrale": {kcal:347, p:13, c:68, f:2.5},
  "riso bianco": {kcal:353, p:7, c:80, f:0.6},
  "riso integrale": {kcal:363, p:7.5, c:77, f:2.8},
  "riso basmati": {kcal:352, p:8, c:78, f:0.9},
  "riso venere": {kcal:359, p:8, c:76, f:2.5},
  "farina 00": {kcal:353, p:10, c:76, f:1},
  "farina integrale": {kcal:343, p:12, c:68, f:2.5},
  "farina di mais (polenta)": {kcal:367, p:8, c:77, f:3},
  "pane comune (bianco)": {kcal:261, p:8, c:55, f:1},
  "pane integrale": {kcal:251, p:9, c:48, f:2.5},
  "pane carasau": {kcal:367, p:11, c:74, f:3},
  "grissini": {kcal:412, p:11, c:74, f:8},
  "cracker": {kcal:431, p:9, c:65, f:15},
  "fette biscottate": {kcal:403, p:10, c:75, f:7},
  "corn flakes": {kcal:373, p:7, c:84, f:1},
  "avena in fiocchi": {kcal:347, p:13, c:58, f:7},
  "orzo perlato": {kcal:354, p:10, c:75, f:1.5},
  "farro": {kcal:343, p:13, c:67, f:2.5},
  "couscous": {kcal:349, p:13, c:72, f:1},
  "quinoa": {kcal:366, p:14, c:64, f:6},
  "biscotti secchi frollini": {kcal:452, p:7, c:70, f:16},
  "muesli": {kcal:358, p:10, c:66, f:6},
  "pizza margherita": {kcal:219, p:9, c:30, f:7},
  "piadina": {kcal:364, p:9, c:55, f:12},
  "gnocchi di patate": {kcal:105, p:3, c:22, f:0.5},
  "tortellini freschi (carne)": {kcal:260, p:12, c:35, f:8},
  "ravioli ricotta e spinaci": {kcal:210, p:9, c:30, f:6},
  // ---- Legumi ----
  "lenticchie secche": {kcal:317, p:25, c:52, f:1},
  "lenticchie cotte": {kcal:109, p:9, c:17, f:0.5},
  "ceci secchi": {kcal:354, p:21, c:54, f:6},
  "ceci cotti": {kcal:123, p:7, c:18, f:2.5},
  "fagioli borlotti secchi": {kcal:306, p:23, c:50, f:1.5},
  "fagioli cannellini cotti": {kcal:97, p:8, c:15, f:0.5},
  "piselli freschi": {kcal:83, p:5.5, c:14, f:0.5},
  "piselli surgelati": {kcal:65, p:5, c:10, f:0.5},
  "fave fresche": {kcal:73, p:5, c:12, f:0.5},
  "soia secca": {kcal:444, p:36, c:30, f:20},
  "fagioli neri cotti": {kcal:101, p:8, c:16, f:0.5},
  "lupini ammollati": {kcal:131, p:16, c:10, f:3},
  // ---- Carne ----
  "petto di pollo": {kcal:106, p:23, c:0, f:1.5},
  "coscia di pollo con pelle": {kcal:176, p:17, c:0, f:12},
  "petto di tacchino": {kcal:105, p:24, c:0, f:1},
  "manzo magro (fesa)": {kcal:111, p:21, c:0, f:3},
  "manzo macinato 20% grassi": {kcal:252, p:18, c:0, f:20},
  "vitello (fesa)": {kcal:102, p:21, c:0, f:2},
  "maiale (lonza)": {kcal:124, p:22, c:0, f:4},
  "prosciutto crudo sgrassato": {kcal:202, p:28, c:0, f:10},
  "prosciutto cotto": {kcal:156, p:20, c:1, f:8},
  "bresaola": {kcal:146, p:32, c:0, f:2},
  "salame": {kcal:378, p:26, c:1, f:30},
  "mortadella": {kcal:306, p:16, c:2, f:26},
  "speck": {kcal:255, p:30, c:0, f:15},
  "coniglio": {kcal:138, p:21, c:0, f:6},
  "agnello": {kcal:216, p:18, c:0, f:16},
  "wurstel": {kcal:254, p:12, c:2, f:22},
  "pancetta": {kcal:408, p:12, c:0, f:40},
  "salsiccia fresca": {kcal:316, p:15, c:1, f:28},
  // ---- Pesce ----
  "merluzzo": {kcal:74, p:17, c:0, f:0.7},
  "salmone": {kcal:197, p:20, c:0, f:13},
  "tonno fresco": {kcal:141, p:24, c:0, f:5},
  "tonno in scatola sott'olio sgocciolato": {kcal:172, p:25, c:0, f:8},
  "tonno in scatola al naturale": {kcal:109, p:25, c:0, f:1},
  "branzino": {kcal:99, p:18, c:0, f:3},
  "orata": {kcal:117, p:19, c:0, f:4.5},
  "gamberi": {kcal:83, p:18, c:0.5, f:1},
  "calamari": {kcal:82, p:16, c:1, f:1.5},
  "cozze con guscio": {kcal:74, p:11, c:3, f:2},
  "vongole con guscio": {kcal:57, p:10, c:2, f:1},
  "polpo": {kcal:73, p:15, c:1, f:1},
  "sgombro": {kcal:184, p:19, c:0, f:12},
  "alici / acciughe fresche": {kcal:91, p:16, c:0, f:3},
  "sardine fresche": {kcal:170, p:20, c:0, f:10},
  "baccalà ammollato": {kcal:75, p:17, c:0, f:0.8},
  "trota": {kcal:103, p:19, c:0, f:3},
  "sogliola": {kcal:82, p:17, c:0, f:1.5},
  // ---- Uova e latticini ----
  "uovo intero": {kcal:144, p:13, c:0.5, f:10},
  "albume d'uovo": {kcal:47, p:11, c:0.5, f:0.1},
  "tuorlo d'uovo": {kcal:345, p:16, c:0.5, f:31},
  "latte intero": {kcal:65, p:3.3, c:4.8, f:3.6},
  "latte parzialmente scremato": {kcal:47, p:3.3, c:4.8, f:1.6},
  "latte scremato": {kcal:35, p:3.4, c:5, f:0.2},
  "yogurt bianco intero": {kcal:62, p:3.5, c:4, f:3.5},
  "yogurt greco 0%": {kcal:57, p:9, c:4, f:0.5},
  "yogurt greco intero": {kcal:129, p:8, c:4, f:9},
  "mozzarella fior di latte": {kcal:256, p:18, c:1, f:20},
  "mozzarella di bufala": {kcal:246, p:16, c:0.5, f:20},
  "parmigiano reggiano": {kcal:384, p:33, c:0, f:28},
  "grana padano": {kcal:393, p:33, c:0, f:29},
  "ricotta vaccina": {kcal:136, p:8, c:3.5, f:10},
  "ricotta di bufala": {kcal:165, p:9, c:3, f:13},
  "formaggio spalmabile tipo philadelphia": {kcal:243, p:5, c:4, f:23},
  "provola": {kcal:327, p:25, c:0.5, f:25},
  "fontina": {kcal:334, p:25, c:0, f:26},
  "gorgonzola": {kcal:310, p:19, c:0, f:26},
  "burro": {kcal:751, p:0.6, c:0.5, f:83},
  "panna fresca da montare": {kcal:337, p:2.5, c:3, f:35},
  "scamorza": {kcal:327, p:25, c:0.5, f:25},
  // ---- Verdura ----
  "zucchine": {kcal:13, p:1.2, c:1.5, f:0.2},
  "melanzane": {kcal:18, p:1, c:3, f:0.2},
  "pomodori": {kcal:22, p:1, c:4, f:0.2},
  "peperoni": {kcal:23, p:1, c:4, f:0.3},
  "carote": {kcal:36, p:1, c:7.6, f:0.2},
  "patate": {kcal:77, p:2, c:17, f:0.1},
  "cipolle": {kcal:35, p:1.1, c:7.5, f:0.1},
  "insalata / lattuga": {kcal:16, p:1.5, c:2, f:0.2},
  "spinaci": {kcal:29, p:2.9, c:3.5, f:0.4},
  "broccoli": {kcal:32, p:3, c:4, f:0.4},
  "cavolfiore": {kcal:27, p:2.4, c:4, f:0.2},
  "zucca": {kcal:23, p:1, c:4.5, f:0.1},
  "funghi champignon": {kcal:27, p:3, c:3, f:0.3},
  "asparagi": {kcal:22, p:2.5, c:2.5, f:0.2},
  "finocchi": {kcal:23, p:1.2, c:4, f:0.2},
  "sedano": {kcal:14, p:1, c:2, f:0.2},
  "cetrioli": {kcal:12, p:0.8, c:2, f:0.1},
  "rucola": {kcal:23, p:2.5, c:2, f:0.6},
  "radicchio": {kcal:15, p:1.4, c:2, f:0.2},
  "bietole": {kcal:22, p:2, c:3, f:0.2},
  "carciofi": {kcal:38, p:3, c:6, f:0.2},
  "fagiolini": {kcal:26, p:2, c:4, f:0.2},
  "cavolo cappuccio": {kcal:24, p:1.5, c:4, f:0.2},
  // ---- Frutta ----
  "mela": {kcal:52, p:0.3, c:12, f:0.3},
  "banana": {kcal:92, p:1.2, c:21, f:0.3},
  "arancia": {kcal:41, p:0.7, c:9, f:0.2},
  "pera": {kcal:47, p:0.4, c:11, f:0.1},
  "fragole": {kcal:31, p:0.9, c:6, f:0.4},
  "uva": {kcal:67, p:0.5, c:16, f:0.1},
  "kiwi": {kcal:53, p:1.2, c:11, f:0.5},
  "ananas": {kcal:47, p:0.5, c:11, f:0.1},
  "pesca": {kcal:40, p:0.8, c:9, f:0.1},
  "anguria": {kcal:32, p:0.6, c:7, f:0.2},
  "melone": {kcal:33, p:0.8, c:7, f:0.2},
  "ciliegie": {kcal:67, p:1, c:15, f:0.3},
  "mandarino": {kcal:45, p:0.8, c:10, f:0.2},
  "pompelmo": {kcal:32, p:0.7, c:7, f:0.1},
  "avocado": {kcal:151, p:2, c:2, f:15},
  "fichi": {kcal:71, p:1, c:16, f:0.3},
  "prugne": {kcal:43, p:0.6, c:10, f:0.1},
  "limone": {kcal:17, p:0.6, c:3, f:0.3},
  "cachi": {kcal:80, p:0.5, c:19, f:0.2},
  "mango": {kcal:65, p:0.6, c:15, f:0.3},
  // ---- Frutta secca e semi ----
  "mandorle": {kcal:554, p:22, c:4, f:50},
  "noci": {kcal:669, p:15, c:6, f:65},
  "nocciole": {kcal:633, p:14, c:7, f:61},
  "pistacchi": {kcal:574, p:20, c:11, f:50},
  "anacardi": {kcal:576, p:18, c:27, f:44},
  "arachidi": {kcal:590, p:26, c:9, f:50},
  "semi di girasole": {kcal:587, p:21, c:11, f:51},
  "semi di zucca": {kcal:574, p:30, c:10, f:46},
  "semi di chia": {kcal:515, p:17, c:42, f:31},
  "semi di lino": {kcal:454, p:18, c:1, f:42},
  "uvetta": {kcal:289, p:3, c:68, f:0.5},
  "datteri": {kcal:272, p:2, c:65, f:0.4},
  "albicocche secche": {kcal:241, p:4, c:55, f:0.5},
  // ---- Oli e grassi ----
  "olio extravergine d'oliva": {kcal:900, p:0, c:0, f:100},
  "olio di semi di girasole": {kcal:900, p:0, c:0, f:100},
  "margarina": {kcal:724, p:0.5, c:0.5, f:80},
  "maionese": {kcal:689, p:1.5, c:2, f:75},
  "burro di arachidi": {kcal:610, p:25, c:15, f:50},
  // ---- Dolci e snack ----
  "cioccolato fondente 70%": {kcal:550, p:8, c:35, f:42},
  "cioccolato al latte": {kcal:536, p:7, c:55, f:32},
  "crema alla nocciola tipo nutella": {kcal:527, p:6, c:56, f:31},
  "gelato alla crema": {kcal:211, p:4, c:24, f:11},
  "marmellata": {kcal:243, p:0.5, c:60, f:0.1},
  "miele": {kcal:321, p:0.3, c:80, f:0},
  "zucchero": {kcal:400, p:0, c:100, f:0},
  "croissant": {kcal:412, p:8, c:50, f:20},
  "patatine fritte confezionate": {kcal:539, p:6, c:50, f:35},
  "popcorn salato": {kcal:456, p:9, c:60, f:20},
  // ---- Bevande ----
  "coca cola": {kcal:42, p:0, c:10.6, f:0},
  "succo d'arancia": {kcal:44, p:0.5, c:10, f:0.2},
  "birra": {kcal:16, p:0.5, c:3.5, f:0},
  "vino rosso": {kcal:2, p:0.1, c:0.3, f:0},
  "vino bianco": {kcal:2, p:0.1, c:0.5, f:0},
  "caffè nero senza zucchero": {kcal:0, p:0.1, c:0, f:0},
  "tè nero senza zucchero": {kcal:0, p:0, c:0, f:0},
  // ---- Condimenti ----
  "aceto balsamico": {kcal:70, p:0.5, c:17, f:0},
  "senape": {kcal:72, p:4, c:5, f:4},
  "ketchup": {kcal:105, p:1.5, c:24, f:0.3},
  "salsa di soia": {kcal:56, p:8, c:6, f:0},
  "brodo vegetale": {kcal:6, p:0.5, c:1, f:0},
  "pesto alla genovese": {kcal:441, p:4, c:5, f:45},
};

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function formatDate(iso){
  if(!iso) return "";
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatDateLungo(iso){
  if(!iso) return "";
  const MESI = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const [y,m,d] = iso.split('-');
  return `${parseInt(d,10)} ${MESI[parseInt(m,10)-1]} ${y}`;
}
function escapeAttr(s){ return String(s==null ? "" : s).replace(/"/g,'&quot;'); }

// Applica il nome/logo da brand.js a tutti i punti dove compare — se manca il
// file, o manca un valore, resta quello scritto qui sotto di riserva.
function applicaBrand(){
  const b = window.BRAND_CONFIG || {};
  const nome = b.nome || "VIGOR";
  const parte1 = b.parte1 != null ? b.parte1 : "VIG";
  const parte2 = b.parte2 != null ? b.parte2 : "OR";

  document.querySelectorAll('.lock-logo').forEach(el=>{
    const punto = el.querySelector('.lock-dot');
    el.textContent = nome;
    if(punto) el.prepend(punto);
  });
  const homeLogo = document.querySelector('.home-logo');
  if(homeLogo) homeLogo.innerHTML = `${escapeAttr(parte1)}<span class="home-logo-accent">${escapeAttr(parte2)}</span>`;
  const avvio = document.getElementById('avvioTestoBrand');
  if(avvio) avvio.textContent = nome;
  const metaTitolo = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(metaTitolo) metaTitolo.setAttribute('content', nome);
}
applicaBrand();

function toTitleCase(s){
  return s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1));
}

// ============================================================
// AUTOCOMPLETAMENTO PERSONALIZZATO
// (il <datalist> nativo HTML è inaffidabile su Safari iOS: spesso non mostra
// alcun suggerimento in tendina, per questo costruiamo il nostro)
// ============================================================
function attachAutocomplete(inputEl, getSourceNames, onSelect){
  if(inputEl.dataset.acAttached) return;
  inputEl.setAttribute('autocomplete','off');
  inputEl.dataset.acAttached = '1';

  const wrap = document.createElement('div');
  wrap.className = 'autocomplete-wrap';
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);

  const list = document.createElement('div');
  list.className = 'autocomplete-list';
  wrap.appendChild(list);

  function closeList(){ list.innerHTML = ''; list.classList.remove('open'); }
  function renderSuggestions(){
    const q = inputEl.value.trim().toLowerCase();
    if(!q){ closeList(); return; }
    const matches = getSourceNames().filter(n=>n.toLowerCase().includes(q)).slice(0,8);
    if(matches.length===0){ closeList(); return; }
    list.innerHTML = matches.map(n=>`<div class="autocomplete-item">${toTitleCase(n)}</div>`).join('');
    list.classList.add('open');
    list.querySelectorAll('.autocomplete-item').forEach(item=>{
      item.addEventListener('mousedown', e=>e.preventDefault()); // evita che il blur chiuda la lista prima del tap
      item.addEventListener('click', ()=>{
        inputEl.value = item.textContent;
        closeList();
        inputEl.dispatchEvent(new Event('input', {bubbles:true}));
        inputEl.dispatchEvent(new Event('change', {bubbles:true}));
        if(onSelect) onSelect(item.textContent);
      });
    });
  }
  inputEl.addEventListener('input', renderSuggestions);
  inputEl.addEventListener('focus', renderSuggestions);
  inputEl.addEventListener('blur', ()=>setTimeout(closeList, 180));
}
function exerciseSourceNames(){
  const lp = loggedInProfile();
  const personal = lp ? Object.keys(lp.customExercises||{}) : [];
  return [...new Set([...Object.keys(EXERCISE_MUSCLE_MAP), ...personal])];
}
function foodSourceNames(){
  const lp = loggedInProfile();
  const personal = lp ? Object.keys(lp.customFoods||{}) : [];
  return [...new Set([...Object.keys(FOOD_DATABASE), ...personal])];
}

// ============================================================
