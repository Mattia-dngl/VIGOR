'use strict';
// Allenamenti stimati (11/09/2026, richiesta di chi usa l'app): i giorni
// previsti dalla scheda e mai registrati non restano più solo "saltati" —
// possono essere riempiti con la media dei carichi delle ultime sedute vere
// di quegli stessi esercizi (js/storico/allenamenti-stimati.js).
//
// Quello che questi test difendono è soprattutto il confine: una stima non è
// un allenamento svolto e non deve poter passare per tale da nessuna parte —
// non nei record personali, non nel suggerimento "ultima volta", non nei
// numeri che legge chi ti segue, e mai sopra un "saltato" scelto a mano.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

// Profilo di comodo: una scheda con un solo giorno al lunedì, due esercizi,
// e i log che ogni test gli passa.
const PROFILO = `
  const prof = loggedInProfile();
  prof.programs = [{
    id:'P1', name:'Scheda', createdAt:'2026-01-01', archivedAt:null,
    days:[{ key:'A', name:'Petto', weekday:'Lunedì', exercises:[
      { name:'Panca Piana', reps:'8', sets:3 },
      { name:'Chest Press', reps:'10', sets:3 }
    ]}],
    diet:{}, dietInfo:{}
  }];
  prof.activeProgramId = 'P1';
`;

// due sedute vere dello stesso giorno di scheda + un lunedì saltato in automatico
const STORICO = `
  prof.logs = [
    { id:'v1', date:'2026-01-05', programId:'P1', status:'registrato', dayKey:'A', dayName:'Petto', notes:'', exercises:[
      { name:'Panca Piana', sets:[{reps:'8', kg:'60', seconds:''},{reps:'8', kg:'70', seconds:''}] },
      { name:'Chest Press', sets:[{reps:'10', kg:'40', seconds:''}] }
    ]},
    { id:'v2', date:'2026-01-12', programId:'P1', status:'registrato', dayKey:'A', dayName:'Petto', notes:'', exercises:[
      { name:'Panca Piana', sets:[{reps:'8', kg:'65', seconds:''},{reps:'6', kg:'75', seconds:''}] },
      { name:'Chest Press', sets:[{reps:'10', kg:'45', seconds:''}] }
    ]},
    { id:'s1', date:'2026-01-19', programId:'P1', status:'saltato', auto:true,
      dayKey:null, dayName:null, notes:'', exercises:[] }
  ];
`;

test('riempie un saltato automatico con la media per esercizio delle sedute precedenti', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${PROFILO}
    ${STORICO}
    const n = riempiSaltatiConStima();
    const log = prof.logs.find(l=>l.date==='2026-01-19');
    return { n, stimato: !!log.stimato, status: log.status, dayKey: log.dayKey, dayName: log.dayName,
             esercizi: log.exercises.map(e=>({ nome:e.name, kg:e.sets.map(s=>s.kg), reps:e.sets.map(s=>s.reps) })) };
  `);
  assert.equal(r.n, 1);
  assert.equal(r.stimato, true);
  assert.equal(r.status, 'registrato');
  // il giorno di scheda viene dedotto dal giorno della settimana (19/01/2026 è un lunedì)
  assert.equal(r.dayKey, 'A');
  assert.equal(r.dayName, 'Petto');
  // media PER ESERCIZIO, serie per serie: mai fra esercizi diversi
  assert.deepEqual(r.esercizi[0], { nome:'Panca Piana', kg:['62.5','72.5'], reps:['8','7'] });
  assert.deepEqual(r.esercizi[1], { nome:'Chest Press', kg:['42.5'], reps:['10'] });
});

test('un esercizio mai registrato resta fuori dalla stima, invece di inventare un carico', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${PROFILO}
    ${STORICO}
    // "Chest Press" non è mai stato fatto: tolgo le sue righe dallo storico
    prof.logs.forEach(l=>{ l.exercises = (l.exercises||[]).filter(e=>e.name!=='Chest Press'); });
    riempiSaltatiConStima();
    const log = prof.logs.find(l=>l.date==='2026-01-19');
    return log.exercises.map(e=>e.name);
  `);
  assert.deepEqual(r, ['Panca Piana']);
});

test('se nessun esercizio del giorno ha uno storico il giorno resta saltato', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${PROFILO}
    prof.logs = [{ id:'s1', date:'2026-01-19', programId:'P1', status:'saltato', auto:true,
                   dayKey:null, dayName:null, notes:'', exercises:[] }];
    const n = riempiSaltatiConStima();
    const log = prof.logs.find(l=>l.date==='2026-01-19');
    return { n, status: log.status, stimato: !!log.stimato };
  `);
  assert.deepEqual(r, { n:0, status:'saltato', stimato:false });
});

test('un "saltato" segnato a mano non viene mai riscritto da una stima', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${PROFILO}
    ${STORICO}
    delete prof.logs.find(l=>l.id==='s1').auto;   // saltato scelto dalla persona, non dall'app
    const n = riempiSaltatiConStima();
    const log = prof.logs.find(l=>l.date==='2026-01-19');
    return { n, status: log.status, stimato: !!log.stimato };
  `);
  assert.deepEqual(r, { n:0, status:'saltato', stimato:false });
});

