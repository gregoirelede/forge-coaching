// ═══════════════════════════════════════════════════════════════════════════
//  Vidéos de démonstration : reconnaissance des liens, et affichage côté coaché.
//
//  La reconnaissance est testée sur le code RÉELLEMENT LIVRÉ : la fonction est
//  extraite de l'index.html construit, pas recopiée ici. Une divergence entre
//  ce qui est testé et ce qui est déployé n'aurait aucun intérêt.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const CAPTURES = import.meta.dirname + "/captures/";
mkdirSync(CAPTURES, { recursive: true });

const URL = "http://127.0.0.1:8099/index.html";

let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };

const b = await chromium.launch();

// ── 1. Reconnaissance des liens, dans le navigateur, sur le code livré ──────
console.log("\n─── Reconnaissance des liens ───");
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);

  // analyseVideo n'est pas exportée : on la récupère depuis le bundle inliné.
  const dispo = await p.evaluate(() => {
    const src = [...document.querySelectorAll("script")].map(s => s.textContent).join("\n");
    const i = src.indexOf("function analyseVideo(");
    if (i < 0) return false;
    // Découpe la fonction en comptant les accolades.
    let n = 0, j = src.indexOf("{", i);
    const debut = j;
    do { if (src[j] === "{") n++; else if (src[j] === "}") n--; j++; } while (n > 0 && j < src.length);
    // eslint-disable-next-line no-eval
    window.__analyse = eval(`(${src.slice(i, debut)}${src.slice(debut, j)})`);
    return typeof window.__analyse === "function";
  });
  ok(dispo, "la fonction de reconnaissance est bien présente dans l'index.html livré");

  const cas = [
    // [lien, type attendu, src attendu ou null, description]
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "embed", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "YouTube, lien classique"],
    ["https://youtu.be/dQw4w9WgXcQ", "embed", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "YouTube, lien court"],
    ["https://www.youtube.com/shorts/abc123XYZ", "embed", "https://www.youtube-nocookie.com/embed/abc123XYZ", "YouTube Shorts"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "embed", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "YouTube mobile"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "embed", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "YouTube avec un horodatage"],
    ["https://vimeo.com/123456789", "embed", "https://player.vimeo.com/video/123456789", "Vimeo"],
    ["https://exemple.fr/demo.mp4", "fichier", "https://exemple.fr/demo.mp4", "fichier .mp4 direct"],
    ["https://exemple.fr/demo.webm", "fichier", null, "fichier .webm direct"],
    ["https://exemple.fr/page-de-demo", "lien", null, "site non reconnu : on ouvre dans le navigateur"],
  ];

  for (const [lien, type, src, desc] of cas) {
    const r = await p.evaluate(l => window.__analyse(l), lien);
    const bon = r && r.type === type && (src === null || r.src === src);
    ok(bon, `${desc}${bon ? "" : ` → ${JSON.stringify(r)}`}`);
  }

  console.log("\n─── Liens dangereux ou vides ───");
  for (const [lien, desc] of [
    ["javascript:alert(document.cookie)", "un javascript: est refusé"],
    ["data:text/html,<script>alert(1)</script>", "une data: URL est refusée"],
    ["  ", "un champ vide ne produit rien"],
    ["pas une url", "un texte quelconque est refusé"],
    ["vbscript:msgbox(1)", "un vbscript: est refusé"],
  ]) {
    const r = await p.evaluate(l => window.__analyse(l), lien);
    ok(r === null, desc);
  }

  // Le lecteur ne doit jamais fabriquer une iframe à partir d'un lien non reconnu :
  // un site qui refuse l'encastrement afficherait un cadre vide et muet.
  const r = await p.evaluate(() => window.__analyse("https://exemple.fr/page-de-demo"));
  ok(r.type === "lien", "un site inconnu n'est pas encastré de force");

  await ctx.close();
}

