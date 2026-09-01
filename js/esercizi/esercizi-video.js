// ============================================================
let _vidUrl = "", _vidNome = "";

// Solo alcuni servizi permettono di essere riprodotti dentro un'altra pagina.
// Per gli altri (come le schede di Muscle & Strength) non apro un riquadro nero:
// mostro invece i due modi per vedere comunque il video.
function urlIncorporabile(url){
  try{
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./,'');
    if(h === 'youtube.com' || h === 'm.youtube.com'){
      if(u.pathname === '/watch' && u.searchParams.get('v')) return 'https://www.youtube.com/embed/' + u.searchParams.get('v');
      if(u.pathname.startsWith('/embed/')) return url;
      if(u.pathname.startsWith('/shorts/')) return 'https://www.youtube.com/embed/' + u.pathname.split('/')[2];
    }
    if(h === 'youtu.be' && u.pathname.length > 1) return 'https://www.youtube.com/embed' + u.pathname;
    if(h === 'vimeo.com' && /^\/\d+/.test(u.pathname)) return 'https://player.vimeo.com/video' + u.pathname;
    if(h === 'player.vimeo.com') return url;

    // Google Drive: il link di condivisione va trasformato in quello di anteprima
    if(h === 'drive.google.com'){
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if(m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
      const id = u.searchParams.get('id');
      if(id) return 'https://drive.google.com/file/d/' + id + '/preview';
      return url;
    }
    if(h === 'onedrive.live.com' || h === '1drv.ms') return url;
  }catch(e){}
  return null;
}

// file video veri e propri (caricati su un cloud, su un sito, o messi accanto all'app)
function urlFileVideo(url){
  try{
    const u = new URL(url, location.href);
    const h = u.hostname.replace(/^www\./,'');
    if(/\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test(u.pathname)) {
      // Dropbox serve il file solo con questo parametro
      if(h === 'dropbox.com' || h === 'dl.dropboxusercontent.com'){
        u.searchParams.set('raw','1'); u.searchParams.delete('dl');
        return u.toString();
      }
      return u.toString();
    }
  }catch(e){}
  return null;
}

// Un esercizio è "di base" se sta nella libreria condivisa (esercizi.js).
// Se non c'è, è un esercizio personale creato da chi lo sta usando.
function esercizioDiBase(nome){
  return !!(typeof libFind === 'function' && libFind(nome));
}
// piccola etichetta da mostrare nelle viste di sola lettura della scheda, per
// sapere a colpo d'occhio quali esercizi hanno una tecnica speciale collegata
function etichettaTecnica(ex, giorno){
  if(ex.dropset) return ex.dropset.tipo==='restpause' ? ' · Rest-pause' : ' · Dropset';
  if(ex.supersetCon!=null && giorno && giorno.exercises[ex.supersetCon]) return ` · Superset con ${giorno.exercises[ex.supersetCon].name}`;
  if(giorno){
    const mieIdx = giorno.exercises.indexOf(ex);
    const chiIdx = chiMiHaAbbinato(giorno, mieIdx);
    if(chiIdx >= 0) return ` · Superset con ${giorno.exercises[chiIdx].name}`;
  }
  return '';
}

// Collega questo esercizio (l'iniziatore) al suo partner per il superset. Il
// legame è a senso unico: solo l'iniziatore passa a "tecnica: superset" — il
// partner non viene toccato, così scegliere il superset su un esercizio non
// attiva automaticamente anche l'editor dell'altro. Per sapere chi è stato
// scelto come partner da qualcun altro (e mostrarglielo comunque in etichetta)
// c'è chiMiHaAbbinato() più sotto.
function scollegaSuperset(giorno, idx){
  const ex = giorno.exercises[idx];
  if(ex) delete ex.supersetCon;
}
function collegaSuperset(giorno, idxIniziatore, idxPartner){
  const ex = giorno.exercises[idxIniziatore];
  if(!ex || !giorno.exercises[idxPartner]) return;
  ex.supersetCon = idxPartner;
}
// L'esercizio a cui punta idx è quello scelto come partner; questa invece
// cerca il verso opposto — chi, in questo giorno, ha scelto idx come partner.
function chiMiHaAbbinato(giorno, idx){
  return (giorno.exercises||[]).findIndex(e=>e && e.supersetCon === idx);
}

