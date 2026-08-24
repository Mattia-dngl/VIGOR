'use strict';
// Regressione: la corsa tra i tab della scheda cliente lato PT (Riepilogo /
// Scheda / Dieta / Storico). Prima del fix, un secondo tap che arrivava
// mentre il primo cambio tab stava ancora salvando poteva sovrapporre due
// chiusure d'editor contemporanee: il tab evidenziato cambiava ma il
// contenuto mostrato restava quello vecchio. La difesa è il flag
// `_cambiandoTabPT` (index.html, listener su `.pt-tab`): un secondo click
// che arriva mentre il primo è ancora in corso viene semplicemente ignorato,
// invece di partire in parallelo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function fakeSupabaseCliente(cliente){
  return `{
    from(table){
      if(table === 'profili'){
        return {
          select(){ return this; },
          eq(col, val){ return { maybeSingle(){ return Promise.resolve({data: val===${JSON.stringify(cliente.id)} ? ${JSON.stringify(cliente)} : null, error:null}); } }; },
          update(patch){ return { eq(col,val){ return Promise.resolve({error:null}); } }; }
        };
      }
      return { select(){return this;}, eq(){return this;}, or(){return Promise.resolve({data:[],error:null});}, update(){return {eq(){return Promise.resolve({error:null});}};} };
    }
  }`;
}

test('doppio tap rapido sui tab del cliente: il secondo click durante il primo viene ignorato, niente stato incoerente', async () => {
  const { window } = await loadApp();
  const cliente = {
    id: 'cli-1', nome: 'Cliente Uno', email: 'uno@test.it',
    dati: {
      logs: [], measurements: [],
      programs: [{ id:'p1', name:'Scheda Base', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
        days: [{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}],
        dietInfo: {}, diet: { Lunedì:{libera:false, colazione:'', pranzo:'', spuntino:'', cena:''} } }],
      activeProgramId: 'p1'
    }
  };
  const r = await run(window, `
    utenteOnline = { id: 'pt-1' };
    _rapporti = [{ id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:true }];
    sb = ${fakeSupabaseCliente(cliente)};

    document.getElementById('areaPT').style.display = 'block';
    await apriCliente('cli-1');

    const tabScheda = document.querySelector('.pt-tab[data-pttab="scheda"]');
    const tabDieta = document.querySelector('.pt-tab[data-pttab="dieta"]');

    // doppio tap ravvicinato: il secondo arriva mentre il primo sta ancora
    // salvando/chiudendo l'editor precedente.
    tabScheda.click();
    tabDieta.click();

    // lascio scorrere microtask/timeout pendenti finché il primo cambio tab
    // (quello che il guard NON ha scartato) non si è concluso del tutto.
    for(let i=0;i<20;i++){ await new Promise(res=>setTimeout(res,0)); }

    const attivi = Array.from(document.querySelectorAll('.pt-tab.active')).map(t=>t.dataset.pttab);
    const corpo = document.getElementById('ptDettaglioCorpo').innerHTML;
    return {
      attivi,
      cambiandoBloccato: _cambiandoTabPT,
      mostraSchedaSlot: corpo.includes('ptSchedaEditorSlot'),
      mostraDietaSlot: corpo.includes('ptDietaEditorSlot')
    };
  `);

  // un solo tab attivo alla fine, non due, e non uno stato "a metà"
  assert.equal(r.attivi.length, 1, `mi aspettavo un solo tab attivo, trovati: ${r.attivi.join(',')}`);
  // il secondo click (dieta) durante il primo cambio va scartato dal guard:
  // resta valido il primo, "scheda".
  assert.equal(r.attivi[0], 'scheda');
  assert.equal(r.mostraSchedaSlot, true);
  assert.equal(r.mostraDietaSlot, false);
  // il guard deve sempre sbloccarsi a fine operazione, altrimenti il PT
  // resterebbe bloccato e non potrebbe più cambiare tab.
  assert.equal(r.cambiandoBloccato, false);
  window.close();
});

test('dopo il doppio tap, un click singolo successivo funziona di nuovo normalmente', async () => {
  const { window } = await loadApp();
  const cliente = {
    id: 'cli-1', nome: 'Cliente Uno', email: 'uno@test.it',
    dati: { logs: [], measurements: [], programs: [{ id:'p1', name:'Scheda Base', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days: [{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo: {}, diet: {} }], activeProgramId: 'p1' }
  };
  const r = await run(window, `
    utenteOnline = { id: 'pt-1' };
    _rapporti = [{ id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:true }];
    sb = ${fakeSupabaseCliente(cliente)};
    document.getElementById('areaPT').style.display = 'block';
    await apriCliente('cli-1');

    document.querySelector('.pt-tab[data-pttab="scheda"]').click();
    document.querySelector('.pt-tab[data-pttab="dieta"]').click(); // scartato dal guard
    for(let i=0;i<20;i++){ await new Promise(res=>setTimeout(res,0)); }

    // ora, a bocce ferme, un click "pulito" sul tab Storico deve funzionare
    document.querySelector('.pt-tab[data-pttab="storico"]').click();
    for(let i=0;i<20;i++){ await new Promise(res=>setTimeout(res,0)); }

    return Array.from(document.querySelectorAll('.pt-tab.active')).map(t=>t.dataset.pttab);
  `);
  assert.deepEqual(r, ['storico']);
  window.close();
});
