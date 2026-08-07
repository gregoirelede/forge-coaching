// ═══════════════════════════════════════════════════════════════════════════════
//  FORGE COACHING — SCRIPT DE BUILD
//
//  Transforme la source  src/training-app.jsx  en  index.html  (le fichier servi
//  par GitHub Pages). Le gabarit HTML ci-dessous est copié à l'identique de la
//  version en production : c'est la seule qui a fait ses preuves sur iPhone.
//
//  UTILISATION
//    npm install          (une seule fois, installe esbuild)
//    node build.mjs       construit index.html et lance les contrôles
//
//    node build.mjs --verifier-gabarit
//                         ne construit rien : vérifie que le gabarit HTML de ce
//                         script redonne exactement l'index.html actuel. À lancer
//                         si un doute apparaît sur l'enveloppe HTML.
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { transform } from "esbuild";

const SRC  = "src/training-app.jsx";
const OUT  = "index.html";
const SUPA = "https://xlquzhwmdyyiugtezasg.supabase.co";

// ── Gabarit HTML — identique à la production, ne pas retoucher sans raison ─────
const ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
  + "<defs><linearGradient id='g' x1='0%25' y1='100%25' x2='100%25' y2='0%25'>"
  + "<stop offset='0%25' stop-color='%23064E3B'/><stop offset='100%25' stop-color='%232DD4BF'/>"
  + "</linearGradient></defs>"
  + "<path d='M32 3 L58 12 L58 37 C58 51 32 62 32 62 C32 62 6 51 6 37 L6 12 Z' fill='url(%23g)'/></svg>";

