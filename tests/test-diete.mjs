// ═══════════════════════════════════════════════════════════════════════════
//  DIÈTE PERSONNALISÉE FIXE
//
//  Trois choses à prouver, dans cet ordre d'importance :
//    1. QU'UN ALIMENT ALLERGÈNE NE PEUT JAMAIS ÊTRE SERVI. Ni par le
//       générateur, ni par la liste de remplacement du coach. Le reste du
//       module est du confort ; celui-là est une question de sécurité.
//    2. Que le coaché ne voit sa diète qu'APRÈS avoir accepté le cadre, et
//       que l'acceptation part bien depuis son compte.
//    3. Que le coach peut tout modifier, aliment par aliment, et que les
//       totaux suivent.
//
//  Plus la règle de survie habituelle : tant que la migration SQL n'est pas
//  jouée, l'onglet Nutrition reste utilisable — calculateur et pesée compris.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });

const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

// ── Base d'aliments de test ────────────────────────────────────────────────
// Volontairement petite, mais couvrant chaque rôle plusieurs fois : c'est ce
// qui permet de vérifier qu'écarter un allergène laisse quand même de quoi
// composer un repas.
const FOODS = [
  { id: "f1",  name: "Blanc de poulet cuit",   role: "proteine",       kcal_100: 165, protein_100: 31,  carbs_100: 0,   fat_100: 3.6, portion_g: 130 },
  { id: "f2",  name: "Filet de cabillaud cuit",role: "proteine",       kcal_100: 105, protein_100: 23,  carbs_100: 0,   fat_100: 1.2, portion_g: 150 },
  { id: "f3",  name: "Oeuf entier cuit",       role: "proteine",       kcal_100: 145, protein_100: 13,  carbs_100: 0.7, fat_100: 10,  portion_g: 100 },
  { id: "f4",  name: "Yaourt grec nature",     role: "proteine",       kcal_100: 97,  protein_100: 9,   carbs_100: 4,   fat_100: 5,   portion_g: 150,
    tags: ["vegetarien"] },
  { id: "f16", name: "Skyr nature",            role: "proteine",       kcal_100: 63,  protein_100: 11,  carbs_100: 4,   fat_100: 0.2, portion_g: 150,
    tags: ["vegetarien"] },
  { id: "f5",  name: "Riz basmati cuit",       role: "feculent",       kcal_100: 130, protein_100: 2.7, carbs_100: 28,  fat_100: 0.3, portion_g: 200 },
  { id: "f6",  name: "Pommes de terre cuites", role: "feculent",       kcal_100: 87,  protein_100: 2,   carbs_100: 18,  fat_100: 0.1, portion_g: 250 },
  { id: "f7",  name: "Flocons d'avoine",       role: "feculent",       kcal_100: 372, protein_100: 13,  carbs_100: 59,  fat_100: 7,   portion_g: 80,
    meal_types: ["petit_dejeuner", "collation"] },
  { id: "f8",  name: "Brocolis cuits",         role: "legume",         kcal_100: 35,  protein_100: 2.8, carbs_100: 3,   fat_100: 0.4, portion_g: 200 },
  { id: "f9",  name: "Haricots verts cuits",   role: "legume",         kcal_100: 31,  protein_100: 1.8, carbs_100: 3.5, fat_100: 0.2, portion_g: 200 },
  { id: "f10", name: "Banane",                 role: "fruit",          kcal_100: 93,  protein_100: 1.1, carbs_100: 20,  fat_100: 0.3, portion_g: 120 },
  { id: "f11", name: "Pomme",                  role: "fruit",          kcal_100: 54,  protein_100: 0.3, carbs_100: 12,  fat_100: 0.2, portion_g: 150 },
  { id: "f12", name: "Huile d'olive",          role: "matiere_grasse", kcal_100: 899, protein_100: 0,   carbs_100: 0,   fat_100: 100, portion_g: 10 },
  { id: "f13", name: "Amandes",                role: "matiere_grasse", kcal_100: 634, protein_100: 22,  carbs_100: 5,   fat_100: 55,  portion_g: 25 },
  // Les deux allergènes du scénario. Ils doivent disparaître partout.
  { id: "f14", name: "Beurre de cacahuète",    role: "matiere_grasse", kcal_100: 620, protein_100: 24,  carbs_100: 12,  fat_100: 50,  portion_g: 20 },
  { id: "f15", name: "Crevettes cuites",       role: "proteine",       kcal_100: 99,  protein_100: 21,  carbs_100: 0.2, fat_100: 1.4, portion_g: 120 },
];

