// ═══════════════════════════════════════════════════════════════════════════
//  LA COMPARAISON VERT / ROUGE
//
//  Signalé le 9 septembre 2026 : « parfois l'affichage n'est pas ce qu'il
//  devrait être ». L'inspection des 1 354 séries réellement en base a donné
//  un diagnostic net, et pas celui qu'on attendait :
//
//    · AUCUNE inversion possible. La comparaison était déjà calée sur le bon
//      emplacement ; rejouée sur les vraies données, elle ne s'est trompée de
//      sens sur aucune série.
//    · 245 séries sur 1 338 (18 %) n'affichaient AUCUNE couleur alors qu'une
//      référence existait — la règle exigeait strictement la semaine N−1, et
//      une séance sautée effaçait la comparaison sans rien dire.
//    · Les ids de séance sont réutilisés d'un programme à l'autre : 11 ids
//      partagés, 19 emplacements portant un exercice différent selon le
//      programme. L'emplacement seul n'identifie donc PAS un exercice.
//
//  Ce test fige les trois règles qui en découlent.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });
const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.route("**/cdn.jsdelivr.net/**", r =>
  r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1800);

// Fabrique un jeu de logs : { "semaine-seance-exercice-serie": [poids, reps, nom] }
const monter = (defs) => p.evaluate((defs) => {
  const done = {}, logs = {};
  for (const [k, v] of Object.entries(defs)) {
    done[k] = true;
    logs[k] = { weight: v[0], actualReps: v[1], exerciseName: v[2] };
  }
  window.__done = done; window.__logs = logs;
  return true;
}, defs);

const ref = (sem, sid, ei, si, nom) => p.evaluate(([sem, sid, ei, si, nom]) =>
  referencePrecedente(sem, sid, ei, si, window.__done, window.__logs, nom),
  [sem, sid, ei, si, nom]);

const cmp = (sem, sid, ei, si, champ, val, nom) => p.evaluate(([sem, sid, ei, si, champ, val, nom]) =>
  compareWithPrevious(sem, sid, ei, si, champ, val, window.__done, window.__logs, nom),
  [sem, sid, ei, si, champ, val, nom]);

// ═══ 1. LE SENS DE LA COULEUR ══════════════════════════════════════════════
console.log("\n─── Plus lourd = vert, moins lourd = rouge ───");
{
  await monter({ "4-1-0-0": ["80", "8", "Développé couché"] });
  ok(await cmp(5, 1, 0, 0, "weight", "82.5", "Développé couché") === "up",   "82,5 kg après 80 kg → vert");
  ok(await cmp(5, 1, 0, 0, "weight", "77.5", "Développé couché") === "down", "77,5 kg après 80 kg → rouge");
  ok(await cmp(5, 1, 0, 0, "weight", "80",   "Développé couché") === "equal","80 kg après 80 kg → neutre");
  ok(await cmp(5, 1, 0, 0, "actualReps", "10", "Développé couché") === "up",   "10 reps après 8 → vert");
  ok(await cmp(5, 1, 0, 0, "actualReps", "6",  "Développé couché") === "down", "6 reps après 8 → rouge");
  // Charge et reps sont comparées séparément (règle J.1) : plus lourd pour
  // moins de reps donne bien un vert ET un rouge, ce n'est pas une anomalie.
  ok(await cmp(5, 1, 0, 0, "weight", "85", "Développé couché") === "up"
     && await cmp(5, 1, 0, 0, "actualReps", "6", "Développé couché") === "down",
     "plus lourd pour moins de reps : vert sur la charge, rouge sur les reps");
}

console.log("\n─── Les valeurs décimales ───");
{
  await monter({ "4-1-0-0": ["82.5", "8", "Hip thrust barre"] });
  ok(await cmp(5, 1, 0, 0, "weight", "82.5", "Hip thrust barre") === "equal", "82,5 contre 82,5 → neutre");
  ok(await cmp(5, 1, 0, 0, "weight", "83",   "Hip thrust barre") === "up",    "83 contre 82,5 → vert");
  ok(await cmp(5, 1, 0, 0, "weight", "82",   "Hip thrust barre") === "down",  "82 contre 82,5 → rouge");
}

// ═══ 2. UNE SÉANCE SAUTÉE NE DOIT PLUS EFFACER LA COULEUR ══════════════════
console.log("\n─── Quand la séance de la semaine dernière a été sautée ───");
{
  // Fait en S3, sauté en S4 et S5, refait en S6.
  await monter({ "3-1-0-0": ["70", "10", "Hack squat"] });
  const r4 = await ref(4, 1, 0, 0, "Hack squat");
  ok(r4 && r4.semaine === 3 && r4.recul === 1, "S4 se compare à S3");
  const r5 = await ref(5, 1, 0, 0, "Hack squat");
  ok(r5 && r5.semaine === 3 && r5.recul === 2, "S5 remonte à S3 — l'ancienne version n'affichait rien");
  const r6 = await ref(6, 1, 0, 0, "Hack squat");
  ok(r6 && r6.semaine === 3 && r6.recul === 3, "S6 remonte encore à S3, à la limite des 3 semaines");
  ok(await ref(7, 1, 0, 0, "Hack squat") === null,
     "S7 ne remonte PLUS : comparer à 4 semaines n'apprend plus rien");
  ok(await cmp(5, 1, 0, 0, "weight", "75", "Hack squat") === "up",
     "et la couleur sort bien pour S5 (75 après 70 → vert)");
}

