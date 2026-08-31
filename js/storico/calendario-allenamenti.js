// CALENDARIO ALLENAMENTI (Storico → Allenamenti) — ridisegnato 25/08/2026
// dal mockup: calendario a puntini (nessun colore per giorno di riposo/
// saltato, solo un puntino su chi ha DAVVERO un allenamento registrato),
// dettaglio del giorno scelto come card a sé, riepilogo del mese con 4
// numeri reali (nessuno dei quattro è indovinato/stimato, vedi funzioni
// sotto — dove un dato non esiste ancora, per scelta non si inventa).
// ============================================================
let _calMese = new Date();
_calMese.setDate(1);

// Volume di UN log, in kg totali sollevati (Σ reps×kg su ogni serie con
// entrambi i valori — le serie a tempo, senza kg, non contribuiscono).
function volumeKgLog(log){
  let tot = 0;
  (log.exercises||[]).forEach(ex=>{
    (ex.sets||[]).forEach(s=>{
      const reps = parseFloat(s.reps), kg = parseFloat(s.kg);
      if(reps>0 && kg>0) tot += reps*kg;
    });
  });
  return tot;
}
// Categoria del giorno di scheda a cui appartiene questo log (vedi editor
// scheda → CATEGORIE_ALLENAMENTO): null se il giorno non ne ha una, se era
// un allenamento libero, o se la scheda di allora non esiste più.
function categoriaDelLog(prof, log){
  if(!log || !log.dayKey || log.dayKey==='LIBERO') return null;
  const programma = (prof.programs||[]).find(pr=>pr.id===log.programId);
  const giorno = programma && programma.days ? programma.days.find(d=>d.key===log.dayKey) : null;
  return (giorno && giorno.categoria && CATEGORIE_ALLENAMENTO[giorno.categoria]) || null;
}
// "12h 45min" / "45 min" — mai mostrata se non c'è nessun log con una durata
// tracciata nel periodo (vedi renderRiepilogoMensile).
function formattaDurata(minutiTotali){
  const h = Math.floor(minutiTotali/60), m = minutiTotali%60;
  return h>0 ? `${h}h ${m}min` : `${m} min`;
}
// Streak di giorni CONSECUTIVI con un allenamento registrato, solo dentro il
// mese mostrato (non guarda oltre inizio/fine mese: coerente con "Riepilogo
// <mese>" — è una lettura del calendario che hai davanti, non di tutta la
// storia).
function migliorStreakMese(prof, anno, mese){
  const giorniNelMese = new Date(anno, mese+1, 0).getDate();
  let migliore = 0, corrente = 0;
  for(let g=1; g<=giorniNelMese; g++){
    const iso = isoDaData(new Date(anno, mese, g));
    const fatto = (prof.logs||[]).some(l=>l.date===iso && l.status==='registrato');
    corrente = fatto ? corrente+1 : 0;
    if(corrente>migliore) migliore = corrente;
  }
  return migliore;
}

function renderRiepilogoMensile(){
  const grid = document.getElementById('riepilogoGrid');
  if(!grid) return;
  const prof = activeProfile();
  const anno = _calMese.getFullYear(), mese = _calMese.getMonth();
  document.getElementById('riepilogoTitolo').textContent = `Riepilogo ${NOMI_MESI[mese]} ${anno}`;

  const primoIso = isoDaData(new Date(anno, mese, 1));
  const ultimoIso = isoDaData(new Date(anno, mese+1, 0));
  const logsDelMese = (prof.logs||[]).filter(l=> l.status==='registrato' && l.date>=primoIso && l.date<=ultimoIso);

  const sessioni = logsDelMese.length;
  const conDurata = logsDelMese.filter(l=>l.durataMinuti);
  const minutiTotali = conDurata.reduce((tot,l)=>tot+l.durataMinuti, 0);
  const volumeTotale = Math.round(logsDelMese.reduce((tot,l)=>tot+volumeKgLog(l), 0));
  const streak = migliorStreakMese(prof, anno, mese);

  const riga = (label, valoreHtml) => `<div class="riepilogo-stat"><span class="riepilogo-label">${label}</span><span class="riepilogo-val">${valoreHtml}</span></div>`;
  grid.innerHTML =
    riga('ALLENAMENTI TOTALI', `<b>${sessioni}</b> ${sessioni===1?'sessione':'sessioni'}`) +
    riga('TEMPO SPESO', conDurata.length ? `<b>${formattaDurata(minutiTotali)}</b>` : '<span class="riepilogo-vuoto">non ancora tracciato</span>') +
    riga('VOLUME TOTALE', `<b>${volumeTotale.toLocaleString('it-IT')}</b> kg`) +
    riga('MIGLIOR STREAK', `<b>${streak}</b> ${streak===1?'giorno':'giorni'}`);
}