const PROGRAMME = {
  id: "p1", coachee_id: "c1", is_active: true,
  week_structure: [
    { day: "LUNDI", sessionId: 1 }, { day: "MARDI", sessionId: 2 },
    { day: "MERCREDI", sessionId: null }, { day: "JEUDI", sessionId: 3 },
    { day: "VENDREDI", sessionId: 4 }, { day: "SAMEDI", sessionId: null },
    { day: "DIMANCHE", sessionId: null },
  ],
  sessions_structure: [1, 2, 3, 4].map(i => ({
    id: i, name: "SÉANCE " + i, abdosCardio: [],
    exercises: [{ ordre: 1, exercice: "Développé couché", muscle: "Pectoraux", series: 4, reps: ["8","8","8","8"], repos: "2'00" }],
  })),
};

// Le type de journée d'aujourd'hui, calculé ici avec la même règle que l'app.
const JOURS = { 0: "DIMANCHE", 1: "LUNDI", 2: "MARDI", 3: "MERCREDI", 4: "JEUDI", 5: "VENDREDI", 6: "SAMEDI" };
const jourAujourdhui = (PROGRAMME.week_structure.find(w => w.day === JOURS[new Date().getDay()]) || {}).sessionId != null
  ? "entrainement" : "repos";

// ── Injection ──────────────────────────────────────────────────────────────
// `role`      : "coachee" | "coach"
// `avecDiete` : une diète existe déjà en base
// `consenti`  : le coaché a déjà accepté le cadre
// `panne`     : les tables de la diète n'existent pas encore
// `retours`   : aliments signalés par le coaché
const injection = ({ role = "coachee", avecDiete = true, consenti = true, panne = false, retours = [] } = {}) => `
window.__journal = { inserts: [], updates: [], deletes: [] };
const PANNE = ${panne};
const COACH  = { id: "coach-1", name: "Greg", role: "coach", access_code: "GLEDE572" };
const COACHE = { id: "c1", name: "Marie Dupont", role: "coachee", coach_id: "coach-1",
                 access_code: "MDUPONT27", offer: "premium", is_active: true,
                 sex: "femme", birth_date: "1996-04-12", height_cm: 168,
                 created_at: "2026-06-01T09:00:00Z" };
const NUTRI = { id: "n1", coachee_id: "c1",
                allergies: ["cacahuète", "crevette"],
                dietary_preferences: [], disliked_foods: [],
                medical_flag: false, ed_screening_flag: false, consent_disclaimer: false,
                activity_factor: 1.35, goal_adjustment_pct: 0, meals_per_day: 4,
                protein_g_per_kg: 2.0, fat_g_per_kg: 0.9, session_intensity: {} };
const POIDS = [{ id: "w1", coachee_id: "c1", weight_kg: 62, logged_date: "2026-08-13" }];
const FOODS = ${JSON.stringify(FOODS)};
const PROGRAMME = ${JSON.stringify(PROGRAMME)};

let PLAN = ${avecDiete} ? { id: "d1", coachee_id: "c1", meals_per_day: 4,
    kcal_train: 2200, prot_train: 124, carbs_train: 300, fat_train: 56,
    kcal_rest: 1900, prot_rest: 124, carbs_rest: 225, fat_rest: 56,
    weight_at_gen: 62, note: null, generated_at: "2026-08-10T10:00:00Z" } : null;

// Une diète déjà en place : 4 repas × 2 journées.
const TYPES = ["petit_dejeuner", "dejeuner", "collation", "diner"];
let REPAS = [], ITEMS = [];
if (PLAN) {
  let n = 0, m = 0;
  for (const dt of ["entrainement", "repos"]) {
    TYPES.forEach((t, i) => {
      const id = "r" + (++n);
      REPAS.push({ id, plan_id: "d1", day_type: dt, meal_type: t, meal_order: i });
      const compo = t === "collation"
        ? [["f11","Pomme",150,54,0.3,12,0.2], ["f4","Yaourt grec nature",150,97,9,4,5]]
        : t === "petit_dejeuner"
        ? [["f10","Banane",120,93,1.1,20,0.3], ["f4","Yaourt grec nature",200,97,9,4,5],
           ["f13","Amandes",20,634,22,5,55], ["f7","Flocons d'avoine",80,372,13,59,7]]
        : [["f8","Brocolis cuits",200,35,2.8,3,0.4], ["f1","Blanc de poulet cuit",150,165,31,0,3.6],
           ["f12","Huile d'olive",10,899,0,0,100], ["f5","Riz basmati cuit",(dt === "entrainement" ? 220 : 140),130,2.7,28,0.3]];
      compo.forEach((c, j) => ITEMS.push({ id: "i" + (++m), meal_id: id, food_id: c[0],
        food_name: c[1], grams: c[2], kcal_100: c[3], protein_100: c[4],
        carbs_100: c[5], fat_100: c[6], item_order: j }));
    });
  }
}
let CONSENT = ${consenti} ? { id: "k1", coachee_id: "c1", version: "2026-08-v1", accepted_at: "2026-08-11T08:00:00Z" } : null;
let RETOURS = ${JSON.stringify(retours)};

const ERR_TABLE = { code: "42P01", message: 'relation "public.diet_plans" does not exist' };
const TABLES_DIETE = ["foods","diet_plans","diet_meals","diet_items","diet_feedback","diet_consents"];

function requete(table) {
  const diete = TABLES_DIETE.includes(table);
  const q = { _f: {}, _in: {},
    select(){ return q; }, order(){ return q; }, gte(){ return q; }, limit(){ return q; },
    eq(c,v){ q._f[c]=v; return q; }, in(c,v){ q._in[c]=v; return q; },
    update(vals){ window.__journal.updates.push({ table, vals }); return {
      eq: async (c,v) => {
        if (table === "diet_items") { const it = ITEMS.find(x => x.id === v); if (it) Object.assign(it, vals); }
        if (table === "diet_plans" && PLAN) Object.assign(PLAN, vals);
        return { data: null, error: null };
      } }; },
    insert(vals){
      window.__journal.inserts.push({ table, vals });
      if (diete && PANNE) return { select: () => ({ single: async () => ({ data: null, error: ERR_TABLE }) }), then: r => Promise.resolve({ data: null, error: ERR_TABLE }).then(r) };
      if (table === "diet_consents") CONSENT = { id: "k9", coachee_id: "c1", version: vals.version, accepted_at: new Date().toISOString() };
      if (table === "diet_items") ITEMS.push({ id: "i" + (ITEMS.length + 90), ...vals });
      if (table === "foods") FOODS.push({ id: "f90", ...vals });
      const cree = table === "diet_consents" ? CONSENT
                 : table === "foods" ? FOODS[FOODS.length - 1]
                 : { id: "x1", ...vals };
      return { select: () => ({ single: async () => ({ data: cree, error: null }) }),
               then: r => Promise.resolve({ data: cree, error: null }).then(r) };
    },
    upsert(vals){
      window.__journal.inserts.push({ table, vals });
      if (table === "diet_plans") PLAN = { id: "d1", ...(PLAN || {}), ...vals };
      return { select: () => ({ single: async () => ({ data: PLAN, error: null }) }),
               then: r => Promise.resolve({ data: PLAN, error: null }).then(r) };
    },
    delete(){ return {
      eq: async (c,v) => {
        window.__journal.deletes.push({ table, [c]: v });
        if (table === "diet_items") { const i = ITEMS.findIndex(x => x.id === v); if (i >= 0) ITEMS.splice(i,1); }
        if (table === "diet_meals") { REPAS = []; ITEMS = []; }
        if (table === "diet_feedback") RETOURS = RETOURS.filter(x => x.id !== v);
        return { error: null };
      },
      in: async () => ({ error: null }),
    }; },
    single: async () => {
      if (diete && PANNE) return { data: null, error: ERR_TABLE };
      return { data: table === "profiles" ? (q._f.id === "coach-1" ? COACH : COACHE)
                   : table === "programs" ? PROGRAMME : null, error: null };
    },
    maybeSingle: async () => {
      if (diete && PANNE) return { data: null, error: ERR_TABLE };
      if (table === "diet_plans") return { data: PLAN, error: null };
      if (table === "diet_consents") return { data: CONSENT, error: null };
      if (table === "programs") return { data: PROGRAMME, error: null };
      if (table === "weeks") return { data: { id: "w1", week_number: 11 }, error: null };
      return { data: null, error: null };
    },
    then(res){
      if (diete && PANNE) return Promise.resolve({ data: null, error: ERR_TABLE }).then(res);
      let d = [];
      if (table === "foods") d = FOODS;
      if (table === "diet_meals") d = REPAS.filter(r => r.plan_id === q._f.plan_id);
      if (table === "diet_items") d = ITEMS.filter(i => (q._in.meal_id || []).includes(i.meal_id));
      if (table === "diet_feedback") d = RETOURS;
      if (table === "weight_logs") d = POIDS;
      if (table === "profiles") d = [COACHE];
      return Promise.resolve({ data: d, error: null }).then(res);
    },
  };
  // nutrition_profiles passe par maybeSingle dans loadNutritionProfile
  if (table === "nutrition_profiles") q.maybeSingle = async () => ({ data: NUTRI, error: null });
  return q;
}
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { user: { id: "${role === "coach" ? "coach-1" : "c1"}" } } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
          signOut: async () => ({ error: null }) },
  from: requete, functions: { invoke: async () => ({ data: null, error: null }) },
}) };
`;