// ── 2. Le coaché voit la démonstration dans sa séance ───────────────────────
console.log("\n─── Le coaché ouvre une démonstration ───");
{
  const injection = `
const PROFIL = { id: "c1", name: "Marie Dupont", access_code: "MDUPONT27", coach_id: "coach-1",
                 offer: "premium", goal: "Prise de masse", start_date: "2026-01-06",
                 created_at: "2026-01-06T09:00:00Z", role: "coachee" };
const PROGRAMME = { id: "p1", coachee_id: "c1", is_active: true,
  week_structure: [{ day: "LUNDI", sessionId: 1 }, { day: "MARDI", sessionId: null },
    { day: "MERCREDI", sessionId: null }, { day: "JEUDI", sessionId: null },
    { day: "VENDREDI", sessionId: null }, { day: "SAMEDI", sessionId: null }, { day: "DIMANCHE", sessionId: null }],
  sessions_structure: [{ id: 1, name: "PUSH A", exercises: [
    { ordre: 1, library_exercise_id: "ex-avec-video", exercice: "Développé couché", muscle: "Pectoraux",
      series: 3, reps: ["8","8","8"], repos: "2'00", commentaire: "", technique: null },
    { ordre: 2, library_exercise_id: "ex-sans-video", exercice: "Écarté poulie", muscle: "Pectoraux",
      series: 3, reps: ["12","12","12"], repos: "1'30", commentaire: "", technique: null },
  ], abdosCardio: [] }] };
const BIBLIO = [
  { id: "ex-avec-video", coach_id: "coach-1", name: "Développé couché", muscle: "Pectoraux",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id: "ex-sans-video", coach_id: "coach-1", name: "Écarté poulie", muscle: "Pectoraux", video_url: null },
];

function requete(table) {
  const q = { _f: {},
    select(){ return q; }, order(){ return q; }, in(){ return q; }, gte(){ return q; }, limit(){ return q; },
    update(){ return q; }, insert: async()=>({data:null,error:null}), upsert: async()=>({data:null,error:null}),
    delete(){ return { eq: async()=>({error:null}) }; },
    eq(c,v){ q._f[c]=v; return q; },
    single: async()=>({ data: table==="profiles" ? PROFIL : table==="programs" ? PROGRAMME : null, error:null }),
    maybeSingle: async()=>({ data: table==="programs" ? PROGRAMME : null, error:null }),
    then(res){
      let d = [];
      if (table === "exercises_library") d = BIBLIO;
      return Promise.resolve({ data: d, error: null }).then(res);
    },
  };
  return q;
}
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { user: { id: "c1" } } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
          signOut: async () => ({ error: null }) },
  from: requete,
  functions: { invoke: async () => ({ data: null, error: null }) },
}) };
`;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(injection);
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  // On n'appelle jamais YouTube pour de vrai depuis un test.
  await p.route("**/youtube-nocookie.com/**", r =>
    r.fulfill({ status: 200, contentType: "text/html", body: "<html><body>lecteur simulé</body></html>" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2400);

  await p.locator("text=SÉANCES").last().click();
  await p.waitForTimeout(700);

  // Déplier le premier exercice
  await p.locator("text=Développé couché").last().click();
  await p.waitForTimeout(500);

  const bouton = p.locator("text=Voir la démonstration");
  ok(await bouton.count() === 1, "le bouton n'apparaît que sur l'exercice qui a une vidéo");

  // Ouvrir le second exercice referme le premier (un seul déplié à la fois) :
  // il ne doit alors plus y avoir aucun bouton, puisque celui-ci n'a pas de vidéo.
  await p.locator("text=Écarté poulie").last().click();
  await p.waitForTimeout(500);
  ok(await p.locator("text=Voir la démonstration").count() === 0,
     "l'exercice sans vidéo n'affiche aucun bouton");

  console.log("\n─── Le lecteur ───");
  // Rien ne doit partir sur le réseau tant que le coaché n'a pas demandé.
  ok(await p.locator("iframe").count() === 0, "aucune vidéo n'est chargée avant le clic");

  await p.locator("text=Développé couché").last().click();
  await p.waitForTimeout(400);
  await p.locator("text=Voir la démonstration").click();
  await p.waitForTimeout(800);

  const iframe = p.locator("iframe");
  ok(await iframe.count() === 1, "le lecteur s'ouvre");
  const src = await iframe.getAttribute("src");
  ok(src === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
     `il pointe sur la version sans cookie de YouTube`);
  ok(!/youtube\.com\/watch/.test(src || ""), "le lien de la page YouTube n'est jamais encastré tel quel");

  const feuille = await p.evaluate(() => {
    const t = [...document.querySelectorAll("div")].find(d => d.textContent.trim() === "Développé couché" && !d.children.length && /Bebas/.test(getComputedStyle(d).fontFamily));
    return t ? t.parentElement.parentElement.innerText : null;
  });
  ok(feuille && /Développé couché/.test(feuille), "la feuille rappelle le nom de l'exercice");
  ok(feuille && /Fermer/.test(feuille), "elle a un bouton Fermer");

  await p.screenshot({ path: `${CAPTURES}video-lecteur.png` });

  await p.locator("text=Fermer").last().click();
  await p.waitForTimeout(500);
  ok(await p.locator("iframe").count() === 0, "fermer retire le lecteur, la vidéo cesse de tourner");

  await ctx.close();
}

// ── 3. Sans la migration, l'app doit fonctionner exactement comme avant ─────
console.log("\n─── Avant que la migration SQL soit jouée ───");
{
  const injection = `
const PROFIL = { id: "c1", name: "Marie Dupont", access_code: "MDUPONT27", coach_id: "coach-1",
                 offer: "premium", created_at: "2026-01-06T09:00:00Z", role: "coachee" };
const PROGRAMME = { id: "p1", coachee_id: "c1", is_active: true,
  week_structure: [{ day: "LUNDI", sessionId: 1 }],
  sessions_structure: [{ id: 1, name: "PUSH A", exercises: [
    { ordre: 1, library_exercise_id: "ex-avec-video", exercice: "Développé couché", muscle: "Pectoraux",
      series: 3, reps: ["8","8","8"], repos: "2'00", commentaire: "", technique: null }], abdosCardio: [] }] };
function requete(table) {
  const q = { _f: {},
    select(){ return q; }, order(){ return q; }, in(){ return q; }, gte(){ return q; }, limit(){ return q; },
    update(){ return q; }, insert: async()=>({data:null,error:null}), upsert: async()=>({data:null,error:null}),
    delete(){ return { eq: async()=>({error:null}) }; },
    eq(c,v){ q._f[c]=v; return q; },
    single: async()=>({ data: table==="profiles" ? PROFIL : table==="programs" ? PROGRAMME : null, error:null }),
    maybeSingle: async()=>({ data: table==="programs" ? PROGRAMME : null, error:null }),
    // La RLS sans policy renvoie zéro ligne, sans erreur : c'est exactement
    // l'état de la base tant que la migration n'a pas été jouée.
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
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", e => erreurs.push(e.message));
  await p.addInitScript(injection);
  await p.route("**/cdn.jsdelivr.net/**", r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" }));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2400);
  await p.locator("text=SÉANCES").last().click();
  await p.waitForTimeout(700);
  await p.locator("text=Développé couché").last().click();
  await p.waitForTimeout(500);

  ok(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`);
  ok(await p.locator("text=Développé couché").count() > 0, "la séance s'affiche normalement");
  ok(await p.locator("text=Voir la démonstration").count() === 0, "il n'y a simplement pas de bouton vidéo");
  ok(await p.locator("text=Voir l'historique de cet exercice").count() > 0,
     "le reste de l'exercice est intact");
  await ctx.close();
}

await b.close();
console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
