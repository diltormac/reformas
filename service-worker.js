/* ============================================================
   Service Worker — OS Fácil Reformas (Atualização Automática)
   ============================================================ */

// Gera um nome de cache único baseado na data/hora atual
const CACHE_NAME = `osfacil-reformas-${new Date().getTime()}`;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/reforma.js",
];

// Instala, ativa imediatamente e pré-cacheia o essencial
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Força o novo SW a assumir o controle na hora
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }),
  );
});

// Ativa e limpa TODOS os caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            // Se o nome do cache for diferente do atual, apaga!
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// ESTRATÉGIA: Network First (Rede Primeiro)
// Tenta pegar da internet. Se der erro, pega do cache.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ignora chamadas para o Supabase, CDNs externos (como Tailwind, FontAwesome) e etc.
  // O SW só gerencia os arquivos do seu próprio site (HTML, CSS, JS, imagens locais)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Se conseguiu baixar da internet, salva a versão nova no cache
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => {
        // Se a internet falhou (offline), tenta pegar do cache
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          // Se não achou no cache e é uma página, tenta o index
          if (req.destination === "document") {
            return caches.match("./index.html");
          }
        });
      }),
  );
});
