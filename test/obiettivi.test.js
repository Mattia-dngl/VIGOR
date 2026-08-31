'use strict';
// Test degli "obiettivi" in Home: prima l'unico traguardo era quello
// settimanale automatico. Ora ce ne sono altri tre, come deciso insieme:
//  1) costanza mensile: automatica, come quella settimanale ma su tutto il mese
//  2) peso con scadenza: la persona imposta un peso target e una data, il
//     progresso si calcola dall'ultima misurazione già presente in Storico
//  3) record su un esercizio: la persona sceglie un esercizio e un target,
//     il progresso riusa recordPersonale() (stesso numero mostrato altrove)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function programmaConGiorno(nomeEsercizio, weekday){
  return {
    id:'p1',
    days:[{ key:'A', name:'Petto', weekday, exercises:[{ name:nomeEsercizio, sets:1, reps:'5', muscles:['Petto'] }] }]
  };
}

test('obiettivoMensile: conta solo i giorni previsti dalla scheda in tutto il mese, fatti e totali', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    // finto "oggi" fisso dentro il mese, per non dipendere dalla data reale:
    // conto a mano quanti Lunedì cadono in questo calendario invece di mockare Date
    const oggi = new Date();
    const giorniNelMese = new Date(oggi.getFullYear(), oggi.getMonth()+1, 0).getDate();
    let lunediAttesi = 0;
    for(let g=1; g<=giorniNelMese; g++){
      const d = new Date(oggi.getFullYear(), oggi.getMonth(), g);
      if(WEEKDAYS[d.getDay()] === 'Lunedì') lunediAttesi++;
    }
    const programma = ${JSON.stringify(programmaConGiorno('Panca Piana', 'Lunedì'))};
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    const risultato = obiettivoMensile(profilo, programma);
    return { risultato, lunediAttesi };
  `);
  assert.equal(r.risultato.totali, r.lunediAttesi, 'i "totali" devono contare tutti i lunedì del mese, non solo quelli passati');
  assert.equal(r.risultato.fatti, 0, 'nessun log presente: zero allenamenti fatti');
  window.close();
});

test('obiettivoMensile: senza scheda attiva torna 0/0 invece di andare in errore', async () => {
  const { window } = await loadApp();
  const r = await run(window, `return obiettivoMensile({logs:[]}, null);`);
  assert.deepEqual(r, {fatti:0, totali:0});
  window.close();
});

test('progressoObiettivoPeso: calcola la percentuale e i giorni rimasti verso il target', async () => {
  const { window } = await loadApp();
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  const scadenza = new Date(oggi); scadenza.setDate(scadenza.getDate() + 30);
  const scadenzaIso = scadenza.toISOString().slice(0,10);
  const r = await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', logs:[], customExercises:{}, customFoods:{},
      measurements:[{ date:'2026-08-01', weight: 90 }],
      obiettivoPeso: { target: 80, scadenza: '${scadenzaIso}', partenza: 90 }
    };
    return progressoObiettivoPeso(profilo);
  `);
  assert.equal(r.attuale, 90);
  assert.equal(r.percento, 0, "appena impostato, con l'ultima pesata uguale alla partenza, il progresso è 0%");
  assert.equal(r.raggiunto, false);
  assert.ok(r.giorniRimasti >= 29 && r.giorniRimasti <= 30);
  window.close();
});