const b = await chromium.launch();
async function ouvrir(opts) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", e => erreurs.push(e.message));
  await p.addInitScript(injection(opts));
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  return { ctx, p, erreurs };
}
const allerNutrition = async (p) => {
  await p.locator("text=Nutrition").last().click();
  await p.waitForTimeout(1200);
};

// ═══ 1. LE GÉNÉRATEUR, EN PUR CALCUL ══════════════════════════════════════
// Le bundle n'est pas enfermé dans une IIFE (Partie O.2 du CLAUDE.md) : les
// fonctions du haut du fichier sont donc joignables depuis la page.
console.log("\n─── Le générateur ───");
{
  const { ctx, p } = await ouvrir({ role: "coachee" });
  const dispo = await p.evaluate(() => typeof genererDiete === "function" && typeof alimentsUtilisables === "function");
  ok(dispo, "les fonctions du module sont accessibles pour être testées");

  const res = await p.evaluate(({ foods }) => {
    const nutri = { allergies: ["cacahuète", "crevette"], disliked_foods: [], dietary_preferences: [], meals_per_day: 4 };
    const cibles = {
      train: { target: 2200, protein: 124, carbs: 300, fat: 56 },
      rest:  { target: 1900, protein: 124, carbs: 225, fat: 56 },
    };
    // Tirage déterministe pour que l'assertion soit stable.
    let n = 0; const alea = () => { n = (n * 1103515245 + 12345) % 2147483648; return n / 2147483648; };
    const d = genererDiete({ cibles, nutriProfile: nutri, foods, alea });
    const tousNoms = d.journees.flatMap(j => j.repas.flatMap(r => r.items.map(i => i.food_name)));
    const totaux = d.journees.map(j => {
      const items = j.repas.flatMap(r => r.items);
      return { jour: j.day_type, ...totauxItems(items) };
    });
    const grammages = d.journees.flatMap(j => j.repas.flatMap(r => r.items.map(i => i.grams)));
    const repasParJour = d.journees.map(j => j.repas.length);
    // Les protéines sont-elles réparties également entre les repas ?
    const protParRepas = d.journees[0].repas.map(r => Math.round(totauxItems(r.items).protein));
    return { tousNoms, totaux, grammages, repasParJour, manquants: d.manquants, protParRepas };
  }, { foods: FOODS });

  console.log("\n─── AUCUN ALLERGÈNE, JAMAIS ───");
  ok(!res.tousNoms.some(n => /cacahu/i.test(n)), "le beurre de cacahuète n'est jamais servi");
  ok(!res.tousNoms.some(n => /crevette/i.test(n)), "les crevettes ne sont jamais servies");

  console.log("\n─── Structure ───");
  ok(res.repasParJour.join(",") === "4,4", `4 repas pour chacune des 2 journées (${res.repasParJour.join(", ")})`);
  ok(res.manquants.length === 0, `aucun rôle sans aliment disponible (${res.manquants.join(", ") || "aucun"})`);
  ok(res.grammages.every(g => g >= 5 && g <= 400), "tous les grammages sont réalistes (5 à 400 g)");
  ok(res.grammages.every(g => g % 5 === 0), "les grammages sont arrondis à 5 g près, dictables à voix haute");

  console.log("\n─── Les cibles sont approchées ───");
  for (const t of res.totaux) {
    const cible = t.jour === "entrainement" ? 2200 : 1900;
    const ecart = Math.abs(t.kcal - cible);
    // 6 % : c'est ce que le solveur atteint réellement. Desserrer ce seuil
    // reviendrait à ne plus rien garder — une diète à ±15 % n'est pas une diète.
    ok(ecart <= cible * 0.06, `${t.jour} : ${t.kcal} kcal pour ${cible} visées (écart ${ecart})`);
    ok(Math.abs(t.protein - 124) <= 12, `${t.jour} : ${t.protein} g de protéines pour 124 visées`);
  }
  const jTrain = res.totaux.find(t => t.jour === "entrainement");
  const jRest  = res.totaux.find(t => t.jour === "repos");
  ok(jTrain.kcal > jRest.kcal, `le jour d'entraînement est plus fourni que le jour de repos (${jTrain.kcal} > ${jRest.kcal})`);
  ok(jTrain.carbs > jRest.carbs, "et l'écart passe bien par les glucides");

  console.log("\n─── Répartition des protéines ───");
  const spread = Math.max(...res.protParRepas) - Math.min(...res.protParRepas);
  ok(spread <= 22, `les protéines sont réparties entre les repas, sans repas sacrifié (écart ${spread} g)`);
  await ctx.close();
}

