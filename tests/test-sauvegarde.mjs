// ═══════════════════════════════════════════════════════════════════════════
//  Export de sauvegarde (Espace coach → Coachés → Sauvegarde).
//
//  Le contrôle le plus important de cette série : QUE LES CODES D'ACCÈS
//  N'APPARAISSENT NULLE PART dans le fichier produit. C'est la règle de la
//  Partie K du CLAUDE.md, et un fichier de sauvegarde traîne partout.
//
//  On intercepte le vrai téléchargement du navigateur et on lit le fichier.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });

const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

// `panne` : nom d'une table qui répondra en erreur, ou null.
const injection = (panne) => `
window.__journal = { requetes: [] };
const PANNE = ${JSON.stringify(panne)};
const COACH = { id: "coach-1", name: "Greg", role: "coach", access_code: "GLEDE572" };
const COACHES = [
  { id: "c1", name: "Marie Dupont", role: "coachee", coach_id: "coach-1", offer: "premium",
    is_active: true, access_code: "MDUPONT27", goal: "Prise de masse",
    created_at: "2026-07-01T09:00:00Z" },
  { id: "c2", name: "Jean Bernard", role: "coachee", coach_id: "coach-1", offer: "essentiel",
    is_active: true, access_code: "JBERNARD84", goal: "Sèche",
    created_at: "2026-07-08T09:00:00Z" },
];
const PAR_TABLE = {
  programs:              [{ id: "p1", coachee_id: "c1", name: "Bloc 1" }],
  weeks:                 [{ id: "w1", coachee_id: "c1", week_number: 1 }],
  sets_logged:           [{ id: "s1", coachee_id: "c1", weight: 60, actual_reps: 8 },
                          { id: "s2", coachee_id: "c2", weight: 40, actual_reps: 10 }],
  weight_logs:           [{ id: "pe1", coachee_id: "c1", weight_kg: 78.4 }],
  nutrition_profiles:    [{ id: "n1", coachee_id: "c1", activity_factor: 1.35 }],
  meal_plans:            [],
  periodization_phases:  [{ id: "ph1", coachee_id: "c1", phase_type: "prise_de_masse" }],
  weekly_reviews:        [{ id: "b1", coachee_id: "c1", week_number: 1, energie: 4 }],
  session_notes:         [{ id: "no1", coachee_id: "c1", week_number: 1, note: "Épaule ok" }],
  exercises_library:     [{ id: "e1", coach_id: "coach-1", name: "Développé couché" }],
  recipes_library:       [{ id: "r1", coach_id: "coach-1", name: "Poulet riz" }],
};

function requete(table) {
  const q = { _f: {},
    select(){ return q; }, order(){ return q; }, gte(){ return q; }, limit(){ return q; },
    eq(c,v){ q._f[c]=v; return q; }, in(c,v){ q._f[c]=v; return q; },
    update(){ return q; }, insert: async()=>({data:null,error:null}), upsert: async()=>({data:null,error:null}),
    delete(){ return { eq: async()=>({error:null}) }; },
    single: async()=>({ data: COACH, error:null }),
    maybeSingle: async()=>({ data:null, error:null }),
    then(res){
      window.__journal.requetes.push(table);
      if (table === PANNE) {
        return Promise.resolve({ data: null,
          error: { code: "42P01", message: 'relation "public.' + table + '" does not exist' } }).then(res);
      }
      let d = [];
      if (table === "profiles") d = COACHES;
      else d = PAR_TABLE[table] || [];
      return Promise.resolve({ data: d, error: null }).then(res);
    },
  };
  return q;
}
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { user: { id: "coach-1" } } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
          signOut: async () => ({ error: null }) },
  from: requete, functions: { invoke: async () => ({ data: null, error: null }) },
}) };
`;

const b = await chromium.launch();

async function ouvrir(panne = null) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
                                   acceptDownloads: true });
  const p = await ctx.newPage();
  await p.addInitScript(injection(panne));
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  return { ctx, p };
}

