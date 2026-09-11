'use strict';
// 10/09/2026 — due difetti trovati riproducendo la sequenza reale segnalata
// dall'utente (accesso con un secondo account, poi rientro con il proprio):
//
// 1) ACCESSO IMPOSSIBILE per un profilo senza schede. Una correzione
//    precedente faceva tornare `null` ad activeProgram() quando programs era
//    vuoto, ma l'app dà per scontato che una scheda ci sia sempre
//    (tabs-header.js:296 fa `p.name` sul risultato): il primo renderHeader()
//    dopo il login moriva con "Cannot read properties of null (reading
//    'name')", l'eccezione veniva catturata da dopoAccessoOnline() e mostrata
//    come il generico "Qualcosa non ha funzionato. Riprova tra poco." — cioè
//    l'accesso sembrava semplicemente non funzionare. Ora normalizzaProfilo()
//    ripristina l'invariante dando una scheda vuota di riserva.
//
// 2) ONBOARDING SOVRAPPOSTO. controllaOnboarding() sapeva solo MOSTRARE la
//    schermata di primo accesso, mai nasconderla. Uscendo da un account ed
//    entrando in un altro senza ricaricare la pagina (è quello che fa "Esci"),
//    l'onboarding aperto per il profilo incompleto restava sopra la sessione
//    successiva: chi rientrava con un account che quei dati li aveva già
//    impostati da tempo se li vedeva richiedere di nuovo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function rigaProfilo(id, nome, sesso){
  return {
    id, email: id + '@test.it', nome, approvato: true, bloccato: false, is_pt: false,
    dati: {
      id, name: nome, email: id + '@test.it', createdAt: '2026-08-11',
      approvato: true, bloccato: false, sesso,
      programs: [], activeProgramId: null, logs: [], measurements: [], mealLogs: [],
      waterLogs: [], checkins: [], customExercises: {}, customFoods: {}, avatarUrl: null
    }
  };
}

function fintoSb(riga){
  return `
    sb = {
      auth: { getSession(){ return Promise.resolve({ data:{ session:{ user:{ id:'${riga.id}', email:'${riga.email}' } } } }); },
              signOut(){ return Promise.resolve({}); } },
      from(table){
        if(table === 'profili'){
          return { select(){ return this; }, eq(){ return { maybeSingle(){
            return Promise.resolve({ data: ${JSON.stringify(riga)}, error:null }); } }; } };
        }
        if(table === 'rapporti_pt'){
          return { select(){ return this; }, or(){ return Promise.resolve({ data:[], error:null }); }, eq(){ return this; } };
        }
        return { select(){ return this; }, eq(){ return this; },
                 or(){ return Promise.resolve({data:[],error:null}); },
                 update(){ return { eq(){ return Promise.resolve({data:null,error:null}); } }; } };
      },
      channel(){ return { on(){ return this; }, subscribe(){ return this; } }; },
      removeChannel(){}
    };
  `;
}

// stato pulito: loadApp fa un finto login che da solo apre già l'onboarding
const AZZERA = `
  _onboardingMostrataPer = null;
  document.getElementById('onboardingGate').style.display = 'none';
`;

test('accesso: un profilo senza nessuna scheda entra davvero nell\'app, invece di finire su "Qualcosa non ha funzionato"', async () => {
  const { window, document } = await loadApp();
  const senzaSchede = rigaProfilo('nuovo-uid', 'Nuovo', 'uomo');
  await run(window, `
    ${AZZERA}
    ${fintoSb(senzaSchede)}
    utenteOnline = { id:'nuovo-uid', email:'nuovo-uid@test.it' };
    await dopoAccessoOnline();
  `);
  assert.equal(document.getElementById('cloudGate').style.display, 'none',
    'non deve tornare alla schermata di accesso');
  assert.equal(document.getElementById('cloudErr').textContent, '',
    'nessun errore: l\'accesso deve riuscire');
  const r = await run(window, `return { schede: loggedInProfile().programs.length, schedaAttiva: !!activeProgram() };`);
  assert.equal(r.schede, 1, 'il profilo riceve la scheda vuota di riserva');
  assert.equal(r.schedaAttiva, true);
  window.close();
});

test('onboarding: la schermata di primo accesso di un profilo incompleto non resta sovrapposta all\'account successivo', async () => {
  const { window, document } = await loadApp();
  const gate = document.getElementById('onboardingGate');
  const incompleto = rigaProfilo('incompleto-uid', 'Tizio', null);   // sesso mai impostato
  const completo   = rigaProfilo('completo-uid', 'Caio', 'uomo');    // sesso impostato da tempo

  await run(window, `
    ${AZZERA}
    ${fintoSb(incompleto)}
    utenteOnline = { id:'incompleto-uid', email:'incompleto-uid@test.it' };
    await dopoAccessoOnline();
  `);
  assert.equal(gate.style.display, 'block',
    'per chi non ha mai impostato questi dati la schermata deve comparire (comportamento corretto)');

  // "Esci" non ricarica la pagina: si rientra con un altro account nella stessa sessione
  await run(window, `
    utenteOnline = null; rigaOnline = null;
    mostraCloudGate('accedi');
    ${fintoSb(completo)}
    utenteOnline = { id:'completo-uid', email:'completo-uid@test.it' };
    await dopoAccessoOnline();
  `);
  const profilo = await run(window, `const p = loggedInProfile(); return { sesso: p && p.sesso };`);
  assert.equal(profilo.sesso, 'uomo', 'precondizione: il secondo account ha già il sesso impostato');
  assert.equal(gate.style.display, 'none',
    'la schermata del profilo precedente non deve restare sopra questo account');
  window.close();
});

test('onboarding: chi la salta non se la ritrova riproposta ad ogni renderAll() (comportamento invariato)', async () => {
  const { window, document } = await loadApp();
  const gate = document.getElementById('onboardingGate');
  const incompleto = rigaProfilo('incompleto-uid', 'Tizio', null);
  await run(window, `
    ${AZZERA}
    ${fintoSb(incompleto)}
    utenteOnline = { id:'incompleto-uid', email:'incompleto-uid@test.it' };
    await dopoAccessoOnline();
  `);
  assert.equal(gate.style.display, 'block');
  await run(window, `document.getElementById('onbSalta').click(); renderAll();`);
  assert.equal(gate.style.display, 'none', 'una volta saltata resta chiusa, anche dopo un nuovo renderAll()');
  window.close();
});
