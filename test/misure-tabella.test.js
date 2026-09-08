'use strict';
// Task 4a (roadmap, PIANO PRIMA confermato 07/09/2026), primo pezzo: le
// misure hanno ora anche una tabella propria ("misurazioni"), non solo il
// blob JSONB. upsertMisurazione() (js/core/stato.js) aggiorna sempre la
// copia locale (invariato) e, quando possibile, specchia la stessa
// misurazione sulla tabella — senza mai far dipendere il salvataggio
// locale dal successo di quello online.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function fakeSbMisurazioni(){
  return `{
    _upsertChiamate: [],
    from(table){
      const self = this;
      if(table === 'misurazioni'){
        return { upsert(riga, opts){ self._upsertChiamate.push({ riga, opts }); return Promise.resolve({ error:null }); } };
      }
      return { select(){return this;}, eq(){return this;}, or(){return Promise.resolve({data:[],error:null});} };
    }
  }`;
}

test('upsertMisurazione: aggiorna sempre la copia locale (un valore per data)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const prof = { id:'io', measurements:[{date:'2026-09-01', weight:80, waist:90, extra:{}}] };
    await upsertMisurazione(prof, { date:'2026-09-01', weight:79, waist:90, extra:{} });
    await upsertMisurazione(prof, { date:'2026-09-05', weight:78.5, waist:null, extra:{} });
    return prof.measurements;
  `);
  assert.equal(r.length, 2, 'una sostituisce quella vecchia per la stessa data, l\'altra si aggiunge');
  assert.equal(r.find(m=>m.date==='2026-09-01').weight, 79);
  assert.equal(r.find(m=>m.date==='2026-09-05').weight, 78.5);
  window.close();
});

test('upsertMisurazione: se sono online e il profilo è il mio, specchia la misura sulla tabella', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    utenteOnline = { id:'io' };
    sb = ${fakeSbMisurazioni()};
    const prof = { id:'io', measurements:[] };
    await upsertMisurazione(prof, { date:'2026-09-01', weight:79, waist:90, extra:{taglia:'M'} });
    return sb._upsertChiamate;
  `);
  assert.equal(r.length, 1);
  assert.equal(r[0].riga.profilo_id, 'io');
  assert.equal(r[0].riga.data, '2026-09-01');
  assert.equal(r[0].riga.peso, 79);
  assert.equal(r[0].riga.vita, 90);
  assert.deepEqual(r[0].riga.extra, { taglia:'M' });
  assert.equal(r[0].opts.onConflict, 'profilo_id,data');
  window.close();
});

test('upsertMisurazione: senza Supabase configurato (offline/locale), niente tentativo di rete, ma la copia locale resta salvata', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const prof = { id:'io', measurements:[] };
    await upsertMisurazione(prof, { date:'2026-09-01', weight:79, waist:null, extra:{} });
    return prof.measurements;
  `);
  assert.equal(r.length, 1);
  assert.equal(r[0].weight, 79);
  window.close();
});

test('upsertMisurazione: se sto modificando il profilo di un cliente (PT), NON scrive sulla tabella misure (non è il mio profilo)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    utenteOnline = { id:'pt-1' };
    sb = ${fakeSbMisurazioni()};
    const clienteBuffer = { id:'cli-1', measurements:[] };
    await upsertMisurazione(clienteBuffer, { date:'2026-09-01', weight:79, waist:null, extra:{} });
    return { locale: clienteBuffer.measurements, chiamate: sb._upsertChiamate };
  `);
  assert.equal(r.locale.length, 1, 'la copia locale del buffer si aggiorna comunque');
  assert.equal(r.chiamate.length, 0, 'ma niente scrittura sulla tabella: non è il profilo di chi è loggato');
  window.close();
});

test('upsertMisurazione: se la scrittura sulla tabella fallisce, non lancia e la copia locale resta comunque salvata', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    utenteOnline = { id:'io' };
    sb = { from(table){ return { upsert(){ return Promise.reject(new Error('rete assente')); } }; } };
    const prof = { id:'io', measurements:[] };
    let lanciato = false;
    try{ await upsertMisurazione(prof, { date:'2026-09-01', weight:79, waist:null, extra:{} }); }catch(e){ lanciato = true; }
    return { lanciato, locale: prof.measurements };
  `);
  assert.equal(r.lanciato, false);
  assert.equal(r.locale.length, 1);
  assert.equal(r.locale[0].weight, 79);
  window.close();
});
