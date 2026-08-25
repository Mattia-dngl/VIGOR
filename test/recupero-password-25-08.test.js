'use strict';
// Bug segnalato dall'utente il 25/08/2026: cliccando "password dimenticata"
// arrivava l'email di Supabase, ma aprendo il link non succedeva niente di
// utile — si veniva loggati dentro l'app con la sessione temporanea di
// recupero, senza che la vecchia password venisse MAI sostituita.
// Causa: avvioOnline() non guardava affatto il parametro "type=recovery" né
// l'evento onAuthStateChange('PASSWORD_RECOVERY') di supabase-js.
// Corretto con: (1) iniziaSupabase() che ascolta l'evento PASSWORD_RECOVERY,
// (2) avvioOnline() che controlla anche "type=recovery" nell'hash PRIMA di
// aspettare l'evento (arriva a volte in ritardo), (3) se è un recupero non
// si passa mai da dopoAccessoOnline(): si mostra sempre il form apposito
// (#cloudRecovery) che chiede la nuova password prima di continuare.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('avvioOnline: un link di recupero password (type=recovery) apre il form della nuova password, non entra mai nell\'app', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    window.location.hash = '#access_token=abc&type=recovery';
    // in questo test simulo un progetto configurato: iniziaSupabase() normalmente
    // richiede url/chiave reali (qui vuoti apposta per restare offline negli altri
    // test), quindi la forzo a riuscire e fornisco un sb finto.
    iniziaSupabase = function(){
      sb = { auth: { onAuthStateChange(){}, getSession(){ return Promise.resolve({ data:{ session:null } }); } } };
      return true;
    };
    let entratoNellApp = false;
    dopoAccessoOnline = async function(){ entratoNellApp = true; };
    await avvioOnline();
    window.__entratoNellApp = entratoNellApp;
  `);
  assert.equal(document.getElementById('cloudGate').style.display, 'flex' , 'il cancello deve restare visibile: niente ingresso diretto');
  assert.equal(document.getElementById('cloudRecovery').style.display, 'block', 'deve comparire il form "scegli la nuova password"');
  assert.equal(document.getElementById('cloudAccedi').style.display, 'none');
  assert.equal(window.eval('window.__entratoNellApp'), false, 'non deve MAI passare da dopoAccessoOnline() con una sessione di recupero');
  window.close();
});

test('form "nuova password": rifiuta password troppo corte o che non coincidono', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    mostraCloudGate('recovery');
    document.getElementById('recoveryPw1').value = '123';
    document.getElementById('recoveryPw2').value = '123';
    document.getElementById('recoveryBtn').click();
  `);
  assert.equal(document.getElementById('recoveryErr').style.display, 'block');
  assert.match(document.getElementById('recoveryErr').textContent, /almeno 8 caratteri/);

  await run(window, `
    document.getElementById('recoveryPw1').value = 'passwordLunga1';
    document.getElementById('recoveryPw2').value = 'passwordDiversa2';
    document.getElementById('recoveryBtn').click();
  `);
  assert.match(document.getElementById('recoveryErr').textContent, /non coincidono/);
  window.close();
});

test('form "nuova password": password valida e coincidente aggiorna la password, chiude la sessione di recupero e torna al login', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    mostraCloudGate('recovery');
    _recuperoPasswordAttivo = true;
    let passwordAggiornata = null;
    let signOutChiamato = false;
    sb = {
      auth: {
        updateUser(opz){ passwordAggiornata = opz.password; return Promise.resolve({ error:null }); },
        signOut(){ signOutChiamato = true; return Promise.resolve(); }
      }
    };
    document.getElementById('recoveryPw1').value = 'nuovaPasswordSicura';
    document.getElementById('recoveryPw2').value = 'nuovaPasswordSicura';
    await document.getElementById('recoveryBtn').click();
    // il click esegue un handler async: aspetto il giro dei microtask
    await new Promise(r=>setTimeout(r, 0));
    return { passwordAggiornata, signOutChiamato, recuperoAncoraAttivo: _recuperoPasswordAttivo };
  `);
  assert.equal(r.passwordAggiornata, 'nuovaPasswordSicura');
  assert.equal(r.signOutChiamato, true, 'dopo il cambio deve chiudere la sessione di recupero (temporanea)');
  assert.equal(r.recuperoAncoraAttivo, false);
  assert.equal(document.getElementById('cloudAccedi').style.display, 'block', 'deve tornare al login normale');
  assert.match(document.getElementById('cloudErr').textContent, /aggiornata/);
  window.close();
});
