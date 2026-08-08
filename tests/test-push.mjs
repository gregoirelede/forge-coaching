// ═══════════════════════════════════════════════════════════════════════════
//  Vérifie, dans un VRAI navigateur, qu'un message push injecté par le
//  protocole de débogage parvient bien jusqu'au service worker installé, et que
//  son gestionnaire s'exécute jusqu'à l'appel d'affichage.
//
//  LIMITE ASSUMÉE DE CETTE MACHINE : le Chromium sans interface installé ici
//  refuse l'autorisation de notification par toutes les voies possibles
//  (grantPermissions de Playwright, Browser.grantPermissions et
//  Browser.setPermission du protocole CDP, profil persistant, headless=new).
//  L'AFFICHAGE de la notification est donc invérifiable ici — mais son refus
//  est justement la preuve que le gestionnaire est allé au bout : le navigateur
//  ne peut refuser que ce qu'on lui a demandé. Le contenu exact de la
//  notification, lui, est vérifié par test-push-sw.mjs sur le sw.js livré.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";

const URL = "http://127.0.0.1:8099/index.html";
const STUB = `window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(){return this},select(){return this},eq(){return this},single:async()=>({data:null})})};`;

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.route("**/cdn.jsdelivr.net/**", r =>
  r.fulfill({ status: 200, contentType: "application/javascript", body: STUB }));

await p.goto(URL, { waitUntil: "networkidle" });
await p.evaluate(() => navigator.serviceWorker.ready);
await p.waitForTimeout(800);

const cdp = await ctx.newCDPSession(p);
await cdp.send("ServiceWorker.enable");
await cdp.send("Runtime.enable");

// On écoute les erreurs remontées par le worker : c'est notre mouchard.
const erreursWorker = [];
cdp.on("ServiceWorker.workerErrorReported", (e) => erreursWorker.push(e.errorMessage || {}));

let registrationId = null;
cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => {
  for (const r of e.registrations || []) {
    if (r.scopeURL.includes("127.0.0.1:8099")) registrationId = r.registrationId;
  }
});
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);

console.log("\n─── Le service worker reçoit-il les messages push ? ───");

const perm = await p.evaluate(() => Notification.permission);
console.log(`  INFO   autorisation de notification dans ce navigateur de test : ${perm}`);
console.log("         (impossible à accorder ici — voir l'en-tête du fichier)");

ok(!!registrationId, `service worker enregistré et identifié (registrationId ${registrationId})`);

// L'API d'abonnement doit exister : sans elle, aucun abonnement possible.
const api = await p.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return {
    pushManager: !!reg.pushManager,
    subscribe: typeof reg.pushManager?.subscribe === "function",
    getSubscription: typeof reg.pushManager?.getSubscription === "function",
    showNotification: typeof reg.showNotification === "function",
  };
});
ok(api.pushManager && api.subscribe && api.getSubscription,
   "l'API d'abonnement push est disponible sur l'enregistrement");
ok(api.showNotification, "l'API d'affichage de notification est disponible sur l'enregistrement");

if (registrationId) {
  const avant = erreursWorker.length;
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: "http://127.0.0.1:8099",
    registrationId,
    data: JSON.stringify({ title: "Séance du jour", body: "Push A t'attend. 7 exercices.", url: "./" }),
  });
  await p.waitForTimeout(1800);

  const nouvelles = erreursWorker.slice(avant);
  const tentative = nouvelles.find(e => /showNotification/.test(e.errorMessage || ""));

  ok(!!tentative,
     "le message push a réveillé le worker et son gestionnaire est allé jusqu'à l'appel d'affichage");
  if (tentative) {
    ok(/sw\.js$/.test(tentative.sourceURL || ""),
       `l'appel provient bien du service worker livré (${(tentative.sourceURL || "").split("/").pop()})`);
    ok(/No notification permission/.test(tentative.errorMessage),
       "seule l'autorisation manque — le code du gestionnaire, lui, s'est exécuté sans erreur");
  }

  // Une charge non structurée ne doit pas produire une erreur DIFFÉRENTE
  // (une erreur d'analyse JSON signalerait un gestionnaire mal protégé).
  const avant2 = erreursWorker.length;
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: "http://127.0.0.1:8099", registrationId, data: "texte brut sans structure",
  });
  await p.waitForTimeout(1500);
  const suite = erreursWorker.slice(avant2);
  const analyse = suite.find(e => /JSON|SyntaxError|Unexpected token/i.test(e.errorMessage || ""));
  ok(!analyse, "une charge non structurée ne provoque aucune erreur d'analyse dans le worker");
  ok(suite.some(e => /showNotification/.test(e.errorMessage || "")),
     "elle atteint elle aussi l'appel d'affichage (repli sur le texte brut)");
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
