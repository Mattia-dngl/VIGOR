// STATE (versione personale: profili locali su questo dispositivo, nessun ruolo/palestra)
// ============================================================
let state = load();
let activeProfileId = null;
let actingProfileId = null; // non più usato per lo scambio profili: resta solo per compatibilita'

// ============================================================
// MODALITA' PT — un Personal Trainer che modifica la scheda/dieta di un
// cliente lavora su una copia isolata dei suoi dati (_clienteBuffer), MAI
// sui propri: il proprio profilo (state.profiles / activeProfileId) resta
// sempre intatto, in memoria e sul telefono. Le modifiche al cliente si
// salvano solo sul suo account online, mai in locale.
// ============================================================
let modalitaPT = false;
let _clienteBuffer = null;
let _clienteIdInModifica = null;
let _modificaPTCosa = null;   // 'scheda' o 'dieta': cosa sto modificando, per l'avviso in chat
let _ptSalvataggioTimer = null;

function load(){
  let data;
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) data = JSON.parse(raw);
  }catch(e){}
  if(!data) data = { profiles: [], baseExerciseOverrides: {}, baseExerciseVideos: {} };
  if(!data.baseExerciseOverrides) data.baseExerciseOverrides = {};
  if(!data.baseExerciseVideos) data.baseExerciseVideos = {};
  // I profili creati prima che esistesse l'email restano senza: il primo (quello di chi
  // ha installato l'app) prende l'email dell'amministratore, altrimenti resterebbe
  // chiuso fuori dalle sue stesse funzioni di gestione.
  if(data.profiles.length && !data.profiles.some(p=>p.email)){
    data.profiles[0].email = EMAIL_AMMINISTRATORE;
  }
  data.profiles.forEach(p=>{
    normalizzaProfilo(p);
    // l'hash locale serve solo a chi non è mai passato dal login online
    // (vedi profiloVuotoPerCloud(), che lo elimina apposta): non va quindi
    // dentro normalizzaProfilo, o finirebbe anche sui profili online.
    if(!p.passwordHash) p.passwordHash = simpleHash("1234");
  });
  return data;
}

// Riempie i campi che un profilo può non avere ancora — sia perché creato
// prima che quel campo esistesse (es. waterLogs, 31/08/2026, contatore
// acqua), sia perché arriva "grezzo" da qualche altra fonte. Va chiamata
// su OGNI profilo prima di usarlo, non solo nel caricamento locale: prima
// veniva applicata solo qui in load(), ma applicaDatiOnline() (il profilo
// scaricato da Supabase per chi usa l'app online) lo saltava del tutto —
// per chi aveva un account online creato prima di un campo come waterLogs,
// prof.waterLogs restava undefined e aggiungiAcqua() lanciava un errore
// silenzioso al primo tap su +/- (bug segnalato: "l'acqua non funziona").
function normalizzaProfilo(p){
  // chi c'era prima dell'approvazione resta abilitato
  if(p.approvato === undefined) p.approvato = true;
  if(p.bloccato === undefined) p.bloccato = false;
  if(!p.measurements) p.measurements = [];
  if(!p.mealLogs) p.mealLogs = [];
  if(!p.waterLogs) p.waterLogs = []; // 31/08/2026: contatore acqua, Fase 3 (dieta)
  if(!p.customFoods) p.customFoods = {};
  if(p.altezza === undefined) p.altezza = null;
  if(p.eta === undefined) p.eta = null;
  if(p.dataNascita === undefined) p.dataNascita = null;
  if(!p.livelloAttivita) p.livelloAttivita = 'moderato';
  if(!p.obiettivoCalorico) p.obiettivoCalorico = 'mantenimento';
  if(p.obiettivoPeso === undefined) p.obiettivoPeso = null;
  if(p.obiettivoRecord === undefined) p.obiettivoRecord = null;
  if(p.abbonamentoScadenza === undefined) p.abbonamentoScadenza = null;
  if(!p.customExercises) p.customExercises = {};
  Object.keys(p.customExercises).forEach(name=>{
    if(Array.isArray(p.customExercises[name])){
      p.customExercises[name] = {muscles: p.customExercises[name], video:''};
    }
  });
  return p;
}
function save(){
  // in modalità PT sto modificando il cliente, non me: mai in locale sul mio
  // telefono, solo sul suo account online (vedi programmaSalvataggioPT)
  if(modalitaPT){ programmaSalvataggioPT(); return; }
  programmaSalvataggioLocale();
  if(typeof programmaInvio === 'function') programmaInvio();   // in modalità online rimanda tutto al server
}

