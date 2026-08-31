'use strict';
// Test delle due modifiche più "di interazione" di questa consegna:
//  - l'onboarding al primo accesso chiede anche la data di nascita (non più
//    l'età a mano) insieme a sesso/peso/altezza/attività;
//  - l'editor scheda salva una scadenza opzionale, leggibile poi da segnaliPT.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloVuoto(){
  return {
    id: 'io', name: 'Io', email: 'io@test.it', createdAt:'2026-01-01', approvato:true, richiestoIl:'2026-01-01',
    passwordHash:'x', sesso:null, dataNascita:null, eta:null, altezza:null,
    livelloAttivita:'moderato', obiettivoCalorico:'mantenimento',
    programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId:'p1', logs:[], measurements:[], mealLogs:[], customExercises:{}, customFoods:{}, avatarUrl:null
  };
}

test('onboarding: "Continua" salva sesso e data di nascita sul profilo', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    state.profiles = [profilo];
    activeProfileId = 'io';

    document.querySelector('#onbSesso .seg-btn[data-val="uomo"]').click();
    document.getElementById('onbDataNascita').value = '1994-05-20';
    document.getElementById('onbContinua').click();

    const p = state.profiles.find(x=>x.id==='io');
    return { sesso: p.sesso, dataNascita: p.dataNascita };
  `);
  assert.equal(r.sesso, 'uomo');
  assert.equal(r.dataNascita, '1994-05-20');
  window.close();
});

test('onboarding: senza scegliere sesso non si passa oltre (data di nascita da sola non basta)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    state.profiles = [profilo];
    activeProfileId = 'io';
    document.getElementById('onbDataNascita').value = '1994-05-20';
    document.getElementById('onbContinua').click();
    const p = state.profiles.find(x=>x.id==='io');
    return { sesso: p.sesso, dataNascita: p.dataNascita };
  `);
  assert.equal(r.sesso, null);
  assert.equal(r.dataNascita, null); // il salvataggio della data avviene solo dopo la scelta del sesso
  window.close();
});

test('onboarding: peso e altezza finiscono anche in Account e Storico → Misure, non solo nella scheda alimentare', async () => {
  // Feedback del 25/08/2026: i dati inseriti al primo accesso (peso, altezza)
  // finivano SOLO dentro prog.dietInfo (un campo testuale mostrato nella
  // scheda alimentare) — un campo che il calcolo del fabbisogno calorico
  // NON legge affatto: quello legge prof.altezza (Account) e l'ultima
  // misurazione di peso in Storico. Risultato: subito dopo l'onboarding,
  // "Fabbisogno calorico" diceva ancora "mancano altezza, peso" nonostante
  // la persona li avesse appena scritti.
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    state.profiles = [profilo];
    activeProfileId = 'io';

    document.querySelector('#onbSesso .seg-btn[data-val="donna"]').click();
    document.getElementById('onbDataNascita').value = '1994-05-20';
    document.getElementById('onbPeso').value = '62.5';
    document.getElementById('onbAltezza').value = '167';
    document.getElementById('onbAttivita').value = 'Palestra 3 volte a settimana';
    document.getElementById('onbContinua').click();

    const p = state.profiles.find(x=>x.id==='io');
    const oggi = new Date().toISOString().slice(0,10);
    const misurazioneOggi = p.measurements.find(m => m.date === oggi);
    const fabbisogno = calcolaFabbisogno(p);
    return {
      altezzaProfilo: p.altezza,
      pesoInStorico: misurazioneOggi ? misurazioneOggi.weight : null,
      dietInfoPeso: p.programs.find(x=>x.id==='p1').dietInfo.peso,
      dietInfoAltezza: p.programs.find(x=>x.id==='p1').dietInfo.altezza,
      fabbisognoMancanti: fabbisogno.mancanti,
    };
  `);
  assert.equal(r.altezzaProfilo, 167, 'l\'altezza deve finire anche nel profilo (Account)');
  assert.equal(r.pesoInStorico, 62.5, 'il peso deve finire anche come misurazione in Storico');
  assert.equal(r.dietInfoPeso, '62.5', 'resta comunque visibile nella scheda alimentare, come prima');
  assert.equal(r.dietInfoAltezza, '167');
  assert.deepEqual(r.fabbisognoMancanti, [], 'col sesso, la data di nascita, il peso e l\'altezza appena inseriti il fabbisogno calorico deve poter essere calcolato subito, senza tornare in Account');
  window.close();
});

test('onboarding: se in Storico esiste già una misurazione per oggi (es. la vita), il peso si aggiunge senza cancellarla', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    const oggi = new Date().toISOString().slice(0,10);
    profilo.measurements = [{ date: oggi, weight: null, waist: 80, extra: { "Braccio": 35 } }];
    state.profiles = [profilo];
    activeProfileId = 'io';

    document.querySelector('#onbSesso .seg-btn[data-val="uomo"]').click();
    document.getElementById('onbPeso').value = '80';
    document.getElementById('onbContinua').click();

    const p = state.profiles.find(x=>x.id==='io');
    const m = p.measurements.find(x => x.date === oggi);
    return { peso: m.weight, vita: m.waist, extra: m.extra, numeroMisurazioni: p.measurements.length };
  `);
  assert.equal(r.peso, 80);
  assert.equal(r.vita, 80, 'la vita già registrata oggi non deve sparire');
  assert.deepEqual(r.extra, { "Braccio": 35 }, 'anche le misure con etichetta già presenti per oggi restano');
  assert.equal(r.numeroMisurazioni, 1, 'si aggiorna la stessa misurazione del giorno, non se ne crea una seconda');
  window.close();
});

