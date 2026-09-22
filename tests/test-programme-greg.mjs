// ═══════════════════════════════════════════════════════════════════════════
//  Le programme de Greg, tel que le SQL le produit, rendu par l'app.
//
//  Même raison d'être que test-programme-meyssa.mjs : écrire un programme
//  directement en SQL court-circuite le constructeur de l'espace coach et ses
//  garde-fous. Ce test remet le filet.
//
//  La fixture n'est pas écrite à la main : elle est le résultat EXACT de
//  sql/2026-09-22-programme-greg-upper-lower.sql joué sur un Postgres local
//  reproduisant le schéma, la bibliothèque réelle (38 exercices) et les trois
//  anciens programmes qui occupent les séances 1 à 5. Si le SQL change, la
//  fixture doit être régénérée — sinon le test ne prouve plus rien.
//
//  Ce qu'on vérifie au-delà du rendu : que le programme fait ce que Greg a
//  demandé le 22 septembre 2026 — upper/lower 4 jours, lundi-mardi-jeudi-
//  vendredi, priorité pectoraux (haut accentué) / épaules / triceps, jambes
//  au volume de maintien.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });
const FIXTURE = JSON.parse(readFileSync(import.meta.dirname + "/fixtures-greg.json", "utf8"));

const URL = "http://127.0.0.1:8099/index.html";
const MAX_MINUTES = 80;

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const injection = `
const PROFIL = { id: "greg", name: "Grégoire Ledé", access_code: "GEXEMPLE41",
                 coach_id: "coach-1", offer: "premium", goal: "Prise de masse", sex: "homme",
                 birth_date: "2007-11-04", height_cm: 180, is_active: true,
                 start_date: "2025-01-15", created_at: "2026-05-25T21:57:58Z", role: "coachee" };
const PROGRAMME = { id: "p-greg", coachee_id: "greg", is_active: true,
  week_structure: ${JSON.stringify(FIXTURE.week_structure)},
  sessions_structure: ${JSON.stringify(FIXTURE.sessions_structure)} };
const BIBLIO = ${JSON.stringify(FIXTURE.biblio)};

function requete(table) {
  const q = { _f: {},
    select(){ return q; }, order(){ return q; }, range(){ return q; }, in(){ return q; },
    gte(){ return q; }, lte(){ return q; }, lt(){ return q; }, limit(){ return q; },
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
  auth: { getSession: async () => ({ data: { session: { user: { id: "greg" } } } }),
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

const S = FIXTURE.sessions_structure;
const SEM = FIXTURE.week_structure;
const toutes = S.flatMap(s => s.exercises);
const seriesPar = (m) => toutes.filter(e => e.muscle === m).reduce((t, e) => t + e.series, 0);

console.log("─── L'app accepte le programme ───");
{
  ok(erreurs.length === 0, `aucune erreur applicative (${erreurs.length})`);
  const vu = await p.locator("text=/UPPER|LOWER/i").count();
  ok(vu > 0, `les séances s'affichent (${vu} mentions UPPER/LOWER)`);
  await p.screenshot({ path: CAPTURES + "greg-accueil.png" });
}

console.log("\n─── Quatre jours : lundi, mardi, jeudi, vendredi ───");
{
  const jours = SEM.filter(j => j.sessionId != null).map(j => j.day);
  ok(jours.length === 4, `4 jours d'entraînement (${jours.length})`);
  ok(JSON.stringify(jours) === JSON.stringify(["LUNDI","MARDI","JEUDI","VENDREDI"]),
     `dans l'ordre demandé : ${jours.join(", ")}`);
  const repos = SEM.filter(j => j.sessionId == null).map(j => j.day);
  ok(repos.includes("MERCREDI") && repos.includes("SAMEDI") && repos.includes("DIMANCHE"),
     `repos mercredi, samedi, dimanche (${repos.join(", ")})`);
}

console.log("\n─── C'est bien un upper / lower ───");
{
  const bas = ["Quadriceps","Ischios","Mollets","Fessier/Ischios","Adducteurs"];
  for (const s of S) {
    const muscles = [...new Set(s.exercises.map(e => e.muscle))];
    const aDuBas = muscles.some(m => bas.includes(m));
    const estUpper = /UPPER/.test(s.name);
    ok(estUpper ? !aDuBas : aDuBas,
       `${s.name} : ${estUpper ? "aucun muscle du bas" : "contient bien du bas du corps"}`);
  }
  // Le dos est sur les jours LOWER, jamais sur les UPPER : c'est le choix qui
  // libère la place pour l'incliné et les épaules.
  const dosSurUpper = S.filter(s => /UPPER/.test(s.name))
    .flatMap(s => s.exercises).filter(e => /dorsal|Haut du dos/.test(e.muscle)).length;
  ok(dosSurUpper === 0, `aucun exercice de dos sur les séances Upper (${dosSurUpper})`);
}

console.log("\n─── Les priorités reçoivent le volume des priorités ───");
{
  const pec = seriesPar("Pectoraux"), tri = seriesPar("Triceps");
  const dlat = seriesPar("Deltoïde lat"), dpost = seriesPar("Deltoïde post");
  ok(pec >= 14 && pec <= 20, `pectoraux : ${pec} séries/semaine (fourchette utile 12-20)`);
  ok(tri >= 12 && tri <= 20, `triceps : ${tri} séries/semaine`);
  ok(dlat >= 10, `deltoïde latéral : ${dlat} séries/semaine`);
  ok(dpost >= 4, `deltoïde postérieur : ${dpost} séries/semaine`);
}