console.log("\n─── On prend toujours la PLUS RÉCENTE des références ───");
{
  await monter({
    "2-1-0-0": ["60", "10", "Hack squat"],
    "4-1-0-0": ["80", "10", "Hack squat"],
  });
  const r = await ref(5, 1, 0, 0, "Hack squat");
  ok(r && r.semaine === 4, `S5 se compare à S4, pas à S2 (${r && r.semaine})`);
  ok(await cmp(5, 1, 0, 0, "weight", "70", "Hack squat") === "down",
     "70 kg est un RECUL par rapport aux 80 de S4, pas un progrès sur les 60 de S2");
}

// ═══ 3. L'EMPLACEMENT SEUL N'IDENTIFIE PAS UN EXERCICE ═════════════════════
console.log("\n─── Un exercice différent au même emplacement est ignoré ───");
{
  // Les ids de séance sont réutilisés d'un programme à l'autre : sans le
  // contrôle du nom, S5 comparerait un squat à un développé couché.
  await monter({
    "3-1-0-0": ["70", "10", "Hack squat"],
    "4-1-0-0": ["100", "5", "Développé couché"],
  });
  const r = await ref(5, 1, 0, 0, "Hack squat");
  ok(r && r.semaine === 3,
     `S5 saute la semaine 4 qui portait un AUTRE exercice et remonte à S3 (${r && r.semaine})`);
  ok(await cmp(5, 1, 0, 0, "weight", "75", "Hack squat") === "up",
     "75 kg se compare bien aux 70 du hack squat, pas aux 100 du développé");
}

console.log("\n─── Deux emplacements du même exercice ne se mélangent pas ───");
{
  // « Tirage vertical » lundi en 2e position (séance 1, index 1) et jeudi en
  // 6e (séance 3, index 5). Deux histoires distinctes.
  await monter({
    "4-1-1-0": ["60", "10", "Tirage vertical"],
    "4-3-5-0": ["45", "12", "Tirage vertical"],
  });
  const lundi = await ref(5, 1, 1, 0, "Tirage vertical");
  const jeudi = await ref(5, 3, 5, 0, "Tirage vertical");
  ok(lundi && lundi.weight === "60", `le lundi se compare à 60 kg (${lundi && lundi.weight})`);
  ok(jeudi && jeudi.weight === "45", `le jeudi se compare à 45 kg (${jeudi && jeudi.weight})`);
  ok(await cmp(5, 3, 5, 0, "weight", "50", "Tirage vertical") === "up",
     "50 kg le jeudi est une PROGRESSION sur les 45 du jeudi — pas un recul sur les 60 du lundi");
}

console.log("\n─── Chaque série garde sa propre référence ───");
{
  await monter({
    "4-1-0-0": ["80", "8", "Développé couché"],
    "4-1-0-1": ["75", "8", "Développé couché"],
    "4-1-0-2": ["70", "8", "Développé couché"],
  });
  for (const [si, attendu] of [[0, "80"], [1, "75"], [2, "70"]]) {
    const r = await ref(5, 1, 0, si, "Développé couché");
    ok(r && r.weight === attendu, `série ${si + 1} → ${attendu} kg (${r && r.weight})`);
  }
}

// ═══ 4. LES CAS OÙ IL NE DOIT RIEN Y AVOIR ═════════════════════════════════
console.log("\n─── Aucune couleur quand il ne doit pas y en avoir ───");
{
  await monter({ "4-1-0-0": ["80", "8", "Développé couché"] });
  ok(await cmp(1, 1, 0, 0, "weight", "80", "Développé couché") === null,
     "semaine 1 : il n'y a rien avant, donc rien à comparer");
  ok(await cmp(5, 1, 0, 0, "weight", "", "Développé couché") === null,
     "champ vide : pas de couleur");
  ok(await cmp(5, 2, 0, 0, "weight", "80", "Développé couché") === null,
     "autre séance sans historique : pas de couleur");
  ok(await ref(5, 1, 0, 0, "Développé couché") !== null, "mais la référence existe bien pour la bonne série");

  // Une série non validée n'est pas une référence : elle n'a pas été faite.
  await p.evaluate(() => { window.__done = {}; });
  ok(await ref(5, 1, 0, 0, "Développé couché") === null,
     "une série renseignée mais NON validée ne sert pas de référence");
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
