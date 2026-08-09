// ═══════════════════════════════════════════════════════════════════════════
//  Supervision des erreurs.
//
//  Deux choses à prouver, dans cet ordre d'importance :
//    1. QU'AUCUNE DONNÉE DE COACHÉ NE PART dans un rapport. Un rapport
//       d'erreur sert à réparer, pas à observer les gens.
//    2. Que le rapport part bien, et que le coach le voit.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });

const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

// `role` : "coachee" | "coach". `casse` : provoque un plantage volontaire.
// `erreurs` : rapports déjà en base. `panne` : la table n'existe pas encore.
const injection = ({ role = "coachee", casse = false, erreurs = [], panne = false } = {}) => `
window.__journal = { inserts: [], suppressions: [] };
const PANNE = ${panne};
const COACH  = { id: "coach-1", name: "Greg", role: "coach", access_code: "GLEDE572" };
const COACHE = { id: "c1", name: "Marie Dupont", role: "coachee", coach_id: "coach-1",
                 access_code: "MDUPONT27", offer: "premium", is_active: true,
                 created_at: "2026-07-01T09:00:00Z" };
let ERREURS = ${JSON.stringify(erreurs)};

// Un programme volontairement CASSÉ : sessions_structure n'est pas un tableau,
// ce qui fait planter le rendu de la séance et déclenche l'ErrorBoundary.
const PROGRAMME_CASSE = { id: "p1", coachee_id: "c1", is_active: true,
  week_structure: [{ day: "LUNDI", sessionId: 1 }],
  sessions_structure: "ceci-n-est-pas-un-tableau" };
const PROGRAMME_OK = { id: "p1", coachee_id: "c1", is_active: true,
  week_structure: [{ day: "LUNDI", sessionId: 1 }],
  sessions_structure: [{ id: 1, name: "PUSH A", abdosCardio: [], exercises: [
    { ordre: 1, exercice: "Développé couché", muscle: "Pectoraux",
      series: 3, reps: ["8","8","8"], repos: "2'00" }] }] };
const PROGRAMME = ${casse} ? PROGRAMME_CASSE : PROGRAMME_OK;

const ERR_TABLE = { code: "42P01", message: 'relation "public.error_reports" does not exist' };

function requete(table) {
  const err = table === "error_reports";
  const q = { _f: {},
    select(){ return q; }, order(){ return q; }, gte(){ return q; },
    limit(){ return q; },
    eq(c,v){ q._f[c]=v; return q; }, in(c,v){ q._f[c]=v; return q; },
    update(){ return q; }, upsert: async()=>({data:null,error:null}),
    insert: async (vals) => {
      if (err) {
        window.__journal.inserts.push(vals);
        if (PANNE) return { error: ERR_TABLE };
        ERREURS.unshift({ id: "e" + ERREURS.length, created_at: new Date().toISOString(), ...vals });
      }
      return { data: null, error: null };
    },
    delete(){ return {
      eq: async()=>({error:null}),
      in: async (c, ids) => { window.__journal.suppressions.push(ids); ERREURS = []; return { error: null }; },
    }; },
    single: async()=>({ data: table==="profiles" ? (q._f.id==="coach-1" ? COACH : COACHE)
                              : table==="programs" ? PROGRAMME : null, error:null }),
    maybeSingle: async()=>({ data: table==="programs" ? PROGRAMME : null, error:null }),
    then(res){
      if (err && PANNE) return Promise.resolve({ data: null, error: ERR_TABLE }).then(res);
      let d = [];
      if (err) d = ERREURS;
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

async function ouvrir(opts) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(injection(opts));
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  return { ctx, p };
}

// ── 1. Un plantage réel est signalé ────────────────────────────────────────
console.log("\n─── L'app plante chez un coaché ───");
{
  const { ctx, p } = await ouvrir({ role: "coachee", casse: true });
  const vue = await p.locator("body").innerText();
  ok(/UN PROBLÈME EST SURVENU/.test(vue), "le coaché voit l'écran d'excuse, pas une page blanche");
  ok(/Tes données sont en sécurité/.test(vue), "on le rassure sur ses données");

  await p.waitForTimeout(600);
  const j = await p.evaluate(() => window.__journal);
  ok(j.inserts.length === 1, `un rapport est parti (${j.inserts.length})`);

  const r = j.inserts[0] || {};
  ok(r.user_id === "c1", "il est attribué au bon utilisateur");
  ok(typeof r.message === "string" && r.message.length > 0, `le message est présent : « ${(r.message||"").slice(0,60)} »`);
  ok(typeof r.stack === "string" && r.stack.split("\n").length <= 8,
     `la pile est tronquée à 8 lignes (${(r.stack||"").split("\n").length})`);
  ok((r.user_agent || "").length <= 300, "le navigateur est noté, tronqué");
  ok(!!r.app_version, `la version du build est jointe : ${r.app_version}`);
  ok(!/[?&]/.test(r.page || ""), `seul le chemin est envoyé, sans paramètres : « ${r.page} »`);

  console.log("\n─── AUCUNE DONNÉE DE COACHÉ DANS LE RAPPORT ───");
  const brut = JSON.stringify(r);
  ok(!brut.includes("MDUPONT27"), "le code d'accès du coaché n'y est pas");
  ok(!brut.includes("Marie Dupont"), "son nom n'y est pas");
  ok(!/weight|actual_reps|coach_reply/.test(brut), "aucune charge, rep ni bilan n'y figure");
  const champs = Object.keys(r).sort().join(",");
  ok(champs === "app_version,message,page,role,stack,user_agent,user_id",
     `le rapport ne contient que les 7 champs prévus (${champs})`);
  await ctx.close();
}

// ── 2. Un plantage en boucle ne noie pas la table ──────────────────────────
console.log("\n─── Plantage en boucle ───");
{
  const { ctx, p } = await ouvrir({ role: "coachee", casse: true });
  await p.waitForTimeout(600);
  // On force plusieurs re-rendus en échec en rechargeant le composant racine.
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => { try { window.dispatchEvent(new Event("resize")); } catch {} });
    await p.waitForTimeout(200);
  }
  const j = await p.evaluate(() => window.__journal);
  ok(j.inserts.length === 1,
     `un même message n'est signalé qu'une fois par session (${j.inserts.length} envoi)`);
  await ctx.close();
}

// ── 3. Le coach voit les plantages ─────────────────────────────────────────
console.log("\n─── Le coach consulte les plantages ───");
{
  const { ctx, p } = await ouvrir({ role: "coach", erreurs: [
    { id: "e1", user_id: "c1", role: "coachee", message: "Cannot read properties of undefined",
      app_version: "185c52c35afc", created_at: "2026-08-09T08:00:00Z" },
    { id: "e2", user_id: "c1", role: "coachee", message: "Network request failed",
      app_version: "185c52c35afc", created_at: "2026-08-08T19:00:00Z" },
  ] });
  await p.locator("text=Suivi").last().click();
  await p.waitForTimeout(1200);

  const vue = await p.locator("body").innerText();
  ok(/2 PLANTAGES/.test(vue), "le nombre de plantages est affiché");
  ok(/MARIE DUPONT/.test(vue), "on sait chez qui ça a planté");
  ok(/Cannot read properties of undefined/.test(vue), "le message est lisible");
  ok(/version 185c52c35afc/.test(vue), "la version du build est indiquée");
  await p.screenshot({ path: `${CAPTURES}erreurs-coach.png`, fullPage: true });

  // Effacer
  await p.locator("text=Effacer").first().click();
  await p.waitForTimeout(400);
  // Viser le bouton DE LA FEUILLE, pas celui du panneau qui est sous le voile.
  await p.locator(".sheet button", { hasText: /^Effacer$/ }).click();
  await p.waitForTimeout(900);
  const j = await p.evaluate(() => window.__journal);
  ok(j.suppressions.length === 1 && j.suppressions[0].length === 2,
     "les deux rapports sont supprimés d'un coup");
  ok(!/PLANTAGE/.test(await p.locator("body").innerText()),
     "le panneau disparaît une fois vide");
  await ctx.close();
}

// ── 4. Aucun plantage : le panneau ne s'affiche pas ────────────────────────
console.log("\n─── Quand tout va bien ───");
{
  const { ctx, p } = await ouvrir({ role: "coach", erreurs: [] });
  await p.locator("text=Suivi").last().click();
  await p.waitForTimeout(1200);
  ok(!/PLANTAGE/.test(await p.locator("body").innerText()),
     "aucun panneau vide en permanence — celui-là, il faut qu'on le remarque");
  await ctx.close();
}

// ── 5. Avant la migration ──────────────────────────────────────────────────
console.log("\n─── Avant que la migration SQL soit jouée ───");
{
  const { ctx, p } = await ouvrir({ role: "coachee", casse: true, panne: true });
  await p.waitForTimeout(700);
  const vue = await p.locator("body").innerText();
  ok(/UN PROBLÈME EST SURVENU/.test(vue),
     "l'écran d'excuse s'affiche quand même — signaler ne doit jamais empêcher d'afficher");
  ok(!/42P01|does not exist/.test(vue), "aucun message technique n'atteint le coaché");
  await ctx.close();
}
{
  const { ctx, p } = await ouvrir({ role: "coach", panne: true });
  await p.locator("text=Suivi").last().click();
  await p.waitForTimeout(1200);
  const vue = await p.locator("body").innerText();
  ok(/SUIVI/.test(vue), "l'onglet Suivi fonctionne normalement");
  ok(!/PLANTAGE/.test(vue), "le panneau des erreurs s'efface simplement");
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
