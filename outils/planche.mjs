// Compose une planche comparative : les trois variantes côte à côte sur le
// même écran. Trois fichiers séparés ne se comparent pas ; une planche, si.
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
const SORTIE = "/tmp/maquettes";
const VAR = process.env.VARIANTES
  ? JSON.parse(process.env.VARIANTES)
  : [["A-sable-approfondi", "A — Sable approfondi"],
     ["B-vert-ancrage",     "B — Vert d'ancrage"],
     ["C-sable-chaud",      "C — Sable chaud"]];

const b = await chromium.launch();
const ECRANS = process.env.ECRANS ? JSON.parse(process.env.ECRANS) : [
  ["1-accueil", "clair",  "Accueil · thème clair"],
  ["1-accueil", "sombre", "Accueil · thème sombre"],
  ["2b-series", "clair",  "Séance dépliée · turquoise = progression, corail = régression"],
];
for (const [ecran, theme, titre] of ECRANS) {
  const colonnes = VAR.map(([v, nom]) => {
    const f = `${SORTIE}/${v}-${theme}-${ecran}.png`;
    if (!existsSync(f)) return "";
    const b64 = readFileSync(f).toString("base64");
    return `<figure><img src="data:image/png;base64,${b64}"/><figcaption>${nom}</figcaption></figure>`;
  }).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#12100D;font-family:system-ui,sans-serif;padding:26px 22px 30px}
    h1{color:#F3EFE7;font-size:19px;margin:0 0 20px;font-weight:600;letter-spacing:-.2px}
    .g{display:flex;gap:18px;align-items:flex-start}
    figure{margin:0;flex:1}
    img{width:100%;display:block;border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.5)}
    figcaption{color:#B9B2A6;font-size:13px;margin-top:11px;text-align:center;font-weight:500}
  </style><h1>${titre}</h1><div class="g">${colonnes}</div>`;
  const ctx = await b.newContext({ viewport: { width: Number(process.env.LARGEUR || 1360), height: 900 }, deviceScaleFactor: 1.6 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: "load" });
  await p.waitForTimeout(500);
  const nom = `${SORTIE}/${process.env.PREFIXE || "planche"}-${ecran}-${theme}.png`;
  await p.locator("body").screenshot({ path: nom });
  console.log("  " + nom);
  await ctx.close();
}
await b.close();
