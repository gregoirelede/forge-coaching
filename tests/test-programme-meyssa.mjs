// ═══════════════════════════════════════════════════════════════════════════
//  Le programme de Meyssa, tel que le SQL le produit, rendu par l'app.
//
//  Même raison d'être que test-programme-anais.mjs : écrire un programme
//  directement en SQL court-circuite le constructeur de l'espace coach et ses
//  garde-fous. Ce test remet le filet.
//
//  La fixture n'est pas écrite à la main : elle est le résultat exact de
//  sql/2026-08-25-programme-meyssa.sql joué sur une base Postgres locale
//  reproduisant le schéma et la bibliothèque. Si le SQL change, la fixture
//  doit être régénérée — sinon le test ne prouve plus rien.
//
//  Ce qu'on vérifie, au-delà du rendu : que le programme fait ce que Greg a
//  demandé. Full body, mercredi et dimanche, focus fessier, et les quatre
//  exercices imposés réellement présents.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });
const FIXTURE = JSON.parse(readFileSync(import.meta.dirname + "/fixtures-meyssa.json", "utf8"));

const URL = "http://127.0.0.1:8099/index.html";
const MAX_MINUTES = 80;

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const injection = `
const PROFIL = { id: "meyssa", name: "Meyssa Razzouk", access_code: "MEXEMPLE42",
                 coach_id: "coach-1", offer: "essentiel", goal: "Fessier", sex: "femme",
                 birth_date: "2004-03-11", height_cm: 167, is_active: true,
                 start_date: "2026-08-24", created_at: "2026-08-24T06:32:16Z", role: "coachee" };
const PROGRAMME = { id: "p-meyssa", coachee_id: "meyssa", is_active: true,
  week_structure: ${JSON.stringify(FIXTURE.week_structure)},
  sessions_structure: ${JSON.stringify(FIXTURE.sessions_structure)} };
const BIBLIO = ${JSON.stringify(FIXTURE.biblio)};

function requete(table) {
  const q = { _f: {},
    select(){ return q; }, order(){ return q; },
    // La pagination réelle passe par .range() : un stub qui l'ignore rend
    // tout d'un coup, ce qui suffit pour ces jeux d'essai (bien sous les
    // 1 000 lignes). test-pagination.mjs, lui, applique le vrai plafond.
    range(){ return q; }, in(){ return q; }, gte(){ return q; }, limit(){ return q; },
    eq(c,v){ q._f[c]=v; return q; },
    update(){ return q; }, insert: async()=>({data:null,error:null}), upsert: async()=>({data:null,error:null}),
    delete(){ return { eq: async()=>({error:null}) }; },
    single: async()=>({ data: table==="profiles" ? PROFIL : table==="programs" ? PROGRAMME : null, error:null }),
    maybeSingle: async()=>({ data: table==="programs" ? PROGRAMME : null, error:null }),
    then(res){
      let d = [];
      if (table === "exercises_library") d = BIBLIO;
      return Promise.resolve({ data: d, error: null }).then(res);
    },
  };
  return q;
}
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { user: { id: "meyssa" } } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
          signOut: async () => ({ error: null }) },
  from: requete, functions: { invoke: async () => ({ data: null, error: null }) },
}) };
`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const erreurs = [];
p.on("pageerror", e => erreurs.push(e.message));
p.on("console", m => { if (m.type() === "error" && /Erreur applicative/.test(m.text())) erreurs.push(m.text()); });
await p.addInitScript(injection);
await p.route("**/cdn.jsdelivr.net/**", r =>
  r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2600);

console.log("\n─── L'app accepte le programme ───");
ok(erreurs.length === 0, `aucune erreur applicative (${erreurs.length})${erreurs[0] ? " : " + erreurs[0].slice(0, 80) : ""}`);
ok(!/UN PROBLÈME EST SURVENU/.test(await p.locator("body").innerText()),
   "l'écran d'erreur ne se déclenche pas");

await p.locator("text=SÉANCES").last().click();
await p.waitForTimeout(900);

console.log("\n─── Deux séances, mercredi et dimanche ───");
for (const [jour, seance] of [["MERCREDI", "FULL BODY A"], ["DIMANCHE", "FULL BODY B"]]) {
  await p.locator(`text=${jour}`).last().click();
  await p.waitForTimeout(500);
  ok((await p.locator("body").innerText()).includes(seance), `${jour} → ${seance}`);
}
{
  // Les onglets de jour ne listent que les jours travaillés : cinq jours de
  // repos qui apparaîtraient signaleraient une week_structure mal lue.
  const zone = (await p.locator("body").innerText()).split("SEMAINE")[1]?.slice(0, 220) || "";
  ok(!/LUNDI|MARDI|JEUDI|VENDREDI|SAMEDI/.test(zone),
     "les cinq jours de repos n'apparaissent pas dans les onglets");
}

