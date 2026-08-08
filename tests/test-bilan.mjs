// ═══════════════════════════════════════════════════════════════════════════
//  Bilan hebdomadaire — la boucle complète : le coaché envoie, le coach répond,
//  le coaché lit la réponse.
//
//  On vérifie aussi le cas qui compte le plus aujourd'hui : le comportement
//  AVANT que la migration SQL soit jouée. La table n'existe pas encore en
//  production, et l'app doit s'effacer sans bruit plutôt que d'afficher une
//  erreur à un vrai coaché.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });

const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

// Le coaching a démarré il y a 3 semaines : la semaine en cours est la 4e.
const DEBUT = new Date(Date.now() - 21 * 86400000).toISOString();

// `etat` : "vide" (aucun bilan), "envoye", "repondu", ou "table_absente".
const injection = (role, etat) => `
window.__journal = { ecritures: [] };
const DEBUT = ${JSON.stringify(DEBUT)};
const TABLE_ABSENTE = ${etat === "table_absente"};

const COACH  = { id: "coach-1", name: "Greg", role: "coach", access_code: "COACH" };
const COACHE = { id: "c1", name: "Marie Dupont", role: "coachee", coach_id: "coach-1",
                 access_code: "MDUPONT27", offer: "premium", is_active: true,
                 goal: "Prise de masse", start_date: "2026-01-06", created_at: DEBUT };

const PROGRAMME = { id: "p1", coachee_id: "c1", is_active: true,
  week_structure: [{ day: "LUNDI", sessionId: 1 }, { day: "MARDI", sessionId: null },
    { day: "MERCREDI", sessionId: null }, { day: "JEUDI", sessionId: null },
    { day: "VENDREDI", sessionId: null }, { day: "SAMEDI", sessionId: null }, { day: "DIMANCHE", sessionId: null }],
  sessions_structure: [{ id: 1, name: "PUSH A", abdosCardio: [], exercises: [
    { ordre: 1, library_exercise_id: "e1", exercice: "Développé couché", muscle: "Pectoraux",
      series: 3, reps: ["8","8","8"], repos: "2'00", commentaire: "", technique: null }] }] };

let BILANS = [];
if ("${etat}" === "envoye" || "${etat}" === "repondu") {
  BILANS = [{ id: "b1", coachee_id: "c1", week_number: 4, energie: 4, sommeil: 2,
              motivation: 5, recuperation: 3, note: "Dos un peu sensible au soulevé de terre.",
              coach_reply: "${etat}" === "repondu" ? "On allège le SDT cette semaine, garde 3 series." : null,
              coach_replied_at: null }];
}

const ERREUR_TABLE = { code: "42P01", message: 'relation "public.weekly_reviews" does not exist' };

function requete(table) {
  const bilans = table === "weekly_reviews";
  const q = { _f: {},
    select(){ return q; }, order(){ return q; }, in(){ return q; }, gte(){ return q; }, limit(){ return q; },
    eq(c,v){ q._f[c]=v; return q; },
    update(vals){ window.__journal.ecritures.push({ table, type: "update", vals });
                  return { eq: async () => { if (BILANS[0]) Object.assign(BILANS[0], vals); return { error: null }; } }; },
    upsert: async (vals, opts) => {
      window.__journal.ecritures.push({ table, type: "upsert", vals, opts });
      if (bilans && TABLE_ABSENTE) return { error: ERREUR_TABLE };
      const i = BILANS.findIndex(b => b.week_number === vals.week_number);
      if (i >= 0) BILANS[i] = { ...BILANS[i], ...vals }; else BILANS.push({ id: "b" + (BILANS.length+1), ...vals });
      return { error: null };
    },
    insert: async () => ({ data: null, error: null }),
    delete(){ return { eq: async () => ({ error: null }) }; },
    single: async () => ({ data: table === "profiles" ? (q._f.id === "coach-1" ? COACH : COACHE)
                                 : table === "programs" ? PROGRAMME : null, error: null }),
    maybeSingle: async () => {
      if (bilans) return TABLE_ABSENTE ? { data: null, error: ERREUR_TABLE }
                                       : { data: BILANS.find(b => b.week_number === q._f.week_number) || null, error: null };
      return { data: table === "programs" ? PROGRAMME : null, error: null };
    },
    then(res){
      if (bilans && TABLE_ABSENTE) return Promise.resolve({ data: null, error: ERREUR_TABLE }).then(res);
      let d = [];
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
  from: requete,
  functions: { invoke: async () => ({ data: null, error: null }) },
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

const carteBilan = (p) => p.evaluate(() => {
  const t = [...document.querySelectorAll("div")].find(d =>
    /^(Bilan de la semaine|Bilan de la semaine envoyé|Ton coach t'a répondu)$/.test(d.textContent.trim()) && !d.children.length);
  return t ? t.parentElement.parentElement.innerText : null;
});

// ── 1. Le coaché envoie son premier bilan ──────────────────────────────────
console.log("\n─── Le coaché remplit son bilan ───");
{
  const { ctx, p } = await ouvrir("coachee", "vide");
  const carte = await carteBilan(p);
  ok(!!carte, "la carte « Bilan de la semaine » est sur l'accueil");
  ok(carte && /Comment s'est passée ta semaine/.test(carte), "elle invite à répondre");

  await p.locator("text=Bilan de la semaine").first().click();
  await p.waitForTimeout(600);
  const feuille = await p.locator("body").innerText();
  ok(/BILAN · SEMAINE 4/.test(feuille), "la feuille s'ouvre sur la bonne semaine");
  for (const l of ["ÉNERGIE", "SOMMEIL", "MOTIVATION", "RÉCUPÉRATION"])
    ok(feuille.includes(l), `le critère ${l} est proposé`);
  ok(/Tout est facultatif/.test(feuille), "l'app dit clairement que rien n'est obligatoire");

  // Rien de saisi : le bouton doit rester inerte.
  const envoyer = p.locator("button", { hasText: /^ENVOYER$/ }).last();
  ok(await envoyer.isDisabled(), "un bilan entièrement vide ne s'envoie pas");

  // Un seul curseur suffit à débloquer l'envoi.
  await p.locator('button[aria-label="Énergie : 4 sur 5"]').click();
  await p.waitForTimeout(250);
  ok(!(await envoyer.isDisabled()), "un seul curseur suffit pour pouvoir envoyer");

  await p.locator('button[aria-label="Sommeil : 2 sur 5"]').click();
  await p.locator("textarea").first().fill("Dos un peu sensible au soulevé de terre.");
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${CAPTURES}bilan-saisie.png` });
  await envoyer.click();
  await p.waitForTimeout(900);

  const j = await p.evaluate(() => window.__journal);
  const ecr = j.ecritures.find(e => e.table === "weekly_reviews" && e.type === "upsert");
  ok(!!ecr, "le bilan part en base");
  if (ecr) {
    ok(ecr.vals.week_number === 4, `rattaché à la semaine ${ecr.vals.week_number}`);
    ok(ecr.vals.coachee_id === "c1", "rattaché au bon coaché");
    ok(ecr.vals.energie === 4 && ecr.vals.sommeil === 2, "les curseurs saisis sont transmis");
    ok(ecr.vals.motivation === null && ecr.vals.recuperation === null,
       "les curseurs non touchés partent à null, pas à zéro");
    ok(/soulevé de terre/.test(ecr.vals.note || ""), "le mot libre est transmis");
    ok(ecr.opts?.onConflict === "coachee_id,week_number",
       "l'envoi écrase le bilan de la semaine au lieu d'en créer un second");
  }
  const apres = await carteBilan(p);
  ok(apres && /Bilan de la semaine envoyé/.test(apres), "la carte confirme l'envoi");
  ok(apres && /Tu peux encore le modifier/.test(apres), "le coaché sait qu'il peut revenir dessus");
  await ctx.close();
}

