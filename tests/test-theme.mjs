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
  ok(t.bg === "#F0E7D6", `--bg = ${t.bg} (fond approfondi, v8e)`);
  ok(t.accent === "#017369", `--accent = ${t.accent} (turquoise du bouclier)`);
  ok(t.metaColor === "#F0E7D6", `barre d'état alignée : ${t.metaColor}`);
  // Depuis v8c les barres reviennent au sable : le vert plein en bas de
  // l'écran gênait à l'usage. La couleur de marque vit dans le hero et les
  // accents, pas dans le chrome.
  ok(/254,\s*246,\s*231/.test(t.barre), `bandeau et barre d'onglets en sable : ${t.barre}`);
  await p.screenshot({ path: `${OUT}/theme-clair.png` });
  await ctx.close();
}

// ── Sombre explicite ─────────────────────────────────────────────────────────
console.log("\n─── Thème sombre ───");
{
  const { ctx, p } = await ouvrir({ mode: "sombre", systemeSombre: false });
  const t = await lire(p);
  ok(t.attr === "sombre", `data-theme = ${t.attr}`);
  ok(t.bg === "#0A130E", `--bg = ${t.bg}`);
  ok(t.accent === "#01CCBC", `--accent = ${t.accent} (éclairci pour rester lisible)`);
  ok(t.corpsBg === "rgb(10, 19, 14)", `fond de page réellement sombre : ${t.corpsBg}`);
  ok(t.metaColor === "#0A130E", `barre d'état alignée : ${t.metaColor}`);
  // Le défaut signalé le 25 août 2026 : les deux barres restaient blanches.
  ok(/18,\s*31,\s*25/.test(t.barre), `bandeau haut et barre d'onglets suivent le thème : ${t.barre}`);
  ok(/18,\s*31,\s*25/.test(t.barreOpaque), `barre d'action des feuilles aussi : ${t.barreOpaque}`);
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
  // La teinte des barres change avec la palette : on la LIT dans le thème
  // plutôt que de l'épingler, sinon ce contrôle casse à chaque refonte alors
  // qu'il ne parle pas de couleur mais d'architecture.
  const teinte = (html.match(/--bar-bg:\s*rgba\(([\d\s,]+?),\s*[\d.]+\)/) || [])[1];
  ok(!!teinte, `la teinte des barres est lisible dans le thème (${teinte})`);
  const motif = teinte.split(",").map(n => n.trim()).join(",\\s*");
  const toutes = (html.match(new RegExp("rgba\\(" + motif, "g")) || []).length;
  const definitions = (html.match(new RegExp("--bar-bg(-opaque)?:\\s*rgba\\(" + motif, "g")) || []).length;
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
  ok(t.bg === "#0A130E", `téléphone en sombre → --bg = ${t.bg}`);
  await ctx.close();
}
{
  const { ctx, p } = await ouvrir({ mode: null, systemeSombre: false });
  const t = await lire(p);
  ok(t.bg === "#F0E7D6", `téléphone en clair → --bg = ${t.bg}`);
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
// ── Le turquoise fort, et pourquoi il existe ────────────────────────────────
//  Un petit texte doit tenir 4,5:1, un gros chiffre seulement 3:1. Les faire
//  partager une couleur bride les seconds au plafond des premiers — c'est
//  exactement ce qui rendait l'app terne. Deux jetons, donc, et le second doit
//  être RÉELLEMENT plus vif : sans ce contrôle, une retouche les réaligne sans
//  que personne ne le voie.
console.log("\n─── Le turquoise fort est bien plus vif que celui du texte ───");
for (const mode of ["clair", "sombre"]) {
  const { ctx, p } = await ouvrir({ mode, systemeSombre: mode === "sombre" });
  const r = await p.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const lire = (n) => {
      const d = document.createElement("div");
      d.style.color = cs.getPropertyValue(n).trim();
      document.body.appendChild(d);
      const m = getComputedStyle(d).color.match(/\d+/g).map(Number);
      d.remove();
      return m;
    };
    // Vivacité : chroma perçu, pondéré par la proximité au pic de clarté.
    const viv = ([r0, g0, b0]) => {
      const mx = Math.max(r0, g0, b0) / 255, mn = Math.min(r0, g0, b0) / 255;
      const L = (mx + mn) / 2, S = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * L - 1));
      return Math.round(S * (1 - Math.abs(L - 0.62) / 0.62) * 1000);
    };
    return { accent: viv(lire("--accent")), vif: viv(lire("--accent-vif")) };
  });
  ok(r.vif >= r.accent,
     `${mode} : --accent-vif (${r.vif}) au moins aussi vif que --accent (${r.accent})`);
  await ctx.close();
}

