// Gros plan sur le hero : c'est un détail de matière, il ne se juge pas à
// l'échelle d'un écran entier.
import { chromium } from "playwright";
import { readFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const RACINE = "/home/user/forge-coaching";
const SORTIE = "/tmp/maquettes";
mkdirSync(SORTIE, { recursive: true });
const F = JSON.parse(readFileSync(RACINE + "/tests/fixtures-meyssa.json", "utf8"));
const ORIGINAL = RACINE + "/src/theme.css";
const SAUVE = SORTIE + "/theme-original.css";
if (!existsSync(SAUVE)) copyFileSync(ORIGINAL, SAUVE);

const injection = `
const SEMAINE_BRUTE = ${JSON.stringify(F.week_structure)};
const AUJ = ["DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI"][new Date().getDay()];
const P0 = SEMAINE_BRUTE.find(j => j.sessionId != null);
const SEM = SEMAINE_BRUTE.map(j => j.day === AUJ ? { ...j, sessionId: P0.sessionId }
  : (j.sessionId === P0.sessionId ? { ...j, sessionId: null } : j));
const PROFIL = { id:"c1", name:"Meyssa Razzouk", access_code:"MEXEMPLE42", coach_id:"coach-1",
  offer:"premium", goal:"Fessier", sex:"femme", birth_date:"2004-03-11", height_cm:167,
  is_active:true, start_date:"2026-06-01", created_at:"2026-06-01T06:00:00Z", role:"coachee" };
const PROGRAMME = { id:"p1", coachee_id:"c1", is_active:true, week_structure: SEM,
  sessions_structure: ${JSON.stringify(F.sessions_structure)} };
const TABLES = { exercises_library: ${JSON.stringify(F.biblio)}, profiles:[PROFIL], programs:[PROGRAMME] };
function requete(t){ const q={select:()=>q,order:()=>q,range:()=>q,in:()=>q,gte:()=>q,lte:()=>q,lt:()=>q,
  eq:()=>q,limit:()=>q,update:()=>q,insert:async()=>({data:null,error:null}),upsert:async()=>({data:null,error:null}),
  delete:()=>({eq:async()=>({error:null})}),
  single:async()=>({data:t==="profiles"?PROFIL:t==="programs"?PROGRAMME:null,error:null}),
  maybeSingle:async()=>({data:t==="programs"?PROGRAMME:null,error:null}),
  then(r){return Promise.resolve({data:TABLES[t]||[],error:null}).then(r);}}; return q; }
window.supabase = { createClient: () => ({ auth:{ getSession:async()=>({data:{session:{user:{id:"c1"}}}}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}), signOut:async()=>({error:null}) },
  from: requete, functions:{ invoke: async()=>({data:null,error:null}) } }) };
`;

const VARIANTES = process.argv.slice(2);
const b = await chromium.launch();
for (const v of VARIANTES) {
  copyFileSync(`${RACINE}/outils/palettes/${v}.css`, ORIGINAL);
  execSync("npm run build", { cwd: RACINE, stdio: "pipe" });
  for (const theme of ["clair", "sombre"]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
                                     colorScheme: theme === "sombre" ? "dark" : "light" });
    const p = await ctx.newPage();
    await p.addInitScript(injection);
    await p.addInitScript(m => localStorage.setItem("forge_theme", m), theme);
    await p.route("**/cdn.jsdelivr.net/**", r =>
      r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
    await p.goto("http://127.0.0.1:8099/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2600);
    const hero = p.locator(".hero-card");
    if (await hero.count()) {
      await hero.screenshot({ path: `${SORTIE}/gp-${v}-${theme}.png` });
      // Combien de valeurs distinctes le hero porte-t-il vraiment ?
      const n = await p.evaluate(() => {
        const el = document.querySelector(".hero-card");
        const s = getComputedStyle(el);
        return { fond: s.backgroundImage.slice(0, 60), grain: getComputedStyle(el, "::after").opacity };
      });
      console.log(`  ${v} · ${theme} — grain ${n.grain} — ${n.fond}`);
    }
    await ctx.close();
  }
}
copyFileSync(SAUVE, ORIGINAL);
execSync("npm run build", { cwd: RACINE, stdio: "pipe" });
await b.close();
