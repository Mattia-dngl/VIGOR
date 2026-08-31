// ============================================================
// DATI MOCK — simula le risposte che, a integrazione avvenuta,
// arriveranno da Supabase (tabelle "palestre" e "iscrizioni",
// vedi punto 2 della specifica).
//
// INTEGRAZIONE FUTURA: questo è l'UNICO file che andrà riscritto
// per collegare il prototipo ai dati veri. Le funzioni esposte in
// fondo (MP.dati.*) sono il "contratto": chi le chiama (le
// schermate) non deve cambiare, cambia solo cosa c'è dentro le
// funzioni stesse (query Supabase invece di array in memoria).
//   profiloCorrente()      -> riga corrente da "profili" (già esiste oggi)
//   elencoIscrizioni()     -> select * from iscrizioni where profilo_id = ...
//   palestreDisponibili()  -> select * from palestre
//   richiediPerCodice()    -> insert in iscrizioni con stato = in_attesa
//   richiediIscrizione()   -> insert in iscrizioni con stato = in_attesa
// ============================================================
window.MP = window.MP || {};

MP.dati = (function () {

  const PROFILO_CORRENTE = {
    id: 'p1',
    nome: "Mattia D'Angelo",
    email: 'dangelomattia2002@gmail.com'
  };

  const PALESTRE_DISPONIBILI = [
    { id: 'g1', nome: 'Fitness Forum', indirizzo: 'Via Roma 15', codice: 'FFR-4821', iniziali: 'FF' },
    { id: 'g2', nome: 'Alpha Gym', indirizzo: 'Centro Città', codice: 'ALP-1190', iniziali: 'AG' },
    { id: 'g3', nome: 'Elite Performance', indirizzo: 'Corso Italia 22', codice: 'ELT-7734', iniziali: 'EP' },
    { id: 'g4', nome: 'Iron Temple', indirizzo: 'Via dei Mille 8', codice: 'IRT-2266', iniziali: 'IT' },
    { id: 'g5', nome: 'Vertex Club', indirizzo: 'Piazza Garibaldi 3', codice: 'VTX-5502', iniziali: 'VC' }
  ];

  function palestra(id) {
    return PALESTRE_DISPONIBILI.find(p => p.id === id);
  }

  // Scenari di prova selezionabili dal pannello di test (vedi js/main.js).
  // In produzione questa funzione non esisterà: ci sarà una sola realtà,
  // letta dal database.
  const SCENARI = {
    molte: () => ([
      riga('i1', 'g1', 'iscritto', 'attiva', '2026-02-10'),
      riga('i2', 'g2', 'personal_trainer', 'attiva', '2026-04-02'),
      riga('i3', 'g3', 'iscritto', 'attiva', '2026-06-18')
    ]),
    una: () => ([
      riga('i1', 'g1', 'iscritto', 'attiva', '2026-02-10')
    ]),
    nessuna: () => ([]),
    attesa: () => ([
      riga('i1', 'g1', 'iscritto', 'attiva', '2026-02-10'),
      riga('i4', 'g4', 'iscritto', 'in_attesa', null)
    ])
  };

  function riga(id, palestraId, ruolo, stato, approvataIl) {
    return {
      id,
      profilo_id: PROFILO_CORRENTE.id,
      palestra: palestra(palestraId),
      ruolo,
      stato, // in_attesa | attiva | rimossa
      richiesta_il: approvataIl || new Date().toISOString(),
      approvata_il: approvataIl
    };
  }

  let iscrizioni = SCENARI.molte();
  let contatoreId = 100;

  function elencoIscrizioni() {
    return iscrizioni.slice();
  }

  function iscrizioniAttive() {
    return iscrizioni.filter(i => i.stato === 'attiva');
  }

  function iscrizioniInAttesa() {
    return iscrizioni.filter(i => i.stato === 'in_attesa');
  }

  function palestreDisponibili() {
    return PALESTRE_DISPONIBILI.slice();
  }

  function giaRichiesta(palestraId) {
    return iscrizioni.some(i => i.palestra.id === palestraId && i.stato !== 'rimossa');
  }

  function profiloCorrente() {
    return PROFILO_CORRENTE;
  }

  // Crea una richiesta di iscrizione partendo da una palestra scelta
  // dall'elenco. Stato sempre in_attesa: nessuna accettazione automatica
  // (punto 3 della specifica).
  function richiediIscrizione(palestraId) {
    if (giaRichiesta(palestraId)) return { ok: false, motivo: 'gia_richiesta' };
    contatoreId++;
    iscrizioni.push(riga('i' + contatoreId, palestraId, 'iscritto', 'in_attesa', null));
    return { ok: true };
  }

  // Crea una richiesta partendo da un codice inserito a mano.
  function richiediPerCodice(codice) {
    const trovata = PALESTRE_DISPONIBILI.find(
      p => p.codice.toLowerCase() === String(codice || '').trim().toLowerCase()
    );
    if (!trovata) return { ok: false, motivo: 'codice_non_valido' };
    return richiediIscrizione(trovata.id);
  }

  function impostaScenario(nome) {
    if (!SCENARI[nome]) return;
    iscrizioni = SCENARI[nome]();
  }

  return {
    profiloCorrente,
    elencoIscrizioni,
    iscrizioniAttive,
    iscrizioniInAttesa,
    palestreDisponibili,
    richiediIscrizione,
    richiediPerCodice,
    impostaScenario,
    scenariDisponibili: Object.keys(SCENARI)
  };
})();
