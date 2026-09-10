// ═══════════════════════════════════════════════════════════════════════════
//  LE PLAFOND DES 1 000 LIGNES
//
//  PostgREST renvoie au maximum 1 000 lignes à une requête non paginée, et ne
//  le signale d'aucune façon : pas d'erreur, pas d'avertissement, un tableau
//  qui s'arrête. Relevé en base le 10 septembre 2026, trois lectures le
//  dépassaient déjà ou allaient le dépasser.
//
//  Ce test simule un serveur qui APPLIQUE réellement le plafond : il lit
//  l'en-tête Range de chaque requête et ne rend jamais plus de 1 000 lignes
//  d'un coup. Une lecture non paginée s'y fait donc tronquer, exactement comme
//  en production — ce qui est le seul moyen de prouver que le correctif tient.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync(import.meta.dirname + "/captures/", { recursive: true });
const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

// 3 286 aliments comme en base, et 1 383 séries : les deux volumes réels.
const NB_ALIMENTS = 3286;
const NB_SERIES = 1383;

const injection = `
window.__journal = { pages: {} };
const PLAFOND = 1000;   // le plafond réel de PostgREST

const ALIMENTS = Array.from({ length: ${NB_ALIMENTS} }, (_, i) => ({
  id: "food-" + String(i).padStart(5, "0"),
  coach_id: null, name: "Aliment " + String(i).padStart(5, "0"),
  role: ["proteine","feculent","legume","fruit","matiere_grasse","autre"][i % 6],
  meal_types: ["dejeuner"], kcal_100: 100, protein_100: 10, carbs_100: 10, fat_100: 5,
  portion_g: 100, cost_level: 2, prep_level: 2, tags: [],
}));
const SEMAINE = { id: "w1", week_number: 3 };
const SERIES = Array.from({ length: ${NB_SERIES} }, (_, i) => ({
  id: "set-" + String(i).padStart(5, "0"), coachee_id: "c1", week_id: "w1",
  session_config_id: 1, exercise_index: i % 40, exercise_name: "Exo " + (i % 40),
  set_index: Math.floor(i / 40) % 4, weight: 50, actual_reps: 8, completed: true,
  logged_at: "2026-09-01T10:00:00Z", week: SEMAINE,
}));

const PROFIL = { id: "c1", name: "Meyssa Razzouk", access_code: "MEXEMPLE42",
                 coach_id: "coach-1", offer: "premium", role: "coachee",
                 created_at: "2026-08-24T06:00:00Z" };

function requete(table) {
  let plage = null;
  const q = {
    select(){ return q; }, order(){ return q; }, eq(){ return q; }, in(){ return q; },
    gte(){ return q; }, lte(){ return q; }, limit(){ return q; },
    range(a, b){ plage = [a, b]; return q; },
    update(){ return q; }, insert: async()=>({data:null,error:null}),
    upsert: async()=>({data:null,error:null}),
    delete(){ return { eq: async()=>({error:null}) }; },
    single: async()=>({ data: table === "profiles" ? PROFIL : null, error: null }),
    maybeSingle: async()=>({ data: null, error: null }),
    then(res){
      const source = table === "foods" ? ALIMENTS
                   : table === "sets_logged" ? SERIES : [];
      // C'EST ICI QUE LE PLAFOND S'APPLIQUE, comme sur le vrai serveur.
      const debut = plage ? plage[0] : 0;
      const demande = plage ? (plage[1] - plage[0] + 1) : PLAFOND;
      const taille = Math.min(demande, PLAFOND);
      window.__journal.pages[table] = (window.__journal.pages[table] || 0) + 1;
      return Promise.resolve({ data: source.slice(debut, debut + taille), error: null }).then(res);
    },
  };
  return q;
}
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { user: { id: "c1" } } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
          signOut: async () => ({ error: null }) },
  from: requete, functions: { invoke: async () => ({ data: null, error: null }) },
}) };
`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.addInitScript(injection);
await p.route("**/cdn.jsdelivr.net/**", r =>
  r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2200);

