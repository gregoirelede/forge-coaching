// ═══════════════════════════════════════════════════════════════════════════
//  Tableau de bord d'assiduité (Espace coach → Suivi).
//
//  Supabase est simulé avec quatre coachés aux comportements bien distincts :
//  assidu, en retard, décroché, jamais démarré. On vérifie le classement, les
//  compteurs, les libellés, et surtout la règle de calcul du taux.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });

const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

// Le coaching a démarré il y a 5 semaines pile : la semaine en cours est la 6e.
const DEBUT = new Date(Date.now() - 35 * 86400000).toISOString();
const ilYA = (jours) => new Date(Date.now() - jours * 86400000).toISOString();

const injection = `
window.__journal = { requetes: [] };
const DEBUT = ${JSON.stringify(DEBUT)};
const COACH = { id: "coach-1", name: "Greg", role: "coach", access_code: "COACH" };

// 4 coachés, 4 comportements
const COACHES = [
  { id: "assidu",  name: "Alice Assidue",  role: "coachee", coach_id: "coach-1", offer: "premium",   is_active: true, access_code: "AASSIDUE11", created_at: DEBUT },
  { id: "retard",  name: "Bruno Retard",   role: "coachee", coach_id: "coach-1", offer: "essentiel", is_active: true, access_code: "BRETARD22",  created_at: DEBUT },
  { id: "decroche",name: "Chloe Decroche", role: "coachee", coach_id: "coach-1", offer: "essentiel", is_active: true, access_code: "CDECROCHE3", created_at: DEBUT },
  { id: "neuf",    name: "David Neuf",     role: "coachee", coach_id: "coach-1", offer: "essentiel", is_active: true, access_code: "DNEUF4455",  created_at: DEBUT },
  { id: "inactif", name: "Eve Inactive",   role: "coachee", coach_id: "coach-1", offer: "essentiel", is_active: false, access_code: "EINACTIVE5", created_at: DEBUT },
];

// 3 séances prévues par semaine pour tout le monde
const SEMAINE = [
  { day: "LUNDI", sessionId: 1 }, { day: "MARDI", sessionId: null },
  { day: "MERCREDI", sessionId: 2 }, { day: "JEUDI", sessionId: null },
  { day: "VENDREDI", sessionId: 3 }, { day: "SAMEDI", sessionId: null },
  { day: "DIMANCHE", sessionId: null },
];
const PROGRAMMES = ["assidu","retard","decroche","neuf"].map(id =>
  ({ coachee_id: id, week_structure: SEMAINE }));

const ilYA = (j) => new Date(Date.now() - j * 86400000).toISOString();
const SERIES = [];
// Alice : 3 séances sur chacune des semaines 2 à 5, et 2 déjà cette semaine (6)
for (const sem of [2,3,4,5]) for (const sid of [1,2,3])
  SERIES.push({ coachee_id: "assidu", session_config_id: sid, logged_at: ilYA((6-sem)*7+2), week: { week_number: sem } });
for (const sid of [1,2])
  SERIES.push({ coachee_id: "assidu", session_config_id: sid, logged_at: ilYA(1), week: { week_number: 6 } });

// Bruno : 1 seule séance par semaine sur 2 à 5, rien cette semaine.
// (6-sem)*7+1 place chaque séance dans SA semaine — la dernière il y a 8 jours.
for (const sem of [2,3,4,5])
  SERIES.push({ coachee_id: "retard", session_config_id: 1, logged_at: ilYA((6-sem)*7+1), week: { week_number: sem } });

// Chloe : plus rien depuis 15 jours
SERIES.push({ coachee_id: "decroche", session_config_id: 1, logged_at: ilYA(15), week: { week_number: 4 } });

// David : aucune série

function requete(table) {
  const q = { _f: {},
    select(){ return q; }, order(){ return q; }, limit(){ return q; },
    update(){ return q; }, insert: async()=>({data:null,error:null}), upsert: async()=>({data:null,error:null}),
    delete(){ return { eq: async()=>({error:null}) }; },
    eq(col,val){ q._f[col]=val; return q; },
    in(col,vals){ q._f[col]=vals; return q; },
    gte(col,val){ q._f['gte_'+col]=val; return q; },
    single: async()=>({ data: COACH, error:null }),
    maybeSingle: async()=>({ data:null, error:null }),
    then(res){
      window.__journal.requetes.push({ table, filtres: JSON.parse(JSON.stringify(q._f)) });
      let d = [];
      if (table === "profiles") d = COACHES;
      if (table === "programs") d = PROGRAMMES;
      if (table === "sets_logged") {
        d = SERIES;
        const seuil = q._f['gte_logged_at'];
        if (seuil) d = d.filter(x => x.logged_at >= seuil);
      }
      return Promise.resolve({ data: d, error: null }).then(res);
    },
  };
  return q;
}

window.supabase = { createClient: () => ({
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "coach-1" } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
    signOut: async () => ({ error: null }),
  },
  from: requete,
  functions: { invoke: async () => ({ data: null, error: null }) },
}) };
`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.addInitScript(injection);
await p.route("**/cdn.jsdelivr.net/**", r =>
  r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2200);

