// ============================================================
// FitPro — funzionamento offline
// Tiene una copia dell'app nel telefono: si apre anche senza rete.
// Quando pubblichi una modifica, alza il numero di VERSIONE qui sotto:
// l'app se ne accorge da sola e propone di aggiornarsi.
// ============================================================
const VERSIONE = "vigor-v55";

const DA_TENERE = [
  "./",
  "./index.html",
  "./style.css",
  "./corpo.js",
  "./corpo-donna.js",
  "./esercizi.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];

// librerie e caratteri presi da internet: li conservo al primo avvio con rete,
// così grafici, esportazione Excel e font funzionano anche offline
const DA_TENERE_ESTERNI = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;700&display=swap"
];

// installazione: scarico e conservo i file dell'app
self.addEventListener("install", evento => {
  evento.waitUntil(
    caches.open(VERSIONE).then(async cache => {
      await cache.addAll(DA_TENERE);
      // se una di queste non si scarica non deve bloccare l'installazione
      await Promise.all(DA_TENERE_ESTERNI.map(u =>
        fetch(u).then(r => { if (r.ok) return cache.put(u, r); }).catch(() => {})
      ));
    }).then(() => self.skipWaiting())
  );
});

// attivazione: butto via le copie delle versioni precedenti
self.addEventListener("activate", evento => {
  evento.waitUntil(
    caches.keys()
      .then(nomi => Promise.all(nomi.filter(n => n !== VERSIONE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", evento => {
  if (evento.data === "AGGIORNA_SUBITO") self.skipWaiting();
});

// ============================================================
// PROMEMORIA (notifiche push): arrivano anche ad app chiusa, mandate dal
// server nel momento giusto. Qui gestisco solo come mostrarle e cosa fare
// quando vengono toccate — l'invio vero e proprio parte da Supabase.
// ============================================================
self.addEventListener("push", evento => {
  let dati = { title: "FitPro", body: "Hai un allenamento in programma oggi." };
  try { if (evento.data) dati = { ...dati, ...evento.data.json() }; } catch (e) {}
  evento.waitUntil(
    self.registration.showNotification(dati.title, {
      body: dati.body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: "fitpro-promemoria",
      renotify: true
    })
  );
});

self.addEventListener("notificationclick", evento => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(elenco => {
      for (const c of elenco) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});

self.addEventListener("fetch", evento => {
  const richiesta = evento.request;
  if (richiesta.method !== "GET") return;

  const url = new URL(richiesta.url);

  // altri siti: librerie e caratteri li servo dalla copia salvata (e la aggiorno quando c'è rete);
  // i video invece passano sempre dalla rete
  if (url.origin !== location.origin) {
    const conservabile = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.hostname + url.pathname);
    if (!conservabile) return;
    evento.respondWith(
      caches.match(richiesta).then(salvata => {
        if (salvata) return salvata;
        return fetch(richiesta).then(risposta => {
          if (risposta && risposta.ok) {
            const copia = risposta.clone();
            caches.open(VERSIONE).then(c => c.put(richiesta, copia)).catch(() => {});
          }
          return risposta;
        });
      })
    );
    return;
  }

  // la pagina dell'app: provo prima dalla rete, così prendi subito le novità;
  // se non c'è campo uso la copia salvata
  // la configurazione (indirizzo e chiave del server) deve arrivare sempre fresca:
  // una copia vecchia farebbe ripartire l'app in modalità locale, mostrando dati
  // che non c'entrano niente con l'account
  if (url.pathname.endsWith("config.js")) {
    evento.respondWith(
      fetch(richiesta, { cache: "no-store" }).catch(() => caches.match(richiesta))
    );
    return;
  }

  if (richiesta.mode === "navigate" || url.pathname.endsWith("index.html")) {
    evento.respondWith(
      fetch(richiesta)
        .then(risposta => {
          const copia = risposta.clone();
          caches.open(VERSIONE).then(c => c.put("./index.html", copia));
          return risposta;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // tutto il resto (icone, file di contorno): prima la copia salvata, è più veloce
  evento.respondWith(
    caches.match(richiesta).then(salvata => {
      if (salvata) return salvata;
      return fetch(richiesta).then(risposta => {
        if (risposta && risposta.status === 200 && risposta.type === "basic") {
          const copia = risposta.clone();
          caches.open(VERSIONE).then(c => c.put(richiesta, copia));
        }
        return risposta;
      });
    })
  );
});
