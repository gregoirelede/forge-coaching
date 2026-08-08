// Vérifie la chaîne PWA complète : manifest, service worker, démarrage
// hors-ligne, et surtout la bannière de mise à jour.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Attention : la constante URL ci-dessous masque le URL global du langage.
// Tout chemin se calcule donc avec import.meta.dirname, jamais avec new URL().
const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });

const URL  = "http://127.0.0.1:8099/index.html";
const OUT  = CAPTURES;
const SW   = import.meta.dirname + "/../sw.js";

const STUB = `window.supabase = { createClient: (u,k,o) => ({ auth: {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }) },
  from(){return this}, select(){return this}, eq(){return this}, single: async()=>({data:null}) }) };`;

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const swOriginal = readFileSync(SW, "utf8");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.route("**/cdn.jsdelivr.net/**", r =>
  r.fulfill({ status: 200, contentType: "application/javascript", body: STUB }));

try {
  // ── 1. Manifest ────────────────────────────────────────────────────────────
  console.log("\n─── Manifest ───");
  const rep = await page.goto("http://127.0.0.1:8099/manifest.webmanifest");
  const man = JSON.parse(await rep.text());
  ok(rep.status() === 200, `manifest.webmanifest servi (HTTP ${rep.status()})`);
  ok(man.display === "standalone", `display = ${man.display}`);
  ok(man.start_url === "./" && man.scope === "./", "start_url et scope relatifs (compatibles sous-dossier GitHub Pages)");
  ok(man.icons.length >= 2, `${man.icons.length} icônes déclarées`);
  ok(man.icons.some(i => i.purpose === "maskable"), "icône maskable présente (Android)");

  // ── 2. Enregistrement du service worker ────────────────────────────────────
  console.log("\n─── Service worker ───");
  await page.goto(URL, { waitUntil: "networkidle" });
  const actif = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, etat: reg.active && reg.active.state };
  });
  ok(actif.etat === "activated", `worker activé (${actif.etat})`);
  ok(actif.scope.endsWith("/"), `portée : ${actif.scope}`);

  const version = await page.evaluate(() => new Promise((res) => {
    const ch = new MessageChannel();
    navigator.serviceWorker.controller.postMessage({ type: "VERSION" });
    navigator.serviceWorker.addEventListener("message", (e) => res(e.data && e.data.version), { once: true });
    setTimeout(() => res(null), 2500);
  }));
  ok(!!version, `version rapportée par le worker : ${version}`);

  const cache = await page.evaluate(async () => {
    const noms = await caches.keys();
    const c = await caches.open(noms[0]);
    return { noms, nb: (await c.keys()).length };
  });
  ok(cache.noms.length === 1, `un seul cache : ${cache.noms.join(", ")}`);
  ok(cache.nb >= 15, `${cache.nb} ressources pré-chargées (app + polices + icônes)`);

  // ── 3. Aucune donnée Supabase mise en cache ────────────────────────────────
  const fuites = await page.evaluate(async () => {
    const noms = await caches.keys();
    const c = await caches.open(noms[0]);
    return (await c.keys()).map(r => r.url).filter(u => u.includes("supabase") || u.includes("jsdelivr"));
  });
  ok(fuites.length === 0, `aucune requête Supabase/CDN en cache${fuites.length ? " → " + fuites[0] : ""}`);

  // ── 4. Démarrage hors-ligne ────────────────────────────────────────────────
  console.log("\n─── Hors-ligne ───");
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2000);
  const texteOff = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  ok(texteOff.length > 0 && !/ERR_INTERNET|This site can|Impossible d.accéder/i.test(texteOff),
     `l'app se charge sans réseau : « ${texteOff.slice(0, 60)} »`);
  await page.screenshot({ path: `${OUT}/pwa-hors-ligne.png` });
  await ctx.setOffline(false);

  // ── 5. LE test : une nouvelle version fait apparaître la bannière ──────────
  console.log("\n─── Bannière de mise à jour ───");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const avant = await page.locator("body").innerText();
  ok(!/MISE À JOUR DISPONIBLE/i.test(avant), "aucune bannière tant que rien n'a changé");

  // On publie une "nouvelle version" en changeant l'empreinte du worker
  writeFileSync(SW, swOriginal.replace(/const VERSION = "[^"]+"/, 'const VERSION = "999999999999"'));
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });

  await page.waitForFunction(
    () => document.body.innerText.includes("MISE À JOUR DISPONIBLE"),
    null, { timeout: 12000 }
  ).then(() => ok(true, "la bannière apparaît après publication d'une nouvelle version"))
   .catch(() => ok(false, "la bannière N'APPARAÎT PAS après une nouvelle version"));

  await page.screenshot({ path: `${OUT}/pwa-banniere.png` });

  // ── 6. Le bouton Recharger applique bien la mise à jour ───────────────────
  const versionAvant = version;
  await page.click("text=RECHARGER").catch(() => {});
  await page.waitForTimeout(3500);
  const versionApres = await page.evaluate(() => new Promise((res) => {
    if (!navigator.serviceWorker.controller) return res(null);
    navigator.serviceWorker.controller.postMessage({ type: "VERSION" });
    navigator.serviceWorker.addEventListener("message", (e) => res(e.data && e.data.version), { once: true });
    setTimeout(() => res(null), 2500);
  }));
  ok(versionApres === "999999999999",
     `après Recharger, le worker actif est la nouvelle version (${versionAvant} → ${versionApres})`);
} finally {
  writeFileSync(SW, swOriginal);   // on remet toujours le vrai sw.js
  await browser.close();
}

console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
