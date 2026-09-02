// PRIMO ACCESSO: sesso, peso, altezza, attività fisica
// ============================================================
let _onboardingMostrata = false;
function controllaOnboarding(){
  if(modalitaPT) return;   // mai sopra la sessione di modifica come PT
  const p = activeProfile();
  const gate = document.getElementById('onboardingGate');
  if(!gate || !p) return;
  if(!p.sesso && !_onboardingMostrata){
    _onboardingMostrata = true;
    document.getElementById('onbDataNascita').value = p.dataNascita || '';
    const prog = activeProgram();
    if(prog && prog.dietInfo){
      document.getElementById('onbPeso').value = prog.dietInfo.peso || '';
      document.getElementById('onbAltezza').value = prog.dietInfo.altezza || '';
      document.getElementById('onbAttivita').value = prog.dietInfo.attivita || '';
    }
    gate.style.display = 'block';
  }
}

document.querySelectorAll('#onbSesso .seg-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#onbSesso .seg-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  });
});

function salvaSesso(nuovoSesso){
  const p = activeProfile();
  if(!p) return;
  const eraSesso = p.sesso;
  p.sesso = nuovoSesso;
  if(eraSesso !== nuovoSesso) ricostruisciFiguraCorpo();
  save();
  if(typeof modalitaOnline === 'function' && modalitaOnline()) inviaOnline();
}

document.getElementById('onbContinua').addEventListener('click', ()=>{
  const sessoBtn = document.querySelector('#onbSesso .seg-btn.active');
  const sesso = sessoBtn ? sessoBtn.dataset.val : null;
  if(!sesso){ toast("Scegli uomo o donna per continuare."); return; }
  salvaSesso(sesso);

  const p = activeProfile();
  const dataNascita = document.getElementById('onbDataNascita').value;
  if(dataNascita && p) p.dataNascita = dataNascita;

  const peso = document.getElementById('onbPeso').value.trim();
  const altezza = document.getElementById('onbAltezza').value.trim();
  const attivita = document.getElementById('onbAttivita').value.trim();

  if(p){
    // L'altezza va scritta anche nel profilo (Account → Dati fisici): è da lì,
    // non dalla scheda alimentare qui sotto, che il fabbisogno calorico la
    // legge — altrimenti restava chiesta di nuovo in Account e "mancante"
    // nel calcolo del fabbisogno anche subito dopo averla inserita qui.
    // Segnalato il 25/08/2026.
    const altezzaNum = parseFloat(altezza);
    if(altezzaNum && altezzaNum > 0) p.altezza = altezzaNum;

    // Il peso va registrato anche come misurazione in Storico → Misure: è da
    // lì, non dalla scheda alimentare, che il fabbisogno calorico prende il
    // peso — così compare anche nel grafico dello storico, invece di restare
    // invisibile dentro la sola scheda alimentare.
    const pesoNum = parseFloat(peso);
    if(pesoNum && pesoNum > 0){
      const oggi = new Date().toISOString().slice(0,10);
      const precedente = p.measurements.find(m=>m.date===oggi);
      p.measurements = p.measurements.filter(m=>m.date!==oggi);
      p.measurements.push({
        date: oggi, weight: pesoNum,
        waist: precedente ? precedente.waist : null,
        extra: (precedente && precedente.extra) || {}
      });
      p.measurements.sort((a,b)=>a.date.localeCompare(b.date));
    }
  }

  const prog = activeProgram();
  if(prog){
    if(!prog.dietInfo) prog.dietInfo = defaultDietInfo();
    if(peso) prog.dietInfo.peso = peso;
    if(altezza) prog.dietInfo.altezza = altezza;
    if(attivita) prog.dietInfo.attivita = attivita;
  }

  save();
  if(typeof modalitaOnline === 'function' && modalitaOnline()) inviaOnline();

  document.getElementById('onboardingGate').style.display = 'none';
  renderHeader();
  renderMeasurements();
});
document.getElementById('onbSalta').addEventListener('click', ()=>{
  document.getElementById('onboardingGate').style.display = 'none';
});

function mpSelectZone(slug){
  mpZone = slug;
  document.querySelectorAll('#mpOverlay .mp-zone-g').forEach(g=>{
    g.classList.toggle('active', g.dataset.slug===slug);
  });
  document.getElementById('mpSearch').value = "";
  mpRenderList(exercisesForZone(slug), ZONE_LABEL[slug]===ZONE_GROUP[slug] ? ZONE_LABEL[slug] : `${ZONE_LABEL[slug]} — ${ZONE_GROUP[slug]}`);
  // su telefono figure e lista sono impilate: porto la lista in vista
  if(window.innerWidth < 760){
    const body = document.querySelector('.mp-body');
    const side = document.querySelector('.mp-side');
    if(body && side) body.scrollTo({ top: Math.max(0, side.offsetTop - 8), behavior:'smooth' });
  }
}