test('account: cambiare la data di nascita aggiorna subito l\'età mostrata (sola lettura)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    state.profiles = [profilo];
    activeProfileId = 'io';
    apriAccountPanel();
    const oggi = new Date();
    document.getElementById('setDataNascita').value = (oggi.getFullYear()-40) + '-01-01';
    document.getElementById('setDataNascita').dispatchEvent(new window.Event('change'));
    return {
      testo: document.getElementById('setEtaCalcolata').textContent,
      dataSalvata: state.profiles.find(x=>x.id==='io').dataNascita
    };
  `);
  assert.match(r.testo, /^(39|40) anni$/);
  assert.ok(r.dataSalvata.startsWith(String(new Date().getFullYear()-40)));
  window.close();
});

// 31/08/2026: la scadenza non si scrive più a mano (era un terzo campo che
// ripeteva la stessa informazione della durata in settimane, ed era anche la
// causa per cui "la barra Settimana X di Y non si vede mai" — richiedeva un
// altro campo, la data di inizio, mai impostato da chi si limitava a
// scrivere la durata) — ora si calcola da sola da durata + data di inizio
// (quest'ultima impostata in automatico alla prima attivazione/modifica).
test('scheda: la scadenza si calcola da sola dalla durata in settimane, senza doverla scrivere a mano', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    state.profiles = [profilo];
    activeProfileId = 'io';
    renderNewProgramForm();
    document.getElementById('newProgramDurata').value = '12';
    document.getElementById('updateProgramBtn').click();
    const p = state.profiles.find(x=>x.id==='io');
    return p.programs.find(x=>x.id==='p1');
  `);
  assert.equal(r.dataInizio, '2026-01-01', 'senza una data di inizio precedente, parte dalla creazione della scheda');
  const atteso = new Date('2026-01-01T00:00:00'); atteso.setDate(atteso.getDate() + 12*7);
  assert.equal(r.scadenza, atteso.toISOString().slice(0,10));
  window.close();
});

test('scheda: senza durata impostata non c\'è scadenza (nessun piano "scaduto" inventato)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    profilo.programs[0].scadenza = '2020-01-01'; // valore precedente da cancellare
    state.profiles = [profilo];
    activeProfileId = 'io';
    renderNewProgramForm();
    document.getElementById('newProgramDurata').value = '';
    document.getElementById('updateProgramBtn').click();
    const p = state.profiles.find(x=>x.id==='io');
    return p.programs.find(x=>x.id==='p1').scadenza;
  `);
  assert.equal(r, null);
  window.close();
});