// Il popup ora serve solo a GESTIRE il video di un esercizio (vedere qual è,
// cercarlo su YouTube, incollarne uno nuovo). Guardarlo (▶) non apre più
// nessun popup: apre direttamente quello che c'è, così lo vede per intero,
// senza il riquadro che a volte resta nero per via dei siti che bloccano
// l'anteprima (una regola del sito/browser, non dell'app).
//
// Il link degli esercizi della libreria base lo può cambiare solo chi
// amministra l'app; il link di un esercizio personale lo gestisce sempre
// chi lo ha creato.
async function openVideoPopup(nome, url){
  _vidUrl = url; _vidNome = nome || "Video";
  document.getElementById('vidTitle').textContent = _vidNome;
  document.getElementById('vidOverlay').classList.add('show');

  const lib = (typeof libFind === 'function') ? libFind(nome) : null;
  document.getElementById('vidAltDesc').textContent = lib ? lib.d : "";
  let host = "";
  try{ host = new URL(url).hostname.replace(/^www\./,''); }catch(e){}
  const _paste = document.getElementById('vidPasteInput');
  if(_paste) _paste.value = "";
  const eRicercaGenerica = (url === youtubeSearchUrl(nome));
  const btnApri = document.getElementById('vidOpenTab2');
  const btnYoutube = document.getElementById('vidYoutube');
  if(eRicercaGenerica){
    btnApri.style.display = 'none';
    btnYoutube.classList.remove('secondary');
  } else {
    btnApri.style.display = 'inline-block';
    btnYoutube.classList.add('secondary');
  }

  // il link degli esercizi di base lo cambia solo l'amministratore;
  // quello degli esercizi personali lo cambia sempre chi li ha creati
  const puoModificare = esercizioDiBase(nome) ? sonoAmministratore() : true;
  document.getElementById('vidIncollaBox').style.display = puoModificare ? 'block' : 'none';
  document.getElementById('vidSoloAdminMsg').style.display = puoModificare ? 'none' : 'block';

  if(!puoModificare){
    document.getElementById('vidAltMsg').textContent =
      host ? `Video attuale: ${host}.` : "Nessun video assegnato a questo esercizio.";
  } else if(eRicercaGenerica){
    document.getElementById('vidAltMsg').textContent =
      "Non c'è ancora un video assegnato a questo esercizio: tocca qui sotto per cercarlo su YouTube, oppure incolla direttamente il link giusto.";
  } else {
    document.getElementById('vidAltMsg').textContent =
      host ? `Video attuale: ${host}. Incolla un altro link qui sotto per sostituirlo.`
           : "Incolla qui sotto il link del video.";
  }
}

async function apriAltrove(url){
  if(senzaRitorno()){
    // qui uscire significa non poter tornare: copio il link invece di navigare
    const ok = await copiaNegliAppunti(url);
    const box = document.getElementById('vidUrlBox');
    if(box){ box.style.display='block'; box.textContent = url; }
    toast(ok ? "Link copiato ✓ aprilo nel browser e torna qui"
             : "Tieni premuto sull'indirizzo qui sotto per copiarlo");
    return;
  }
  window.open(url, '_blank', 'noopener');
}


// In alcune app che aprono file HTML (tipiche su iPhone) non c'e' il tasto indietro:
// se si apre un indirizzo esterno non si torna piu' all'app. In quel caso non
// navighiamo mai fuori: si copia il link e si incolla il video qui dentro.
let _senzaRitorno = null;
function senzaRitorno(){
  // Restava dai tempi in cui l'app girava dentro un visualizzatore di file senza
  // tasto indietro. Ora è una PWA installata: dai link si torna sempre.
  return false;
}
function _senzaRitornoVecchio(){
  if(_senzaRitorno !== null) return _senzaRitorno;
  // niente barra del browser attorno alla pagina = quasi certamente un visualizzatore di file
  const dentroApp = (window.navigator.standalone === true)
    || window.matchMedia('(display-mode: standalone)').matches
    || (location.protocol === 'file:');
  _senzaRitorno = dentroApp && schermoPiccolo();
  return _senzaRitorno;
}

