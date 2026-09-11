'use strict';
// ============================================================
// 11/09/2026 — segnaVistaPT() cancellava i dati dei clienti.
//
// Parte a OGNI tocco sulle linguette Scheda/Dieta/Check-in del cliente, e
// scriveva l'INTERO blob "dati" partendo da _clienteAperto.riga.dati: la
// fotografia scattata quando il PT ha caricato l'elenco clienti, che può
// essere vecchia di minuti. Bastava questo:
//   il PT apre l'elenco alle 10:00 → il cliente si allena e salva alle 10:05
//   → il PT tocca "Scheda" alle 10:10 → veniva riscritta la fotografia delle
//   10:00 e l'allenamento delle 10:05 spariva.
//
// È anche la funzione da cui era uscito il profilo reale che aveva in "dati"
// SOLO checkinVistaPtIl/dietaVistaPtIl (vedi il commento in
// normalizzaProfilo): scrivendo `{} + marcatore` si otteneva esattamente quello.
//
// salvaModifichePT() gestisce già il problema con una scrittura condizionata su
// aggiornato_il; qui non c'era nessuna protezione.
// ============================================================
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

// Finto Supabase con UNA riga "profili": tiene traccia di cosa viene scritto e
// rispetta le condizioni .eq() come fa PostgREST (se non combaciano, non
// scrive nulla e torna un array vuoto, senza errore).
const FINTO_SB = `
  window.__riga = {
    id: 'cli-1',
    aggiornato_il: '2026-09-11T10:05:00.000Z',   // il cliente ha salvato alle 10:05
    dati: { logs:[{id:'l1', date:'2026-09-11', status:'registrato', exercises:[]}],
            programs:[{id:'p1', name:'Scheda', days:[]}], activeProgramId:'p1' }
  };
  window.__scritture = [];
  sb = {
    from(){
      const q = {
        _filtri: {}, _upd: null,
        select(){ return q; },
        eq(col, val){ q._filtri[col] = val; return q._esegui(); },
        update(valori){ q._upd = valori; return q; },
        maybeSingle(){ return Promise.resolve({ data: { dati: window.__riga.dati, aggiornato_il: window.__riga.aggiornato_il }, error:null }); },
        _esegui(){
          // catena ancora in costruzione: restituisco q finché non si chiede il risultato
          const p = Promise.resolve().then(()=>{
            if(!q._upd) return { data:[{id:window.__riga.id}], error:null };
            const condOk = Object.keys(q._filtri).every(c => window.__riga[c] === q._filtri[c]);
            window.__scritture.push({ filtri: Object.assign({}, q._filtri), valori: q._upd, applicata: condOk });
            if(!condOk) return { data: [], error: null };   // come PostgREST: niente scritto
            Object.assign(window.__riga, q._upd);
            return { data:[{id:window.__riga.id}], error:null };
          });
          q.then = p.then.bind(p); q.catch = p.catch.bind(p);
          return q;
        }
      };
      return q;
    }
  };
`;

test('segnaVistaPT(): rilegge i dati freschi invece di riscrivere la fotografia vecchia', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    ${FINTO_SB}
    // fotografia VECCHIA in memoria: com'era prima che il cliente si allenasse
    _clienteAperto = { riga: { id:'cli-1', nome:'Cliente', email:'c@test.it',
      aggiornato_il: '2026-09-11T10:00:00.000Z',
      dati: { logs:[], programs:[{id:'p1', name:'Scheda', days:[]}], activeProgramId:'p1' } } };

    await segnaVistaPT('scheda');

    return {
      allenamentiRimasti: (window.__riga.dati.logs || []).length,
      marcatore: !!window.__riga.dati.schedaVistaPtIl,
      schedeRimaste: (window.__riga.dati.programs || []).length
    };
  `);
  assert.equal(r.allenamentiRimasti, 1,
    'l\'allenamento salvato dal cliente non deve essere cancellato dal tocco del PT');
  assert.equal(r.schedeRimaste, 1, 'né la sua scheda');
  assert.equal(r.marcatore, true, 'e il marcatore "visto" deve comunque essere impostato');
  window.close();
});

test('segnaVistaPT(): non riscrive un blob quasi vuoto quando la fotografia in memoria è vuota', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    ${FINTO_SB}
    // è il caso che aveva prodotto il profilo reale con soli 2-3 campi in "dati"
    _clienteAperto = { riga: { id:'cli-1', nome:'Cliente', email:'c@test.it', dati: null } };

    await segnaVistaPT('checkin');

    return {
      campi: Object.keys(window.__riga.dati).sort(),
      allenamentiRimasti: (window.__riga.dati.logs || []).length
    };
  `);
  assert.equal(r.allenamentiRimasti, 1,
    'una fotografia vuota in memoria non deve azzerare il profilo vero del cliente');
  assert.ok(r.campi.includes('programs') && r.campi.includes('logs'),
    'i campi veri del profilo devono restare, non solo il marcatore: ' + r.campi.join(','));
  window.close();
});

test('segnaVistaPT(): se il cliente salva tra la rilettura e la scrittura, non insiste e non sovrascrive', async () => {
  const { window } = await loadApp();
  window.eval('console.error=()=>{};');
  const r = await run(window, `
    ${FINTO_SB}
    _clienteAperto = { riga: { id:'cli-1', nome:'Cliente', dati:{} } };
    // il cliente salva subito DOPO la rilettura: aggiornato_il non è più quello
    const _maybeSingle = sb.from().maybeSingle;
    const fromVero = sb.from.bind(sb);
    sb.from = function(){
      const q = fromVero();
      const originale = q.maybeSingle;
      q.maybeSingle = function(){
        return originale.call(q).then(res=>{
          window.__riga.aggiornato_il = '2026-09-11T10:20:00.000Z';   // scrittura del cliente
          window.__riga.dati = Object.assign({}, window.__riga.dati, {logs:[{id:'l1'},{id:'l2'}]});
          return res;
        });
      };
      return q;
    };

    await segnaVistaPT('scheda');

    const ultima = window.__scritture[window.__scritture.length-1];
    return {
      scritturaApplicata: ultima ? ultima.applicata : null,
      allenamentiRimasti: (window.__riga.dati.logs || []).length,
      condizionataSuAggiornatoIl: ultima ? ('aggiornato_il' in ultima.filtri) : false
    };
  `);
  assert.equal(r.condizionataSuAggiornatoIl, true,
    'la scrittura deve essere condizionata su aggiornato_il, come in salvaModifichePT');
  assert.equal(r.scritturaApplicata, false, 'in conflitto non deve scrivere');
  assert.equal(r.allenamentiRimasti, 2,
    'i due allenamenti appena salvati dal cliente devono restare intatti');
  window.close();
});
