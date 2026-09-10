// Rend chaque variante de palette sur les écrans réels de l'app.
// Rien n'est déployé : on construit dans un dossier à part et on photographie.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const RACINE = "/home/user/forge-coaching";
const SORTIE = process.env.SORTIE || "/tmp/maquettes";
mkdirSync(SORTIE, { recursive: true });
const F = JSON.parse(readFileSync(RACINE + "/tests/fixtures-meyssa.json", "utf8"));

const VARIANTES = process.argv.slice(2);
const ORIGINAL = RACINE + "/src/theme.css";
const SAUVEGARDE = SORTIE + "/theme-original.css";
if (!existsSync(SAUVEGARDE)) copyFileSync(ORIGINAL, SAUVEGARDE);

const injection = `
const PROFIL = { id: "c1", name: "Meyssa Razzouk", access_code: "MEXEMPLE42", coach_id: "coach-1",
                 offer: "premium", goal: "Fessier", sex: "femme", birth_date: "2004-03-11",
                 height_cm: 167, is_active: true, start_date: "2026-06-01",
                 created_at: "2026-06-01T06:00:00Z", role: "coachee" };
const SEMAINE_BRUTE = ${JSON.stringify(F.week_structure)};
// Une maquette doit montrer l'écran QU'ON JUGE. Meyssa s'entraîne mercredi et
// dimanche : un jeudi, l'accueil affiche « jour de repos » et le hero — donc
// tout le vert de marque — n'existe pas. On déplace la séance sur aujourd'hui.
const AUJ = ["DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI"][new Date().getDay()];
const PREMIERE = SEMAINE_BRUTE.find(j => j.sessionId != null);
const SEMAINE_MAQUETTE = SEMAINE_BRUTE.map(j =>
  j.day === AUJ ? { ...j, sessionId: PREMIERE.sessionId }
  : (j.sessionId === PREMIERE.sessionId ? { ...j, sessionId: null } : j));
const PROGRAMME = { id: "p1", coachee_id: "c1", is_active: true,
  week_structure: SEMAINE_MAQUETTE,
  sessions_structure: ${JSON.stringify(F.sessions_structure)} };
const SEMAINES = [
  { id:"s13", coachee_id:"c1", program_id:"p1", week_number:13, start_date:"2026-08-24" },
  { id:"s14", coachee_id:"c1", program_id:"p1", week_number:14, start_date:"2026-08-31" },
  { id:"s15", coachee_id:"c1", program_id:"p1", week_number:15, start_date:"2026-09-07" },
];
// De vraies séries, pour que le vert/rouge de progression soit VISIBLE sur la
// maquette : c'est la moitié de la décision à prendre.
const SERIES = [];
for (const sem of ["s13","s14","s15"]) {
  for (const s of PROGRAMME.sessions_structure) {
    s.exercises.forEach((ex, ei) => {
      for (let si = 0; si < ex.series; si++) {
        const base = 20 + ei * 5;
        // Semaine en cours : la variation joue SÉRIE PAR SÉRIE, pas exercice
        // par exercice — sinon une carte dépliée n'affiche qu'une seule des
        // deux couleurs, et c'est précisément leur cohabitation qu'on juge.
        const bouge = sem === "s15" ? (si % 2 === 0 ? 2.5 : -2.5) : 0;
        SERIES.push({ id: sem+"-"+s.id+"-"+ei+"-"+si, coachee_id:"c1", week_id: sem,
          session_config_id: s.id, exercise_index: ei, exercise_name: ex.exercice,
          set_index: si, weight: base + bouge, actual_reps: 10 - si, completed: true,
          logged_at: "2026-09-01T10:00:00Z", week: { week_number: Number(sem.slice(1)) } });
      }
    });
  }
}
const PESEES = [
  { id:"w1", coachee_id:"c1", weight_kg:58.4, logged_date:"2026-08-10" },
  { id:"w2", coachee_id:"c1", weight_kg:58.9, logged_date:"2026-08-17" },
  { id:"w3", coachee_id:"c1", weight_kg:59.3, logged_date:"2026-08-24" },
  { id:"w4", coachee_id:"c1", weight_kg:59.6, logged_date:"2026-09-01" },
];
const PHASES = [
  { id:"ph1", coachee_id:"c1", phase_type:"prise_de_masse", name:"Construction",
    start_date:"2026-06-01", end_date:"2026-10-15", goal_adjustment_pct:12, phase_order:1 },
  { id:"ph2", coachee_id:"c1", phase_type:"seche", name:"Affûtage",
    start_date:"2026-10-16", end_date:"2027-01-10", goal_adjustment_pct:-17, phase_order:2 },
];
const TABLES = { exercises_library: ${JSON.stringify(F.biblio)}, profiles: [PROFIL],
  programs: [PROGRAMME], weeks: SEMAINES, sets_logged: SERIES, weight_logs: PESEES,
  periodization_phases: PHASES };
function requete(table) {
  const q = { select:()=>q, order:()=>q, range:()=>q, in:()=>q, gte:()=>q, lte:()=>q, lt:()=>q,
    eq:()=>q, limit:()=>q, update:()=>q, insert: async()=>({data:null,error:null}),
    upsert: async()=>({data:null,error:null}), delete:()=>({ eq: async()=>({error:null}) }),
    single: async()=>({ data: table==="profiles"?PROFIL : table==="programs"?PROGRAMME : null, error:null }),
    maybeSingle: async()=>({ data: table==="programs"?PROGRAMME : null, error:null }),
    then(res){ return Promise.resolve({ data: TABLES[table] || [], error: null }).then(res); } };
  return q;
}
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { user: { id: "c1" } } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
          signOut: async () => ({ error: null }) },
  from: requete, functions: { invoke: async () => ({ data: null, error: null }) } }) };
`;