console.log("\n─── Un seul bouton principal, pas vingt-cinq ───");
{
  const html = readFileSync(import.meta.dirname + "/../index.html", "utf8");
  // La seule écriture légitime est la définition de la variable de marque, qui
  // sert au bandeau de mise à jour et aux avatars — pas aux boutons.
  const toutes = (html.match(/linear-gradient\(135deg, ?#064E3B[^)]*0D9488/g) || []).length;
  // Une seule écriture est légitime : la variable de marque, qui sert au
  // bouclier, aux avatars et au bandeau de mise à jour. Depuis la v8f le hero
  // ne la porte PLUS — il a son propre dégradé, plus vif, dont le point le
  // plus clair tombe hors des textes (voir le contrôle d'éclat plus bas).
  const definition = (html.match(/--degrade-marque:\s*linear-gradient/g) || []).length;
  const heroFond = (html.match(/--hero-fond:\s*linear-gradient\(135deg, ?#064E3B[^)]*0D9488/g) || []).length;
  ok(definition === 1, `le dégradé de marque est défini une fois (${definition})`);
  ok(toutes - definition - heroFond === 0,
     `aucun bouton ne le redessine à la main (${toutes - definition - heroFond})`);
  const via = (html.match(/var\(--btn-primaire\)/g) || []).length;
  ok(via >= 20, `les ${via} boutons principaux lisent la même variable`);
}

console.log("\n─── Les cartes portent le sable, elles ne sont pas blanches ───");
{
  // v8e. Le ton des cartes était demandé à 0,995 de clarté — à un cheveu du
  // blanc, où le sRGB ne sait plus tenir de couleur. Le convertisseur rabotait
  // 80 % du chroma SANS RIEN DIRE, et les cartes sortaient blanches : 43 % de
  // l'écran, la plus grande surface de l'app. Ce n'était pas une décision.
  const theme = readFileSync(import.meta.dirname + "/../src/theme.css", "utf8");
  const val = (n) => (theme.match(new RegExp("\\" + n + ":\\s*(#[0-9A-Fa-f]{6})")) || [])[1];
  // Chroma perçu, approché en HSL : suffisant pour distinguer « beige » de « blanc ».
  const chroma = (h) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2;
    return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * L - 1));
  };
  const carte = val("--surface");
  ok(chroma(carte) > 0.25,
     `la carte porte réellement le sable : ${carte}, saturation ${chroma(carte).toFixed(3)}`);
  // Et elle doit rester DÉTACHÉE de son fond : réchauffer une carte la
  // rapproche du fond, d'où le fond descendu d'autant.
  const lum = (h) => { const c = [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255)
      .map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
    return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]; };
  const fond = val("--bg");
  const sep = (lum(carte) + 0.05) / (lum(fond) + 0.05);
  ok(sep >= 1.10, `la carte se détache encore du fond : ${sep.toFixed(3)}:1 (seuil 1,06)`);
}

console.log("\n─── Les deux thèmes ont le même éclat ───");
{
  // v8d. Le hero sombre portait #04332715 — un hex à HUIT chiffres, donc
  // #043327 à 8 % d'opacité. CSS parfaitement valide, aucune erreur : la carte
  // se dissolvait dans la page et le thème sombre tombait à 1,1 % de pixels
  // vifs contre 17,5 % en clair. Rien dans la palette ne le laissait voir.
  const theme = readFileSync(import.meta.dirname + "/../src/theme.css", "utf8");
  const huit = theme.match(/#[0-9a-fA-F]{8}\b/g) || [];
  ok(huit.length === 0,
     `aucun hex à 8 chiffres dans le thème — l'alpha caché s'y glisse (${huit.join(", ") || "aucun"})`);

  const fonds = [...theme.matchAll(/--hero-fond:\s*([^;]+);/g)].map(m => m[1].trim());
  ok(fonds.length >= 2, `le hero a un fond dans chaque thème (${fonds.length})`);
  ok(new Set(fonds).size === 1,
     "le hero porte le MÊME dégradé en clair et en sombre — sinon la marque est double");
}

console.log("\n─── Le hero garde son éclat ───");
{
  // v8f. L'éclat du hero a été ACHETÉ : huit dégradés rendus, contraste relevé
  // au pixel aux cinq positions de texte, pour trouver le plus vif qui tienne
  // encore le seuil. La vivacité est passée de 86 à 124. Sans ce contrôle, une
  // retouche du thème la reperdrait sans que personne ne s'en aperçoive —
  // c'est exactement ce qui s'était produit entre la v7z et la v8b.
  const theme = readFileSync(import.meta.dirname + "/../src/theme.css", "utf8");
  const fond = (theme.match(/--hero-fond:\s*([^;]+);/) || [])[1] || "";
  const bornes = fond.match(/#[0-9A-Fa-f]{6}/g) || [];
  ok(bornes.length >= 3,
     `le dégradé du hero a au moins trois bornes — deux ne suffisent pas à placer le pic (${bornes.length})`);
  // Vivacité approchée en HSL : chroma pondéré par la proximité au pic de clarté.
  const viv = (h) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2;
    const S = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * L - 1));
    return Math.round(S * (1 - Math.abs(L - 0.62) / 0.62) * 1000);
  };
  const pic = Math.max(...bornes.map(viv));
  ok(pic >= 480, `la borne la plus vive du hero reste éclatante (${pic})`);
  // Et la borne la plus SOMBRE doit le rester : c'est elle qui porte les textes.
  const creux = Math.min(...bornes.map(h => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  }));
  ok(creux < 0.22, `le départ du dégradé reste sombre, pour porter les textes (${creux.toFixed(3)})`);
}

