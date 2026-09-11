'use strict';
// ============================================================
// 11/09/2026 — Controllo generale dell'app in dirittura d'arrivo.
//
// Negli ultimi giorni erano usciti, uno alla volta, sempre gli stessi crash:
// un profilo il cui "dati" non ha la forma che l'app dà per scontata, e la
// schermata muore con "undefined is not an object". Ogni volta si correggeva
// il singolo punto che era crashato (programs, poi logs, poi la card del PT,
// poi activeProgram()...). Qui invece si prova la cosa in modo sistematico:
// si mette il profilo in ogni forma "storta" plausibile e si chiede a TUTTE le
// schermate di disegnarsi. Se una qualunque casca, il test fallisce.
//
// Le forme storte non sono inventate: nascono da dati scritti da una versione
// precedente dell'app, dal buffer del cliente lato PT, da una sincronizzazione
// a metà, o da una scheda cancellata su un altro dispositivo.
// ============================================================
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

// Disegna tutto quello che l'app sa disegnare e riporta chi è crashato.
const DISEGNA_TUTTO = `
  const errori = [];
  const prova = (etichetta, fn) => { try{ fn(); }catch(e){ errori.push(etichetta+': '+((e&&e.message)||String(e))); } };
  const renderer = ['renderAll','renderHeader','renderDayChoices','renderHistory','renderVolume',
    'renderMeasurements','renderMealDiary','renderProgramView','renderNewProgramForm','renderSchedaView',
    'renderDietPlanView','renderCalendarioStorico','renderRiepilogoMensile','renderProgressSelect',
    'renderProgressTable','renderMioPT','renderNotifiche','renderTodayDietPlan','renderFabbisognoCalorico',
    'renderArchiveList','renderDayEditors','renderSchedaEditForm','renderDietEditForm','renderReminderBanner'];
  for(const r of renderer) if(typeof window[r]==='function') prova(r, ()=>window[r]());
  for(const tab of ['home','program','storico','diet','log','account']) prova('vaiA('+tab+')', ()=>vaiA(tab));
  return errori;
`;

// Ogni caso: come arriva il profilo "storto" dal salvataggio/dal cloud.
// normalizzaProfilo() gira su OGNI profilo caricato: è lì che la forma va
// raddrizzata, una volta sola, invece di un controllo in ognuno dei ~25 punti
// che leggono questi campi.
const CASI = {
  'scheda senza "days"':
    `p.programs = [{id:'p1', name:'Scheda', createdAt:'2026-01-01', archivedAt:null}]; p.activeProgramId='p1';`,
  'giorno senza "exercises"':
    `p.programs[0].days = [{name:'Giorno A', key:'a', weekday:'lun'}];`,
  'esercizio senza "sets"':
    `p.programs[0].days = [{name:'A', key:'a', exercises:[{name:'Panca'}]}];`,
  'allenamento registrato senza "exercises"':
    `p.logs = [{id:'l1', date:'2026-09-01', programId:p.programs[0].id, status:'registrato'}];`,
  'esercizio di un allenamento senza "sets"':
    `p.logs = [{id:'l1', date:'2026-09-01', programId:p.programs[0].id, status:'registrato', exercises:[{name:'Panca'}]}];`,
  'activeProgramId che punta a una scheda che non esiste più':
    `p.activeProgramId = 'scheda-cancellata-altrove';`,
};

for(const [nome, storto] of Object.entries(CASI)){
  test(`nessuna schermata crasha: ${nome}`, async () => {
    const { window } = await loadApp();
    window.eval('console.error=()=>{};console.warn=()=>{};');
    const errori = await run(window, `
      const p = state.profiles[0];
      ${storto}
      normalizzaProfilo(p);   // come al caricamento di un profilo vero
      ${DISEGNA_TUTTO}
    `);
    assert.deepEqual(errori, [], 'schermate andate in crash:\n  ' + errori.join('\n  '));
    window.close();
  });
}

