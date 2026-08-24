'use strict';
// Regressione: il crash sulla dieta. La schermata "Dieta" (sia quella del
// cliente, renderDietPlanView, sia quella del PT sul cliente,
// renderDettaglioPT('dieta')) leggeva `diet[giorno]` assumendo che `diet`
// fosse sempre l'oggetto {Lunedì:{...}, ...}. Un piano salvato nel vecchio
// formato (dieta come testo libero, o proprio assente) mandava in crash la
// schermata invece di mostrare un fallback. La difesa è il controllo
// `!dieta || typeof dieta === 'string'` prima di indicizzare per giorno
// (index.html: renderDietPlanView e renderDettaglioPT sezione 'dieta').
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

const FORME_DIETA_LEGACY = [
  { nome: 'testo libero (vecchio formato)', valore: 'Colazione: latte e fette biscottate. Pranzo: pasta.' },
  { nome: 'stringa vuota', valore: '' },
  { nome: 'assente/null', valore: null },
  { nome: 'oggetto con solo alcuni giorni', valore: { Lunedì: { libera:false, colazione:'Uova', pranzo:'', spuntino:'', cena:'' } } },
];

test('renderDietPlanView (vista del cliente) non va in crash con un piano in formato legacy', async () => {
  const { window } = await loadApp();
  for(const forma of FORME_DIETA_LEGACY){
    const r = await run(window, `
      const profilo = {
        id:'io', name:'Io', email:'io@test.it', approvato:true, sesso:'uomo',
        programs:[{ id:'p1', name:'Scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
          days:[], dietInfo:{}, diet: ${JSON.stringify(forma.valore)} }],
        activeProgramId:'p1', logs:[], measurements:[], mealLogs:[], customExercises:{}, customFoods:{}
      };
      state.profiles = [profilo];
      activeProfileId = 'io';
      try{
        renderDietPlanView();
        return { ok:true, html: document.getElementById('dietView').innerHTML };
      }catch(e){
        return { ok:false, errore: e.message };
      }
    `);
    assert.equal(r.ok, true, `renderDietPlanView è andata in crash con "${forma.nome}": ${r.errore}`);
    assert.equal(typeof r.html, 'string');
  }
  window.close();
});

test("renderDettaglioPT('dieta') (vista del PT sul cliente) non va in crash con un piano in formato legacy", async () => {
  const { window } = await loadApp();
  for(const forma of FORME_DIETA_LEGACY){
    const r = await run(window, `
      utenteOnline = { id:'pt-1' };
      _clienteAperto = {
        riga: { id:'cli-1', nome:'Cliente Uno', email:'uno@test.it', dati: {
          logs:[], measurements:[],
          programs:[{ id:'p1', name:'Scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
            days:[], dietInfo:{}, diet: ${JSON.stringify(forma.valore)} }],
          activeProgramId:'p1'
        }},
        rapporto: { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', puo_scheda:false, puo_dieta:false }
      };
      try{
        renderDettaglioPT('dieta');
        return { ok:true, html: document.getElementById('ptDettaglioCorpo').innerHTML };
      }catch(e){
        return { ok:false, errore: e.message };
      }
    `);
    assert.equal(r.ok, true, `renderDettaglioPT('dieta') è andata in crash con "${forma.nome}": ${r.errore}`);
    assert.equal(typeof r.html, 'string');
  }
  window.close();
});