console.log("\n─── Un voile sur fond soutenu se fait en noir, jamais en blanc ───");
{
  // v8d. La pastille « S17 » portait rgba(255,255,255,0.18) : un voile blanc
  // ÉCLAIRCIT le dégradé sous un texte blanc. Mesuré au pixel rendu : 3,74:1,
  // sous le seuil. Le même voile en noir remonte à 7,06:1.
  const src = readFileSync(import.meta.dirname + "/../src/training-app.jsx", "utf8");
  const debut = src.indexOf('className="hero-card');
  ok(debut > 0, "la carte du jour est bien dans la source");
  const hero = src.slice(debut, debut + 3000);
  const blancs = hero.match(/rgba\(255\s*,\s*255\s*,\s*255\s*,\s*0?\.\d+\)/g) || [];
  ok(blancs.length === 0,
     `aucun voile blanc écrit en dur dans le hero (${blancs.join(", ") || "aucun"})`);
  ok(/var\(--hero-pastille\)/.test(hero),
     "la pastille de semaine lit son jeton plutôt qu'une couleur en dur");
  const theme = readFileSync(import.meta.dirname + "/../src/theme.css", "utf8");
  const voiles = [...theme.matchAll(/--hero-pastille:\s*rgba\((\d+)/g)].map(m => Number(m[1]));
  ok(voiles.length >= 2 && voiles.every(v => v === 0),
     `le voile est noir dans les ${voiles.length} thèmes (${voiles.join(", ")})`);
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
