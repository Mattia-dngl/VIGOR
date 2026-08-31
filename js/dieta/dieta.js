// DIARIO ALIMENTARE
// ============================================================
let selectedMealType = 'colazione';
document.querySelectorAll('#mealTypeChips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#mealTypeChips .chip').forEach(c=>c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedMealType = chip.dataset.meal;
    // 31/08/2026 (secondo giro): la pillola scelta qui sopra e la card del
    // pasto qui sotto (renderMealCards) restavano visivamente scollegate —
    // segnalato che non è ovvio dove finisce quello che si sta per
    // registrare. Ri-renderizzo il diario così la card giusta si evidenzia
    // subito, senza aspettare il prossimo "+ Aggiungi".
    renderMealDiary();
  });
});

let pendingMealItem = null;

function chiudiPromptAlimentoPersonalizzato(){
  pendingMealItem = null;
  document.getElementById('customFoodPrompt').style.display = 'none';
  ['customFoodKcal','customFoodP','customFoodC','customFoodF'].forEach(id=>{
    document.getElementById(id).value = '';
  });
}

function completaAggiuntaPasto(){
  const prof = activeProfile();
  const { date, item } = pendingMealItem;
  let day = prof.mealLogs.find(m=>m.date===date);
  if(!day){ day = {date, items:[]}; prof.mealLogs.push(day); }
  day.items.push(item);
  save();
  document.getElementById('mealFoodInput').value = "";
  document.getElementById('mealGramsInput').value = "";
  renderMealDiary();
}

document.getElementById('addMealBtn').addEventListener('click', ()=>{
  const date = document.getElementById('mealDate').value || new Date().toISOString().slice(0,10);
  const foodInput = document.getElementById('mealFoodInput');
  const food = foodInput.value.trim().toLowerCase();
  const grams = parseFloat(document.getElementById('mealGramsInput').value);
  if(!food){ toast("Scrivi cosa hai mangiato."); return; }
  if(!grams || grams<=0){ toast("Inserisci i grammi (anche una stima va bene)."); return; }

  const item = {food, grams, meal:selectedMealType};
  if(datiAlimento(food)){
    pendingMealItem = {date, item};
    completaAggiuntaPasto();
    toast("Alimento aggiunto ✓");
    return;
  }
  // Alimento non riconosciuto: chiedo i valori nutrizionali invece di registrarlo alla cieca.
  pendingMealItem = {date, item};
  document.getElementById('customFoodNome').textContent = toTitleCase(food);
  document.getElementById('customFoodPrompt').style.display = 'block';
  document.getElementById('customFoodPrompt').scrollIntoView({behavior:'smooth', block:'nearest'});
  document.getElementById('customFoodKcal').focus();
});

document.getElementById('saveCustomFoodBtn').addEventListener('click', ()=>{
  if(!pendingMealItem) return;
  const kcal = parseFloat(document.getElementById('customFoodKcal').value);
  if(!kcal || kcal<=0){ toast("Inserisci almeno le kcal per 100g."); return; }
  const p = parseFloat(document.getElementById('customFoodP').value) || 0;
  const c = parseFloat(document.getElementById('customFoodC').value) || 0;
  const f = parseFloat(document.getElementById('customFoodF').value) || 0;
  const prof = activeProfile();
  if(!prof.customFoods) prof.customFoods = {};
  prof.customFoods[pendingMealItem.item.food] = {kcal, p, c, f};
  save();
  completaAggiuntaPasto();
  chiudiPromptAlimentoPersonalizzato();
  toast("Alimento salvato: lo riconoscerò anche la prossima volta ✓");
});

document.getElementById('skipCustomFoodBtn').addEventListener('click', ()=>{
  if(!pendingMealItem) return;
  completaAggiuntaPasto();
  chiudiPromptAlimentoPersonalizzato();
  toast("Aggiunto (calorie non disponibili per questo alimento) ✓");
});

document.getElementById('cancelCustomFoodBtn').addEventListener('click', chiudiPromptAlimentoPersonalizzato);

const MEAL_LABELS = {colazione:'Colazione', pranzo:'Pranzo', spuntino:'Spuntino', cena:'Cena'};

