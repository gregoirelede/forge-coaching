// ═══════════════════════════════════════════════════════════════════════════
//  Notes de séance : le coaché laisse un mot sur UNE séance, le coach le lit
//  à côté du bilan de la semaine correspondante.
//
//  Comme pour le bilan, on vérifie aussi le comportement AVANT que la
//  migration SQL soit jouée — la table n'existe pas encore en production.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });

const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const DEBUT = new Date(Date.now() - 21 * 86400000).toISOString();   // semaine 4

// etat : "vide" | "avec_note" | "table_absente"
const injection = (role, etat) => `
window.__journal = { ecritures: [] };
const TABLE_ABSENTE = ${etat === "table_absente"};
const COACH  = { id: "coach-1", name: "Greg", role: "coach", access_code: "COACH" };
const COACHE = { id: "c1", name: "Marie Dupont", role: "coachee", coach_id: "coach-1",
                 access_code: "MDUPONT27", offer: "premium", is_active: true,
                 created_at: ${JSON.stringify(DEBUT)} };
const PROGRAMME = { id: "p1", coachee_id: "c1", is_active: true,
  week_structure: [{ day: "LUNDI", sessionId: 1 }, { day: "MARDI", sessionId: null },
    { day: "MERCREDI", sessionId: null }, { day: "JEUDI", sessionId: null },
    { day: "VENDREDI", sessionId: null }, { day: "SAMEDI", sessionId: null }, { day: "DIMANCHE", sessionId: null }],
  sessions_structure: [{ id: 1, name: "PUSH A", abdosCardio: [], exercises: [
    { ordre: 1, library_exercise_id: "e1", exercice: "Développé couché", muscle: "Pectoraux",
      series: 3, reps: ["8","8","8"], repos: "2'00", commentaire: "", technique: null }] }] };

let NOTES = [];
if ("${etat}" === "avec_note") {
  NOTES = [{ id: "n1", coachee_id: "c1", week_number: 4, session_config_id: 1,
             session_name: "PUSH A", note: "Épaule sensible au 3e set." }];
}
// Un bilan existe sur la semaine 4, aucun sur la 3 — la semaine 3 ne portera
// qu'une note de séance, pour vérifier qu'elle apparaît quand même.
let BILANS = [{ id: "b1", coachee_id: "c1", week_number: 4, energie: 4, sommeil: 3,
                motivation: 4, recuperation: 3, note: "Bonne semaine.", coach_reply: null }];
if ("${etat}" === "avec_note") {
  NOTES.push({ id: "n2", coachee_id: "c1", week_number: 3, session_config_id: 1,
               session_name: "PUSH A", note: "Salle bondée, squat remplacé." });
}

const ERREUR = { code: "42P01", message: 'relation "public.session_notes" does not exist' };

function requete(table) {
  const notes  = table === "session_notes";
  const bilans = table === "weekly_reviews";
  const q = { _f: {},
    select(){ return q; }, order(){ return q; }, in(){ return q; }, gte(){ return q; }, limit(){ return q; },
    eq(c,v){ q._f[c]=v; return q; },
    update(vals){ return { eq: async () => ({ error: null }) }; },
    upsert: async (vals, opts) => {
      window.__journal.ecritures.push({ table, type: "upsert", vals, opts });
      if (notes && TABLE_ABSENTE) return { error: ERREUR };
      NOTES.push({ id: "n" + (NOTES.length + 1), ...vals });
      return { error: null };
    },
    insert: async () => ({ data: null, error: null }),
    delete(){ return { eq: async (c, v) => {
      window.__journal.ecritures.push({ table, type: "delete", [c]: v });
      NOTES = NOTES.filter(n => n.id !== v);
      return { error: null }; } }; },
    single: async () => ({ data: table === "profiles" ? (q._f.id === "coach-1" ? COACH : COACHE)
                                 : table === "programs" ? PROGRAMME : null, error: null }),
    maybeSingle: async () => {
      if (notes)  return TABLE_ABSENTE ? { data: null, error: ERREUR }
        : { data: NOTES.find(n => n.week_number === q._f.week_number && n.session_config_id === q._f.session_config_id) || null, error: null };
      if (bilans) return { data: BILANS.find(b => b.week_number === q._f.week_number) || null, error: null };
      return { data: table === "programs" ? PROGRAMME : null, error: null };
    },
    then(res){
      if (notes && TABLE_ABSENTE) return Promise.resolve({ data: null, error: ERREUR }).then(res);
      let d = [];
      if (notes)  d = NOTES;
      if (bilans) d = BILANS;
      if (table === "profiles") d = [COACHE];
      return Promise.resolve({ data: d, error: null }).then(res);
    },
  };
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

async function ouvrir(role, etat) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", e => erreurs.push(e.message));
  await p.addInitScript(injection(role, etat));
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2400);
  return { ctx, p, erreurs };
}

// ── 1. Le coaché laisse un mot sur sa séance ───────────────────────────────
console.log("\n─── Le coaché note sa séance ───");
{
  const { ctx, p } = await ouvrir("coachee", "vide");
  await p.locator("text=SÉANCES").last().click();
  await p.waitForTimeout(900);

  const invite = p.locator("text=+ AJOUTER UNE NOTE SUR CETTE SÉANCE");
  ok(await invite.count() === 1, "l'invitation à noter la séance est présente");

  await invite.click();
  await p.waitForTimeout(400);
  const zone = p.locator("textarea").last();
  ok(await zone.count() === 1, "la zone de saisie s'ouvre");
  const placeholder = await zone.getAttribute("placeholder");
  ok(/Épaule sensible/.test(placeholder || ""), `l'exemple guide le coaché : « ${placeholder} »`);

  await zone.fill("Épaule sensible au 3e set.");
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${CAPTURES}note-seance.png` });
  await p.locator("button", { hasText: /^ENREGISTRER$/ }).last().click();
  await p.waitForTimeout(800);

  const j = await p.evaluate(() => window.__journal);
  const ecr = j.ecritures.find(e => e.table === "session_notes" && e.type === "upsert");
  ok(!!ecr, "la note part en base");
  if (ecr) {
    ok(ecr.vals.week_number === 4, `rattachée à la semaine ${ecr.vals.week_number}`);
    ok(ecr.vals.session_config_id === 1, "rattachée à la bonne séance");
    ok(ecr.vals.session_name === "PUSH A",
       "le nom de la séance est figé à l'écriture — le programme peut être renommé plus tard");
    ok(/Épaule sensible/.test(ecr.vals.note || ""), "le texte est transmis");
    ok(ecr.opts?.onConflict === "coachee_id,week_number,session_config_id",
       "une seconde note sur la même séance écrase la première au lieu de s'empiler");
  }
  const apres = await p.locator("body").innerText();
  ok(/TA NOTE SUR CETTE SÉANCE/.test(apres), "la note s'affiche une fois enregistrée");
  ok(/Épaule sensible au 3e set\./.test(apres), "son contenu est relu par le coaché");
  await ctx.close();
}

// ── 2. Vider la note l'efface ──────────────────────────────────────────────
console.log("\n─── Le coaché retire sa note ───");
{
  const { ctx, p } = await ouvrir("coachee", "avec_note");
  await p.locator("text=SÉANCES").last().click();
  await p.waitForTimeout(900);
  ok(await p.locator("text=TA NOTE SUR CETTE SÉANCE").count() === 1, "la note existante est affichée");

  await p.locator("text=TA NOTE SUR CETTE SÉANCE").click();
  await p.waitForTimeout(400);
  await p.locator("textarea").last().fill("");
  await p.waitForTimeout(250);
  const bouton = p.locator("button", { hasText: /SUPPRIMER LA NOTE/ });
  ok(await bouton.count() === 1, "vider le champ transforme le bouton en « Supprimer la note »");
  await bouton.click();
  await p.waitForTimeout(800);

  const j = await p.evaluate(() => window.__journal);
  ok(j.ecritures.some(e => e.table === "session_notes" && e.type === "delete"),
     "la note est bien supprimée, pas remplacée par du vide");
  ok(await p.locator("text=+ AJOUTER UNE NOTE SUR CETTE SÉANCE").count() === 1,
     "l'invitation à noter revient");
  await ctx.close();
}

// ── 3. Le coach lit les notes à côté du bilan ──────────────────────────────
console.log("\n─── Le coach lit les retours ───");
{
  const { ctx, p } = await ouvrir("coach", "avec_note");
  await p.locator("text=Marie Dupont").first().click();
  await p.waitForTimeout(700);
  const onglet = p.locator("text=Retours").last();
  ok(await onglet.count() === 1, "l'onglet s'appelle « Retours » — bilans et notes réunis");
  await onglet.click();
  await p.waitForTimeout(900);

  const vue = await p.locator("body").innerText();
  ok(/SEMAINE 4/.test(vue), "la semaine 4 est affichée");
  ok(/Bonne semaine\./.test(vue), "le bilan de la semaine y est");
  ok(/PUSH A/.test(vue), "la séance concernée est nommée");
  ok(/Épaule sensible au 3e set\./.test(vue), "la note de séance est lisible à côté du bilan");

  ok(/SEMAINE 3/.test(vue), "la semaine 3 apparaît alors qu'elle n'a pas de bilan");
  ok(/Pas de bilan, mais des notes de séance/.test(vue),
     "l'app dit pourquoi cette semaine n'a pas de curseurs");
  ok(/Salle bondée, squat remplacé\./.test(vue), "sa note de séance est bien là");
  await p.screenshot({ path: `${CAPTURES}retours-coach.png`, fullPage: true });
  await ctx.close();
}

// ── 4. AVANT la migration ──────────────────────────────────────────────────
console.log("\n─── Avant que la migration SQL soit jouée ───");
{
  const { ctx, p, erreurs } = await ouvrir("coachee", "table_absente");
  await p.locator("text=SÉANCES").last().click();
  await p.waitForTimeout(900);
  ok(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`);
  ok(await p.locator("text=+ AJOUTER UNE NOTE SUR CETTE SÉANCE").count() === 0,
     "aucune invitation à noter n'apparaît");
  const vue = await p.locator("body").innerText();
  ok(/Développé couché/.test(vue), "la séance s'affiche normalement");
  ok(!/does not exist|42P01/i.test(vue), "aucun message technique n'atteint le coaché");
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
