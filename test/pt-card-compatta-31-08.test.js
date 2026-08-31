'use strict';
// Richiesta esplicita dell'utente (31/08/2026, ispirata a fitflow.html):
// "quello che ho io oggi si prende troppo spazio" — la card del PT attivo
// in Scheda mostrava sempre tutto (riga PT + tasto Messaggi a tutta
// larghezza + testo permessi + 2 interruttori + tasto "Termina rapporto").
// Ora resta sempre a vista solo una riga compatta (avatar + nome + badge
// "ti segue" + data + tasto tondo Messaggi); permessi e "Termina rapporto"
// sono dietro una <details> richiusa di default (stesso pattern di
// Impostazioni/Account). Nessuna funzione tolta, solo riorganizzata.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('renderMioPT (attivo): card compatta con dettagli/permessi dietro una tendina richiusa', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    window.modalitaOnline = () => true;
    utenteOnline = { id: 'io' };
    sb = {
      from(table){
        if(table === 'rapporti_pt'){
          return { select(){ return this; }, or(){ return Promise.resolve({
            data: [{ id:'r1', cliente_id:'io', pt_id:'pt-1', stato:'attivo',
              puo_scheda:true, puo_dieta:false, accettato_il:'2026-08-01T00:00:00Z' }],
            error: null }); } };
        }
        if(table === 'profili'){
          return { select(){ return this; }, eq(col, val){ return { maybeSingle(){
            return Promise.resolve({ data: { id:'pt-1', nome:'Marco Rossi', dati:{} }, error:null }); } }; } };
        }
        return { select(){ return this; }, eq(){ return this; }, or(){ return Promise.resolve({data:[],error:null}); } };
      }
    };
    await renderMioPT();
    const box = document.getElementById('statoMioPT');
    const details = box.querySelector('details.pt-dettagli-details');
    return {
      haRigaCompatta: !!box.querySelector('.pt-riga-compatta'),
      nomeVisibile: box.querySelector('.pt-riga-compatta .nome').textContent.includes('Marco Rossi'),
      haBadge: !!box.querySelector('.pt-riga-compatta .pt-badge'),
      haTastoMessaggi: !!box.querySelector('#apriMessaggiClienteBtn.icon-btn-round'),
      haDetails: !!details,
      detailsChiusaDiDefault: details ? !details.open : false,
      permSchedaDentroDetails: !!(details && details.querySelector('#permScheda')),
      permDietaDentroDetails: !!(details && details.querySelector('#permDieta')),
      terminaDentroDetails: !!(details && details.querySelector('#chiudiRapportoBtn')),
      permSchedaChecked: details.querySelector('#permScheda').checked,
      permDietaChecked: details.querySelector('#permDieta').checked
    };
  `);
  assert.equal(r.haRigaCompatta, true, 'deve esserci la riga compatta avatar+nome+messaggi');
  assert.equal(r.nomeVisibile, true);
  assert.equal(r.haBadge, true);
  assert.equal(r.haTastoMessaggi, true, 'il tasto Messaggi resta sempre visibile, non dietro la tendina');
  assert.equal(r.haDetails, true, 'permessi e "Termina rapporto" devono stare dentro una <details>');
  assert.equal(r.detailsChiusaDiDefault, true, 'la tendina deve essere richiusa di default (non occupare spazio)');
  assert.equal(r.permSchedaDentroDetails, true);
  assert.equal(r.permDietaDentroDetails, true);
  assert.equal(r.terminaDentroDetails, true);
  assert.equal(r.permSchedaChecked, true);
  assert.equal(r.permDietaChecked, false);
  window.close();
});

test('renderMioPT (attivo): gli interruttori dei permessi restano funzionanti dentro la tendina', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    window.modalitaOnline = () => true;
    utenteOnline = { id: 'io' };
    let ultimoPatch = null;
    sb = {
      from(table){
        if(table === 'rapporti_pt'){
          return {
            select(){ return this; },
            or(){ return Promise.resolve({
              data: [{ id:'r1', cliente_id:'io', pt_id:'pt-1', stato:'attivo',
                puo_scheda:true, puo_dieta:false, accettato_il:'2026-08-01T00:00:00Z' }],
              error: null }); },
            update(patch){ ultimoPatch = patch; return { eq(){ return Promise.resolve({error:null}); } }; }
          };
        }
        if(table === 'profili'){
          return { select(){ return this; }, eq(col, val){ return { maybeSingle(){
            return Promise.resolve({ data: { id:'pt-1', nome:'Marco Rossi', dati:{} }, error:null }); } }; } };
        }
        return { select(){ return this; }, eq(){ return this; }, or(){ return Promise.resolve({data:[],error:null}); } };
      }
    };
    await renderMioPT();
    document.getElementById('permDieta').checked = true;
    document.getElementById('permDieta').dispatchEvent(new window.Event('change', { bubbles:true }));
    await new Promise(res => setTimeout(res, 0));
    return { ultimoPatch };
  `);
  assert.deepEqual(r.ultimoPatch, { puo_dieta: true }, 'il cambio di un permesso deve ancora chiamare update() come prima');
  window.close();
});
