// ═══════════════════════════════════════════════════════════════════════════
//  Vérifie le comportement des gestionnaires « push » et « notificationclick »
//  du service worker RÉELLEMENT LIVRÉ (sw.js à la racine, produit par le build).
//
//  Pourquoi ce test existe : le Chromium sans interface de cette machine refuse
//  systématiquement l'autorisation de notification, ce qui empêche d'observer la
//  notification affichée dans un vrai navigateur. On charge donc le fichier livré
//  dans un environnement de service worker simulé et on inspecte exactement les
//  arguments passés à showNotification. C'est bien le code de production qui est
//  exécuté ici — pas une copie, pas une reformulation.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import vm from "node:vm";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const source = readFileSync(import.meta.dirname + "/../sw.js", "utf8");

// ── Environnement de service worker simulé ─────────────────────────────────
function nouvelEnvironnement() {
  const journal = { notifications: [], fenetresFocalisees: [], fenetresOuvertes: [] };
  const auditeurs = {};

  const self = {
    addEventListener: (type, fn) => { (auditeurs[type] ||= []).push(fn); },
    location: { origin: "https://gregoirelede.github.io" },
    skipWaiting: () => {},
    registration: {
      showNotification: (titre, options) => {
        journal.notifications.push({ titre, options });
        return Promise.resolve();
      },
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(journal.clientsDisponibles || []),
      openWindow: (u) => { journal.fenetresOuvertes.push(u); return Promise.resolve(); },
    },
  };

  const contexte = vm.createContext({
    self,
    caches: { open: () => Promise.resolve({ put: () => {} }), keys: () => Promise.resolve([]), match: () => Promise.resolve(null), delete: () => Promise.resolve(true) },
    fetch: () => Promise.resolve({ status: 200, clone: () => ({}) }),
    URL, Promise, console,
  });
  vm.runInContext(source, contexte, { filename: "sw.js" });

  return { self, auditeurs, journal };
}

// Fabrique un évènement push tel que le navigateur le remet au worker.
function evenementPush(charge, { json = true } = {}) {
  const attentes = [];
  return {
    attentes,
    ev: {
      waitUntil: (p) => attentes.push(p),
      data: charge === null ? null : {
        json: () => { if (!json) throw new SyntaxError("charge non JSON"); return JSON.parse(charge); },
        text: () => charge,
      },
    },
  };
}

console.log("\n─── Gestionnaire « push » du service worker livré ───");

const env = nouvelEnvironnement();
ok(Array.isArray(env.auditeurs.push) && env.auditeurs.push.length === 1,
   "le service worker enregistre bien un gestionnaire « push »");
ok(Array.isArray(env.auditeurs.notificationclick) && env.auditeurs.notificationclick.length === 1,
   "le service worker enregistre bien un gestionnaire « notificationclick »");

// ── Cas 1 : charge JSON normale, celle qu'envoie l'Edge Function send-push ──
{
  const { ev, attentes } = evenementPush(JSON.stringify({
    title: "Séance du jour",
    body: "Push A t'attend. 7 exercices.",
    url: "./",
  }));
  env.auditeurs.push[0](ev);
  await Promise.all(attentes);

  const n = env.journal.notifications.at(-1);
  ok(!!n, "une notification est produite");
  if (n) {
    ok(n.titre === "Séance du jour", `titre : « ${n.titre} »`);
    ok(n.options.body === "Push A t'attend. 7 exercices.", `corps : « ${n.options.body} »`);
    ok(/icons\/icon-192\.png$/.test(n.options.icon || ""), `icône du bouclier : ${n.options.icon}`);
    ok(/icons\/icon-192\.png$/.test(n.options.badge || ""), `pastille Android : ${n.options.badge}`);
    ok(n.options.tag === "forge-coaching", `tag « ${n.options.tag} » — remplace au lieu d'empiler`);
    ok(n.options.data && n.options.data.url === "./", "lien de destination transmis à la notification");
  }
  ok(attentes.length === 1, "l'affichage passe par waitUntil (le worker ne s'endort pas avant)");
}

