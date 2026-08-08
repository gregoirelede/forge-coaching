// ═══════════════════════════════════════════════════════════════════════════
//  Parcours de test : le coach envoie une notification à un de ses coachés,
//  depuis Espace coach → un coaché → Infos.
//
//  Supabase est simulé : on vérifie MON code — ce que le client envoie à
//  l'Edge Function, et ce que le coach voit revenir, y compris quand ça rate.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });

const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

// `reponse` décide de ce que renvoie send-push, pour rejouer les trois issues.
const injection = (reponse) => `
window.__journal = { appels: [] };
const COACH = { id: "coach-1", name: "Greg", role: "coach", access_code: "COACH", offer: "premium" };
const COACHE = { id: "coache-1", name: "Marie Dupont", role: "coachee", access_code: "MDUPONT27",
                 coach_id: "coach-1", offer: "premium", is_active: true, goal: "Prise de masse",
                 start_date: "2026-01-06", created_at: "2026-01-06T09:00:00Z" };

function requete(table) {
  const q = {
    select(){ return q; }, order(){ return q; }, in(){ return q; }, gte(){ return q; },
    limit(){ return q; }, update(){ return q; }, insert: async () => ({ data: null, error: null }),
    upsert: async () => ({ data: null, error: null }),
    delete(){ return { eq: async () => ({ error: null }) }; },
    eq(col, val){
      if (table === "profiles" && col === "coach_id") q._liste = [COACHE];
      if (table === "profiles" && col === "id") q._un = val === "coach-1" ? COACH : COACHE;
      return q;
    },
    single: async () => ({ data: q._un || COACH, error: null }),
    maybeSingle: async () => ({ data: q._un || null, error: null }),
    then(res){ return Promise.resolve({ data: q._liste || [], error: null }).then(res); },
  };
  return q;
}

window.supabase = { createClient: () => ({
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "coach-1" } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
    signInWithPassword: async () => ({ data: { user: { id: "coach-1" } }, error: null }),
    signOut: async () => ({ error: null }),
  },
  from: requete,
  functions: { invoke: async (nom, opts) => {
    window.__journal.appels.push({ nom, corps: opts && opts.body });
    if (nom === "send-push") return ${reponse};
    return { data: null, error: null };
  } },
}) };
`;

const b = await chromium.launch();

async function ouvrirFicheCoache(reponse) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(injection(reponse));
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  // La session est celle d'un coach : l'app doit router vers l'espace coach.
  await p.locator("text=Marie Dupont").first().click();
  await p.waitForTimeout(700);
  return { ctx, p };
}

const panneau = (p) => p.evaluate(() => {
  const t = [...document.querySelectorAll("div")]
    .find(d => d.textContent.trim() === "NOTIFICATION" && !d.children.length);
  return t ? t.closest("div").parentElement.parentElement.innerText : null;
});