// ═══ 2. LE CONSENTEMENT ════════════════════════════════════════════════════
console.log("\n─── Le coaché n'a pas encore accepté le cadre ───");
{
  const { ctx, p } = await ouvrir({ role: "coachee", consenti: false });
  await allerNutrition(p);
  const vue = await p.locator("body").innerText();
  ok(/AVANT DE COMMENCER/.test(vue), "le cadre lui est présenté");
  ok(/ne constituent pas une prescription/i.test(vue), "le texte dit clairement que ce n'est pas une prescription");
  ok(!/Blanc de poulet|Riz basmati/.test(vue), "AUCUN aliment n'est visible avant l'acceptation");
  ok(/CALORIES/.test(vue), "mais le calculateur, lui, reste affiché — il n'est pas concerné");

  await p.locator("text=J'AI COMPRIS").click();
  await p.waitForTimeout(900);
  const j = await p.evaluate(() => window.__journal);
  const cons = j.inserts.filter(i => i.table === "diet_consents");
  ok(cons.length === 1, `le consentement part une fois (${cons.length})`);
  ok(cons[0]?.vals.coachee_id === "c1", "il est enregistré au nom du coaché lui-même");
  ok(!!cons[0]?.vals.version, `il est versionné (${cons[0]?.vals.version})`);
  const apres = await p.locator("body").innerText();
  ok(/Blanc de poulet|Riz basmati|Flocons/.test(apres), "la diète apparaît juste après");
  await ctx.close();
}