async function copiaNegliAppunti(testo){
  try{
    if(navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(testo); return true; }
  }catch(e){}
  try{   // ripiego per i browser che non permettono l'accesso diretto agli appunti
    const ta = document.createElement('textarea');
    ta.value = testo; ta.setAttribute('readonly','');
    ta.style.position='fixed'; ta.style.top='-1000px';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, testo.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch(e){ return false; }
}

document.getElementById('vidCopia').addEventListener('click', async ()=>{
  const ok = await copiaNegliAppunti(_vidUrl);
  toast(ok ? "Link copiato ✓ incollalo nel browser" : "Non riesco a copiare: tieni premuto sull'indirizzo qui sotto");
  const box = document.getElementById('vidUrlBox');
  if(box){ box.style.display='block'; box.textContent = _vidUrl; }
});

document.getElementById('vidPasteBtn').addEventListener('click', ()=>{
  const inp = document.getElementById('vidPasteInput');
  const url = inp.value.trim();
  if(!url){ toast("Incolla prima l'indirizzo del video."); return; }
  if(!urlIncorporabile(url) && !urlFileVideo(url)){
    toast("Serve un link YouTube, Vimeo, Google Drive o simile.");
    return;
  }
  const eBase = esercizioDiBase(_vidNome);
  if(eBase && !sonoAmministratore()){
    toast("Il video di questo esercizio, della libreria base, lo gestisce solo chi amministra l'app.");
    return;
  }
  if(eBase){
    const lib = libFind(_vidNome);
    const chiave = (lib ? lib.n : _vidNome).toLowerCase();
    state.baseExerciseVideos[chiave] = url;
  } else {
    // esercizio personale: il video lo salvo su chi lo ha creato (io, o il
    // cliente se lo sto costruendo per lui come PT), mai sulla libreria base
    const prof = activeProfile();
    const chiave = _vidNome.trim().toLowerCase();
    if(prof){
      if(!prof.customExercises) prof.customExercises = {};
      if(!prof.customExercises[chiave]) prof.customExercises[chiave] = { muscles: getExerciseMuscles(_vidNome) || [], video: '' };
      prof.customExercises[chiave].video = url;
    }
  }
  save();
  inp.value = "";
  if(typeof renderBaseExerciseList === 'function' && document.getElementById('baseExList')) renderBaseExerciseList();
  if(typeof renderCustomExList === 'function' && document.getElementById('customExList')) renderCustomExList();
  if(typeof renderGlossario === 'function' && GL_BUILT) renderGlossario();
  toast("Video salvato ✓");
  openVideoPopup(_vidNome, url);          // lo mostro subito
});


document.getElementById('vidYoutube').addEventListener('click', ()=>{
  apriAltrove(youtubeSearchUrl(_vidNome));
});
document.getElementById('vidOpenTab2').addEventListener('click', ()=>{
  if(!_vidUrl) return;
  apriAltrove(_vidUrl);
});

function closeVideoPopup(){
  document.getElementById('vidOverlay').classList.remove('show');
}
document.getElementById('vidClose').addEventListener('click', closeVideoPopup);
document.getElementById('vidOverlay').addEventListener('click', e=>{
  if(e.target.id==='vidOverlay') closeVideoPopup();
});
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && document.getElementById('vidOverlay').classList.contains('show')) closeVideoPopup();
});
// il tasto "▶ Video" apre direttamente quello che c'è assegnato (link o
// ricerca YouTube), senza popup: niente più riquadro nero.
// il tastino "⋯" apre invece il pannello per vedere/cambiare il video.
document.addEventListener('click', e=>{
  const g = e.target.closest('[data-gestisci]');
  if(!g) return;
  e.preventDefault(); e.stopPropagation();
  const nome = g.dataset.gestisci;
  openVideoPopup(nome, getExerciseVideoInfo(nome).url);
}, true);

document.addEventListener('click', e=>{
  const a = e.target.closest('a.video-link, a.mp-video');
  if(!a) return;
  e.preventDefault();
  e.stopPropagation();
  apriAltrove(a.getAttribute('href'));
}, true);

function schermoPiccolo(){
  return window.matchMedia('(max-width: 900px)').matches
      || ('ontouchstart' in window && window.innerWidth < 1100);
}


// ============================================================
// REGISTRAZIONE IN CORSO — non si perde cambiando scheda o riaprendo l'app.
// Viene salvata insieme agli altri dati del profilo e cancellata solo quando
// si salva l'allenamento o si preme "Pulisci la registrazione".
// ============================================================
let _bozzaPronta = false;   // evita di salvare mentre si sta ripristinando