function mpRenderList(list, titolo){
  document.getElementById('mpZoneTitle').textContent = titolo;
  const box = document.getElementById('mpList');
  if(list.length===0){
    box.innerHTML = '<div class="empty">Nessun esercizio per questa zona.</div>';
    return;
  }
  box.innerHTML = "";
  list.forEach(ex=>{
    const row = document.createElement('div');
    row.className = 'mp-ex';
    row.innerHTML = `
      <div class="mp-ex-main">
        <div class="mp-ex-name">${ex.n}</div>
        <div class="mp-ex-desc">${ex.d}</div>
        <div class="mp-ex-tags">
          <span class="mp-tag">${ex.g}</span>
          ${(ex.tipo && ex.tipo.indexOf('tempo')===0) || ex.tempo?'<span class="mp-tag time">a tempo</span>':''}
          <a class="mp-video" href="${escapeAttr(getExerciseVideoInfo(ex.n).url)}" data-ex-name="${escapeAttr(ex.n)}">▶ Video</a>
        <button type="button" class="mp-video-gestisci" data-gestisci="${escapeAttr(ex.n)}" title="Scegli quale video usare">⋯</button>
        </div>
      </div>
      <button type="button" class="mp-add" aria-label="Aggiungi ${ex.n}">+</button>`;
    const _v = row.querySelector('.mp-video');
    if(_v) _v.addEventListener('click', e=>e.stopPropagation());
    row.querySelector('.mp-add').addEventListener('click', ()=>{
      if(mpOnPick) mpOnPick(ex);
      row.classList.add('added');
      row.querySelector('.mp-add').textContent = '✓';
      setTimeout(()=>{ row.classList.remove('added'); row.querySelector('.mp-add').textContent='+'; }, 900);
    });
    box.appendChild(row);
  });
}

function openMusclePicker(titolo, onPick){
  mpBuildAll();
  resetFigureZoom(document.getElementById('mpFront'));
  resetFigureZoom(document.getElementById('mpBack'));
  mpOnPick = onPick;
  mpZone = null;
  document.getElementById('mpTitle').textContent = titolo || "Scegli un esercizio";
  document.getElementById('mpSearch').value = "";
  document.querySelectorAll('#mpOverlay .mp-zone-g').forEach(g=>g.classList.remove('active'));
  document.getElementById('mpZoneTitle').textContent = "Tocca un muscolo sulla figura";
  document.getElementById('mpList').innerHTML =
    '<div class="empty">Scegli una zona del corpo (il petto è diviso in alto, medio e basso) oppure cerca un esercizio per nome.</div>';
  document.getElementById('mpOverlay').classList.add('show');
}
function closeMusclePicker(){
  document.getElementById('mpOverlay').classList.remove('show');
  mpOnPick = null;
}
document.getElementById('mpCreaNuovo').addEventListener('click', ()=>{
  const nomeCercato = document.getElementById('mpSearch').value.trim();
  const callbackCorrente = mpOnPick;
  apriCreaEsercizio(nomeCercato, (ex)=>{
    if(callbackCorrente) callbackCorrente(ex);
    closeMusclePicker();
  });
});

// ============================================================
// CREA ESERCIZIO AL VOLO — richiamabile da qualunque punto in cui si sceglie
// un esercizio per la scheda (selettore muscoli, riga vuota), senza uscire
// dalla schermata. Resta anche fra i propri esercizi personali.
// ============================================================
let creaEsMuscoliScelti = [];
let creaEsCallback = null;

function apriCreaEsercizio(nomeIniziale, callback){
  creaEsCallback = callback;
  creaEsMuscoliScelti = [];
  document.getElementById('creaEsNome').value = nomeIniziale || '';
  const wrap = document.getElementById('creaEsMuscoli');
  wrap.innerHTML = MUSCLE_ZONES_FINE.map(m=>`<div class="muscle-chip" data-m="${m}">${etichettaZonaFine(m)}</div>`).join('');
  wrap.querySelectorAll('.muscle-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const m = chip.dataset.m;
      if(creaEsMuscoliScelti.includes(m)) creaEsMuscoliScelti = creaEsMuscoliScelti.filter(x=>x!==m);
      else creaEsMuscoliScelti.push(m);
      chip.classList.toggle('selected');
    });
  });
  const sel = document.getElementById('creaEsTipo');
  sel.innerHTML = Object.entries(TIPI_MISURA).map(([k,v])=>`<option value="${k}">${v.nome}</option>`).join('');
  document.getElementById('creaEsVideo').value = '';
  document.getElementById('creaEsOverlay').classList.add('show');
  setTimeout(()=>document.getElementById('creaEsNome').focus(), 50);
}
function chiudiCreaEsercizio(){
  document.getElementById('creaEsOverlay').classList.remove('show');
  creaEsCallback = null;
}
document.getElementById('creaEsClose').addEventListener('click', chiudiCreaEsercizio);
document.getElementById('creaEsConferma').addEventListener('click', ()=>{
  const nome = document.getElementById('creaEsNome').value.trim();
  if(!nome){ toast("Scrivi il nome dell'esercizio."); return; }
  if(creaEsMuscoliScelti.length===0){ toast("Seleziona almeno un gruppo muscolare."); return; }
  const lp = activeProfile();
  if(!lp.customExercises) lp.customExercises = {};
  const video = document.getElementById('creaEsVideo').value.trim();
  const tipo = document.getElementById('creaEsTipo').value || 'peso';
  lp.customExercises[nome.toLowerCase()] = { muscles:[...creaEsMuscoliScelti], video, tipo };
  save();
  toast(`"${nome}" creato ✓`);
  const cb = creaEsCallback;
  chiudiCreaEsercizio();
  if(cb) cb({ n: nome, g: creaEsMuscoliScelti[0], tempo: tipo.indexOf('tempo')===0 });
  if(typeof renderCustomExList === 'function') renderCustomExList();
});


