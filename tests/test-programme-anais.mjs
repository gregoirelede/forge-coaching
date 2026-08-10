// ═══════════════════════════════════════════════════════════════════════════
//  Le programme d'Anaïs, tel qu'il est RÉELLEMENT en base, rendu par l'app.
//
//  Écrire un programme directement en SQL court-circuite le constructeur de
//  l'espace coach, donc ses garde-fous. Ce test remet le filet : on charge la
//  structure exacte insérée et on vérifie que l'app la rend sans broncher, que
//  les quatre séances sont accessibles, et que la durée annoncée tient dans
//  l'enveloppe de 1h30 demandée.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });
const FIXTURE = JSON.parse(readFileSync(import.meta.dirname + "/fixtures-anais.json", "utf8"));

const URL = "http://127.0.0.1:8099/index.html";
const MAX_MINUTES = 90;

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const injection = `
const PROFIL = { id: "anais", name: "Anaïs Moncomble", access_code: "AMONCOMBLE16",
                 coach_id: "coach-1", offer: "premium", goal: "Prise de masse", sex: "femme",
                 birth_date: "2003-07-04", height_cm: 171, is_active: true,
                 start_date: "2026-06-08", created_at: "2026-06-02T18:54:16Z", role: "coachee" };
const PROGRAMME = { id: "p-new", coachee_id: "anais", is_active: true,
  week_structure: ${JSON.stringify(FIXTURE.week_structure)},
  sessions_structure: ${JSON.stringify(FIXTURE.sessions_structure)} };
const BIBLIO = ${JSON.stringify(FIXTURE.biblio)};

function requete(table) {
  const q = { _f: {},
    select(){ return q; }, order(){ return q; }, in(){ return q; }, gte(){ return q; }, limit(){ return q; },
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
  auth: { getSession: async () => ({ data: { session: { user: { id: "anais" } } } }),
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
ok(erreurs.length === 0, `aucune erreur applicative (${erreurs.length})`);
ok(!/UN PROBLÈME EST SURVENU/.test(await p.locator("body").innerText()),
   "l'écran d'erreur ne se déclenche pas");

await p.locator("text=SÉANCES").last().click();
await p.waitForTimeout(900);
const vue = await p.locator("body").innerText();

console.log("\n─── Les quatre séances ───");
// La page n'affiche qu'une séance à la fois : les onglets sont libellés par
// JOUR, pas par nom de séance. On passe donc de jour en jour.
const jours = [["LUNDI", "UPPER A"], ["MARDI", "LOWER A"], ["JEUDI", "UPPER B"], ["VENDREDI", "LOWER B"]];
for (const [jour, seance] of jours) {
  await p.locator(`text=${jour}`).last().click();
  await p.waitForTimeout(500);
  const t = await p.locator("body").innerText();
  ok(t.includes(seance), `${jour} → ${seance}`);
}
ok(!/SÉANCE 1\b/.test(vue), "aucune séance résiduelle de l'ancien programme");
const onglets = await p.locator("body").innerText();
ok(!/MERCREDI|SAMEDI|DIMANCHE/.test(onglets.split("SEMAINE")[1]?.slice(0, 200) || ""),
   "les jours de repos n'apparaissent pas dans les onglets");

console.log("\n─── Contenu d'une séance ───");
// Revenir sur LOWER A, la séance la plus dense en priorité fessiers/jambes.
await p.locator("text=MARDI").last().click();
await p.waitForTimeout(700);
const lowerA = await p.locator("body").innerText();
for (const n of ["Presse à cuisse", "Hip thrust barre", "Leg curl assis",
                 "Leg extension", "Abduction hanche machine", "Mollet press horizontal"]) {
  ok(lowerA.includes(n), `${n}`);
}
ok(/Fessier\/Ischios/.test(lowerA), "la pastille de muscle s'affiche (liste fermée respectée)");
await p.screenshot({ path: `${CAPTURES}anais-lower-a.png`, fullPage: true });

console.log("\n─── Durée des séances ───");
// estimateSessionMinutes est la fonction que l'app utilise pour annoncer la durée.
const durees = await p.evaluate((sessions) => {
  const src = [...document.querySelectorAll("script")].map(s => s.textContent).join("\n");
  const i = src.indexOf("function estimateSessionMinutes(");
  let n = 0, j = src.indexOf("{", i); const debut = j;
  do { if (src[j] === "{") n++; else if (src[j] === "}") n--; j++; } while (n > 0 && j < src.length);
  // parseRepos est utilisée par la fonction : on l'extrait aussi.
  const k = src.indexOf("function parseRepos(");
  let n2 = 0, m = src.indexOf("{", k); const debut2 = m;
  do { if (src[m] === "{") n2++; else if (src[m] === "}") n2--; m++; } while (n2 > 0 && m < src.length);
  // eslint-disable-next-line no-new-func
  const f = new Function(`${src.slice(k, debut2)}${src.slice(debut2, m)}
                          ${src.slice(i, debut)}${src.slice(debut, j)}
                          return estimateSessionMinutes;`)();
  return sessions.map(s => ({ nom: s.name, minutes: f(s) }));
}, FIXTURE.sessions_structure);

for (const d of durees) {
  ok(d.minutes <= MAX_MINUTES, `${d.nom} : ${d.minutes} min (plafond ${MAX_MINUTES})`);
}
ok(durees.every(d => d.minutes >= 40),
   "aucune séance anormalement courte, signe d'une structure mal lue");

console.log("\n─── Volume hebdomadaire ───");
const volumes = {};
for (const s of FIXTURE.sessions_structure)
  for (const e of s.exercises) volumes[e.muscle] = (volumes[e.muscle] || 0) + e.series;
ok(volumes["Fessier/Ischios"] === 14, `Fessier/Ischios : ${volumes["Fessier/Ischios"]} séries`);
ok(volumes["Quadriceps"] === 10, `Quadriceps : ${volumes["Quadriceps"]} séries`);
ok(Object.values(volumes).every(v => v >= 3),
   "aucun muscle sous la dose minimale efficace");
ok(Math.max(...Object.values(volumes)) <= 20,
   "aucun muscle au-dessus de ce qu'une débutante peut récupérer");

console.log("\n─── Contrainte épaule respectée ───");
const tousExos = FIXTURE.sessions_structure.flatMap(s => s.exercises.map(e => e.exercice));
const interdits = tousExos.filter(n => /développé militaire|militaire|overhead press|nuque|arnold/i.test(n));
ok(interdits.length === 0, `aucun développé au-dessus de la tête (${interdits.join(", ") || "aucun"})`);
ok(tousExos.includes("Oiseau unilatéral poulie haute"),
   "du deltoïde postérieur est programmé, il protège l'épaule autant qu'il la construit");

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
