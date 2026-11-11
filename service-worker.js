/* ============================================================
   Service Worker — OS Fácil Reformas
   Sobe a versão do CACHE_NAME sempre que alterar HTML/CSS/JS
   ============================================================ */
const CACHE_NAME = "osfacil-reformas-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/reforma.js",
];

// Instala e pré-cacheia o essencial
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch((err) => console.warn("Falha no pré-cache:", err))
  );
});

// Ativa e limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Estratégia: network-first para HTML/JS, cache-first para o resto
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Não intercepta chamadas externas (Supabase, CDNs, etc.)
  if (url.origin !== self.location.origin) return;

  // HTML e JS: network-first (sempre tenta pegar atualizado)
  const isDoc =
    req.destination === "document" || url.pathname.endsWith(".js");

  if (isDoc) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // Demais assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
