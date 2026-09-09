// ═══════════════════════════════════════════════════════════════════════════
//  L'interface : ce qui a été mis en place en v7z, et qui doit le rester.
//
//  Une charte visuelle ne tient pas toute seule. Elle s'érode ligne par ligne,
//  chaque fois qu'un écran redessine à la main ce que le thème possède déjà —
//  et personne ne le voit avant que l'app ait de nouveau l'air « assemblée ».
//  Ce que cette série vérifie n'est donc pas « c'est joli » (aucune machine ne
//  le dira) mais quelque chose de vérifiable : que les écrans lisent le système
//  au lieu de le recopier.
//
//  Chaque contrôle correspond à un défaut RÉELLEMENT trouvé en septembre 2026,
//  pas à une règle inventée après coup.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });
const ADRESSE = "http://127.0.0.1:8099/index.html";
const HTML = readFileSync(import.meta.dirname + "/../index.html", "utf8");

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const STUB = `window.supabase = { createClient: () => ({ auth: {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }) },
  from(){return this}, select(){return this}, eq(){return this}, single: async()=>({data:null}) }) };`;

// ── 1. Le système est déclaré une fois, dans le <head> ──────────────────────
//
//  Une @keyframes déclarée dans le <style> d'un composant n'existe pas tant que
//  ce composant n'est pas monté : c'est ce qui laissait le logo du démarrage
//  parfaitement immobile (v7y). Le même piège a une seconde face, trouvée en
//  v7z : à spécificité égale, un <style> de composant est parsé APRÈS le <head>
//  et GAGNE. Les règles de toucher du thème étaient donc écrasées en silence
//  par les anciennes, sans qu'aucune erreur ne le signale.
console.log("\n─── Le système vit dans le <head>, et nulle part ailleurs ───");
{
  const tete = HTML.slice(0, HTML.indexOf("</head>"));
  for (const regle of [".verre", ".sheet", ".poignee", ".pressable", ".rail", ".squelette"]) {
    ok(tete.includes(regle + " {") || tete.includes(regle + "{"),
       `${regle} est défini dans le <head>`);
  }
  // Aucun composant ne redéfinit une règle que le thème possède déjà.
  const corps = HTML.slice(HTML.indexOf("</head>"));
  for (const regle of [".pressable{", ".quick-card{", ".sheet{", ".sheet-backdrop{",
                       ".page-forward{", ".fade-in{"]) {
    const n = (corps.match(new RegExp(regle.replace(/[.{]/g, "\\$&"), "g")) || []).length;
    ok(n === 0, `aucun composant ne redéfinit ${regle.slice(0, -1)} (${n})`);
  }
}

// ── 2. Les feuilles ─────────────────────────────────────────────────────────
//
//  Leur chrome était recopié inline 14 fois : fond, rayon, ombre, voile. Une
//  valeur corrigée à un endroit et pas aux treize autres, c'est exactement ce
//  qui donne l'impression que l'app a été assemblée par morceaux.
console.log("\n─── Les feuilles partagent un seul chrome ───");
{
  const feuilles  = (HTML.match(/className: "sheet"/g) || []).length;
  const voiles    = (HTML.match(/className: "sheet-backdrop"/g) || []).length;
  const poignees  = (HTML.match(/className: "poignee"/g) || []).length;
  ok(feuilles >= 14, `${feuilles} feuilles passent par la classe`);
  ok(voiles === feuilles, `chaque feuille a son voile (${voiles} pour ${feuilles})`);
  ok(poignees === feuilles, `et sa poignée (${poignees} pour ${feuilles})`);
  const enDur = (HTML.match(/borderRadius: "28px 28px 0 0"/g) || []).length;
  ok(enDur === 0, `aucune feuille ne redessine son rayon à la main (${enDur})`);
  // Le voile lit le thème : en sombre, un voile clair éclairerait la page.
  ok(/--scrim:/.test(HTML), "le voile est une variable de thème, pas une couleur en dur");
}

// ── 3. Une même clé de style écrite deux fois dans le même objet ────────────
//
//  La seconde gagne, en silence. Onze lignes en portaient — séquelle d'un
//  passage mécanique sur les ombres. Rien ne plante, la valeur qu'on croit
//  poser n'est simplement jamais appliquée.
console.log("\n─── Aucune clé de style écrite deux fois ───");
{
  const source = readFileSync(import.meta.dirname + "/../src/training-app.jsx", "utf8");
  const fautives = source.split("\n")
    .map((l, i) => ({ n: i + 1, l }))
    .filter(({ l }) => ["boxShadow", "borderRadius", "background:"].some(
      (c) => (l.match(new RegExp("(?<![A-Za-z])" + c.replace(":", "") + ":", "g")) || []).length > 1));
  ok(fautives.length === 0,
     `aucune ligne ne pose deux fois la même clé (${fautives.map(f => f.n).join(", ") || "aucune"})`);
}

// ── 4. Le bouton principal ──────────────────────────────────────────────────
//  Voir test-theme.mjs pour son contraste. Ici : qu'il soit unique.
console.log("\n─── Le bouton principal est le même partout ───");
{
  const via = (HTML.match(/var\(--btn-primaire\)/g) || []).length;
  ok(via >= 20, `${via} boutons lisent la même variable`);
}

// ── 5. Ce que le navigateur rend vraiment ───────────────────────────────────
console.log("\n─── Mesuré dans le navigateur ───");
{
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: STUB }));
  await p.goto(ADRESSE, { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);

  // Les animations demandées existent toutes. C'est le contrôle qui a rattrapé
  // le logo figé de l'écran de démarrage.
  const anim = await p.evaluate(() => {
    const definies = new Set();
    for (const f of document.styleSheets) {
      let regles; try { regles = f.cssRules; } catch { continue; }
      for (const r of regles) if (r.type === CSSRule.KEYFRAMES_RULE) definies.add(r.name);
    }
    const demandees = new Set();
    for (const el of document.querySelectorAll("*")) {
      const n = getComputedStyle(el).animationName;
      if (n && n !== "none") n.split(",").forEach(x => demandees.add(x.trim()));
    }
    return { manquantes: [...demandees].filter(n => !definies.has(n)) };
  });
  ok(anim.manquantes.length === 0,
     `aucune animation demandée dans le vide (${anim.manquantes.join(", ") || "aucune"})`);

  // Les polices auto-hébergées sont réellement appliquées, pas juste déclarées.
  const police = await p.evaluate(async () => {
    await document.fonts.ready;
    const el = [...document.querySelectorAll("*")]
      .find(e => e.children.length === 0 && /Entre dans ton espace/.test(e.textContent));
    return el ? getComputedStyle(el).fontFamily : null;
  });
  ok(/DM Sans/.test(police || ""), `le texte courant est bien en DM Sans (${police})`);

  await p.screenshot({ path: `${CAPTURES}interface-connexion.png` });
  await ctx.close();
  await b.close();
}

// ── 6. Les rangées qui défilent ─────────────────────────────────────────────
//
//  Défaut trouvé en mesurant, pas en regardant : `scroll-snap-align: start`
//  sans `scroll-padding` fait démarrer la rangée décalée de la marge de page.
//  Le premier onglet de la fiche coaché s'ouvrait collé au bord de l'écran,
//  `scrollLeft` à 18 au lieu de 0.
console.log("\n─── L'accrochage ne mange pas la marge de page ───");
{
  const tete = HTML.slice(0, HTML.indexOf("</head>"));
  const snap = tete.match(/scroll-snap-type[^;}]*/g) || [];
  ok(snap.length > 0, "l'accrochage existe");
  const bloc = tete.slice(tete.indexOf(".rail.cartes"), tete.indexOf(".rail.cartes") + 200);
  ok(/scroll-padding-left/.test(bloc),
     "et il vient toujours avec son scroll-padding");
  ok(!/^\.rail \{[^}]*scroll-snap-type/m.test(tete),
     "la rangée générique, elle, n'accroche pas — ses onglets n'ont pas à se caler");
}

console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