// save() viene chiamata ovunque nell'app, anche a ogni singolo tasto premuto
// in un campo di Registra: `JSON.stringify(state)` serializza TUTTO lo stato
// (tutti i profili, tutto lo storico) e con mesi di allenamenti alle spalle
// diventa un lavoro non banale da rifare più volte al secondo. Qui si
// accorpano le scritture su disco ravvicinate in una sola, esattamente come
// già succede per l'invio online (vedi programmaInvio). Il dato in memoria
// (`state`) resta aggiornato SUBITO da chi chiama save() — a essere
// rimandata è solo la scrittura su localStorage, mai la modifica dei dati:
// chi legge `state` (backup, export, render...) vede sempre il valore vero.
let _salvataggioLocaleTimer = null;
function scriviStatoLocaleSubito(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
}
function programmaSalvataggioLocale(){
  clearTimeout(_salvataggioLocaleTimer);
  _salvataggioLocaleTimer = setTimeout(scriviStatoLocaleSubito, 400);
}
// non perdere l'ultima modifica se l'app va in background o la pagina si
// chiude entro i 400ms dall'ultima modifica (es. si cambia app subito dopo
// aver scritto una serie): forzo la scrittura immediata in quel momento.
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden' && _salvataggioLocaleTimer){
    clearTimeout(_salvataggioLocaleTimer);
    scriviStatoLocaleSubito();
  }
});
window.addEventListener('pagehide', ()=>{
  if(_salvataggioLocaleTimer){ clearTimeout(_salvataggioLocaleTimer); scriviStatoLocaleSubito(); }
});

// Il profilo "su cui sto lavorando": il mio di solito, quello del cliente
// mentre lo sto seguendo come PT. loggedInProfile() è invece sempre e solo
// il mio, così la mia identità (nome, account, impostazioni) non cambia mai.
function activeProfile(){ return modalitaPT ? _clienteBuffer : loggedInProfile(); }

// ============================================================
// NOTIFICHE INCROCIATE PT ↔ CLIENTE su scheda/dieta
// Non c'è una tabella "notifiche": come per messaggi/richieste, la notifica è
// calcolata al volo confrontando "quando è stata modificata" con "quando l'ha
// vista l'altra parte" — tutto dentro il blob "dati" del profilo, senza toccare
// il database. tipo è 'scheda' o 'dieta'.
function segnaModifica(prof, tipo){
  if(!prof) return;
  prof[tipo + 'ModificataIl'] = new Date().toISOString();
  prof[tipo + 'ModificataDa'] = modalitaPT ? 'pt' : 'cliente';
}
// Lato cliente: marca come vista la scheda/dieta sua. Va chiamata SOLO in
// contesto cliente (mai mentre modalitaPT è attivo, altrimenti il click
// automatico che PT fa dopo aver salvato marcherebbe "vista" prima ancora
// che il cliente l'abbia aperta davvero).
function segnaVistaCliente(tipo){
  if(modalitaPT) return;
  const lp = loggedInProfile();
  if(!lp) return;
  lp[tipo + 'VistaClienteIl'] = new Date().toISOString();
  save();
}
// Lato PT: marca come vista la scheda/dieta del cliente aperto. Scrittura diretta
// e leggera su Supabase (non passa dal salvataggio pesante di salvaModifichePT,
// che serve solo quando il PT ha davvero modificato qualcosa).
async function segnaVistaPT(tipo){
  if(!_clienteAperto || !sb) return;
  const d = _clienteAperto.riga.dati || {};
  d[tipo + 'VistaPtIl'] = new Date().toISOString();
  _clienteAperto.riga.dati = d;
  await sb.from('profili').update({dati: d}).eq('id', _clienteAperto.riga.id);
}
function loggedInProfile(){ return state.profiles.find(p=>p.id===activeProfileId); }
function isManager(){ return false; } // nessun ruolo owner/staff nella versione personale
function isOwnerNotActing(){ return false; }
function isManagerNotActing(){ return false; }
// Cosa può fare chi:
//  - PERSONALE (tutti): i propri esercizi aggiunti, il proprio timer, la propria scheda,
//    i propri allenamenti. Restano visibili solo a chi li crea.
//  - DI SISTEMA (solo amministratore): la libreria di base condivisa, i suoi muscoli e i
//    link video validi per tutti, la password d'ingresso, la gestione dei profili.
function canManageExercises(){ return true; }        // gli esercizi personali li gestiscono tutti
function puoModificareSistema(){ return sonoAmministratore(); }
function activeProgram(){
  const prof = activeProfile();
  if(!prof) return null;
  if(!prof.activeProgramId) prof.activeProgramId = prof.programs[prof.programs.length-1].id;
  return prof.programs.find(p=>p.id===prof.activeProgramId);
}