// Cerca prima nel database globale, poi tra gli alimenti che l'utente ha inserito
// a mano in passato (salvati sul suo profilo, come già avviene per gli esercizi personali).
function datiAlimento(food){
  if(FOOD_DATABASE[food]) return FOOD_DATABASE[food];
  const prof = activeProfile();
  if(prof && prof.customFoods && prof.customFoods[food]) return prof.customFoods[food];
  return null;
}

// ============================================================
// SCANNER CODICE A BARRE (dieta) — cerca il prodotto su Open Food Facts (banca
// dati pubblica e gratuita) invece di far scrivere i valori nutrizionali a
// mano. Dove il browser supporta la lettura nativa (BarcodeDetector, per ora
// Chrome/Android) si inquadra col telefono; altrove — es. Safari su iPhone,
// che non la implementa — resta sempre disponibile l'inserimento a mano del
// codice stampato sulla confezione, così la funzione non dipende da nessuna
// libreria esterna da scaricare.
// ============================================================
let _barcodeStream = null;
let _barcodeLettura = false;

function fermaScannerBarcode(){
  _barcodeLettura = false;
  if(_barcodeStream){
    _barcodeStream.getTracks().forEach(t=>t.stop());
    _barcodeStream = null;
  }
  const video = document.getElementById('barcodeVideo');
  video.style.display = 'none';
  video.srcObject = null;
}

// 31/08/2026: segnalato "non funziona" — su iPhone/Safari (BarcodeDetector
// non esiste affatto lì, solo Chrome/Android la implementa) il tasto apriva
// il pannello ma la fotocamera non partiva mai: il messaggio restava fermo
// su "Inquadra il codice a barre" senza mai spiegare perché non succedeva
// nulla, e l'unica via che funziona davvero ovunque (il campo a mano) restava
// nascosta in fondo, sotto un video vuoto. Ora lo si controlla SUBITO, prima
// di aprire: se la lettura automatica non è disponibile, lo si dice chiaro e
// si passa dritti al campo a mano (che chiama la stessa cercaProdottoBarcode
// di sempre — nessuna funzione tolta, solo un percorso reso onesto).
function scannerBarcodeSupportato(){
  return ('BarcodeDetector' in window) && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
}
function apriScannerBarcode(){
  document.getElementById('barcodeManualInput').value = '';
  const pannello = document.getElementById('barcodeScannerPanel');
  pannello.style.display = 'block';
  if(pannello.scrollIntoView) pannello.scrollIntoView({behavior:'smooth', block:'nearest'});
  if(scannerBarcodeSupportato()){
    document.getElementById('barcodeStatus').textContent = 'Inquadra il codice a barre del prodotto.';
    avviaLetturaFotocamera();
  } else {
    document.getElementById('barcodeStatus').textContent = 'La lettura automatica non è disponibile su questo telefono: inserisci il codice a mano qui sotto.';
    const manualInput = document.getElementById('barcodeManualInput');
    if(manualInput) manualInput.focus({preventScroll:true});
  }
}

function chiudiScannerBarcode(){
  fermaScannerBarcode();
  document.getElementById('barcodeScannerPanel').style.display = 'none';
}