console.log("\n─── L'accentuation du HAUT des pectoraux est réelle ───");
{
  // Ce qui biaise le haut : les mouvements inclinés, et l'écarté poulie basse
  // dont la trajectoire va du bas vers le haut.
  const pecs = toutes.filter(e => e.muscle === "Pectoraux");
  const haut = pecs.filter(e => /incliné/i.test(e.exercice) || /poulie basse/i.test(e.exercice))
                   .reduce((t, e) => t + e.series, 0);
  const total = pecs.reduce((t, e) => t + e.series, 0);
  ok(haut / total > 0.5,
     `${haut} des ${total} séries pectoraux biaisent le haut (${Math.round(100*haut/total)} %)`);
  const inclines = new Set(pecs.filter(e => /incliné/i.test(e.exercice)).map(e => e.exercice));
  ok(inclines.size >= 2, `deux schémas inclinés distincts : ${[...inclines].join(" · ")}`);
  // Les dips biaisent le BAS du pectoral : leur présence contredirait l'objectif.
  ok(!toutes.some(e => /dips/i.test(e.exercice)),
     "aucun dip — ils biaisent le bas du pectoral, l'inverse de l'objectif");
}

console.log("\n─── Le triceps est travaillé en position allongée ───");
{
  // L'effet le mieux documenté du programme : +28,5 % contre +19,6 % sur la
  // longue portion en 12 semaines (Maeo et coll.).
  const upper = S.filter(s => /UPPER/.test(s.name));
  const avecOverhead = upper.filter(s => s.exercises.some(e => /overhead/i.test(e.exercice)));
  ok(avecOverhead.length === upper.length,
     `l'extension overhead est présente sur les ${upper.length} séances Upper`);
}

console.log("\n─── Les jambes sont au volume de MAINTIEN, assumé ───");
{
  const quad = seriesPar("Quadriceps"), isch = seriesPar("Ischios");
  ok(quad >= 4 && quad <= 10, `quadriceps : ${quad} séries/semaine (maintien, pas progression)`);
  ok(isch >= 2 && isch <= 8, `ischios : ${isch} séries/semaine`);
  ok(quad > 0 && isch > 0, "les jambes ne sont pas supprimées — l'arrêt total coûte cher");
  ok(quad < seriesPar("Pectoraux"), `moins de quadriceps que de pectoraux (${quad} < ${seriesPar("Pectoraux")})`);
}

console.log("\n─── Les biceps passent en maintien, pas à la poubelle ───");
{
  const bi = seriesPar("Biceps");
  ok(bi >= 4 && bi <= 9, `biceps/brachial : ${bi} séries/semaine (volume de maintien ≈ 6)`);
  ok(toutes.some(e => /marteau/i.test(e.exercice)),
     "le curl marteau est là — c'est lui qui travaille le brachial, dans les focus");
}

console.log("\n─── Les pastilles de muscle sont dans la liste fermée ───");
{
  const LISTE = ["Triceps","Pectoraux","Deltoïde post","Deltoïde lat","Quadriceps","Ischios",
                 "Mollets","Grand dorsal","Haut du dos","Biceps","Fessier/Ischios","Adducteurs"];
  const hors = [...new Set(toutes.map(e => e.muscle))].filter(m => !LISTE.includes(m));
  ok(hors.length === 0, `aucun muscle hors liste (${hors.join(", ") || "aucun"})`);
}

console.log("\n─── Chaque série a son objectif de reps ───");
{
  const faux = toutes.filter(e => !Array.isArray(e.reps) || e.reps.length !== e.series);
  ok(faux.length === 0,
     `les ${toutes.length} exercices ont autant d'entrées reps que de séries (${faux.length} anomalie(s))`);
}

console.log("\n─── Tout est lié à la bibliothèque ───");
{
  // Sans lien, le coaché ne peut pas suivre l'exercice jusqu'à sa vidéo.
  const sansLien = toutes.filter(e => !e.library_exercise_id);
  ok(sansLien.length === 0,
     `${toutes.length - sansLien.length}/${toutes.length} exercices liés (${sansLien.map(e=>e.exercice).join(", ") || "aucun manquant"})`);
  const noms = new Set(FIXTURE.biblio.map(x => x.name));
  const orphelins = toutes.filter(e => !noms.has(e.exercice));
  ok(orphelins.length === 0, `aucun nom absent de la bibliothèque (${orphelins.length})`);
}

console.log("\n─── Durée des séances ───");
{
  const parseRepos = (s) => { const m = (s||"").split("/")[0].trim().match(/(\d+)'(\d+)?/);
    return m ? (parseInt(m[1])||0)*60 + (parseInt(m[2])||0) : 150; };
  const minutes = (s) => { let sec = 0;
    s.exercises.forEach(e => { const n = e.series;
      sec += n*45 + Math.max(0, n-1)*parseRepos(e.repos) + 120; });
    return Math.max(15, Math.round(sec/60/5)*5); };
  for (const s of S) {
    const m = minutes(s);
    ok(m <= MAX_MINUTES, `${s.name} : ${m} min (plafond ${MAX_MINUTES})`);
  }
}

console.log("\n─── Numérotation des séances ───");
{
  // Greg a utilisé 1 à 5 sur ses trois programmes précédents. Réutiliser un id
  // ferait apparaître ses anciennes charges sous les nouveaux exercices.
  const ids = S.map(s => s.id).sort((a,b) => a-b);
  ok(ids.every(i => i > 5), `tous les numéros sont au-delà de 5 (${ids.join(", ")})`);
  ok(new Set(ids).size === ids.length, "aucun doublon");
  const refs = SEM.filter(j => j.sessionId != null).map(j => j.sessionId).sort((a,b)=>a-b);
  ok(JSON.stringify(refs) === JSON.stringify(ids), "la semaine pointe exactement sur les séances définies");
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