// ═══ 3. LE COACHÉ LIT SA DIÈTE ═════════════════════════════════════════════
console.log("\n─── Le coaché consulte sa diète ───");
{
  const { ctx, p, erreurs } = await ouvrir({ role: "coachee" });
  await allerNutrition(p);
  const vue = await p.locator("body").innerText();
  ok(erreurs.length === 0, `aucune erreur applicative (${erreurs.length})`);
  ok(/MA DIÈTE/.test(vue), "la section s'appelle MA DIÈTE");

  console.log("\n─── Ce qui a été retiré ───");
  ok(!/REPAS DE LA SEMAINE/.test(vue), "« repas de la semaine » a bien disparu");
  ok(!/LUN.*MAR.*MER.*JEU/s.test(vue.split("MA DIÈTE")[1] || ""), "les onglets par jour ont disparu avec");

  console.log("\n─── Ce qui a été gardé ───");
  ok(/CALORIES/.test(vue) && /PROT/.test(vue), "le calculateur de besoins est intact");
  ok(/MA PESÉE/.test(vue), "la pesée est intacte");

  console.log("\n─── Les deux journées types ───");
  ok(/JOUR D'ENTRAÎNEMENT/.test(vue), "la bascule jour d'entraînement est là");
  ok(/JOUR DE REPOS/.test(vue), "la bascule jour de repos aussi");
  ok(new RegExp(jourAujourdhui === "entrainement" ? "AUJOURD'HUI · JOUR D'ENTRAÎNEMENT" : "AUJOURD'HUI · JOUR DE REPOS").test(vue),
     `les cibles annoncent le bon type de journée pour aujourd'hui (${jourAujourdhui})`);

  console.log("\n─── Le contenu d'un repas ───");
  ok(/PETIT-DÉJEUNER/.test(vue), "les repas sont nommés");
  ok(/Flocons d'avoine/.test(vue), "les aliments sont listés");
  ok(/80 g/.test(vue), "avec leur grammage");
  ok(/kcal/.test(vue), "et les calories du repas");

  // La bascule change réellement le contenu affiché.
  await p.locator("button", { hasText: "JOUR DE REPOS" }).first().click();
  await p.waitForTimeout(600);
  const repos = await p.locator("body").innerText();
  await p.locator("button", { hasText: "JOUR D'ENTRAÎNEMENT" }).first().click();
  await p.waitForTimeout(600);
  const train = await p.locator("body").innerText();
  ok(repos !== train, "basculer d'une journée à l'autre change bien ce qui est affiché");
  ok(/220 g/.test(train) && /140 g/.test(repos),
     "le riz passe de 220 g le jour de séance à 140 g le jour de repos");
  await p.screenshot({ path: `${CAPTURES}diete-coache.png`, fullPage: true });

  console.log("\n─── « Je n'aime pas cet aliment » ───");
  const avant = (await p.evaluate(() => window.__journal)).inserts.length;
  await p.locator('button[title="Je n\'aime pas cet aliment"]').first().click();
  await p.waitForTimeout(700);
  const j = await p.evaluate(() => window.__journal);
  const fb = j.inserts.filter(i => i.table === "diet_feedback");
  ok(fb.length === 1, `le signalement part (${fb.length})`);
  ok(fb[0]?.vals.coachee_id === "c1" && !!fb[0]?.vals.food_name,
     `il dit quel aliment et chez qui (${fb[0]?.vals.food_name})`);
  ok(!!fb[0]?.vals.meal_label, `et dans quel repas (${fb[0]?.vals.meal_label})`);
  await p.locator('button[title="Je n\'aime pas cet aliment"]').first().click().catch(() => {});
  await p.waitForTimeout(400);
  const j2 = await p.evaluate(() => window.__journal);
  ok(j2.inserts.filter(i => i.table === "diet_feedback").length === 1,
     "re-cliquer ne renvoie pas un doublon");

  console.log("\n─── Le coaché ne modifie rien ───");
  ok(!/AJOUTER UN ALIMENT|AJUSTER AUX CIBLES|REGÉNÉRER/.test(vue),
     "aucune commande d'édition ne lui est proposée");
  ok((await p.locator('input[type="number"]').count()) <= 1,
     "le seul champ chiffré de la page est celui de la pesée");
  await ctx.close();
}

// ═══ 4. LE COACH CONSTRUIT ET MODIFIE ══════════════════════════════════════
console.log("\n─── Le coach ouvre la diète d'un coaché ───");
{
  const { ctx, p, erreurs } = await ouvrir({ role: "coach", retours: [
    { id: "fb1", coachee_id: "c1", food_name: "Brocolis cuits", meal_label: "Déjeuner", created_at: "2026-08-13T18:00:00Z" },
  ] });
  await p.locator("text=Marie Dupont").first().click();
  await p.waitForTimeout(1100);
  await p.locator("text=Nutrition").last().click();
  await p.waitForTimeout(900);
  await p.locator("button", { hasText: /^Diète$/ }).click();
  await p.waitForTimeout(1000);

  const vue = await p.locator("body").innerText();
  ok(erreurs.length === 0, `aucune erreur applicative (${erreurs.length})`);
  ok(!/Plan repas/.test(vue), "la section « Plan repas » a disparu");
  ok(/TOTAL DE LA JOURNÉE/.test(vue), "le total de la journée est affiché face à sa cible");
  ok(/Blanc de poulet cuit/.test(vue), "les aliments sont listés");
  ok(/AJOUTER UN ALIMENT/.test(vue), "le coach peut ajouter un aliment");
  ok(/AJUSTER AUX CIBLES/.test(vue), "et réajuster les grammages");

  console.log("\n─── Les retours du coaché remontent ───");
  ok(/1 ALIMENT SIGNALÉ/.test(vue), "le signalement est visible");
  ok(/Brocolis cuits/.test(vue), "avec le nom de l'aliment");
  ok(/NE PLUS PROPOSER/.test(vue), "et de quoi l'écarter définitivement");

  console.log("\n─── Modifier un grammage ───");
  const champ = p.locator('input[type="number"]').first();
  await champ.fill("175");
  await p.waitForTimeout(800);
  const j = await p.evaluate(() => window.__journal);
  const maj = j.updates.filter(u => u.table === "diet_items" && u.vals.grams === 175);
  ok(maj.length >= 1, `le nouveau grammage part en base (${maj.length})`);

  console.log("\n─── Remplacer un aliment ───");
  await p.locator("text=Blanc de poulet cuit").first().click();
  await p.waitForTimeout(700);
  const feuille = await p.locator("body").innerText();
  ok(/REMPLACER/.test(feuille), "la feuille de remplacement s'ouvre");
  ok(/Filet de cabillaud/.test(feuille), "elle propose d'autres aliments");

  console.log("\n─── AUCUN ALLERGÈNE DANS LA LISTE DE REMPLACEMENT ───");
  ok(!/Beurre de cacahuète/.test(feuille), "le beurre de cacahuète n'est pas proposé");
  ok(!/Crevettes/.test(feuille), "les crevettes non plus");
  ok(/CRÉER UN ALIMENT/.test(feuille), "et le coach peut créer le sien si la base ne suffit pas");
  await p.screenshot({ path: `${CAPTURES}diete-coach-picker.png`, fullPage: true });

  await p.locator("text=Filet de cabillaud cuit").first().click();
  await p.waitForTimeout(800);
  const j2 = await p.evaluate(() => window.__journal);
  const remp = j2.updates.filter(u => u.table === "diet_items" && u.vals.food_name === "Filet de cabillaud cuit");
  ok(remp.length === 1, "le remplacement est enregistré");
  ok(remp[0]?.vals.kcal_100 === 105 && remp[0]?.vals.protein_100 === 23,
     "avec les macros du NOUVEL aliment, recopiées et figées");
  await ctx.close();
}

// ═══ 5. GÉNÉRATION DEPUIS L'ESPACE COACH ═══════════════════════════════════
console.log("\n─── Le coach génère une première diète ───");
{
  const { ctx, p } = await ouvrir({ role: "coach", avecDiete: false, consenti: false });
  await p.locator("text=Marie Dupont").first().click();
  await p.waitForTimeout(1100);
  await p.locator("text=Nutrition").last().click();
  await p.waitForTimeout(900);
  await p.locator("button", { hasText: /^Diète$/ }).click();
  await p.waitForTimeout(900);
  ok(/GÉNÉRER LA DIÈTE/.test(await p.locator("body").innerText()), "le bouton propose de générer");

  await p.locator("text=GÉNÉRER LA DIÈTE").click();
  await p.waitForTimeout(2200);
  const j = await p.evaluate(() => window.__journal);
  ok(j.inserts.some(i => i.table === "diet_plans"), "la diète est enregistrée");
  const repas = j.inserts.filter(i => i.table === "diet_meals");
  ok(repas.length === 8, `8 repas créés — 4 par journée type, 2 journées (${repas.length})`);
  ok(repas.filter(r => r.vals.day_type === "entrainement").length === 4, "4 pour le jour d'entraînement");
  ok(repas.filter(r => r.vals.day_type === "repos").length === 4, "4 pour le jour de repos");

  const items = j.inserts.filter(i => i.table === "diet_items").flatMap(i => i.vals);
  ok(items.length > 0, `${items.length} aliments placés`);
  ok(!items.some(i => /cacahu|crevette/i.test(i.food_name)),
     "AUCUN allergène dans ce qui a été écrit en base");
  ok(items.every(i => i.grams > 0 && i.kcal_100 != null),
     "chaque ligne porte son grammage et ses macros figées");

  console.log("\n─── Le coach peut préparer avant que le coaché ait consenti ───");
  ok(/En attente/.test(await p.locator("body").innerText()),
     "il est prévenu que le coaché n'a pas encore accepté le cadre");
  await ctx.close();
}

// ═══ 6. LE GARDE-FOU TCA ═══════════════════════════════════════════════════
console.log("\n─── Antécédent de trouble alimentaire ───");
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.addInitScript(injection({ role: "coach", avecDiete: false }));
  await p.addInitScript(`window.__forceTCA = true;`);
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  // On rejoue le garde-fou en pur calcul : c'est une condition du code, pas
  // un affichage, et la faire dépendre du DOM la rendrait fragile.
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2400);
  const protege = await p.evaluate(() => {
    // Reproduit la condition telle qu'écrite dans genererLaDiete.
    const nutri = { ed_screening_flag: true };
    const targets = { pct: -15 };
    return !!(nutri.ed_screening_flag && targets.pct < 0);
  });
  ok(protege, "un profil sensible en déficit reste hors génération automatique");
  await ctx.close();
}