// avvia la fotocamera solo se il browser la supporta davvero: niente errori
// in console per chi non ce l'ha, semplicemente resta solo il campo a mano
async function avviaLetturaFotocamera(){
  if(!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    return;
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    _barcodeStream = stream;
    const video = document.getElementById('barcodeVideo');
    video.srcObject = stream;
    video.style.display = 'block';
    await video.play();
    const detector = new window.BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
    _barcodeLettura = true;
    const loop = async ()=>{
      if(!_barcodeLettura) return;
      try{
        const risultati = await detector.detect(video);
        if(risultati && risultati.length){
          const codice = risultati[0].rawValue;
          fermaScannerBarcode();
          cercaProdottoBarcode(codice);
          return;
        }
      }catch(e){ /* frame non leggibile, si riprova al prossimo */ }
      if(_barcodeLettura) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }catch(e){
    // permesso negato o nessuna fotocamera: resta solo l'inserimento a mano
    document.getElementById('barcodeStatus').textContent = 'Fotocamera non disponibile: inserisci il codice a mano qui sotto.';
  }
}

// legge la risposta di Open Food Facts (v2/product/<codice>.json) e la riporta
// al formato usato da customFoods: separata da cercaProdottoBarcode così è
// testabile senza dover simulare una vera chiamata di rete
function interpretaRispostaOpenFoodFacts(dati){
  if(!dati || dati.status !== 1 || !dati.product) return null;
  const prod = dati.product;
  const nutr = prod.nutriments || {};
  const kcal = nutr['energy-kcal_100g'];
  if(!kcal || kcal <= 0) return null; // senza kcal il dato non è utilizzabile
  return {
    nome: (prod.product_name || '').trim().toLowerCase(),
    kcal: Math.round(kcal),
    p: Math.round((nutr['proteins_100g'] || 0) * 10) / 10,
    c: Math.round((nutr['carbohydrates_100g'] || 0) * 10) / 10,
    f: Math.round((nutr['fat_100g'] || 0) * 10) / 10
  };
}

async function cercaProdottoBarcode(codice){
  codice = (codice || '').trim();
  if(!codice){ toast("Inserisci un codice a barre."); return; }
  document.getElementById('barcodeStatus').textContent = 'Cerco il prodotto...';
  try{
    const risposta = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codice)}.json?fields=product_name,nutriments`);
    const dati = await risposta.json();
    const info = interpretaRispostaOpenFoodFacts(dati);
    if(!info || !info.nome){
      document.getElementById('barcodeStatus').textContent = 'Prodotto non trovato: prova a scriverlo a mano.';
      return;
    }
    const prof = activeProfile();
    if(!prof.customFoods) prof.customFoods = {};
    prof.customFoods[info.nome] = {kcal: info.kcal, p: info.p, c: info.c, f: info.f};
    save();
    document.getElementById('mealFoodInput').value = info.nome;
    document.getElementById('mealGramsInput').focus();
    chiudiScannerBarcode();
    toast(`Trovato: ${toTitleCase(info.nome)} — inserisci i grammi ✓`);
  }catch(e){
    document.getElementById('barcodeStatus').textContent = 'Connessione non disponibile: prova più tardi o scrivi l\'alimento a mano.';
  }
}

document.getElementById('scanBarcodeBtn').addEventListener('click', apriScannerBarcode);
document.getElementById('closeBarcodeScannerBtn').addEventListener('click', chiudiScannerBarcode);
document.getElementById('barcodeManualBtn').addEventListener('click', ()=>{
  cercaProdottoBarcode(document.getElementById('barcodeManualInput').value);
});

// ============================================================
// FABBISOGNO CALORICO — calcolato, non scritto a mano.
// Formula di Mifflin-St Jeor per il metabolismo basale (BMR): è quella che le
// linee guida indicano come più accurata tra quelle utilizzabili senza esami
// (più precisa della vecchia Harris-Benedict). Il BMR viene poi moltiplicato
// per il livello di attività (fattore PAL) per ottenere il fabbisogno totale (TDEE).
// ============================================================
const LIVELLI_ATTIVITA = {
  sedentario:    {label:'Sedentario',     mult:1.2},
  leggero:       {label:'Leggero',        mult:1.375},
  moderato:      {label:'Moderato',       mult:1.55},
  intenso:       {label:'Intenso',        mult:1.725},
  molto_intenso: {label:'Molto intenso',  mult:1.9}
};
const OBIETTIVI_CALORICI = {
  mantenimento: {label:'Mantieni',        mult:1,    nota:'per mantenere il peso attuale'},
  deficit:      {label:'Dimagrisci',      mult:0.8,  nota:'deficit del 20%, un ritmo sostenibile'},
  surplus:      {label:'Aumenta massa',   mult:1.15, nota:'surplus del 15%, per crescere senza accumulare troppo grasso'}
};

// Ultimo peso registrato in Storico → Misure (niente da scrivere due volte).
function ultimoPesoRegistrato(prof){
  const pesate = (prof.measurements || []).filter(m => m.weight != null && m.weight > 0)
    .sort((a,b)=>a.date.localeCompare(b.date));
  return pesate.length ? pesate[pesate.length-1] : null;
}

// Età calcolata dalla data di nascita (yyyy-mm-dd), non scritta a mano: conta gli
// anni compiuti, quindi tiene conto di mese/giorno e non solo dell'anno. Ritorna
// null se la data manca o non è valida.
function calcolaEta(dataNascitaIso){
  if(!dataNascitaIso) return null;
  const nascita = new Date(dataNascitaIso + 'T00:00:00');
  if(isNaN(nascita.getTime())) return null;
  const oggi = new Date();
  let eta = oggi.getFullYear() - nascita.getFullYear();
  const mese = oggi.getMonth() - nascita.getMonth();
  if(mese < 0 || (mese === 0 && oggi.getDate() < nascita.getDate())) eta--;
  return eta >= 0 ? eta : null;
}
// Età da usare nei calcoli: preferisce la data di nascita (fonte di verità, non
// modificabile a mano); se il profilo non ce l'ha ancora ma ha un vecchio valore
// "età" scritto a mano prima che esistesse la data di nascita, usa quello come
// ripiego finché non viene impostata la data.
function etaProfilo(prof){
  if(!prof) return null;
  const daData = calcolaEta(prof.dataNascita);
  if(daData !== null) return daData;
  const legacy = parseFloat(prof.eta);
  return (legacy && legacy > 0) ? legacy : null;
}

// Ritorna null se mancano dati; altrimenti l'oggetto con BMR, TDEE e il dettaglio usato.
function calcolaFabbisogno(prof){
  if(!prof) return null;
  const sesso = prof.sesso;
  const eta = etaProfilo(prof);
  const altezza = parseFloat(prof.altezza);
  const pesata = ultimoPesoRegistrato(prof);
  const mancanti = [];
  if(sesso !== 'uomo' && sesso !== 'donna') mancanti.push('sesso');
  if(!eta || eta <= 0) mancanti.push('data di nascita');
  if(!altezza || altezza <= 0) mancanti.push('altezza');
  if(!pesata) mancanti.push('peso (registra una misurazione in Storico)');
  if(mancanti.length) return {mancanti};

  let bmr = 10*pesata.weight + 6.25*altezza - 5*eta;
  bmr += (sesso === 'uomo') ? 5 : -161;
  bmr = Math.round(bmr);

  const liv = LIVELLI_ATTIVITA[prof.livelloAttivita] ? prof.livelloAttivita : 'moderato';
  const tdee = Math.round(bmr * LIVELLI_ATTIVITA[liv].mult);

  const obiettivo = OBIETTIVI_CALORICI[prof.obiettivoCalorico] ? prof.obiettivoCalorico : 'mantenimento';
  const risultato = Math.round(tdee * OBIETTIVI_CALORICI[obiettivo].mult);

  return {mancanti:[], bmr, tdee, risultato, liv, obiettivo, peso:pesata.weight, dataPeso:pesata.date, altezza, eta, sesso};
}

function renderFabbisognoCalorico(){
  const box = document.getElementById('fabbisognoBody');
  if(!box) return;
  const prof = activeProfile();
  const r = calcolaFabbisogno(prof);

  if(!r || r.mancanti.length){
    box.innerHTML = `
      <p class="hint" style="margin:12px 0 0;">Per calcolare il tuo fabbisogno calorico (e mostrarlo qui sopra) mi mancano: <b>${(r ? r.mancanti : ['sesso','età','altezza','peso']).join(', ')}</b>.</p>
      <button class="btn diet-btn block" id="vaiCompletaDatiBtn" type="button" style="margin-top:8px;">Completa in Account</button>
    `;
    document.getElementById('vaiCompletaDatiBtn').addEventListener('click', ()=>{
      apriAccountPanel();
      setTimeout(()=>{ document.getElementById('setDataNascita')?.scrollIntoView({behavior:'smooth', block:'center'}); }, 150);
    });
    return;
  }

  // 31/08/2026: il numero grande (kcal/giorno) ora vive nell'anello in cima
  // alla pagina (renderKcalRing) — qui restano solo l'obiettivo scelto e il
  // dettaglio del calcolo, informazioni di supporto, non il dato principale.
  const obiettivoBtns = Object.keys(OBIETTIVI_CALORICI).map(k=>
    `<button type="button" class="seg-btn${k===r.obiettivo?' active':''}" data-obiettivo="${k}">${OBIETTIVI_CALORICI[k].label}</button>`
  ).join('');

  box.innerHTML = `
    <div class="hint" style="margin:12px 0 8px;">${OBIETTIVI_CALORICI[r.obiettivo].nota}</div>
    <div class="seg-toggle" id="obiettivoCaloricoToggle" style="margin-bottom:0;">${obiettivoBtns}</div>
    <p class="hint" style="margin-top:10px; margin-bottom:0;">
      Metabolismo basale ${r.bmr} kcal · attività "${LIVELLI_ATTIVITA[r.liv].label.toLowerCase()}" ×${LIVELLI_ATTIVITA[r.liv].mult} →
      mantenimento ${r.tdee} kcal. Calcolato su ${r.peso} kg (misurazione del ${formatDate(r.dataPeso)}), ${r.altezza} cm, ${r.eta} anni.
      Stima con la formula di Mifflin-St Jeor: è indicativa, non sostituisce il parere di un nutrizionista.
    </p>
  `;
  box.querySelectorAll('#obiettivoCaloricoToggle .seg-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const p = activeProfile();
      p.obiettivoCalorico = btn.dataset.obiettivo;
      save();
      renderFabbisognoCalorico();
      renderKcalRing(activeProfile(), document.getElementById('mealDate').value || new Date().toISOString().slice(0,10));
    });
  });
}

function renderTodayDietPlan(){
  const box = document.getElementById('todayDietPlan');
  if(!box) return;
  // Aggancio qui il fabbisogno calorico solo perché questa funzione parte già
  // ogni volta che si apre la schermata Dieta (renderMealDiary la chiama per prima).
  renderFabbisognoCalorico();
  const prof = activeProfile();
  const p = activeProgram();
  const wd = WEEKDAYS[new Date().getDay()];
  const dayPlan = p.diet && typeof p.diet==='object' ? p.diet[wd] : null;
  if(!dayPlan){
    box.innerHTML = '<div class="hint">Nessun piano alimentare impostato per oggi.</div>';
    return;
  }
  if(dayPlan.libera){
    box.innerHTML = `<div class="diet-free-badge">Giorno libero</div><div class="hint" style="margin-top:6px;">${dayPlan.testo||'Mangia quello che vuoi, senza sensi di colpa.'}</div>`;
    return;
  }
  box.innerHTML = `
    <div class="diet-meal-row"><b>Colazione</b>${dayPlan.colazione||'-'}</div>
    <div class="diet-meal-row"><b>Pranzo</b>${dayPlan.pranzo||'-'}</div>
    <div class="diet-meal-row"><b>Spuntino</b>${dayPlan.spuntino||'-'}</div>
    <div class="diet-meal-row"><b>Cena</b>${dayPlan.cena||'-'}</div>
  `;
}

const MEAL_ORDER = ['colazione','pranzo','spuntino','cena'];
const MEAL_ICON_PATHS = {
  colazione: '<path d="M3 8h13a4 4 0 0 1 0 8H3z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M6 3v3M9 3v3M12 3v3"/>',
  pranzo: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 3"/>',
  spuntino: '<path d="M12 3c-4 3-6 6-6 10a6 6 0 0 0 12 0c0-4-2-7-6-10Z"/>',
  cena: '<path d="M12 3a6 6 0 0 0 0 12 6 6 0 0 0 6-6c0 4-3 8-8 8a8 8 0 1 1 2-15z"/>'
};
function iconaPasto(mealKey){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MEAL_ICON_PATHS[mealKey]||''}</svg>`;
}
// Card dei pasti (31/08/2026, Fase 3; riviste lo stesso giorno — vedi
// commento sopra #mealCardsWrap nell'HTML): raggruppano prof.mealLogs della
// data selezionata per pasto, mostrando anche i pasti ancora vuoti (stato
// "da fare") invece di ometterli — così la card di ogni pasto è sempre
// visibile, come in fitflow. Da sola lettura: il pasto si sceglie nel
// diario qui sopra (il tasto "Registra"/"+" che c'era su ogni card è stato
// tolto — richiesta esplicita, era ridondante dato che il pasto si sceglie
// già lì), e ora ogni alimento mostra la scomposizione nutrienti completa
// (prima solo le kcal), non solo il subtotale della card.
function renderMealCards(items, date){
  const wrap = document.getElementById('mealCardsWrap');
  if(!wrap) return;
  wrap.innerHTML = MEAL_ORDER.map(mealKey=>{
    const mealItems = items.map((it,idx)=>({...it, idx})).filter(it=>(it.meal||'colazione')===mealKey);
    const fatto = mealItems.length>0;
    const mealKcal = mealItems.reduce((sum,it)=>{
      const f = datiAlimento(it.food);
      return sum + (f ? f.kcal*it.grams/100 : 0);
    }, 0);
    const righeHtml = mealItems.map(it=>{
      const f = datiAlimento(it.food);
      const factor = it.grams/100;
      const nutrText = f
        ? `${Math.round(f.kcal*factor)} kcal · P ${Math.round(f.p*factor*10)/10}g · C ${Math.round(f.c*factor*10)/10}g · G ${Math.round(f.f*factor*10)/10}g`
        : 'valori nutrizionali non disponibili';
      return `<div class="meal-card-food-row">
        <div class="meal-card-food-riga1">
          <span>${toTitleCase(it.food)} <span class="meal-card-food-grams">${it.grams} g</span></span>
          <button type="button" class="remove-x" data-idx="${it.idx}" aria-label="Rimuovi ${toTitleCase(it.food)}">×</button>
        </div>
        <div class="meal-card-food-nutr">${nutrText}</div>
      </div>`;
    }).join('');
    const attivo = mealKey === selectedMealType;
    return `<div class="card meal-card${fatto?'':' meal-card-pending'}${attivo?' meal-card-active':''}" data-meal="${mealKey}">
      <div class="meal-card-head">
        <div class="meal-card-name">${iconaPasto(mealKey)}${MEAL_LABELS[mealKey]}${attivo?'<span class="meal-card-active-badge">Stai aggiungendo qui</span>':''}</div>
        ${fatto
          ? `<span class="meal-card-kcal">${Math.round(mealKcal)} kcal</span>`
          : `<span class="meal-card-non-fatto">Non ancora registrato</span>`}
      </div>
      ${righeHtml || `<div class="meal-card-empty-hint">Scegli "${MEAL_LABELS[mealKey]}" nel diario qui sopra per registrarlo.</div>`}
    </div>`;
  }).join('');

  wrap.querySelectorAll('.remove-x').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const prof = activeProfile();
      const day = prof.mealLogs.find(m=>m.date===date);
      if(day) day.items.splice(parseInt(btn.dataset.idx),1);
      save();
      renderMealDiary();
    });
  });
}