// ============================================================
// ZOOM DELLA FIGURA (confinato al riquadro)
// Lavora sul viewBox dell'SVG: le coordinate restano coerenti,
// quindi i click sulle zone continuano a colpire il muscolo giusto.
// ============================================================
function enableFigureZoom(svg){
  if(!svg || svg.__zoomReady) return;
  const b = svg.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
  const base = {x:b[0], y:b[1], w:b[2], h:b[3]};
  const vb = Object.assign({}, base);
  const MIN_W = base.w/6;          // zoom massimo 6x
  const pointers = new Map();
  let panning=false, last=null, lastDist=0, moved=0, suppressClick=false;

  const isZoomed = ()=> vb.w < base.w - 0.5;
  function apply(){
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    svg.classList.toggle('zoomed', isZoomed());
    const box = svg.parentElement.querySelector('.zoom-ctrl');
    if(box){
      box.querySelector('[data-zoom="out"]').disabled = !isZoomed();
      box.querySelector('[data-zoom="reset"]').disabled = !isZoomed();
      box.querySelector('[data-zoom="in"]').disabled = vb.w <= MIN_W + 0.5;
    }
  }
  function clamp(){
    vb.w = Math.min(base.w, Math.max(MIN_W, vb.w));
    vb.h = vb.w * base.h / base.w;
    vb.x = Math.min(base.x + base.w - vb.w, Math.max(base.x, vb.x));
    vb.y = Math.min(base.y + base.h - vb.h, Math.max(base.y, vb.y));
  }
  function zoomAt(factor, clientX, clientY){
    const r = svg.getBoundingClientRect();
    if(!r.width || !r.height) return;
    const px = vb.x + (clientX - r.left)/r.width  * vb.w;
    const py = vb.y + (clientY - r.top )/r.height * vb.h;
    const newW = Math.min(base.w, Math.max(MIN_W, vb.w/factor));
    const k = newW / vb.w;
    vb.x = px - (px - vb.x)*k;
    vb.y = py - (py - vb.y)*k;
    vb.w = newW;
    clamp(); apply();
  }
  function reset(){ Object.assign(vb, base); apply(); }
  svg.__zoom = { zoomAt, reset, centerOf(){ const r=svg.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; } };

  svg.addEventListener('wheel', e=>{
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.18 : 1/1.18, e.clientX, e.clientY);
  }, {passive:false});

  svg.addEventListener('pointerdown', e=>{
    pointers.set(e.pointerId, e);
    if(pointers.size===1){ panning = isZoomed(); moved = 0; last = {x:e.clientX, y:e.clientY}; }
    if(pointers.size===2){
      panning = false;
      const [a,c2] = [...pointers.values()];
      lastDist = Math.hypot(a.clientX-c2.clientX, a.clientY-c2.clientY);
    }
  });
  svg.addEventListener('pointermove', e=>{
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    if(pointers.size>=2){
      const [a,c2] = [...pointers.values()];
      const d = Math.hypot(a.clientX-c2.clientX, a.clientY-c2.clientY);
      if(lastDist>0 && d>0){ zoomAt(d/lastDist, (a.clientX+c2.clientX)/2, (a.clientY+c2.clientY)/2); moved += 20; }
      lastDist = d;
      return;
    }
    // il trascinamento sposta la figura solo quando e' ingrandita
    if(panning && last && isZoomed()){
      const r = svg.getBoundingClientRect();
      const dx = (e.clientX - last.x)/r.width  * vb.w;
      const dy = (e.clientY - last.y)/r.height * vb.h;
      moved += Math.abs(e.clientX-last.x) + Math.abs(e.clientY-last.y);
      vb.x -= dx; vb.y -= dy;
      clamp(); apply();
      last = {x:e.clientX, y:e.clientY};
    }
  });
  function endPointer(e){
    pointers.delete(e.pointerId);
    if(pointers.size<2) lastDist = 0;
    if(pointers.size===0){
      panning = false;
      // se ho trascinato o pizzicato, il click che segue non deve selezionare un muscolo
      if(moved > 6){ suppressClick = true; setTimeout(()=>{ suppressClick = false; }, 0); }
      moved = 0;
    }
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('click', e=>{
    if(suppressClick){ e.stopPropagation(); e.preventDefault(); }
  }, true);

  // comandi + / − / adatta
  if(!svg.parentElement.querySelector('.zoom-ctrl')){
    const box = document.createElement('div');
    box.className = 'zoom-ctrl';
    box.innerHTML = `<button type="button" data-zoom="in" aria-label="Ingrandisci">+</button>
      <button type="button" data-zoom="out" aria-label="Riduci">−</button>
      <button type="button" class="reset" data-zoom="reset" aria-label="Adatta al riquadro">⤢</button>`;
    box.addEventListener('pointerdown', e=>e.stopPropagation());
    box.querySelectorAll('button').forEach(btn=>btn.addEventListener('click', e=>{
      e.stopPropagation();
      const c = svg.__zoom.centerOf();
      if(btn.dataset.zoom==='in')  svg.__zoom.zoomAt(1.5, c[0], c[1]);
      if(btn.dataset.zoom==='out') svg.__zoom.zoomAt(1/1.5, c[0], c[1]);
      if(btn.dataset.zoom==='reset') svg.__zoom.reset();
    }));
    svg.parentElement.appendChild(box);
  }

  svg.__zoomReady = true;
  apply();
}
function resetFigureZoom(svg){ if(svg && svg.__zoom) svg.__zoom.reset(); }





// ============================================================
// TIMER DI RECUPERO
// Conta il tempo fra una serie e l'altra. Va avanti anche cambiando scheda,
// perché si basa sull'orario di fine e non su un conteggio interno.
// ============================================================
let _timerFine = null, _timerTick = null, _timerDurata = 90;
let _suonoLoop = null, _ctxAudio = null;

