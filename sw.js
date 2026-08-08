// ═══════════════════════════════════════════════════════════════════════════════
//  FORGE COACHING — SERVICE WORKER
//
//  Ce fichier est un GABARIT. Le build (build.mjs) en produit `sw.js` à la racine
//  en remplaçant 185c52c35afc par une empreinte de l'index.html du moment. Toute
//  modification de l'app change donc la version, ce qui invalide l'ancien cache
//  et déclenche la bannière « Mise à jour disponible » côté coaché.
//
//  RÈGLES DE PRUDENCE — l'app est en production, un service worker mal écrit
//  peut servir une version périmée indéfiniment :
//
//  1. Les pages HTML passent par le RÉSEAU D'ABORD. Le cache ne sert que de
//     secours hors-ligne. Impossible de rester bloqué sur une version obsolète.
//  2. Les requêtes vers Supabase et le CDN ne sont JAMAIS interceptées. Aucune
//     donnée de coaché, aucun jeton d'authentification ne transite par le cache.
//  3. Seules les requêtes GET de même origine sont gérées.
//  4. La nouvelle version ne s'installe pas de force : elle attend que le coaché
//     appuie sur « Recharger ». Pas de rechargement surprise en pleine séance.
// ═══════════════════════════════════════════════════════════════════════════════

const VERSION = "185c52c35afc";
const CACHE   = "forge-coaching-" + VERSION;

// Ressources mises en cache dès l'installation : l'app doit pouvoir démarrer
// entièrement hors-ligne, polices comprises.
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./fonts/bebasneue-400-latin.woff2",
  "./fonts/bebasneue-400-latin-ext.woff2",
  "./fonts/dmsans-400-latin.woff2",
  "./fonts/dmsans-400-latin-ext.woff2",
  "./fonts/dmsans-500-latin.woff2",
  "./fonts/dmsans-500-latin-ext.woff2",
  "./fonts/dmsans-600-latin.woff2",
  "./fonts/dmsans-600-latin-ext.woff2",
  "./fonts/dmsans-700-latin.woff2",
  "./fonts/dmsans-700-latin-ext.woff2",
  "./fonts/dmsans-800-latin.woff2",
  "./fonts/dmsans-800-latin-ext.woff2",
  "./fonts/dmsans-300-latin.woff2",
  "./fonts/dmsans-300-latin-ext.woff2",
];

// ── Installation : pré-charge les ressources, puis attend son tour ────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll échoue en bloc si une seule ressource manque : on tolère les
      // absences pour qu'une police renommée ne casse pas toute l'installation.
      .then((cache) => Promise.all(
        ASSETS.map((url) => cache.add(url).catch(() => null))
      ))
  );
  // Volontairement PAS de skipWaiting() ici : la bascule est décidée par le coaché.
});

// ── Activation : fait le ménage des caches des versions précédentes ──────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(
        noms.filter((n) => n.startsWith("forge-coaching-") && n !== CACHE)
            .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Interception des requêtes ────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // On ne touche qu'aux GET de même origine. Supabase, le CDN jsDelivr et tout
  // le reste passent directement au réseau, sans jamais être mis en cache.
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  // Pages HTML : réseau d'abord, cache en secours si hors-ligne.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put(req, copie)).catch(() => {});
          return rep;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // Ressources statiques (polices, icônes) : cache d'abord, réseau en secours.
  event.respondWith(
    caches.match(req).then((cache) => {
      if (cache) return cache;
      return fetch(req).then((rep) => {
        if (rep && rep.status === 200 && rep.type === "basic") {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put(req, copie)).catch(() => {});
        }
        return rep;
      });
    })
  );
});

// ── Réception d'une notification push ────────────────────────────────────────
// Le contenu arrive chiffré depuis Apple ou Google ; le navigateur l'a déjà
// déchiffré quand il nous le passe.
self.addEventListener("push", (event) => {
  const infos = { title: "Forge Coaching", body: "", url: "./" };
  try {
    if (event.data) Object.assign(infos, event.data.json());
  } catch {
    if (event.data) infos.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(infos.title, {
      body: infos.body,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      // Un même tag remplace la notification précédente au lieu d'empiler :
      // un coaché qui n'ouvre pas l'app pendant trois jours n'aura pas trois
      // rappels de séance en attente.
      tag: infos.tag || "forge-coaching",
      data: { url: infos.url },
    })
  );
});

// ── Clic sur la notification : on remet l'app au premier plan ───────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fenetres) {
      if ("focus" in f) { await f.focus(); return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow(cible);
  })());
});

// ── Bascule vers la nouvelle version, sur demande explicite de l'app ─────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "VERSION") {
    if (event.source) event.source.postMessage({ type: "VERSION", version: VERSION });
  }
});
