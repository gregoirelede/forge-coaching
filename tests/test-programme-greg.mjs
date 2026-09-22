// ═══════════════════════════════════════════════════════════════════════════
//  Le programme de Greg, tel que le SQL le produit, rendu par l'app.
//
//  Même raison d'être que test-programme-meyssa.mjs : écrire un programme
//  directement en SQL court-circuite le constructeur de l'espace coach et ses
//  garde-fous. Ce test remet le filet.
//
//  La fixture n'est pas écrite à la main : elle est le résultat EXACT de
//  sql/2026-09-22-programme-greg-retour-5-jours.sql joué sur un Postgres local
//  reproduisant le schéma, la bibliothèque réelle et les quatre programmes de
//  Greg. Si le SQL change, la fixture doit être régénérée — sinon le test ne
//  prouve plus rien.
//
//  CE QUE CE PROGRAMME EST. Greg a essayé l'upper/lower 4 jours du 22 septembre
//  et l'a refusé le jour même. On est revenu à son 5 jours, avec trois
//  modifications et trois seulement :
//    1. moins de jambes — 26 séries hebdomadaires deviennent 10 ;
//    2. les abdos deviennent de VRAIS exercices logués, à la place du texte
//       libre « Abdos / cardio » qui ne portait ni charge ni progression ;
//    3. un seul exercice de dos unilatéral le jeudi au lieu de trois.
//
//  Ce test vérifie ces trois points, et surtout qu'AUCUN autre n'a bougé :
//  une modification qui déborde de ce qui a été demandé est exactement ce
//  qu'on veut attraper ici.
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
  const vu = await p.locator("text=/PUSH|PULL|UPPER/i").count();
  ok(vu > 0, `les séances s'affichent (${vu} mentions PUSH/PULL/UPPER)`);
  await p.screenshot({ path: CAPTURES + "greg-accueil.png" });
}

console.log("\n─── Cinq jours, inchangés : lundi, mardi, jeudi, vendredi, dimanche ───");
{
  const jours = SEM.filter(j => j.sessionId != null).map(j => j.day);
  ok(JSON.stringify(jours) === JSON.stringify(["LUNDI","MARDI","JEUDI","VENDREDI","DIMANCHE"]),
     `le calendrier d'origine est repris : ${jours.join(", ")}`);
  const repos = SEM.filter(j => j.sessionId == null).map(j => j.day);
  ok(repos.includes("MERCREDI") && repos.includes("SAMEDI"),
     `repos mercredi et samedi (${repos.join(", ")})`);
}

console.log("\n─── 1. Les jambes descendent à 10 séries, sans disparaître ───");
{
  const BAS = ["Quadriceps","Ischios","Mollets","Fessier/Ischios","Adducteurs"];
  const detail = BAS.map(m => `${m} ${seriesPar(m)}`).join(" · ");
  const total = BAS.reduce((t, m) => t + seriesPar(m), 0);
  ok(total === 10, `10 séries de bas du corps par semaine — ${detail}`);
  // Un muscle qu'on ne priorise plus ne se supprime pas : l'arrêt TOTAL coûte
  // jusqu'à −30 % de section sur 32 semaines (Bickel). Les trois muscles que
  // Greg garde restent donc présents, même à bas volume.
  for (const m of ["Quadriceps","Ischios","Mollets"]) {
    ok(seriesPar(m) > 0, `${m} : ${seriesPar(m)} séries — présent, pas supprimé`);
  }
  // Le leg curl gardé est l'ASSIS : hanche fléchie = ischio en position
  // allongée. Quand il ne reste que 3 séries, autant qu'elles comptent.
  const curls = toutes.filter(e => /leg curl/i.test(e.exercice)).map(e => e.exercice);
  ok(curls.length === 1 && /assis/i.test(curls[0]),
     `un seul leg curl, et c'est l'assis (${curls.join(", ") || "aucun"})`);
}

console.log("\n─── 2. Les abdos sont de VRAIS exercices, plus du texte libre ───");
{
  const abdos = toutes.filter(e => e.muscle === "Abdos");
  ok(abdos.length >= 4, `${abdos.length} emplacements d'abdos dans la semaine`);
  ok(seriesPar("Abdos") === 12, `12 séries d'abdos par semaine (${seriesPar("Abdos")})`);

  // Chacun des deux exercices revient 2× par semaine : la fréquence de
  // référence (P.5). Un seul passage hebdomadaire n'aurait pas été « réel ».
  const parNom = {};
  abdos.forEach(e => { parNom[e.exercice] = (parNom[e.exercice] || 0) + 1; });
  const noms = Object.keys(parNom);
  ok(noms.length === 2, `deux exercices distincts : ${noms.join(" · ")}`);
  ok(noms.every(n => parNom[n] === 2),
     `chacun revient 2× par semaine (${noms.map(n => n + " ×" + parNom[n]).join(", ")})`);

  // Ils sont en BIBLIOTHÈQUE, sinon ils ne peuvent porter ni vidéo ni note.
  const enBiblio = FIXTURE.biblio.filter(x => x.muscle === "Abdos");
  ok(enBiblio.length === 2,
     `les 2 exercices existent en bibliothèque (${enBiblio.map(x => x.name).join(", ")})`);

  // Et le champ texte est VIDE partout : le gainage y était encore, il aurait
  // été compté une deuxième fois.
  const resteDuTexte = S.filter(s => (s.abdosCardio || []).length > 0);
  ok(resteDuTexte.length === 0,
     `le champ « Abdos / cardio » est vide sur les ${S.length} séances (${resteDuTexte.map(s=>s.name).join(", ") || "aucun reste"})`);
}

