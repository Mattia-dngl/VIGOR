'use strict';
// Test della riorganizzazione di "Gestione dell'app" (Account, solo admin):
// prima era un unico accordion con liste tutte srotolate insieme (richieste,
// PT, profili attivi) — su telefono ci si perdeva. Ora ogni gruppo è un
// accordion annidato chiuso di default, "Richieste in attesa" si apre da sola
// solo quando c'è qualcosa da approvare, e "Profili attivi" ha un filtro di
// ricerca e le azioni per riga in griglia invece che in fila che va a capo.
//
// 03/09/2026: rimossa la modalità locale — l'admin lavora sempre online
// (renderAmministrazioneOnline(), Supabase). Questi test simulano un `sb`
// minimo invece di popolare state.profiles direttamente.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function rigaAdmin(extra){
  return Object.assign({ id:'admin', nome:'Mattia', email: 'dangelomattia2002@gmail.com', approvato:true, is_pt:false, dati:{logs:[]} }, extra||{});
}

// sb finto per renderAmministrazioneOnline(): select().order() legge da
// window.__righeAdmin, così un test può cambiarle fra un render e l'altro
// (es. dopo aver "approvato" qualcuno) senza dover ricreare tutto lo stub.
function installaAdminFinto(righeIniziali){
  return `
    window.__righeAdmin = ${JSON.stringify(righeIniziali)};
    utenteOnline = { id:'admin', email:'dangelomattia2002@gmail.com' };
    sb = {
      from(table){
        return {
          select(){ return this; },
          order(){ return Promise.resolve({ data: window.__righeAdmin, error:null }); },
          update(valori){ return { eq(col, id){
            const r = window.__righeAdmin.find(x=>x.id===id);
            if(r) Object.assign(r, valori);
            return Promise.resolve({error:null});
          } }; }
        };
      }
    };
  `;
}

test('struttura: le sezioni di "Gestione dell\'app" sono accordion annidati distinti', async () => {
  const { window, document } = await loadApp();
  const ids = ['subRichieste', 'subProfili', 'subPT'];
  for(const id of ids){
    const el = document.getElementById(id);
    assert.ok(el, `manca #${id}`);
    assert.equal(el.tagName, 'DETAILS', `#${id} deve essere un <details> (accordion), non un ${el.tagName}`);
  }
  window.close();
});

test('online: la sezione "Personal Trainer" è sempre visibile (il ruolo PT esiste solo online, ed è l\'unica modalità rimasta)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${installaAdminFinto([rigaAdmin()])}
    await renderAmministrazioneOnline();
    return { ptVisibile: document.getElementById('subPT').style.display !== 'none' };
  `);
  assert.equal(r.ptVisibile, true);
  window.close();
});

test('"Richieste in attesa" si apre da sola solo quando c\'è qualcosa da approvare, e conta correttamente', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${installaAdminFinto([rigaAdmin(), { id:'p1', nome:'Chi aspetta', email:'aspetta@test.it', approvato:false, dati:{logs:[]} }])}
    await renderAmministrazioneOnline();
    const apertoConRichiesta = document.getElementById('subRichieste').open;
    const badge = document.getElementById('contaAttesa').textContent;

    // approvo l'unica richiesta: ora non ce ne sono più
    window.__righeAdmin.find(p=>p.id==='p1').approvato = true;
    await renderAmministrazioneOnline();
    return { apertoConRichiesta, badge, apertoSenzaRichieste: document.getElementById('subRichieste').open };
  `);
  assert.equal(r.apertoConRichiesta, true, 'con una richiesta in sospeso la sezione deve aprirsi da sola');
  assert.equal(r.badge, '(1)');
  assert.equal(r.apertoSenzaRichieste, false, 'senza richieste in sospeso non deve restare/riaprirsi da sola');
  window.close();
});

test('"Richieste in attesa" chiusa a mano dall\'admin non si riapre da sola al render successivo', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${installaAdminFinto([rigaAdmin(), { id:'p1', nome:'Chi aspetta', email:'aspetta@test.it', approvato:false, dati:{logs:[]} }])}
    await renderAmministrazioneOnline(); // si apre da sola (c'è una richiesta)
    const sub = document.getElementById('subRichieste');
    sub.open = false; // l'admin la chiude a mano
    sub.dispatchEvent(new window.Event('toggle'));
    await renderAmministrazioneOnline(); // un secondo render (es. dopo un'altra azione)
    return { restaChiusa: sub.open === false };
  `);
  assert.equal(r.restaChiusa, true, 'non deve tornare ad aprirsi da sola dopo che l\'admin l\'ha chiusa');
  window.close();
});

test('"Profili attivi": il conteggio nel titolo e il filtro di ricerca funzionano', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${installaAdminFinto([
      rigaAdmin(),
      { id:'p1', nome:'Mario Rossi', email:'mario@test.it', approvato:true, dati:{logs:[]} },
      { id:'p2', nome:'Luca Bianchi', email:'luca@test.it', approvato:true, dati:{logs:[]} }
    ])}
    await renderAmministrazioneOnline();
    const badge = document.getElementById('contaProfili').textContent;

    const filtro = document.getElementById('filtroProfiliAmm');
    filtro.value = 'mario';
    filtro.dispatchEvent(new window.Event('input'));
    const righe = [...document.querySelectorAll('#elencoProfiliAmm .riga-profilo')].map(r=>({
      nome: r.querySelector('.nome').textContent, visibile: r.style.display !== 'none'
    }));
    return { badge, righe };
  `);
  assert.equal(r.badge, '(3)', 'conta anche l\'admin stesso, che è un profilo approvato');
  const mario = r.righe.find(x=>x.nome.includes('Mario'));
  const luca = r.righe.find(x=>x.nome.includes('Luca'));
  assert.equal(mario.visibile, true, 'la riga che corrisponde al filtro resta visibile');
  assert.equal(luca.visibile, false, 'le righe che non corrispondono al filtro vengono nascoste');
  window.close();
});

test('CSS: le azioni per riga profilo sono in griglia compatta, non una fila che va a capo bottone per bottone', () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const regola = css.match(/\.riga-profilo \.azioni\{[^}]*\}/);
  assert.ok(regola, 'la regola .riga-profilo .azioni non è stata trovata in css/style.css');
  assert.match(regola[0], /display:\s*grid/, 'le azioni devono essere disposte in griglia, non in una fila che va a capo');
});
