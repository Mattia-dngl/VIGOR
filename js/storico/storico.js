// DATI DI ESEMPIO (per capire come funziona l'app)
// ============================================================
function guessBaseKg(name){
  const n = name.toLowerCase();
  if(n.includes('panca')) return 50;
  if(n.includes('military')) return 20;
  if(n.includes('rematore')) return 40;
  if(n.includes('lat machine') || n.includes('trazioni')) return 0;
  if(n.includes('curl') && n.includes('bilanciere')) return 25;
  if(n.includes('curl') && n.includes('martello')) return 12;
  if(n.includes('curl')) return 10;
  if(n.includes('alzate laterali')) return 8;
  if(n.includes('push down')) return 20;
  if(n.includes('french') || n.includes('dip')) return 15;
  if(n.includes('croci') || n.includes('chest press')) return 15;
  if(n.includes('face pull')) return 15;
  if(n.includes('kickback')) return 6;
  if(n.includes('plank') || n.includes('crunch') || n.includes('twist') || n.includes('sollevamento gambe')) return 0;
  return 10;
}


document.getElementById('refreshHistoryBtn').addEventListener('click', ()=>{
  renderHistory();
  renderVolume();
  renderHeader();
  toast("Dati aggiornati ✓");
});


// ============================================================
// STORICO
// ============================================================
// ============================================================
// MISURAZIONI (PESO / VITA)
// ============================================================
let measureChartInstance = null;
let exerciseChartInstance = null;

document.getElementById('saveMeasureBtn').addEventListener('click', ()=>{
  const prof = activeProfile();
  const date = document.getElementById('measureDate').value || new Date().toISOString().slice(0,10);
  const weight = document.getElementById('measureWeight').value;
  const waist = document.getElementById('measureWaist').value;
  const extra = Object.assign({}, _misureInCorso);
  if(!weight && !waist && Object.keys(extra).length === 0){
    toast("Inserisci almeno un valore."); return;
  }
  // se esiste già una misurazione per quella data, le nuove etichette si aggiungono
  // invece di cancellare quelle vecchie
  const precedente = prof.measurements.find(m=>m.date===date);
  const extraUniti = Object.assign({}, (precedente && precedente.extra) || {}, extra);
  prof.measurements = prof.measurements.filter(m=>m.date!==date);
  prof.measurements.push({
    date,
    weight: weight ? parseFloat(weight) : (precedente ? precedente.weight : null),
    waist: waist ? parseFloat(waist) : (precedente ? precedente.waist : null),
    extra: extraUniti
  });
  prof.measurements.sort((a,b)=>a.date.localeCompare(b.date));
  save();
  document.getElementById('measureWeight').value = "";
  document.getElementById('measureWaist').value = "";
  _misureInCorso = {};
  renderMisureInCorso();
  renderMeasurements();
  toast("Misurazione salvata ✓");
});


// ============================================================
// MISURE CON ETICHETTA
// Oltre a peso e vita si può misurare quello che si vuole (braccio, coscia...).
// Riusando la stessa etichetta i valori si accodano alla stessa serie,
// così nello storico si vede l'andamento nel tempo.
// ============================================================
let _misureInCorso = {};   // etichette aggiunte ma non ancora salvate

function normalizzaTag(s){
  return (s||'').trim().replace(/\s+/g,' ');
}
function chiaveTag(s){ return normalizzaTag(s).toLowerCase(); }

function tagGiaUsati(){
  const prof = activeProfile();
  const visti = new Map();
  (prof && prof.measurements || []).forEach(m=>{
    Object.keys(m.extra || {}).forEach(t=>{
      if(!visti.has(chiaveTag(t))) visti.set(chiaveTag(t), t);
    });
  });
  return [...visti.values()];
}

function renderMisureInCorso(){
  const box = document.getElementById('misureInCorso');
  const voci = Object.entries(_misureInCorso);
  box.innerHTML = voci.length === 0 ? '' : voci.map(([t,v])=>
    `<span class="misura-chip">${t}: <b>${v}</b><button type="button" data-togli="${escapeAttr(t)}" aria-label="Togli">✕</button></span>`).join('');
  box.querySelectorAll('[data-togli]').forEach(b=>b.addEventListener('click', ()=>{
    delete _misureInCorso[b.dataset.togli];
    renderMisureInCorso();
  }));

  // suggerimenti: le etichette che usi di solito, per non riscriverle
  const usati = tagGiaUsati().filter(t=>!(chiaveTag(t) in
    Object.fromEntries(Object.keys(_misureInCorso).map(k=>[chiaveTag(k), 1]))));
  const chips = document.getElementById('tagSuggeriti');
  chips.innerHTML = usati.slice(0,8).map(t=>`<div class="chip" data-tag="${escapeAttr(t)}">${t}</div>`).join('');
  chips.querySelectorAll('[data-tag]').forEach(ch=>ch.addEventListener('click', ()=>{
    document.getElementById('misuraTag').value = ch.dataset.tag;
    document.getElementById('misuraValore').focus();
  }));
  document.getElementById('tagUsati').innerHTML = usati.map(t=>`<option value="${escapeAttr(t)}">`).join('');
}