export function assembleHtml(appJs) {
  const reactJs    = readFileSync("vendor/react.production.min.js", "utf8");
  const reactDomJs = readFileSync("vendor/react-dom.production.min.js", "utf8");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"/>
  <title>Forge Coaching</title>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
  <meta name="description" content="Forge Coaching — ton espace d'entraînement personnel. Forge ton corps. Forge ta discipline."/>
  <meta name="theme-color" content="#F5F1EB"/>
  <link rel="icon" type="image/svg+xml" href="${ICON}"/>
  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png"/>
  <link rel="manifest" href="manifest.webmanifest"/>
  <style>
@font-face { font-family: 'Bebas Neue'; font-style: normal; font-weight: 400; font-display: swap; src: url('fonts/bebasneue-400-latin-ext.woff2') format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Bebas Neue'; font-style: normal; font-weight: 400; font-display: swap; src: url('fonts/bebasneue-400-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 300; font-display: swap; src: url('fonts/dmsans-300-latin-ext.woff2') format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 300; font-display: swap; src: url('fonts/dmsans-300-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 400; font-display: swap; src: url('fonts/dmsans-400-latin-ext.woff2') format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 400; font-display: swap; src: url('fonts/dmsans-400-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 500; font-display: swap; src: url('fonts/dmsans-500-latin-ext.woff2') format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 500; font-display: swap; src: url('fonts/dmsans-500-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 600; font-display: swap; src: url('fonts/dmsans-600-latin-ext.woff2') format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 600; font-display: swap; src: url('fonts/dmsans-600-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 700; font-display: swap; src: url('fonts/dmsans-700-latin-ext.woff2') format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 700; font-display: swap; src: url('fonts/dmsans-700-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 800; font-display: swap; src: url('fonts/dmsans-800-latin-ext.woff2') format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 800; font-display: swap; src: url('fonts/dmsans-800-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
* { box-sizing: border-box; margin: 0; padding: 0; } body { background: #F5F1EB; } #root { min-height: 100vh; }</style>
</head>
<body>
  <div id="root"></div>
  <script>${reactJs}</script>
  <script>${reactDomJs}</script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.1/dist/umd/supabase.min.js"></script>
  <script>window.supabaseJs = window.supabase;</script>
  <script>
${appJs}
const _root = ReactDOM.createRoot(document.getElementById("root"));
_root.render(React.createElement(ForgeCoachingApp));
  </script>
</body>
</html>`;
}

// ── Les 4 transformations obligatoires (Partie E du CLAUDE.md) ────────────────
// Chacune est vérifiée : si la source a changé au point qu'une regex ne matche
// plus, le build s'arrête avec un message clair plutôt que de produire un
// index.html cassé (écran blanc en production).
function transformerSource(source) {
  let code = source;

  // 1 — la ligne d'import React devient un destructuring de la variable globale
  code = code.replace(
    /^import\s*\{[^}]*\}\s*from\s*["']react["'];?\s*$/m,
    "const { useState, useEffect, useCallback, useMemo, useRef } = React;"
  );
  if (/from\s*["']react["']/.test(code)) {
    stop("Transformation 1 : la ligne d'import React n'a pas été remplacée.\n"
       + "   Vérifie la première ligne de " + SRC + " : elle doit ressembler à\n"
       + '   import { useState, useEffect, ... } from "react";');
  }

  // 2 — getSupabase() utilise le client UMD du CDN, jamais un import dynamique
  //
  //  ATTENTION — le remplacement ci-dessous n'est PAS celui de la Partie E du
  //  CLAUDE.md. Celui du CLAUDE.md perdait deux choses essentielles, vérifiées
  //  par comparaison avec le fichier réellement en production (voir Partie O) :
  //    · auth: { persistSession: true, autoRefreshToken: true }
  //      sans quoi les coachés seraient déconnectés à chaque fermeture de l'app
  //    · le garde-fou if (!isSupabaseConfigured) return null;
  //      qui permet à l'app de démarrer en mode démo sans base
  //  Le bloc ci-dessous reproduit la production à l'identique.
  code = code.replace(
    /let\s+_supabase\s*=\s*null,\s*_supabasePromise\s*=\s*null;[\s\S]*?return\s+_supabasePromise;\s*\}/m,
    `let _supabase = null;
async function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (_supabase) return _supabase;
  _supabase = window.supabaseJs.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _supabase;
}`
  );
  if (!code.includes("window.supabaseJs.createClient")) {
    stop("Transformation 2 : getSupabase() n'a pas été réécrit.\n"
       + "   L'app planterait au démarrage (écran blanc). Regarde le bloc\n"
       + "   getSupabase dans " + SRC + " : il doit commencer par\n"
       + "   let _supabase = null, _supabasePromise = null;\n"
       + "   et se terminer par return _supabasePromise;");
  }
  if (!code.includes("persistSession: true")) {
    stop("Transformation 2 : la persistance de session a disparu.\n"
       + "   Sans persistSession, chaque coaché serait déconnecté à la fermeture\n"
       + "   de l'app. NE PAS déployer.");
  }
  if (!code.includes("if (!isSupabaseConfigured) return null;")) {
    stop("Transformation 2 : le garde-fou isSupabaseConfigured a disparu.");
  }
  if (/import\s*\(/.test(code)) {
    stop("Transformation 2 : il reste un import() dynamique dans le code.\n"
       + "   C'est le piège n°1 de la Partie C — écran blanc silencieux.");
  }

  // 3 — pas d'export : le composant doit rester accessible globalement
  code = code.replace("export default function ForgeCoachingApp()", "function ForgeCoachingApp()");
  if (code.includes("export default") || /^export\s/m.test(code)) {
    stop("Transformation 3 : il reste un export dans le code.\n"
       + "   La ligne attendue est : export default function ForgeCoachingApp()");
  }

  // 4 — l'URL Supabase ne doit jamais porter le suffixe /rest/v1/
  code = code.replaceAll(SUPA + "/rest/v1/", SUPA);

  return code;
}

// ── Contrôles obligatoires après build (Partie E) ─────────────────────────────
function controler(html) {
  const n = (s) => html.split(s).length - 1;
  const attendus = [
    ["React.createElement", ">", 0],
    ["esm.sh", "=", 0],
    ["export default", "=", 0],
    ['type="text/babel"', "=", 0],
    ["window.supabaseJs", ">", 0],
    ["/rest/v1/", "=", 0],
    ["function CoachApp", ">", 0],
    ["function AuthenticatedApp", ">", 0],
    ["PERIODIZATION_TEMPLATES", ">", 0],
    ["ParcoursPage", ">", 0],
    ["PhaseTimeline", ">", 0],
    ["NutritionPage", ">", 0],
    ["CoachRecipesPage", ">", 0],
  ];

  let echecs = 0;
  console.log("\nContrôles :");
  for (const [motif, op, seuil] of attendus) {
    const c = n(motif);
    const ok = op === ">" ? c > seuil : c === seuil;
    if (!ok) echecs++;
    console.log(`  ${ok ? "OK  " : "ECHEC"}  ${motif.padEnd(24)} ${c} (attendu ${op === ">" ? "> " : "= "}${seuil})`);
  }
  if (echecs > 0) {
    stop(`${echecs} contrôle(s) en échec — NE PAS déployer cet index.html.`);
  }
}

function stop(message) {
  console.error("\nBUILD INTERROMPU\n   " + message + "\n");
  process.exit(1);
}

// ── Mode vérification du gabarit (sans la source) ─────────────────────────────
// Reprend le code applicatif déjà présent dans index.html, le repasse dans le
// gabarit ci-dessus, et compare octet par octet avec le fichier d'origine.
function verifierGabarit() {
  const html = readFileSync(OUT, "utf8");
  const debut = html.indexOf("  <script>\n", html.indexOf("window.supabaseJs = window.supabase;")) + "  <script>\n".length;
  const fin   = html.indexOf('\nconst _root = ReactDOM.createRoot', debut);
  const appJs = html.slice(debut, fin);

  const reconstruit = assembleHtml(appJs);
  if (reconstruit === html) {
    console.log(`Gabarit conforme : la reconstruction redonne ${OUT} à l'octet près (${html.length} octets).`);
  } else {
    console.error(`Gabarit NON conforme : ${reconstruit.length} octets reconstruits contre ${html.length} attendus.`);
    process.exit(1);
  }
}

// ── Programme principal ───────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes("--verifier-gabarit")) return verifierGabarit();

  let source;
  try {
    source = readFileSync(SRC, "utf8");
  } catch {
    stop(`Source introuvable : ${SRC}\n   Le build a besoin de ce fichier, il est la source unique de vérité.`);
  }

  const code = transformerSource(source);

  // Compilation JSX → JS. Pas de "format" : le code doit rester au niveau global
  // pour que ReactDOM.createRoot puisse voir ForgeCoachingApp. Un format "iife"
  // enfermerait le composant dans une fonction et donnerait un écran blanc.
  const { code: appJs } = await transform(code, {
    loader: "jsx",
    target: "es2017",
    minify: false,
  });

  const html = assembleHtml(appJs);
  writeFileSync(OUT, html);

  // Service worker : le gabarit reçoit une empreinte de l'index.html qu'on vient
  // de produire. Toute modification de l'app change donc la version du cache,
  // ce qui déclenche la bannière de mise à jour chez les coachés.
  const version = createHash("sha256").update(html).digest("hex").slice(0, 12);
  const sw = readFileSync("src/sw-template.js", "utf8").replaceAll("__VERSION__", version);
  writeFileSync("sw.js", sw);
  console.log(`sw.js     : version ${version}`);

  controler(html);
  console.log(`\n${OUT} : ${html.length} octets — ${Math.round(html.length / 1024)} Ko`);
  console.log("Tous les contrôles sont passés.\n");
}

main();
