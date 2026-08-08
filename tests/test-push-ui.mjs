// ═══════════════════════════════════════════════════════════════════════════
//  Parcours de test du réglage « Notifications » dans Profil, joué de bout en
//  bout dans un vrai navigateur, avec un coaché connecté (Supabase simulé).
//
//  On simule Supabase ET les API de notification du navigateur : le but ici
//  n'est pas de tester Chromium, c'est de vérifier MON code — l'enchaînement
//  des états, ce que l'app écrit en base, ce qu'elle affiche au coaché.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });

const URL = "http://127.0.0.1:8099/index.html";
const OUT = CAPTURES;

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

// Une paire de clés VAPID publique valide (65 octets, base64url) pour l'abonnement.
const CLE_PUBLIQUE = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

// Faux client Supabase + fausses API de notification, injectés avant l'app.
const injection = (etatNavigateur) => `
window.__journal = { appels: [], upserts: [], suppressions: [], abonnements: 0, desabonnements: 0 };

// ── API de notification du navigateur ──
window.Notification = function () {};
window.Notification.permission = ${JSON.stringify(etatNavigateur.permission)};
window.Notification.requestPermission = async () => {
  window.Notification.permission = ${JSON.stringify(etatNavigateur.reponse || "granted")};
  return window.Notification.permission;
};
window.PushManager = function () {};

let _abo = ${etatNavigateur.dejaAbonne ? "true" : "false"};
const fauxAbo = {
  endpoint: "https://fcm.googleapis.com/fcm/send/APPAREIL-DE-TEST",
  toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/APPAREIL-DE-TEST",
                   keys: { p256dh: "P256DH-DE-TEST", auth: "AUTH-DE-TEST" } }),
  unsubscribe: async () => { _abo = false; window.__journal.desabonnements++; return true; },
};
const fauxReg = {
  pushManager: {
    getSubscription: async () => (_abo ? fauxAbo : null),
    subscribe: async (opts) => {
      window.__journal.abonnements++;
      window.__journal.optionsAbonnement = {
        userVisibleOnly: opts.userVisibleOnly,
        tailleCle: opts.applicationServerKey ? opts.applicationServerKey.length : 0,
        premierOctet: opts.applicationServerKey ? opts.applicationServerKey[0] : null,
      };
      _abo = true; return fauxAbo;
    },
  },
  showNotification: async () => {},
};
Object.defineProperty(navigator, "serviceWorker", {
  configurable: true,
  value: { ready: Promise.resolve(fauxReg), register: async () => fauxReg,
           addEventListener(){}, controller: null },
});

// ── Faux client Supabase ──
const PROFIL = { id: "coache-test", name: "Marie Dupont", access_code: "MDUPONT27",
                 start_date: "2026-01-06", goal: "Prise de masse", offer: "premium",
                 created_at: "2026-01-06T09:00:00Z", role: "coachee" };
const PROGRAMME = { id: "prog-1", coachee_id: "coache-test", is_active: true,
  week_structure: [
    { day: "Lundi", sessionId: 1 }, { day: "Mardi", sessionId: null },
    { day: "Mercredi", sessionId: 2 }, { day: "Jeudi", sessionId: null },
    { day: "Vendredi", sessionId: 1 }, { day: "Samedi", sessionId: null },
    { day: "Dimanche", sessionId: null },
  ],
  sessions_structure: [
    { id: 1, name: "Push A", exercises: [
      { name: "Développé couché", muscle: "Pectoraux", sets: 4, reps: ["8","8","8","8"] } ] },
    { id: 2, name: "Pull A", exercises: [
      { name: "Tractions", muscle: "Grand dorsal", sets: 4, reps: ["8","8","8","8"] } ] },
  ] };

function requete(table) {
  const q = {
    _table: table, _filtres: {},
    select(){ return q; }, order(){ return q; }, in(){ return q; }, gte(){ return q; },
    eq(col, val){ q._filtres[col] = val; return q; },
    single: async () => ({ data: table === "profiles" ? PROFIL : table === "programs" ? PROGRAMME : null, error: null }),
    maybeSingle: async () => ({ data: table === "profiles" ? PROFIL : table === "programs" ? PROGRAMME : null, error: null }),
    upsert: async (ligne) => { window.__journal.upserts.push({ table, ligne }); return { data: null, error: null }; },
    delete(){ return { eq: async (c, v) => { window.__journal.suppressions.push({ table, [c]: v }); return { error: null }; } }; },
    insert: async () => ({ data: null, error: null }),
    update(){ return q; },
    then(res){ return Promise.resolve({ data: [], error: null }).then(res); },
  };
  return q;
}

window.supabase = { createClient: () => ({
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "coache-test" } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
    signOut: async () => ({ error: null }),
  },
  from: requete,
  functions: { invoke: async (nom, opts) => {
    window.__journal.appels.push({ nom, corps: opts && opts.body });
    if (nom === "push-config") return { data: { publicKey: ${JSON.stringify(CLE_PUBLIQUE)} }, error: null };
    if (nom === "send-push")   return { data: { success: true, envoyees: 1, total: 1 }, error: null };
    return { data: null, error: null };
  } },
}) };
`;