document.getElementById('aggiungiMisuraBtn').addEventListener('click', ()=>{
  const tagEl = document.getElementById('misuraTag');
  const valEl = document.getElementById('misuraValore');
  const tag = normalizzaTag(tagEl.value);
  const val = parseFloat(String(valEl.value).replace(',','.'));
  if(!tag){ toast("Scrivi cosa stai misurando (es. Braccio destro)."); return; }
  if(isNaN(val)){ toast("Inserisci un valore numerico."); return; }
  // se la stessa etichetta esiste già (anche con maiuscole diverse) riuso la sua forma
  const esistente = tagGiaUsati().find(t=>chiaveTag(t)===chiaveTag(tag))
                 || Object.keys(_misureInCorso).find(t=>chiaveTag(t)===chiaveTag(tag));
  const nome = esistente || tag;
  Object.keys(_misureInCorso).forEach(k=>{ if(chiaveTag(k)===chiaveTag(nome)) delete _misureInCorso[k]; });
  _misureInCorso[nome] = val;
  tagEl.value = ""; valEl.value = "";
  renderMisureInCorso();
});
document.getElementById('misuraValore').addEventListener('keydown', e=>{
  if(e.key === 'Enter'){ e.preventDefault(); document.getElementById('aggiungiMisuraBtn').click(); }
});

// ---- serie storiche per etichetta ----
function serieMisure(){
  const prof = activeProfile();
  const serie = {};
  [...(prof && prof.measurements || [])].sort((a,b)=>a.date.localeCompare(b.date)).forEach(m=>{
    Object.entries(m.extra || {}).forEach(([t,v])=>{
      const k = chiaveTag(t);
      if(!serie[k]) serie[k] = { nome: t, punti: [] };
      serie[k].punti.push({ data: m.date, valore: v });
    });
  });
  return Object.values(serie);
}
function renderSerieMisure(){
  const box = document.getElementById('serieMisure');
  if(!box) return;
  const serie = serieMisure();
  if(serie.length === 0){
    box.innerHTML = '<div class="empty">Nessuna misura con etichetta. Aggiungine una qui sopra: rimettendo la stessa etichetta nel tempo, qui vedrai come cambia.</div>';
    return;
  }
  box.innerHTML = serie.map(s=>{
    const primo = s.punti[0].valore, ultimo = s.punti[s.punti.length-1].valore;
    const diff = Math.round((ultimo - primo) * 10) / 10;
    const cls = diff > 0 ? 'su' : diff < 0 ? 'giu' : '';
    const segno = diff > 0 ? '+' : '';
    return `<div class="serie-misura">
      <div class="titolo">
        <span class="nome">${s.nome}</span>
        ${s.punti.length > 1 ? `<span class="delta ${cls}">${segno}${diff} dal ${formatDate(s.punti[0].data)}</span>` : '<span class="delta">prima misura</span>'}
      </div>
      <div class="valori">${s.punti.slice(-8).map(p=>
        `<span class="valore">${formatDate(p.data).slice(0,5)} <b>${p.valore}</b></span>`).join('')}</div>
    </div>`;
  }).join('');
}

function renderMeasurements(){
  const prof = activeProfile();
  renderMisureInCorso();
  renderSerieMisure();
  if(!document.getElementById('measureDate').value){
    document.getElementById('measureDate').value = new Date().toISOString().slice(0,10);
  }
  const list = [...(prof.measurements||[])].sort((a,b)=>b.date.localeCompare(a.date));
  const listEl = document.getElementById('measureList');
  if(list.length===0){
    listEl.innerHTML = '<div class="empty">Nessuna misurazione ancora.</div>';
  } else {
    listEl.innerHTML = list.map(m=>`
      <div class="log-item">
        <div class="log-head" style="cursor:default;">
          <span class="date">${formatDate(m.date)}</span>
          <span class="mono">${[
            m.weight ? m.weight+' kg' : null,
            m.waist ? m.waist+' cm vita' : null,
            ...Object.entries(m.extra||{}).map(([t,v])=>`${t} ${v}`)
          ].filter(Boolean).join(' · ')}</span>
        </div>
      </div>`).join('');
  }

  const chronological = [...(prof.measurements||[])].sort((a,b)=>a.date.localeCompare(b.date));
  const ctx = document.getElementById('measureChart');
  if(measureChartInstance){ measureChartInstance.destroy(); measureChartInstance = null; }
  if(chronological.length===0 || typeof Chart === 'undefined') return;

  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim();
  const diet = styles.getPropertyValue('--diet').trim();
  const textDim = styles.getPropertyValue('--text-dim').trim();
  const border = styles.getPropertyValue('--border').trim();

  measureChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chronological.map(m=>formatDate(m.date)),
      datasets: [
        { label:'Peso (kg)', data: chronological.map(m=>m.weight), borderColor: accent, backgroundColor: accent,
          spanGaps:true, tension:0.25, yAxisID:'y' },
        { label:'Vita (cm)', data: chronological.map(m=>m.waist), borderColor: diet, backgroundColor: diet,
          spanGaps:true, tension:0.25, yAxisID:'y1' }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{ legend:{ labels:{ color:textDim, font:{size:11} } } },
      scales:{
        x:{ ticks:{color:textDim, font:{size:10}}, grid:{color:border} },
        y:{ position:'left', ticks:{color:accent, font:{size:10}}, grid:{color:border} },
        y1:{ position:'right', ticks:{color:diet, font:{size:10}}, grid:{drawOnChartArea:false} }
      }
    }
  });
}

// ============================================================