// ── 1. Le panneau existe et reste replié par défaut ────────────────────────
console.log("\n─── Le coach trouve l'envoi de notification ───");
{
  const { ctx, p } = await ouvrirFicheCoache('{ data: { success: true, envoyees: 2, total: 2 }, error: null }');
  const bouton = p.locator("text=Envoyer une notification");
  ok(await bouton.count() > 0, "le bouton « Envoyer une notification » est sur la fiche du coaché");
  ok((await panneau(p)) === null, "le formulaire est replié tant qu'on n'a pas cliqué");

  await bouton.click();
  await p.waitForTimeout(400);
  const vue = await panneau(p);
  ok(!!vue, "le formulaire s'ouvre au clic");
  ok(vue && /Marie Dupont/.test(vue), "il rappelle à qui la notification va partir");
  ok(vue && /TITRE \(0\/60\)/.test(vue), "le titre est limité à 60 caractères, compteur affiché");
  ok(vue && /MESSAGE \(0\/160\)/.test(vue), "le message est limité à 160 caractères, compteur affiché");

  // ── 2. Le bouton reste inerte tant que les deux champs ne sont pas remplis
  const envoyer = p.locator("button", { hasText: /^ENVOYER$/ }).last();
  ok(await envoyer.isDisabled(), "le bouton ENVOYER est inactif tant que rien n'est saisi");

  await p.locator('input[placeholder="Nouvelle semaine"]').fill("Nouvelle semaine");
  await p.waitForTimeout(250);
  ok(await envoyer.isDisabled(), "un titre sans message ne suffit pas à l'activer");

  await p.locator("textarea").first().fill("   ");
  await p.waitForTimeout(250);
  ok(await envoyer.isDisabled(), "un message fait uniquement d'espaces ne l'active pas non plus");

  let j = await p.evaluate(() => window.__journal);
  ok(j.appels.length === 0, "aucun appel n'est parti pendant la saisie");

  // ── 3. Envoi complet ─────────────────────────────────────────────────────
  console.log("\n─── Envoi ───");
  await p.locator("textarea").first().fill("Ton programme de la semaine 12 est en ligne.");
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${CAPTURES}push-coach-formulaire.png` });
  await envoyer.click();
  await p.waitForTimeout(900);

  j = await p.evaluate(() => window.__journal);
  const appel = j.appels.find(a => a.nom === "send-push");
  ok(!!appel, "l'Edge Function send-push est appelée");
  if (appel) {
    ok(appel.corps.coacheeId === "coache-1", `le bon coaché est visé (${appel.corps.coacheeId})`);
    ok(appel.corps.title === "Nouvelle semaine", `titre transmis : « ${appel.corps.title} »`);
    ok(appel.corps.body === "Ton programme de la semaine 12 est en ligne.", "message transmis");
    ok(!appel.corps.test, "ce n'est pas un envoi de test déguisé");
  }
  const apres = await panneau(p);
  ok(apres && /Envoyé sur 2 appareils\./.test(apres), `retour affiché : « ${apres?.match(/Envoyé[^\n]*/)?.[0]} »`);
  ok(apres && /TITRE \(0\/60\)/.test(apres), "les champs sont vidés après un envoi réussi");
  await ctx.close();
}

// ── 4. Le coaché n'a pas activé ses notifications ──────────────────────────
console.log("\n─── Le coaché n'a aucun appareil abonné ───");
{
  // Ce que renvoie réellement supabase-js sur un 404 : message générique, vraie
  // réponse rangée dans error.context. C'est ce cas qui a motivé le helper.
  const { ctx, p } = await ouvrirFicheCoache(`{ data: null, error: Object.assign(
      new Error("Edge Function returned a non-2xx status code"),
      { context: { json: async () => ({ error: "Aucun appareil abonné" }) } }) }`);
  await p.locator("text=Envoyer une notification").click();
  await p.waitForTimeout(400);
  await p.locator('input[placeholder="Nouvelle semaine"]').fill("Coucou");
  await p.locator("textarea").first().fill("Test");
  await p.waitForTimeout(200);
  await p.locator("button", { hasText: /^ENVOYER$/ }).last().click();
  await p.waitForTimeout(900);

  const vue = await panneau(p);
  ok(vue && /Aucun appareil abonné/.test(vue),
     "le coach lit la vraie raison, pas « non-2xx status code »");
  ok((await p.locator('input[placeholder="Nouvelle semaine"]').inputValue()) === "Coucou",
     "la saisie n'est pas perdue quand l'envoi échoue — le coach peut réessayer");
  await p.screenshot({ path: `${CAPTURES}push-coach-echec.png` });
  await ctx.close();
}

// ── 5. Le serveur refuse (coaché d'un autre coach) ─────────────────────────
console.log("\n─── Le serveur refuse l'envoi ───");
{
  const { ctx, p } = await ouvrirFicheCoache(`{ data: null, error: Object.assign(
      new Error("Edge Function returned a non-2xx status code"),
      { context: { json: async () => ({ error: "Ce coaché ne t'appartient pas" }) } }) }`);
  await p.locator("text=Envoyer une notification").click();
  await p.waitForTimeout(400);
  await p.locator('input[placeholder="Nouvelle semaine"]').fill("X");
  await p.locator("textarea").first().fill("Y");
  await p.waitForTimeout(200);
  await p.locator("button", { hasText: /^ENVOYER$/ }).last().click();
  await p.waitForTimeout(900);
  const vue = await panneau(p);
  ok(vue && /ne t'appartient pas/.test(vue), "le refus du serveur est affiché tel quel");
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
