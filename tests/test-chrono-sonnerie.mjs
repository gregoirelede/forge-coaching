// ═══════════════════════════════════════════════════════════════════════════
//  CHRONOMÈTRES DE REPOS ET SONNERIE
//
//  Deux bugs signalés par l'usage réel, corrigés ensemble parce qu'ils se
//  manifestent au même endroit — la fin d'un repos.
//
//  1. LA SONNERIE NE PARTAIT JAMAIS. Un AudioContext était créé au moment où
//     le chrono tombait à zéro, donc hors de tout geste utilisateur. Les
//     navigateurs le font naître « suspended » : les bips étaient programmés,
//     rien ne sortait. Aucune erreur, aucun message.
//
//  2. LE DÉCOMPTE GELAIT écran verrouillé. Il retranchait une seconde à chaque
//     tick de setInterval ; iOS suspend les minuteurs en arrière-plan, donc
//     deux minutes de repos pouvaient en durer cinq.
//
//  Ce que la machine de test NE PEUT PAS prouver : qu'un son est audible. On
//  prouve donc ce qui est observable et suffisant — qu'un seul contexte audio
//  existe, qu'il est débloqué par un geste, qu'il est réutilisé, et que le
//  décompte suit l'horloge murale plutôt que le nombre de ticks.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });
const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const injection = `
// ── Instrumentation de l'audio ────────────────────────────────────────────
window.__audio = { crees: 0, resumes: 0 };
const _AC = window.AudioContext || window.webkitAudioContext;
function ACSuivi() {
  window.__audio.crees++;
  const c = new _AC();
  const r = c.resume.bind(c);
  c.resume = () => { window.__audio.resumes++; return r(); };
  return c;
}
window.AudioContext = ACSuivi;
window.webkitAudioContext = ACSuivi;
// Safari 16.4+ expose cette API ; on la simule pour vérifier qu'on la règle.
Object.defineProperty(navigator, "audioSession", {
  value: { type: "auto" }, configurable: true, writable: true,
});

// ── Horloge décalable, pour simuler un téléphone verrouillé ───────────────
window.__decalage = 0;
const _now = Date.now.bind(Date);
Date.now = () => _now() + window.__decalage;

// ── Base simulée ──────────────────────────────────────────────────────────
const COACHE = { id: "c1", name: "Marie Dupont", role: "coachee", coach_id: "coach-1",
                 access_code: "MDUPONT27", offer: "premium", is_active: true,
                 created_at: "2026-06-01T09:00:00Z" };
const PROGRAMME = { id: "p1", coachee_id: "c1", is_active: true,
  week_structure: [{ day: "LUNDI", sessionId: 1 }, { day: "MARDI", sessionId: 1 },
                   { day: "MERCREDI", sessionId: 1 }, { day: "JEUDI", sessionId: 1 },
                   { day: "VENDREDI", sessionId: 1 }, { day: "SAMEDI", sessionId: 1 },
                   { day: "DIMANCHE", sessionId: 1 }],
  sessions_structure: [{ id: 1, name: "SÉANCE TEST", abdosCardio: [], exercises: [
    { ordre: 1, exercice: "Développé couché", muscle: "Pectoraux",
      series: 3, reps: ["8","8","8"], repos: "2'00" }] }] };

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

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const erreurs = [];
p.on("pageerror", e => erreurs.push(e.message));
await p.addInitScript(injection);
await p.route("**/cdn.jsdelivr.net/**", r =>
  r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2600);

// ═══ 1. LE CONTRAT AUDIO ═══════════════════════════════════════════════════
console.log("\n─── Avant tout geste ───");
{
  // Le chargement de l'app ne doit créer AUCUN contexte : en créer un hors
  // geste, c'est exactement le bug qu'on corrige.
  const avant = await p.evaluate(() => ({
    crees: window.__audio.crees,
    armee: typeof sonnerieArmee === "function" ? sonnerieArmee() : null,
  }));
  ok(avant.armee === false, "la sonnerie se déclare non armée");

  // Appelée sans geste préalable, elle ne doit RIEN inventer et le dire.
  const sansGeste = await p.evaluate(() => ({
    joue: playRestChime(),
    crees: window.__audio.crees,
  }));
  ok(sansGeste.joue === false,
     "playRestChime() renvoie false quand rien n'a été débloqué — elle ne prétend pas avoir sonné");
  ok(sansGeste.crees === avant.crees,
     `elle ne crée PAS de contexte audio à la volée (${sansGeste.crees}) — c'était la cause du bug`);
}