const b = await chromium.launch();

async function ouvrirReglages(etatNavigateur, { userAgent } = {}) {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    ...(userAgent ? { userAgent } : {}),
  });
  const p = await ctx.newPage();
  await p.addInitScript(injection(etatNavigateur));
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  // Profil → Réglages
  await p.locator("text=PROFIL").last().click();
  await p.waitForTimeout(500);
  await p.locator("text=RÉGLAGES").last().click();
  await p.waitForTimeout(700);
  return { ctx, p };
}

const bloc = (p) => p.evaluate(() => {
  const titre = [...document.querySelectorAll("div")]
    .find(d => d.textContent.trim() === "Notifications" && d.children.length === 0);
  if (!titre) return null;
  // titre → colonne de texte → ligne d'en-tête → bloc complet (message, bouton,
  // encart iOS sont des frères de la ligne d'en-tête, pas ses descendants).
  const carte = titre.parentElement.parentElement.parentElement;
  return { texte: carte.innerText, aUnInterrupteur: !!carte.querySelector("[role='switch'], button") };
});

// ── 1. Coaché sur un appareil où tout est possible, pas encore abonné ───────
console.log("\n─── Premier passage : notifications proposées ───");
{
  const { ctx, p } = await ouvrirReglages({ permission: "default", dejaAbonne: false });
  const b1 = await bloc(p);
  ok(!!b1, "le réglage « Notifications » est présent dans Profil → Réglages");
  ok(b1 && /Être prévenu de tes séances/.test(b1.texte), `sous-titre : « ${b1?.texte.split("\n")[1]} »`);
  ok(b1 && !/ENVOYER UN TEST/.test(b1.texte), "pas de bouton de test tant qu'on n'est pas abonné");
  await p.screenshot({ path: `${OUT}/push-1-inactif.png` });

  // ── 2. Activation ────────────────────────────────────────────────────────
  console.log("\n─── Activation par le coaché ───");
  const inter = p.locator("text=Notifications").last().locator("xpath=../..").locator("[role='switch'], button").first();
  await inter.click();
  await p.waitForTimeout(1400);

  const j = await p.evaluate(() => window.__journal);
  ok(j.appels.some(a => a.nom === "push-config"),
     "l'app demande la clé publique du serveur (Edge Function push-config)");
  ok(j.abonnements === 1, `un abonnement est créé auprès du navigateur (${j.abonnements})`);
  ok(j.optionsAbonnement?.userVisibleOnly === true,
     "userVisibleOnly = true (exigé par Chrome, sinon l'abonnement est refusé)");
  ok(j.optionsAbonnement?.tailleCle === 65 && j.optionsAbonnement?.premierOctet === 4,
     `la clé VAPID est convertie en 65 octets, point non compressé (0x0${j.optionsAbonnement?.premierOctet})`);

  const up = j.upserts.find(u => u.table === "push_subscriptions");
  ok(!!up, "l'abonnement est enregistré dans push_subscriptions");
  if (up) {
    ok(up.ligne.coachee_id === "coache-test", `rattaché au bon coaché (${up.ligne.coachee_id})`);
    ok(up.ligne.endpoint?.includes("APPAREIL-DE-TEST"), "adresse de l'appareil transmise");
    ok(up.ligne.p256dh === "P256DH-DE-TEST" && up.ligne.auth === "AUTH-DE-TEST",
       "les deux clés de chiffrement de l'appareil sont transmises");
    ok(typeof up.ligne.user_agent === "string" && up.ligne.user_agent.length <= 300,
       `appareil identifié, tronqué à 300 caractères (${up.ligne.user_agent.length})`);
  }

  const b2 = await bloc(p);
  ok(b2 && /Notifications activées sur cet appareil/.test(b2.texte), "le coaché voit une confirmation");
  ok(b2 && /Rappels de séance et messages de ton coach/.test(b2.texte), "le sous-titre passe à l'état actif");
  ok(b2 && /ENVOYER UN TEST/.test(b2.texte), "le bouton « ENVOYER UN TEST » apparaît");
  await p.screenshot({ path: `${OUT}/push-2-actif.png` });

  // ── 3. Envoi d'un test ───────────────────────────────────────────────────
  console.log("\n─── Bouton « Envoyer un test » ───");
  await p.locator("text=ENVOYER UN TEST").click();
  await p.waitForTimeout(900);
  const j3 = await p.evaluate(() => window.__journal);
  const test = j3.appels.find(a => a.nom === "send-push");
  ok(!!test, "l'Edge Function send-push est appelée");
  ok(test && test.corps?.test === true, "elle est appelée en mode test (envoi à soi-même)");
  ok(test && !test.corps?.coacheeId, "aucun identifiant de coaché n'est envoyé depuis le client");
  const b3 = await bloc(p);
  ok(b3 && /Test envoyé sur 1 appareil\./.test(b3.texte), `retour affiché : « ${b3?.texte.match(/Test envoyé[^\n]*/)?.[0]} »`);

  // ── 4. Désactivation ─────────────────────────────────────────────────────
  console.log("\n─── Désactivation ───");
  const inter2 = p.locator("text=Notifications").last().locator("xpath=../..").locator("[role='switch'], button").first();
  await inter2.click();
  await p.waitForTimeout(1100);
  const j4 = await p.evaluate(() => window.__journal);
  ok(j4.suppressions.some(s => s.table === "push_subscriptions"),
     "l'abonnement est retiré de la base");
  ok(j4.desabonnements === 1, "l'abonnement est aussi révoqué auprès du navigateur");
  const b4 = await bloc(p);
  ok(b4 && /Notifications désactivées sur cet appareil/.test(b4.texte), "le coaché voit la confirmation");
  ok(b4 && !/ENVOYER UN TEST/.test(b4.texte), "le bouton de test disparaît");
  await ctx.close();
}