console.log("\n─── 3. Le jeudi n'a plus qu'UN exercice de dos unilatéral ───");
{
  const DOS = ["Grand dorsal", "Haut du dos"];
  const estUni = (e) => /\(uni\)|unilat/i.test(e.exercice);
  const jeudi = S.find(s => s.name === "PULL");
  ok(!!jeudi, "la séance du jeudi est bien PULL");

  const dosJeudi = jeudi.exercises.filter(e => DOS.includes(e.muscle));
  const uniJeudi = dosJeudi.filter(estUni);
  ok(uniJeudi.length === 1,
     `un seul dos unilatéral le jeudi sur ${dosJeudi.length} (${uniJeudi.map(e=>e.exercice).join(", ")})`);
  ok(/pull over/i.test(uniJeudi[0]?.exercice || ""),
     "et c'est le pull over — celui qui gagne le plus à être unilatéral");

  // Les deux tirages du jeudi sont devenus bilatéraux, et ils existent déjà
  // en bibliothèque : aucun exercice inventé pour l'occasion.
  const tirages = dosJeudi.filter(e => /tirage/i.test(e.exercice));
  ok(tirages.length >= 2 && tirages.every(e => !estUni(e)),
     `les tirages du jeudi sont bilatéraux (${tirages.map(e=>e.exercice).join(" · ")})`);

  // La charge de dos elle-même ne baisse pas : c'est la FATIGUE qui baisse,
  // pas le volume. 10 séries unilatérales = 20 séries de travail réel.
  const volDosJeudi = dosJeudi.reduce((t, e) => t + e.series, 0);
  ok(volDosJeudi >= 10, `le volume de dos du jeudi est conservé (${volDosJeudi} séries)`);
}

console.log("\n─── Ce qui NE devait PAS bouger n'a pas bougé ───");
{
  // Le programme s'appelle « focus bras/épaules ». Trois modifications ont été
  // demandées ; toucher aux bras ou aux épaules n'en faisait pas partie.
  const tri = seriesPar("Triceps"), bi = seriesPar("Biceps");
  const dlat = seriesPar("Deltoïde lat"), dpost = seriesPar("Deltoïde post");
  ok(tri === 14, `triceps : ${tri} séries/semaine (inchangé)`);
  ok(bi === 14, `biceps : ${bi} séries/semaine (inchangé)`);
  ok(dlat === 12, `deltoïde latéral : ${dlat} séries/semaine (inchangé)`);
  ok(dpost === 8, `deltoïde postérieur : ${dpost} séries/semaine (inchangé)`);
  ok(seriesPar("Pectoraux") === 13, `pectoraux : ${seriesPar("Pectoraux")} séries/semaine (inchangé)`);

  // La séance du lundi n'était concernée par aucune des trois demandes.
  const lundi = S.find(s => s.name === "PUSH A");
  ok(lundi.exercises.length === 7 && lundi.exercises.reduce((t,e)=>t+e.series,0) === 21,
     `PUSH A du lundi : ${lundi.exercises.length} exos, ${lundi.exercises.reduce((t,e)=>t+e.series,0)} séries — intacte`);

  // Les fourchettes utiles restent tenues sur les muscles prioritaires.
  ok(tri >= 12 && tri <= 20, `le triceps reste dans la fourchette 12-20`);
  ok(bi >= 12 && bi <= 20, `le biceps reste dans la fourchette 12-20`);
}

console.log("\n─── Les pastilles de muscle sont dans la liste fermée ───");
{
  // Abdos vient d'y entrer — un muscle hors liste casse le code couleur sur
  // toutes les vues, et ne se voit sur aucun écran avant la mise en ligne.
  const LISTE = ["Triceps","Pectoraux","Deltoïde post","Deltoïde lat","Quadriceps","Ischios",
                 "Mollets","Grand dorsal","Haut du dos","Biceps","Fessier/Ischios","Adducteurs",
                 "Abdos"];
  const hors = [...new Set(toutes.map(e => e.muscle))].filter(m => !LISTE.includes(m));
  ok(hors.length === 0, `aucun muscle hors liste (${hors.join(", ") || "aucun"})`);
  const horsBiblio = [...new Set(FIXTURE.biblio.map(x => x.muscle))].filter(m => !LISTE.includes(m));
  ok(horsBiblio.length === 0, `la bibliothèque non plus (${horsBiblio.join(", ") || "aucun"})`);
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
  // L'ancien programme n'en avait qu'UN sur 35 ; le SQL les relie tous.
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
  // Ici la règle s'applique À L'ENVERS de celle d'un programme NEUF. Ce
  // programme est celui de Greg : ses 561 séries loguées sont indexées sur ses
  // séances 1 à 5. Les changer orphelinerait son historique. Ce qu'interdit la
  // règle P.3, c'est de RECYCLER l'id d'un AUTRE programme — pas de rester sur
  // les siens.
  const ids = S.map(s => s.id).sort((a,b) => a-b);
  ok(JSON.stringify(ids) === JSON.stringify([1,2,3,4,5]),
     `les numéros d'origine sont conservés (${ids.join(", ")})`);
  ok(new Set(ids).size === ids.length, "aucun doublon");
  const refs = SEM.filter(j => j.sessionId != null).map(j => j.sessionId).sort((a,b)=>a-b);
  ok(JSON.stringify(refs) === JSON.stringify(ids), "la semaine pointe exactement sur les séances définies");
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
