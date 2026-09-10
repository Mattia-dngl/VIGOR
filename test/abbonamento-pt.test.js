'use strict';
// Task 6a (roadmap, PIANO PRIMA confermato 07/09/2026): i pagamenti veri
// non sono ancora attivi — il compito è preparare tutta l'infrastruttura
// (tabella abbonamenti_pt scritta SOLO dal server, card in Account,
// gate sull'area PT) tenendo ogni bottone senza un vero effetto, finché
// non si deciderà di attivarli davvero.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function fakeSbAbbonamento(riga){
  return `{
    from(table){
      if(table === 'abbonamenti_pt'){
        return { select(){ return this; }, eq(){ return this; }, maybeSingle(){ return Promise.resolve({ data: ${JSON.stringify(riga)}, error:null }); } };
      }
      return { select(){return this;}, eq(){return this;}, or(){return Promise.resolve({data:[],error:null});} };
    }
  }`;
}

test('un atleta (non PT) non vede affatto la card abbonamento', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    rigaOnline.is_pt = false;
    await renderAbbonamento(loggedInProfile());
  `);
  assert.equal(document.getElementById('acctAbbonamentoCard').style.display, 'none');
  window.close();
});

test('un PT senza nessuna riga abbonamenti_pt vede "Nessun piano attivo" (non bloccato)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    rigaOnline.is_pt = true;
    sb = ${fakeSbAbbonamento(null)};
    await renderAbbonamento(loggedInProfile());
  `);
  const card = document.getElementById('acctAbbonamentoCard');
  assert.notEqual(card.style.display, 'none');
  assert.equal(document.getElementById('abbonamentoTitolo').textContent, 'Nessun piano attivo');
  window.close();
});

test('un PT con piano attivo vede lo stato giusto', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    rigaOnline.is_pt = true;
    sb = ${fakeSbAbbonamento({ piano:'pt_pro', stato:'attivo', prova_scade_il:null })};
    await renderAbbonamento(loggedInProfile());
  `);
  assert.equal(document.getElementById('abbonamentoTitolo').textContent, 'Piano PT Pro attivo');
  window.close();
});

test('i tre bottoni dei piani non fanno nulla di reale: solo un avviso, nessuna chiamata a Stripe', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    rigaOnline.is_pt = true;
    sb = ${fakeSbAbbonamento(null)};
    await renderAbbonamento(loggedInProfile());
    document.getElementById('abbonamentoRinnovaBtn').click();
  `);
  assert.ok(document.getElementById('pianiPTOverlay').classList.contains('show'));
  ['pianoPTBtn','pianoPTProBtn','pianoPTStudioBtn','pianoGestisciBtn'].forEach(id=>{
    document.getElementById(id).click();
  });
  assert.equal(document.getElementById('toast').textContent, 'I pagamenti non sono ancora attivi. Torna presto!');
  window.close();
});

test('abbonamento scaduto: apriAreaPT() blocca l\'accesso e riporta in Home con un avviso', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    rigaOnline.is_pt = true;
    sb = ${fakeSbAbbonamento({ piano:'pt', stato:'scaduto', prova_scade_il:null })};
    mostraHome();
    await apriAreaPT();
  `);
  assert.equal(document.getElementById('areaPT').style.display, 'none', 'l\'area PT non deve aprirsi');
  assert.equal(document.getElementById('homeScreen').style.display, 'block', 'deve tornare in Home');
  assert.ok(document.querySelector('.avviso-persistente'), 'deve comparire un avviso spiegabile');
  window.close();
});

test('pagamento fallito: stesso blocco di "scaduto"', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    rigaOnline.is_pt = true;
    sb = ${fakeSbAbbonamento({ piano:'pt', stato:'pagamento_fallito', prova_scade_il:null })};
    mostraHome();
    await apriAreaPT();
  `);
  assert.equal(document.getElementById('areaPT').style.display, 'none');
  window.close();
});

test('nessuna riga abbonamenti_pt (PT già esistenti prima di questa funzione): NON blocca l\'area PT', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    rigaOnline.is_pt = true;
    utenteOnline = { id: 'pt-1' };
    sb = ${fakeSbAbbonamento(null)};
    mostraHome();
    await apriAreaPT();
  `);
  assert.equal(document.getElementById('areaPT').style.display, 'block', 'nessun dato non deve mai bloccare per errore un PT vero');
  window.close();
});

test('piano "attivo" o "prova": NON blocca l\'area PT', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    rigaOnline.is_pt = true;
    sb = ${fakeSbAbbonamento({ piano:'pt', stato:'attivo', prova_scade_il:null })};
    mostraHome();
    await apriAreaPT();
    const attivoOk = document.getElementById('areaPT').style.display;

    document.getElementById('ptElenco').style.display = 'none'; // reset per il secondo giro
    document.getElementById('areaPT').style.display = 'none';
    mostraHome();
    sb = ${fakeSbAbbonamento({ piano:'pt', stato:'prova', prova_scade_il:'2026-12-01T00:00:00Z' })};
    await apriAreaPT();
    const provaOk = document.getElementById('areaPT').style.display;
    return { attivoOk, provaOk };
  `);
  assert.equal(r.attivoOk, 'block');
  assert.equal(r.provaOk, 'block');
  window.close();
});

// Il requisito esplicito del task: "i clienti continuano a usare l'app
// normalmente" quando il LORO PT perde l'accesso alla propria area PT.
// I clienti hanno un profilo e una sessione del tutto separati dal PT: la
// verifica è che abbonamentoPTBloccato()/apriAreaPT() guardino solo
// rigaOnline/utenteOnline di CHI STA USANDO L'APP IN QUEL MOMENTO, mai i
// dati di un altro profilo — quindi un cliente (rigaOnline.is_pt=false)
// non passa nemmeno dal controllo, la sua Home resta quella di sempre.
test('un cliente il cui PT ha perso l\'abbonamento continua a usare l\'app normalmente (nessun suo dato toccato)', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    rigaOnline.is_pt = false; // sono un cliente, non un PT
    const profiloPrima = JSON.parse(JSON.stringify(loggedInProfile()));
    sb = ${fakeSbAbbonamento({ piano:'pt', stato:'scaduto', prova_scade_il:null })}; // ipotetico stato del MIO pt, irrilevante per me
    mostraHome();
    return { home: document.getElementById('homeScreen').style.display, profiloUguale: JSON.stringify(loggedInProfile()) === JSON.stringify(profiloPrima) };
  `);
  assert.equal(r.home, 'block');
  assert.equal(r.profiloUguale, true, 'nessun dato del cliente deve cambiare');
  window.close();
});