// ------------------------------------------------------------
// activeProgram() non deve MAI restituire undefined/null se il profilo ha
// almeno una scheda: tutti i suoi chiamanti fanno `.name`/`.days`/`.dietInfo`
// senza controlli, quindi un undefined qui fa cadere Home, Scheda, Dieta,
// Storico e l'intestazione tutte assieme.
// ------------------------------------------------------------
test('activeProgram(): con un activeProgramId che non esiste più ripiega sulla scheda più recente', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = state.profiles[0];
    p.programs = [{id:'vecchia', name:'Vecchia', days:[]}, {id:'nuova', name:'Nuova', days:[]}];
    p.activeProgramId = 'sparita';
    const ap = activeProgram();
    return { nome: ap ? ap.name : null, idRiparato: p.activeProgramId };
  `);
  assert.equal(r.nome, 'Nuova', 'deve ripiegare sulla scheda più recente, non tornare undefined');
  assert.equal(r.idRiparato, 'nuova', 'e deve anche riparare l\'id, così non ci ricasca al giro dopo');
  window.close();
});

// ------------------------------------------------------------
// La pulizia automatica delle schede archiviate mai compilate
// (renderArchiveList) non deve poter svuotare del tutto l'elenco: in tutta
// l'app vale l'invariante "un profilo ha sempre almeno una scheda". Prima, se
// l'unica scheda del profilo era archiviata e vuota — proprio la scheda
// "bianca" di partenza che quella pulizia ha lo scopo di togliere — restava
// programs:[], activeProgram() tornava null, ogni schermata crashava, e il
// save() subito dopo scriveva l'elenco vuoto anche online.
// ------------------------------------------------------------
test('pulizia archivio: non lascia mai il profilo senza nemmeno una scheda', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    const p = state.profiles[0];
    p.programs.forEach(x=>x.archivedAt='2026-01-01');   // unica scheda, archiviata e vuota
    p.activeProgramId = null;
    const errori = [];
    try{ renderArchiveList(); }catch(e){ errori.push('renderArchiveList: '+e.message); }
    const ap = activeProgram();
    return { quanteSchede: p.programs.length, schedaAttivaEsiste: !!ap, errori };
  `);
  assert.equal(r.quanteSchede, 1, 'la sola scheda rimasta non va cancellata');
  assert.equal(r.schedaAttivaEsiste, true, 'activeProgram() non deve tornare null');
  assert.deepEqual(r.errori, []);
  window.close();
});