function renderCalendarioStorico(){
  const cont = document.getElementById('calGiorni');
  if(!cont) return;
  const prof = activeProfile();
  const anno = _calMese.getFullYear(), mese = _calMese.getMonth();
  document.getElementById('calTitolo').textContent = `${NOMI_MESI[mese]} ${anno}`;

  const giorniNelMese = new Date(anno, mese+1, 0).getDate();
  const offset = (new Date(anno, mese, 1).getDay() + 6) % 7;   // lunedì come primo giorno
  const oggiIso = isoDaData(new Date());

  let html = '';
  for(let i=0;i<offset;i++) html += `<div class="cal-day-nuovo vuoto"></div>`;

  for(let g=1; g<=giorniNelMese; g++){
    const iso = isoDaData(new Date(anno, mese, g));
    const fatto = (prof && prof.logs || []).some(l=>l.date===iso && l.status==='registrato');
    let cls = 'cal-day-nuovo';
    if(iso===oggiIso) cls += ' oggi';
    html += `<div class="${cls}" data-iso="${iso}"><span class="num">${g}</span>${fatto ? '<span class="puntino"></span>' : ''}</div>`;
  }
  cont.innerHTML = html;

  cont.querySelectorAll('.cal-day-nuovo:not(.vuoto)').forEach(el=>{
    el.addEventListener('click', ()=>{
      cont.querySelectorAll('.cal-day-nuovo.selezionato').forEach(x=>x.classList.remove('selezionato'));
      el.classList.add('selezionato');
      mostraDettaglioGiornoCalendario(el.dataset.iso);
    });
  });

  // di default seleziono oggi se è nel mese mostrato, altrimenti il primo
  // giorno del mese (così il dettaglio non resta mai vuoto sfogliando i mesi)
  const oggiEl = cont.querySelector(`.cal-day-nuovo[data-iso="${oggiIso}"]`);
  const daSelezionare = oggiEl || cont.querySelector('.cal-day-nuovo:not(.vuoto)');
  if(daSelezionare){ daSelezionare.classList.add('selezionato'); mostraDettaglioGiornoCalendario(daSelezionare.dataset.iso); }
  else document.getElementById('calDettaglio').innerHTML = '';

  renderRiepilogoMensile();
}

