'use strict';
// Feedback dell'utente su screenshot (31/08/2026): il banner di stato in
// Registra ("COME DA PROGRAMMA · Lunedì: A · ...") "sembra quasi un
// errore" perché — come già successo una volta per l'avviso "Account
// creato!" (vedi test/avviso-account-creato.test.js, 25/08/2026) — usava i
// toni dell'accent (rosso-arancio), lo stesso colore riservato agli errori
// veri in tutta l'app. Segnalato anche come troppo "attaccato" agli
// elementi sotto (mancava margin-bottom). Corretto in due punti:
//  1) #statusInfo (Registra) ora prende un tono coerente con il badge che
//     contiene: verde per "Come da programma", ambra per "Giorno diverso
//     dal previsto", neutro (grigio) per "Saltato", "Allenamento libero"
//     (tolto il tono ambra il 02/09/2026 — è una scelta normale, non un
//     avviso, vedi VIGOR-report-frizioni-02-09-2026.md punto 4) e per il
//     testo semplice prima di scegliere un giorno.
//  2) .reminder-banner ("Oggi tocca: ... non ancora registrato" in Home),
//     stesso problema, stessa famiglia di colore: passato ad ambra.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(extra){
  return Object.assign({
    id: 'io', name: 'Io', email: 'io@test.it', logs: [], measurements: [], customExercises: {}, customFoods: {},
    programs: [{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}, {key:'B', name:'Giorno B', weekday:'Martedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId: 'p1', mealLogs: []
  }, extra||{});
}

test('CSS: .info-banner di base NON usa più i toni dell\'accent (riservati agli errori)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  // .info-banner{ (esattamente, non seguito da un'altra classe come
  // .esito-positivo) è la regola di base, prima delle varianti.
  const regola = css.match(/\.info-banner\{[^}]*\}/);
  assert.ok(regola, 'la regola di base .info-banner deve esistere');
  assert.ok(!/var\(--accent(-soft)?\)/.test(regola[0]), 'il tono di base non deve più essere quello dell\'accent (letto come errore)');
  assert.match(regola[0], /margin[^;]*:[^;]*\d+px 0 \d+px|margin-bottom\s*:/, 'deve avere uno spazio sotto verso l\'elemento successivo (non più "attaccato")');
});

test('CSS: .info-banner.esito-attenzione esiste e usa i toni ambra (--warn), non l\'accent', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const regola = css.match(/\.info-banner\.esito-attenzione\{[^}]*\}/);
  assert.ok(regola, 'deve esistere una variante "attenzione" del banner');
  assert.match(regola[0], /var\(--warn\)|rgba\(177,\s*121,\s*10/, 'deve richiamare l\'ambra di avviso, non il rosso');
});

test('CSS: .reminder-banner ("Oggi tocca...") non usa più i toni dell\'accent', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const regola = css.match(/\.reminder-banner\{[^}]*\}/);
  assert.ok(regola, 'la regola .reminder-banner deve esistere');
  assert.ok(!/var\(--accent\)/.test(regola[0]), 'un promemoria non è un errore: non deve più usare il colore accent');
});

test('Registra: "Come da programma" mostra il banner in tono positivo (verde)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptAllenamento').click();
    // Data fissa (un lunedì) invece di "oggi": altrimenti il giorno previsto
    // dipende da che giorno della settimana è quando gira il test (bug trovato
    // in revisione — vedi il commento nel test successivo).
    document.getElementById('logDate').value = '2026-01-05';
    renderDayChoices();
  `);
  // 2026-01-05 è un lunedì: previsto Giorno A, selezionato in automatico
  const banner = document.getElementById('statusInfo');
  assert.ok(banner.classList.contains('esito-positivo'), 'il giorno previsto dal programma deve avere il tono positivo, non quello neutro/di errore');
  window.close();
});

test('Registra: scegliendo un giorno diverso da quello previsto, il banner passa al tono di attenzione (ambra), non a quello dell\'accent', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptAllenamento').click();
    // Stessa data fissa del test precedente (un lunedì, previsto Giorno A):
    // scegliendo 'B' qui sotto è SEMPRE diverso da quello previsto, a
    // prescindere da che giorno della settimana gira davvero il test.
    // Bug trovato in revisione: prima questo test usava "oggi" (via
    // renderDayChoices() senza logDate fissato), quindi falliva ogni volta
    // che "oggi" cadeva di martedì (il giorno di Giorno B) — il test
    // scambiava per un bug dell'app quello che era solo un suo stesso difetto.
    document.getElementById('logDate').value = '2026-01-05';
    renderDayChoices();
    selectDay('B');
  `);
  const banner = document.getElementById('statusInfo');
  assert.ok(banner.classList.contains('esito-attenzione'), 'un giorno diverso da quello previsto deve avere il tono di attenzione');
  assert.ok(!banner.classList.contains('esito-positivo'));
  window.close();
});

test('Registra: "Saltato" mostra il banner in tono neutro (né positivo né di attenzione)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptAllenamento').click();
    renderDayChoices();
    selectDay('SKIP');
  `);
  const banner = document.getElementById('statusInfo');
  assert.ok(!banner.classList.contains('esito-positivo'));
  assert.ok(!banner.classList.contains('esito-attenzione'));
  assert.ok(banner.classList.contains('info-banner'));
  window.close();
});

// 02/09/2026: il tono ambra per "Allenamento libero" è stato tolto — vedi
// VIGOR-report-frizioni-02-09-2026.md punto 4. Scegliere "Allenamento
// libero" dal menu "Cosa vuoi registrare?" è una scelta normale, non un
// motivo di attenzione: il banner ora resta .info-banner neutro (di base,
// nessun modificatore), come già per "Saltato".
test('Allenamento libero: il banner resta neutro (non ambra), è una scelta normale non un avviso', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptLibero').click();
  `);
  const banner = document.getElementById('statusInfo');
  assert.ok(!banner.classList.contains('esito-attenzione'), 'non deve più avere il tono ambra');
  assert.ok(!banner.classList.contains('esito-positivo'));
  assert.ok(banner.classList.contains('info-banner'));
  window.close();
});
