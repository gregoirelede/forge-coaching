import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });
const URL = "http://127.0.0.1:8099/index.html";
const OUT = CAPTURES;

const STUB = `
window.supabase = { createClient: function (url, key, opts) {
  window.__capture = { url: url, opts: opts };
  return { auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }) },
    from(){return this}, select(){return this}, eq(){return this}, single: async()=>({data:null}) };
}};`;

const browser = await chromium.launch();
let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

async function scenario(nom, { stub }) {
  console.log(`\n─── ${nom} ───`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [], externes = [];
  page.on("pageerror", e => errs.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  page.on("request", r => { const u = r.url(); if (!u.startsWith("http://127.0.0.1") && !u.startsWith("data:")) externes.push(u); });

  await page.route("**/cdn.jsdelivr.net/**", r =>
    stub ? r.fulfill({ status: 200, contentType: "application/javascript", body: STUB }) : r.abort());

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const txt = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  return { page, ctx, txt, errs, externes };
}

// ── 1. Réseau coupé : doit afficher l'erreur, PAS le mode démo ────────────────
{
  const r = await scenario("Réseau coupé — le mode démo ne doit plus s'afficher", { stub: false });
  await r.page.screenshot({ path: `${OUT}/s1-erreur-reseau.png` });
  ok(/CONNEXION IMPOSSIBLE/i.test(r.txt), "écran « CONNEXION IMPOSSIBLE » affiché");
  ok(!/BONJOUR GREG|JOUR DE REPOS/i.test(r.txt), "les données de démo ne fuitent plus vers un vrai coaché");
  ok(/Réessayer/i.test(r.txt), "bouton Réessayer présent");
  await r.ctx.close();
}

// ── 2. Démarrage normal ───────────────────────────────────────────────────────
{
  const r = await scenario("Démarrage normal", { stub: true });
  await r.page.screenshot({ path: `${OUT}/s2-login.png` });
  const cap = await r.page.evaluate(() => window.__capture);
  ok(/CODE D'ACCÈS/i.test(r.txt), "écran de connexion affiché");
  ok(/EX : MDUPONT27/i.test(await r.page.locator("input").getAttribute("placeholder") || ""), "placeholder « EX : MDUPONT27 »");
  ok(cap?.opts?.auth?.persistSession === true, `persistSession = ${cap?.opts?.auth?.persistSession}`);
  ok(cap?.url === "https://xlquzhwmdyyiugtezasg.supabase.co", "URL Supabase sans /rest/v1/");
  ok(r.errs.length === 0, `aucune erreur JS${r.errs.length ? " → " + r.errs[0].slice(0,140) : ""}`);

  // aucune requête vers l'extérieur hormis le CDN Supabase (intercepté)
  const horsCdn = r.externes.filter(u => !u.includes("cdn.jsdelivr.net"));
  ok(horsCdn.length === 0, `aucun appel externe (Google Fonts éliminé)${horsCdn.length ? " → " + horsCdn[0] : ""}`);

  // polices réellement chargées et appliquées
  const fonts = await r.page.evaluate(async () => {
    await document.fonts.ready;
    return { chargees: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family + " " + f.weight),
             titre: getComputedStyle(document.querySelector("div")).fontFamily };
  });
  ok(fonts.chargees.length > 0, `polices auto-hébergées chargées : ${fonts.chargees.slice(0,3).join(", ")}`);
  await r.ctx.close();
}

// ── 3. Icône et métadonnées servies ───────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const icon = await p.goto("http://127.0.0.1:8099/icons/apple-touch-icon.png");
  ok(icon.status() === 200, `apple-touch-icon.png servi (HTTP ${icon.status()})`);
  // Requête directe plutôt que navigation : ce serveur de test renvoie les
  // .woff2 en octet-stream, ce que Chromium traite comme un téléchargement.
  const font = await p.request.get("http://127.0.0.1:8099/fonts/bebasneue-400-latin.woff2");
  ok(font.status() === 200, `police woff2 servie (HTTP ${font.status()})`);
  await ctx.close();
}

await browser.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
