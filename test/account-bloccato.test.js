'use strict';
// Chiesto dopo aver visto un mockup: "cosa succede se clicco su blocca a
// qualcuno, cosa vede?" Prima: un profilo bloccato ("Blocca"/"Sospendi" nel
// pannello admin) finiva a vedere la STESSA schermata generica "In attesa di
// approvazione" usata per chi si è appena registrato — fuorviante, sembra un
// nuovo account in attesa del primo ok, non un accesso tolto. Ora esiste un
// campo dedicato `bloccato` (distinto da `approvato`, che da solo non basta
// a distinguere "mai ancora approvato" da "bloccato dopo essere stato
// attivo") e una schermata dedicata (mostraAccountBloccatoOverlay), riusata
// in tutti e tre i punti dove un profilo bloccato può incontrare il blocco:
// login online, ingresso a un profilo locale, e blocco in tempo reale
// mentre si è già dentro l'app.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloAdmin(extra){
  return Object.assign({ id:'admin', name:'Mattia', email:'dangelomattia2002@gmail.com', approvato:true, logs:[] }, extra||{});
}

test('mostraAccountBloccatoOverlay/nascondiAccountBloccatoOverlay: mostrano e nascondono la schermata, col pulsante solo se richiesto', async () => {
  const { window, document } = await loadApp();
  await run(window, `mostraAccountBloccatoOverlay();`);
  let overlay = document.getElementById('accountBloccatoOverlay');
  assert.ok(overlay.classList.contains('show'));
  assert.equal(document.getElementById('accountBloccatoAzione').style.display, 'none',
    'senza opzioni, blocco "duro": nessun pulsante');

  await run(window, `nascondiAccountBloccatoOverlay();`);
  assert.ok(!overlay.classList.contains('show'));

  const r = await run(window, `
    let chiamato = false;
    mostraAccountBloccatoOverlay({ testoAzione:'Esci', suAzione: ()=>{ chiamato = true; } });
    const azione = document.getElementById('accountBloccatoAzione');
    const testoPrima = azione.textContent;
    const visibilePrima = azione.style.display;
    azione.click();
    return { testoPrima, visibilePrima, chiamato,
      ancoraVisibile: document.getElementById('accountBloccatoOverlay').classList.contains('show') };
  `);
  assert.equal(r.testoPrima, 'Esci');
  assert.equal(r.visibilePrima, 'inline-block');
  assert.equal(r.chiamato, true, 'cliccando il pulsante deve scattare la callback passata');
  assert.equal(r.ancoraVisibile, false, 'e la schermata si deve richiudere da sola');
  window.close();
});

test('login online: profilo bloccato (approvato:false, bloccato:true) mostra la schermata dedicata con "Esci", non "In attesa di approvazione"', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    utenteOnline = { id: 'u1', email: 'bloccato@test.it' };
    sb = {
      from(table){
        if(table === 'profili'){
          return { select(){ return this; },
            eq(col, val){ return { maybeSingle(){ return Promise.resolve({
              data: { id:'u1', email:'bloccato@test.it', approvato:false, bloccato:true }, error:null
            }); } }; } };
        }
        return { select(){return this;}, eq(){return this;} };
      },
      auth: { signOut(){ return Promise.resolve({error:null}); } },
      removeChannel(){}
    };
    await dopoAccessoOnline();
  `);
  assert.ok(document.getElementById('accountBloccatoOverlay').classList.contains('show'));
  assert.equal(document.getElementById('cloudAttesa').style.display, 'none',
    'non deve comparire la schermata "in attesa" pensata per chi non è mai stato approvato');
  const azione = document.getElementById('accountBloccatoAzione');
  assert.equal(azione.style.display, 'inline-block');
  assert.match(azione.textContent, /Esci/);
  window.close();
});

test('login online: profilo MAI approvato (approvato:false, bloccato:false) mostra ancora "In attesa di approvazione" come prima', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    utenteOnline = { id: 'u2', email: 'nuovo@test.it' };
    sb = {
      from(table){
        return { select(){ return this; },
          eq(col, val){ return { maybeSingle(){ return Promise.resolve({
            data: { id:'u2', email:'nuovo@test.it', approvato:false, bloccato:false }, error:null
          }); } }; } };
      }
    };
    await dopoAccessoOnline();
  `);
  assert.equal(document.getElementById('cloudAttesa').style.display, 'block');
  assert.ok(!document.getElementById('accountBloccatoOverlay').classList.contains('show'));
  window.close();
});

test('blocco in tempo reale mentre si è già dentro l\'app: compare la schermata, blocco "duro" senza pulsante', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    rigaOnline = { id:'u1', email:'attivo@test.it', approvato:true, bloccato:false };
    gestisciMioProfiloAggiornato({ id:'u1', email:'attivo@test.it', approvato:false, bloccato:true });
  `);
  assert.ok(document.getElementById('accountBloccatoOverlay').classList.contains('show'));
  assert.equal(document.getElementById('accountBloccatoAzione').style.display, 'none',
    'mentre si è già dentro l\'app il blocco è "duro": niente pulsante, il ricaricamento arriva da solo');
  window.close();
});

test('sbloccato mentre la schermata di blocco è ancora aperta sulla stessa scheda: si richiude da sola', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    rigaOnline = { id:'u1', email:'attivo@test.it', approvato:false, bloccato:true };
    mostraAccountBloccatoOverlay();
    gestisciMioProfiloAggiornato({ id:'u1', email:'attivo@test.it', approvato:true, bloccato:false });
  `);
  assert.ok(!document.getElementById('accountBloccatoOverlay').classList.contains('show'));
  window.close();
});

test('newProfile/migrazione: bloccato parte sempre a false (mai undefined)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const nuovo = newProfile('Test', 't@test.it', '1234', true);
    const vecchio = { id:'v1', name:'Vecchio', email:'v@test.it', approvato:true, passwordHash:'x' };
    // simulo la migrazione di load() su un profilo salvato prima che bloccato esistesse
    if(vecchio.bloccato === undefined) vecchio.bloccato = false;
    return { nuovoBloccato: nuovo.bloccato, vecchioBloccato: vecchio.bloccato };
  `);
  assert.equal(r.nuovoBloccato, false);
  assert.equal(r.vecchioBloccato, false);
  window.close();
});
