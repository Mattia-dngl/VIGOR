'use strict';
// 10/09/2026: errore reale in produzione ("null is not an object (evaluating
// 'pt.dati')" — renderMioPT@pt-collegamento.js:321), scoperto guardando
// error_logs su Supabase subito dopo un accesso con Google. leggiProfilo()
// ignora l'eventuale errore di rete/timing della select e ritorna
// semplicemente `null` quando il profilo del PT non arriva (capita, es.
// subito dopo un login, quando parte una raffica di richieste insieme).
// nomeDi(pt) è già sicuro anche con pt nullo (riga && ...), ma la card
// compatta del PT accedeva a pt.dati direttamente, senza lo stesso
// controllo — unico punto che andava in crash quando leggiProfilo()
// tornava null.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('renderMioPT (attivo): se leggiProfilo(pt_id) torna null (rete/timing), la card si mostra comunque, senza crash', async () => {
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
          // simula la select del profilo del PT che non torna nessuna riga
          // (rete, timing, o qualunque altro motivo) — data:null, come farebbe
          // davvero maybeSingle() in quel caso
          return { select(){ return this; }, eq(col, val){ return { maybeSingle(){
            return Promise.resolve({ data: null, error:null }); } }; } };
        }
        return { select(){ return this; }, eq(){ return this; }, or(){ return Promise.resolve({data:[],error:null}); } };
      }
    };
    await renderMioPT();
    const box = document.getElementById('statoMioPT');
    return {
      haRigaCompatta: !!box.querySelector('.pt-riga-compatta'),
      nomeMostrato: box.querySelector('.pt-riga-compatta .nome').textContent
    };
  `);
  assert.equal(r.haRigaCompatta, true, 'la card deve comunque comparire, invece di far crashare renderMioPT()');
  assert.match(r.nomeMostrato, /Senza nome/, 'senza un profilo PT leggibile, il nome di riserva è "Senza nome"');
});
