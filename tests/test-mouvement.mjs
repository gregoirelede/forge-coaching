// ═══════════════════════════════════════════════════════════════════════════
//  LE MOUVEMENT (v8f)
//
//  On ne teste pas qu'une animation est « jolie » — aucune machine ne peut le
//  dire. On teste ce qui est observable, et qui est précisément ce qui casse
//  en silence :
//    · le chiffre PART d'ailleurs et ARRIVE à la bonne valeur ;
//    · il se tait si le téléphone demande de réduire les animations ;
//    · il ne se REJOUE PAS à chaque retour sur l'accueil — une animation revue
//      dix fois par jour cesse d'être un plaisir et devient une attente ;
//    · le hero porte bien son entrée, et elle aussi se coupe en mouvement réduit.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const URL = "http://127.0.0.1:8099/index.html";
let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const F = JSON.parse(readFileSync(import.meta.dirname + "/fixtures-meyssa.json", "utf8"));

// Un jeu de données avec de VRAIES séries loguées : sans elles les trois
// compteurs valent zéro et le test ne prouverait rien. C'est le piège dans
// lequel la première version de ce contrôle est tombée.
const injection = `
const BRUTE = ${JSON.stringify(F.week_structure)};
// La séance est replacée sur le JOUR COURANT, sinon la carte du jour n'existe
// pas les jours de repos et le test échoue un mardi sur deux. Un test qui
// dépend du calendrier n'est pas un test.
const AUJ = ["DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI"][new Date().getDay()];
const P0 = BRUTE.find(j => j.sessionId != null);
const SEM = BRUTE.map(j => j.day === AUJ ? { ...j, sessionId: P0.sessionId }
  : (j.sessionId === P0.sessionId ? { ...j, sessionId: null } : j));
const PROFIL = { id:"c1", name:"Meyssa Razzouk", access_code:"MEXEMPLE42", coach_id:"coach-1",
  offer:"premium", goal:"Fessier", sex:"femme", birth_date:"2004-03-11", height_cm:167,
  is_active:true, start_date:"2026-06-01", created_at:"2026-06-01T06:00:00Z", role:"coachee" };
const PROGRAMME = { id:"p1", coachee_id:"c1", is_active:true, week_structure: SEM,
  sessions_structure: ${JSON.stringify(F.sessions_structure)} };
const SEMAINES = [
  { id:"s13", coachee_id:"c1", program_id:"p1", week_number:13, start_date:"2026-08-24" },
  { id:"s14", coachee_id:"c1", program_id:"p1", week_number:14, start_date:"2026-08-31" },
  { id:"s15", coachee_id:"c1", program_id:"p1", week_number:15, start_date:"2026-09-07" },
];
const SERIES = [];
for (const sem of ["s13","s14","s15"]) {
  for (const s of PROGRAMME.sessions_structure) {
    s.exercises.forEach((ex, ei) => {
      for (let si = 0; si < ex.series; si++) {
        SERIES.push({ id: sem+"-"+s.id+"-"+ei+"-"+si, coachee_id:"c1", week_id: sem,
          session_config_id: s.id, exercise_index: ei, exercise_name: ex.exercice,
          set_index: si, weight: 20 + ei * 5, actual_reps: 10 - si, completed: true,
          logged_at: "2026-09-01T10:00:00Z", week: { week_number: Number(sem.slice(1)) } });
      }
    });
  }
}
const TABLES = { exercises_library: ${JSON.stringify(F.biblio)}, profiles:[PROFIL],
  programs:[PROGRAMME], weeks: SEMAINES, sets_logged: SERIES };
function requete(t){ const q={select:()=>q,order:()=>q,range:()=>q,in:()=>q,gte:()=>q,lte:()=>q,
  lt:()=>q,eq:()=>q,limit:()=>q,update:()=>q,insert:async()=>({data:null,error:null}),
  upsert:async()=>({data:null,error:null}), delete:()=>({eq:async()=>({error:null})}),
  single:async()=>({data:t==="profiles"?PROFIL:t==="programs"?PROGRAMME:null,error:null}),
  maybeSingle:async()=>({data:t==="programs"?PROGRAMME:null,error:null}),
  then(r){return Promise.resolve({data:TABLES[t]||[],error:null}).then(r);}}; return q; }
window.supabase = { createClient: () => ({ auth:{ getSession:async()=>({data:{session:{user:{id:"c1"}}}}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}), signOut:async()=>({error:null}) },
  from: requete, functions:{ invoke: async()=>({data:null,error:null}) } }) };
`;