console.log("\n─── L'onglet Suivi existe ───");
const onglet = p.locator("text=Suivi").last();
ok(await onglet.count() > 0, "l'onglet « Suivi » est dans la barre du coach");
await onglet.click();
await p.waitForTimeout(1200);

const page = await p.locator("body").innerText();
ok(/SUIVI/.test(page), "la page Suivi s'ouvre");

console.log("\n─── La requête est bornée dans le temps ───");
const req = await p.evaluate(() => window.__journal.requetes.find(r => r.table === "sets_logged"));
ok(!!req, "les séries sont chargées");
ok(req && !!req.filtres.gte_logged_at, "la requête est bornée par une date de début");
if (req?.filtres?.gte_logged_at) {
  const jours = Math.round((Date.now() - new Date(req.filtres.gte_logged_at)) / 86400000);
  ok(jours >= 55 && jours <= 57, `l'historique chargé remonte à ${jours} jours (8 semaines)`);
}
ok(req && Array.isArray(req.filtres.coachee_id) && !req.filtres.coachee_id.includes("inactif"),
   "un coaché désactivé n'est pas chargé");

console.log("\n─── Compteurs en haut de page ───");
const bloc = (label) => p.evaluate((l) => {
  const t = [...document.querySelectorAll("div")].find(d => d.textContent.trim() === l && !d.children.length);
  return t ? t.parentElement.innerText : null;
}, label);
ok(/1\s*\nDÉCROCHAGE/.test(await bloc("DÉCROCHAGE") || ""), "1 en décrochage (Chloé, 15 jours)");
ok(/1\s*\nÀ RELANCER/.test(await bloc("À RELANCER") || ""), "1 à relancer (Bruno, 8 jours)");
ok(/1\s*\nÀ JOUR/.test(await bloc("À JOUR") || ""), "1 à jour (Alice, hier)");
ok(/2 coachés à relancer/.test(page), "le sous-titre résume l'urgence du jour");

console.log("\n─── Classement : le plus urgent en premier ───");
const noms = await p.evaluate(() => [...document.querySelectorAll("div")]
  .filter(d => /^(Alice Assidue|Bruno Retard|Chloe Decroche|David Neuf|Eve Inactive)$/.test(d.textContent.trim()) && !d.children.length)
  .map(d => d.textContent.trim()));
ok(noms[0] === "Chloe Decroche", `le décrochage arrive en tête (${noms[0]})`);
ok(noms[1] === "Bruno Retard", `puis celui à relancer (${noms[1]})`);
ok(noms.indexOf("Alice Assidue") > noms.indexOf("Bruno Retard"), "l'assidue passe après");
ok(!noms.includes("Eve Inactive"), "le coaché désactivé n'apparaît pas");

console.log("\n─── Chiffres par coaché ───");
const carte = (nom) => p.evaluate((n) => {
  const t = [...document.querySelectorAll("div")].find(d => d.textContent.trim() === n && !d.children.length);
  // nom → colonne → ligne d'en-tête → carte entière (la progression est
  // un frère de la ligne, pas un descendant).
  return t ? t.parentElement.parentElement.parentElement.innerText : null;
}, nom);

const alice = await carte("Alice Assidue");
ok(/SEMAINE 6 · 2\/3 SÉANCES/.test(alice || ""), `Alice : ${alice?.match(/SEMAINE[^\n]*/)?.[0]}`);
ok(/100% SUR 4 SEM\./.test(alice || ""), "Alice est à 100% sur les 4 semaines écoulées");
ok(/Dernière séance hier/.test(alice || ""), "sa dernière séance est datée en clair");

const bruno = await carte("Bruno Retard");
ok(/SEMAINE 6 · 0\/3 SÉANCES/.test(bruno || ""), `Bruno : ${bruno?.match(/SEMAINE[^\n]*/)?.[0]}`);
ok(/33% SUR 4 SEM\./.test(bruno || ""), "Bruno est à 33% (1 séance sur 3 attendues, 4 semaines de suite)");
ok(/il y a 8 jours/.test(bruno || ""), "le délai depuis sa dernière séance est affiché");

const chloe = await carte("Chloe Decroche");
ok(/8% SUR 4 SEM\./.test(chloe || ""),
   "Chloé : 1 séance faite sur 12 attendues en 4 semaines = 8%");

const david = await carte("David Neuf");
ok(/Aucune séance enregistrée/.test(david || ""), "David n'a jamais démarré, et c'est dit");
ok(/Jamais démarré/.test(david || ""), "il a son propre statut, distinct du décrochage");

console.log("\n─── La semaine en cours ne pénalise pas ───");
// Alice n'a fait que 2 séances sur 3 cette semaine, et reste pourtant à 100%.
ok(/100% SUR 4 SEM\./.test(alice || ""),
   "le taux ne compte que les semaines écoulées — une semaine entamée ne fait pas chuter le score");

await p.screenshot({ path: `${CAPTURES}suivi.png`, fullPage: true });
await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