// Il timer è personale: ognuno ha la sua durata, le sue scorciatoie e il suo suono.
function impostazioniTimer(){
  const prof = loggedInProfile();
  const dove = prof || state;                       // prima dell'accesso vale quello generale
  if(!dove.timer) dove.timer = {};
  const t = dove.timer;
  if(typeof t.durata !== 'number') t.durata = 90;
  if(typeof t.suono !== 'boolean') t.suono = true;
  // 3 scorciatoie, non più 4 (01/09/2026, richiesta esplicita): con 4 pulsanti
  // più "Avvia"/"×" la barra del timer non ci stava in una schermata di
  // telefono, l'ultimo veniva tagliato a metà sotto "Avvia".
  if(!Array.isArray(t.scorciatoie) || t.scorciatoie.length !== 3) t.scorciatoie = [60, 90, 120];
  return t;
}
function renderScorciatoieTimer(){
  const t = impostazioniTimer();
  const wrap = document.getElementById('timerPresets');
  if(!wrap) return;
  wrap.innerHTML = t.scorciatoie.map(s=>
    `<button type="button" data-sec="${s}">${formattaTempo(s)}</button>`).join('');
  wrap.querySelectorAll('button').forEach(btn=>btn.addEventListener('click', ()=>{
    wrap.querySelectorAll('button').forEach(b=>b.classList.toggle('scelto', b===btn));
    timerAvvia(parseInt(btn.dataset.sec,10));
  }));
}
function formattaTempo(sec){
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec/60), s = sec%60;
  return m + ":" + String(s).padStart(2,'0');
}
function timerAggiorna(){
  const disp = document.getElementById('timerDisplay');
  if(_timerFine === null){ disp.textContent = formattaTempo(_timerDurata); return; }
  const restano = (_timerFine - Date.now())/1000;
  if(restano <= 0){ disp.textContent = "0:00"; timerFinito(); return; }
  disp.textContent = formattaTempo(restano);
}
function timerAvvia(sec){
  // Sblocco l'audio QUI, non a ogni tocco nell'app (26/08, vedi nota su
  // sbloccaAudio()): questo è il momento in cui l'utente ha davvero scelto
  // di avviare un timer, l'unico caso in cui vale la pena di una sessione
  // audio che può mettere in pausa la musica di sottofondo.
  sbloccaAudio();
  fermaSuono();
  _timerDurata = sec || _timerDurata || impostazioniTimer().durata;
  _timerFine = Date.now() + _timerDurata*1000;
  document.getElementById('timerBar').classList.remove('suona');
  document.getElementById('timerAvvia').textContent = "Ferma";
  clearInterval(_timerTick);
  _timerTick = setInterval(timerAggiorna, 250);
  timerAggiorna();
}
function timerFerma(){
  _timerFine = null;
  clearInterval(_timerTick); _timerTick = null;
  fermaSuono();
  document.getElementById('timerAvvia').textContent = "Avvia";
  document.getElementById('timerBar').classList.remove('suona');
  document.querySelector('.toast').classList.remove('alzato');
  _timerDurata = impostazioniTimer().durata;
  timerAggiorna();
}
function timerFinito(){
  clearInterval(_timerTick); _timerTick = null;
  _timerFine = null;
  // resta in stato "finito" finché non premi Ferma: il messaggio sta dentro la barra,
  // così non si sovrappone all'avviso che compare in fondo allo schermo
  document.getElementById('timerBar').classList.add('suona');
  document.getElementById('timerAvvia').textContent = "Ferma";
  if(impostazioniTimer().suono) avviaSuonoRipetuto();
}

// ---------- suono di fine recupero ----------
// Su iPhone l'audio parte solo dopo che l'utente ha toccato lo schermo almeno una volta:
// per questo "sblocchiamo" il suono al primo tocco e teniamo pronto un file già caricato.
let _audioSveglia = null, _audioSbloccato = false;

function creaSuonoSveglia(){
  // genero un file audio con tre bip: più affidabile della sintesi al volo su iOS
  const freq = 44100, durata = 1.4;
  const n = Math.floor(freq * durata);
  const dati = new Int16Array(n);
  const bip = [[0.00,0.16],[0.22,0.38],[0.44,0.60]];   // tre bip ravvicinati
  for(let i=0;i<n;i++){
    const t = i/freq;
    let v = 0;
    for(const [da,a] of bip){
      if(t>=da && t<a){
        const dentro = (t-da)/(a-da);
        const inviluppo = Math.min(1, dentro*12) * Math.min(1, (1-dentro)*6);
        v += Math.sin(2*Math.PI*1050*t) * 0.55 * inviluppo;
        v += Math.sin(2*Math.PI*1575*t) * 0.18 * inviluppo;
      }
    }
    dati[i] = Math.max(-1, Math.min(1, v)) * 32767;
  }
  const byte = dati.length * 2;
  const buf = new ArrayBuffer(44 + byte);
  const dv = new DataView(buf);
  const scriviTesto = (off, s) => { for(let i=0;i<s.length;i++) dv.setUint8(off+i, s.charCodeAt(i)); };
  scriviTesto(0,'RIFF'); dv.setUint32(4, 36+byte, true); scriviTesto(8,'WAVEfmt ');
  dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true);
  dv.setUint32(24,freq,true); dv.setUint32(28,freq*2,true); dv.setUint16(32,2,true); dv.setUint16(34,16,true);
  scriviTesto(36,'data'); dv.setUint32(40, byte, true);
  new Int16Array(buf, 44).set(dati);
  const blob = new Blob([buf], {type:'audio/wav'});
  const a = new Audio(URL.createObjectURL(blob));
  a.loop = true;
  a.preload = 'auto';
  a.volume = 1;
  return a;
}