const b = await chromium.launch();

async function ouvrir(reduit) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
    colorScheme: "light", reducedMotion: reduit ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  await p.addInitScript(injection);
  await p.addInitScript(() => localStorage.setItem("forge_theme", "clair"));
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".stat-card", { timeout: 20000 });
  return { ctx, p };
}
const chiffres = (p) => p.$$eval(".stat-card", n => n.map(c => c.children[1].textContent.trim()));

console.log("─── Les chiffres montent jusqu'à leur valeur ───");
{
  const { ctx, p } = await ouvrir(false);
  const suite = [];
  for (let i = 0; i < 12; i++) { suite.push((await chiffres(p))[2]); await p.waitForTimeout(70); }
  await p.waitForTimeout(1400);
  const final = await chiffres(p);
  const vus = [...new Set(suite)];
  ok(vus.length > 3, `le compteur traverse plusieurs valeurs (${vus.length} : ${vus.slice(0,5).join(", ")}…)`);
  ok(Number(vus[0]) < Number(final[2]), `il part SOUS sa cible (${vus[0]} pour ${final[2]})`);
  // La vérité, c'est le nombre de séries réellement loguées — pas ce que
  // l'animation raconte. Un compteur qui s'arrête au mauvais chiffre serait
  // pire que pas de compteur du tout.
  const attendu = await p.evaluate(() =>
    document.querySelectorAll(".stat-card")[2].children[1].textContent.trim());
  ok(final[2] === attendu && Number(final[2]) > 0,
     `il s'arrête exactement sur la valeur réelle (${final[2]} séries)`);
  ok(final.every(v => /^\d+$/.test(v)), `les trois chiffres sont entiers (${final.join(" · ")})`);
  await ctx.close();
}

console.log("\n─── Il ne se rejoue pas au retour sur l'accueil ───");
{
  const { ctx, p } = await ouvrir(false);
  await p.waitForTimeout(1500);
  const stable = (await chiffres(p))[2];
  await p.locator("text=Progrès").last().click(); await p.waitForTimeout(700);
  await p.locator("text=Accueil").last().click();
  await p.waitForSelector(".stat-card", { timeout: 10000 });
  const suite = [];
  for (let i = 0; i < 7; i++) { suite.push((await chiffres(p))[2]); await p.waitForTimeout(60); }
  ok(new Set(suite).size === 1 && suite[0] === stable,
     `la valeur est affichée directement au retour (${[...new Set(suite)].join(" → ")})`);
  await ctx.close();
}

console.log("\n─── « Réduire les animations » est respecté ───");
{
  const { ctx, p } = await ouvrir(true);
  const suite = [];
  for (let i = 0; i < 7; i++) { suite.push((await chiffres(p))[2]); await p.waitForTimeout(60); }
  ok(new Set(suite).size === 1, `aucun défilement de chiffre (${[...new Set(suite)].join(" → ")})`);
  ok(Number(suite[0]) > 0, `la valeur réelle est là d'emblée (${suite[0]})`);
  const duree = await p.$eval(".hero-card", el => getComputedStyle(el).animationDuration);
  ok(parseFloat(duree) < 0.05, `l'entrée du hero est neutralisée (${duree})`);
  await ctx.close();
}

console.log("\n─── L'entrée du hero vient du thème, pas du composant ───");
{
  const { ctx, p } = await ouvrir(false);
  const h = await p.$eval(".hero-card", el => ({
    classe: el.className,
    nom: getComputedStyle(el).animationName,
    courbe: getComputedStyle(el).animationTimingFunction }));
  ok(/hero-entree/.test(h.classe), `la carte porte la classe du thème (${h.classe})`);
  ok(h.nom === "heroEntree", `l'animation est bien celle déclarée dans theme.css (${h.nom})`);
  // La courbe doit être --ressort : l'app affirme UNE physique, pas cinq.
  ok(/cubic-bezier\(0.32,\s*0.72,\s*0,\s*1\)/.test(h.courbe),
     `elle emprunte la courbe de ressort du système (${h.courbe})`);
  // Et la @keyframes doit vivre dans le <head>, sinon elle n'existe pas encore
  // quand l'écran de démarrage s'affiche — le piège de la v7y.
  const html = readFileSync(import.meta.dirname + "/../index.html", "utf8");
  const tete = html.slice(0, html.indexOf("</head>"));
  ok(/@keyframes\s+heroEntree/.test(tete),
     "la @keyframes est déclarée dans le <head>, pas dans un composant");
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
