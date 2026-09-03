// ============================================================
// CONFIGURAZIONE — l'unico file da modificare
// ============================================================
// Lasciando i due valori vuoti, l'app funziona solo su questo telefono.
// Mettendoli, i dati vanno online: stesso account da qualsiasi dispositivo,
// da Safari e dall'app installata.
//
// Li trovi su supabase.com: progetto > Settings > API
//   url    = "Project URL"
//   chiave = "anon public"  (è pubblica, può stare qui)
// ============================================================
window.APP_CONFIG = {
  url: "https://oyllkwjcfszehugqdxlb.supabase.co",
  chiave: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bGxrd2pjZnN6ZWh1Z3FkeGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDUwNDYsImV4cCI6MjEwMjAyMTA0Nn0.d0H9WogBEpTaAXZQswtJF3S4YPKzN_5ycIZGG2sk3Y8",

  // Facoltativo. Lasciando vuoto, il popup video resta come oggi (solo link).
  // Mettendo una chiave presa da exercisedb.dev (piano di produzione, non
  // quello gratuito "solo esplorazione"), il popup prova anche a mostrare
  // la GIF dimostrativa dell'esercizio. Vedi js/esercizi/esercizi-db.js.
  exerciseDbApiKey: ""
};