console.log("\n─── Les quatre exercices imposés par Greg ───");
const tous = FIXTURE.sessions_structure.flatMap(s => s.exercises);
const noms = tous.map(e => e.exercice);
for (const [libelle, motif] of [
  ["soulevé de terre roumain", /roumain/i],
  ["hip thrust",               /hip thrust/i],
  ["fente bulgare",            /bulgare/i],
  ["hack squat",               /hack squat/i],
]) {
  const trouve = noms.filter(n => motif.test(n));
  ok(trouve.length > 0, `${libelle} → « ${trouve[0] || "ABSENT"} »`);
}
ok(tous.every(e => e.library_exercise_id),
   "chaque exercice pointe sur la bibliothèque — sinon la vidéo de démonstration ne suit pas");

console.log("\n─── Focus fessier ───");
const volumes = {};
for (const e of tous) volumes[e.muscle] = (volumes[e.muscle] || 0) + e.series;
const fessier = volumes["Fessier/Ischios"] || 0;
ok(fessier >= 14 && fessier <= 24,
   `Fessier/Ischios : ${fessier} séries par semaine (fourchette utile 14–24 pour une intermédiaire à 2 séances)`);
ok(fessier === Math.max(...Object.values(volumes)),
   "c'est bien le muscle le plus travaillé du programme");

console.log("\n─── Et ça reste un full body ───");
// Un full body qui laisse un grand groupe à zéro n'en est pas un.
for (const m of ["Quadriceps", "Ischios", "Pectoraux", "Grand dorsal",
                 "Haut du dos", "Deltoïde lat", "Biceps", "Triceps", "Mollets"]) {
  ok((volumes[m] || 0) >= 2, `${m} : ${volumes[m] || 0} séries`);
}

console.log("\n─── Les pastilles de muscle sont dans la liste fermée ───");
const FERMEE = ["Triceps", "Pectoraux", "Deltoïde post", "Deltoïde lat", "Quadriceps",
                "Ischios", "Mollets", "Grand dorsal", "Haut du dos", "Biceps",
                "Fessier/Ischios", "Adducteurs"];
const hors = [...new Set(tous.map(e => e.muscle))].filter(m => !FERMEE.includes(m));
ok(hors.length === 0, `aucun muscle hors liste (${hors.join(", ") || "aucun"})`);

console.log("\n─── Chaque série a son objectif de reps ───");
const mauvais = tous.filter(e => !Array.isArray(e.reps) || e.reps.length !== e.series);
ok(mauvais.length === 0,
   `reps et series concordent partout (${mauvais.map(e => e.exercice).join(", ") || "aucun écart"})`);

console.log("\n─── Durée des séances ───");
const durees = await p.evaluate((sessions) => {
  const src = [...document.querySelectorAll("script")].map(s => s.textContent).join("\n");
  const i = src.indexOf("function estimateSessionMinutes(");
  let n = 0, j = src.indexOf("{", i); const debut = j;
  do { if (src[j] === "{") n++; else if (src[j] === "}") n--; j++; } while (n > 0 && j < src.length);
  const k = src.indexOf("function parseRepos(");
  let n2 = 0, m = src.indexOf("{", k); const debut2 = m;
  do { if (src[m] === "{") n2++; else if (src[m] === "}") n2--; m++; } while (n2 > 0 && m < src.length);
  // eslint-disable-next-line no-new-func
  const f = new Function(`${src.slice(k, debut2)}${src.slice(debut2, m)}
                          ${src.slice(i, debut)}${src.slice(debut, j)}
                          return estimateSessionMinutes;`)();
  return sessions.map(s => ({ nom: s.name, minutes: f(s) }));
}, FIXTURE.sessions_structure);
for (const d of durees) ok(d.minutes <= MAX_MINUTES, `${d.nom} : ${d.minutes} min (plafond ${MAX_MINUTES})`);
ok(durees.every(d => d.minutes >= 50), "aucune séance anormalement courte, signe d'une structure mal lue");

console.log("\n─── Numérotation des séances ───");
// Règle P.3 : les séries loguées sont indexées par session_config_id. Ses deux
// programmes précédents ont utilisé les ids 1, 2 et 4 — réutiliser l'un d'eux
// ferait apparaître d'anciennes charges sous les nouveaux noms d'exercices.
const ids = FIXTURE.sessions_structure.map(s => s.id);
ok(ids.every(i => i > 4), `ids ${ids.join(" et ")}, hors de la plage déjà utilisée (1, 2, 4)`);
ok(new Set(ids).size === ids.length, "les deux séances ont des ids distincts");

await p.locator("text=MERCREDI").last().click();
await p.waitForTimeout(700);
await p.screenshot({ path: `${CAPTURES}meyssa-full-body-a.png`, fullPage: true });

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
