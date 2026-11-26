// Service worker simples: guarda a "casca" do app para abrir rapido.
// Dados do Supabase nunca ficam em cache.
const VERSAO = "myndra-v2";
const CASCA = [
  "./",
  "index.html",
  "css/app.css",
  "js/config.js",
  "js/app.js",
  "js/vendor/supabase.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/logo-myndra.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCA)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // rede primeiro, cache como reserva (assim atualizacoes chegam logo)
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(VERSAO).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