// Les fonctions sont internes au bundle : on les extrait du script livré, comme
// le font déjà test-videos.mjs et test-programme-meyssa.mjs.
const extraire = (nom) => p.evaluate((n) => {
  const src = [...document.querySelectorAll("script")].map(s => s.textContent).join("\n");
  const i = src.indexOf("async function " + n + "(");
  if (i < 0) return false;
  let d = 0, j = src.indexOf("{", i); const debut = j;
  do { if (src[j] === "{") d++; else if (src[j] === "}") d--; j++; } while (d > 0 && j < src.length);
  const k = src.indexOf("async function lireTout(");
  let d2 = 0, m = src.indexOf("{", k); const debut2 = m;
  do { if (src[m] === "{") d2++; else if (src[m] === "}") d2--; m++; } while (d2 > 0 && m < src.length);
  // eslint-disable-next-line no-new-func
  window["__" + n] = new Function(`const PAGE_SUPABASE = 1000, PAGES_MAX = 200;
    ${src.slice(k, debut2)}${src.slice(debut2, m)}
    ${src.slice(i, debut)}${src.slice(debut, j)}
    return ${n};`)();
  return typeof window["__" + n] === "function";
}, nom);

console.log("\n─── Le correctif est bien dans le fichier livré ───");
ok(await p.evaluate(() => [...document.querySelectorAll("script")]
     .some(s => s.textContent.includes("async function lireTout("))),
   "la fonction de pagination est présente dans l'index.html");

console.log("\n─── La base d'aliments : 3 286, pas 1 000 ───");
ok(await extraire("loadFoods"), "loadFoods est extractible du bundle");
{
  const r = await p.evaluate(async () => {
    window.__journal.pages = {};
    const a = await window.__loadFoods(window.supabase.createClient(), "coach-1");
    return { n: a.length, pages: window.__journal.pages.foods,
             premier: a[0]?.name, dernier: a[a.length - 1]?.name,
             uniques: new Set(a.map(x => x.id)).size };
  });
  ok(r.n === NB_ALIMENTS, `${r.n} aliments chargés sur ${NB_ALIMENTS}`);
  ok(r.uniques === NB_ALIMENTS, `aucun doublon entre les pages (${r.uniques} ids distincts)`);
  ok(r.pages === 4, `${r.pages} requêtes (3 pleines + 1 partielle : c'est ce qui dit la fin)`);
  ok(r.dernier === "Aliment 03285", `la dernière ligne arrive bien (${r.dernier})`);
}

console.log("\n─── Ce que la troncature coûtait au générateur de diète ───");
// Le chiffre qui a motivé le correctif : par rôle, ce qui restait visible.
{
  const r = await p.evaluate(async () => {
    const a = await window.__loadFoods(window.supabase.createClient(), "coach-1");
    const par = (liste) => liste.reduce((acc, f) => (acc[f.role] = (acc[f.role] || 0) + 1, acc), {});
    return { complet: par(a), tronque: par(a.slice(0, 1000)) };
  });
  for (const role of ["proteine", "feculent", "legume", "fruit", "matiere_grasse"]) {
    ok(r.complet[role] > r.tronque[role],
       `${role} : ${r.complet[role]} disponibles désormais, contre ${r.tronque[role]} avant`);
  }
}

console.log("\n─── Les séries d'un coaché : au-delà de 1 000 aussi ───");
ok(await extraire("loadAllSetsFromSupabase"), "loadAllSetsFromSupabase est extractible");
{
  const r = await p.evaluate(async () => {
    window.__journal.pages = {};
    const { allSetLogs, allCompletedSets } = await window.__loadAllSetsFromSupabase(
      window.supabase.createClient(), "c1");
    return { logs: Object.keys(allSetLogs).length, faites: Object.keys(allCompletedSets).length,
             pages: window.__journal.pages.sets_logged };
  });
  // 40 exercices × 4 séries = 160 emplacements distincts sur la semaine 3.
  ok(r.pages === 2, `${r.pages} requêtes pour ${NB_SERIES} lignes`);
  ok(r.logs === 160 && r.faites === 160,
     `les 160 emplacements distincts sont tous lus (${r.logs})`);
}

console.log("\n─── Le garde-fou ───");
// Une pagination qui ne sait pas s'arrêter est un plantage, pas une correction.
{
  const boucle = await p.evaluate(async () => {
    const src = [...document.querySelectorAll("script")].map(s => s.textContent).join("\n");
    return /PAGES_MAX/.test(src) && /page < PAGES_MAX/.test(src);
  });
  ok(boucle, "la boucle est bornée : un serveur qui rendrait toujours des pages pleines l'arrête");
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