function salvaBozza(){
  if(!_bozzaPronta) return;
  const prof = activeProfile();
  const p = activeProgram();
  if(!prof || !p) return;
  if(selectedDayKey===null || selectedDayKey==="SKIP"){ prof.bozzaLog = null; save(); return; }
  const note = document.getElementById('logNotes').value;
  const qualcosaScritto = Object.keys(currentSetInputs).some(n =>
    (currentSetInputs[n]||[]).some(s => CAMPI_SERIE.some(k=>s[k])));
  // niente da conservare: nessun dato inserito e nessun esercizio libero scelto
  if(!qualcosaScritto && !note.trim() && !(selectedDayKey==="LIBERO" && FREE_DAY.exercises.length)){
    prof.bozzaLog = null; save(); return;
  }
  prof.bozzaLog = {
    programId: p.id,
    data: document.getElementById('logDate').value,
    dayKey: selectedDayKey,
    liberi: selectedDayKey==="LIBERO" ? FREE_DAY.exercises.map(e=>({name:e.name, sets:e.sets, reps:e.reps, muscles:e.muscles})) : null,
    serie: JSON.parse(JSON.stringify(currentSetInputs)),
    note: note,
    quando: new Date().toISOString(),
    iniziatoAlle: _logIniziatoAlle,
    allenamentoATempo: _allenamentoATempo,
    allenamentoATempoBloccato: _allenamentoATempoBloccato
  };
  save();
}

function pulisciBozza(silenzioso){
  const prof = activeProfile();
  if(prof){ prof.bozzaLog = null; save(); }
  currentSetInputs = {};
  FREE_DAY.exercises = [];
  selectedDayKey = null;
  _logIniziatoAlle = null;
  _allenamentoATempo = false;
  _allenamentoATempoBloccato = false;
  _riscaldamentoNascosto = false;
  document.getElementById('logNotes').value = "";
  document.getElementById('bozzaBanner').style.display = 'none';
  document.getElementById('riscaldamentoCard').style.display = 'none';
  document.getElementById('exerciseFormCard').style.display = 'none';
  document.getElementById('notesCard').style.display = 'none';
  document.getElementById('saveLogBtn').style.display = 'none';
  document.getElementById('freeAddExBtn').style.display = 'none';
  document.getElementById('freeAddExManualeBtn2').style.display='none';
  document.getElementById('freeEmptyHint').style.display = 'none';
  renderDayChoices();
  if(!silenzioso) toast("Registrazione pulita");
}

function ripristinaBozza(){
  const prof = activeProfile();
  const p = activeProgram();
  const b = prof && prof.bozzaLog;
  if(!b || !p || b.programId !== p.id) return false;

  _bozzaPronta = false;
  const _dateEl = document.getElementById('logDate');
  _dateEl.value = b.data || _dateEl.value;

  if(b.dayKey === "LIBERO"){
    // prima selectDay, che azzera l'elenco, poi rimetto gli esercizi salvati
    selectDay("LIBERO");
    FREE_DAY.exercises = (b.liberi||[]).slice();
    if(FREE_DAY.exercises.length){
      buildExerciseForm(FREE_DAY);
      document.getElementById('exerciseFormCard').style.display='block';
      document.getElementById('freeEmptyHint').style.display='none';
    }
  } else {
    selectDay(b.dayKey);
  }
  // selectDay (sopra) fa già ripartire il cronometro da "adesso": qui lo
  // rimpiazzo con l'orario vero di inizio, salvato nella bozza — altrimenti
  // ogni volta che riapri l'app durante un allenamento in corso la durata
  // registrata alla fine ripartirebbe da zero.
  _logIniziatoAlle = b.iniziatoAlle || _logIniziatoAlle;
  // stessa idea di _logIniziatoAlle qui sopra: selectDay le aveva già
  // azzerate, qui le rimetto com'erano quando è stata salvata la bozza —
  // altrimenti riaprire l'app a metà allenamento sbloccherebbe di nuovo
  // l'interruttore "allenamento a tempo" già bloccato.
  _allenamentoATempo = !!b.allenamentoATempo;
  _allenamentoATempoBloccato = !!b.allenamentoATempoBloccato;
  if(typeof aggiornaCronometroAllenamento === 'function') aggiornaCronometroAllenamento();

  // rimetto i valori digitati, aggiungendo le serie extra create al momento
  Object.keys(b.serie||{}).forEach(nome=>{
    const salvate = b.serie[nome];
    if(!currentSetInputs[nome]) return;
    while(currentSetInputs[nome].length < salvate.length) addSetRow(nome);
    salvate.forEach((s,i)=>{
      CAMPI_SERIE.forEach(f=>{
        if(s[f]===undefined || s[f]==='') return;
        if(!currentSetInputs[nome][i]) return;
        currentSetInputs[nome][i][f] = s[f];
        const inp = document.querySelector(`.exercise-block input[data-ex="${CSS.escape(nome)}"][data-idx="${i}"][data-field="${f}"]`);
        if(inp) inp.value = mostraValoreCampo(nome, f, s[f]);
      });
      if(s._fatta && currentSetInputs[nome][i]){
        currentSetInputs[nome][i]._fatta = true;
        const inpAny = document.querySelector(`.exercise-block input[data-ex="${CSS.escape(nome)}"][data-idx="${i}"]`);
        const riga = inpAny && inpAny.closest('.set-row');
        if(riga) riga.classList.add('fatta');
      }
    });
  });
  document.getElementById('logNotes').value = b.note || "";

  const quando = b.quando ? new Date(b.quando) : null;
  document.getElementById('bozzaText').textContent = quando
    ? `Stai riprendendo una registrazione lasciata a metà (${formatDate(b.data)}, ultimo salvataggio ${quando.getHours().toString().padStart(2,'0')}:${quando.getMinutes().toString().padStart(2,'0')}).`
    : "Stai riprendendo una registrazione lasciata a metà.";
  document.getElementById('bozzaBanner').style.display = 'block';

  _bozzaPronta = true;
  return true;
}

