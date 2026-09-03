// ═══════════════════════════════════════════════════════════════════════════
//  LA SEMAINE COMMENCE LE LUNDI, ET « COMMENCER LA SÉANCE » OUVRE LA BONNE
//
//  Deux bugs signalés le 3 septembre 2026, tous deux invisibles en lisant le
//  code et évidents à l'usage.
//
//  1. LA SEMAINE NE BASCULAIT PAS LE LUNDI. currentWeekFromDate comptait des
//     tranches de 7 jours depuis l'INSTANT de création du compte : un coaché
//     inscrit un jeudi à 14 h changeait de semaine le jeudi suivant à 14 h.
//     Deux erreurs dans la même ligne — le mauvais jour, et la mauvaise heure.
//
//  2. « COMMENCER LA SÉANCE » OUVRAIT TOUJOURS LE LUNDI. Le bouton se contentait
//     de naviguer ; la séance affichée restait celle initialisée au démarrage,
//     c'est-à-dire la première du programme.
//
//  Le premier se teste en pur calcul, sur des dates choisies pour tomber sur
//  les cas limites. Le second se teste dans un vrai navigateur, en forçant le
//  jour de la semaine.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });
const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const b = await chromium.launch();

// ═══ 1. LA SEMAINE, EN PUR CALCUL ══════════════════════════════════════════
console.log("\n─── Une semaine va du lundi au dimanche ───");
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);

  // On fige « aujourd'hui » pour éprouver des dates précises. currentWeekFromDate
  // lit l'heure par `new Date()` : on la remplace le temps du calcul.
  const semaine = (creation, aujourdhui) => p.evaluate(([c, a]) => {
    const Vrai = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends Vrai {
      constructor(...args) { super(...(args.length ? args : [a])); }
      static now() { return new Vrai(a).getTime(); }
    };
    try { return currentWeekFromDate(c); } finally { Date = Vrai; }
  }, [creation, aujourdhui]);

  // Compte créé le JEUDI 6 août 2026 à 14 h.
  ok(await semaine("2026-08-06T14:00:00", "2026-08-06T15:00:00") === 1,
     "jeudi de l'inscription → semaine 1");
  ok(await semaine("2026-08-06T14:00:00", "2026-08-09T23:59:00") === 1,
     "dimanche qui suit, 23 h 59 → toujours semaine 1");
  ok(await semaine("2026-08-06T14:00:00", "2026-08-10T00:01:00") === 2,
     "LUNDI 00 h 01 → semaine 2 (l'ancienne version attendait jeudi 14 h)");
  ok(await semaine("2026-08-06T14:00:00", "2026-08-10T13:00:00") === 2,
     "et le lundi à 13 h aussi — le basculement est à minuit, pas à l'heure d'inscription");
  ok(await semaine("2026-08-06T14:00:00", "2026-08-16T23:00:00") === 2,
     "dimanche suivant → encore semaine 2");
  ok(await semaine("2026-08-06T14:00:00", "2026-08-17T08:00:00") === 3,
     "lundi d'après → semaine 3");

  console.log("\n─── Quel que soit le jour d'inscription ───");
  // Sept coachés inscrits chacun un jour différent de la MÊME semaine civile
  // doivent tous être sur la même semaine, et basculer ensemble.
  const memeSemaine = [];
  for (let j = 3; j <= 9; j++) {           // lundi 3 août → dimanche 9 août 2026
    const d = `2026-08-0${j}T09:00:00`;
    memeSemaine.push(await semaine(d, "2026-08-12T10:00:00"));  // mercredi 12
  }
  ok(new Set(memeSemaine).size === 1 && memeSemaine[0] === 2,
     `sept inscriptions de la même semaine donnent toutes la semaine 2 (${memeSemaine.join(",")})`);

  const apres = [];
  for (let j = 3; j <= 9; j++) {
    const d = `2026-08-0${j}T09:00:00`;
    apres.push(await semaine(d, "2026-08-17T00:30:00")); // lundi suivant, 00 h 30
  }
  ok(new Set(apres).size === 1 && apres[0] === 3,
     `et elles basculent toutes ENSEMBLE le lundi à minuit (${apres.join(",")})`);

  console.log("\n─── Cas limites ───");
  ok(await semaine("2026-08-09T23:30:00", "2026-08-10T00:30:00") === 2,
     "inscrit dimanche 23 h 30, lundi 00 h 30 → semaine 2 (une heure plus tard)");
  ok(await semaine(null, "2026-08-10T00:30:00") === 1, "sans date de création → semaine 1");
  ok(await semaine("pas une date", "2026-08-10T00:30:00") === 1, "date illisible → semaine 1");
  // Le passage à l'heure d'hiver 2026 en France : dimanche 25 octobre.
  ok(await semaine("2026-10-19T09:00:00", "2026-10-26T09:00:00") === 2,
     "le changement d'heure ne fait pas perdre un jour");
  await ctx.close();
}