// ── 5. Autorisation refusée au niveau du téléphone ─────────────────────────
console.log("\n─── Notifications bloquées par le téléphone ───");
{
  const { ctx, p } = await ouvrirReglages({ permission: "denied", dejaAbonne: false });
  const b5 = await bloc(p);
  ok(b5 && /Bloquées par ton téléphone/.test(b5.texte), "l'app explique que le blocage vient du téléphone");
  ok(b5 && !/ENVOYER UN TEST/.test(b5.texte), "aucun bouton qui échouerait sans expliquer pourquoi");
  await ctx.close();
}

// ── 6. iPhone, app non installée sur l'écran d'accueil ─────────────────────
console.log("\n─── iPhone sans installation sur l'écran d'accueil ───");
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
  const p = await ctx.newPage();
  // Safari iOS hors écran d'accueil : pas de PushManager du tout.
  await p.addInitScript(injection({ permission: "default", dejaAbonne: false })
    + `delete window.PushManager;`);
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  await p.locator("text=PROFIL").last().click(); await p.waitForTimeout(500);
  await p.locator("text=RÉGLAGES").last().click(); await p.waitForTimeout(700);

  const b6 = await bloc(p);
  ok(b6 && /écran d'accueil/.test(b6.texte), "l'app explique la règle d'Apple au lieu de dire « indisponible »");
  ok(b6 && /Partager/.test(b6.texte), "elle donne la marche à suivre (Partager → Sur l'écran d'accueil)");
  await p.screenshot({ path: `${OUT}/push-3-ios.png` });
  await ctx.close();
}

// ── 7. Retour sur un appareil déjà abonné ──────────────────────────────────
console.log("\n─── Réouverture sur un appareil déjà abonné ───");
{
  const { ctx, p } = await ouvrirReglages({ permission: "granted", dejaAbonne: true });
  const b7 = await bloc(p);
  ok(b7 && /Rappels de séance/.test(b7.texte), "l'état actif est retrouvé sans réabonnement");
  ok(b7 && /ENVOYER UN TEST/.test(b7.texte), "le bouton de test est directement disponible");
  const j7 = await p.evaluate(() => window.__journal);
  ok(j7.abonnements === 0, "aucun abonnement en double n'est créé à la réouverture");
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