document.getElementById('pulisciBozzaBtn').addEventListener('click', ()=>{
  customConfirm("Pulire la registrazione in corso? I dati inseriti e non ancora salvati verranno persi.", ()=>pulisciBozza(false));
});
document.getElementById('logNotes').addEventListener('input', salvaBozza);
document.getElementById('logDate').addEventListener('change', salvaBozza);



// ============================================================
// LETTURA .XLSX SENZA LIBRERIE ESTERNE
// Un file Excel e' uno ZIP di file XML. Lo apriamo con gli strumenti che il
// browser ha gia' dentro, cosi' l'importazione funziona anche senza internet.
// ============================================================
function _u16(d,o){ return d.getUint16(o,true); }
function _u32(d,o){ return d.getUint32(o,true); }

async function _sgonfia(bytes, metodo){
  if(metodo === 0) return bytes;                       // archiviato senza compressione
  if(typeof DecompressionStream === 'undefined') throw new Error('browser troppo vecchio');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function _leggiZip(arrayBuffer, serve){
  const dati = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  // la mappa dell'archivio sta in fondo al file
  let eocd = -1;
  for(let i = dati.length - 22; i >= 0 && i > dati.length - 66000; i--){
    if(_u32(dv,i) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error('non è un file Excel valido');
  const nVoci = _u16(dv, eocd + 10);
  let p = _u32(dv, eocd + 16);
  const out = {};
  const dec = new TextDecoder();
  for(let k = 0; k < nVoci; k++){
    if(_u32(dv,p) !== 0x02014b50) break;
    const metodo   = _u16(dv, p + 10);
    const compSize = _u32(dv, p + 20);
    const lenNome  = _u16(dv, p + 28);
    const lenExtra = _u16(dv, p + 30);
    const lenComm  = _u16(dv, p + 32);
    const offLocale= _u32(dv, p + 42);
    const nome = dec.decode(dati.subarray(p + 46, p + 46 + lenNome));
    if(serve(nome)){
      const lnNome  = _u16(dv, offLocale + 26);
      const lnExtra = _u16(dv, offLocale + 28);
      const inizio  = offLocale + 30 + lnNome + lnExtra;
      out[nome] = await _sgonfia(dati.subarray(inizio, inizio + compSize), metodo);
    }
    p += 46 + lenNome + lenExtra + lenComm;
  }
  return out;
}

function _colonnaDaRif(rif){   // "AB12" -> 27
  let n = 0;
  for(const ch of rif){
    const c = ch.charCodeAt(0);
    if(c >= 65 && c <= 90) n = n * 26 + (c - 64); else break;
  }
  return n - 1;
}

async function leggiXlsx(arrayBuffer){
  const file = await _leggiZip(arrayBuffer, nome =>
    nome === 'xl/workbook.xml' || nome === 'xl/_rels/workbook.xml.rels' ||
    nome === 'xl/sharedStrings.xml' || /^xl\/worksheets\/[^/]+\.xml$/.test(nome));
  const dec = new TextDecoder();
  const parser = new DOMParser();
  const xml = k => file[k] ? parser.parseFromString(dec.decode(file[k]), 'application/xml') : null;

  // testi condivisi (Excel salva le stringhe una volta sola)
  let condivise = [];
  const ss = xml('xl/sharedStrings.xml');
  if(ss){
    condivise = Array.from(ss.getElementsByTagName('si')).map(si =>
      Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join(''));
  }

  // nome del foglio -> file, passando dalle relazioni del documento
  const rels = {};
  const rx = xml('xl/_rels/workbook.xml.rels');
  if(rx) Array.from(rx.getElementsByTagName('Relationship')).forEach(r=>{
    rels[r.getAttribute('Id')] = r.getAttribute('Target').replace(/^\/?xl\//,'').replace(/^\.\//,'');
  });
  const fogli = [];
  const wb = xml('xl/workbook.xml');
  if(wb) Array.from(wb.getElementsByTagName('sheet')).forEach(s=>{
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    const target = rels[rid];
    if(target) fogli.push({nome: s.getAttribute('name')||'', path: 'xl/' + target});
  });
  if(fogli.length === 0){
    Object.keys(file).filter(k=>k.startsWith('xl/worksheets/')).sort()
      .forEach(k=>fogli.push({nome:'', path:k}));
  }

  function righeDi(path){
    const doc = xml(path);
    if(!doc) return [];
    const righe = [];
    Array.from(doc.getElementsByTagName('row')).forEach(r=>{
      const riga = [];
      Array.from(r.getElementsByTagName('c')).forEach(cel=>{
        const idx = _colonnaDaRif(cel.getAttribute('r') || '');
        const tipo = cel.getAttribute('t');
        let val = '';
        if(tipo === 'inlineStr'){
          val = Array.from(cel.getElementsByTagName('t')).map(t=>t.textContent).join('');
        } else {
          const v = cel.getElementsByTagName('v')[0];
          val = v ? v.textContent : '';
          if(tipo === 's') val = condivise[parseInt(val,10)] || '';
        }
        riga[idx >= 0 ? idx : riga.length] = val;
      });
      righe.push(riga);
    });
    return righe;
  }

  // prendo il foglio che contiene davvero l'elenco esercizi, non le istruzioni
  const utile = righe => (righe[0]||[]).some(h => String(h||'').toLowerCase().trim().startsWith('esercizio'));
  const perNome = fogli.find(f => /video|esercizi/i.test(f.nome));
  const ordine = perNome ? [perNome, ...fogli.filter(f=>f!==perNome)] : fogli;
  for(const f of ordine){
    const righe = righeDi(f.path);
    if(utile(righe)) return righe;
  }
  return ordine.length ? righeDi(ordine[0].path) : [];
}

// ============================================================
// IMPORT LINK VIDEO — logica unica per Excel e CSV.
// Individua le colonne dall'intestazione, cosi' funziona sia col file esportato
// dall'app sia col foglio piu' ricco da compilare a mano.
// ============================================================
function importaRigheVideo(rows){
  const nameToKey = {};
  Object.keys(EXERCISE_MUSCLE_MAP).forEach(k=>{ nameToKey[k.toLowerCase()] = k; });
  EX_LIB.forEach(e=>{ const k = e.n.toLowerCase(); if(!nameToKey[k]) nameToKey[k] = k; });

  const norm = s => (s==null ? '' : String(s))
    .replace(/\u00A0/g,' ')        // spazio unificatore incollato da Excel
    .replace(/[\u2018\u2019\u2032]/g,"'")   // apostrofi "curvi"
    .replace(/\s+/g,' ')
    .trim();

  const header = (rows[0]||[]).map(h=>norm(h).toLowerCase());
  let colName = header.findIndex(h=>h.startsWith('esercizio'));
  let colVideo = header.findIndex(h=>h.includes('link'));
  const conIntestazione = (colName>=0 || colVideo>=0);
  if(colName<0) colName = 0;
  if(colVideo<0) colVideo = 1;

  let aggiornati = 0, rimossi = 0;
  const scartate = [];
  rows.slice(conIntestazione ? 1 : 0).forEach(row=>{
    if(!row) return;
    const rawName = norm(row[colName]);
    let rawVideo = norm(row[colVideo]);
    if(!rawName) return;
    if(/^(nan|undefined|null)$/i.test(rawVideo)) rawVideo = '';
    const key = nameToKey[rawName.toLowerCase()];
    if(!key){ scartate.push(rawName); return; }
    if(rawVideo){
      if(!/^https?:\/\//i.test(rawVideo)){ scartate.push(rawName + " (link non valido)"); return; }
      state.baseExerciseVideos[key] = rawVideo; aggiornati++;
    } else {
      if(state.baseExerciseVideos[key]) rimossi++;
      delete state.baseExerciseVideos[key];
    }
  });
  return {aggiornati, rimossi, scartate};
}