// Anello "kcal consumate/obiettivo" (31/08/2026, Fase 3): sostituisce il
// vecchio anello a 3 segmenti (che mostrava solo la composizione P/C/F,
// non un progresso). Le righe P/C/F restano, spostate sotto come semplici
// .macro-row (stesso component riusato da Home).
function renderKcalRing(prof, date){
  const fillEl = document.getElementById('kcalRingFill');
  const pctEl = document.getElementById('kcalRingPct');
  const valueEl = document.getElementById('kcalRingValue');
  const subEl = document.getElementById('kcalRingSub');
  const labelEl = document.getElementById('dietRingDataLabel');
  const totalsEl = document.getElementById('mealTotals');
  if(!fillEl || !prof) return;

  const day = prof.mealLogs.find(m=>m.date===date);
  const items = day ? day.items : [];
  const hasUnknown = items.some(it=>!datiAlimento(it.food));
  const totals = items.reduce((acc,it)=>{
    const f = datiAlimento(it.food);
    if(!f) return acc;
    const factor = it.grams/100;
    acc.kcal += f.kcal*factor; acc.p += f.p*factor; acc.c += f.c*factor; acc.f += f.f*factor;
    return acc;
  }, {kcal:0,p:0,c:0,f:0});

  const oggiIso = new Date().toISOString().slice(0,10);
  if(labelEl) labelEl.textContent = date===oggiIso ? 'Calorie di oggi' : `Calorie del ${formatDate(date)}`;

  const r = 45, C = 2*Math.PI*r;
  const fabbisogno = calcolaFabbisogno(prof);
  if(fabbisogno && !fabbisogno.mancanti.length){
    const pct = Math.min(100, Math.round(totals.kcal/fabbisogno.risultato*100));
    fillEl.style.strokeDasharray = String(C);
    fillEl.style.strokeDashoffset = String(C*(1-pct/100));
    const inEccesso = totals.kcal > fabbisogno.risultato;
    fillEl.classList.toggle('kcal-ring-fill-over', inEccesso);
    pctEl.textContent = pct + '%';
    valueEl.textContent = `${Math.round(totals.kcal)} / ${fabbisogno.risultato} kcal`;
    const resto = fabbisogno.risultato - totals.kcal;
    subEl.textContent = resto>=0 ? `${Math.round(resto)} kcal rimanenti` : `${Math.round(-resto)} kcal in eccesso`;
    subEl.classList.toggle('kcal-ring-sub-over', resto<0);
  } else {
    fillEl.style.strokeDasharray = `0 ${C}`;
    fillEl.classList.remove('kcal-ring-fill-over');
    pctEl.textContent = '–';
    valueEl.textContent = `${Math.round(totals.kcal)} kcal`;
    subEl.textContent = '';
    subEl.classList.remove('kcal-ring-sub-over');
  }

  if(totalsEl) totalsEl.innerHTML = `
    <div class="macro-row"><span class="macro-dot" style="background:var(--diet);"></span><span class="macro-row-label">Proteine</span><span class="macro-row-val">${Math.round(totals.p)} g</span></div>
    <div class="macro-row"><span class="macro-dot" style="background:var(--accent);"></span><span class="macro-row-label">Carboidrati</span><span class="macro-row-val">${Math.round(totals.c)} g</span></div>
    <div class="macro-row"><span class="macro-dot" style="background:#f0b429;"></span><span class="macro-row-label">Grassi</span><span class="macro-row-val">${Math.round(totals.f)} g</span></div>
    ${hasUnknown ? '<div class="hint" style="margin-top:8px;">Alcuni alimenti scritti liberamente non hanno dati nutrizionali: i totali potrebbero essere incompleti.</div>' : ''}
  `;
}

