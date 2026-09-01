'use strict';
// Feedback del 25/08/2026: testando il blocco di un account, l'utente si è
// trovato davanti a un "caricamento infinito". Causa trovata: dopoAccessoOnline()
// non aveva NESSUNA gestione degli errori sulla prima chiamata di rete (la
// select del proprio profilo). Se quella chiamata falliva o restava appesa
// (rete lenta, hiccup del server...), il messaggio d'errore veniva sì scritto
// nel DOM, ma sotto al form di login — che nel frattempo non era la vista
// visibile (si era ancora sulla schermata "Connessione…" mostrata all'avvio):
// risultato, l'indicatore "carico i dati…" restava a pulsare per sempre,
// senza nessun modo di uscirne.
// Ora dopoAccessoOnline() ha: (1) un timeout di sicurezza sulla chiamata di
// rete, (2) un try/catch che avvolge tutto il corpo della funzione e in caso
// di errore riporta SEMPRE alla schermata di login (dove l'errore è visibile)
// invece di lasciare la persona bloccata sulla vista precedente.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('dopoAccessoOnline: se la select del profilo fallisce, si torna al login con un errore visibile (non resta su "carico i dati…")', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    utenteOnline = { id: 'u1', email: 'test@test.it' };
    // parto dalla schermata "Connessione…" mostrata all'avvio, esattamente
    // come dopo il ricaricamento automatico di un account appena bloccato
    mostraCloudGate('caricamento');
    sb = {
      from(){
        return { select(){ return this; },
          eq(){ return { maybeSingle(){ return Promise.resolve({ data:null, error:{ message:'Errore di rete simulato' } }); } }; } };
      }
    };
    await dopoAccessoOnline();
  `);
  assert.equal(document.getElementById('cloudCaricamento').style.display, 'none',
    'non deve restare sulla schermata "Connessione…"');
  assert.equal(document.getElementById('cloudAccedi').style.display, 'block',
    'deve tornare al login, dove l\'errore è visibile');
  assert.equal(document.getElementById('cloudErr').style.display, 'block');
  assert.match(document.getElementById('cloudErr').textContent, /Errore di rete simulato/);
  const pill = document.getElementById('cloudStato');
  assert.ok(!pill.classList.contains('sincronizzo'),
    'l\'indicatore non deve restare bloccato in stato "sincronizzo" (l\'animazione che pulsa all\'infinito)');
  window.close();
});

test('dopoAccessoOnline: se la chiamata di rete non risponde affatto, dopo il timeout si torna comunque al login (non resta appeso per sempre)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    utenteOnline = { id: 'u1', email: 'test@test.it' };
    mostraCloudGate('caricamento');
    sb = {
      from(){
        return { select(){ return this; },
          eq(){ return { maybeSingle(){ return new Promise(()=>{}); } }; } }; // non si risolve mai
      }
    };
  `);
  // dopoAccessoOnline() ha un timeout di sicurezza di 15s: uso i timer reali di
  // jsdom (pretendToBeVisual) e aspetto oltre quella soglia.
  const promessa = run(window, `return dopoAccessoOnline();`);
  await new Promise(res => setTimeout(res, 15600));
  await promessa;
  assert.equal(document.getElementById('cloudAccedi').style.display, 'block',
    'anche senza risposta, dopo il timeout deve tornare al login');
  assert.match(document.getElementById('cloudErr').textContent, /Tempo scaduto/);
  window.close();
}, 20000);

// Stesso identico problema del 25/08/2026, ma un passo prima: dopoAccessoOnline()
// sa già chi è l'utente quando parte (gli arriva già pronto), ma per saperlo
// avvioOnline() deve prima aspettare sb.auth.getSession() — e QUELLA chiamata
// non aveva nessun timeout. Scoperto il 01/09/2026 testando di nuovo il blocco
// di un account, stavolta tornando da un accesso con Google (redirect a pagina
// intera): getSession() può restare appesa (es. un lucchetto tra schede del
// browser rimasto bloccato) lasciando la persona sulla schermata "Connessione…"
// mostrata all'avvio, senza mai arrivare a dopoAccessoOnline() — quindi anche
// senza mai vedere né la schermata di blocco né alcun errore.
test('avvioOnline: se sb.auth.getSession() non risponde affatto, dopo il timeout si torna al login (non resta su "Connessione…" per sempre)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    iniziaSupabase = function(){
      sb = { auth: { getSession(){ return new Promise(()=>{}); } } }; // non si risolve mai
      return true;
    };
  `);
  const promessa = run(window, `return avvioOnline();`);
  await new Promise(res => setTimeout(res, 15600));
  await promessa;
  assert.equal(document.getElementById('cloudCaricamento').style.display, 'none',
    'non deve restare sulla schermata "Connessione…"');
  assert.equal(document.getElementById('cloudAccedi').style.display, 'block',
    'deve tornare al login, dove l\'errore è visibile');
  assert.equal(document.getElementById('cloudErr').style.display, 'block');
  assert.match(document.getElementById('cloudErr').textContent, /Tempo scaduto/);
  window.close();
}, 20000);

test('avvioOnline: con una sessione valida, continua verso dopoAccessoOnline() come prima', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    iniziaSupabase = function(){
      sb = {
        auth: { getSession(){ return Promise.resolve({ data:{ session:{ user:{ id:'u1', email:'ok@test.it' } } } }); } },
        from(table){
          if(table === 'profili'){
            return { select(){ return this; },
              eq(){ return { maybeSingle(){ return Promise.resolve({
                data: { id:'u1', email:'ok@test.it', approvato:true, bloccato:false, nome:'Ok',
                  dati: Object.assign(newProfile('Ok','ok@test.it','x',true), {measurements:[]}) },
                error:null
              }); } }; } };
          }
          if(table === 'rapporti_pt'){
            return { select(){ return this; }, or(){ return Promise.resolve({ data:[], error:null }); } };
          }
          return { select(){return this;}, eq(){return this;} };
        },
        channel(){ return { on(){ return this; }, subscribe(){ return this; } }; },
        removeChannel(){}
      };
      return true;
    };
    await avvioOnline();
  `);
  assert.equal(document.getElementById('cloudGate').style.display, 'none', 'con una sessione valida il gate deve chiudersi');
  window.close();
});

test('dopoAccessoOnline: un login online normale (senza errori) continua a funzionare come prima', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    utenteOnline = { id: 'u1', email: 'ok@test.it' };
    sb = {
      from(table){
        if(table === 'profili'){
          return { select(){ return this; },
            eq(){ return { maybeSingle(){ return Promise.resolve({
              data: { id:'u1', email:'ok@test.it', approvato:true, bloccato:false, nome:'Ok',
                dati: Object.assign(newProfile('Ok','ok@test.it','x',true), {measurements:[]}) },
              error:null
            }); } }; } };
        }
        if(table === 'rapporti_pt'){
          return { select(){ return this; }, or(){ return Promise.resolve({ data:[], error:null }); } };
        }
        return { select(){return this;}, eq(){return this;} };
      },
      channel(){ return { on(){ return this; }, subscribe(){ return this; } }; },
      removeChannel(){}
    };
    await dopoAccessoOnline();
  `);
  assert.equal(document.getElementById('cloudGate').style.display, 'none', 'con un login riuscito il gate deve chiudersi');
  window.close();
});
