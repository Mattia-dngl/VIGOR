// ============================================================
// FitPro — funzionamento offline
// Tiene una copia dell'app nel telefono: si apre anche senza rete.
// Quando pubblichi una modifica, alza il numero di VERSIONE qui sotto:
// l'app se ne accorge da sola e propone di aggiornarsi.
// ============================================================
const VERSIONE = "vigor-v85";

const DA_TENERE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/corpo.js",
  "./js/corpo-donna.js",
  "./js/esercizi.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png"
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
      icon: "./assets/icons/icon-192.png",
      badge: "./assets/icons/icon-192.png",
      tag: "fitpro-promemoria",
      renotify: true
    })
  );
});

// 31/08/2026: segnalato dall'utente che il promemoria "si disattiva da solo"
// riaprendo l'app. Causa reale: il browser (specie Safari/iOS quando l'app è
// installata in Home) può far scadere/ruotare l'iscrizione push da solo, ed
// esiste un evento apposta per accorgersene — che prima non era gestito per
// niente: l'iscrizione moriva in silenzio e il tasto tornava "spento" senza
// che nessuno l'avesse toccato. Qui la rifaccio subito e avviso le pagine
// aperte, che la ri-salvano su Supabase con lo stesso codice già usato da
// attivaPromemoria() (le chiavi restano sempre solo lì, mai nel service
// worker). Non è una garanzia assoluta: iOS può comunque azzerare i dati
// del service worker se l'app resta a lungo inutilizzata — un limite del
// sistema operativo, non dell'app.
const VAPID_CHIAVE_PUBBLICA = "BLNF2KoXkgCvLsEZkR-4bA-TtAXDEybdoKTqtLuIbGo5Q-zXhklQho5eb5wNgv2-2ZZMNsYKNl48IWtQfUGw8Vc";
function base64UrlAUint8(base64Url){
  const padding = "=".repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const uscita = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) uscita[i] = raw.charCodeAt(i);
  return uscita;
}
self.addEventListener("pushsubscriptionchange", evento => {
  evento.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlAUint8(VAPID_CHIAVE_PUBBLICA)
    }).then(nuovaSub =>
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(elenco => {
        elenco.forEach(c => c.postMessage({
          tipo: "PUSH_SUBSCRIPTION_RINNOVATA",
          subscription: nuovaSub.toJSON(),
          endpoint: nuovaSub.endpoint,
          vecchioEndpoint: evento.oldSubscription ? evento.oldSubscription.endpoint : null
        }));
      })
    ).catch(() => {})
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

  // file di codice dell'app (CSS/JS): stessa logica di index.html, rete prima.
  // Sono proprio i file che possono cambiare a ogni aggiornamento — se restassero
  // "cache prima" rischierebbero di restare indietro rispetto all'HTML nuovo,
  // che invece si aggiorna sempre subito (è già successo: HTML nuovo + CSS
  // vecchio insieme rompe la grafica). Icone e immagini restano cache-prima
  // qui sotto, perché quelle davvero non cambiano quasi mai.
  if (/\.(css|js)$/.test(url.pathname)) {
    evento.respondWith(
      fetch(richiesta)
        .then(risposta => {
          if (risposta && risposta.ok) {
            const copia = risposta.clone();
            caches.open(VERSIONE).then(c => c.put(richiesta, copia)).catch(() => {});
          }
          return risposta;
        })
        .catch(() => caches.match(richiesta))
    );
    return;
  }

  // tutto il resto (icone, immagini): prima la copia salvata, è più veloce
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