// ── 1. L'export produit un vrai fichier ────────────────────────────────────
console.log("\n─── Le coach télécharge ses données ───");
{
  const { ctx, p } = await ouvrir();
  const carte = await p.evaluate(() => {
    const t = [...document.querySelectorAll("div")].find(d => d.textContent.trim() === "SAUVEGARDE" && !d.children.length);
    return t ? t.parentElement.parentElement.innerText : null;
  });
  ok(!!carte, "la carte Sauvegarde est en bas de la liste des coachés");
  ok(carte && /Supabase ne sauvegarde rien sur le plan gratuit/.test(carte),
     "elle dit pourquoi elle existe");
  ok(carte && /Les codes d'accès n'y figurent pas/.test(carte),
     "elle annonce d'emblée que les codes en sont exclus");
  await p.screenshot({ path: `${CAPTURES}sauvegarde.png`, fullPage: true });

  const [dl] = await Promise.all([
    p.waitForEvent("download", { timeout: 15000 }),
    p.locator("text=TÉLÉCHARGER MES DONNÉES").click(),
  ]);
  const nom = dl.suggestedFilename();
  ok(/^forge-coaching-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/.test(nom),
     `le fichier est daté : ${nom}`);

  const chemin = await dl.path();
  const brut = readFileSync(chemin, "utf8");
  const j = JSON.parse(brut);

  console.log("\n─── AUCUN CODE D'ACCÈS DANS LE FICHIER ───");
  for (const code of ["MDUPONT27", "JBERNARD84", "GLEDE572"]) {
    ok(!brut.includes(code), `le code ${code} est absent du fichier`);
  }
  ok(!/access_code/.test(brut), "le champ access_code lui-même n'apparaît pas");
  ok(j._forge_coaching?.avertissement?.includes("ne figurent PAS"),
     "le fichier explique lui-même pourquoi les codes en sont absents");

  console.log("\n─── Le contenu est complet ───");
  ok(j._forge_coaching?.version === 1, "le fichier porte un numéro de version");
  ok(!!j._forge_coaching?.exporte_le, "il est horodaté");
  ok(j.donnees.profiles?.length === 2, `les 2 coachés sont là (${j.donnees.profiles?.length})`);
  ok(j.donnees.profiles.every(pr => pr.name && pr.id), "leur nom et leur identifiant sont conservés");
  for (const t of ["programs","weeks","sets_logged","weight_logs","nutrition_profiles",
                   "meal_plans","periodization_phases","weekly_reviews","session_notes",
                   "exercises_library","recipes_library"]) {
    ok(Array.isArray(j.donnees[t]), `table ${t} exportée`);
  }
  ok(j.donnees.sets_logged.length === 2, "les séries loguées des deux coachés sont présentes");
  ok(j._forge_coaching.contenu.sets_logged === 2, "l'en-tête récapitule les volumes");

  console.log("\n─── Ce qui ne doit PAS être exporté ───");
  ok(!("push_config" in j.donnees), "push_config est absente — elle porte la clé privée VAPID");
  ok(!brut.includes("vapid"), "aucune trace de clé VAPID dans le fichier");
  ok(!("push_subscriptions" in j.donnees),
     "push_subscriptions est absente — des secrets d'appareils sans valeur une fois restaurés");

  const apres = await p.locator("body").innerText();
  ok(/lignes exportées/.test(apres), "le coach voit combien de lignes sont parties");
  ok(/Aujourd'hui/.test(apres), "la date de dernière sauvegarde s'affiche");
  await ctx.close();
}

// ── 2. Une table absente ne fait pas échouer toute la sauvegarde ───────────
console.log("\n─── Si une table manque en base ───");
{
  const { ctx, p } = await ouvrir("session_notes");
  const [dl] = await Promise.all([
    p.waitForEvent("download", { timeout: 15000 }),
    p.locator("text=TÉLÉCHARGER MES DONNÉES").click(),
  ]);
  const j = JSON.parse(readFileSync(await dl.path(), "utf8"));
  ok(j.donnees.sets_logged?.length === 2, "les autres tables sont quand même exportées");
  ok(j.donnees.session_notes?._erreur, "la table en panne est signalée dans le fichier");
  const apres = await p.locator("body").innerText();
  ok(/certaines tables n'ont pas pu être lues/.test(apres),
     "et le coach est prévenu que sa sauvegarde est incomplète");
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
