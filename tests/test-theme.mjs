import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });
const URL = "http://127.0.0.1:8099/index.html";
const OUT = CAPTURES;
const STUB = `window.supabase = { createClient: () => ({ auth: {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }) },
  from(){return this}, select(){return this}, eq(){return this}, single: async()=>({data:null}) }) };`;

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const b = await chromium.launch();

async function ouvrir({ mode, systemeSombre }) {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    colorScheme: systemeSombre ? "dark" : "light",
  });
  const p = await ctx.newPage();
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: STUB }));
  if (mode) await p.addInitScript(m => localStorage.setItem("forge_theme", m), mode);
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);
  return { ctx, p };
}

const lire = (p) => p.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  return {
    attr: document.documentElement.getAttribute("data-theme"),
    bg: v("--bg"), text: v("--text"), accent: v("--accent"),
    corpsBg: getComputedStyle(document.body).backgroundColor,
    metaColor: meta && meta.getAttribute("content"),
  };
});

// ── Clair explicite ──────────────────────────────────────────────────────────
console.log("\n─── Thème clair ───");
{
  const { ctx, p } = await ouvrir({ mode: "clair", systemeSombre: true });
  const t = await lire(p);
  ok(t.attr === "clair", `data-theme = ${t.attr}`);
  ok(t.bg === "#F5F1EB", `--bg = ${t.bg} (charte Forest & Sand d'origine)`);
  ok(t.accent === "#2D6A4F", `--accent = ${t.accent}`);
  ok(t.metaColor === "#F5F1EB", `barre d'état alignée : ${t.metaColor}`);
  await p.screenshot({ path: `${OUT}/theme-clair.png` });
  await ctx.close();
}

// ── Sombre explicite ─────────────────────────────────────────────────────────
console.log("\n─── Thème sombre ───");
{
  const { ctx, p } = await ouvrir({ mode: "sombre", systemeSombre: false });
  const t = await lire(p);
  ok(t.attr === "sombre", `data-theme = ${t.attr}`);
  ok(t.bg === "#141815", `--bg = ${t.bg}`);
  ok(t.accent === "#4FA97F", `--accent = ${t.accent} (éclairci pour rester lisible)`);
  ok(t.corpsBg === "rgb(20, 24, 21)", `fond de page réellement sombre : ${t.corpsBg}`);
  ok(t.metaColor === "#141815", `barre d'état alignée : ${t.metaColor}`);
  await p.screenshot({ path: `${OUT}/theme-sombre.png` });
  await ctx.close();
}

// ── Automatique : suit le téléphone ──────────────────────────────────────────
console.log("\n─── Thème automatique ───");
{
  const { ctx, p } = await ouvrir({ mode: null, systemeSombre: true });
  const t = await lire(p);
  ok(!t.attr, "aucun data-theme posé (mode auto)");
  ok(t.bg === "#141815", `téléphone en sombre → --bg = ${t.bg}`);
  await ctx.close();
}
{
  const { ctx, p } = await ouvrir({ mode: null, systemeSombre: false });
  const t = await lire(p);
  ok(t.bg === "#F5F1EB", `téléphone en clair → --bg = ${t.bg}`);
  await ctx.close();
}

// ── Contraste du texte sur le fond, en sombre ───────────────────────────────
console.log("\n─── Lisibilité ───");
{
  const { ctx, p } = await ouvrir({ mode: "sombre", systemeSombre: false });
  const c = await p.evaluate(() => {
    const lum = (rgb) => {
      const [r, g, bl] = rgb.match(/\d+/g).map(Number).map(v => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const el = [...document.querySelectorAll("div")].find(d => /FORGE COACHING/.test(d.textContent) && d.children.length === 0);
    const cs = getComputedStyle(el);
    const fond = getComputedStyle(document.body).backgroundColor;
    const l1 = lum(cs.color), l2 = lum(fond);
    return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 10) / 10;
  });
  ok(c >= 4.5, `contraste titre/fond en sombre : ${c}:1 (seuil accessibilité 4.5:1)`);
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