// ── Cas 2 : charge non structurée — ne doit pas faire planter le worker ────
{
  const { ev, attentes } = evenementPush("texte brut sans structure", { json: false });
  let plante = false;
  try { env.auditeurs.push[0](ev); await Promise.all(attentes); } catch { plante = true; }
  ok(!plante, "une charge non structurée ne fait pas planter le worker");
  const n = env.journal.notifications.at(-1);
  ok(n && n.options.body === "texte brut sans structure",
     `le texte brut est affiché tel quel : « ${n?.options.body} »`);
  ok(n && n.titre === "Forge Coaching", `titre de repli : « ${n?.titre} »`);
}

// ── Cas 3 : push sans aucune charge (réveil silencieux envoyé par certains
//            serveurs) — la notification générique doit quand même s'afficher.
{
  const { ev, attentes } = evenementPush(null);
  let plante = false;
  try { env.auditeurs.push[0](ev); await Promise.all(attentes); } catch { plante = true; }
  ok(!plante, "un push sans charge ne fait pas planter le worker");
  const n = env.journal.notifications.at(-1);
  ok(n && n.titre === "Forge Coaching" && n.options.body === "",
     "un push vide donne la notification générique, jamais « undefined »");
}

// ── Cas 4 : un tag personnalisé est respecté (plusieurs rappels distincts) ──
{
  const { ev, attentes } = evenementPush(JSON.stringify({
    title: "Pesée du dimanche", body: "Pense à te peser ce matin.", tag: "pesee", url: "./",
  }));
  env.auditeurs.push[0](ev);
  await Promise.all(attentes);
  const n = env.journal.notifications.at(-1);
  ok(n && n.options.tag === "pesee",
     `un tag explicite est respecté (« ${n?.options.tag} ») : deux rappels de nature différente coexistent`);
}

// ── Cas 5 : aucune donnée sensible ne fuit dans la notification ────────────
{
  const { ev, attentes } = evenementPush(JSON.stringify({
    title: "T", body: "B", url: "./", jetonSecret: "ne-doit-pas-ressortir",
  }));
  env.auditeurs.push[0](ev);
  await Promise.all(attentes);
  const n = env.journal.notifications.at(-1);
  const champs = JSON.stringify(n.options);
  ok(!champs.includes("ne-doit-pas-ressortir"),
     "un champ inattendu de la charge n'est pas recopié dans la notification");
  ok(Object.keys(n.options.data).join(",") === "url",
     `la notification ne transporte que l'URL (${Object.keys(n.options.data).join(", ")})`);
}

console.log("\n─── Gestionnaire « notificationclick » ───");

// ── Cas 6 : app déjà ouverte → on la remet au premier plan, pas de doublon ─
{
  let focalisee = false;
  env.journal.clientsDisponibles = [{ focus: async () => { focalisee = true; }, url: "https://gregoirelede.github.io/forge-coaching/" }];
  const attentes = [];
  let fermee = false;
  env.auditeurs.notificationclick[0]({
    notification: { close: () => { fermee = true; }, data: { url: "./" } },
    waitUntil: (p) => attentes.push(p),
  });
  await Promise.all(attentes);
  ok(fermee, "la notification est refermée au clic");
  ok(focalisee, "l'app déjà ouverte est ramenée au premier plan");
  ok(env.journal.fenetresOuvertes.length === 0, "aucune seconde fenêtre n'est ouverte en doublon");
}

// ── Cas 7 : app fermée → on l'ouvre ────────────────────────────────────────
{
  env.journal.clientsDisponibles = [];
  const attentes = [];
  env.auditeurs.notificationclick[0]({
    notification: { close: () => {}, data: { url: "./" } },
    waitUntil: (p) => attentes.push(p),
  });
  await Promise.all(attentes);
  ok(env.journal.fenetresOuvertes.length === 1 && env.journal.fenetresOuvertes[0] === "./",
     `l'app fermée est ouverte sur « ${env.journal.fenetresOuvertes[0]} »`);
}

// ── Cas 8 : notification sans données → repli sur la racine ────────────────
{
  env.journal.fenetresOuvertes.length = 0;
  const attentes = [];
  env.auditeurs.notificationclick[0]({
    notification: { close: () => {}, data: null },
    waitUntil: (p) => attentes.push(p),
  });
  await Promise.all(attentes);
  ok(env.journal.fenetresOuvertes[0] === "./",
     "une notification sans données ouvre la racine plutôt que « undefined »");
}

console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