test('una stima non entra mai nella media di un\'altra stima', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${PROFILO}
    ${STORICO}
    // due lunedì saltati di fila: il secondo non deve vedere il primo
    prof.logs.push({ id:'s2', date:'2026-01-26', programId:'P1', status:'saltato', auto:true,
                     dayKey:null, dayName:null, notes:'', exercises:[] });
    riempiSaltatiConStima();
    const a = prof.logs.find(l=>l.date==='2026-01-19');
    const b = prof.logs.find(l=>l.date==='2026-01-26');
    return { a: a.exercises[0].sets.map(s=>s.kg), b: b.exercises[0].sets.map(s=>s.kg) };
  `);
  // entrambe le stime nascono dalle stesse due sedute VERE, quindi sono identiche:
  // se la seconda avesse mangiato la prima i numeri divergerebbero
  assert.deepEqual(r.a, ['62.5','72.5']);
  assert.deepEqual(r.b, ['62.5','72.5']);
});

test('a corpo libero il peso resta vuoto, non diventa 0 kg', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${PROFILO}
    prof.programs[0].days[0].exercises = [{ name:'Trazioni', reps:'6', sets:3 }];
    prof.logs = [
      { id:'v1', date:'2026-01-05', programId:'P1', status:'registrato', dayKey:'A', dayName:'Petto', notes:'', exercises:[
        { name:'Trazioni', sets:[{reps:'6', kg:'', seconds:''},{reps:'4', kg:'', seconds:''}] }]},
      { id:'s1', date:'2026-01-19', programId:'P1', status:'saltato', auto:true,
        dayKey:null, dayName:null, notes:'', exercises:[] }
    ];
    riempiSaltatiConStima();
    return prof.logs.find(l=>l.date==='2026-01-19').exercises[0].sets;
  `);
  assert.deepEqual(r, [{ kg:'', reps:'6', seconds:'' }, { kg:'', reps:'4', seconds:'' }]);
});

test('una stima non conta come record personale', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${PROFILO}
    prof.logs = [
      { id:'v1', date:'2026-01-05', programId:'P1', status:'registrato', exercises:[
        { name:'Panca Piana', sets:[{reps:'5', kg:'80', seconds:''}] }]},
      { id:'st', date:'2026-01-19', programId:'P1', status:'registrato', stimato:true, exercises:[
        { name:'Panca Piana', sets:[{reps:'5', kg:'200', seconds:''}] }]}
    ];
    return recordPersonale(prof, 'Panca Piana');
  `);
  assert.equal(r.data, '2026-01-05');   // non il 19, nonostante i 200 kg finti
  assert.equal(r.valore, 93);
});

test('"ultima volta" salta le stime e mostra l\'ultima seduta vera', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${PROFILO}
    prof.logs = [
      { id:'v1', date:'2026-01-05', programId:'P1', status:'registrato', exercises:[
        { name:'Panca Piana', sets:[{reps:'5', kg:'80', seconds:''}] }]},
      { id:'st', date:'2026-01-19', programId:'P1', status:'registrato', stimato:true, exercises:[
        { name:'Panca Piana', sets:[{reps:'5', kg:'90', seconds:''}] }]}
    ];
    return ultimaPrestazione('Panca Piana', null);
  `);
  assert.equal(r.data, '2026-01-05');
});

test('rimuoviStime() riporta i giorni a "saltato" e lascia stare gli allenamenti veri', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${PROFILO}
    ${STORICO}
    riempiSaltatiConStima();
    const tolte = rimuoviStime();
    const log = prof.logs.find(l=>l.date==='2026-01-19');
    return { tolte, stimeRimaste: prof.logs.filter(l=>l.stimato).length,
             veri: prof.logs.filter(l=>l.status==='registrato').length,
             tornatoSaltato: !!(log && log.status==='saltato') };
  `);
  assert.deepEqual(r, { tolte:1, stimeRimaste:0, veri:2, tornatoSaltato:true });
});

test('lo storico mostra l\'etichetta "stimato" e la spiegazione', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    ${PROFILO}
    ${STORICO}
    riempiSaltatiConStima();
    renderHistory();
  `);
  const html = document.getElementById('historyList').innerHTML;
  assert.match(html, /status-badge stimato/);
  assert.match(html, /media delle tue ultime sedute/);
});

test('l\'automatismo è spento finché non lo si accende, e allora riempie da solo', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${PROFILO}
    ${STORICO}
    controllaStime(false);
    const primaDi = prof.logs.filter(l=>l.stimato).length;
    prof.autoStima = true;
    _autoStimaFatto = null;
    controllaStime(false);
    return { primaDi, dopo: prof.logs.filter(l=>l.stimato).length };
  `);
  assert.deepEqual(r, { primaDi:0, dopo:1 });
});
