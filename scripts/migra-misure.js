#!/usr/bin/env node
'use strict';
// ============================================================
// MIGRAZIONE — copia le misure già esistenti (dentro profili.dati.measurements,
// JSONB) nella tabella "misurazioni". Task 4a della roadmap VIGOR, primo pezzo.
//
// Stesso schema di scripts/migra-foto-checkin.js: solo moduli nativi di
// Node, parla con le API REST di Supabase con la SERVICE ROLE KEY (bypassa
// le RLS, va lanciata solo da chi la possiede, mai nel repo/in chat).
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-misure.js
//   SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-misure.js --dry-run
//
// Ripetibile: usa upsert su (profilo_id, data) — rilanciarlo su misure già
// migrate non duplica nulla, aggiorna solo se il valore nel blob è diverso
// (capita raramente: il blob resta comunque scritto ad ogni save() come
// prima, upsertMisurazione() in stato.js tiene i due allineati per il
// futuro). Non tocca né cancella mai dati.measurements: resta la copia di
// riserva offline, come previsto dal disegno di questo pezzo.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oyllkwjcfszehugqdxlb.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const PAGINA = 200;

if(!SERVICE_KEY){
  console.error('Manca SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API → service_role).');
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-misure.js [--dry-run]');
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

async function upsertMisurazioni(righe){
  if(righe.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/misurazioni?on_conflict=profilo_id,data`, {
    method: 'POST',
    headers: headersServizio({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(righe)
  });
  if(!res.ok) throw new Error(`Upsert misure fallito (${res.status}): ${await res.text()}`);
}

async function main(){
  console.log(DRY_RUN ? 'Modalità dry-run: nessuna scrittura, solo un riepilogo di cosa verrebbe fatto.' : 'Avvio migrazione misure...');
  let profiliVisti = 0, misureMigrate = 0, profiliFalliti = [];
  let offset = 0;
  while(true){
    const pagina = await leggiProfiliPagina(offset);
    if(pagina.length === 0) break;
    for(const riga of pagina){
      profiliVisti++;
      const misure = ((riga.dati || {}).measurements || []).filter(m => m && m.date);
      if(misure.length === 0) continue;
      const righeTabella = misure.map(m => ({
        profilo_id: riga.id, data: m.date, peso: m.weight != null ? m.weight : null,
        vita: m.waist != null ? m.waist : null, extra: m.extra || {}
      }));
      if(DRY_RUN){
        console.log(`[dry-run] migrerei ${righeTabella.length} misure per il profilo ${riga.id}`);
        misureMigrate += righeTabella.length;
        continue;
      }
      try{
        await upsertMisurazioni(righeTabella);
        misureMigrate += righeTabella.length;
      }catch(e){
        profiliFalliti.push({ profilo: riga.id, motivo: e.message });
      }
    }
    offset += PAGINA;
  }

  console.log('\n--- Riepilogo ---');
  console.log(`Profili controllati: ${profiliVisti}`);
  console.log(`Misure migrate: ${misureMigrate}`);
  console.log(`Profili falliti (da riprovare): ${profiliFalliti.length}`);
  profiliFalliti.forEach(f => console.log(`  - profilo ${f.profilo}: ${f.motivo}`));
  if(profiliFalliti.length) console.log('\nRilancia lo stesso comando per riprovare: l\'upsert non duplica chi è già migrato.');
}

main().catch(e => { console.error('Errore imprevisto:', e); process.exit(1); });