const b = await chromium.launch();
for (const variante of VARIANTES) {
  copyFileSync(`${RACINE}/outils/palettes/${variante}.css`, ORIGINAL);
  execSync("npm run build", { cwd: RACINE, stdio: "pipe" });
  for (const theme of ["clair", "sombre"]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
                                     colorScheme: theme === "sombre" ? "dark" : "light" });
    const p = await ctx.newPage();
    const erreurs = [];
    p.on("pageerror", e => erreurs.push(e.message));
    await p.addInitScript(injection);
    await p.addInitScript(m => localStorage.setItem("forge_theme", m), theme);
    await p.route("**/cdn.jsdelivr.net/**", r =>
      r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
    await p.goto("http://127.0.0.1:8099/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2600);
    for (const [fichier, onglet] of [["1-accueil","ACCUEIL"], ["2-seance","SÉANCES"],
                                     ["3-parcours","PARCOURS"], ["4-progres","PROGRÈS"]]) {
      try {
        await p.locator(`text=${onglet}`).last().click({ timeout: 4000 });
        await p.waitForTimeout(1000);
        await p.screenshot({ path: `${SORTIE}/${variante}-${theme}-${fichier}.png` });
        if (onglet === "SÉANCES") {
          // Déplier un exercice : les bulles charge/reps y portent le couple
          // turquoise/corail, qui est la seconde décision à trancher.
          await p.locator("text=Hip thrust barre").first().click({ timeout: 4000 });
          await p.waitForTimeout(900);
          await p.screenshot({ path: `${SORTIE}/${variante}-${theme}-2b-series.png` });
        }
      } catch (e) { console.log(`   ${variante}/${theme}/${onglet} : ${e.message.split("\n")[0]}`); }
    }
    // La surface réellement prise par le vert : c'est le chiffre à vérifier.
    const surf = await p.evaluate(() => {
      let vert = 0, total = 0;
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > 844) continue;
        const aire = Math.min(r.width, 390) * Math.min(r.height, 844 - Math.max(0, r.top));
        if (aire <= 0) continue;
        const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
        if (!m || (m.length > 3 && parseFloat(m[3]) < 0.5)) continue;
        const [r0, g0, b0] = m.slice(0, 3).map(Number);
        total += aire;
        const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0);
        if (mx === mn) continue;
        let H = mx === r0 ? ((g0 - b0) / (mx - mn) + (g0 < b0 ? 6 : 0))
              : mx === g0 ? ((b0 - r0) / (mx - mn) + 2) : ((r0 - g0) / (mx - mn) + 4);
        H = (H * 60 + 360) % 360;
        // Il faut une teinte verte ET assez de matière : le fond vert-charbon
        // du mode sombre (L≈17 %, S≈11 %) n'est pas de la couleur de marque.
        const L = (mx + mn) / 2 / 255;
        const S = mx === mn ? 0 : (L > 0.5 ? (mx - mn) / (510 - mx - mn) : (mx - mn) / (mx + mn));
        if (H > 120 && H < 200 && S > 0.20 && L > 0.09 && L < 0.75) vert += aire;
      }
      return total ? Math.round(100 * vert / total) : 0;
    });
    console.log(`  ${variante} · ${theme} — vert de marque : ${surf} % de l'écran` +
                (erreurs.length ? `  (${erreurs.length} erreur JS !)` : ""));
    await ctx.close();
  }
}
copyFileSync(SAUVEGARDE, ORIGINAL);
execSync("npm run build", { cwd: RACINE, stdio: "pipe" });
await b.close();
console.log("\nPalette d'origine restaurée, index.html reconstruit.");
