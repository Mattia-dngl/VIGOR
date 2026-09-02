// DEFAULT DATA
// ============================================================
function defaultWorkoutDays(){
  return [
    { key:"A", name:"Schiena & Spalle", weekday:"Lunedì",
      exercises:[
        {name:"Trazioni (o lat machine)", sets:4, reps:"8-10", muscles:["Schiena","Bicipiti"]},
        {name:"Rematore con bilanciere/manubrio", sets:4, reps:"10", muscles:["Schiena","Bicipiti"]},
        {name:"Lat machine presa larga", sets:3, reps:"10", muscles:["Schiena"]},
        {name:"Military press manubri", sets:4, reps:"8-10", muscles:["Spalle"]},
        {name:"Alzate laterali", sets:3, reps:"12-15", muscles:["Spalle"]},
        {name:"Face pull (cavo)", sets:3, reps:"15", muscles:["Spalle","Schiena"]},
        {name:"Plank", sets:3, reps:"40-60 sec", muscles:["Core/Addome"]}
      ]},
    { key:"B", name:"Petto & Tricipiti + Core", weekday:"Martedì",
      exercises:[
        {name:"Panca piana bilanciere/manubri", sets:4, reps:"8-10", muscles:["Petto","Tricipiti"]},
        {name:"Panca inclinata manubri", sets:3, reps:"10", muscles:["Petto"]},
        {name:"Croci ai cavi o chest press", sets:3, reps:"12", muscles:["Petto"]},
        {name:"Dip o French press", sets:3, reps:"10-12", muscles:["Tricipiti"]},
        {name:"Push down al cavo", sets:3, reps:"12-15", muscles:["Tricipiti"]},
        {name:"Russian twist (con peso)", sets:3, reps:"15 per lato", muscles:["Core/Addome"]},
        {name:"Sollevamento gambe da appeso o su panca", sets:3, reps:"12-15", muscles:["Core/Addome"]}
      ]},
    { key:"C", name:"Braccia + Core/Obliqui", weekday:"Giovedì",
      exercises:[
        {name:"Curl bilanciere", sets:4, reps:"10", muscles:["Bicipiti"]},
        {name:"Curl a martello", sets:3, reps:"12", muscles:["Bicipiti"]},
        {name:"Curl su panca inclinata", sets:3, reps:"12", muscles:["Bicipiti"]},
        {name:"French press", sets:3, reps:"10-12", muscles:["Tricipiti"]},
        {name:"Push down al cavo", sets:3, reps:"12-15", muscles:["Tricipiti"]},
        {name:"Kickback tricipiti", sets:3, reps:"12 per lato", muscles:["Tricipiti"]},
        {name:"Side plank", sets:3, reps:"30-40 sec per lato", muscles:["Core/Addome"]},
        {name:"Bicycle crunch", sets:3, reps:"20", muscles:["Core/Addome"]}
      ]}
  ];
}
function defaultDietInfo(){
  return {
    peso:"96 kg", altezza:"1,82 m", attivita:"Palestra con pesi, 3 volte a settimana",
    calorie:"~2400 - 2500 kcal (giorni feriali)",
    macro:"Proteine ~190 g | Grassi ~70 g | Carboidrati ~250 g",
    esclusi:"Mais, piselli, insalata cruda, legumi, zucchine, melanzane, frutta secca, pesce",
    noteIntolleranza:"Intolleranza al lattosio: usare sempre versioni senza lattosio"
  };
}
function defaultDietDays(){
  const d = {};
  WD_ORDER.forEach(w=>{
    if(w==="Domenica"){ d[w] = {libera:true, testo:"Mangia quello che vuoi, senza sensi di colpa. Uno sgarro settimanale non compromette i risultati."}; }
    else { d[w] = {libera:false, palestra:false, colazione:"", pranzo:"", spuntino:"", cena:""}; }
  });
  return d;
}
function defaultProgram(){
  const today = new Date().toISOString().slice(0,10);
  return {
    id: uid(), name:"Scheda iniziale", createdAt: today, archivedAt:null, scadenza:null,
    durataSettimane:null, dataInizio:null, notePT:null,
    days: defaultWorkoutDays(),
    dietInfo: defaultDietInfo(),
    diet: defaultDietDays()
  };
}
function blankDietDays(){
  const d = {};
  WD_ORDER.forEach(w=>{ d[w] = {libera:false, palestra:false, colazione:"",pranzo:"",spuntino:"",cena:""}; });
  return d;
}
function blankProgram(){
  const today = new Date().toISOString().slice(0,10);
  return {
    id: uid(), name:"La mia scheda", createdAt: today, archivedAt:null, scadenza:null,
    durataSettimane:null, dataInizio:null, notePT:null,
    days: [],
    dietInfo: {peso:"",altezza:"",attivita:"",calorie:"",macro:"",esclusi:"",noteIntolleranza:""},
    diet: blankDietDays()
  };
}
function simpleHash(str){
  let hash = 5381;
  for(let i=0;i<str.length;i++){
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16);
}

function addDaysIso(iso, days){
  const d = new Date(iso+'T00:00:00');
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
function newProfile(name, email, password, approvato){
  const createdAt = new Date().toISOString().slice(0,10);
  return { id: uid(), name: name.trim(), email: (email||'').trim().toLowerCase(), createdAt,
    approvato: !!approvato, bloccato:false, richiestoIl: new Date().toISOString(),
    passwordHash: simpleHash(password), sesso: null,
    programs:[blankProgram()], activeProgramId:null, logs:[], measurements:[], mealLogs:[], waterLogs:[], checkins:[], customExercises:{}, customFoods:{}, avatarUrl:null,
    altezza:null, dataNascita:null, eta:null, livelloAttivita:'moderato', obiettivoCalorico:'mantenimento',
    obiettivoPeso:null, obiettivoRecord:null,
    // Scadenza dell'abbonamento in palestra: nessuno la imposta ancora da
    // nessuna parte (la sezione "Abbonamento" in Account è un segnaposto
    // pronto per quando la palestra sarà collegata), ma il campo esiste già
    // qui così la UI può leggerlo fin da subito appena verrà popolato.
    abbonamentoScadenza:null };
}

// ============================================================
