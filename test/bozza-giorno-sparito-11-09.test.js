'use strict';
// ============================================================
// 11/09/2026 — "Aggiorna scheda" sostituisce i giorni SENZA cambiare l'id della
// scheda. ripristinaBozza() controllava che la bozza fosse di QUESTA scheda
// (b.programId === p.id) ma non che il giorno a cui si riferisce esista ancora.
// Percorso del bug, tutto fattibile a mano in un minuto:
//   inizio un allenamento sul giorno X (bozza salvata) → vado in Scheda e
//   toglio il giorno X → "Aggiorna scheda" → torno in Registra → la bozza
//   viene ripristinata su un giorno che non c'è più → "Salva allenamento"
//   cercava quel giorno per prenderne il nome e cadeva.
// Risultato: l'allenamento appena registrato andava perso.
// ============================================================
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

// Profilo con due giorni in scheda e una bozza in corso sul primo.
const PREPARA = `
  const p = state.profiles[0];
  const prog = p.programs[0];
  prog.days = [
    {name:'Petto', key:'d1', weekday:'Lunedì', exercises:[{name:'Panca piana', sets:[{reps:'10', kg:'60'}]}]},
    {name:'Gambe', key:'d2', weekday:'Giovedì', exercises:[{name:'Squat', sets:[{reps:'5', kg:'100'}]}]}
  ];
  p.activeProgramId = prog.id;
  normalizzaProfilo(p);
  renderAll();
  apriRegistra();
  selectDay('d1');
  // scrivo davvero una serie, altrimenti salvaBozza() non conserva nulla
  _bozzaPronta = true;
  currentSetInputs['Panca piana'] = [{reps:'10', kg:'60'}];
  document.getElementById('logNotes').value = 'prima serie fatta';
  salvaBozza();
`;

// "Aggiorna scheda" toglie il giorno della bozza ma tiene lo stesso id scheda.
const TOGLI_IL_GIORNO = `
  prog.days = [{name:'Gambe', key:'d2', weekday:'Giovedì', exercises:[{name:'Squat', sets:[{reps:'5', kg:'100'}]}]}];
  save();
`;

test('la bozza si salva davvero, con lo stesso id della scheda attiva', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    ${PREPARA}
    return { dayKey: p.bozzaLog && p.bozzaLog.dayKey, stessoIdScheda: p.bozzaLog && p.bozzaLog.programId === prog.id };
  `);
  assert.equal(r.dayKey, 'd1');
  assert.equal(r.stessoIdScheda, true, 'è proprio il caso che il controllo su programId non intercetta');
  window.close();
});

test('ripristinaBozza(): non ripristina una bozza il cui giorno non è più in scheda', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    ${PREPARA}
    ${TOGLI_IL_GIORNO}
    _bozzaPronta = false;
    // parto dalla schermata pulita, come quando si entra davvero in Registra
    document.getElementById('logNotes').value = '';
    let errore = null;
    let ripristinata = null;
    try{ ripristinata = ripristinaBozza(); }catch(e){ errore = e.message; }
    return { ripristinata, errore, bozzaPronta: _bozzaPronta,
             note: document.getElementById('logNotes').value,
             bannerVisibile: document.getElementById('bozzaBanner').style.display };
  `);
  assert.equal(r.errore, null, 'non deve crashare');
  assert.equal(r.ripristinata, false, 'la bozza non è ripristinabile: il suo giorno non esiste più');
  assert.equal(r.note, '', 'non deve rimettere nella schermata i dati di una bozza non ripristinabile');
  assert.equal(r.bozzaPronta, false, 'e non deve dichiararsi "bozza pronta"');
  assert.equal(r.bannerVisibile, 'none', 'e non deve comparire il banner "stai riprendendo…"');
  window.close();
});

test('salvare un allenamento non si perde nemmeno se il giorno scelto è sparito dalla scheda', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    ${PREPARA}
    ${TOGLI_IL_GIORNO}
    // il giorno resta selezionato da prima: è lo stato in cui il vecchio
    // ripristinaBozza() lasciava l'app un attimo prima del salvataggio
    selectedDayKey = 'd1';
    currentSetInputs['Panca piana'] = [{reps:'10', kg:'60'}];
    let errore = null;
    try{ document.getElementById('saveLogBtn').click(); }catch(e){ errore = e.message; }
    const ultimo = p.logs[p.logs.length-1];
    return { errore, quantiLog: p.logs.length,
             dayName: ultimo && ultimo.dayName,
             esercizi: ultimo && ultimo.exercises.map(e=>e.name) };
  `);
  assert.equal(r.errore, null, 'il salvataggio non deve crashare');
  assert.equal(r.quantiLog, 1, 'l\'allenamento svolto va registrato, non perso');
  assert.equal(r.dayName, 'Allenamento libero', 'senza il giorno in scheda resta etichettato come libero');
  assert.deepEqual(r.esercizi, ['Panca piana'], 'le serie inserite devono finire nel log');
  window.close();
});

test('una bozza il cui giorno c\'è ancora continua a ripristinarsi normalmente', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    ${PREPARA}
    _bozzaPronta = false;
    const ripristinata = ripristinaBozza();
    return { ripristinata, selectedDayKey, note: document.getElementById('logNotes').value,
             bannerVisibile: document.getElementById('bozzaBanner').style.display };
  `);
  assert.equal(r.ripristinata, true, 'nessuna regressione: la bozza valida si ripristina ancora');
  assert.equal(r.selectedDayKey, 'd1');
  assert.equal(r.note, 'prima serie fatta', 'e riporta indietro quello che era stato scritto');
  assert.equal(r.bannerVisibile, 'block');
  window.close();
});

// Il messaggio di conferma mostrava la CHIAVE interna del giorno
// ("giorno mtwuf4p6ipo91"), che per chi legge non vuol dire niente.
test('cambiando giorno con una registrazione in corso il messaggio usa il NOME del giorno, non la chiave', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    ${PREPARA}
    let messaggio = null;
    window.customConfirm = (m)=>{ messaggio = m; };
    selectDay('d2');   // passo a un altro giorno: scatta la conferma
    return { messaggio };
  `);
  assert.match(r.messaggio, /Petto/, 'deve nominare il giorno "Petto"');
  assert.doesNotMatch(r.messaggio, /giorno d1/, 'non deve mostrare la chiave interna');
  window.close();
});
