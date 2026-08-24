'use strict';
// Test della vista d'insieme del PT ("cose da guardare oggi", index.html:
// renderAreaPT/segnaliPT) — chi non si allena da una settimana, chi ha un
// piano con scadenza superata, quante richieste sono in sospeso.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('segnaliPT: individua inattività e scadenza piano', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const oggi = new Date();
    const iso = d => d.toISOString().slice(0,10);
    const dieciGiorniFa = iso(new Date(oggi.getTime() - 10*86400000));
    const ieri = iso(new Date(oggi.getTime() - 1*86400000));
    const domani = iso(new Date(oggi.getTime() + 1*86400000));

    const fermoDaTroppo = segnaliPT({ dati: {
      logs: [{status:'registrato', date: dieciGiorniFa}],
      programs: [{id:'p1', scadenza:null}], activeProgramId:'p1'
    }});
    const attivoDiRecente = segnaliPT({ dati: {
      logs: [{status:'registrato', date: ieri}],
      programs: [{id:'p1', scadenza:null}], activeProgramId:'p1'
    }});
    const maiAllenato = segnaliPT({ dati: { logs: [], programs: [{id:'p1'}], activeProgramId:'p1' }});
    const pianoScaduto = segnaliPT({ dati: {
      logs: [{status:'registrato', date: ieri}],
      programs: [{id:'p1', name:'Scheda X', scadenza: ieri}], activeProgramId:'p1'
    }});
    const pianoNonAncoraScaduto = segnaliPT({ dati: {
      logs: [{status:'registrato', date: ieri}],
      programs: [{id:'p1', name:'Scheda X', scadenza: domani}], activeProgramId:'p1'
    }});
    return { fermoDaTroppo, attivoDiRecente, maiAllenato, pianoScaduto, pianoNonAncoraScaduto };
  `);
  assert.equal(r.fermoDaTroppo.fermoDaTroppo, true);
  assert.equal(r.attivoDiRecente.fermoDaTroppo, false);
  assert.equal(r.maiAllenato.fermoDaTroppo, true);
  assert.equal(r.maiAllenato.giorniFermo, null);
  assert.equal(r.pianoScaduto.scadenzaPassata, true);
  assert.equal(r.pianoNonAncoraScaduto.scadenzaPassata, false);
  window.close();
});

test('renderAreaPT: la card "cose da guardare oggi" elenca solo chi ha davvero bisogno di attenzione', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const oggi = new Date();
    const iso = d => d.toISOString().slice(0,10);
    const dieciGiorniFa = iso(new Date(oggi.getTime() - 10*86400000));
    const ieri = iso(new Date(oggi.getTime() - 1*86400000));

    utenteOnline = { id: 'pt-1' };

    const clienteOk = { id:'cli-ok', nome:'Cliente Ok', email:'ok@test.it',
      dati:{ logs:[{status:'registrato', date: ieri}], programs:[{id:'p1', name:'Scheda', scadenza:null}], activeProgramId:'p1' } };
    const clienteFermo = { id:'cli-fermo', nome:'Cliente Fermo', email:'fermo@test.it',
      dati:{ logs:[{status:'registrato', date: dieciGiorniFa}], programs:[{id:'p1', name:'Scheda', scadenza:null}], activeProgramId:'p1' } };
    const clienteScaduto = { id:'cli-scaduto', nome:'Cliente Scaduto', email:'scaduto@test.it',
      dati:{ logs:[{status:'registrato', date: ieri}], programs:[{id:'p1', name:'Scheda Vecchia', scadenza: ieri}], activeProgramId:'p1' } };

    const profili = { 'cli-ok': clienteOk, 'cli-fermo': clienteFermo, 'cli-scaduto': clienteScaduto };
    sb = {
      from(table){
        if(table === 'rapporti_pt'){
          const rapporti = [
            {id:'r-ok', cliente_id:'cli-ok', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:true},
            {id:'r-fermo', cliente_id:'cli-fermo', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:true},
            {id:'r-scaduto', cliente_id:'cli-scaduto', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:true}
          ];
          return { select(){ return this; }, or(){ return Promise.resolve({data: rapporti, error:null}); } };
        }
        if(table === 'profili'){
          return { select(){ return this; }, eq(col, val){ return { maybeSingle(){ return Promise.resolve({data: profili[val]||null, error:null}); } }; } };
        }
        return { select(){return this;}, eq(){return this;}, or(){return Promise.resolve({data:[],error:null});} };
      }
    };

    document.getElementById('areaPT').style.display = 'block';
    await renderAreaPT();
    const testoOggi = document.getElementById('ptOggi').innerHTML;
    return {
      contaOggi: document.getElementById('ptContaOggi').textContent,
      contieneFermo: testoOggi.includes('Cliente Fermo'),
      contieneScaduto: testoOggi.includes('Cliente Scaduto'),
      contieneOk: testoOggi.includes('Cliente Ok')
    };
  `);
  assert.equal(r.contaOggi, '(2)');
  assert.equal(r.contieneFermo, true);
  assert.equal(r.contieneScaduto, true);
  assert.equal(r.contieneOk, false); // il cliente in regola non deve comparire nella lista d'allarme
  window.close();
});
