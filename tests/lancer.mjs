// ═══════════════════════════════════════════════════════════════════════════
//  FORGE COACHING — LANCEUR DE TESTS
//
//    node tests/lancer.mjs            → toute la série
//    node tests/lancer.mjs push       → seulement les tests dont le nom contient « push »
//
//  Le lanceur démarre lui-même un petit serveur HTTP sur la racine du dépôt :
//  l'app ne peut pas être testée en file:// (Partie C.2, piège n°4).
// ═══════════════════════════════════════════════════════════════════════════

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const RACINE = new URL("..", import.meta.url).pathname;
const DOSSIER = new URL(".", import.meta.url).pathname;
const PORT = 8099;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  // Sans ce type, Chromium traite la police comme un téléchargement.
  ".woff2": "font/woff2",
};

const serveur = createServer(async (req, rep) => {
  try {
    let chemin = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (chemin.endsWith("/")) chemin += "index.html";
    // Un test ne doit jamais pouvoir sortir du dépôt.
    const cible = join(RACINE, normalize(chemin).replace(/^(\.\.[/\\])+/, ""));
    if (!cible.startsWith(RACINE)) { rep.writeHead(403).end(); return; }
    const infos = await stat(cible);
    if (!infos.isFile()) { rep.writeHead(404).end(); return; }
    const corps = await readFile(cible);
    rep.writeHead(200, {
      "Content-Type": TYPES[extname(cible)] || "application/octet-stream",
      // Un service worker ne peut s'enregistrer que si le serveur ne le met pas en cache.
      "Cache-Control": "no-store",
    });
    rep.end(corps);
  } catch { rep.writeHead(404).end(); }
});

await new Promise((r) => serveur.listen(PORT, "127.0.0.1", r));

const filtre = process.argv[2];
const fichiers = readdirSync(DOSSIER)
  .filter((f) => f.startsWith("test-") && f.endsWith(".mjs"))
  .filter((f) => !filtre || f.includes(filtre))
  .sort();

if (fichiers.length === 0) {
  console.error(filtre ? `Aucun test ne correspond à « ${filtre} ».` : "Aucun test trouvé.");
  serveur.close();
  process.exit(1);
}

let echecs = 0;
const resume = [];

for (const f of fichiers) {
  process.stdout.write(`\n${"═".repeat(72)}\n  ${f}\n${"═".repeat(72)}\n`);
  const code = await new Promise((r) => {
    const p = spawn(process.execPath, [join(DOSSIER, f)], { stdio: "inherit", cwd: DOSSIER });
    p.on("close", r);
  });
  if (code !== 0) echecs++;
  resume.push({ f, ok: code === 0 });
}

serveur.close();

console.log(`\n${"═".repeat(72)}\n  RÉSUMÉ\n${"═".repeat(72)}`);
for (const { f, ok } of resume) console.log(`  ${ok ? "OK   " : "ECHEC"}  ${f}`);
console.log(echecs === 0
  ? `\n${fichiers.length} série(s) de tests, toutes passées.\n`
  : `\n${echecs} série(s) en échec sur ${fichiers.length}.\n`);
process.exit(echecs === 0 ? 0 : 1);
