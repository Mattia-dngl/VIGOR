#!/usr/bin/env node
'use strict';
// ============================================================
// MIGRAZIONE — copia i check-in periodici già esistenti (dentro
// profili.dati.checkins, JSONB) nella tabella "checkin_periodico".
// Task 4a della roadmap VIGOR, secondo pezzo.
//
// Stesso schema di scripts/migra-misure.js e scripts/migra-foto-checkin.js:
// solo moduli nativi di Node, service role key (mai nel repo/in chat).
// Nessun ordine obbligato con scripts/migra-foto-checkin.js: un check-in
// con solo il vecchio fotoUrl (base64, non ancora migrato) finisce con
// foto_path=null nella tabella — si aggiorna da sola rilanciando questo
// script dopo aver migrato anche le foto.
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-checkin.js
//   SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-checkin.js --dry-run
//
// Ripetibile: upsert su id (lo stesso id generato dal client con uid()),
// non duplica chi è già migrato. Non tocca né cancella mai dati.checkins.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oyllkwjcfszehugqdxlb.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const PAGINA = 200;

if(!SERVICE_KEY){
  console.error('Manca SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API → service_role).');
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-checkin.js [--dry-run]');
  process.exit(1);
}

function headersServizio(extra){
  return Object.assign({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, extra || {});
}

async function leggiProfiliPagina(offset){
  const url = `${SUPABASE_URL}/rest/v1/profili?select=id,dati&order=id&limit=${PAGINA}&offset=${offset}`;
  const res = await fetch(url, { headers: headersServizio() });
  if(!res.ok) throw new Error(`Lettura profili fallita (${res.status}): ${await res.text()}`);
  return res.json();
}

async function upsertCheckin(righe){
  if(righe.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/checkin_periodico?on_conflict=id`, {
    method: 'POST',
    headers: headersServizio({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(righe)
  });
  if(!res.ok) throw new Error(`Upsert check-in fallito (${res.status}): ${await res.text()}`);
}

async function main(){
  console.log(DRY_RUN ? 'Modalità dry-run: nessuna scrittura, solo un riepilogo di cosa verrebbe fatto.' : 'Avvio migrazione check-in...');
  let profiliVisti = 0, checkinMigrati = 0, profiliFalliti = [];
  let offset = 0;
  while(true){
    const pagina = await leggiProfiliPagina(offset);
    if(pagina.length === 0) break;
    for(const riga of pagina){
      profiliVisti++;
      const checkins = ((riga.dati || {}).checkins || []).filter(c => c && c.id && c.data);
      if(checkins.length === 0) continue;
      const righeTabella = checkins.map(c => ({
        id: c.id, profilo_id: riga.id, data: c.data,
        peso: c.peso != null ? c.peso : null,
        sensazione: c.sensazione != null ? c.sensazione : null,
        nota: c.nota || null,
        foto_path: c.fotoPath || null
      }));
      if(DRY_RUN){
        console.log(`[dry-run] migrerei ${righeTabella.length} check-in per il profilo ${riga.id}`);
        checkinMigrati += righeTabella.length;
        continue;
      }
      try{
        await upsertCheckin(righeTabella);
        checkinMigrati += righeTabella.length;
      }catch(e){
        profiliFalliti.push({ profilo: riga.id, motivo: e.message });
      }
    }
    offset += PAGINA;
  }

  console.log('\n--- Riepilogo ---');
  console.log(`Profili controllati: ${profiliVisti}`);
  console.log(`Check-in migrati: ${checkinMigrati}`);
  console.log(`Profili falliti (da riprovare): ${profiliFalliti.length}`);
  profiliFalliti.forEach(f => console.log(`  - profilo ${f.profilo}: ${f.motivo}`));
  if(profiliFalliti.length) console.log('\nRilancia lo stesso comando per riprovare: l\'upsert non duplica chi è già migrato.');
}

main().catch(e => { console.error('Errore imprevisto:', e); process.exit(1); });