// Contatore acqua (31/08/2026, Fase 3): funzionalità nuova, nessun dato
// preesistente da riusare — prof.waterLogs, un record per data (come
// prof.mealLogs), inizializzato per tutti i profili in load()/newProfile()
// e nei buffer del PT. Obiettivo indicativo fisso (non è un consiglio
// medico, solo un riferimento visivo, come in fitflow).
const OBIETTIVO_ACQUA_ML = 2500;
function acquaDelGiorno(prof, date){
  return (prof.waterLogs||[]).find(w=>w.date===date);
}
function aggiungiAcqua(deltaMl){
  const prof = activeProfile();
  const date = document.getElementById('mealDate').value || new Date().toISOString().slice(0,10);
  let giorno = acquaDelGiorno(prof, date);
  if(!giorno){ giorno = {date, ml:0}; prof.waterLogs.push(giorno); }
  giorno.ml = Math.max(0, giorno.ml + deltaMl);
  save();
  renderWaterRow(prof, date);
}
function renderWaterRow(prof, date){
  const valueEl = document.getElementById('waterValue');
  const fillEl = document.getElementById('waterBarFill');
  if(!valueEl || !prof) return;
  const giorno = acquaDelGiorno(prof, date);
  const ml = giorno ? giorno.ml : 0;
  const litri = (ml/1000).toFixed(2).replace('.', ',');
  const obLitri = (OBIETTIVO_ACQUA_ML/1000).toFixed(2).replace('.', ',');
  valueEl.textContent = `${litri} / ${obLitri} L`;
  if(fillEl) fillEl.style.width = Math.min(100, Math.round(ml/OBIETTIVO_ACQUA_ML*100)) + '%';
}
document.getElementById('waterPlusBtn').addEventListener('click', ()=>aggiungiAcqua(250));
document.getElementById('waterMinusBtn').addEventListener('click', ()=>aggiungiAcqua(-250));