// Sostituisce confirm() nativo: alcuni browser, dopo che una pagina ha mostrato più finestre di
// conferma, offrono la spunta "impedisci ulteriori popup" — se attivata anche per sbaglio,
// confirm() smette di funzionare silenziosamente per tutta la pagina finché non la si ricarica.
// Questa versione vive dentro l'app e non dipende dal browser.
function customConfirm(message, onConfirm){
  const overlay = document.createElement('div');
  overlay.className = 'custom-confirm-overlay';
  overlay.innerHTML = `
    <div class="custom-confirm-box">
      <p>${message}</p>
      <div class="custom-confirm-actions">
        <button class="btn secondary" id="customConfirmCancel">Annulla</button>
        <button class="btn danger" id="customConfirmOk">Conferma</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = ()=>overlay.remove();
  overlay.querySelector('#customConfirmCancel').addEventListener('click', close);
  overlay.addEventListener('click', e=>{ if(e.target===overlay) close(); });
  overlay.querySelector('#customConfirmOk').addEventListener('click', ()=>{ close(); onConfirm(); });
}

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2400);
}



// etichette delle zone anatomiche cliccabili
const ZONE_LABEL = {
  "chest-alto":"Petto alto", "chest-medio":"Petto medio", "chest-basso":"Petto basso",
  "chest":"Petto",
  "upper-back":"Dorsali e alta schiena", "lower-back":"Lombari", "trapezius":"Trapezio",
  "deltoids":"Deltoidi", "biceps":"Bicipiti", "forearm":"Avambracci", "triceps":"Tricipiti",
  "abs":"Addominali", "obliques":"Obliqui", "neck":"Collo",
  "quadriceps":"Quadricipiti", "adductors":"Adduttori", "hamstring":"Femorali",
  "gluteal":"Glutei", "calves":"Polpacci", "tibialis":"Tibiale anteriore"
};
const ZONE_GROUP = {
  "chest-alto":"Petto","chest-medio":"Petto","chest-basso":"Petto","chest":"Petto",
  "upper-back":"Schiena","lower-back":"Schiena","trapezius":"Schiena",
  "deltoids":"Spalle","biceps":"Bicipiti","forearm":"Bicipiti","triceps":"Tricipiti",
  "abs":"Core/Addome","obliques":"Core/Addome","neck":"Core/Addome",
  "quadriceps":"Quadricipiti","adductors":"Quadricipiti","hamstring":"Femorali",
  "gluteal":"Glutei","calves":"Polpacci","tibialis":"Polpacci"
};
function exercisesForZone(slug){
  // la figura femminile ha un unico "petto" (non diviso in tre fasce): mostro tutti gli esercizi del petto insieme
  if(slug==='chest') return EX_LIB.filter(e=>e.slugs.some(s=>s==='chest-alto'||s==='chest-medio'||s==='chest-basso'));
  return EX_LIB.filter(e=>e.slugs.includes(slug));
}
function libFind(name){
  const k=(name||'').trim().toLowerCase();
  return EX_LIB.find(e=>e.n.toLowerCase()===k) || null;
}

// ============================================================
// MAPPA MUSCOLARE — figure cliccabili condivise da Scheda, Registra e Glossario
// Figure anatomiche da react-native-body-highlighter (Hicham El Abbassi, licenza MIT)
// ============================================================
const MP_NS = "http://www.w3.org/2000/svg";
const mpEl = (t,a={})=>{const e=document.createElementNS(MP_NS,t);for(const k in a)e.setAttribute(k,a[k]);return e};
// il gran pettorale viene ritagliato in 3 fasce cliccabili
const CHEST_BANDS = [["chest-alto",315,355],["chest-medio",357,395],["chest-basso",397,438]];
let MP_BUILT = false;
let mpZone = null;         // zona attualmente selezionata
let mpOnPick = null;       // callback di chi ha aperto il selettore
let mpUid = 0;             // per rendere unici gli id dei clip quando ci sono piu' figure

function sonoDonna(){
  const p = activeProfile();
  return !!(p && p.sesso === 'donna');
}

function mpBuildFigure(svg, parts, outline){
  svg.innerHTML = "";
  svg.appendChild(mpEl("path",{d:outline,class:"mp-skin"}));
  const defs = mpEl("defs"); svg.appendChild(defs);
  const donna = sonoDonna();
  parts.forEach(p=>{
    if(!p.paths || !p.paths.length) return;
    if(p.slug==="chest" && !donna){
      CHEST_BANDS.forEach(([slug,y0,y1])=>{
        const cid = "mpclip-"+slug+"-"+(++mpUid);
        const cp = mpEl("clipPath",{id:cid});
        cp.appendChild(mpEl("rect",{x:"0",y:String(y0),width:"1448",height:String(y1-y0)}));
        defs.appendChild(cp);
        const g = mpEl("g",{class:"mp-zone-g","data-slug":slug,tabindex:"0",role:"button",
                            "aria-label":ZONE_LABEL[slug],"clip-path":"url(#"+cid+")"});
        p.paths.forEach(d=>g.appendChild(mpEl("path",{d})));
        const t=mpEl("title"); t.textContent=ZONE_LABEL[slug]; g.appendChild(t);
        svg.appendChild(g);
      });
      return;
    }
    const known = !!ZONE_LABEL[p.slug];
    const g = mpEl("g", known
      ? {class:"mp-zone-g","data-slug":p.slug,tabindex:"0",role:"button","aria-label":ZONE_LABEL[p.slug]}
      : {class:"mp-skin"});
    p.paths.forEach(d=>g.appendChild(mpEl("path",{d})));
    if(known){const t=mpEl("title"); t.textContent=ZONE_LABEL[p.slug]; g.appendChild(t);}
    svg.appendChild(g);
  });
  svg.appendChild(mpEl("path",{d:outline,class:"mp-outline"}));
}

// ============================================================
// HOME — mappa muscolare "questa settimana": stessa geometria (GEO/GEO_DONNA,
// CHEST_BANDS, ZONE_LABEL) della mappa cliccabile di Scheda/Registra/Glossario,
// ma qui colora le zone in base a quante volte sono state allenate invece di
// gestire selezione/aggiunta esercizio. Funzione separata da mpBuildFigure per
// non rischiare di toccare quella (usata in tre punti diversi dell'app).
// ============================================================
let HM_BUILT = false;
let hmUid = 0;
function hmBucketColor(v){
  // Stessa scala a 4 livelli di sempre (0-3 allenamenti nella settimana),
  // solo intonata alla nuova palette più calda — nessun'altra logica toccata.
  if(!v || v<=0) return '#efeae0';
  if(v===1) return '#ffcdad';
  if(v===2) return '#ff7a3d';
  return '#ff4b2b';
}
function hmSelectZone(slug, conteggio){
  document.querySelectorAll('#homeHeatmapCard .heatmap-zone-g').forEach(g=>{
    g.classList.toggle('selected', g.dataset.slug===slug);
  });
  const label = ZONE_LABEL[slug] || slug;
  const n = conteggio[slug] || 0;
  const info = document.getElementById('homeHeatmapInfo');
  if(!info) return;
  info.innerHTML = n<=0
    ? `<b>${escapeAttr(label)}</b> — non ancora allenato questa settimana`
    : `<b>${escapeAttr(label)}</b> — allenato ${n} ${n===1?'volta':'volte'} questa settimana`;
}
function hmBuildFigure(svg, parts, outline, conteggio){
  svg.innerHTML = "";
  svg.appendChild(mpEl("path",{d:outline, class:"mp-skin"}));
  const defs = mpEl("defs"); svg.appendChild(defs);
  const donna = sonoDonna();
  parts.forEach(p=>{
    if(!p.paths || !p.paths.length) return;
    if(p.slug==="chest" && !donna){
      CHEST_BANDS.forEach(([slug,y0,y1])=>{
        const cid = "hmclip-"+slug+"-"+(++hmUid);
        const cp = mpEl("clipPath",{id:cid});
        cp.appendChild(mpEl("rect",{x:"0", y:String(y0), width:"1448", height:String(y1-y0)}));
        defs.appendChild(cp);
        const g = mpEl("g",{class:"heatmap-zone-g", "data-slug":slug, tabindex:"0", role:"button",
                            "aria-label":ZONE_LABEL[slug], "clip-path":"url(#"+cid+")",
                            style:"--hm-fill:"+hmBucketColor(conteggio[slug])});
        p.paths.forEach(d=>g.appendChild(mpEl("path",{d})));
        svg.appendChild(g);
      });
      return;
    }
    const known = !!ZONE_LABEL[p.slug];
    const g = known
      ? mpEl("g",{class:"heatmap-zone-g", "data-slug":p.slug, tabindex:"0", role:"button",
                  "aria-label":ZONE_LABEL[p.slug], style:"--hm-fill:"+hmBucketColor(conteggio[p.slug])})
      : mpEl("g",{class:"mp-skin"});
    p.paths.forEach(d=>g.appendChild(mpEl("path",{d})));
    svg.appendChild(g);
  });
  svg.appendChild(mpEl("path",{d:outline, class:"mp-outline"}));
}
function hmRefresh(){
  const svgF = document.getElementById('homeHeatmapFront');
  const svgB = document.getElementById('homeHeatmapBack');
  if(!svgF || !svgB) return;
  const donna = sonoDonna();
  const dati = donna ? GEO_DONNA : GEO;
  if(donna){
    svgF.setAttribute('viewBox', dati.viewBoxFront.join(' '));
    svgB.setAttribute('viewBox', dati.viewBoxBack.join(' '));
  } else {
    svgF.setAttribute('viewBox', '0 0 724 1448');
    svgB.setAttribute('viewBox', '724 0 724 1448');
  }
  const prof = activeProfile();
  const conteggio = heatmapSettimana(prof || {});
  hmBuildFigure(svgF, dati.front, dati.outlineFront, conteggio);
  hmBuildFigure(svgB, dati.back, dati.outlineBack, conteggio);
  document.querySelectorAll('#homeHeatmapCard .heatmap-zone-g').forEach(g=>{
    g.addEventListener('click', ()=>hmSelectZone(g.dataset.slug, conteggio));
    g.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); hmSelectZone(g.dataset.slug, conteggio); } });
  });
  const info = document.getElementById('homeHeatmapInfo');
  if(info) info.textContent = 'Tocca una zona per i dettagli';
  document.querySelectorAll('#homeHeatmapCard .heatmap-zone-g').forEach(g=>g.classList.remove('selected'));
  HM_BUILT = true;
}
document.querySelectorAll('.heatmap-viewtoggle button[data-hmview]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.heatmap-viewtoggle button[data-hmview]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const front = btn.dataset.hmview === 'front';
    document.getElementById('homeHeatmapFront').classList.toggle('show', front);
    document.getElementById('homeHeatmapBack').classList.toggle('show', !front);
  });
});

function mpBuildAll(){
  if(MP_BUILT) return;
  const donna = sonoDonna();
  const dati = donna ? GEO_DONNA : GEO;
  const svgF = document.getElementById('mpFront'), svgB = document.getElementById('mpBack');
  if(donna){
    svgF.setAttribute('viewBox', dati.viewBoxFront.join(' '));
    svgB.setAttribute('viewBox', dati.viewBoxBack.join(' '));
  } else {
    svgF.setAttribute('viewBox', '0 0 724 1448');
    svgB.setAttribute('viewBox', '724 0 724 1448');
  }
  mpBuildFigure(svgF, dati.front, dati.outlineFront);
  mpBuildFigure(svgB, dati.back,  dati.outlineBack);
  document.querySelectorAll('#mpOverlay .mp-zone-g').forEach(g=>{
    g.addEventListener('click', ()=>mpSelectZone(g.dataset.slug));
    g.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); mpSelectZone(g.dataset.slug); } });
  });
  enableFigureZoom(svgF);
  enableFigureZoom(svgB);
  MP_BUILT = true;
}

// da richiamare quando cambia il sesso nel profilo (onboarding o impostazioni):
// la prossima apertura del selettore ricostruisce la figura giusta da zero
function ricostruisciFiguraCorpo(){
  MP_BUILT = false;
  GL_BUILT = false;
  const svgF = document.getElementById('mpFront'), svgB = document.getElementById('mpBack');
  if(svgF){ svgF.innerHTML=''; svgF.__zoomReady=false; }
  if(svgB){ svgB.innerHTML=''; svgB.__zoomReady=false; }
  const boxF = document.querySelector('#mpFigFront .zoom-ctrl'); if(boxF) boxF.remove();
  const boxB = document.querySelector('#mpFigBack .zoom-ctrl'); if(boxB) boxB.remove();

  const glF = document.getElementById('glFront'), glB = document.getElementById('glBack');
  if(glF){ glF.innerHTML=''; glF.__zoomReady=false; }
  if(glB){ glB.innerHTML=''; glB.__zoomReady=false; }
  const gboxF = document.querySelector('#glFigFront .zoom-ctrl'); if(gboxF) gboxF.remove();
  const gboxB = document.querySelector('#glFigBack .zoom-ctrl'); if(gboxB) gboxB.remove();

  if(typeof glBuildAll === 'function'){ glBuildAll(); }
}

// ============================================================