test('progressoObiettivoPeso: a metà strada tra partenza e target segna 50%, e "raggiunto" quando lo supera', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const base = { id:'io', name:'Io', email:'io@test.it', logs:[], customExercises:{}, customFoods:{},
      obiettivoPeso: { target: 80, scadenza: '2099-01-01', partenza: 90 } };
    const metaStrada = Object.assign({}, base, { measurements:[{ date:'2026-08-10', weight: 85 }] });
    const raggiunto = Object.assign({}, base, { measurements:[{ date:'2026-08-20', weight: 78 }] });
    return { meta: progressoObiettivoPeso(metaStrada), fine: progressoObiettivoPeso(raggiunto) };
  `);
  assert.equal(r.meta.percento, 50);
  assert.equal(r.meta.raggiunto, false);
  assert.equal(r.fine.raggiunto, true, 'sceso sotto il target (obiettivo di dimagrimento): raggiunto');
  window.close();
});

test('progressoObiettivoRecord: percentuale verso il target e "raggiunto" quando lo eguaglia o supera', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
      logs:[{ id:'l1', date:'2026-01-01', exercises:[{ name:'Panca Piana', sets:[{reps:'5', kg:'80'}] }] }], // epley 93.33 -> arrotondato a 93 (31/08/2026: recordPersonale ora arrotonda all'intero, non più al decimale)
      obiettivoRecord: { esercizio:'Panca Piana', target: 100 }
    };
    return progressoObiettivoRecord(profilo);
  `);
  assert.equal(r.attuale, 93);
  assert.equal(r.percento, 93);
  assert.equal(r.raggiunto, false);
  window.close();
});

test('Home: senza obiettivi impostati si vedono solo gli accordion "+ Imposta", non le righe di avanzamento', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{},
      programs:[{id:'p1', days:[]}], activeProgramId:'p1' };
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
  `);
  assert.equal(document.getElementById('homeObPesoRiga').style.display, 'none');
  assert.equal(document.getElementById('homeObRecordRiga').style.display, 'none');
  assert.equal(document.getElementById('homeObPesoSummary').textContent, '+ Imposta un obiettivo di peso');
  assert.equal(document.getElementById('homeObRecordSummary').textContent, '+ Imposta un obiettivo su un esercizio');
  window.close();
});

test('Home: salvare un obiettivo di peso dal modulo lo mostra subito nella card e lo persiste sul profilo', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[{date:'2026-08-01', weight:88}],
      customExercises:{}, customFoods:{}, programs:[{id:'p1', days:[]}], activeProgramId:'p1' };
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('obPesoTarget').value = '82';
    document.getElementById('obPesoScadenza').value = '2099-01-01';
    document.getElementById('obPesoSalvaBtn').click();
  `);
  const prof = await run(window, `return activeProfile().obiettivoPeso;`);
  assert.deepEqual(prof, { target: 82, scadenza: '2099-01-01', partenza: 88 });
  assert.equal(document.getElementById('homeObPesoRiga').style.display, 'flex');
  assert.match(document.getElementById('homeObPesoSub').textContent, /88.*82 kg/);
  window.close();
});

test('Home: rimuovere un obiettivo di peso lo cancella dal profilo e nasconde di nuovo la riga', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{},
      programs:[{id:'p1', days:[]}], activeProgramId:'p1',
      obiettivoPeso: { target: 80, scadenza:'2099-01-01', partenza: 90 } };
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('obPesoRimuoviBtn').click();
  `);
  const prof = await run(window, `return activeProfile().obiettivoPeso;`);
  assert.equal(prof, null);
  assert.equal(document.getElementById('homeObPesoRiga').style.display, 'none');
  window.close();
});

test('Home: salvare un obiettivo su un esercizio lo mostra nella card con la percentuale corretta', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
      logs:[{ id:'l1', date:'2026-01-01', exercises:[{ name:'Squat', sets:[{reps:'5', kg:'100'}] }] }], // epley 116.67 -> arrotondato a 117
      programs:[{id:'p1', days:[]}], activeProgramId:'p1'
    };
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('obRecordEsercizio').value = 'Squat';
    document.getElementById('obRecordTarget').value = '150';
    document.getElementById('obRecordSalvaBtn').click();
  `);
  const ob = await run(window, `return activeProfile().obiettivoRecord;`);
  assert.deepEqual(ob, { esercizio:'Squat', target: 150 });
  assert.equal(document.getElementById('homeObRecordRiga').style.display, 'flex');
  assert.equal(document.getElementById('homeObRecordNome').textContent, 'Squat');
  assert.match(document.getElementById('homeObRecordSub').textContent, /117 kg.*150 kg/);
  window.close();
});