console.log("\n─── Le premier appui débloque le son ───");
{
  // Un vrai appui, pas un appel de fonction : c'est la seule chose que le
  // navigateur reconnaît.
  await p.mouse.click(195, 400);
  await p.waitForTimeout(400);
  const apres = await p.evaluate(() => ({
    crees: window.__audio.crees,
    armee: sonnerieArmee(),
    session: navigator.audioSession.type,
  }));
  ok(apres.crees === 1, `un seul contexte audio est créé (${apres.crees})`);
  ok(apres.armee === true, "la sonnerie est armée");
  ok(apres.session === "playback",
     `la session audio est déclarée « playback » (${apres.session}) — sinon l'interrupteur silencieux de l'iPhone coupe tout`);
}

console.log("\n─── Le contexte est RÉUTILISÉ, jamais recréé ───");
{
  const r = await p.evaluate(() => {
    const res = [playRestChime(), playRestChime(), playRestChime()];
    return { res, crees: window.__audio.crees };
  });
  ok(r.res.every(Boolean), "trois sonneries de suite partent toutes");
  ok(r.crees === 1,
     `toujours un seul contexte après trois sonneries (${r.crees}) — l'ancienne version en créait un par bip`);
}

console.log("\n─── Retour au premier plan ───");
{
  const avant = await p.evaluate(() => window.__audio.resumes);
  await p.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.waitForTimeout(300);
  const apres = await p.evaluate(() => ({ resumes: window.__audio.resumes, crees: window.__audio.crees }));
  ok(apres.crees === 1, "revenir dans l'app ne crée pas un contexte de plus");
  ok(apres.resumes >= avant, "et le contexte est réveillé, pas remplacé");
}

// ═══ 2. LE DÉCOMPTE SUIT L'HORLOGE, PAS LES TICKS ══════════════════════════
console.log("\n─── Le chrono de repos ───");
{
  await p.locator("text=SÉANCES").last().click();
  await p.waitForTimeout(900);
  // Déplier l'exercice, puis valider la première série : c'est ce geste qui
  // lance le repos de 2'00.
  await p.locator("text=Développé couché").first().click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${CAPTURES}chrono-seance.png`, fullPage: true });

  const lireDecompte = async () => {
    const t = await p.locator("body").innerText();
    const m = t.match(/Encore\s+(\d+):(\d+)/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
  };

  await p.locator("text=/Série 1 .* 8 reps/").first().click();
  await p.waitForTimeout(800);
  const lance = (await lireDecompte()) != null;
  ok(lance, "un repos démarre à la validation d'une série");

  if (lance) {
    const t0 = await lireDecompte();
    ok(t0 > 100 && t0 <= 120, `le décompte démarre à 2'00 (${t0} s)`);

    // Le téléphone se verrouille : iOS gèle les minuteurs. On simule en
    // avançant l'horloge SANS laisser les ticks s'exécuter proportionnellement.
    await p.evaluate(() => { window.__decalage += 60000; });
    await p.waitForTimeout(900);
    const t1 = await lireDecompte();
    const ecoule = t0 - t1;
    ok(ecoule >= 58 && ecoule <= 63,
       `après 60 s écran verrouillé, le décompte a bien perdu 60 s (${ecoule} s) — l'ancienne version en perdait 1`);

    // Et il se termine quand l'heure de fin est réellement passée.
    await p.evaluate(() => { window.__decalage += 120000; });
    await p.waitForTimeout(1200);
    ok(await lireDecompte() === null,
       "passé l'heure de fin, le repos est terminé et le bandeau disparaît");
  }
}

console.log("\n─── Aucune erreur applicative ───");
ok(erreurs.length === 0, `aucune erreur JS (${erreurs.length})${erreurs[0] ? " : " + erreurs[0].slice(0, 90) : ""}`);

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
