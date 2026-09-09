import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

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
    barre: v("--bar-bg"), barreOpaque: v("--bar-bg-opaque"),
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
  ok(t.bg === "#F1EDE6", `--bg = ${t.bg} (Forest & Sand, fond calmé en v7z)`);
  ok(t.accent === "#2D6A4F", `--accent = ${t.accent}`);
  ok(t.metaColor === "#F1EDE6", `barre d'état alignée : ${t.metaColor}`);
  ok(/252,\s*249,\s*244/.test(t.barre), `barres translucides claires : ${t.barre}`);
  await p.screenshot({ path: `${OUT}/theme-clair.png` });
  await ctx.close();
}

// ── Sombre explicite ─────────────────────────────────────────────────────────
console.log("\n─── Thème sombre ───");
{
  const { ctx, p } = await ouvrir({ mode: "sombre", systemeSombre: false });
  const t = await lire(p);
  ok(t.attr === "sombre", `data-theme = ${t.attr}`);
  ok(t.bg === "#101512", `--bg = ${t.bg}`);
  ok(t.accent === "#4FA97F", `--accent = ${t.accent} (éclairci pour rester lisible)`);
  ok(t.corpsBg === "rgb(16, 21, 18)", `fond de page réellement sombre : ${t.corpsBg}`);
  ok(t.metaColor === "#101512", `barre d'état alignée : ${t.metaColor}`);
  // Le défaut signalé le 25 août 2026 : les deux barres restaient blanches.
  ok(/24,\s*30,\s*26/.test(t.barre), `bandeau haut et barre d'onglets suivent le thème : ${t.barre}`);
  ok(/24,\s*30,\s*26/.test(t.barreOpaque), `barre d'action des feuilles aussi : ${t.barreOpaque}`);
  await p.screenshot({ path: `${OUT}/theme-sombre.png` });
  await ctx.close();
}

// ── Aucune barre ne court-circuite le thème ─────────────────────────────────
// Une variable juste ne sert à rien si un composant écrit la couleur en dur à
// côté : c'était exactement le défaut. On le vérifie sur le fichier livré.
console.log("\n─── Aucune couleur de barre écrite en dur ───");
{
  // `URL` est déjà pris plus haut par l'adresse de test : on passe par le chemin.
  const html = readFileSync(import.meta.dirname + "/../index.html", "utf8");
  // Les deux seules occurrences légitimes sont les définitions de la variable
  // elle-même, dans le bloc de thème clair. Toute autre est un composant qui
  // écrit la couleur à côté du thème.
  const toutes = (html.match(/rgba\(252,\s*249,\s*244/g) || []).length;
  const definitions = (html.match(/--bar-bg(-opaque)?:\s*rgba\(252,\s*249,\s*244/g) || []).length;
  const enDur = toutes - definitions;
  ok(definitions === 2, `la palette claire définit bien les deux variables (${definitions})`);
  ok(enDur === 0, `aucun composant n'écrit un fond de barre en dur (${enDur})`);
  // Depuis v7z, la couleur n'est plus répétée à chaque barre : elle est portée
  // une fois par le matériau `.verre`, que les barres portent en classe. Ce
  // qu'on vérifie est donc devenu : toute barre translucide passe par ce
  // matériau, et le matériau lit bien le thème.
  ok(/\.verre\s*\{[^}]*background:\s*var\(--bar-bg\)/.test(html),
     "le matériau des barres lit sa couleur dans le thème");
  ok(/\.verre\.dense\s*\{[^}]*var\(--bar-bg-opaque\)/.test(html),
     "sa variante dense aussi");
  const barres = (html.match(/className: "verre/g) || []).length;
  ok(barres >= 5, `les ${barres} barres portent le matériau plutôt qu'un fond à elles`);
  // Un flou imposé à quelqu'un qui a demandé de ne pas en avoir est un défaut
  // d'accessibilité, pas un choix esthétique.
  ok(/prefers-reduced-transparency/.test(html),
     "« réduire la transparence » rend les barres opaques");
}

// ── Automatique : suit le téléphone ──────────────────────────────────────────
console.log("\n─── Thème automatique ───");
{
  const { ctx, p } = await ouvrir({ mode: null, systemeSombre: true });
  const t = await lire(p);
  ok(!t.attr, "aucun data-theme posé (mode auto)");
  ok(t.bg === "#101512", `téléphone en sombre → --bg = ${t.bg}`);
  await ctx.close();
}
{
  const { ctx, p } = await ouvrir({ mode: null, systemeSombre: false });
  const t = await lire(p);
  ok(t.bg === "#F1EDE6", `téléphone en clair → --bg = ${t.bg}`);
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

// ── Le bouton d'action principale, dans les deux thèmes ─────────────────────
// Il portait un dégradé teal qui ne donnait que 3,74:1 en blanc dessus — sous
// le seuil, sur le bouton le plus cliqué de l'app. Ce contrôle empêche qu'une
// prochaine retouche de palette le refasse passer dessous sans qu'on le voie.
console.log("\n─── Lisibilité du bouton principal ───");
for (const mode of ["clair", "sombre"]) {
  const { ctx, p } = await ouvrir({ mode, systemeSombre: mode === "sombre" });
  const c = await p.evaluate(() => {
    const lum = (rgb) => {
      const [r, g, bl] = rgb.match(/\d+/g).map(Number).map(v => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const cs = getComputedStyle(document.documentElement);
    const fond = cs.getPropertyValue("--btn-primaire").trim();
    const texte = cs.getPropertyValue("--btn-primaire-tx").trim();
    const d = document.createElement("div");
    d.style.cssText = `background:${fond};color:${texte}`;
    document.body.appendChild(d);
    const s = getComputedStyle(d);
    const l1 = lum(s.backgroundColor), l2 = lum(s.color);
    d.remove();
    return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
  });
  ok(c >= 4.5, `libellé sur bouton principal en ${mode} : ${c}:1`);
  await ctx.close();
}

// Et il ne se redessine plus à la main à chaque écran : deux boutons
// principaux doivent être la MÊME couleur d'un écran à l'autre.
console.log("\n─── Un seul bouton principal, pas vingt-cinq ───");
{
  const html = readFileSync(import.meta.dirname + "/../index.html", "utf8");
  // La seule écriture légitime est la définition de la variable de marque, qui
  // sert au bandeau de mise à jour et aux avatars — pas aux boutons.
  const toutes = (html.match(/linear-gradient\(135deg, ?#064E3B[^)]*0D9488/g) || []).length;
  const definition = (html.match(/--degrade-marque:\s*linear-gradient/g) || []).length;
  ok(definition === 1, `le dégradé de marque est défini une fois (${definition})`);
  ok(toutes - definition === 0, `plus aucun bouton ne le redessine à la main (${toutes - definition})`);
  const via = (html.match(/var\(--btn-primaire\)/g) || []).length;
  ok(via >= 20, `les ${via} boutons principaux lisent la même variable`);
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