// Per abilitare l'audio serve un tocco dell'utente, ma NON deve sentirsi niente:
// uso un file muto di un centesimo di secondo, non la sveglia.
let _audioMuto = null;
function creaSuonoMuto(){
  const freq = 8000, n = 80;               // ~0,01 secondi di silenzio
  const buf = new ArrayBuffer(44 + n*2);
  const dv = new DataView(buf);
  const testo = (off, s) => { for(let i=0;i<s.length;i++) dv.setUint8(off+i, s.charCodeAt(i)); };
  testo(0,'RIFF'); dv.setUint32(4, 36+n*2, true); testo(8,'WAVEfmt ');
  dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true);
  dv.setUint32(24,freq,true); dv.setUint32(28,freq*2,true); dv.setUint16(32,2,true); dv.setUint16(34,16,true);
  testo(36,'data'); dv.setUint32(40, n*2, true);
  const a = new Audio(URL.createObjectURL(new Blob([buf], {type:'audio/wav'})));
  a.volume = 0;
  return a;
}
function sbloccaAudio(){
  if(_audioSbloccato) return;
  try{
    if(!_audioMuto) _audioMuto = creaSuonoMuto();
    const pr = _audioMuto.play();
    if(pr && pr.then) pr.then(()=>{ _audioSbloccato = true; }).catch(()=>{});
    // preparo anche la sveglia, senza però riprodurla
    if(!_audioSveglia){ _audioSveglia = creaSuonoSveglia(); _audioSveglia.load(); }
  }catch(e){}
}
// PRIMA (bug segnalato 26/08): questo sblocco partiva su QUALSIASI tocco/tasto
// in TUTTA l'app (listener globale su document, pointerdown/touchstart/keydown),
// quindi bastava aprire l'app e toccare una volta un punto qualsiasi — anche
// senza mai avvicinarsi al timer — per far partire il file audio muto e con
// esso una vera sessione audio del telefono, che su iOS/Android mette in
// pausa la musica in riproduzione (Spotify, Musica...) anche se il suono in
// sé non si sente. Ora `sbloccaAudio()` si chiama SOLO da `timerAvvia()`,
// cioè quando l'utente sceglie davvero di avviare un timer di recupero (dal
// bottone "Avvia" o da una scorciatoia) — mai per il solo fatto di aprire
// l'app o toccare qualcos'altro. Resta comunque un vero tocco dell'utente,
// quindi il browser continua a permettere il play() (serve per poter poi far
// suonare la sveglia più tardi, quando il timer arriva a zero, senza un
// nuovo gesto in quel momento).

function avviaSuonoRipetuto(){
  fermaSuono();
  try{
    if(!_audioSveglia) _audioSveglia = creaSuonoSveglia();
    _audioSveglia.currentTime = 0;
    _audioSveglia.muted = false;
    const pr = _audioSveglia.play();
    if(pr && pr.catch) pr.catch(()=>{});
  }catch(e){}
  if(navigator.vibrate){ try{ navigator.vibrate([400,200,400,200,400]); }catch(e){} }
  _suonoLoop = setInterval(()=>{
    if(navigator.vibrate){ try{ navigator.vibrate([400,200,400]); }catch(e){} }
  }, 1600);
  // rete di sicurezza: dopo due minuti smette da solo
  setTimeout(()=>{ if(_suonoLoop) fermaSuono(); }, 120000);
}
function fermaSuono(){
  if(_suonoLoop){ clearInterval(_suonoLoop); _suonoLoop = null; }
  if(_audioSveglia){ try{ _audioSveglia.pause(); _audioSveglia.currentTime = 0; }catch(e){} }
  if(navigator.vibrate){ try{ navigator.vibrate(0); }catch(e){} }
}
// prova del suono dalle impostazioni
function provaSuono(){
  sbloccaAudio();
  try{
    if(!_audioSveglia) _audioSveglia = creaSuonoSveglia();
    _audioSveglia.loop = false;
    _audioSveglia.currentTime = 0;
    const pr = _audioSveglia.play();
    if(pr && pr.catch) pr.catch(()=>toast("Il browser ha bloccato l'audio: tocca lo schermo e riprova"));
    setTimeout(()=>{ if(_audioSveglia) _audioSveglia.loop = true; }, 1600);
  }catch(e){ toast("Audio non disponibile su questo browser"); }
}

document.getElementById('timerAvvia').addEventListener('click', ()=>{
  const barra = document.getElementById('timerBar');
  if(barra.classList.contains('suona')){ timerFerma(); return; }   // sta suonando: lo zittisco
  if(_timerFine !== null) timerFerma(); else timerAvvia(_timerDurata || impostazioniTimer().durata);
});
document.getElementById('timerChiudi').addEventListener('click', ()=>{
  timerFerma();
  document.getElementById('timerBar').classList.remove('show');
  document.getElementById('timerApri').classList.add('show');
});
document.getElementById('timerApri').addEventListener('click', ()=>{
  document.getElementById('timerApri').classList.remove('show');
  document.getElementById('timerBar').classList.add('show');
  timerAggiorna();
});
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible' && _timerFine !== null) timerAggiorna();
});

// ---------- impostazioni del timer ----------
const SCORCIATOIE_TIMER = [45, 60, 90, 120, 150, 180, 240];
// ============================================================
// PROMEMORIA (notifiche push): un avviso sul telefono, anche ad app chiusa,
// nei giorni in cui la scheda prevede un allenamento non ancora registrato.
// L'invio parte da un controllo giornaliero lato server (Supabase); qui mi
// occupo solo di attivare/disattivare la ricezione su questo dispositivo.
// ============================================================
const VAPID_CHIAVE_PUBBLICA = "BLNF2KoXkgCvLsEZkR-4bA-TtAXDEybdoKTqtLuIbGo5Q-zXhklQho5eb5wNgv2-2ZZMNsYKNl48IWtQfUGw8Vc";

function base64UrlAUint8(base64Url){
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const uscita = new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) uscita[i] = raw.charCodeAt(i);
  return uscita;
}
function promemoriaSupportato(){
  return modalitaOnline() && !!sb && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}