// ── 2. Le coach lit et répond ──────────────────────────────────────────────
console.log("\n─── Le coach répond ───");
{
  const { ctx, p } = await ouvrir("coach", "envoye");
  await p.locator("text=Marie Dupont").first().click();
  await p.waitForTimeout(700);
  await p.locator("text=Bilans").last().click();
  await p.waitForTimeout(800);

  const vue = await p.locator("body").innerText();
  ok(/SEMAINE 4/.test(vue), "le bilan de la semaine 4 est affiché");
  ok(/SANS RÉPONSE/.test(vue), "un bilan sans réponse est signalé comme tel");
  ok(/soulevé de terre/.test(vue), "le coach lit le mot du coaché");
  ok(/ÉNERGIE/.test(vue) && /RÉCUPÉRATION/.test(vue), "les quatre curseurs sont résumés");
  await p.screenshot({ path: `${CAPTURES}bilan-coach.png` });

  const repondre = p.locator("button", { hasText: /^RÉPONDRE$/ }).last();
  ok(await repondre.isDisabled(), "on ne peut pas envoyer une réponse vide");

  await p.locator("textarea").first().fill("On allège le SDT cette semaine, garde 3 séries.");
  await p.waitForTimeout(250);
  await repondre.click();
  await p.waitForTimeout(900);

  const j = await p.evaluate(() => window.__journal);
  const maj = j.ecritures.find(e => e.table === "weekly_reviews" && e.type === "update");
  ok(!!maj, "la réponse part en base");
  ok(maj && /allège le SDT/.test(maj.vals.coach_reply || ""), "le texte de la réponse est transmis");
  ok(maj && !!maj.vals.coach_replied_at, "la date de réponse est horodatée");

  const apres = await p.locator("body").innerText();
  ok(/TA RÉPONSE/.test(apres), "la réponse s'affiche à la place du formulaire");
  ok(!/SANS RÉPONSE/.test(apres), "le bilan n'est plus signalé en attente");
  await ctx.close();
}

