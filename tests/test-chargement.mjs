// ═══════════════════════════════════════════════════════════════════════════
//  LES ÉCRANS DE CHARGEMENT
//
//  Un défaut mesuré le 9 septembre 2026, sur l'écran le plus vu de l'app :
//  les @keyframes ne vivaient que dans les blocs <style> de AuthenticatedApp
//  et de CoachApp. Au démarrage, aucun des deux n'est monté — donc AUCUNE
//  keyframe n'existait, et le logo de « Initialisation… » demandait
//  `animation: pulse` dans le vide. Il restait parfaitement immobile, tout
//  comme le spinner de l'écran de connexion.
//
//  Le premier contrôle ci-dessous est celui qui compte : il vérifie que les
//  animations sont définies AVANT que React ait monté quoi que ce soit.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });
const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const b = await chromium.launch();

// Une session qui ne répond jamais : l'app reste sur son écran de démarrage,
// ce qui est exactement la situation qu'on veut observer.
const JAMAIS = `window.supabase={createClient:()=>({auth:{
  getSession:async()=>new Promise(()=>{}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};`;

async function ouvrir(stub = JAMAIS) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: stub }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  return { ctx, p, err };
}

// ═══ 1. LES ANIMATIONS EXISTENT DÈS LA PREMIÈRE IMAGE ══════════════════════
console.log("\n─── Les animations sont définies avant que React démarre ───");
{
  const { ctx, p, err } = await ouvrir();
  await p.waitForTimeout(2200);
  const r = await p.evaluate(() => {
    const noms = new Set();
    for (const f of document.styleSheets) {
      try { for (const rg of f.cssRules) if (rg.type === CSSRule.KEYFRAMES_RULE) noms.add(rg.name); } catch {}
    }
    // Ce que la page DEMANDE, par opposition à ce qui existe.
    const demandees = new Set();
    for (const e of document.querySelectorAll("*")) {
      const a = getComputedStyle(e).animationName;
      if (a && a !== "none") a.split(",").forEach(x => demandees.add(x.trim()));
    }
    return { definies: [...noms], demandees: [...demandees], texte: document.body.innerText };
  });
  for (const nom of ["spin", "pulse", "fadeIn", "fadeUp", "popIn", "miroitement"]) {
    ok(r.definies.includes(nom), `@keyframes ${nom} existe`);
  }
  const orphelines = r.demandees.filter(d => !r.definies.includes(d));
  ok(orphelines.length === 0,
     `aucune animation demandée sans être définie (${orphelines.join(", ") || "aucune"}) — c'était le bug`);
  ok(r.demandees.includes("pulse"), "le logo du démarrage demande bien une animation");
  ok(/Connexion/.test(r.texte), `l'écran annonce l'étape en cours : ${JSON.stringify(r.texte.trim().slice(0, 40))}`);
  ok(err.length === 0, `aucune erreur JS (${err.length})`);
  await p.screenshot({ path: `${CAPTURES}chargement-demarrage.png` });
  await ctx.close();
}

// ═══ 2. QUAND LE RÉSEAU TRAÎNE, ON LE DIT ══════════════════════════════════
console.log("\n─── Au-delà de quelques secondes ───");
{
  const { ctx, p } = await ouvrir();
  await p.waitForTimeout(2000);
  ok(!/connexion est lente/i.test(await p.locator("body").innerText()),
     "rien d'alarmant dans les premières secondes");

  // On avance l'horloge plutôt que d'attendre 12 secondes pour de vrai.
  await p.evaluate(() => {
    const V = Date; let saut = 0;
    Date = class extends V {
      constructor(...a) { super(...(a.length ? a : [V.now() + saut])); }
      static now() { return V.now() + saut; }
    };
    Date.parse = V.parse; Date.UTC = V.UTC;
    window.__avancer = (ms) => { saut += ms; };
  });
  await p.evaluate(() => window.__avancer(7000));
  await p.waitForTimeout(1400);
  ok(/connexion est lente/i.test(await p.locator("body").innerText()),
     "passé 6 s, le coaché est prévenu au lieu de croire à un plantage");
  ok(!/Réessayer/i.test(await p.locator("body").innerText()),
     "mais pas encore de bouton : on lui laisse le temps");

  await p.evaluate(() => window.__avancer(7000));
  await p.waitForTimeout(1400);
  ok(/Réessayer/i.test(await p.locator("body").innerText()),
     "passé 12 s, un bouton pour relancer");
  await p.screenshot({ path: `${CAPTURES}chargement-lent.png` });
  await ctx.close();
}

// ═══ 3. LES SQUELETTES ═════════════════════════════════════════════════════
console.log("\n─── Les pages internes montrent leur structure ───");
{
  // Une session valide, mais des requêtes de données qui ne répondent jamais :
  // l'app arrive sur une page et doit afficher un squelette, pas un vide.
  const LENT = `
const PROG = { id:"p1", coachee_id:"c1", is_active:true,
  week_structure:[{day:"LUNDI",sessionId:1}],
  sessions_structure:[{id:1,name:"SEANCE",abdosCardio:[],exercises:[]}] };
const COACHE = { id:"c1", name:"Marie Dupont", role:"coachee", coach_id:"coach-1",
  access_code:"MDUPONT27", offer:"premium", is_active:true, created_at:"2026-06-01T09:00:00Z" };
function requete(t){
  const jamais = () => new Promise(()=>{});
  const q={_f:{},select(){return q},order(){return q},in(){return q},gte(){return q},limit(){return q},
   eq(c,v){q._f[c]=v;return q},update(){return q},insert:async()=>({data:null,error:null}),upsert:async()=>({data:null,error:null}),
   delete(){return{eq:async()=>({error:null})}},
   single:async()=>({data:t==="profiles"?COACHE:t==="programs"?PROG:null,error:null}),
   maybeSingle:async()=>({data:t==="programs"?PROG:null,error:null}),
   then(r){ if(t==="periodization_phases"||t==="foods"||t==="diet_plans") return jamais();
            return Promise.resolve({data:[],error:null}).then(r) }};
  return q}
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:"c1"}}}}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
 from:requete,functions:{invoke:async()=>({data:null,error:null})}})};`;
  const { ctx, p, err } = await ouvrir(LENT);
  await p.waitForTimeout(2600);
  await p.locator("text=Parcours").last().click();
  await p.waitForTimeout(900);

  const r = await p.evaluate(() => {
    const sq = document.querySelectorAll(".squelette");
    const anim = sq.length ? getComputedStyle(sq[0]).animationName : null;
    const busy = document.querySelector('[aria-busy="true"]');
    return { nb: sq.length, anim, busy: !!busy, spinners: document.querySelectorAll("svg circle[stroke-dasharray]").length };
  });
  ok(r.nb > 5, `la page affiche sa structure en attendant (${r.nb} blocs)`);
  ok(r.anim === "miroitement", `les blocs miroitent (${r.anim})`);
  ok(r.busy, "l'état de chargement est annoncé aux lecteurs d'écran (aria-busy)");
  ok(err.length === 0, `aucune erreur JS (${err.length})`);
  await p.screenshot({ path: `${CAPTURES}chargement-squelette.png`, fullPage: true });
  await ctx.close();
}

console.log("\n─── En mode sombre ───");
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const p = await ctx.newPage();
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: JAMAIS }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1800);
  const fond = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(fond === "rgb(16, 21, 18)", `l'écran de démarrage suit le thème sombre (${fond})`);
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