async function renderPromemoria(){
  const card = document.getElementById('promemoriaCard');
  if(!promemoriaSupportato()){ card.style.display = 'none'; return; }
  card.style.display = 'block';
  const toggle = document.getElementById('promemoriaToggle');
  const stato = document.getElementById('promemoriaStato');
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    toggle.checked = !!sub;
    if(Notification.permission === 'denied'){
      stato.textContent = "Le notifiche sono bloccate per questa app nelle impostazioni del telefono: per attivarle, sbloccale da lì.";
    } else {
      stato.textContent = sub ? "Promemoria attivi su questo dispositivo." : "";
    }
  }catch(e){ console.error(e); }
}
async function attivaPromemoria(){
  const stato = document.getElementById('promemoriaStato');
  try{
    const permesso = await Notification.requestPermission();
    if(permesso !== 'granted'){
      document.getElementById('promemoriaToggle').checked = false;
      stato.textContent = "Permesso non concesso: non posso avvisarti.";
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: base64UrlAUint8(VAPID_CHIAVE_PUBBLICA) });
    }
    const { error } = await sb.from('push_subscriptions').upsert({
      profilo_id: utenteOnline.id,
      endpoint: sub.endpoint,
      subscription: sub.toJSON()
    }, { onConflict: 'profilo_id,endpoint' });
    if(error) throw error;
    const lp = loggedInProfile();
    if(lp){ lp.promemoria = true; save(); }
    stato.textContent = "Promemoria attivi su questo dispositivo.";
    toast("Promemoria attivati ✓");
  }catch(e){
    console.error(e);
    document.getElementById('promemoriaToggle').checked = false;
    stato.textContent = "Non sono riuscito ad attivarli: riprova.";
  }
}
async function disattivaPromemoria(){
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub){
      if(sb && utenteOnline) await sb.from('push_subscriptions').delete().eq('profilo_id', utenteOnline.id).eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    const lp = loggedInProfile();
    if(lp){ lp.promemoria = false; save(); }
    document.getElementById('promemoriaStato').textContent = "";
    toast("Promemoria disattivati");
  }catch(e){ console.error(e); }
}
document.getElementById('promemoriaToggle').addEventListener('change', (e)=>{
  if(e.target.checked) attivaPromemoria(); else disattivaPromemoria();
});
// 31/08/2026: il service worker (sw.js) si accorge da solo se il telefono
// rinnova/scade l'iscrizione push (evento pushsubscriptionchange) e manda
// qui la nuova iscrizione: la risalvo su Supabase con lo stesso upsert di
// attivaPromemoria(), altrimenti il server resterebbe puntato su un'iscrizione
// morta e il promemoria smetterebbe di funzionare senza che nulla lo segnali.
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', async (e)=>{
    if(!e.data || e.data.tipo !== 'PUSH_SUBSCRIPTION_RINNOVATA') return;
    try{
      if(!sb || !utenteOnline) return;
      const { error } = await sb.from('push_subscriptions').upsert({
        profilo_id: utenteOnline.id,
        endpoint: e.data.endpoint,
        subscription: e.data.subscription
      }, { onConflict: 'profilo_id,endpoint' });
      if(error) throw error;
      if(e.data.vecchioEndpoint && e.data.vecchioEndpoint !== e.data.endpoint){
        await sb.from('push_subscriptions').delete().eq('profilo_id', utenteOnline.id).eq('endpoint', e.data.vecchioEndpoint);
      }
      const lp = loggedInProfile();
      if(lp){ lp.promemoria = true; save(); }
    }catch(err){ console.error(err); }
  });
}

function renderImpostazioniTimer(){
  const t = impostazioniTimer();
  document.getElementById('timerDurataInput').value = t.durata;
  document.getElementById('timerSuonoChk').checked = t.suono;
  const wrap = document.getElementById('slotTimer');
  wrap.innerHTML = t.scorciatoie.map((s,i)=>`
    <div class="slot">
      <input type="number" class="slot-sec" data-i="${i}" min="5" max="900" step="5" inputmode="numeric" value="${s}">
      <span class="etichetta">${formattaTempo(s)}</span>
    </div>`).join('');
  wrap.querySelectorAll('.slot-sec').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const v = parseInt(inp.value,10);
      const et = inp.parentElement.querySelector('.etichetta');
      et.textContent = (!isNaN(v) && v>=5) ? formattaTempo(v) : '—';
    });
  });
}

document.getElementById('salvaScorciatoieBtn').addEventListener('click', ()=>{
  const valori = Array.from(document.querySelectorAll('#slotTimer .slot-sec'))
    .map(i=>parseInt(i.value,10));
  if(valori.some(v=>isNaN(v) || v < 5 || v > 900)){
    toast("Ogni tasto deve avere un valore fra 5 e 900 secondi.");
    return;
  }
  const t = impostazioniTimer();
  t.scorciatoie = valori;
  save();
  renderScorciatoieTimer();
  renderImpostazioniTimer();
  toast("Tasti rapidi salvati ✓");
});
document.getElementById('ripristinaScorciatoieBtn').addEventListener('click', ()=>{
  const t = impostazioniTimer();
  t.scorciatoie = [60, 90, 120];
  save();
  renderScorciatoieTimer();
  renderImpostazioniTimer();
  toast("Tasti rapidi ripristinati");
});
document.getElementById('timerDurataInput').addEventListener('change', (e)=>{
  const v = parseInt(e.target.value, 10);
  if(isNaN(v) || v < 10 || v > 900){ toast("Metti un valore fra 10 e 900 secondi."); renderImpostazioniTimer(); return; }
  impostazioniTimer().durata = v;
  save(); _timerDurata = v;
  renderImpostazioniTimer(); timerAggiorna();
  toast("Recupero predefinito: " + formattaTempo(v));
});
document.getElementById('provaSuonoBtn').addEventListener('click', provaSuono);
document.getElementById('timerSuonoChk').addEventListener('change', (e)=>{
  impostazioniTimer().suono = e.target.checked;
  save();
  if(!e.target.checked) fermaSuono();
  toast(e.target.checked ? "Suono attivo" : "Suono disattivato");
});