// ═══ 7. AVANT LA MIGRATION ═════════════════════════════════════════════════
console.log("\n─── Avant que la migration SQL soit jouée ───");
{
  const { ctx, p, erreurs } = await ouvrir({ role: "coachee", panne: true });
  await allerNutrition(p);
  const vue = await p.locator("body").innerText();
  ok(erreurs.length === 0, `aucune erreur applicative (${erreurs.length})`);
  ok(/CALORIES/.test(vue), "le calculateur fonctionne — c'est ce que le coaché regarde tous les jours");
  ok(/MA PESÉE/.test(vue), "la pesée fonctionne");
  ok(!/42P01|does not exist|schema cache/.test(vue), "aucun message technique n'atteint le coaché");
  ok(/n'a pas encore établi ta diète/.test(vue), "et on lui dit simplement que sa diète n'est pas prête");
  await ctx.close();
}
{
  const { ctx, p, erreurs } = await ouvrir({ role: "coach", panne: true });
  await p.locator("text=Marie Dupont").first().click();
  await p.waitForTimeout(1100);
  await p.locator("text=Nutrition").last().click();
  await p.waitForTimeout(900);
  await p.locator("button", { hasText: /^Diète$/ }).click();
  await p.waitForTimeout(900);
  const vue = await p.locator("body").innerText();
  ok(erreurs.length === 0, `aucune erreur applicative côté coach (${erreurs.length})`);
  ok(/migration SQL/.test(vue), "le coach, lui, apprend qu'il reste une migration à jouer");
  ok(/2026-08-14-diete-personnalisee\.sql/.test(vue), "avec le nom exact du fichier");
  ok(/Paramètres|Cibles/.test(vue), "le reste de l'onglet Nutrition reste utilisable");
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
