'use strict';
// Task 2a (roadmap, PIANO PRIMA confermato 07/09/2026): le foto di check-in
// non finiscono più in base64 dentro profili.dati (riempivano localStorage e
// la riga Supabase, ~1MB l'una). Ora si caricano sul bucket privato
// "checkin-foto" (path <profilo_id>/<checkin_id>.jpg) e il check-in tiene
// solo il path (fotoPath), mai la foto vera. Se l'upload fallisce (o non
// c'è connessione/Supabase) il check-in si salva comunque, senza foto, e
// compare l'avviso persistente condiviso con js/core/stato.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(overrides){
  return Object.assign({
    id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], checkins:[],
    customExercises:{}, customFoods:{}, mealLogs:[], waterLogs:[],
    programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[], dietInfo:{}, diet:{} }],
    activeProgramId:'p1'
  }, overrides||{});
}

// window.modalitaOnline() è sempre true nei test (impostato da FINTO_LOGIN in
// loadApp.js): appena sb è un oggetto "vero" (non null), il submit del
// check-in chiama anche inviaOnline() (account.js/profili) e renderMioPT()
// chiama caricaRapporti() (rapporti_pt) — vanno quindi finti anche quelli,
// non solo sb.storage, altrimenti va in errore un pezzo di codice che qui
// non stiamo nemmeno testando (stesso approccio di fakeSupabaseMioPT in
// checkin-cliente.test.js).
function fakeSbStorage(esitoUpload){
  return `{
    storage: {
      _uploadChiamate: [],
      from(bucket){
        const self = this;
        return {
          upload(path, blob, opts){
            self._uploadChiamate.push({ bucket, path, opts });
            return Promise.resolve(${JSON.stringify(esitoUpload)});
          }
        };
      }
    },
    from(table){
      if(table === 'rapporti_pt'){
        return { select(){ return this; }, or(){ return Promise.resolve({ data:[], error:null }); } };
      }
      return { update(){ return { eq(){ return Promise.resolve({ error:null }); } }; } };
    }
  }`;
}

async function compilaEInvia(window, { conFoto } = {}){
  await run(window, `
    apriCheckinCompilazione();
    ${conFoto ? `
      _checkinFotoDataUrl = 'data:image/jpeg;base64,AAAA';
      window.fetch = async () => ({ blob: async () => new Blob(['finta-foto'], { type:'image/jpeg' }) });
    ` : ''}
    document.getElementById('checkinPeso').value = '77';
    document.getElementById('checkinNota').value = 'Nota di prova';
    document.getElementById('checkinInviaBtn').click();
    await new Promise(r => setTimeout(r, 0)); // lascia risolvere l'upload (async) prima di leggere il risultato
  `);
}

test('check-in con foto: upload riuscito → fotoPath salvato, niente avviso, niente più base64 nel record', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    sb = ${fakeSbStorage({ error: null })};
  `);
  await compilaEInvia(window, { conFoto: true });
  const r = await run(window, `return { checkins: activeProfile().checkins, uploadChiamate: sb.storage._uploadChiamate };`);
  assert.equal(r.checkins.length, 1);
  assert.equal(r.checkins[0].fotoPath, `io/${r.checkins[0].id}.jpg`);
  assert.equal(r.checkins[0].fotoUrl, undefined, 'niente base64 nel record salvato');
  assert.equal(r.uploadChiamate.length, 1);
  assert.equal(r.uploadChiamate[0].bucket, 'checkin-foto');
  assert.equal(r.uploadChiamate[0].path, `io/${r.checkins[0].id}.jpg`);
  assert.equal(document.querySelector('.avviso-persistente'), null, 'upload riuscito: nessun avviso');
  window.close();
});

test('check-in con foto: upload fallito → il check-in si salva comunque (senza foto) e compare l\'avviso persistente', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    sb = ${fakeSbStorage({ error: { message: 'network error' } })};
  `);
  await compilaEInvia(window, { conFoto: true });
  const r = await run(window, `return { checkins: activeProfile().checkins };`);
  assert.equal(r.checkins.length, 1, 'il check-in si salva comunque');
  assert.equal(r.checkins[0].peso, 77);
  assert.equal(r.checkins[0].nota, 'Nota di prova');
  assert.equal(r.checkins[0].fotoPath, null, 'senza foto: l\'upload è fallito');
  const avviso = document.querySelector('.avviso-persistente');
  assert.ok(avviso, 'deve comparire l\'avviso persistente');
  assert.match(avviso.textContent, /non è stata salvata/);
  window.close();
});

test('check-in con foto ma senza Supabase configurato (offline/locale): salva il resto e avvisa', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    sb = null;
  `);
  await compilaEInvia(window, { conFoto: true });
  const r = await run(window, `return { checkins: activeProfile().checkins };`);
  assert.equal(r.checkins.length, 1);
  assert.equal(r.checkins[0].fotoPath, null);
  assert.ok(document.querySelector('.avviso-persistente'));
  window.close();
});

test('check-in senza nessuna foto: nessun upload tentato, nessun avviso', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    sb = ${fakeSbStorage({ error: null })};
  `);
  await compilaEInvia(window, { conFoto: false });
  const r = await run(window, `return { checkins: activeProfile().checkins, uploadChiamate: sb.storage._uploadChiamate };`);
  assert.equal(r.checkins.length, 1);
  assert.equal(r.checkins[0].fotoPath, null);
  assert.equal(r.uploadChiamate.length, 0);
  assert.equal(document.querySelector('.avviso-persistente'), null);
  window.close();
});