// il timer si vede solo mentre registro un allenamento
function aggiornaVisibilitaTimer(){
  const tabAttiva = document.querySelector('.tab-btn.active');
  const inRegistra = tabAttiva && tabAttiva.dataset.tab === 'log';
  const staAllenando = inRegistra && selectedDayKey && selectedDayKey !== 'SKIP';
  const bar = document.getElementById('timerBar');
  const apri = document.getElementById('timerApri');
  if(!staAllenando){
    bar.classList.remove('show');
    apri.classList.remove('show');
    return;
  }
  if(!bar.classList.contains('show') && !apri.classList.contains('show')){
    _timerDurata = _timerFine === null ? impostazioniTimer().durata : _timerDurata;
    bar.classList.add('show');
    timerAggiorna();
  }
  document.querySelector('.toast').classList.toggle('alzato', bar.classList.contains('show'));
}

// ============================================================
// "ULTIMA VOLTA" — cosa hai fatto l'ultima volta su questo esercizio.
// È il dato che serve davvero per decidere il carico della serie.
// ============================================================
function ultimaPrestazione(nomeEsercizio, escludiData){
  const prof = activeProfile();
  if(!prof) return null;
  const nome = (nomeEsercizio||'').trim().toLowerCase();
  const candidati = (prof.logs||[])
    .filter(l => l.status === 'registrato' && l.date !== escludiData)
    .sort((a,b) => b.date.localeCompare(a.date));
  for(const log of candidati){
    const ex = (log.exercises||[]).find(e => (e.name||'').trim().toLowerCase() === nome);
    if(!ex) continue;
    const serie = (ex.sets||[]).filter(s => CAMPI_SERIE.some(k=>s[k]));
    if(serie.length) return { data: log.date, serie };
  }
  return null;
}
// Passo in minuti/km (es. 6.5 -> "6:30") a partire dai minuti/km grezzi.
function formatPasso(minutiPerKm){
  if(!isFinite(minutiPerKm) || minutiPerKm <= 0) return '';
  const min = Math.floor(minutiPerKm);
  const sec = Math.round((minutiPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2,'0')}`;
}
function descriviSerie(serie, nomeEsercizio, dropset){
  const descriviUna = s => {
    if(s.km || s.minuti){
      const a = s.km ? s.km + ' km' : '';
      const b = s.minuti ? s.minuti + "'" : '';
      // Passo (min/km), solo se ci sono entrambi i valori e la distanza è
      // positiva: è il dato che chi corre guarda per davvero, non solo
      // "quanti km in quanti minuti" — es. "5 km in 30' (6:00 /km)".
      const passo = (s.km && s.minuti && s.km > 0) ? formatPasso(s.minuti / s.km) : '';
      return [a,b].filter(Boolean).join(' in ') + (passo ? ` (${passo} /km)` : '');
    }
    if(s.seconds){
      const m = nomeEsercizio ? moltiplicatoreCampo(nomeEsercizio, 'seconds') : 1;
      const unita = m === 3600 ? 'h' : (m === 60 ? 'min' : 's');
      return mostraValoreCampo(nomeEsercizio||'', 'seconds', s.seconds) + unita + (s.kg ? '×' + s.kg : '');
    }
    if(s.kg) return `${s.reps||'?'}×${s.kg}`;
    return `${s.reps||'?'}`;
  };
  // Se l'esercizio usa dropset/rest-pause, una lista piatta di valori (es.
  // "10×45, 6×30, 4×20, 10×45, ...") non fa capire quale fosse la serie
  // principale e quali le tappe successive di ogni round: la raggruppo ed
  // etichetto ogni pezzo, così "Ultima volta" si legge come si legge la scheda.
  //
  // Ogni riga salvata da quando esiste questo raggruppamento porta con sé la
  // propria "tappa" reale (0 = principale, 1/2/... = drop, vedi addSetRow):
  // uso QUELLA per trovare dove inizia ogni round, non il numero di tappe
  // della scheda di OGGI. La scheda può essere cambiata da quel giorno (più
  // o meno round, più o meno drop): raggruppare dati vecchi secondo la
  // struttura di oggi poteva tagliare male l'ultimo round e far sembrare
  // che "Ultima volta" non mostrasse tutto quello che era stato fatto.
  const haTappeSalvate = serie.some(s => typeof s.tappa === 'number');
  if(haTappeSalvate){
    const round = [];
    serie.forEach(s=>{
      if(s.tappa === 0 || round.length === 0) round.push([]);
      round[round.length-1].push(s);
    });
    if(round.length > 1){
      const tipo = dropset && dropset.tipo === 'restpause' ? 'rest-pause' : 'drop';
      return round.map((gruppo, idx)=>{
        const etichette = gruppo.map((s,j)=> j===0 ? descriviUna(s) : `${tipo} ${j} ${descriviUna(s)}`);
        return `Serie ${idx+1}: ${etichette.join(' → ')}`;
      }).join(' | ');
    }
    // un solo round trovato: stesso trattamento del caso "senza tappe" sotto
  } else {
    // Dati salvati PRIMA di questa correzione, senza tappa: nessun modo di
    // sapere davvero come erano strutturati quei round, quindi si stima in
    // base alla tecnica ATTUALE della scheda — la migliore informazione che
    // abbiamo, ma solo una stima se la scheda è cambiata nel frattempo.
    const tappePerRound = dropset && dropset.drops ? 1 + dropset.drops.length : 0;
    if(tappePerRound > 1 && serie.length > tappePerRound){
      const round = [];
      for(let k=0, idx=0; k<serie.length; k+=tappePerRound, idx++){
        const gruppo = serie.slice(k, k+tappePerRound);
        const etichette = gruppo.map((s,j)=> j===0 ? descriviUna(s)
          : `${dropset.tipo==='restpause'?'rest-pause':'drop'} ${j} ${descriviUna(s)}`);
        round.push(`Serie ${idx+1}: ${etichette.join(' → ')}`);
      }
      return round.join(' | ');
    }
  }
  return serie.map(descriviUna).join(", ");
}
function riportaUltimaVolta(nomeEsercizio){
  const prec = ultimaPrestazione(nomeEsercizio, document.getElementById('logDate').value);
  if(!prec) return;
  const attuali = currentSetInputs[nomeEsercizio];
  if(!attuali) return;
  while(attuali.length < prec.serie.length) addSetRow(nomeEsercizio);
  prec.serie.forEach((s, i)=>{
    if(!currentSetInputs[nomeEsercizio][i]) return;
    CAMPI_SERIE.forEach(f=>{
      if(s[f] === undefined || s[f] === '') return;
      currentSetInputs[nomeEsercizio][i][f] = s[f];
      const inp = document.querySelector(`.exercise-block input[data-ex="${CSS.escape(nomeEsercizio)}"][data-idx="${i}"][data-field="${f}"]`);
      if(inp){
        inp.value = mostraValoreCampo(nomeEsercizio, f, s[f]);
        // se questa riga è la serie principale di un dropset, "riporta" deve far
        // ripartire anche il ricalcolo automatico di peso/ripetizioni dei drop
        // (vedi buildDropsetRound), non solo riempire il valore.
        inp.dispatchEvent(new Event('input', {bubbles:true}));
      }
    });
  });
  salvaBozza();
  toast("Ripresi i valori della volta scorsa");
}


// ============================================================
// BLOCCO DELL'APP
// Una password che protegge l'ingresso, prima ancora dell'elenco profili.
// Serve perché l'app sta a un indirizzo raggiungibile e il telefono può
// finire in mano ad altri. La password vale per tutta l'app, non per il singolo profilo.
// ============================================================

function emailValida(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((e||'').trim()); }
function sonoAmministratore(){
  if(typeof utenteOnline !== 'undefined' && utenteOnline){
    return (utenteOnline.email || '').toLowerCase() === EMAIL_AMMINISTRATORE;
  }
  const p = loggedInProfile();
  return !!(p && (p.email||'').toLowerCase() === EMAIL_AMMINISTRATORE);
}

function appBloccata(){ return !!(state.appLock && state.appLock.hash); }

// La password d'ingresso c'è fin dal primo avvio: l'app non è mai aperta a chiunque.
function preparaBloccoIniziale(){
  if(!state.appLock || !state.appLock.hash){
    state.appLock = { hash: simpleHash(PASSWORD_INGRESSO_INIZIALE), recuperoHash: null, predefinita: true };
    save();
  }
}

function mostraBlocco(){
  document.documentElement.classList.remove('avvio');
  document.getElementById('lockPw').value = "";
  document.getElementById('lockErr').style.display = 'none';
  document.getElementById('lockRecupero').style.display = 'none';
  document.getElementById('lockDimenticataBtn').textContent = "Password dimenticata?";
  document.getElementById('lockScreen').style.display = 'flex';
  document.getElementById('profileGate').style.display = 'none';
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('accountPanel').style.display = 'none';
  setTimeout(()=>document.getElementById('lockPw').focus(), 100);
}
function sbloccaApp(){
  document.getElementById('lockScreen').style.display = 'none';
  document.getElementById('profileGate').style.display = 'flex';
  renderProfileGate();
}
function bloccaApp(){
  // esco anche dal profilo aperto: il blocco non deve lasciare niente dietro
  activeProfileId = null; actingProfileId = null; state && save();
  _bozzaPronta = false;
  mostraBlocco();
}

function provaSblocco(){
  const pw = document.getElementById('lockPw').value;
  if(simpleHash(pw) === state.appLock.hash){
    document.getElementById('lockErr').style.display = 'none';
    sbloccaApp();
  } else {
    document.getElementById('lockErr').style.display = 'block';
    document.getElementById('lockPw').value = "";
  }
}
document.getElementById('lockEntraBtn').addEventListener('click', provaSblocco);
document.getElementById('lockPw').addEventListener('keydown', e=>{ if(e.key==='Enter') provaSblocco(); });

document.getElementById('lockDimenticataBtn').addEventListener('click', ()=>{
  const box = document.getElementById('lockRecupero');
  const aperto = box.style.display === 'block';
  box.style.display = aperto ? 'none' : 'block';
  document.getElementById('lockDimenticataBtn').textContent = aperto ? "Password dimenticata?" : "Annulla";
});
document.getElementById('lockRecBtn').addEventListener('click', ()=>{
  const err = document.getElementById('lockRecErr');
  const mostra = t => { err.textContent = t; err.style.display = 'block'; };
  if(!state.appLock || !state.appLock.recuperoHash){ mostra("Questo blocco non ha un codice di recupero."); return; }
  const codice = normalizzaCodice(document.getElementById('lockCodice').value);
  const pw = document.getElementById('lockNuovaPw').value;
  if(simpleHash(codice) !== state.appLock.recuperoHash){ mostra("Codice non valido."); return; }
  if(pw.length < 4){ mostra("La password deve avere almeno 4 caratteri."); return; }
  state.appLock.hash = simpleHash(pw);
  save();
  toast("Password dell'app reimpostata ✓");
  sbloccaApp();
});



// ============================================================