// ── 3. Le coaché lit la réponse ────────────────────────────────────────────
console.log("\n─── Le coaché lit la réponse ───");
{
  const { ctx, p } = await ouvrir("coachee", "repondu");
  const carte = await carteBilan(p);
  ok(carte && /Ton coach t'a répondu/.test(carte), "la carte annonce la réponse");

  await p.locator("text=Ton coach t'a répondu").first().click();
  await p.waitForTimeout(600);
  const feuille = await p.locator("body").innerText();
  ok(/RÉPONSE DE TON COACH/.test(feuille), "la réponse est mise en avant dans la feuille");
  ok(/allège le SDT/.test(feuille), "le coaché lit le texte de son coach");
  ok(/METTRE À JOUR/.test(feuille), "il peut toujours corriger son bilan");
  await p.screenshot({ path: `${CAPTURES}bilan-reponse.png` });
  await ctx.close();
}

// ── 4. AVANT la migration : l'app doit s'effacer sans bruit ────────────────
console.log("\n─── Avant que la migration SQL soit jouée ───");
{
  const { ctx, p, erreurs } = await ouvrir("coachee", "table_absente");
  ok(erreurs.length === 0, `aucune erreur JS côté coaché (${erreurs.length})`);
  ok((await carteBilan(p)) === null, "aucune carte Bilan n'apparaît sur l'accueil");
  const accueil = await p.locator("body").innerText();
  ok(/BONJOUR/.test(accueil), "l'accueil s'affiche normalement");
  ok(!/does not exist|42P01|erreur/i.test(accueil), "aucun message technique n'atteint le coaché");
  await ctx.close();
}
{
  const { ctx, p, erreurs } = await ouvrir("coach", "table_absente");
  await p.locator("text=Marie Dupont").first().click();
  await p.waitForTimeout(700);
  await p.locator("text=Bilans").last().click();
  await p.waitForTimeout(800);
  const vue = await p.locator("body").innerText();
  ok(erreurs.length === 0, `aucune erreur JS côté coach (${erreurs.length})`);
  ok(/pas encore activés/.test(vue), "le coach, lui, est prévenu que la migration manque");
  ok(/bilan-hebdomadaire\.sql/.test(vue), "et on lui dit quel fichier jouer");
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
