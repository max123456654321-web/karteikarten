/* ======================================================================
   Service Worker — sorgt dafür, dass Updates sofort ankommen
   ======================================================================
   Ohne diesen Worker liefert GitHub Pages die index.html mit
   "Cache-Control: max-age=600" aus. Eine zum Home-Bildschirm hinzugefügte
   App zeigt dann bis zu zehn Minuten (oft länger, weil iOS gar nicht erst
   nachfragt) die alte Fassung — man ändert etwas, pusht, und auf dem iPad
   tut sich nichts.

   Strategie: NETWORK FIRST für alles aus dem eigenen Verzeichnis.
   - Online: es kommt immer die frische Datei vom Server, egal was im
     Zwischenspeicher liegt. Die Antwort wandert nebenbei in den Cache.
   - Offline: es kommt die zuletzt gespeicherte Fassung. Die App läuft also
     auch ohne Netz weiter (die Karten liegen ohnehin in IndexedDB).

   Fremde Adressen (JSZip, sql.js, MathJax vom CDN) fasst der Worker nicht
   an — die dürfen ruhig lange zwischengespeichert bleiben.
   ====================================================================== */

const CACHE = 'karteikarten-v1';

self.addEventListener('install', (e) => {
  // Sofort übernehmen, nicht auf das Schließen aller Tabs warten
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // CDN unangetastet lassen

  e.respondWith((async () => {
    try {
      // no-store: auch der HTTP-Zwischenspeicher des Browsers wird umgangen
      const frisch = await fetch(req, { cache: 'no-store' });
      if (frisch && frisch.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, frisch.clone());
      }
      return frisch;
    } catch (err) {
      const gespeichert = await caches.match(req);
      if (gespeichert) return gespeichert;
      throw err;
    }
  })());
});