// ═══ 2. LE BOUTON OUVRE LA SÉANCE DU JOUR ══════════════════════════════════
const PROGRAMME = {
  id: "p1", coachee_id: "c1", is_active: true,
  week_structure: [
    { day: "LUNDI",    sessionId: 1 },
    { day: "MARDI",    sessionId: null },
    { day: "MERCREDI", sessionId: 2 },
    { day: "JEUDI",    sessionId: null },
    { day: "VENDREDI", sessionId: 3 },
    { day: "SAMEDI",   sessionId: null },
    { day: "DIMANCHE", sessionId: null },
  ],
  sessions_structure: [
    { id: 1, name: "SEANCE LUNDI",    abdosCardio: [], exercises: [
      { ordre: 1, exercice: "Presse à cuisse", muscle: "Quadriceps", series: 3, reps: ["8","8","8"], repos: "2'00" }] },
    { id: 2, name: "SEANCE MERCREDI", abdosCardio: [], exercises: [
      { ordre: 1, exercice: "Hip thrust barre", muscle: "Fessier/Ischios", series: 3, reps: ["8","8","8"], repos: "2'00" }] },
    { id: 3, name: "SEANCE VENDREDI", abdosCardio: [], exercises: [
      { ordre: 1, exercice: "Tirage vertical", muscle: "Grand dorsal", series: 3, reps: ["8","8","8"], repos: "2'00" }] },
  ],
};

const injection = (jourISO) => `
// On fige le jour de la semaine : le test doit valoir un mercredi comme un
// dimanche, pas seulement le jour où il est joué.
const _Vrai = Date;
const _FIGE = new _Vrai("${jourISO}").getTime();
Date = class extends _Vrai {
  constructor(...a) { super(...(a.length ? a : [_FIGE])); }
  static now() { return _FIGE; }
};
Date.parse = _Vrai.parse; Date.UTC = _Vrai.UTC;

const COACHE = { id: "c1", name: "Marie Dupont", role: "coachee", coach_id: "coach-1",
                 access_code: "MDUPONT27", offer: "premium", is_active: true,
                 created_at: "2026-06-01T09:00:00Z" };
const PROGRAMME = ${JSON.stringify(PROGRAMME)};
function requete(table) {
  const q = { _f: {},
    select(){ return q; }, order(){ return q; }, in(){ return q; }, gte(){ return q; }, limit(){ return q; },
    eq(c,v){ q._f[c]=v; return q; },
    update(){ return q; }, insert: async()=>({data:null,error:null}), upsert: async()=>({data:null,error:null}),
    delete(){ return { eq: async()=>({error:null}) }; },
    single: async()=>({ data: table==="profiles" ? COACHE : table==="programs" ? PROGRAMME : null, error:null }),
    maybeSingle: async()=>({ data: table==="programs" ? PROGRAMME
                                 : table==="weeks" ? { id:"w1", week_number: 1 } : null, error:null }),
    then(res){ return Promise.resolve({ data: [], error: null }).then(res); },
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

async function ouvrirLe(jourISO) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", e => erreurs.push(e.message));
  await p.addInitScript(injection(jourISO));
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  return { ctx, p, erreurs };
}

console.log("\n─── « COMMENCER LA SÉANCE » ouvre la séance du jour ───");
for (const [jour, iso, attendue, autres] of [
  ["MERCREDI", "2026-09-02T10:00:00", "SEANCE MERCREDI", ["SEANCE LUNDI", "SEANCE VENDREDI"]],
  ["VENDREDI", "2026-09-04T10:00:00", "SEANCE VENDREDI", ["SEANCE LUNDI", "SEANCE MERCREDI"]],
  ["LUNDI",    "2026-08-31T10:00:00", "SEANCE LUNDI",    ["SEANCE MERCREDI", "SEANCE VENDREDI"]],
]) {
  const { ctx, p, erreurs } = await ouvrirLe(iso);
  const accueil = await p.locator("body").innerText();
  ok(accueil.includes(attendue), `${jour} · l'accueil annonce « ${attendue} »`);

  await p.locator("text=COMMENCER LA SÉANCE").click();
  await p.waitForTimeout(1200);
  const seance = await p.locator("body").innerText();
  // Le nom de la séance ouverte est affiché en tête de la page Séances.
  const titre = (seance.match(/SEANCE (LUNDI|MERCREDI|VENDREDI)/g) || []);
  ok(titre.includes(attendue), `${jour} · le bouton ouvre « ${attendue} » (vu : ${titre.join(", ") || "rien"})`);
  ok(erreurs.length === 0, `${jour} · aucune erreur applicative (${erreurs.length})`);
  if (jour === "MERCREDI") await p.screenshot({ path: `${CAPTURES}seance-du-jour.png`, fullPage: true });
  await ctx.close();
}

console.log("\n─── Un jour de repos ne casse rien ───");
{
  const { ctx, p, erreurs } = await ouvrirLe("2026-09-05T10:00:00"); // samedi
  const t = await p.locator("body").innerText();
  ok(/JOUR DE REPOS/.test(t), "samedi affiche « jour de repos »");
  ok(!/COMMENCER LA SÉANCE/.test(t), "et aucun bouton de démarrage");
  ok(erreurs.length === 0, `aucune erreur applicative (${erreurs.length})`);
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