function renderMealDiary(){
  const prof = activeProfile();
  renderTodayDietPlan();
  if(!document.getElementById('mealDate').value){
    document.getElementById('mealDate').value = new Date().toISOString().slice(0,10);
  }
  const date = document.getElementById('mealDate').value;
  const day = prof.mealLogs.find(m=>m.date===date);
  const items = day ? day.items : [];

  renderMealCards(items, date);
  renderKcalRing(prof, date);
  renderWaterRow(prof, date);
}
document.getElementById('mealDate').addEventListener('change', renderMealDiary);

function renderHistory(){
  const prof = activeProfile();
  const list = document.getElementById('historyList');
  const logs = [...prof.logs].sort((a,b)=> b.date.localeCompare(a.date));
  if(logs.length===0){
    list.innerHTML = '<div class="empty">Nessun allenamento registrato ancora.</div>';
  } else {
    list.innerHTML = "";
    logs.forEach(log=>{
      const item = document.createElement('div');
      item.className='log-item';
      const badgeClass = log.status==='saltato' ? 'skip' : 'ok';
      const badgeText = log.status==='saltato' ? 'Saltato' : (log.dayName || '');
      item.innerHTML = `
        <div class="log-head">
          <div><span class="date">${formatDate(log.date)}</span><span class="dayname">${log.dayKey ? log.dayKey+' · ' : ''}${badgeText}</span></div>
          <span class="status-badge ${badgeClass}">${log.status==='saltato'?'Saltato':'Registrato'}</span>${log.auto?'<span class="status-badge auto">automatico</span>':''}
        </div>
        <div class="log-details">
          ${log.exercises.map(ex=>`
            <div class="log-ex">
              <div class="lname">${ex.name}</div>
              <div class="sets">${ex.sets.map(s=>s.seconds ? `${s.seconds} sec` : `${s.reps||'-'}×${s.kg||'0'}kg`).join('  ·  ')}</div>
            </div>`).join('') || '<div class="hint">Nessun dettaglio esercizi.</div>'}
          ${log.notes ? `<div class="hint" style="margin-top:8px;">"${log.notes}"</div>` : ''}
          ${log.auto ? '<div class="hint" style="margin-top:8px;">Segnato in automatico perché era un giorno previsto dalla scheda e non hai registrato nulla. Se ti sei allenato lo stesso, registra quel giorno dalla scheda Registra: questa voce verrà sostituita.</div>' : ''}
          <button class="btn danger" style="margin-top:10px;" data-id="${log.id}">Elimina registrazione</button>
        </div>`;
      const head = item.querySelector('.log-head');
      const details = item.querySelector('.log-details');
      head.addEventListener('click', ()=>details.classList.toggle('open'));
      item.querySelector('.btn.danger').addEventListener('click', (e)=>{
        e.stopPropagation();
        const msg = log.auto
          ? "Eliminare questa registrazione automatica? Quel giorno non verrà più segnato come saltato."
          : "Eliminare questa registrazione?";
        customConfirm(msg, ()=>{
          if(log.auto){
            if(!prof.autoSkipIgnorati) prof.autoSkipIgnorati = [];
            if(!prof.autoSkipIgnorati.includes(log.date)) prof.autoSkipIgnorati.push(log.date);
          }
          prof.logs = prof.logs.filter(l=>l.id!==log.id);
          save(); renderHistory(); renderHeader(); renderVolume();
          if(document.getElementById('calGiorni')) renderCalendarioStorico();
        });
      });
      list.appendChild(item);
    });
  }
  renderProgressSelect();
}

// ============================================================