test('pulizia archivio: continua a togliere le schede archiviate vuote quando ne resta un\'altra', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    const p = state.profiles[0];
    p.programs = [
      {id:'vuota', name:'Bianca di partenza', createdAt:'2026-01-01', archivedAt:'2026-02-01', days:[], diet:{}},
      {id:'buona', name:'Scheda vera', createdAt:'2026-02-01', archivedAt:null,
       days:[{name:'A', key:'a', exercises:[{name:'Panca', sets:[{reps:'10', kg:'50'}]}]}], diet:{}}
    ];
    p.activeProgramId = 'buona';
    renderArchiveList();
    return p.programs.map(x=>x.id);
  `);
  assert.deepEqual(r, ['buona'], 'la scheda archiviata e mai compilata va ancora scartata');
  window.close();
});

// ------------------------------------------------------------
// Lato PT: activeProfile() restituisce il buffer del cliente, quindi TUTTI i
// renderer girano su quel buffer. Se il buffer non ha la stessa forma
// garantita di un profilo normale, il PT si trova la schermata rotta — è lo
// stesso crash già corretto il 10/09 per l'accesso del cliente, che su questo
// lato era rimasto aperto perché preparaClienteBuffer() aveva una copia a mano
// e incompleta dei controlli di normalizzaProfilo() (le mancava "logs").
// ------------------------------------------------------------
const CLIENTI_STORTI = {
  'cliente senza "logs"': `{ programs:[{id:'p1',name:'S',days:[]}], activeProgramId:'p1' }`,
  'cliente con pochissimi campi in "dati"': `{ checkinVistaPtIl:'2026-09-01' }`,
  'cliente con "dati" nullo': `null`,
  'cliente con scheda senza "days"': `{ logs:[], programs:[{id:'p1',name:'S'}], activeProgramId:'p1' }`,
  'cliente con activeProgramId sparito': `{ logs:[], programs:[{id:'p1',name:'S',days:[]}], activeProgramId:'sparita' }`,
};

for(const [nome, dati] of Object.entries(CLIENTI_STORTI)){
  test(`il PT può aprire scheda e dieta: ${nome}`, async () => {
    const { window } = await loadApp();
    window.eval('console.error=()=>{};console.warn=()=>{};');
    const errori = await run(window, `
      const errori = [];
      const prova = (et,fn)=>{ try{ fn(); }catch(e){ errori.push(et+': '+((e&&e.message)||String(e))); } };
      utenteOnline = { id:'pt-1' };
      const riga = { id:'c1', nome:'Cliente', email:'c@test.it', dati: ${dati} };
      _clienteAperto = { riga, rapporto:{ id:'r1', pt_id:'pt-1', cliente_id:'c1', stato:'attivo', puo_scheda:true, puo_dieta:true } };
      prova('preparaClienteBuffer', ()=>{ _clienteBuffer = preparaClienteBuffer(riga); });
      // il buffer è il profilo su cui gira TUTTA l'app in modalità PT: deve
      // avere gli stessi array garantiti di un profilo normale
      prova('il buffer ha "logs"', ()=>{ if(!Array.isArray(_clienteBuffer.logs)) throw new Error('logs non è un array'); });
      prova('mostraEditorSchedaInlinePT', ()=>mostraEditorSchedaInlinePT());
      prova('mostraEditorDietaInlinePT', ()=>mostraEditorDietaInlinePT());
      prova('renderAll sul cliente', ()=>renderAll());
      return errori;
    `);
    assert.deepEqual(errori, [], 'il PT è andato in crash su:\n  ' + errori.join('\n  '));
    window.close();
  });
}

// ------------------------------------------------------------
// Salvare la DIETA crea una nuova versione della scheda. Portava dietro solo
// nome/scadenza/giorni: durataSettimane, dataInizio e notePT restavano
// indietro. Effetto concreto: dopo un salvataggio della dieta la scheda
// perdeva durata, data d'inizio e le note del PT senza dirlo a nessuno, e al
// successivo "Aggiorna scheda" la scadenza impostata dal PT spariva del tutto
// (calcolaScadenzaScheda ripartiva da dataInizio rimessa a oggi, durata null).
// ------------------------------------------------------------
test('salvare la dieta non perde durata, data d\'inizio e note del PT della scheda', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    const p = state.profiles[0];
    const scheda = p.programs[0];
    scheda.days = [{name:'A', key:'a', exercises:[{name:'Panca', sets:[{reps:'10', kg:'50'}]}]}];
    scheda.durataSettimane = 8;
    scheda.dataInizio = '2026-09-01';
    scheda.scadenza = '2026-10-27';
    scheda.notePT = 'Cura la tecnica sullo squat';
    p.activeProgramId = scheda.id;

    renderDietEditForm();                                  // popola editingDiet/editingDietInfo
    document.getElementById('saveDietBtn').click();         // crea la nuova versione

    const nuova = activeProgram();
    return { durataSettimane: nuova.durataSettimane, dataInizio: nuova.dataInizio,
             notePT: nuova.notePT, scadenza: nuova.scadenza };
  `);
  assert.equal(r.durataSettimane, 8, 'la durata della scheda non va persa');
  assert.equal(r.dataInizio, '2026-09-01', 'la data d\'inizio non va persa');
  assert.equal(r.notePT, 'Cura la tecnica sullo squat', 'le note del PT non vanno perse');
  assert.equal(r.scadenza, '2026-10-27', 'la scadenza resta quella impostata');
  window.close();
});
