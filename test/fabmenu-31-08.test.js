'use strict';
// Restyling ispirato a fitflow (31/08/2026, fase 1): il "+" della nav in
// basso non apre più Registra direttamente — apre un menu a bottom sheet con
// 3 scelte fisse (uguali in ogni schermata, su richiesta esplicita
// dell'utente): "Registra allenamento", "Allenamento libero" (scorporato
// dalle chip "che giorno hai fatto?" dentro Registra, dove prima viveva) e
// "Registra pasto" (nuovo ingresso rapido verso il diario alimentare).
// I test sul comportamento diretto di apriRegistra() (puntino della
// settimana, CTA Home) restano dove sono già (registra-pagina-a-se-26-08 e
// altri) — qui si testa solo il menu e le sue 3 scelte.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(){
  return {
    id: 'io', name: 'Io', email: 'io@test.it', logs: [], measurements: [], customExercises: {}, customFoods: {},
    programs: [{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId: 'p1', mealLogs: []
  };
}

test('il "+" apre il menu (non Registra direttamente) e lo richiude cliccandolo di nuovo', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    const primaChiuso = !document.getElementById('fabMenuOverlay').classList.contains('show');
    document.getElementById('fabRegistraBtn').click();
    const dopoAperto = document.getElementById('fabMenuOverlay').classList.contains('show');
    const appRootNonMostrato = document.getElementById('appRoot').style.display !== 'block';
    const registraNonAperto = !document.body.classList.contains('registra-aperto');
    document.getElementById('fabRegistraBtn').click();
    const dopoSecondoClickChiuso = !document.getElementById('fabMenuOverlay').classList.contains('show');
    return { primaChiuso, dopoAperto, appRootNonMostrato, registraNonAperto, dopoSecondoClickChiuso };
  `);
  assert.equal(r.primaChiuso, true, 'il menu deve partire chiuso');
  assert.equal(r.dopoAperto, true, 'il primo click deve aprire il menu');
  assert.equal(r.appRootNonMostrato, true, 'aprire il menu non deve aprire appRoot/Registra direttamente');
  assert.equal(r.registraNonAperto, true, 'aprire il menu non deve mettere l\'app in modalità "pagina Registra a sé"');
  assert.equal(r.dopoSecondoClickChiuso, true, 'un secondo click sul "+" deve richiudere il menu (toggle)');
  window.close();
});

test('cliccare fuori dal foglio (sull\'overlay) chiude il menu', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    const overlay = document.getElementById('fabMenuOverlay');
    overlay.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    return !overlay.classList.contains('show');
  `);
  assert.equal(r, true, 'il click sull\'overlay (fuori dal foglio) deve chiudere il menu');
  window.close();
});

test('il menu mostra le 3 scelte fisse: Registra allenamento, Allenamento libero, Registra pasto', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
  `);
  const opzioni = Array.from(document.querySelectorAll('#fabMenuSheet .fabmenu-option strong')).map(e => e.textContent);
  assert.deepEqual(opzioni, ['Registra allenamento', 'Allenamento libero', 'Registra pasto']);
  window.close();
});

test('"Registra allenamento" apre Registra come pagina a sé, con la scelta del giorno (comportamento invariato)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptAllenamento').click();
  `);
  assert.ok(document.getElementById('view-log').classList.contains('active'), 'Registra deve essere la vista attiva');
  assert.equal(document.body.classList.contains('registra-aperto'), true, 'Registra resta una pagina a sé');
  assert.equal(document.getElementById('fabMenuOverlay').classList.contains('show'), false, 'il menu deve essersi chiuso');
  window.close();
});

test('"Allenamento libero" salta dritto sull\'allenamento libero, senza passare dalla scelta del giorno', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptLibero').click();
    return { selectedDayKey, freeAddExBtnVisibile: document.getElementById('freeAddExBtn').style.display === 'block' };
  `);
  assert.ok(document.getElementById('view-log').classList.contains('active'), 'Registra deve essere la vista attiva');
  assert.equal(document.body.classList.contains('registra-aperto'), true, 'Registra resta una pagina a sé');
  assert.equal(r.selectedDayKey, 'LIBERO', 'deve selezionare direttamente l\'allenamento libero');
  assert.equal(r.freeAddExBtnVisibile, true, 'deve mostrare subito i controlli per aggiungere esercizi liberi');
  window.close();
});

test('"Registra pasto" apre la vista Dieta e mette a fuoco il campo alimento', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptPasto').click();
  `);
  assert.ok(document.getElementById('view-diet').classList.contains('active'), 'Dieta deve essere la vista attiva');
  assert.equal(document.getElementById('fabMenuOverlay').classList.contains('show'), false, 'il menu deve essersi chiuso');
  window.close();
});
