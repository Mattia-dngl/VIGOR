'use strict';
// Task 4b (roadmap, PIANO PRIMA confermato 07/09/2026): il PT che ha
// "Modifica scheda"/"Modifica dieta" aperta lavora su una fotografia
// (_clienteBuffer) presa quando ha aperto l'editor. Prima di questo fix,
// salvaModifichePT() riscriveva quella fotografia intera: se il cliente
// registrava un allenamento o un check-in nel frattempo (mentre il PT ha
// ancora l'editor aperto), il salvataggio del PT lo cancellava.
//
// Ora salvaModifichePT() scrive in modo condizionato (aggiornato_il deve
// essere ancora quello letto all'apertura); se non lo è più, rilegge i
// dati freschi e ci riapplica sopra SOLO programs/activeProgramId (dove
// vivono scheda e dieta) — mai logs/measurements/checkins, che restano
// quelli freschi del cliente.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

// Finto Supabase con uno STATO VERO condiviso (righeServer), così il test
// può simulare "il cliente salva nel frattempo" scrivendoci sopra da fuori,
// esattamente come farebbe una scrittura concorrente reale.
function fakeSupabaseConStatoVero(){
  return `{
    _righeServer: {},
    from(table){
      const self = this;
      if(table === 'profili'){
        return {
          select(){ return this; },
          eq(col, val){
            return {
              maybeSingle(){ return Promise.resolve({ data: self._righeServer[val] || null, error:null }); }
            };
          },
          update(patch){
            return {
              _filtri: {},
              eq(col, val){ this._filtri[col] = val; return this; },
              select(){
                const id = this._filtri.id;
                const riga = self._righeServer[id];
                if(!riga) return Promise.resolve({ data:[], error:null });
                if(this._filtri.aggiornato_il !== undefined && riga.aggiornato_il !== this._filtri.aggiornato_il){
                  return Promise.resolve({ data:[], error:null }); // condizione non soddisfatta: 0 righe, come PostgREST
                }
                Object.assign(riga, patch);
                return Promise.resolve({ data:[{id}], error:null });
              }
            };
          }
        };
      }
      return { select(){return this;}, eq(){return this;}, or(){return Promise.resolve({data:[],error:null});} };
    }
  }`;
}

function clienteConScheda(){
  return {
    id:'cli-1', nome:'Cliente Uno', email:'uno@test.it',
    dati: {
      logs:[], measurements:[], checkins:[], mealLogs:[], customExercises:{}, customFoods:{},
      programs:[{ id:'p1', name:'Scheda Base', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
        durataSettimane:null, dataInizio:null, notePT:null,
        days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
      activeProgramId:'p1'
    },
    aggiornato_il: '2026-09-07T10:00:00.000Z'
  };
}

test('il cliente registra un allenamento MENTRE il PT ha la scheda aperta: il salvataggio del PT non lo cancella', async () => {
  const { window } = await loadApp();
  const cliente = clienteConScheda();
  await run(window, `
    utenteOnline = { id:'pt-1' };
    _rapporti = [{ id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:true }];
    sb = ${fakeSupabaseConStatoVero()};
    sb._righeServer['cli-1'] = ${JSON.stringify(cliente)};
    document.getElementById('areaPT').style.display = 'block';
    await apriCliente('cli-1');
    document.querySelector('.pt-tab[data-pttab="scheda"]').click();
    await new Promise(r => setTimeout(r, 0));
    // 08/09/2026: la scheda si apre in "Vedi" (come dal lato cliente) — serve
    // il tap sulla matita per entrare davvero nell'editor e popolare il buffer.
    document.getElementById('ptSchedaEditBtn').click();
    await new Promise(r => setTimeout(r, 0));
  `);

  // Il PT modifica il nome della scheda (nel buffer, non ancora salvato).
  await run(window, `
    _clienteBuffer.programs[0].name = 'Scheda aggiornata dal PT';
  `);

  // "Il cliente" registra un allenamento nel frattempo: scrittura diretta
  // sul finto server, con aggiornato_il nuovo — esattamente come farebbe
  // save()/inviaOnline() dal suo telefono mentre il PT ha ancora l'editor aperto.
  await run(window, `
    const rigaVera = sb._righeServer['cli-1'];
    rigaVera.dati.logs.push({ id:'log-nuovo', date:'2026-09-07', status:'registrato', exercises:[] });
    rigaVera.dati.checkins.push({ id:'chk-nuovo', data:'2026-09-07', peso:80 });
    rigaVera.aggiornato_il = '2026-09-07T10:05:00.000Z';
  `);

  // Il PT chiude l'editor: salvaModifichePT() parte, trova la condizione
  // scaduta, rilegge e riapplica sopra solo scheda/dieta.
  await run(window, `
    document.querySelector('.pt-tab[data-pttab="riepilogo"]').click();
    await new Promise(r => setTimeout(r, 0));
  `);

  const r = await run(window, `return sb._righeServer['cli-1'].dati;`);
  assert.equal(r.programs[0].name, 'Scheda aggiornata dal PT', 'la modifica del PT non deve andare persa');
  assert.equal(r.logs.length, 1, 'l\'allenamento registrato dal cliente nel frattempo non deve sparire');
  assert.equal(r.logs[0].id, 'log-nuovo');
  assert.equal(r.checkins.length, 1, 'anche il check-in del cliente deve restare');
  assert.equal(r.checkins[0].id, 'chk-nuovo');
  window.close();
});

test('nessuna modifica concorrente: il salvataggio del PT resta un giro solo, comportamento invariato', async () => {
  const { window } = await loadApp();
  const cliente = clienteConScheda();
  await run(window, `
    utenteOnline = { id:'pt-1' };
    _rapporti = [{ id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:true }];
    sb = ${fakeSupabaseConStatoVero()};
    sb._righeServer['cli-1'] = ${JSON.stringify(cliente)};
    document.getElementById('areaPT').style.display = 'block';
    await apriCliente('cli-1');
    document.querySelector('.pt-tab[data-pttab="scheda"]').click();
    await new Promise(r => setTimeout(r, 0));
    document.getElementById('ptSchedaEditBtn').click();
    await new Promise(r => setTimeout(r, 0));
    _clienteBuffer.programs[0].name = 'Scheda aggiornata dal PT';
    document.querySelector('.pt-tab[data-pttab="riepilogo"]').click();
    await new Promise(r => setTimeout(r, 0));
  `);
  const r = await run(window, `return sb._righeServer['cli-1'].dati.programs[0].name;`);
  assert.equal(r, 'Scheda aggiornata dal PT');
  window.close();
});