function mostraDettaglioGiornoCalendario(iso){
  const prof = activeProfile();
  const box = document.getElementById('calDettaglio');
  const d = new Date(iso+'T00:00:00');
  const titolo = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${NOMI_MESI[d.getMonth()]}`;
  const log = prof && prof.logs ? prof.logs.find(l=>l.date===iso) : null;

  if(!log){
    box.innerHTML = `<h3 class="storico-giorno-titolo">${titolo}</h3>
      <div class="card"><p class="hint" style="margin:0;">Nessun allenamento registrato per questo giorno.</p></div>`;
    return;
  }
  if(log.status==='saltato'){
    box.innerHTML = `<h3 class="storico-giorno-titolo">${titolo}</h3>
      <div class="card"><p class="hint" style="margin:0; color:var(--warn);">Segnato come saltato.</p></div>`;
    return;
  }

  const categoria = categoriaDelLog(prof, log);
  const daSchedaPT = (typeof mioRapportoAttivo === 'function') && !!mioRapportoAttivo();
  const tagsHtml = (categoria || daSchedaPT) ? `<div class="workout-tags">
      ${categoria ? `<span class="workout-tag ${categoria.classe}">${categoria.label.toUpperCase()}</span>` : ''}
      ${daSchedaPT ? `<span class="workout-tag-pt">Da scheda PT</span>` : ''}
    </div>` : '';

  const kgTotali = Math.round(volumeKgLog(log));
  const stats = [`<span class="workout-stat">${log.exercises.length} ${log.exercises.length===1?'esercizio':'esercizi'}</span>`];
  if(log.durataMinuti) stats.unshift(`<span class="workout-stat">${log.durataMinuti} min</span>`);
  if(kgTotali>0) stats.push(`<span class="workout-stat">${kgTotali.toLocaleString('it-IT')} kg totali</span>`);

  const esercizi = (log.exercises||[]).map(ex=>
    `<div class="cal-detail-ex"><span>${escapeAttr(ex.name)}</span><span class="n">${escapeAttr(descriviSerie(ex.sets, ex.name))}</span></div>`
  ).join('') || '<p class="hint" style="margin:4px 0 0;">Nessun esercizio registrato.</p>';

  box.innerHTML = `<h3 class="storico-giorno-titolo">${titolo}</h3>
    <div class="card workout-day-card">
      ${tagsHtml}
      <div class="workout-title">${escapeAttr(log.dayName || 'Allenamento')}</div>
      <div class="workout-stats-row">${stats.join('')}</div>
      <details class="workout-dettagli">
        <summary>Vedi dettagli workout</summary>
        <div class="workout-dettagli-body">${esercizi}</div>
      </details>
    </div>`;
}
document.getElementById('calPrevBtn').addEventListener('click', ()=>{
  _calMese.setMonth(_calMese.getMonth()-1);
  renderCalendarioStorico();
});
document.getElementById('calNextBtn').addEventListener('click', ()=>{
  _calMese.setMonth(_calMese.getMonth()+1);
  renderCalendarioStorico();
});

function renderProgressSelect(){
  const prof = activeProfile();
  const sel = document.getElementById('progressExerciseSelect');
  const names = new Set();
  prof.logs.forEach(l=>l.exercises.forEach(e=>names.add(e.name)));
  const prev = sel.value;
  sel.innerHTML = "";
  if(names.size===0){
    sel.innerHTML = '<option>Nessun dato ancora</option>';
    document.getElementById('progressTable').innerHTML = "";
    document.getElementById('exChartBox').style.display = 'none';
    document.getElementById('exChartSpiega').textContent = "";
    document.getElementById('recordPersonale').style.display = 'none';
    if(exerciseChartInstance){ exerciseChartInstance.destroy(); exerciseChartInstance = null; }
    return;
  }
  [...names].sort().forEach(n=>{
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    sel.appendChild(opt);
  });
  if(names.has(prev)) sel.value = prev;
  renderProgressTable();
}
document.getElementById('progressExerciseSelect').addEventListener('change', renderProgressTable);

function renderProgressTable(){
  const prof = activeProfile();
  const exName = document.getElementById('progressExerciseSelect').value;
  const container = document.getElementById('progressTable');
  const timeBased = isTimeBasedExercise(exName);

  const recordBox = document.getElementById('recordPersonale');
  const record = exName ? recordPersonale(prof, exName) : null;
  if(record){
    recordBox.style.display = 'block';
    recordBox.innerHTML = `🏆 Record personale${timeBased ? '' : ' (stimato)'}: <b>${record.valore}${timeBased ? ' sec' : ' kg'}</b> <span class="hint">— ${formatDate(record.data)}</span>`;
  } else {
    recordBox.style.display = 'none';
    recordBox.innerHTML = '';
  }
  const rows = [...prof.logs]
    .filter(l=>l.exercises.some(e=>e.name===exName))
    .sort((a,b)=>a.date.localeCompare(b.date))
    .map(l=>{
      const ex = l.exercises.find(e=>e.name===exName);
      if(timeBased){
        const maxSec = Math.max(...ex.sets.map(s=>parseFloat(s.seconds)||0));
        const setsStr = ex.sets.map(s=>`${s.seconds||'0'} sec`).join('  ');
        return {date:l.date, maxVal:maxSec, setsStr, grafico:maxSec};
      }
      const maxKg = Math.max(...ex.sets.map(s=>parseFloat(s.kg)||0));
      const setsStr = ex.sets.map(s=>`${s.reps||'-'}×${s.kg||'0'}`).join('  ');
      // massimale stimato (Epley) del set migliore quel giorno: tiene conto anche
      // delle ripetizioni, non solo del peso, così i giorni a rep alte e quelli a
      // rep basse restano confrontabili
      const epley = Math.max(0, ...ex.sets.map(s=>{
        const kg = parseFloat(s.kg), reps = parseFloat(s.reps);
        return (kg>0 && reps>0) ? kg*(1+reps/30) : 0;
      }));
      return {date:l.date, maxVal:maxKg, setsStr, grafico: Math.round(epley)};
    });
  if(rows.length===0){ container.innerHTML=""; }
  else {
    container.innerHTML = `
      <div class="progress-head-row">
        <div class="progress-col-date">Data</div>
        <div class="progress-col-sets">Serie</div>
        <div class="progress-col-kg">${timeBased ? 'Sec max' : 'Kg max'}</div>
      </div>
      ${rows.map(r=>`
        <div class="progress-row">
          <div class="progress-col-date">${formatDate(r.date)}</div>
          <div class="progress-col-sets">${r.setsStr}</div>
          <div class="progress-col-kg">${r.maxVal}</div>
        </div>`).join('')}`;
  }

  // ---- grafico ----
  const box = document.getElementById('exChartBox');
  const spiega = document.getElementById('exChartSpiega');
  if(exerciseChartInstance){ exerciseChartInstance.destroy(); exerciseChartInstance = null; }
  const puntiGrafico = rows.filter(r=>r.grafico>0);
  if(!exName || puntiGrafico.length < 2 || typeof Chart === 'undefined'){
    box.style.display = 'none';
    spiega.textContent = puntiGrafico.length < 2 && exName ? "Registra questo esercizio almeno due volte per vedere il grafico dell'andamento." : "";
    return;
  }
  box.style.display = 'block';
  spiega.textContent = timeBased
    ? "La durata migliore registrata a ogni sessione."
    : "Il massimale stimato (formula di Epley) a ogni sessione, calcolato dal set più pesante: così i giorni a ripetizioni alte e quelli a ripetizioni basse restano confrontabili.";

  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim();
  const textDim = styles.getPropertyValue('--text-dim').trim();
  const border = styles.getPropertyValue('--border').trim();

  exerciseChartInstance = new Chart(document.getElementById('exerciseChart'), {
    type: 'line',
    data: {
      labels: puntiGrafico.map(r=>formatDate(r.date)),
      datasets: [{
        label: timeBased ? 'Durata (sec)' : 'Massimale stimato (kg)',
        data: puntiGrafico.map(r=>r.grafico),
        borderColor: accent, backgroundColor: accent, tension:0.25
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:textDim, font:{size:11} } } },
      scales:{
        x:{ ticks:{color:textDim, font:{size:10}}, grid:{color:border} },
        y:{ ticks:{color:textDim, font:{size:10}}, grid:{color:border} }
      }
    }
  });
}

// ============================================================
