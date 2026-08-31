// VOLUME PER GRUPPO MUSCOLARE
// ============================================================
function getExerciseMuscles(name){
  const n = (name||'').trim().toLowerCase();
  if(!n) return null;
  const lp = activeProfile();
  // sia gli esercizi personali che gli override admin possono ora essere salvati come zone
  // fini (chest-medio, triceps...): per chi si aspetta i gruppi generici (grafico Volume)
  // li converto qui; per chi vuole le zone fini (mappa muscolare) uso slugsEsercizio() sotto.
  if(lp && lp.customExercises && lp.customExercises[n]) return gruppiDaMuscoli(lp.customExercises[n].muscles);
  if(state.baseExerciseOverrides && state.baseExerciseOverrides[n]) return gruppiDaMuscoli(state.baseExerciseOverrides[n]);
  if(EXERCISE_MUSCLE_MAP[n]) return EXERCISE_MUSCLE_MAP[n];
  const _lib = (typeof libFind==='function') ? libFind(n) : null;
  if(_lib) return [_lib.g];
  return fallbackMusclesForName(name);
}

function youtubeSearchUrl(name){
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' esecuzione corretta esercizio')}`;
}

// Restituisce { url, isCustomLink } — un link video specifico se impostato, altrimenti una ricerca YouTube di riserva
function getExerciseVideoInfo(name){
  const n = (name||'').trim().toLowerCase();
  // Non torna mai null (bug reale segnalato con screenshot: un esercizio
  // senza nome — dato incompleto/corrotto — faceva mancare qui il ritorno
  // anticipato, e ogni chiamante che leggeva subito ".url" senza controllo
  // (renderSchedaView, l'editor, Registra, Glossario...) andava in crash con
  // "null is not an object (evaluating 'vi.url')", bloccando anche il
  // rientro nell'app dopo un accesso riuscito: qui basta un nome vuoto per
  // portarsi dietro tutta la sessione). Con nome vuoto le chiavi sotto
  // restano semplicemente senza corrispondenza: si arriva sempre al
  // fallback finale, mai a un valore nullo.
  const lp = activeProfile();
  if(lp && lp.customExercises && lp.customExercises[n] && lp.customExercises[n].video){
    return { url: lp.customExercises[n].video, isCustomLink: true, fonte: 'utente' };
  }
  if(state.baseExerciseVideos && state.baseExerciseVideos[n]){
    return { url: state.baseExerciseVideos[n], isCustomLink: true, fonte: 'utente' };
  }
  // scheda video ufficiale dell'esercizio, quando la libreria ne ha una
  const _lib = (typeof libFind==='function') ? libFind(n) : null;
  if(_lib && _lib.v){ return { url: _lib.v, isCustomLink: true, fonte: 'libreria' }; }
  return { url: youtubeSearchUrl(name), isCustomLink: false, fonte: 'ricerca' };
}

function fallbackMusclesForName(name){
  const n = (name||"").toLowerCase();
  let best = null, bestScore = 0;
  for(const key in EXERCISE_MUSCLE_MAP){
    const words = key.split(' ');
    const matched = words.filter(w=>n.includes(w)).length;
    const score = matched/words.length;
    if(score > bestScore && score >= 0.5){ bestScore = score; best = key; }
  }
  return best ? EXERCISE_MUSCLE_MAP[best] : null;
}

function muscleLookupForProgram(p){
  // nome esercizio (lowercase) -> array muscoli
  const map = {};
  p.days.forEach(d=>{
    d.exercises.forEach(ex=>{
      const explicit = ex.muscles && ex.muscles.length ? ex.muscles : null;
      map[ex.name.toLowerCase().trim()] = explicit || getExerciseMuscles(ex.name) || [];
    });
  });
  return map;
}

let volumeRangeMode = 'week';
let volumeProgramIdA = null;
let volumeProgramIdB = null;

function computeRangeTotals(prof, lookup, startIso, endIso, programIdFilter){
  const totals = {}; MUSCLE_GROUPS.forEach(m=>totals[m]=0);
  let uncategorized = 0;
  prof.logs.filter(l=>{
    if(l.status==='saltato') return false;
    if(programIdFilter) return l.programId===programIdFilter; // l'ID scheda basta da solo, e' gia' univoco
    return l.date>=startIso && l.date<=endIso;
  }).forEach(log=>{
      log.exercises.forEach(ex=>{
        const nSets = ex.sets.length;
        const muscles = lookup[ex.name.toLowerCase().trim()];
        if(muscles && muscles.length>0) muscles.forEach(m=>{ if(totals.hasOwnProperty(m)) totals[m]+=nSets; });
        else uncategorized += nSets;
      });
    });
  return {totals, uncategorized};
}

function isoDaysAgo(n){
  const d = new Date(); d.setDate(d.getDate()-n);
  return d.toISOString().slice(0,10);
}

function programLabel(p){
  const range = p.archivedAt ? `${formatDate(p.createdAt)} → ${formatDate(p.archivedAt)}` : `dal ${formatDate(p.createdAt)} (attiva)`;
  return `${p.name} · ${range}`;
}

function populateVolumeProgramSelects(){
  const prof = activeProfile();
  const sorted = [...prof.programs].sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
  const optionsHtml = sorted.map(p=>`<option value="${p.id}">${programLabel(p)}</option>`).join('');
  const selA = document.getElementById('volumeProgramSelectA');
  const selB = document.getElementById('volumeProgramSelectB');
  selA.innerHTML = optionsHtml;
  selB.innerHTML = optionsHtml;
  if(!volumeProgramIdA) volumeProgramIdA = sorted[0] ? sorted[0].id : null;
  if(!volumeProgramIdB) volumeProgramIdB = sorted[1] ? sorted[1].id : (sorted[0] ? sorted[0].id : null);
  if(volumeProgramIdA) selA.value = volumeProgramIdA;
  if(volumeProgramIdB) selB.value = volumeProgramIdB;
}

document.querySelectorAll('#volumeRangeChips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#volumeRangeChips .chip').forEach(c=>c.classList.remove('selected'));
    chip.classList.add('selected');
    volumeRangeMode = chip.dataset.range;
    const isProgram = volumeRangeMode==='program';
    document.getElementById('volumeProgramCompare').style.display = isProgram ? 'flex' : 'none';
    document.getElementById('volumeList').style.display = isProgram ? 'none' : 'block';
    if(isProgram) populateVolumeProgramSelects();
    renderVolume();
  });
});
document.getElementById('volumeProgramSelectA').addEventListener('change', e=>{ volumeProgramIdA = e.target.value; renderVolume(); });
document.getElementById('volumeProgramSelectB').addEventListener('change', e=>{ volumeProgramIdB = e.target.value; renderVolume(); });

function renderVolumeRows(wrap, periods, showSpark){
  function statusOf(v){
    if(v < VOLUME_THRESHOLDS.low) return 'low';
    if(v > VOLUME_THRESHOLDS.high) return 'high';
    return 'ok';
  }
  const current = periods[0];
  const active = MUSCLE_GROUPS.filter(m=> periods.some(p=>p.totals[m]>0));
  const hasAnyData = active.length>0 || periods.some(p=>p.uncategorized>0);
  if(!hasAnyData){
    wrap.innerHTML = '<div class="empty">Nessun allenamento trovato per questo periodo.</div>';
    return;
  }
  const maxAcrossAll = Math.max(VOLUME_THRESHOLDS.high, ...periods.flatMap(p=>MUSCLE_GROUPS.map(m=>p.totals[m])), ...periods.map(p=>p.uncategorized)) * 1.15;

  // ---- riepilogo "dove migliori / dove no" (solo se c'e' un periodo precedente da confrontare) ----
  let summaryHtml = "";
  if(periods[1]){
    const changes = active.map(m=>{
      const v = current.totals[m], prev = periods[1].totals[m];
      const diff = v - prev;
      const pct = prev>0 ? Math.round((diff/prev)*100) : (v>0 ? 100 : 0);
      return {m, diff, pct};
    }).filter(c=>c.diff!==0);
    const up = changes.filter(c=>c.diff>0).sort((a,b)=>b.pct-a.pct).slice(0,3);
    const down = changes.filter(c=>c.diff<0).sort((a,b)=>a.pct-b.pct).slice(0,3);
    if(up.length>0 || down.length>0){
      summaryHtml = `<div class="volume-summary">
        ${up.length>0 ? `<div class="vs-line vs-up">▲ In crescita: ${up.map(c=>`${c.m} (+${c.pct}%)`).join(', ')}</div>` : ''}
        ${down.length>0 ? `<div class="vs-line vs-down">▼ In calo: ${down.map(c=>`${c.m} (${c.pct}%)`).join(', ')}</div>` : ''}
      </div>`;
    }
  }

  let html = summaryHtml + active.map(m=>{
    const v = current.totals[m];
    const prev = periods[1] ? periods[1].totals[m] : null;
    const status = statusOf(v);
    const pct = Math.min(100, (v/maxAcrossAll)*100);
    let deltaHtml = "";
    if(prev !== null){
      const diff = v - prev;
      let pctText = "";
      if(prev > 0){
        const pct = Math.round((diff/prev)*100);
        pctText = ` (${pct>0?'+':''}${pct}%)`;
      } else if(v > 0){
        pctText = " (nuovo)";
      }
      const vsLabel = periods[1].label ? ` vs ${periods[1].label}` : "";
      if(diff > 0) deltaHtml = `<span class="volume-delta up">▲ +${diff}${pctText}${vsLabel}</span>`;
      else if(diff < 0) deltaHtml = `<span class="volume-delta down">▼ ${diff}${pctText}${vsLabel}</span>`;
      else deltaHtml = `<span class="volume-delta flat">= invariato${vsLabel}</span>`;
    }
    let sparkHtml = "";
    if(showSpark){
      const sparkValues = periods.slice().reverse();
      const sparkMax = Math.max(1, ...sparkValues.map(p=>p.totals[m]));
      const bars = sparkValues.map((p,idx)=>{
        const isCurrent = idx === sparkValues.length-1;
        const h = Math.max(3, (p.totals[m]/sparkMax)*28);
        return `<div class="spark-bar ${isCurrent?'current':''}" style="height:${h}px;"><span class="spark-label">${isCurrent?'ora':p.label}</span></div>`;
      }).join('');
      sparkHtml = `<div class="volume-sparkline">${bars}</div>`;
    }
    return `<div class="volume-row">
      <div class="volume-row-head">
        <span class="mname">${m}</span>
        <div class="mcount-wrap"><span class="mcount">${v} serie</span>${deltaHtml}</div>
      </div>
      <div class="volume-bar-track"><div class="volume-bar-fill ${status}" style="width:${pct}%"></div></div>
      ${sparkHtml}
    </div>`;
  }).join('');

  if(current.uncategorized>0){
    const pct = Math.min(100, (current.uncategorized/maxAcrossAll)*100);
    html += `<div class="volume-row">
      <div class="volume-row-head">
        <span class="mname" style="color:var(--text-faint);">Non categorizzato</span>
        <div class="mcount-wrap"><span class="mcount">${current.uncategorized} serie</span></div>
      </div>
      <div class="volume-bar-track"><div class="volume-bar-fill" style="width:${pct}%; background:var(--text-faint);"></div></div>
    </div>`;
  }
  wrap.innerHTML = html;
}

function renderVolume(){
  const prof = activeProfile();

  if(volumeRangeMode==='week'){
    const p = activeProgram();
    const lookup = muscleLookupForProgram(p);
    const periods = [];
    for(let w=0; w<4; w++){
      const end = isoDaysAgo(7*w);
      const start = isoDaysAgo(7*w+6);
      const {totals, uncategorized} = computeRangeTotals(prof, lookup, start, end, null);
      periods.push({totals, uncategorized, label:`-${w}s`});
    }
    renderVolumeRows(document.getElementById('volumeList'), periods, true);

  } else if(volumeRangeMode==='month' || volumeRangeMode==='3months'){
    const days = volumeRangeMode==='month' ? 30 : 90;
    const p = activeProgram();
    const lookup = muscleLookupForProgram(p);
    const periods = [];
    for(let k=0;k<2;k++){
      const end = isoDaysAgo(days*k);
      const start = isoDaysAgo(days*k + (days-1));
      const {totals, uncategorized} = computeRangeTotals(prof, lookup, start, end, null);
      periods.push({totals, uncategorized, label:'prec.'});
    }
    renderVolumeRows(document.getElementById('volumeList'), periods, false);

  } else if(volumeRangeMode==='program'){
    if(!volumeProgramIdA) populateVolumeProgramSelects();
    const progA = prof.programs.find(p=>p.id===volumeProgramIdA) || activeProgram();
    const progB = prof.programs.find(p=>p.id===volumeProgramIdB) || activeProgram();

    const lookupA = muscleLookupForProgram(progA);
    const endA = progA.archivedAt || new Date().toISOString().slice(0,10);
    const {totals:totalsA, uncategorized:uncatA} = computeRangeTotals(prof, lookupA, progA.createdAt, endA, progA.id);

    const lookupB = muscleLookupForProgram(progB);
    const endB = progB.archivedAt || new Date().toISOString().slice(0,10);
    const {totals:totalsB, uncategorized:uncatB} = computeRangeTotals(prof, lookupB, progB.createdAt, endB, progB.id);

    // ogni colonna mostra se stessa come "corrente" e l'altra scheda come "precedente",
    // cosi' il delta/percentuale confronta direttamente A con B (e viceversa).
    renderVolumeRows(document.getElementById('volumeListA'),
      [{totals:totalsA, uncategorized:uncatA, label:'A'}, {totals:totalsB, uncategorized:uncatB, label:'B'}], false);
    renderVolumeRows(document.getElementById('volumeListB'),
      [{totals:totalsB, uncategorized:uncatB, label:'B'}, {totals:totalsA, uncategorized:uncatA, label:'A'}], false);
  }
}

// ============================================================
