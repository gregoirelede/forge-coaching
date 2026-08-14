import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURATION SUPABASE
//  Pour activer l'authentification multi-coachés + persistance cloud :
//  1. Crée un projet sur supabase.com
//  2. Exécute le script supabase-setup.sql dans le SQL Editor du projet
//  3. Récupère ton URL et ta clé "anon" dans Project Settings > API
//  4. Remplace les deux valeurs ci-dessous
//  → Tant que les valeurs commencent par "YOUR_", l'app tourne en MODE DÉMO
//    avec les données par défaut (le programme de Greg ci-dessous)
// ═══════════════════════════════════════════════════════════════════════════════
const SUPABASE_CONFIG = {
  url:     "https://xlquzhwmdyyiugtezasg.supabase.co/rest/v1/",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhscXV6aHdtZHl5aXVndGV6YXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDc2MzEsImV4cCI6MjA5NDc4MzYzMX0.hWuXKIJDHr0RJoPupsMU6KOsZ4AEj-tdP7eOiHOj_jE",
};
const isSupabaseConfigured =
  !SUPABASE_CONFIG.url.startsWith("YOUR_") &&
  !SUPABASE_CONFIG.anonKey.startsWith("YOUR_");

// ═══════════════════════════════════════════════════════════════════════════════
//  DONNÉES PAR DÉFAUT (utilisées en mode démo si Supabase n'est pas configuré)
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_CLIENT = { name: "Greg", id: "greg", startDate: "Janvier 2025", goal: "Prise de masse" };

const DEFAULT_WEEK = [
  { day: "LUNDI",    sessionId: 1 },
  { day: "MARDI",    sessionId: 2 },
  { day: "MERCREDI", sessionId: null },
  { day: "JEUDI",    sessionId: 3 },
  { day: "VENDREDI", sessionId: 4 },
  { day: "SAMEDI",   sessionId: null },
  { day: "DIMANCHE", sessionId: 5 },
];

const DEFAULT_SESSIONS = [
  { id: 1, name: "PUSH A", exercises: [
    { ordre: 1, muscle: "Triceps",       exercice: "Extension triceps overhead (Uni)", series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'",  commentaire: "CUFF" },
    { ordre: 2, muscle: "Pectoraux",     exercice: "Chest press couché",               series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'",  commentaire: "" },
    { ordre: 3, muscle: "Pectoraux",     exercice: "Écarté Pec deck",                  series: 2, reps: ["6-9","9-12"],                repos: "2'30 / 3'",  commentaire: "" },
    { ordre: 4, muscle: "Triceps",       exercice: "Extension triceps corde",          series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'",  commentaire: "" },
    { ordre: 5, muscle: "Triceps",       exercice: "JM Press",                         series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'",  commentaire: "" },
    { ordre: 6, muscle: "Pectoraux",     exercice: "Dips PDC",                         series: 3, reps: ["12-15","12-15","12-15"],     repos: "2'30 / 3'",  commentaire: "SE LESTER ?" },
    { ordre: 7, muscle: "Deltoïde post", exercice: "Oiseau unilatéral poulie haute",   series: 4, reps: ["6-9","9-12","9-12","12-15"], repos: "2' / 2'30",  commentaire: "CUFF" },
  ], abdosCardio: ["3x1 min GAINAGE","3x échec relevé de jambes","2x échec crunch à la poulie"] },
  { id: 2, name: "UPPER X LOWER (1)", exercises: [
    { ordre: 1, muscle: "Deltoïde lat",  exercice: "Élévation Y (Uni)",                        series: 4, reps: ["6-9","9-12","9-12","12-15"], repos: "2'30 / 3'", commentaire: "CUFF" },
    { ordre: 2, muscle: "Deltoïde lat",  exercice: "Élévation latérale haltères (Debout)",     series: 4, reps: ["6-9","9-12","9-12","12-15"], repos: "2'30 / 3'", commentaire: "" },
    { ordre: 3, muscle: "Quadriceps",    exercice: "Hack squat",                               series: 3, reps: ["6-9","9-12","9-12"],         repos: "3' / 4'",   commentaire: "SANGLE DE YOGA" },
    { ordre: 4, muscle: "Quadriceps",    exercice: "Leg extension",                            series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "SANGLE DE YOGA + TIRAGE" },
    { ordre: 5, muscle: "Ischios",       exercice: "Leg curl couché",                          series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "" },
    { ordre: 6, muscle: "Ischios",       exercice: "Leg curl assis",                           series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "SANGLE DE YOGA" },
    { ordre: 7, muscle: "Mollets",       exercice: "Mollet press horizontal",                  series: 3, reps: ["6-9","9-12","9-12"],         repos: "1'30 / 2'", commentaire: "" },
  ], abdosCardio: [] },
  { id: 3, name: "PULL", exercises: [
    { ordre: 1, muscle: "Grand dorsal",  exercice: "Tirage horizontal sur banc (Uni)", series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "SANGLE DE TIRAGE" },
    { ordre: 2, muscle: "Grand dorsal",  exercice: "Tirage vertical au sol (Uni)",     series: 4, reps: ["6-9","9-12","9-12","12-15"], repos: "2'30 / 3'", commentaire: "SANGLE DE TIRAGE" },
    { ordre: 3, muscle: "Haut du dos",   exercice: "Tirage vertical (Haut du dos)",    series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "SANGLE DE TIRAGE" },
    { ordre: 4, muscle: "Grand dorsal",  exercice: "Pull over unilat (Lats)",          series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "CUFF" },
    { ordre: 5, muscle: "Triceps",       exercice: "Extension triceps overhead (Uni)", series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "CUFF" },
    { ordre: 6, muscle: "Triceps",       exercice: "Extension triceps corde",          series: 2, reps: ["6-9","9-12"],                repos: "2'30 / 3'", commentaire: "" },
    { ordre: 7, muscle: "Deltoïde post", exercice: "Oiseau unilatéral poulie haute",   series: 4, reps: ["6-9","9-12","12-15","12-15"],repos: "2' / 2'30", commentaire: "CUFF" },
  ], abdosCardio: ["3x1 min GAINAGE","3x échec relevé de jambes","2x échec crunch à la poulie"] },
  { id: 4, name: "PUSH B", exercises: [
    { ordre: 1, muscle: "Deltoïde lat",   exercice: "Élévation Y (Uni)",           series: 4, reps: ["6-9","9-12","9-12","12-15"], repos: "2'30 / 3'", commentaire: "CUFF" },
    { ordre: 2, muscle: "Biceps",         exercice: "Curl Larry Scott",            series: 4, reps: ["6-9","9-12","9-12","12-15"], repos: "2'30 / 3'", commentaire: "" },
    { ordre: 3, muscle: "Biceps",         exercice: "Curl incliné haltères",       series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "" },
    { ordre: 4, muscle: "Pectoraux",      exercice: "Chest press couché",          series: 2, reps: ["6-9","9-12"],                repos: "2'30 / 3'", commentaire: "" },
    { ordre: 5, muscle: "Pectoraux",      exercice: "Écarté Pec deck",             series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "" },
    { ordre: 6, muscle: "Biceps",         exercice: "Curl marteau supported",      series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "" },
    { ordre: 7, muscle: "Fessier/Ischios",exercice: "Hip extensions sur banc",     series: 3, reps: ["6-9","9-12","9-12"],         repos: "3' / 4'",   commentaire: "" },
  ], abdosCardio: [] },
  { id: 5, name: "UPPER X LOWER (2)", exercises: [
    { ordre: 1, muscle: "Quadriceps",   exercice: "Leg extension",                   series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "SANGLE DE YOGA + TIRAGE" },
    { ordre: 2, muscle: "Quadriceps",   exercice: "Hack squat",                      series: 2, reps: ["6-9","9-12"],                repos: "2'30 / 3'", commentaire: "SANGLE DE YOGA" },
    { ordre: 3, muscle: "Adducteurs",   exercice: "Adducteur à la machine",          series: 3, reps: ["6-9","9-12","9-12"],         repos: "2' / 2'30", commentaire: "" },
    { ordre: 4, muscle: "Haut du dos",  exercice: "Tirage horizontal (Haut du dos)", series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "SANGLE DE TIRAGE" },
    { ordre: 5, muscle: "Grand dorsal", exercice: "Tirage vertical unilat (Lats)",   series: 2, reps: ["6-9","9-12"],                repos: "2'30 / 3'", commentaire: "SANGLE DE TIRAGE" },
    { ordre: 6, muscle: "Haut du dos",  exercice: "Tirage vertical (Haut du dos)",   series: 3, reps: ["6-9","9-12","9-12"],         repos: "2'30 / 3'", commentaire: "SANGLE DE TIRAGE" },
    { ordre: 7, muscle: "Biceps",       exercice: "Curl Larry Scott",                series: 4, reps: ["6-9","9-12","9-12","12-15"], repos: "2'30 / 3'", commentaire: "" },
  ], abdosCardio: ["3x1 min GAINAGE","3x échec relevé de jambes","2x échec crunch à la poulie"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  THEME Forest & Sand
// ═══════════════════════════════════════════════════════════════════════════════
// Palette — chaque valeur pointe vers une variable CSS définie dans src/theme.css.
// Le thème clair/sombre bascule en posant data-theme sur <html> : aucun composant
// n'a besoin d'être informé, les centaines de références T.xxx suivent d'elles-mêmes.
const T = {
  bg: "var(--bg)", surface: "var(--surface)", surface2: "var(--surface2)",
  border: "var(--border)", borderStrong: "var(--border-strong)",
  text: "var(--text)", textSub: "var(--text-sub)", textMuted: "var(--text-muted)",
  accent: "var(--accent)", accentDark: "var(--accent-dark)",
  accentLight: "var(--accent-light)", accentText: "var(--accent-text)",
  danger: "var(--danger)", inputBg: "var(--input-bg)",
  shadow: "var(--shadow)",
  // Variantes translucides de l'accent (remplacent les concaténations hexadécimales,
  // impossibles sur une var() : "var(--accent)55" ne veut rien dire en CSS)
  accentA10: "var(--accent-a10)", accentA20: "var(--accent-a20)",
  accentA33: "var(--accent-a33)", accentA38: "var(--accent-a38)",
  accentLightA53: "var(--accent-light-a53)",
  setDoneBg: "var(--set-done-bg)",
  warnBg: "var(--warn-bg)", warnText: "var(--warn-text)", warnBorder: "var(--warn-border)",
  cmpUp:   { bg: "var(--cmp-up-bg)",   border: "var(--cmp-up-border)",   text: "var(--cmp-up-text)" },
  cmpDown: { bg: "var(--cmp-down-bg)", border: "var(--cmp-down-border)", text: "var(--cmp-down-text)" },
};

const muscleColors = {
  "Triceps":        { bg:"var(--m-triceps-bg)",    text:"var(--m-triceps-tx)" },
  "Pectoraux":      { bg:"var(--m-pectoraux-bg)",  text:"var(--m-pectoraux-tx)" },
  "Deltoïde post":  { bg:"var(--m-deltpost-bg)",   text:"var(--m-deltpost-tx)" },
  "Deltoïde lat":   { bg:"var(--m-deltlat-bg)",    text:"var(--m-deltlat-tx)" },
  "Quadriceps":     { bg:"var(--m-quadriceps-bg)", text:"var(--m-quadriceps-tx)" },
  "Ischios":        { bg:"var(--m-ischios-bg)",    text:"var(--m-ischios-tx)" },
  "Mollets":        { bg:"var(--m-mollets-bg)",    text:"var(--m-mollets-tx)" },
  "Grand dorsal":   { bg:"var(--m-dorsal-bg)",     text:"var(--m-dorsal-tx)" },
  "Haut du dos":    { bg:"var(--m-hautdos-bg)",    text:"var(--m-hautdos-tx)" },
  "Biceps":         { bg:"var(--m-biceps-bg)",     text:"var(--m-biceps-tx)" },
  "Fessier/Ischios":{ bg:"var(--m-fessier-bg)",    text:"var(--m-fessier-tx)" },
  "Adducteurs":     { bg:"var(--m-adducteurs-bg)", text:"var(--m-adducteurs-tx)" },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SUPABASE — chargement dynamique du client (compatible CDN + npm)
// ═══════════════════════════════════════════════════════════════════════════════
let _supabase = null, _supabasePromise = null;
async function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (_supabase) return _supabase;
  if (_supabasePromise) return _supabasePromise;
  _supabasePromise = (async () => {
    const mod = await import(/* @vite-ignore */ "https://esm.sh/@supabase/supabase-js@2");
    _supabase = mod.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return _supabase;
  })();
  return _supabasePromise;
}

// Code d'accès → credentials Supabase (déterministe)
function codeToCredentials(rawCode) {
  const code = rawCode.trim().toUpperCase().replace(/\s+/g, "");
  const cleanForEmail = code.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return {
    normalizedCode: code,
    email: `${cleanForEmail}@coachee.forge.app`,
    password: `Forge_${code}_2025!`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function parseRepos(str) {
  const p = str.split("/")[0].trim();
  const m = p.match(/(\d+)'(\d+)?/);
  if (!m) return 150;
  return (parseInt(m[1]) || 0) * 60 + (parseInt(m[2]) || 0);
}
function fmt(s) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`; }
const tKey = (weekNum, sid, ei, si) => `${weekNum}-${sid}-${ei}-${si}`;

// Durée estimée d'une séance, calculée depuis son contenu réel :
// ~45 s d'effort par série + le repos prescrit entre les séries + 2 min
// d'installation par exercice. Arrondie aux 5 minutes.
function estimateSessionMinutes(session) {
  if (!session || !Array.isArray(session.exercises) || session.exercises.length === 0) return 60;
  let seconds = 0;
  session.exercises.forEach(ex => {
    const sets = ex.series || (Array.isArray(ex.reps) ? ex.reps.length : 0) || 0;
    const rest = parseRepos(ex.repos || "");
    seconds += sets * 45 + Math.max(0, sets - 1) * rest + 120;
  });
  return Math.max(15, Math.round(seconds / 60 / 5) * 5);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VIDÉOS DE DÉMONSTRATION
//
//  Le coach colle le lien qu'il a sous la main — YouTube, Vimeo, ou un fichier
//  vidéo. On en déduit comment l'afficher, sans jamais rien lui demander de plus.
//
//  Aucune vidéo n'est hébergée par Forge Coaching : le plan gratuit de Supabase
//  offre 1 Go de stockage, une seule démonstration filmée le remplirait vite. Un
//  lien vers une plateforme qui fait déjà ce métier coûte zéro et ne casse pas.
// ═══════════════════════════════════════════════════════════════════════════════
function analyseVideo(url) {
  const u = (url || "").trim();
  if (!u) return null;

  // On refuse tout ce qui n'est pas http(s) : un javascript: dans un iframe
  // s'exécuterait dans la page. Le coach est de confiance, pas le presse-papier.
  let parsee;
  try { parsee = new URL(u); } catch { return null; }
  if (parsee.protocol !== "https:" && parsee.protocol !== "http:") return null;

  const hote = parsee.hostname.replace(/^www\./, "");

  // YouTube — trois formes de lien pour la même vidéo
  if (hote === "youtube.com" || hote === "m.youtube.com") {
    const id = parsee.searchParams.get("v")
      || (parsee.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/) || [])[1];
    if (id) return { type: "embed", src: `https://www.youtube-nocookie.com/embed/${id}`, source: "YouTube" };
  }
  if (hote === "youtu.be") {
    const id = parsee.pathname.slice(1).split("/")[0];
    if (id) return { type: "embed", src: `https://www.youtube-nocookie.com/embed/${id}`, source: "YouTube" };
  }

  // Vimeo
  if (hote === "vimeo.com" || hote === "player.vimeo.com") {
    const id = (parsee.pathname.match(/(\d{6,})/) || [])[1];
    if (id) return { type: "embed", src: `https://player.vimeo.com/video/${id}`, source: "Vimeo" };
  }

  // Fichier vidéo servi directement
  if (/\.(mp4|webm|mov|m4v)$/i.test(parsee.pathname)) {
    return { type: "fichier", src: u, source: "Vidéo" };
  }

  // Lien valide mais non reconnu : on ne tente pas de l'encastrer — un site
  // qui refuse l'iframe afficherait un cadre vide sans expliquer pourquoi.
  // On propose de l'ouvrir dans le navigateur, ce qui marche toujours.
  return { type: "lien", src: u, source: hote };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BILAN HEBDOMADAIRE — la boucle de coaching
//
//  Jusqu'ici l'information ne circulait que dans un sens : le coach envoie un
//  programme, le coaché le suit. Le bilan referme la boucle — le coaché fait le
//  point une fois par semaine, le coach répond.
//
//  Quatre curseurs et un mot libre. Pas davantage : un questionnaire long ne se
//  remplit qu'une fois. Tout est facultatif, y compris les curseurs — un bilan à
//  moitié rempli vaut mieux qu'un bilan jamais envoyé.
// ═══════════════════════════════════════════════════════════════════════════════
const BILAN_CRITERES = [
  { cle: "energie",      label: "Énergie",      bas: "À plat",      haut: "En forme" },
  { cle: "sommeil",      label: "Sommeil",      bas: "Mauvais",     haut: "Très bon" },
  { cle: "motivation",   label: "Motivation",   bas: "En baisse",   haut: "À fond" },
  { cle: "recuperation", label: "Récupération", bas: "Courbaturé",  haut: "Frais" },
];
const BILAN_NOTE_MAX = 500;

// La fonctionnalité s'appuie sur une table ajoutée en v7l. Tant que la
// migration sql/2026-08-08-bilan-hebdomadaire.sql n'est pas jouée, PostgREST
// répond « relation does not exist » (code 42P01). Ce n'est pas une panne :
// c'est une fonctionnalité pas encore activée, et l'app doit s'effacer sans
// bruit plutôt qu'afficher une erreur au coaché.
function tableAbsente(error) {
  if (!error) return false;
  return error.code === "42P01" || /does not exist|schema cache/i.test(error.message || "");
}

// Calcule la semaine de coaching en cours à partir de la date de création du compte.
// Semaine 1 = la semaine de la création. Figée : ne dépend que du temps écoulé.
function currentWeekFromDate(createdAtISO) {
  if (!createdAtISO) return 1;
  const start = new Date(createdAtISO);
  if (isNaN(start.getTime())) return 1;
  const now = new Date();
  const days = Math.floor((now - start) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  THÈME CLAIR / SOMBRE
//  Le choix vit en localStorage, par appareil — comme les chronos et la sonnerie.
//  "auto" suit le réglage du téléphone ; "clair" et "sombre" le forcent.
//  Tout passe par data-theme sur <html> : aucun composant n'a besoin d'être
//  informé, les variables CSS de theme.css font le reste.
// ═══════════════════════════════════════════════════════════════════════════════
const THEME_KEY = "forge_theme";
const THEME_MODES = ["auto", "clair", "sombre"];

function loadTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEME_MODES.includes(v) ? v : "auto";
  } catch { return "auto"; }
}

function applyTheme(mode) {
  try {
    const html = document.documentElement;
    if (mode === "auto") html.removeAttribute("data-theme");
    else html.setAttribute("data-theme", mode);
    // La barre d'état du téléphone doit suivre le fond réel de l'app.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const fond = getComputedStyle(html).getPropertyValue("--bg").trim();
      if (fond) meta.setAttribute("content", fond);
    }
  } catch {}
}

function useTheme() {
  const [theme, setThemeState] = useState(loadTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  // En mode automatique, on suit les changements du téléphone en direct
  // (bascule programmée au coucher du soleil, par exemple).
  useEffect(() => {
    if (theme !== "auto" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const surChangement = () => applyTheme("auto");
    mq.addEventListener ? mq.addEventListener("change", surChangement)
                        : mq.addListener(surChangement);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", surChangement)
                             : mq.removeListener(surChangement);
    };
  }, [theme]);

  const setTheme = useCallback((mode) => {
    if (!THEME_MODES.includes(mode)) return;
    try { localStorage.setItem(THEME_KEY, mode); } catch {}
    setThemeState(mode);
  }, []);

  return { theme, setTheme };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS PUSH
//
//  L'abonnement se fait sur DEMANDE EXPLICITE, depuis les réglages. On ne
//  demande jamais l'autorisation au premier lancement : c'est le meilleur moyen
//  de se faire refuser définitivement par la majorité des gens.
//
//  Sur iPhone, les notifications n'existent QUE si l'app a été installée sur
//  l'écran d'accueil. C'est une règle d'Apple, pas une limite de l'app — d'où le
//  message d'explication plutôt qu'un bouton qui échouerait sans dire pourquoi.
// ═══════════════════════════════════════════════════════════════════════════════
const estIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent || "");
const estInstallee = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches
        || window.navigator.standalone === true;
  } catch { return false; }
};
const pushDisponible = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// La clé publique VAPID voyage en base64url ; l'API du navigateur veut des octets.
function cleVersOctets(base64url) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Quand une Edge Function répond autre chose que 200, supabase-js remonte un
// message générique (« Edge Function returned a non-2xx status code ») et range
// la vraie réponse dans error.context. Sans ça, « Aucun appareil abonné »
// n'arriverait jamais jusqu'à l'écran.
async function messageErreurFonction(error, repli) {
  try {
    const corps = await error?.context?.json();
    if (corps?.error) return corps.error;
  } catch { /* réponse illisible : on garde le repli */ }
  return repli;
}

function usePushNotifications(supabase, userId, isDemo) {
  const [etat, setEtat] = useState("inconnu"); // inconnu | indisponible | ios-non-installee | refuse | inactif | actif
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState("");

  // État de départ : autorisation du navigateur + abonnement déjà en place ?
  useEffect(() => {
    let annule = false;
    (async () => {
      if (isDemo || !supabase) { setEtat("indisponible"); return; }
      if (!pushDisponible()) {
        setEtat(estIOS() && !estInstallee() ? "ios-non-installee" : "indisponible");
        return;
      }
      if (Notification.permission === "denied") { setEtat("refuse"); return; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const abo = await reg.pushManager.getSubscription();
        if (!annule) setEtat(abo ? "actif" : "inactif");
      } catch { if (!annule) setEtat("inactif"); }
    })();
    return () => { annule = true; };
  }, [supabase, isDemo]);

  const activer = useCallback(async () => {
    setOccupe(true); setMessage("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setEtat(perm === "denied" ? "refuse" : "inactif");
        setMessage("Autorisation refusée. Tu peux la rétablir dans les réglages de ton téléphone.");
        return;
      }
      // Clé publique du serveur (créée au premier appel, côté Supabase)
      const { data: conf, error: errConf } = await supabase.functions.invoke("push-config", { body: {} });
      if (errConf || !conf?.publicKey) throw new Error("Clé de notification indisponible");

      const reg = await navigator.serviceWorker.ready;
      let abo = await reg.pushManager.getSubscription();
      if (!abo) {
        abo = await reg.pushManager.subscribe({
          userVisibleOnly: true,                         // exigé par les navigateurs
          applicationServerKey: cleVersOctets(conf.publicKey),
        });
      }
      const brut = abo.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({
        coachee_id: userId,
        endpoint: brut.endpoint,
        p256dh: brut.keys.p256dh,
        auth: brut.keys.auth,
        user_agent: (navigator.userAgent || "").slice(0, 300),
      }, { onConflict: "endpoint" });
      if (error) throw error;

      setEtat("actif");
      setMessage("Notifications activées sur cet appareil.");
    } catch (e) {
      setMessage(e?.message || "Activation impossible");
    } finally { setOccupe(false); }
  }, [supabase, userId]);

  const desactiver = useCallback(async () => {
    setOccupe(true); setMessage("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const abo = await reg.pushManager.getSubscription();
      if (abo) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", abo.endpoint);
        await abo.unsubscribe();
      }
      setEtat("inactif");
      setMessage("Notifications désactivées sur cet appareil.");
    } catch (e) {
      setMessage(e?.message || "Désactivation impossible");
    } finally { setOccupe(false); }
  }, [supabase]);

  const tester = useCallback(async () => {
    setOccupe(true); setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("send-push", { body: { test: true } });
      if (error) throw new Error(await messageErreurFonction(error, "Envoi impossible"));
      setMessage(data?.envoyees > 0
        ? `Test envoyé sur ${data.envoyees} appareil${data.envoyees > 1 ? "s" : ""}.`
        : "Aucun appareil n'a reçu le test.");
    } catch (e) {
      setMessage(e?.message || "Envoi impossible");
    } finally { setOccupe(false); }
  }, [supabase]);

  return { etat, occupe, message, activer, desactiver, tester };
}

// Réglages coaché stockés localement (par appareil)
const settingsKey = (userId) => `forge_settings_${userId}`;
function loadSettings(userId) {
  try {
    const s = JSON.parse(localStorage.getItem(settingsKey(userId)) || "null");
    return { restTimers: true, restSound: true, ...(s || {}) };
  } catch { return { restTimers: true, restSound: true }; }
}
function saveSettings(userId, s) {
  try { localStorage.setItem(settingsKey(userId), JSON.stringify(s)); } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CACHE LOCAL + FILE D'ATTENTE OFFLINE
// ═══════════════════════════════════════════════════════════════════════════════
const storageKey = (userId) => `forge_coaching_${userId}_v2`;
const pendingKey = (userId) => `forge_pending_${userId}_v2`;
function loadCache(userId)        { try { return JSON.parse(localStorage.getItem(storageKey(userId)) || "null"); } catch { return null; } }
function saveCache(userId, data)  { try { localStorage.setItem(storageKey(userId), JSON.stringify(data)); return true; } catch { return false; } }
function loadPending(userId)      { try { return JSON.parse(localStorage.getItem(pendingKey(userId)) || "[]"); } catch { return []; } }
function savePending(userId, lst) { try { localStorage.setItem(pendingKey(userId), JSON.stringify(lst)); } catch {} }
function queueForSync(userId, payload) {
  const lst = loadPending(userId);
  // dédup : si même clé série, on remplace
  const k = tKey(payload.weekNumber, payload.sessionId, payload.exerciseIndex, payload.setIndex);
  const filtered = lst.filter(p => tKey(p.weekNumber, p.sessionId, p.exerciseIndex, p.setIndex) !== k);
  filtered.push(payload);
  savePending(userId, filtered);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SYNC SUPABASE
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureWeekId(supabase, userId, programId, weekNumber, cache) {
  if (cache.has(weekNumber)) return cache.get(weekNumber);
  const { data: existing } = await supabase
    .from("weeks").select("id")
    .eq("coachee_id", userId).eq("week_number", weekNumber)
    .maybeSingle();
  if (existing) { cache.set(weekNumber, existing.id); return existing.id; }
  const { data: created, error } = await supabase
    .from("weeks").insert({ coachee_id: userId, program_id: programId, week_number: weekNumber })
    .select("id").single();
  if (error) throw error;
  cache.set(weekNumber, created.id);
  return created.id;
}

async function pushSetToSupabase({ supabase, userId, programId, weekIdCache, payload }) {
  const { weekNumber, sessionId, exerciseIndex, setIndex, exerciseName, weight, actualReps, completed } = payload;
  const weekId = await ensureWeekId(supabase, userId, programId, weekNumber, weekIdCache);
  const { error } = await supabase.from("sets_logged").upsert({
    coachee_id: userId,
    week_id: weekId,
    session_config_id: sessionId,
    exercise_index: exerciseIndex,
    exercise_name: exerciseName,
    set_index: setIndex,
    weight: (weight === "" || weight === null || weight === undefined) ? null : parseFloat(weight),
    actual_reps: (actualReps === "" || actualReps === null || actualReps === undefined) ? null : parseInt(actualReps),
    completed: !!completed,
    logged_at: new Date().toISOString(),
  }, { onConflict: "coachee_id,week_id,session_config_id,exercise_index,set_index" });
  if (error) throw error;
}

async function loadAllSetsFromSupabase(supabase, userId) {
  const { data, error } = await supabase
    .from("sets_logged").select("*, week:week_id(week_number)")
    .eq("coachee_id", userId);
  if (error) throw error;
  const allCompletedSets = {}, allSetLogs = {};
  let maxWeek = 1;
  (data || []).forEach(row => {
    const weekNumber = row.week?.week_number;
    if (!weekNumber) return;
    if (weekNumber > maxWeek) maxWeek = weekNumber;
    const key = tKey(weekNumber, row.session_config_id, row.exercise_index, row.set_index);
    if (row.completed) allCompletedSets[key] = true;
    allSetLogs[key] = {
      weight: row.weight ?? "",
      actualReps: row.actual_reps ?? "",
      exerciseName: row.exercise_name,
      loggedAt: row.logged_at,
    };
  });
  return { allCompletedSets, allSetLogs, maxWeek };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPARAISON inter-semaines
// ═══════════════════════════════════════════════════════════════════════════════
function compareWithPrevious(weekNum, sid, ei, si, field, currentValue, allCompleted, allLogs, currentExerciseName) {
  if (weekNum <= 1) return null;
  const prevWeek = weekNum - 1;
  const prevWeekHasData = Object.keys(allCompleted).some(k => parseInt(k.split("-")[0]) === prevWeek && allCompleted[k]);
  if (!prevWeekHasData) return null;
  const prevK = tKey(prevWeek, sid, ei, si);
  if (!allCompleted[prevK]) return null;
  const prevLog = allLogs[prevK];
  if (!prevLog) return null;
  if (prevLog.exerciseName && currentExerciseName && prevLog.exerciseName !== currentExerciseName) return null;
  const prevRaw = field === "weight" ? prevLog.weight : prevLog.actualReps;
  if (prevRaw === undefined || prevRaw === null || prevRaw === "") return null;
  if (currentValue === undefined || currentValue === null || currentValue === "") return null;
  const cur = parseFloat(currentValue), prev = parseFloat(prevRaw);
  if (isNaN(cur) || isNaN(prev)) return null;
  if (cur > prev) return "up";
  if (cur < prev) return "down";
  return "equal";
}

// Timer hook
// Joue une sonnerie de fin de repos (Web Audio — aucun fichier requis)
function playRestChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    // Trois bips ascendants façon sonnerie
    const notes = [660, 880, 1046];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.18);
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, 900);
  } catch {}
}

function useTimers(soundEnabledRef) {
  const [timers, setTimers] = useState({});
  useEffect(() => {
    const id = setInterval(() => {
      setTimers(prev => {
        let changed = false; const next = {};
        for (const k in prev) {
          const t = prev[k];
          if (t.running && t.remaining > 0)        { next[k] = { ...t, remaining: t.remaining - 1 }; changed = true; }
          else if (t.running && t.remaining === 0) {
            next[k] = { ...t, running: false, done: true }; changed = true;
            // Sonnerie de fin si activée dans les réglages
            if (!soundEnabledRef || soundEnabledRef.current) playRestChime();
          }
          else next[k] = t;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [soundEnabledRef]);
  const start  = useCallback((k, s) => setTimers(p => ({ ...p, [k]: { total: s, remaining: s, running: true, done: false } })), []);
  const cancel = useCallback((k)    => setTimers(p => { const n = { ...p }; delete n[k]; return n; }), []);
  return { timers, start, cancel };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGO Vivid Fitness
// ═══════════════════════════════════════════════════════════════════════════════
function ForgeLogo({ size = 40 }) {
  const uid = `vf_${size}_${Math.random().toString(36).slice(2,7)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id={`grad_${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#064E3B"/>
          <stop offset="35%" stopColor="#065F46"/>
          <stop offset="65%" stopColor="#0D9488"/>
          <stop offset="100%" stopColor="#2DD4BF"/>
        </linearGradient>
        <filter id={`shadow_${uid}`}>
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#064E3B" floodOpacity="0.35"/>
        </filter>
        <clipPath id={`clip_${uid}`}>
          <path d="M32 3 L58 12 L58 37 C58 51 32 62 32 62 C32 62 6 51 6 37 L6 12 Z"/>
        </clipPath>
      </defs>
      <path d="M32 3 L58 12 L58 37 C58 51 32 62 32 62 C32 62 6 51 6 37 L6 12 Z" fill={`url(#grad_${uid})`} filter={`url(#shadow_${uid})`}/>
      <path d="M32 3 L58 12 L58 22 L6 22 L6 12 Z" fill="white" opacity="0.07" clipPath={`url(#clip_${uid})`}/>
      <path d="M32 13 C31 13 21 27 21 35.5 C21 42.5 26 48 32 48 C38 48 43 42.5 43 35.5 C43 27 33 13 32 13Z" fill="white"/>
      <path d="M32 21 C31.5 21 25.5 30 25.5 35.5 C25.5 39.2 28.4 42 32 42 C35.6 42 38.5 39.2 38.5 35.5 C38.5 30 32.5 21 32 21Z" fill={`url(#grad_${uid})`} opacity="0.82" clipPath={`url(#clip_${uid})`}/>
      <circle cx="32" cy="35" r="3" fill="white" opacity="0.22"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════════════════════════════
function Icon({ name, size = 24, color = "currentColor", filled = false, stroke = 2 }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: filled ? color : "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home": return (<svg {...c}>{filled ? <path d="M3 10.5 L12 3 L21 10.5 V21 H14 V14 H10 V21 H3 Z" fill={color} stroke="none"/> : <><path d="M3 10.5 L12 3 L21 10.5 V21 H3 Z"/><path d="M9 21 V12 H15 V21" fill="none"/></>}</svg>);
    case "workout": return (<svg {...c}>{filled ? (<g fill={color} stroke="none"><rect x="2" y="9" width="3" height="6" rx="1"/><rect x="5" y="7" width="2" height="10" rx="0.8"/><rect x="7" y="11" width="10" height="2" rx="0.5"/><rect x="17" y="7" width="2" height="10" rx="0.8"/><rect x="19" y="9" width="3" height="6" rx="1"/></g>) : (<><line x1="6.5" y1="6.5" x2="6.5" y2="17.5"/><line x1="17.5" y1="6.5" x2="17.5" y2="17.5"/><line x1="3" y1="9" x2="3" y2="15"/><line x1="21" y1="9" x2="21" y2="15"/><line x1="7" y1="12" x2="17" y2="12"/></>)}</svg>);
    case "progress": return (<svg {...c}>{filled ? (<g fill={color} stroke="none"><rect x="3" y="13" width="4" height="8" rx="1"/><rect x="10" y="9" width="4" height="12" rx="1"/><rect x="17" y="5" width="4" height="16" rx="1"/></g>) : (<><rect x="3" y="13" width="4" height="8" rx="0.5"/><rect x="10" y="9" width="4" height="12" rx="0.5"/><rect x="17" y="5" width="4" height="16" rx="0.5"/></>)}</svg>);
    case "profile": return (<svg {...c}>{filled ? (<g fill={color} stroke="none"><circle cx="12" cy="8" r="4"/><path d="M4 21 C4 16 7.5 13 12 13 C16.5 13 20 16 20 21 Z"/></g>) : (<><circle cx="12" cy="8" r="4"/><path d="M4 21 C4 16 7.5 13 12 13 C16.5 13 20 16 20 21"/></>)}</svg>);
    case "play": return <svg {...c}><polygon points="6,4 20,12 6,20" fill={color} stroke="none"/></svg>;
    case "chevronRight": return <svg {...c}><polyline points="9,6 15,12 9,18"/></svg>;
    case "chevronLeft":  return <svg {...c}><polyline points="15,6 9,12 15,18"/></svg>;
    case "chevronDown":  return <svg {...c}><polyline points="6,9 12,15 18,9"/></svg>;
    case "calendar": return <svg {...c}><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>;
    case "check": return <svg {...c}><polyline points="4,12 10,18 20,6"/></svg>;
    case "alert": return <svg {...c}><path d="M10.3 3.86 L1.82 18 A2 2 0 0 0 3.54 21 H20.46 A2 2 0 0 0 22.18 18 L13.71 3.86 A2 2 0 0 0 10.3 3.86 Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "info":  return <svg {...c}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
    case "trending": return <svg {...c}><polyline points="3,17 9,11 13,15 21,7"/><polyline points="14,7 21,7 21,14"/></svg>;
    case "trophy": return <svg {...c}><path d="M6 9 H4 A2 2 0 0 1 2 7 V5 H6"/><path d="M18 9 H20 A2 2 0 0 0 22 7 V5 H18"/><path d="M6 3 H18 V11 A4 4 0 0 1 14 15 H10 A4 4 0 0 1 6 11 Z"/><line x1="10" y1="15" x2="10" y2="18"/><line x1="14" y1="15" x2="14" y2="18"/><line x1="8" y1="21" x2="16" y2="21"/></svg>;
    case "clock": return <svg {...c}><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,15"/></svg>;
    case "logout": return <svg {...c}><path d="M9 21 H5 A2 2 0 0 1 3 19 V5 A2 2 0 0 1 5 3 H9"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    default: return null;
  }
}

// Spinner
function Spinner({ size = 16, color = T.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: "spin .8s linear infinite" }}>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="40 60"/>
    </svg>
  );
}

// SyncDot
function SyncDot({ status }) {
  const cfg = {
    synced:  { color: "var(--cmp-up-text)", label: "Synchronisé" },
    pending: { color: T.warnText, label: "Synchronisation..." },
    error:   { color: "var(--cmp-down-text)", label: "Hors-ligne" },
    demo:    { color: T.textMuted, label: "Mode démo (local)" },
  }[status] || { color: T.textMuted, label: "—" };
  return <div title={cfg.label} style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, boxShadow: `0 0 0 2px ${cfg.color}25`, flexShrink: 0, transition: "background .3s" }}/>;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  InlineTimer / FloatingBanner / SetLog
// ═══════════════════════════════════════════════════════════════════════════════
function InlineTimer({ t, onCancel }) {
  if (!t) return null;
  const R = 13, circ = 2 * Math.PI * R;
  const pct = Math.min(100, ((t.total - t.remaining) / t.total) * 100);
  const urgent = !t.done && t.remaining <= 10;
  if (t.done) return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: T.accentLight, border: `1px solid ${T.accent}50`, borderRadius: 30, padding: "4px 12px", animation: "popIn .2s ease" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent }}/>
      <span style={{ fontSize: 11, color: T.accent, fontWeight: 800, letterSpacing: .5 }}>C'EST PARTI</span>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, animation: "popIn .2s ease", flexShrink: 0 }}>
      <div style={{ position: "relative", width: 36, height: 36 }}>
        <svg width="36" height="36" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
          <circle cx="18" cy="18" r={R} fill="none" stroke={T.surface2} strokeWidth="2.5"/>
          <circle cx="18" cy="18" r={R} fill="none" stroke={urgent ? T.danger : T.accent} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .85s linear, stroke .3s" }}/>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: t.remaining >= 60 ? 8 : 10, fontWeight: 900, color: urgent ? T.danger : T.accent, animation: urgent ? "pulse .7s infinite" : "none" }}>{fmt(t.remaining)}</div>
      </div>
      <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: "50%", width: 20, height: 20, fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>
    </div>
  );
}

function FloatingBanner({ timers }) {
  const running = Object.entries(timers).filter(([, t]) => t.running && !t.done);
  if (!running.length) return null;
  const [, t] = running[running.length - 1];
  const R = 20, circ = 2 * Math.PI * R;
  const pct = Math.min(100, ((t.total - t.remaining) / t.total) * 100);
  const urgent = t.remaining <= 10;
  return (
    <div style={{ position: "fixed", bottom: 86, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", alignItems: "center", gap: 14, background: T.surface, border: `1.5px solid ${urgent ? T.danger : T.accent}`, borderRadius: 20, padding: "12px 20px", boxShadow: `0 4px 30px ${T.shadow}, 0 0 0 4px ${urgent ? T.danger : T.accent}18`, animation: "slideUp .3s ease", minWidth: 210 }}>
      <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
        <svg width="48" height="48" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
          <circle cx="24" cy="24" r={R} fill="none" stroke={T.surface2} strokeWidth="3.5"/>
          <circle cx="24" cy="24" r={R} fill="none" stroke={urgent ? T.danger : T.accent} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .85s linear, stroke .3s" }}/>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: t.remaining >= 60 ? 10 : 13, fontWeight: 900, color: urgent ? T.danger : T.accent, animation: urgent ? "pulse .65s infinite" : "none" }}>{fmt(t.remaining)}</div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: 1.5, fontWeight: 700, marginBottom: 2 }}>REPOS EN COURS</div>
        <div style={{ fontSize: 13, color: urgent ? T.danger : T.text, fontWeight: 700 }}>{urgent ? "Prépare-toi !" : `Encore ${fmt(t.remaining)}...`}</div>
        <div style={{ marginTop: 5, height: 3, background: T.surface2, borderRadius: 2, width: 120 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: urgent ? T.danger : T.accent, borderRadius: 2, transition: "width .85s linear" }}/>
        </div>
      </div>
    </div>
  );
}

function SetLog({ weight, actualReps, onWeightChange, onRepsChange, weightCmp, repsCmp }) {
  const styleFor = (cmp) => {
    if (cmp === "up")   return { bg: T.cmpUp.bg,   border: T.cmpUp.border,   text: T.cmpUp.text,   suffixBg: T.cmpUp.bg };
    if (cmp === "down") return { bg: T.cmpDown.bg, border: T.cmpDown.border, text: T.cmpDown.text, suffixBg: T.cmpDown.bg };
    return                { bg: T.inputBg,         border: T.borderStrong,   text: T.text,         suffixBg: T.accentLight };
  };
  const wS = styleFor(weightCmp);
  const rS = styleFor(repsCmp);
  return (
    <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, animation: "popIn .2s ease" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <input type="number" min="0" step="0.5" value={weight} onChange={e => onWeightChange(e.target.value)} placeholder="—"
          style={{ width: 54, height: 30, background: wS.bg, border: `1px solid ${wS.border}`, borderRight: "none", borderRadius: "7px 0 0 7px", color: wS.text, fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none", fontFamily: "inherit", transition: "background .3s, border-color .3s, color .3s" }}/>
        <div style={{ height: 30, padding: "0 8px", background: wS.suffixBg, border: `1px solid ${wS.border}`, borderLeft: `1px solid ${wS.border}40`, borderRadius: "0 7px 7px 0", display: "flex", alignItems: "center", fontSize: 9, color: wS.text, fontWeight: 800, letterSpacing: .5, transition: "background .3s, border-color .3s, color .3s" }}>KG</div>
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>x</div>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <input type="number" min="0" step="1" value={actualReps} onChange={e => onRepsChange(e.target.value)} placeholder="—"
          style={{ width: 46, height: 30, background: rS.bg, border: `1px solid ${rS.border}`, borderRight: "none", borderRadius: "7px 0 0 7px", color: rS.text, fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none", fontFamily: "inherit", transition: "background .3s, border-color .3s, color .3s" }}/>
        <div style={{ height: 30, padding: "0 6px", background: rS.suffixBg, border: `1px solid ${rS.border}`, borderLeft: `1px solid ${rS.border}40`, borderRadius: "0 7px 7px 0", display: "flex", alignItems: "center", fontSize: 9, color: rS.text, fontWeight: 800, letterSpacing: .5, transition: "background .3s, border-color .3s, color .3s" }}>REPS</div>
      </div>
    </div>
  );
}

// QuickCard utilitaire
function ToggleSwitch({ on, onChange, disabled }) {
  return (
    <button onClick={() => { if (!disabled) onChange(!on); }} disabled={disabled} style={{
      width: 46, height: 28, borderRadius: 14, border: "none", flexShrink: 0, position: "relative",
      background: on ? T.accent : T.borderStrong, cursor: disabled ? "default" : "pointer",
      transition: "background .25s ease", padding: 0,
    }}>
      <span style={{
        position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: "50%",
        background: "#FFF", transition: "left .25s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }}/>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIRMATION MAISON — remplace window.confirm (dialogues natifs bannis de l'UI)
// ═══════════════════════════════════════════════════════════════════════════════
function ConfirmSheet({ title, message, confirmLabel = "Confirmer", danger = false, onConfirm, onCancel }) {
  // Rendue dans <body> comme toutes les feuilles, pour la raison expliquée sur
  // le composant Portail : une page animée enferme le `position: fixed` dans
  // son contexte d'empilement. Ces confirmations fonctionnaient jusqu'ici par
  // chance — leurs z-index (900/901) les plaçaient au-dessus de tout ce qui
  // partage leur contexte. Le portail rend ça vrai par construction.
  return (
    <Portail>
      <div className="sheet-backdrop" onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 900 }}/>
      <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 901, background: T.bg, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 50px rgba(30,40,32,0.25)", padding: "0 18px calc(18px + env(safe-area-inset-bottom))" }}>
        <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "10px auto 16px" }}/>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: T.text, letterSpacing: 2, textAlign: "center" }}>{title}</div>
        {message ? <div style={{ fontSize: 13, color: T.textSub, textAlign: "center", lineHeight: 1.6, margin: "10px 4px 0" }}>{message}</div> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, color: T.textSub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "14px", background: danger ? T.danger : "linear-gradient(135deg, #064E3B, #0D9488)", color: "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: .5, cursor: "pointer" }}>{confirmLabel}</button>
        </div>
      </div>
    </Portail>
  );
}

// Hook d'utilisation : const { confirm, confirmUI } = useConfirm();
// puis dans un handler : if (!(await confirm({ title: "...", message: "..." }))) return;
// et {confirmUI} rendu dans le JSX du composant.
function useConfirm() {
  const [req, setReq] = useState(null);
  const confirm = useCallback((opts) => new Promise(resolve => setReq({ ...opts, resolve })), []);
  const close = (val) => { const r = req; setReq(null); if (r) r.resolve(val); };
  const confirmUI = req ? (
    <ConfirmSheet title={req.title} message={req.message} confirmLabel={req.confirmLabel} danger={req.danger}
      onConfirm={() => close(true)} onCancel={() => close(false)}/>
  ) : null;
  return { confirm, confirmUI };
}

function QuickCard({ icon, title, subtitle, onClick }) {
  return (
    <div onClick={onClick} className="quick-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={icon} size={20} color={T.accent}/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{subtitle}</div>
      </div>
      <Icon name="chevronRight" size={20} color={T.borderStrong}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LoginScreen
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onAuthSuccess, onCoachClick }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit() {
    if (!code.trim() || loading) return;
    setLoading(true); setError("");
    try {
      const supabase = await getSupabase();
      if (!supabase) throw new Error("Configuration Supabase manquante");
      const { email, password } = codeToCredentials(code);
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error("Code d'accès invalide");
      onAuthSuccess();
    } catch (e) {
      setError(e.message || "Erreur de connexion. Réessaie.");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at top, ${T.surface2} 0%, ${T.bg} 60%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 22px", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 22, animation: "fadeUp .5s ease both" }}><ForgeLogo size={84}/></div>
      <div style={{ textAlign: "center", marginBottom: 36, animation: "fadeUp .5s ease .1s both" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, letterSpacing: 5, color: T.text, lineHeight: 1 }}>FORGE COACHING</div>
        <div style={{ fontSize: 12, color: T.textSub, marginTop: 8, letterSpacing: .5 }}>Entre dans ton espace personnel</div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "26px 22px", width: "100%", maxWidth: 380, boxShadow: `0 14px 50px ${T.shadow}, 0 2px 6px ${T.shadow}`, animation: "fadeUp .5s ease .2s both" }}>
        <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: T.textMuted, letterSpacing: 1.8, marginBottom: 10 }}>CODE D'ACCÈS</label>
        <input ref={inputRef} type="text" value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
          placeholder="EX : MDUPONT27"
          autoCapitalize="characters" autoComplete="off" spellCheck={false}
          style={{ width: "100%", padding: "15px 16px", background: T.bg, border: `1.5px solid ${error ? T.danger : T.borderStrong}`, borderRadius: 12, fontSize: 16, fontWeight: 700, letterSpacing: 2, textAlign: "center", color: T.text, outline: "none", textTransform: "uppercase", fontFamily: "inherit", transition: "border-color .2s" }}/>
        <div style={{ minHeight: 22, marginTop: 8, textAlign: "center" }}>
          {error && <div style={{ fontSize: 11, color: T.danger, fontWeight: 600, animation: "fadeIn .2s" }}>{error}</div>}
        </div>
        <button onClick={handleSubmit} disabled={loading || !code.trim()}
          style={{ width: "100%", marginTop: 6, padding: "15px 20px",
            background: loading || !code.trim() ? T.surface2 : `linear-gradient(135deg, #064E3B 0%, #0D9488 100%)`,
            color: loading || !code.trim() ? T.textMuted : "white",
            border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1.4,
            cursor: loading || !code.trim() ? "default" : "pointer",
            boxShadow: !loading && code.trim() ? `0 6px 18px rgba(13,148,136,0.32)` : "none",
            transition: "all .2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading ? (<><Spinner size={15} color={T.textMuted}/> CONNEXION...</>) : "ACCÉDER À MON ESPACE"}
        </button>
      </div>
      <div style={{ marginTop: 28, fontSize: 11, color: T.textMuted, textAlign: "center", animation: "fadeUp .5s ease .3s both", lineHeight: 1.6 }}>
        Pas encore de code ?<br/>
        <span style={{ color: T.accent, fontWeight: 700 }}>Contacte ton coach.</span>
      </div>
      <button onClick={onCoachClick} style={{ marginTop: 20, background: "transparent", border: "none", color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: .5, cursor: "pointer", textDecoration: "underline", animation: "fadeUp .5s ease .4s both" }}>
        Espace coach
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LoadingScreen / ErrorScreen
// ═══════════════════════════════════════════════════════════════════════════════
function LoadingScreen({ text = "Chargement..." }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", gap: 18 }}>
      <div style={{ animation: "pulse 1.4s ease-in-out infinite" }}><ForgeLogo size={62}/></div>
      <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: 1.5, fontWeight: 700 }}>{text}</div>
    </div>
  );
}

function ErrorScreen({ title, message, onLogout, actionLabel = "Se déconnecter" }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 22, gap: 14 }}>
      <Icon name="alert" size={42} color={T.danger}/>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: T.text, letterSpacing: 2 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.textSub, textAlign: "center", maxWidth: 340, lineHeight: 1.6 }}>{message}</div>
      {onLogout && (
        <button onClick={onLogout} style={{ marginTop: 14, padding: "10px 22px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, color: T.textSub, fontSize: 12, fontWeight: 700, letterSpacing: .8, cursor: "pointer" }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE : HOME
// ═══════════════════════════════════════════════════════════════════════════════
function HomePage({ ctx }) {
  const { appData, todaySession, todayDay, currentWeek, allCompletedSets, navigate, openWorkout, setActiveSessionId } = ctx;
  const { client, week } = appData;

  const stats = useMemo(() => {
    const completedSets = Object.values(allCompletedSets).filter(Boolean).length;
    const wT = new Set(), tS = new Set();
    Object.keys(allCompletedSets).forEach(k => {
      if (allCompletedSets[k]) {
        const [w, s] = k.split("-");
        wT.add(parseInt(w)); tS.add(`${w}-${s}`);
      }
    });
    return { completedSets, weeksTrained: wT.size, totalSessions: tS.size };
  }, [allCompletedSets]);

  const upcomingSessions = week
    .map((w, i) => ({ ...w, dayIdx: i, sess: appData.sessions.find(s => s.id === w.sessionId) }))
    .filter(w => w.sess);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "22px 18px 16px" }}>
        <div style={{ fontSize: 13, color: T.textMuted, letterSpacing: 1, fontWeight: 600 }}>BONJOUR</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: T.text, letterSpacing: 2, lineHeight: 1, marginTop: 4 }}>{client.name.toUpperCase()}</div>
      </div>
      <div style={{ padding: "0 18px" }}>
        {todaySession ? (
          <div className="hero-card" onClick={openWorkout} style={{ background: `linear-gradient(135deg, #064E3B 0%, #065F46 35%, #0D9488 70%, #2DD4BF 100%)`, borderRadius: 22, padding: "22px 22px 24px", color: "white", cursor: "pointer", position: "relative", overflow: "hidden", boxShadow: "0 10px 30px rgba(13,148,136,0.25)" }}>
            <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }}/>
            <div style={{ position: "absolute", bottom: -40, left: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }}/>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, position: "relative" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, opacity: 0.75 }}>SÉANCE DU JOUR · {todayDay}</div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 38, letterSpacing: 3, lineHeight: 1, marginTop: 4 }}>{todaySession.name}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.18)", padding: "6px 10px", borderRadius: 8, fontSize: 9, fontWeight: 800, letterSpacing: 1, backdropFilter: "blur(10px)" }}>S{currentWeek}</div>
            </div>
            <div style={{ display: "flex", gap: 14, marginBottom: 18, fontSize: 11, opacity: 0.9, position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="workout" size={14} color="white"/><span>{todaySession.exercises.length} exercices</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="clock" size={14} color="white"/><span>~{estimateSessionMinutes(todaySession)} min</span></div>
            </div>
            <button style={{ background: "white", color: "#064E3B", border: "none", borderRadius: 14, padding: "13px 20px", fontSize: 13, fontWeight: 800, letterSpacing: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", width: "100%", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", position: "relative" }}>
              <Icon name="play" size={14} color="#064E3B" filled/> COMMENCER LA SÉANCE
            </button>
          </div>
        ) : (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 22, padding: "30px 22px", textAlign: "center", boxShadow: `0 2px 12px ${T.shadow}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: T.textMuted }}>{todayDay}</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: T.accent, letterSpacing: 3, lineHeight: 1, marginTop: 6 }}>JOUR DE REPOS</div>
            <div style={{ fontSize: 13, color: T.textSub, marginTop: 10, lineHeight: 1.6 }}>Profite de cette journée pour récupérer.<br/>La récupération fait partie du programme.</div>
          </div>
        )}
      </div>
      <div style={{ padding: "18px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {[
          { icon: "calendar", value: stats.weeksTrained,  label: "SEMAINES" },
          { icon: "workout",  value: stats.totalSessions, label: "SÉANCES" },
          { icon: "trending", value: stats.completedSets, label: "SÉRIES" },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 10px", textAlign: "center", animation: `fadeUp .4s ease ${0.1 + i * 0.08}s both` }}>
            <Icon name={s.icon} size={18} color={T.accent}/>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: T.accent, letterSpacing: 1, marginTop: 4, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 8, color: T.textMuted, letterSpacing: 1, fontWeight: 700, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <BilanCard ctx={ctx}/>
      <div style={{ padding: "8px 18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2.5, color: T.textSub }}>CETTE SEMAINE</div>
          <button onClick={() => navigate("workout")} style={{ background: "transparent", border: "none", color: T.accent, fontSize: 11, fontWeight: 700, letterSpacing: .5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            Tout voir <Icon name="chevronRight" size={14}/>
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, margin: "0 -18px", padding: "0 18px 4px" }}>
          {upcomingSessions.map((w, i) => (
            <div key={w.dayIdx} className="upcoming-card" onClick={() => { setActiveSessionId(w.sess.id); openWorkout(); }} style={{ flexShrink: 0, width: 130, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 12px 14px", cursor: "pointer", animation: `fadeUp .4s ease ${0.3 + i * 0.06}s both` }}>
              <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, letterSpacing: 1.5 }}>{w.day.slice(0,3)}</div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 17, color: T.accent, letterSpacing: 2, lineHeight: 1.1, marginTop: 6, minHeight: 36 }}>{w.sess.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 9, color: T.textMuted }}>
                <Icon name="workout" size={11} color={T.textMuted}/><span>{w.sess.exercises.length} exos</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        <QuickCard icon="trophy" title="Progression" subtitle="Suis ton évolution semaine par semaine" onClick={() => navigate("progress")}/>
        <QuickCard icon="info"   title="Consignes coach" subtitle="Lis les conventions de ton programme" onClick={() => navigate("profile", "consignes")}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE : WORKOUT
// ═══════════════════════════════════════════════════════════════════════════════
function WorkoutPage({ ctx }) {
  const { appData, viewedWeek, setViewedWeek, currentWeek, activeSessionId, setActiveSessionId, activeSessions, allCompletedSets, allSetLogs, toggleSet, updateLog, timers, cancel, workoutSubView, setWorkoutSubView, openExerciseSheet } = ctx;
  const { week, sessions } = appData;
  const [expandedEx, setExpandedEx] = useState(null);
  const [videoOuverte, setVideoOuverte] = useState(null);   // { titre, url }
  const activeSession = activeSessions.find(s => s.id === activeSessionId) || activeSessions[0];

  const isDone   = (ei, si) => !!allCompletedSets[tKey(viewedWeek, activeSession.id, ei, si)];
  const getTimer = (ei, si) => timers[tKey(viewedWeek, activeSession.id, ei, si)];
  const getLog   = (ei, si) => allSetLogs[tKey(viewedWeek, activeSession.id, ei, si)] || { weight: "", actualReps: "" };
  const getCmp = (ei, si, field, currentValue) => {
    const ex = activeSession.exercises[ei];
    return compareWithPrevious(viewedWeek, activeSession.id, ei, si, field, currentValue, allCompletedSets, allSetLogs, ex?.exercice);
  };

  const totalDone = activeSession.exercises.reduce((a, ex, ei) => a + ex.reps.filter((_, si) => isDone(ei, si)).length, 0);
  const totalSets = activeSession.exercises.reduce((a, ex) => a + ex.series, 0);
  const pct = Math.round((totalDone / totalSets) * 100);

  if (workoutSubView === "organisation") {
    return (
      <div style={{ paddingBottom: 100 }} className="fade-in">
        <div style={{ padding: "18px 18px 14px" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 3, color: T.text }}>ORGANISATION HEBDOMADAIRE</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>Ton planning de la semaine</div>
        </div>
        <div style={{ padding: "0 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
            {week.map((w, i) => {
              const sess = sessions.find(s => s.id === w.sessionId);
              const isActive = !!sess;
              return (
                <div key={i} style={{ background: isActive ? T.accentLight : T.surface2, border: `1px solid ${isActive ? T.accentA33 : T.border}`, borderRadius: 10, padding: "12px 4px", textAlign: "center", animation: `fadeUp .35s ease ${i * 0.04}s both` }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: isActive ? T.accent : T.textMuted, marginBottom: 6 }}>{w.day.slice(0,3)}</div>
                  <div style={{ fontSize: 7.5, color: isActive ? T.accentDark : T.textMuted, lineHeight: 1.4, fontWeight: 500 }}>{sess ? sess.name : "REPOS"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 100 }} className="fade-in">
      <div style={{ padding: "18px 18px 6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 3, color: T.text }}>SEMAINE {viewedWeek}</div>
          <button onClick={() => setWorkoutSubView("organisation")} className="pressable" style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textSub, padding: "6px 10px", borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: .6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="calendar" size={11}/> ORGANISATION
          </button>
        </div>
        <div style={{ fontSize: 11, color: T.textMuted }}>Sélectionne une séance pour t'entraîner</div>
      </div>
      <div style={{ padding: "8px 0 12px", position: "relative" }}>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", padding: "0 18px" }}>
          {(() => {
            let max = 1;
            Object.keys(allCompletedSets).forEach(k => { const w = parseInt(k.split("-")[0]); if (w > max) max = w; });
            const shown = Math.max(20, currentWeek + 4, max);
            return Array.from({ length: shown }, (_, i) => i + 1).map(w => {
              const isActive = viewedWeek === w;
              const isCurrent = w === currentWeek;
              return (
                <button key={w} className="pressable" onClick={() => { setViewedWeek(w); setExpandedEx(null); }} style={{ background: isActive ? T.accent : T.surface, border: `1px solid ${isActive ? T.accent : T.border}`, color: isActive ? T.accentText : T.textSub, padding: "5px 11px", borderRadius: 16, fontSize: 9, fontWeight: 800, whiteSpace: "nowrap", letterSpacing: .6, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, boxShadow: isActive ? `0 1px 6px ${T.accent}25` : "none", cursor: "pointer" }}>
                  <span>SEMAINE {w}</span>
                  {isCurrent && (<span style={{ background: isActive ? "rgba(255,255,255,0.22)" : T.accentA10, color: isActive ? "#FFF" : T.accent, fontSize: 7, fontWeight: 900, letterSpacing: .8, padding: "1.5px 5px", borderRadius: 8 }}>EN COURS</span>)}
                </button>
              );
            });
          })()}
        </div>
      </div>
      <div style={{ padding: "0 18px 14px" }}>
        <div style={{ display: "flex", gap: 5, overflowX: "auto" }}>
          {activeSessions.map(s => {
            const weekDay = week.find(w => w.sessionId === s.id);
            const isActive = activeSessionId === s.id;
            return (
              <button key={s.id} className="pressable" onClick={() => { setActiveSessionId(s.id); setExpandedEx(null); }} style={{ background: isActive ? T.accent : T.surface, border: `1px solid ${isActive ? T.accent : T.border}`, color: isActive ? T.accentText : T.textSub, padding: "8px 14px", borderRadius: 12, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", letterSpacing: .8, flexShrink: 0, cursor: "pointer", boxShadow: isActive ? `0 2px 8px ${T.accent}30` : `0 1px 4px ${T.shadow}` }}>
                {weekDay?.day || s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "0 18px 14px" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, boxShadow: `0 2px 16px ${T.shadow}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, color: T.accent, letterSpacing: 3, lineHeight: 1 }}>{activeSession.name}</div>
                {viewedWeek !== currentWeek && (
                  <span style={{ background: viewedWeek < currentWeek ? T.warnBg : T.surface2, color: viewedWeek < currentWeek ? T.warnText : T.textSub, fontSize: 8, fontWeight: 900, letterSpacing: 1, padding: "2px 7px", borderRadius: 6, border: `1px solid ${viewedWeek < currentWeek ? T.warnBorder : T.border}` }}>
                    {viewedWeek < currentWeek ? "ARCHIVE · ÉDITABLE" : "FUTURE"}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: T.textSub, letterSpacing: 1 }}>
                {week.find(w => w.sessionId === activeSession.id)?.day}&nbsp;·&nbsp;{activeSession.exercises.length} EXERCICES&nbsp;·&nbsp;{totalSets} SÉRIES
              </div>
            </div>
            <div style={{ background: T.accentLight, color: T.accent, fontFamily: "'Bebas Neue'", fontSize: 26, letterSpacing: 2, padding: "4px 14px", borderRadius: 10, lineHeight: 1.2 }}>{pct}%</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.textMuted, marginBottom: 6, letterSpacing: 1 }}>
              <span>PROGRESSION</span>
              <span style={{ color: T.accent, fontWeight: 800 }}>{totalDone} / {totalSets} séries</span>
            </div>
            <div style={{ height: 6, background: T.surface2, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, #064E3B, #0D9488)`, borderRadius: 3, transition: "width .4s ease" }}/>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {activeSession.exercises.map((ex, exIdx) => {
          const isOpen = expandedEx === exIdx;
          const mStyle = muscleColors[ex.muscle] || { bg: T.surface2, text: T.textSub };
          const doneSets = ex.reps.filter((_, si) => isDone(exIdx, si)).length;
          const allDone = doneSets === ex.series;
          return (
            <div key={exIdx} style={{ background: allDone ? T.accentLight : T.surface, border: `1px solid ${allDone ? T.accentA38 : T.border}`, borderRadius: 13, overflow: "hidden", boxShadow: `0 1px 8px ${T.shadow}`, transition: "border-color .2s, background .2s", animation: `fadeUp .35s ease ${exIdx * 0.04}s both` }}>
              <div className="pressable" onClick={() => setExpandedEx(isOpen ? null : exIdx)} style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: allDone ? T.accent : T.surface2, border: `1.5px solid ${allDone ? T.accent : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: allDone ? T.accentText : T.textSub, transition: "all .2s" }}>
                  {allDone ? <Icon name="check" size={14} stroke={3} color={T.accentText}/> : ex.ordre}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: allDone ? T.accentDark : T.text, marginBottom: 4, lineHeight: 1.3 }}>{ex.exercice}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ background: mStyle.bg, color: mStyle.text, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{ex.muscle}</span>
                    <span style={{ color: T.textMuted, fontSize: 10 }}>{ex.series} séries · {ex.repos}</span>
                    {ex.technique && (() => {
                      const tStyle = {
                        "RP":       { bg: "var(--cmp-up-bg)", text: "var(--cmp-up-text)", label: "RP" },
                        "DS":       { bg: "var(--p-seche-bg)", text: "var(--p-seche-tx)", label: "DS" },
                        "Superset": { bg: "var(--p-decharge-bg)", text: "var(--p-decharge-tx)", label: "SUPERSET" },
                      }[ex.technique];
                      return tStyle ? <span style={{ background: tStyle.bg, color: tStyle.text, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 800, letterSpacing: .5 }}>{tStyle.label}</span> : null;
                    })()}
                    {ex.commentaire && <span style={{ background: T.warnBg, color: T.warnText, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{ex.commentaire}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <div><div style={{ fontSize: 12, fontWeight: 800, color: allDone ? T.accent : T.textMuted }}>{doneSets}/{ex.series}</div></div>
                  <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={16} color={T.borderStrong}/>
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${T.border}` }}>
                  {ctx.videosExercices?.[ex.library_exercise_id] && (
                    <button onClick={() => setVideoOuverte({ titre: ex.exercice, url: ctx.videosExercices[ex.library_exercise_id] })} className="pressable" style={{ width: "100%", marginTop: 10, background: T.accentLight, border: `1px solid ${T.accentA38}`, color: T.accentDark, padding: "8px 12px", borderRadius: 9, fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Icon name="play" size={13} color={T.accentDark}/> Voir la démonstration
                    </button>
                  )}
                  <button onClick={() => openExerciseSheet(ex)} className="pressable" style={{ width: "100%", marginTop: 8, marginBottom: 8, background: T.surface2, border: `1px dashed ${T.borderStrong}`, color: T.textSub, padding: "8px 12px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Icon name="trending" size={13}/> Voir l'historique de cet exercice
                  </button>
                  {ex.technique && (() => {
                    const tInfo = {
                      "RP":       { bg: "var(--cmp-up-bg)", border: "var(--cmp-up-text)", text: "var(--cmp-up-text)", label: "REST-PAUSE (RP)", desc: "À l'échec, repose la charge 30 s, puis enchaîne une série supplémentaire." },
                      "DS":       { bg: "var(--p-seche-bg)", border: "var(--p-seche-tx)", text: "var(--p-seche-tx)", label: "DROP SET (DS)", desc: "À l'échec, 30 s de repos, baisse la charge de 30-40% puis repars jusqu'à l'échec." },
                      "Superset": { bg: "var(--p-decharge-bg)", border: "var(--p-decharge-tx)", text: "var(--p-decharge-tx)", label: "SUPERSET", desc: "Enchaîne cet exercice avec le suivant sans repos entre les deux." },
                    }[ex.technique];
                    return tInfo ? (
                      <div style={{ background: tInfo.bg, border: `1px solid ${tInfo.border}40`, borderRadius: 9, padding: "9px 11px", marginBottom: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ background: tInfo.text, color: "#FFF", fontSize: 9, fontWeight: 900, padding: "2px 7px", borderRadius: 6, letterSpacing: .5, flexShrink: 0, marginTop: 1 }}>{tInfo.label}</span>
                        <span style={{ fontSize: 11, color: tInfo.text, lineHeight: 1.4 }}>{tInfo.desc}</span>
                      </div>
                    ) : null;
                  })()}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 2px 6px" }}>
                    <span style={{ fontSize: 9, color: T.textMuted, letterSpacing: 1, fontWeight: 700 }}>SÉRIE · OBJECTIF</span>
                    <span style={{ fontSize: 9, color: T.textMuted, letterSpacing: 1, fontWeight: 700 }}>CHARGE · REPS RÉELLES</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ex.reps.map((rep, setIdx) => {
                      const done = isDone(exIdx, setIdx);
                      const timer = getTimer(exIdx, setIdx);
                      const log = getLog(exIdx, setIdx);
                      const key = tKey(viewedWeek, activeSession.id, exIdx, setIdx);
                      const wCmp = getCmp(exIdx, setIdx, "weight", log.weight);
                      const rCmp = getCmp(exIdx, setIdx, "actualReps", log.actualReps);
                      return (
                        <div key={setIdx} style={{ background: done ? (timer?.done ? T.accentLight : T.setDoneBg) : T.bg, border: `1px solid ${done ? (timer?.done ? T.accentA38 : T.accentA20) : T.border}`, borderRadius: 10, overflow: "hidden", transition: "all .15s" }}>
                          <div className="pressable" onClick={() => toggleSet(activeSession.id, exIdx, setIdx, ex.repos, ex.exercice)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", cursor: "pointer" }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: done ? T.accent : T.surface, border: `1.5px solid ${done ? T.accent : T.borderStrong}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: done ? T.accentText : T.textSub, fontWeight: 900, transition: "all .2s" }}>
                              {done ? <Icon name="check" size={14} stroke={3} color={T.accentText}/> : setIdx + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 12, color: done ? T.textSub : T.text }}>Série {setIdx + 1} — </span>
                              <span style={{ fontSize: 13, fontWeight: 800, color: done ? T.accent : T.text }}>{rep} reps</span>
                            </div>
                            {done && timer ? (
                              <InlineTimer t={timer} onCancel={e => { e?.stopPropagation?.(); cancel(key); }}/>
                            ) : !done ? (
                              <div style={{ fontSize: 10, color: T.textMuted, background: T.surface2, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0, border: `1px solid ${T.border}` }}>{ex.repos}</div>
                            ) : null}
                          </div>
                          {done && (
                            <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px 10px", borderTop: `1px solid ${T.accent}20`, background: T.accentLightA53, animation: "popIn .2s ease", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 10, color: T.accent, fontWeight: 700, letterSpacing: .8, whiteSpace: "nowrap" }}>LOG</span>
                              <SetLog weight={log.weight} actualReps={log.actualReps} weightCmp={wCmp} repsCmp={rCmp} onWeightChange={v => updateLog(key, "weight", v)} onRepsChange={v => updateLog(key, "actualReps", v)}/>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeSession.abdosCardio?.length > 0 && (
        <div style={{ padding: "14px 18px 0" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: "14px 16px", boxShadow: `0 1px 8px ${T.shadow}` }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: 2, color: T.textSub, marginBottom: 10 }}>ABDOS / CARDIO</div>
            {activeSession.abdosCardio.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < activeSession.abdosCardio.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent, flexShrink: 0 }}/>
                <span style={{ fontSize: 12, color: T.text }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <NoteSeance ctx={ctx} session={activeSession} semaine={viewedWeek}/>

      {videoOuverte && <VideoSheet titre={videoOuverte.titre} url={videoOuverte.url} onClose={() => setVideoOuverte(null)}/>}
    </div>
  );
}

// ── Note de séance : le mot du coaché sur CETTE séance ──────────────────────
//
//  Le bilan hebdomadaire dit comment s'est passée la semaine ; ceci dit ce qui
//  s'est passé sur une séance précise. Une note par séance et par semaine,
//  modifiable — pas un fil de discussion : personne ne tient une conversation
//  depuis la salle, entre deux séries.
function NoteSeance({ ctx, session, semaine }) {
  const { supabase, userId, isDemo } = ctx;
  const [note, setNote]     = useState(null);   // null = pas chargé
  const [dispo, setDispo]   = useState(true);
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte]   = useState("");
  const [occupe, setOccupe] = useState(false);

  const cle = `${semaine}-${session?.id}`;

  useEffect(() => {
    if (isDemo || !supabase || !session) { setDispo(false); return; }
    let annule = false;
    (async () => {
      const { data, error } = await supabase
        .from("session_notes").select("*")
        .eq("coachee_id", userId).eq("week_number", semaine)
        .eq("session_config_id", session.id).maybeSingle();
      if (annule) return;
      if (error) { setDispo(!tableAbsente(error)); return; }
      setNote(data || false);
      setTexte(data?.note || "");
      setOuvert(false);
    })();
    return () => { annule = true; };
  }, [supabase, userId, semaine, session, isDemo, cle]);

  if (!dispo || note === null || !session) return null;

  async function enregistrer() {
    const t = texte.trim();
    setOccupe(true);
    try {
      if (!t && note) {
        // Vider le champ efface la note : le coaché n'a pas à vivre avec un
        // mot qu'il regrette d'avoir laissé.
        await supabase.from("session_notes").delete().eq("id", note.id);
        setNote(false);
      } else if (t) {
        await supabase.from("session_notes").upsert({
          coachee_id: userId, week_number: semaine,
          session_config_id: session.id, session_name: session.name,
          note: t, updated_at: new Date().toISOString(),
        }, { onConflict: "coachee_id,week_number,session_config_id" });
        setNote({ note: t });
      }
      setOuvert(false);
    } finally { setOccupe(false); }
  }

  const aUneNote = note !== false;

  return (
    <div style={{ padding: "14px 18px 0" }}>
      {!ouvert ? (
        <div onClick={() => setOuvert(true)} className="quick-card"
          style={{ background: aUneNote ? T.surface : "transparent", border: `1px ${aUneNote ? "solid" : "dashed"} ${aUneNote ? T.border : T.borderStrong}`, borderRadius: 13, padding: aUneNote ? "13px 15px" : "11px 15px", cursor: "pointer" }}>
          <div style={{ fontSize: 9.5, color: T.textMuted, letterSpacing: 1.2, fontWeight: 800, marginBottom: aUneNote ? 6 : 0 }}>
            {aUneNote ? "TA NOTE SUR CETTE SÉANCE" : "+ AJOUTER UNE NOTE SUR CETTE SÉANCE"}
          </div>
          {aUneNote && (
            <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{note.note}</div>
          )}
        </div>
      ) : (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: "13px 15px" }}>
          <div style={{ fontSize: 9.5, color: T.textMuted, letterSpacing: 1.2, fontWeight: 800, marginBottom: 8 }}>
            NOTE SUR CETTE SÉANCE
          </div>
          <textarea rows={3} value={texte} maxLength={400} autoFocus
            onChange={e => setTexte(e.target.value)}
            placeholder="Épaule sensible, salle bondée, exercice remplacé..."
            style={{ ...inputStyle, fontSize: 12.5, resize: "vertical", lineHeight: 1.5 }}/>
          <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
            <button onClick={() => { setTexte(note?.note || ""); setOuvert(false); }}
              style={{ flex: 1, padding: "10px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.textSub, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Annuler
            </button>
            <button onClick={enregistrer} disabled={occupe} className="pressable"
              style={{ flex: 2, padding: "10px", background: occupe ? T.surface2 : T.accent, color: occupe ? T.textMuted : T.accentText, border: "none", borderRadius: 10, fontSize: 11, fontWeight: 800, letterSpacing: .5, cursor: occupe ? "default" : "pointer", fontFamily: "inherit" }}>
              {occupe ? "..." : !texte.trim() && aUneNote ? "SUPPRIMER LA NOTE" : "ENREGISTRER"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Portail : sortir une feuille de sa page ─────────────────────────────────
//
//  PIÈGE DE LA PARTIE L, DEUXIÈME VARIANTE. On savait qu'un parent avec
//  `transform` casse `position: fixed`. Une ANIMATION en fait autant : la
//  classe `.fade-in`, posée sur chaque page, anime `transform` avec
//  `animation-fill-mode: forwards`. L'élément conserve donc un `transform`
//  après l'animation, ce qui crée un contexte d'empilement permanent.
//
//  Conséquence concrète : une feuille rendue à l'intérieur d'une page a beau
//  demander z-index 301, elle reste prisonnière de ce contexte — et la barre
//  d'onglets (z-index 100, mais dans le contexte du dessus) repasse par-dessus
//  ses boutons du bas. Le bouton ENVOYER devenait littéralement incliquable.
//
//  On rend donc les feuilles directement dans <body>, hors de toute page.
function Portail({ children }) {
  return ReactDOM.createPortal(children, document.body);
}

// ── Carte « Bilan de la semaine » sur l'accueil du coaché ───────────────────
function BilanCard({ ctx }) {
  const { supabase, userId, currentWeek, isDemo } = ctx;
  const [bilan, setBilan] = useState(null);      // null = pas encore chargé
  const [dispo, setDispo] = useState(true);      // false = migration pas jouée
  const [ouvert, setOuvert] = useState(false);

  const recharger = useCallback(async () => {
    if (isDemo || !supabase) { setDispo(false); return; }
    const { data, error } = await supabase
      .from("weekly_reviews").select("*")
      .eq("coachee_id", userId).eq("week_number", currentWeek).maybeSingle();
    if (error) { setDispo(!tableAbsente(error)); return; }
    setBilan(data || false);   // false = chargé, mais aucun bilan cette semaine
  }, [supabase, userId, currentWeek, isDemo]);

  useEffect(() => { recharger(); }, [recharger]);

  if (!dispo || bilan === null) return null;

  const rempli = bilan !== false;
  const reponse = rempli && bilan.coach_reply;

  return (
    <>
      <div style={{ padding: "0 18px 4px" }}>
        <div onClick={() => setOuvert(true)} className="quick-card"
          style={{ background: reponse ? T.accentLight : T.surface, border: `1px solid ${reponse ? T.accentA38 : T.border}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: reponse ? T.accent : T.accentLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={reponse ? "check" : "calendar"} size={18} color={reponse ? T.accentText : T.accent}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
              {reponse ? "Ton coach t'a répondu" : rempli ? "Bilan de la semaine envoyé" : "Bilan de la semaine"}
            </div>
            <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2, lineHeight: 1.4 }}>
              {reponse ? `Semaine ${currentWeek} — appuie pour lire`
               : rempli ? "Tu peux encore le modifier"
               : "Comment s'est passée ta semaine ?"}
            </div>
          </div>
          <Icon name="chevronRight" size={18} color={T.borderStrong}/>
        </div>
      </div>
      {ouvert && (
        <BilanSheet ctx={ctx} bilan={rempli ? bilan : null} semaine={currentWeek}
          onClose={() => setOuvert(false)} onSaved={async () => { await recharger(); setOuvert(false); }}/>
      )}
    </>
  );
}

// ── Feuille de saisie du bilan ──────────────────────────────────────────────
function BilanSheet({ ctx, bilan, semaine, onClose, onSaved }) {
  const { supabase, userId } = ctx;
  const [valeurs, setValeurs] = useState(() => {
    const v = {};
    BILAN_CRITERES.forEach(c => { v[c.cle] = bilan?.[c.cle] ?? null; });
    return v;
  });
  const [note, setNote]     = useState(bilan?.note || "");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  // Un bilan entièrement vide n'a rien à dire : on n'enregistre pas du néant.
  const quelqueChose = Object.values(valeurs).some(v => v != null) || note.trim().length > 0;

  async function envoyer() {
    setOccupe(true); setErreur("");
    try {
      const { error } = await supabase.from("weekly_reviews").upsert({
        coachee_id: userId,
        week_number: semaine,
        ...valeurs,
        note: note.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "coachee_id,week_number" });
      if (error) throw error;
      await onSaved();
    } catch (e) {
      setErreur(e?.message || "Enregistrement impossible");
      setOccupe(false);
    }
  }

  return (
    <Portail>
      <div className="sheet-backdrop" onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 300 }}/>
      <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301, background: T.bg, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 50px rgba(30,40,32,0.25)", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "10px auto 12px", flexShrink: 0 }}/>
        <div style={{ overflowY: "auto", padding: "0 18px", flex: "0 1 auto", minHeight: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 21, color: T.text, letterSpacing: 2, marginBottom: 4 }}>BILAN · SEMAINE {semaine}</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
            Tout est facultatif. Même incomplet, ça aide ton coach à ajuster.
          </div>

          {bilan?.coach_reply && (
            <div style={{ background: T.accentLight, border: `1px solid ${T.accentA38}`, borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
              <div style={{ fontSize: 9.5, color: T.accent, fontWeight: 800, letterSpacing: 1, marginBottom: 5 }}>RÉPONSE DE TON COACH</div>
              <div style={{ fontSize: 12.5, color: T.accentDark, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{bilan.coach_reply}</div>
            </div>
          )}

          {BILAN_CRITERES.map(c => (
            <div key={c.cle} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <span style={{ fontSize: 10, color: T.textSub, letterSpacing: 1.2, fontWeight: 800 }}>{c.label.toUpperCase()}</span>
                <span style={{ fontSize: 10, color: T.textMuted }}>
                  {valeurs[c.cle] == null ? "—" : valeurs[c.cle] <= 2 ? c.bas : valeurs[c.cle] >= 4 ? c.haut : "Correct"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => {
                  const actif = valeurs[c.cle] === n;
                  return (
                    <button key={n} className="pressable"
                      onClick={() => setValeurs(v => ({ ...v, [c.cle]: v[c.cle] === n ? null : n }))}
                      aria-label={`${c.label} : ${n} sur 5`}
                      style={{ flex: 1, padding: "11px 0", background: actif ? T.accent : T.surface, color: actif ? T.accentText : T.textSub, border: `1.5px solid ${actif ? T.accent : T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", transition: "background .15s, border-color .15s" }}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <Field label={`UN MOT POUR TON COACH (${note.length}/${BILAN_NOTE_MAX})`}>
            <textarea value={note} maxLength={BILAN_NOTE_MAX} rows={4}
              onChange={e => setNote(e.target.value)}
              placeholder="Une douleur, une contrainte d'horaire, une question..."
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, fontSize: 13 }}/>
          </Field>

          <div style={{ minHeight: 18, textAlign: "center" }}>
            {erreur && <div style={{ fontSize: 11, color: T.danger, fontWeight: 600 }}>{erreur}</div>}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "12px 18px calc(18px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          <button onClick={onClose} style={{ flex: 1, padding: "14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, color: T.textSub, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Fermer</button>
          <button onClick={envoyer} disabled={!quelqueChose || occupe}
            style={{ flex: 2, padding: "14px", background: !quelqueChose || occupe ? T.surface2 : `linear-gradient(135deg, #064E3B, #0D9488)`, color: !quelqueChose || occupe ? T.textMuted : "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: !quelqueChose || occupe ? "default" : "pointer", fontFamily: "inherit" }}>
            {occupe ? "..." : bilan ? "METTRE À JOUR" : "ENVOYER"}
          </button>
        </div>
      </div>
    </Portail>
  );
}

// ── Lecteur de démonstration ────────────────────────────────────────────────
//  Une feuille qui remonte du bas, comme les autres du projet. La vidéo est
//  chargée à l'ouverture seulement : tant que le coaché n'a rien demandé, rien
//  ne part sur le réseau — il est peut-être en salle, en 4G, entre deux séries.
function VideoSheet({ titre, url, onClose }) {
  const v = analyseVideo(url);
  return (
    <Portail>
      <div className="sheet-backdrop" onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 300 }}/>
      <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301, background: T.bg, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 50px rgba(30,40,32,0.25)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "10px auto 12px", flexShrink: 0 }}/>
        <div style={{ padding: "0 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 19, color: T.text, letterSpacing: 1.5, lineHeight: 1.1, minWidth: 0 }}>{titre}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0, flexShrink: 0 }}>Fermer</button>
        </div>
        <div style={{ padding: "0 18px calc(18px + env(safe-area-inset-bottom))", overflowY: "auto" }}>
          {!v ? (
            <div style={{ padding: "26px 4px", textAlign: "center", color: T.textMuted, fontSize: 12.5, lineHeight: 1.6 }}>
              Cette vidéo n'est pas lisible. Signale-le à ton coach.
            </div>
          ) : v.type === "embed" ? (
            <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden", background: "#000" }}>
              <iframe src={v.src} title={titre} allowFullScreen
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}/>
            </div>
          ) : v.type === "fichier" ? (
            <video src={v.src} controls playsInline preload="metadata"
              style={{ width: "100%", borderRadius: 12, background: "#000", display: "block" }}/>
          ) : (
            <a href={v.src} target="_blank" rel="noopener noreferrer" className="pressable"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: T.accent, color: T.accentText, borderRadius: 12, fontSize: 12.5, fontWeight: 800, letterSpacing: .5, textDecoration: "none" }}>
              <Icon name="play" size={15} color={T.accentText}/> Ouvrir sur {v.source}
            </a>
          )}
        </div>
      </div>
    </Portail>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE : PROGRESS
// ═══════════════════════════════════════════════════════════════════════════════
function ProgressPage({ ctx }) {
  const { appData, allCompletedSets, allSetLogs, openExerciseSheet } = ctx;
  const { sessions } = appData;
  const [openMuscle, setOpenMuscle] = useState(null);

  const grouped = useMemo(() => {
    const map = new Map();
    sessions.forEach(s => s.exercises.forEach(ex => {
      if (!map.has(ex.muscle)) map.set(ex.muscle, []);
      const list = map.get(ex.muscle);
      if (!list.find(e => e.name === ex.exercice)) list.push({ name: ex.exercice, muscle: ex.muscle });
    }));
    return Array.from(map.entries());
  }, [sessions]);

  function getExerciseProgress(exerciseName) {
    const weeks = new Set();
    let bestWeight = 0;
    Object.entries(allSetLogs).forEach(([k, log]) => {
      if (log?.exerciseName === exerciseName && allCompletedSets[k] && log.weight) {
        weeks.add(parseInt(k.split("-")[0]));
        const w = parseFloat(log.weight);
        if (!isNaN(w) && w > bestWeight) bestWeight = w;
      }
    });
    return { weeksLogged: weeks.size, bestWeight };
  }

  return (
    <div style={{ paddingBottom: 100 }} className="fade-in">
      <div style={{ padding: "22px 18px 16px" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: T.text, letterSpacing: 3, lineHeight: 1 }}>PROGRESSION</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 5 }}>
          {grouped.length} groupes musculaires · {grouped.reduce((a, [, exs]) => a + exs.length, 0)} exercices
        </div>
      </div>
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {grouped.map(([muscle, exercises], groupIdx) => {
          const mStyle = muscleColors[muscle] || { bg: T.surface2, text: T.textSub };
          const isOpen = openMuscle === muscle;
          const withData = exercises.filter(ex => getExerciseProgress(ex.name).bestWeight > 0).length;
          return (
            <div key={muscle} style={{ background: T.surface, border: `1.5px solid ${isOpen ? mStyle.text + "50" : T.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color .2s, box-shadow .2s", boxShadow: isOpen ? `0 4px 16px ${mStyle.text}12` : `0 1px 4px ${T.shadow}`, animation: `fadeUp .35s ease ${groupIdx * 0.05}s both` }}>
              <div className="pressable" onClick={() => setOpenMuscle(isOpen ? null : muscle)} style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: mStyle.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="trending" size={20} color={mStyle.text}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                    <span style={{ background: mStyle.bg, color: mStyle.text, fontSize: 10, padding: "2px 9px", borderRadius: 20, fontWeight: 800 }}>{muscle}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>
                    {exercises.length} exercice{exercises.length > 1 ? "s" : ""}
                    {withData > 0 && (<span style={{ color: T.accent, fontWeight: 700 }}> · {withData} avec données</span>)}
                  </div>
                </div>
                <div style={{ transition: "transform .25s cubic-bezier(0.34,1.56,0.64,1)", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                  <Icon name="chevronRight" size={18} color={T.borderStrong}/>
                </div>
              </div>
              {isOpen && (
                <div style={{ borderTop: `1px solid ${T.border}` }}>
                  {exercises.map((ex, i) => {
                    const prog = getExerciseProgress(ex.name);
                    return (
                      <div key={ex.name} onClick={() => openExerciseSheet({ exercice: ex.name, muscle: ex.muscle })} className="pressable" style={{ padding: "11px 14px 11px 18px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: T.surface, borderBottom: i < exercises.length - 1 ? `1px solid ${T.border}` : "none", animation: `fadeUp .2s ease ${i * 0.04}s both` }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: prog.bestWeight > 0 ? mStyle.text : T.borderStrong, opacity: prog.bestWeight > 0 ? 1 : 0.4 }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>{ex.name}</div>
                          {prog.weeksLogged > 0 && (<div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{prog.weeksLogged} semaine{prog.weeksLogged > 1 ? "s" : ""} loguée{prog.weeksLogged > 1 ? "s" : ""}</div>)}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {prog.bestWeight > 0 ? (
                            <>
                              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 17, color: T.accent, letterSpacing: 1, lineHeight: 1 }}>{prog.bestWeight} <span style={{ fontSize: 10 }}>KG</span></div>
                              <div style={{ fontSize: 8, color: T.textMuted, letterSpacing: 1, marginTop: 1 }}>RECORD</div>
                            </>
                          ) : (
                            <div style={{ fontSize: 10, color: T.textMuted, fontStyle: "italic" }}>—</div>
                          )}
                        </div>
                        <Icon name="chevronRight" size={16} color={T.borderStrong}/>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE : PROFILE (+ bouton déconnexion)
// ═══════════════════════════════════════════════════════════════════════════════
function ProfilePage({ ctx }) {
  const { appData, profileSubView, setProfileSubView, onLogout, isDemo } = ctx;
  const { client } = appData;
  const { confirm, confirmUI } = useConfirm();

  if (profileSubView === "consignes") {
    return (
      <div style={{ paddingBottom: 100 }} className="fade-in">
        <div style={{ padding: "18px 18px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setProfileSubView(null)} className="pressable" style={{ background: T.surface, border: `1px solid ${T.border}`, width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Icon name="chevronLeft" size={20} color={T.text}/>
          </button>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: T.text, letterSpacing: 3, lineHeight: 1 }}>CONSIGNES COACH</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>Les conventions de ton programme</div>
          </div>
        </div>
        <div style={{ padding: "0 18px" }}>
          {[
            { label: "ÉCHAUFFEMENT", color: T.warnText, bg: T.warnBg, border: "var(--warn-border)", title: "Avant chaque exercice", text: "Réalise 2 à 3 séries légères à 50/60% de la charge de travail prévue avant d'attaquer tes séries de travail. Ne zappe jamais cette étape." },
            { label: "RP",           color: "var(--cmp-up-text)", bg: "var(--cmp-up-bg)", border: "var(--cmp-up-border)", title: "Rest-Pause",            text: "Après être allé à l'échec sur une série, repose la charge pendant 30 secondes, puis enchaîne une série supplémentaire. Note-la dans le logbook." },
            { label: "DS",           color: "var(--p-seche-tx)", bg: "var(--p-seche-bg)", border: "var(--p-seche-tx)", title: "Drop Set",              text: "Après avoir atteint l'échec, prends 30 secondes de repos. Baisse ensuite la charge de 30 à 40% et réalise une série supplémentaire jusqu'à l'échec." },
            { label: "SUPERSET",     color: "var(--p-decharge-tx)", bg: "var(--p-decharge-bg)", border: "var(--p-decharge-tx)", title: "Deux exercices en enchaînement", text: "Lorsque deux exercices sont surlignés de cette couleur, enchaîne-les sans temps de repos entre les deux (ou juste le temps de t'installer sur la machine suivante). Prends ensuite le temps de repos indiqué sur l'exercice 2 avant de repartir sur l'exercice 1." },
            { label: "ALERTE",       color: "var(--cmp-down-text)", bg: "var(--cmp-down-bg)", border: "var(--cmp-down-border)", title: "Si tu vois 2 semaines de rouge consécutives sur un exercice", text: "Contacte-moi directement. Une régression sur 2 semaines de suite signifie qu'on doit ajuster quelque chose : intensité, récupération, technique, ou programmation. Pas de panique, c'est exactement à ça que sert le suivi — on adapte ensemble." },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: "16px", marginBottom: 10, animation: `fadeUp .3s ease ${i * 0.05}s both` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ background: c.color, color: "#FFF", fontWeight: 900, padding: "4px 10px", borderRadius: 6, letterSpacing: 1, fontFamily: "'Bebas Neue'", fontSize: 11 }}>{c.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.title}</span>
              </div>
              <p style={{ fontSize: 12, color: T.text, lineHeight: 1.7, margin: 0 }}>{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 100 }} className="fade-in">
      <div style={{ padding: "22px 18px 18px", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto 14px", background: `linear-gradient(135deg, #064E3B, #2DD4BF)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: 36, color: "white", letterSpacing: 2, boxShadow: "0 6px 20px rgba(13,148,136,0.3)" }}>
          {client.name[0].toUpperCase()}
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: T.text, letterSpacing: 3, lineHeight: 1 }}>{client.name.toUpperCase()}</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>Coaché depuis {client.startDate || "—"}</div>
      </div>
      <div style={{ padding: "0 18px 14px" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", boxShadow: `0 1px 8px ${T.shadow}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Objectif</span>
            <span style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>{client.goal || "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Programme</span>
            <span style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>{ctx.activeSessions.length} séances / semaine</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Coach</span>
            <span style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>Forge Coaching</span>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        <QuickCard icon="info"     title="Consignes coach" subtitle="Conventions et codes du programme" onClick={() => setProfileSubView("consignes")}/>
        <QuickCard icon="calendar" title="Mon programme"   subtitle="Voir l'organisation hebdomadaire"  onClick={() => ctx.navigate("workout", "organisation")}/>
        <QuickCard icon="trophy"   title="Mes records"     subtitle="Records personnels par exercice"   onClick={() => ctx.navigate("progress")}/>
      </div>

      {!isDemo && (
        <div style={{ padding: "18px 18px 0" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2.5, color: T.textSub, marginBottom: 10, paddingLeft: 2 }}>RÉGLAGES</div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "4px 16px", boxShadow: `0 1px 8px ${T.shadow}` }}>
            {/* Apparence — stockée localement, par appareil, comme les autres réglages */}
            <div style={{ padding: "13px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Apparence</div>
              <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2, marginBottom: 10, lineHeight: 1.4 }}>
                « Automatique » suit le réglage de ton téléphone
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["auto", "AUTO"], ["clair", "CLAIR"], ["sombre", "SOMBRE"]].map(([val, lib]) => {
                  const actif = ctx.theme === val;
                  return (
                    <button key={val} onClick={() => ctx.setTheme(val)} className="pressable"
                      style={{
                        flex: 1, padding: "9px 4px", borderRadius: 10, cursor: "pointer",
                        background: actif ? T.accent : T.bg,
                        color: actif ? T.accentText : T.textSub,
                        border: `1.5px solid ${actif ? T.accent : T.border}`,
                        fontSize: 10, fontWeight: 800, letterSpacing: 1, fontFamily: "inherit",
                        transition: "all .2s ease",
                      }}>
                      {lib}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Notifications push — abonnement de cet appareil */}
            <div style={{ padding: "13px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Notifications</div>
                  <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2, lineHeight: 1.4 }}>
                    {ctx.push.etat === "actif"      ? "Rappels de séance et messages de ton coach"
                     : ctx.push.etat === "refuse"   ? "Bloquées par ton téléphone"
                     : ctx.push.etat === "ios-non-installee" ? "Nécessite l'app installée sur l'écran d'accueil"
                     : ctx.push.etat === "indisponible" ? "Non disponibles sur cet appareil"
                     : "Être prévenu de tes séances"}
                  </div>
                </div>
                {(ctx.push.etat === "actif" || ctx.push.etat === "inactif") && (
                  <ToggleSwitch
                    on={ctx.push.etat === "actif"}
                    disabled={ctx.push.occupe}
                    onChange={v => v ? ctx.push.activer() : ctx.push.desactiver()}/>
                )}
              </div>

              {ctx.push.etat === "ios-non-installee" && (
                <div style={{ background: T.warnBg, border: `1px solid ${T.warnBorder}`, borderRadius: 10, padding: "9px 11px", marginTop: 9, fontSize: 10.5, color: T.warnText, lineHeight: 1.5, fontWeight: 600 }}>
                  Sur iPhone, Apple n'autorise les notifications que depuis une app installée.
                  Appuie sur Partager, puis « Sur l'écran d'accueil », et reviens ici.
                </div>
              )}

              {ctx.push.etat === "actif" && (
                <button onClick={ctx.push.tester} disabled={ctx.push.occupe} className="pressable"
                  style={{ marginTop: 9, width: "100%", padding: "9px", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: 10, color: T.textSub, fontSize: 10.5, fontWeight: 800, letterSpacing: .8, cursor: ctx.push.occupe ? "default" : "pointer", fontFamily: "inherit" }}>
                  {ctx.push.occupe ? "ENVOI..." : "ENVOYER UN TEST"}
                </button>
              )}

              {ctx.push.message && (
                <div style={{ fontSize: 10.5, color: T.textSub, marginTop: 8, lineHeight: 1.5 }}>
                  {ctx.push.message}
                </div>
              )}
            </div>
            {/* Chronomètres de repos */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: `1px solid ${T.border}`, gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Chronomètres de repos</div>
                <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2, lineHeight: 1.4 }}>Démarrer un minuteur à la validation d'une série</div>
              </div>
              <ToggleSwitch on={ctx.settings.restTimers} onChange={v => {
                ctx.updateSetting("restTimers", v);
                if (!v) ctx.updateSetting("restSound", false); // son coupé si chronos désactivés
              }}/>
            </div>
            {/* Son de fin de repos — modifiable seulement si les chronos sont actifs */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", gap: 12, opacity: ctx.settings.restTimers ? 1 : 0.45 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Sonnerie de fin de repos</div>
                <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2, lineHeight: 1.4 }}>{ctx.settings.restTimers ? "Jouer un son quand le repos est terminé" : "Active d'abord les chronomètres"}</div>
              </div>
              <ToggleSwitch on={ctx.settings.restTimers && ctx.settings.restSound} disabled={!ctx.settings.restTimers} onChange={v => ctx.updateSetting("restSound", v)}/>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "30px 18px 0", textAlign: "center", color: T.textMuted, fontSize: 10, letterSpacing: 1 }}>
        FORGE COACHING · v1.0{isDemo ? " · MODE DÉMO" : ""}
      </div>
      {confirmUI}
      {onLogout && !isDemo && (
        <div style={{ padding: "16px 18px 0", textAlign: "center" }}>
          <button onClick={async () => { if (await confirm({ title: "DÉCONNEXION", message: "Tu devras ressaisir ton code d'accès pour te reconnecter.", confirmLabel: "Se déconnecter", danger: true })) onLogout(); }}
            style={{ background: "transparent", border: "none", color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: .8, cursor: "pointer", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="logout" size={13} color={T.textMuted}/>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SHEET : Détail exercice
// ═══════════════════════════════════════════════════════════════════════════════
function ExerciseSheet({ exercise, allSetLogs, allCompletedSets, onClose }) {
  const history = useMemo(() => {
    if (!exercise) return [];
    const items = [];
    Object.entries(allSetLogs).forEach(([key, log]) => {
      if (log?.exerciseName === exercise.exercice && allCompletedSets[key] && log.weight && log.actualReps) {
        const [w, sid, ei, si] = key.split("-").map(Number);
        items.push({ week: w, sid, ei, si, weight: parseFloat(log.weight), reps: parseInt(log.actualReps), date: log.loggedAt });
      }
    });
    items.sort((a, b) => b.week - a.week || b.si - a.si);
    return items;
  }, [exercise, allSetLogs, allCompletedSets]);

  const bestRecord = useMemo(() => history.length ? history.reduce((best, h) => h.weight > best.weight ? h : best) : null, [history]);
  const weeklyMax = useMemo(() => {
    const map = new Map();
    history.forEach(h => { const cur = map.get(h.week) || 0; if (h.weight > cur) map.set(h.week, h.weight); });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).slice(-8);
  }, [history]);
  const maxBar = Math.max(...weeklyMax.map(([, v]) => v), 1);
  const mStyle = exercise ? (muscleColors[exercise.muscle] || { bg: T.surface2, text: T.textSub }) : null;
  if (!exercise) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 200 }}/>
      <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201, background: T.bg, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 50px rgba(30,40,32,0.25)", maxHeight: "85vh", overflowY: "auto", padding: "10px 18px 28px" }}>
        <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "0 auto 16px" }}/>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: mStyle.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="trending" size={22} color={mStyle.text}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: T.text, letterSpacing: 2, lineHeight: 1.1 }}>{exercise.exercice}</div>
            <span style={{ background: mStyle.bg, color: mStyle.text, fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700, marginTop: 6, display: "inline-block" }}>{exercise.muscle}</span>
          </div>
          <button onClick={onClose} style={{ background: T.surface, border: `1px solid ${T.border}`, width: 32, height: 32, borderRadius: 10, fontSize: 16, color: T.textSub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 18 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: T.accent, letterSpacing: 1, lineHeight: 1 }}>{bestRecord ? bestRecord.weight : "—"}</div>
            <div style={{ fontSize: 8, color: T.textMuted, letterSpacing: 1, marginTop: 4, fontWeight: 700 }}>RECORD (KG)</div>
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: T.accent, letterSpacing: 1, lineHeight: 1 }}>{history.length}</div>
            <div style={{ fontSize: 8, color: T.textMuted, letterSpacing: 1, marginTop: 4, fontWeight: 700 }}>SÉRIES LOG</div>
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: T.accent, letterSpacing: 1, lineHeight: 1 }}>{new Set(history.map(h => h.week)).size}</div>
            <div style={{ fontSize: 8, color: T.textMuted, letterSpacing: 1, marginTop: 4, fontWeight: 700 }}>SEMAINES</div>
          </div>
        </div>
        {weeklyMax.length > 0 && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>RECORD PAR SEMAINE</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, paddingBottom: 16, borderBottom: `1px solid ${T.border}`, position: "relative" }}>
              {weeklyMax.map(([w, v], i) => {
                const h = (v / maxBar) * 100;
                return (
                  <div key={w} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative" }}>
                    <div style={{ fontSize: 8, color: T.text, fontWeight: 700, marginBottom: 3 }}>{v}</div>
                    <div style={{ width: "70%", height: `${h}%`, minHeight: 4, background: `linear-gradient(180deg, #2DD4BF, #064E3B)`, borderRadius: "4px 4px 0 0", animation: `growUp .6s ease ${i * 0.06}s both`, transformOrigin: "bottom" }}/>
                    <div style={{ position: "absolute", bottom: -14, fontSize: 8, color: T.textMuted, fontWeight: 700 }}>S{w}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>HISTORIQUE DÉTAILLÉ</div>
        {history.length === 0 ? (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px", textAlign: "center", color: T.textMuted, fontSize: 12 }}>
            Aucune série loguée pour cet exercice.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {history.slice(0, 30).map((h, i) => (
              <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: T.accentLight, color: T.accent, fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 6, letterSpacing: .5 }}>S{h.week}</div>
                <div style={{ fontSize: 11, color: T.textSub, flex: 1 }}>Série {h.si + 1}</div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 16, color: T.text, letterSpacing: 1 }}>
                  {h.weight}<span style={{ fontSize: 10, color: T.textMuted, marginLeft: 2 }}>KG</span>
                  <span style={{ color: T.textMuted, margin: "0 4px" }}>×</span>
                  {h.reps}<span style={{ fontSize: 10, color: T.textMuted, marginLeft: 2 }}>R</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BOTTOM TAB BAR
// ═══════════════════════════════════════════════════════════════════════════════
function BottomTabBar({ activePage, onNavigate, showNutrition, weighReminder }) {
  const tabs = [
    { id: "home",     label: "Accueil",  icon: "home" },
    { id: "workout",  label: "Séances",  icon: "workout" },
    { id: "parcours", label: "Parcours", icon: "calendar" },
    ...(showNutrition ? [{ id: "nutrition", label: "Nutrition", icon: "clock" }] : []),
    { id: "progress", label: "Progrès",  icon: "progress" },
    { id: "profile",  label: "Profil",   icon: "profile" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,252,247,0.92)", backdropFilter: "blur(20px) saturate(180%)", borderTop: `1px solid ${T.border}`, padding: "10px 8px 16px", display: "flex", justifyContent: "space-around", zIndex: 100, boxShadow: `0 -2px 24px ${T.shadow}` }}>
      {tabs.map(tab => {
        const isActive = activePage === tab.id;
        const showDot = tab.id === "nutrition" && weighReminder;
        return (
          <button key={tab.id} onClick={() => onNavigate(tab.id)} className="tab-bar-btn" style={{ background: "transparent", border: "none", cursor: "pointer", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 4px", color: isActive ? T.accent : T.textMuted, transition: "color .2s" }}>
            <div style={{ position: "relative", transition: "transform .25s cubic-bezier(0.34,1.56,0.64,1)", transform: isActive ? "scale(1.1)" : "scale(1)" }}>
              <Icon name={tab.icon} size={22} color={isActive ? T.accent : T.textMuted} filled={isActive} stroke={2}/>
              {showDot && <span style={{ position: "absolute", top: -2, right: -4, width: 9, height: 9, borderRadius: "50%", background: T.danger, border: `1.5px solid ${T.surface}` }}/>}
            </div>
            <div style={{ fontSize: 9, fontWeight: isActive ? 800 : 600, letterSpacing: .3, transition: "all .2s" }}>{tab.label}</div>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTHENTICATED APP — l'app principale une fois la session établie (ou en démo)
// ═══════════════════════════════════════════════════════════════════════════════
function AuthenticatedApp({ session, supabase, isDemo, onLogout }) {
  // userId : id Supabase si connecté, sinon "demo" pour le mode local
  const userId = session?.user?.id || "demo";

  // ── État : données de l'app (client + week + sessions) ──
  // null = en cours de chargement, sinon { client, week, sessions, programId }
  const [appData, setAppData] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // ── État : workout / nav ──
  const [page, setPage] = useState("home");
  const [pageTransition, setPageTransition] = useState(null);
  const prevPageRef = useRef("home");
  const [workoutSubView, setWorkoutSubView] = useState(null);
  const [profileSubView, setProfileSubView] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // ── État : données de logs ──
  const [currentWeek, setCurrentWeek] = useState(1);
  const [viewedWeek, setViewedWeek] = useState(1);
  const [allCompletedSets, setAllCompletedSets] = useState({});
  const [allSetLogs, setAllSetLogs] = useState({});
  const [syncStatus, setSyncStatus] = useState(isDemo ? "demo" : "synced");
  const [sheetExercise, setSheetExercise] = useState(null);
  const [weighedToday, setWeighedToday] = useState(true); // true par défaut pour ne pas flasher la pastille

  // Vérifie si la pesée du jour est faite (coachés Premium uniquement)
  const refreshWeighedToday = useCallback(async () => {
    if (isDemo || !appData || appData.client.offer !== "premium") { setWeighedToday(true); return; }
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("weight_logs").select("id").eq("coachee_id", userId).eq("logged_date", today).maybeSingle();
      setWeighedToday(!!data);
    } catch { setWeighedToday(true); }
  }, [isDemo, appData, supabase, userId]);
  useEffect(() => { refreshWeighedToday(); }, [refreshWeighedToday]);

  const weekIdCacheRef = useRef(new Map());
  // Réglages coaché (chronos / son), stockés localement par appareil
  const [settings, setSettings] = useState(() => loadSettings(userId));
  const soundEnabledRef = useRef(settings.restSound);
  useEffect(() => { soundEnabledRef.current = settings.restTimers && settings.restSound; }, [settings]);
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => { const next = { ...prev, [key]: value }; saveSettings(userId, next); return next; });
  }, [userId]);
  const { timers, start, cancel } = useTimers(soundEnabledRef);
  // Thème clair/sombre — stocké localement, comme les chronos et la sonnerie
  const { theme, setTheme } = useTheme();
  // Notifications push — abonnement de CET appareil
  const push = usePushNotifications(supabase, userId, isDemo);

  // ── Vidéos de démonstration ────────────────────────────────────────────────
  //  Le programme ne stocke que library_exercise_id : on va chercher les liens
  //  dans la bibliothèque du coach. Ainsi, corriger une vidéo une fois côté
  //  coach la corrige pour tout le monde, sans retoucher aucun programme.
  //
  //  CE CHARGEMENT NE DOIT JAMAIS EMPÊCHER L'APP DE DÉMARRER. Il est donc à
  //  part, après coup, et son échec est silencieux : tant que la migration
  //  sql/2026-08-08-videos-exercices.sql n'est pas jouée, la RLS renvoie zéro
  //  ligne — il n'y a simplement pas de vidéos, et la séance s'affiche comme
  //  avant.
  const [videosExercices, setVideosExercices] = useState({});
  useEffect(() => {
    if (isDemo || !supabase || !appData?.client) return;
    let annule = false;
    (async () => {
      try {
        const { data: profil } = await supabase
          .from("profiles").select("coach_id").eq("id", userId).single();
        if (!profil?.coach_id) return;
        const { data } = await supabase
          .from("exercises_library").select("*").eq("coach_id", profil.coach_id);
        if (annule || !data) return;
        const map = {};
        data.forEach(ex => { if (ex.video_url) map[ex.id] = ex.video_url; });
        setVideosExercices(map);
      } catch { /* pas de vidéos, l'app fonctionne pareil */ }
    })();
    return () => { annule = true; };
  }, [supabase, userId, isDemo, appData?.client]);

  // ── Chargement initial : profil + programme + logs ────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) Cache local d'abord (affichage instantané)
        const cached = loadCache(userId);
        if (cached) {
          setAppData(cached.appData || null);
          setAllCompletedSets(cached.completedSets || {});
          setAllSetLogs(cached.setLogs || {});
          setCurrentWeek(cached.currentWeek || 1);
          setViewedWeek(cached.currentWeek || 1);
        }

        if (isDemo) {
          // Mode démo : on charge les données par défaut, pas de Supabase
          if (!cached) {
            setAppData({ client: DEFAULT_CLIENT, week: DEFAULT_WEEK, sessions: DEFAULT_SESSIONS, programId: null });
          }
          if (!cancelled) setSyncStatus("demo");
          return;
        }

        // 2) Mode Supabase : charger profil + programme actif depuis la base
        const { data: profile, error: profileErr } = await supabase
          .from("profiles").select("*").eq("id", userId).single();
        if (profileErr) throw new Error("Impossible de charger ton profil");

        const { data: program, error: programErr } = await supabase
          .from("programs").select("*")
          .eq("coachee_id", userId).eq("is_active", true)
          .maybeSingle();
        if (programErr) throw programErr;
        if (!program) throw new Error("Aucun programme actif. Contacte ton coach.");

        const remoteAppData = {
          client: {
            name: profile.name,
            id: profile.access_code || userId,
            startDate: profile.start_date || "",
            goal: profile.goal || "",
            offer: profile.offer || "essentiel",
            createdAt: profile.created_at || null,
          },
          week: program.week_structure,
          sessions: program.sessions_structure,
          programId: program.id,
        };

        if (!cancelled) setAppData(remoteAppData);

        // 3) Charger tous les sets depuis Supabase
        const { allCompletedSets: rcs, allSetLogs: rls, maxWeek } = await loadAllSetsFromSupabase(supabase, userId);
        // La semaine en cours est calculée depuis la date de création du compte (figée).
        const computedWeek = currentWeekFromDate(profile.created_at);
        if (!cancelled) {
          setAllCompletedSets(rcs);
          setAllSetLogs(rls);
          setCurrentWeek(computedWeek);
          setViewedWeek(computedWeek);
        }

        // 4) Cache local refresh
        saveCache(userId, {
          appData: remoteAppData,
          completedSets: rcs,
          setLogs: rls,
          currentWeek: computedWeek,
          lastSavedAt: new Date().toISOString(),
        });

        // 5) Tenter de synchroniser la file d'attente offline
        const pending = loadPending(userId);
        if (pending.length > 0 && supabase) {
          try {
            for (const payload of pending) {
              await pushSetToSupabase({ supabase, userId, programId: remoteAppData.programId, weekIdCache: weekIdCacheRef.current, payload });
            }
            savePending(userId, []);
          } catch {
            // garde la file pour plus tard
          }
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message || "Erreur de chargement");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isDemo]);

  // ── Quand appData arrive, initialiser activeSessionId ──
  useEffect(() => {
    if (appData && !activeSessionId) {
      const firstActive = appData.sessions.find(s => appData.week.some(w => w.sessionId === s.id));
      if (firstActive) setActiveSessionId(firstActive.id);
    }
  }, [appData, activeSessionId]);

  // ── Cache local : sauvegarde à chaque changement ──
  useEffect(() => {
    if (!appData) return;
    saveCache(userId, {
      appData,
      completedSets: allCompletedSets,
      setLogs: allSetLogs,
      currentWeek,
      lastSavedAt: new Date().toISOString(),
    });
  }, [userId, appData, allCompletedSets, allSetLogs, currentWeek]);

  // ── Navigation entre pages ──
  const tabOrder = ["home", "workout", "progress", "profile"];
  const navigate = useCallback((newPage, subView) => {
    const fromIdx = tabOrder.indexOf(prevPageRef.current);
    const toIdx = tabOrder.indexOf(newPage);
    setPageTransition(toIdx > fromIdx ? "forward" : "backward");
    if (newPage !== "workout") setWorkoutSubView(null);
    if (newPage !== "profile") setProfileSubView(null);
    if (subView) {
      if (newPage === "workout") setWorkoutSubView(subView);
      if (newPage === "profile") setProfileSubView(subView);
    }
    prevPageRef.current = newPage;
    setPage(newPage);
    setTimeout(() => setPageTransition(null), 380);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Vidage de la file d'attente hors-ligne (séries loguées sans réseau) ──
  const flushPending = useCallback(async () => {
    if (isDemo || !supabase || !appData?.programId) return;
    const pending = loadPending(userId);
    if (pending.length === 0) return;
    setSyncStatus("pending");
    try {
      for (const payload of pending) {
        await pushSetToSupabase({ supabase, userId, programId: appData.programId, weekIdCache: weekIdCacheRef.current, payload });
      }
      savePending(userId, []);
      setSyncStatus("synced");
    } catch {
      setSyncStatus("error"); // la file est conservée, on retentera
    }
  }, [supabase, userId, appData, isDemo]);

  // Retente automatiquement dès que la connexion revient (avant v7d : uniquement
  // au redémarrage de l'app — une séance entière pouvait rester non synchronisée)
  useEffect(() => {
    window.addEventListener("online", flushPending);
    return () => window.removeEventListener("online", flushPending);
  }, [flushPending]);

  // ── Push d'une série vers Supabase (avec gestion offline) ──
  const pushSet = useCallback(async (payload) => {
    if (isDemo || !supabase || !appData?.programId) return; // mode démo : pas de push
    setSyncStatus("pending");
    try {
      await pushSetToSupabase({ supabase, userId, programId: appData.programId, weekIdCache: weekIdCacheRef.current, payload });
      setSyncStatus("synced");
      // si des séries attendaient dans la file, on en profite pour les écouler
      if (loadPending(userId).length > 0) flushPending();
    } catch (e) {
      // offline ou erreur : ajout en file
      queueForSync(userId, payload);
      setSyncStatus("error");
    }
  }, [supabase, userId, appData, isDemo, flushPending]);

  // ── Toggle d'une série + déclenchement du timer ──
  const toggleSet = useCallback((sessionId, exIdx, setIdx, repos, exerciseName) => {
    const key = tKey(viewedWeek, sessionId, exIdx, setIdx);
    setAllCompletedSets(prev => {
      const nowDone = !prev[key];
      // (Volontairement, valider une série dans une semaine future ne change PAS la semaine en cours.)
      if (nowDone) {
        if (viewedWeek >= currentWeek && settings.restTimers) start(key, parseRepos(repos));
        setAllSetLogs(l => l[key] ? l : { ...l, [key]: { weight: "", actualReps: "", exerciseName, loggedAt: new Date().toISOString() } });
      } else {
        cancel(key);
      }
      // sync vers Supabase (async, fire and forget)
      const log = allSetLogs[key] || {};
      pushSet({
        weekNumber: viewedWeek, sessionId, exerciseIndex: exIdx, setIndex: setIdx,
        exerciseName, weight: log.weight, actualReps: log.actualReps, completed: nowDone,
      });
      return { ...prev, [key]: nowDone };
    });
  }, [viewedWeek, currentWeek, start, cancel, pushSet, allSetLogs, settings.restTimers]);

  // ── Modification d'une valeur (weight ou actualReps) ──
  const updateLog = useCallback((key, field, val) => {
    setAllSetLogs(p => {
      const next = { ...p, [key]: { ...(p[key] || {}), [field]: val, loggedAt: new Date().toISOString() } };
      // sync incrémentale
      const { weekNumber, sessionId, exerciseIndex, setIndex } = (() => {
        const [w, sid, ei, si] = key.split("-").map(Number);
        return { weekNumber: w, sessionId: sid, exerciseIndex: ei, setIndex: si };
      })();
      pushSet({
        weekNumber, sessionId, exerciseIndex, setIndex,
        exerciseName: next[key].exerciseName,
        weight: next[key].weight,
        actualReps: next[key].actualReps,
        completed: !!allCompletedSets[key],
      });
      return next;
    });
  }, [pushSet, allCompletedSets]);

  // ── Loading / Error states ──
  if (loadError) return <ErrorScreen title="Oups..." message={loadError} onLogout={!isDemo ? onLogout : null}/>;
  if (!appData)  return <LoadingScreen text="Chargement de ton programme..."/>;

  const activeSessions = appData.sessions.filter(s => appData.week.some(w => w.sessionId === s.id));

  // ── Aujourd'hui ──
  const dayMap = { 0: "DIMANCHE", 1: "LUNDI", 2: "MARDI", 3: "MERCREDI", 4: "JEUDI", 5: "VENDREDI", 6: "SAMEDI" };
  const todayDay = dayMap[new Date().getDay()];
  const todayWeekEntry = appData.week.find(w => w.day === todayDay);
  const todaySession = todayWeekEntry ? appData.sessions.find(s => s.id === todayWeekEntry.sessionId) : null;

  // ── Contexte partagé entre toutes les pages ──
  const ctx = {
    appData, supabase, userId,
    todaySession, todayDay,
    activeSessions, activeSessionId, setActiveSessionId,
    workoutSubView, setWorkoutSubView,
    profileSubView, setProfileSubView,
    currentWeek, viewedWeek, setViewedWeek,
    allCompletedSets, allSetLogs,
    toggleSet, updateLog, timers, cancel,
    navigate,
    openWorkout: () => navigate("workout"),
    openExerciseSheet: (ex) => setSheetExercise(ex),
    weighedToday, refreshWeighedToday,
    settings, updateSetting,
    theme, setTheme,
    push,
    onLogout, isDemo, videosExercices,
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: T.text, overflowX: "hidden" }}>
      <style>{`
        /* Polices auto-hébergées : les @font-face sont déclarées dans le gabarit HTML (build.mjs) — RGPD + hors-ligne */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
        input[type=number]{-moz-appearance:textfield}
        input::placeholder{color:${T.textMuted}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:${T.surface2}}
        ::-webkit-scrollbar-thumb{background:${T.borderStrong};border-radius:2px}
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes popIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
        @keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(18px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes pageInForward{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pageInBackward{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes sheetSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes sheetFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes growUp{from{height:0;opacity:0}to{opacity:1}}
        .fade-in{animation:fadeIn .3s ease forwards}
        .pressable{transition:transform .12s cubic-bezier(0.34,1.56,0.64,1)}
        .pressable:active{transform:scale(.96)}
        .tab-bar-btn:active > div:first-child{transform:scale(0.9)!important}
        .quick-card{transition:transform .15s cubic-bezier(0.34,1.56,0.64,1), background .15s}
        .quick-card:active{transform:scale(0.985)}
        .hero-card{transition:transform .15s cubic-bezier(0.34,1.56,0.64,1)}
        .hero-card:active{transform:scale(0.99)}
        .upcoming-card{transition:transform .15s cubic-bezier(0.34,1.56,0.64,1)}
        .upcoming-card:active{transform:scale(0.97)}
        .stat-card{transition:transform .15s}
        .page-forward{animation:pageInForward .35s cubic-bezier(0.32,0.72,0.34,1) both}
        .page-backward{animation:pageInBackward .35s cubic-bezier(0.32,0.72,0.34,1) both}
        .sheet-backdrop{animation:sheetFadeIn .25s ease both}
        .sheet{animation:sheetSlideUp .38s cubic-bezier(0.32,0.72,0.34,1) both}
      `}</style>

      {/* Top mini-status bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,252,247,0.92)", backdropFilter: "blur(20px) saturate(180%)", borderBottom: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ForgeLogo size={28}/>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 13, color: T.accent, letterSpacing: 2.5 }}>FORGE COACHING</div>
        </div>
        <SyncDot status={syncStatus}/>
      </div>

      {/* Page content with transitions */}
      <div key={page + (workoutSubView || "") + (profileSubView || "")} className={pageTransition === "backward" ? "page-backward" : "page-forward"}>
        {page === "home"     && <HomePage     ctx={ctx}/>}
        {page === "workout"  && <WorkoutPage  ctx={ctx}/>}
        {page === "progress" && <ProgressPage ctx={ctx}/>}
        {page === "profile"  && <ProfilePage  ctx={ctx}/>}
        {page === "parcours" && <ParcoursPage ctx={ctx}/>}
        {page === "nutrition" && <NutritionPage ctx={ctx}/>}
      </div>

      {sheetExercise && (
        <ExerciseSheet
          exercise={sheetExercise}
          allSetLogs={allSetLogs}
          allCompletedSets={allCompletedSets}
          onClose={() => setSheetExercise(null)}
        />
      )}

      <FloatingBanner timers={timers}/>
      <BottomTabBar activePage={page} onNavigate={navigate} showNutrition={!isDemo && appData.client.offer === "premium"} weighReminder={!isDemo && appData.client.offer === "premium" && !weighedToday}/>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
//  ESPACE COACH — Helpers Supabase
// ═══════════════════════════════════════════════════════════════════════════════
const MUSCLE_OPTIONS = [
  "Triceps", "Pectoraux", "Deltoïde post", "Deltoïde lat", "Quadriceps",
  "Ischios", "Mollets", "Grand dorsal", "Haut du dos", "Biceps",
  "Fessier/Ischios", "Adducteurs",
];
const OFFER_OPTIONS = ["essentiel", "premium"];
const GOAL_OPTIONS  = ["Prise de masse", "Sèche", "Recomposition", "Maintien"];
const TECHNIQUE_OPTIONS = [
  { value: null,       label: "Aucune" },
  { value: "RP",       label: "Rest-Pause (RP)" },
  { value: "DS",       label: "Drop Set (DS)" },
  { value: "Superset", label: "Superset" },
];
const DAYS_ORDER = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"];

// Génère un code d'accès au format NOM-ANNÉE
// Convention K.1 (5 août 2026) + 2 chiffres aléatoires (6 août 2026) :
// première lettre du prénom + nom de famille + 2 chiffres, majuscules, sans accent.
// Les chiffres rendent le code impossible à deviner à partir du seul nom —
// c'est l'unique secret du compte, il ne doit pas se déduire d'un post Instagram.
// Longueur minimale d'un code d'accès. Le code EST le secret du compte :
// l'email et le mot de passe internes s'en déduisent. 8 caractères est le
// plancher retenu, aligné sur le minimum exigé par Supabase Auth.
const MIN_CODE_LENGTH = 8;

function generateAccessCode(name) {
  const parts = (name || "").trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // retire les accents : LEDÉ → LEDE
    .split(/\s+/).map(p => p.replace(/[^A-Z0-9]/g, "")).filter(Boolean);
  if (parts.length === 0) return "";
  const base = parts.length === 1 ? parts[0] : parts[0][0] + parts.slice(1).join("");
  // Au moins 2 chiffres, et assez pour garantir 8 caractères au total.
  // Un nom court (Greg Ledé → GLEDE) ne donnerait que 7 caractères avec 2 chiffres :
  // on en ajoute un troisième plutôt que de descendre sous le seuil.
  const nbChiffres = Math.max(2, MIN_CODE_LENGTH - base.length);
  let digits = "";
  for (let i = 0; i < nbChiffres; i++) digits += Math.floor(Math.random() * 10);
  return base + digits;
}

// Charge la liste des coachés du coach connecté
async function loadCoachees(supabase, coachId) {
  const { data, error } = await supabase
    .from("profiles").select("*")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Charge la bibliothèque d'exercices du coach
async function loadExerciseLibrary(supabase, coachId) {
  const { data, error } = await supabase
    .from("exercises_library").select("*")
    .eq("coach_id", coachId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Charge le programme actif d'un coaché
async function loadActiveProgram(supabase, coacheeId) {
  const { data, error } = await supabase
    .from("programs").select("*")
    .eq("coachee_id", coacheeId).eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Appelle l'Edge Function pour créer un coaché (sécurisé)
async function createCoacheeViaFunction(supabase, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expirée");
  const url = `${SUPABASE_CONFIG.url}/functions/v1/create-coachee`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": SUPABASE_CONFIG.anonKey,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || "Création échouée");
  return json.coachee;
}

// Met à jour un coaché (nom / offre / code d'accès) via l'Edge Function sécurisée
async function updateCoacheeViaFunction(supabase, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expirée");
  const url = `${SUPABASE_CONFIG.url}/functions/v1/update-coachee`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": SUPABASE_CONFIG.anonKey,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || "Mise à jour échouée");
  return json;
}

// Active un nouveau programme (désactive l'ancien, numérotation continue)
async function activateProgram(supabase, coacheeId, weekStructure, sessionsStructure, programName) {
  // 1. Récupérer le program_order max existant
  const { data: existing } = await supabase
    .from("programs").select("program_order")
    .eq("coachee_id", coacheeId)
    .order("program_order", { ascending: false })
    .limit(1).maybeSingle();
  const nextOrder = (existing?.program_order || 0) + 1;

  // 2. Désactiver tous les programmes actuels
  await supabase.from("programs")
    .update({ is_active: false })
    .eq("coachee_id", coacheeId).eq("is_active", true);

  // 3. Créer le nouveau programme actif
  const { data, error } = await supabase.from("programs").insert({
    coachee_id: coacheeId,
    name: programName || `Programme ${nextOrder}`,
    week_structure: weekStructure,
    sessions_structure: sessionsStructure,
    is_active: true,
    program_order: nextOrder,
  }).select().single();
  if (error) throw error;
  return data;
}

// Enregistre un brouillon (programme non actif) — ou met à jour le brouillon existant
async function saveProgramDraft(supabase, coacheeId, weekStructure, sessionsStructure, programName, draftId) {
  if (draftId) {
    const { data, error } = await supabase.from("programs")
      .update({
        name: programName, week_structure: weekStructure,
        sessions_structure: sessionsStructure,
      })
      .eq("id", draftId).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("programs").insert({
    coachee_id: coacheeId,
    name: programName || "Brouillon",
    week_structure: weekStructure,
    sessions_structure: sessionsStructure,
    is_active: false,
    program_order: 0,
  }).select().single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ESPACE COACH — Composants UI
// ═══════════════════════════════════════════════════════════════════════════════

// Petit champ de formulaire réutilisable
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: T.textMuted, letterSpacing: 1.2, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = {
  width: "100%", padding: "12px 14px", background: T.bg,
  border: `1.5px solid ${T.borderStrong}`, borderRadius: 10,
  fontSize: 15, color: T.text, outline: "none", fontFamily: "inherit",
};

// Badge d'offre
function OfferBadge({ offer }) {
  const isPrem = offer === "premium";
  return (
    <span style={{ background: isPrem ? T.warnBg : T.accentLight, color: isPrem ? T.warnText : T.accent, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 800, letterSpacing: .5 }}>
      {isPrem ? "PREMIUM" : "ESSENTIEL"}
    </span>
  );
}

// ── Espace coach : LOGIN coach (email + mot de passe) ──
function CoachLoginScreen({ onBack, onAuthSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password || loading) return;
    setLoading(true); setError("");
    try {
      const supabase = await getSupabase();
      if (!supabase) throw new Error("Configuration Supabase manquante");
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      });
      if (authError) throw new Error("Email ou mot de passe incorrect");
      onAuthSuccess();
    } catch (e) {
      setError(e.message || "Erreur de connexion");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at top, ${T.surface2} 0%, ${T.bg} 60%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 22px", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 20, animation: "fadeUp .5s ease both" }}><ForgeLogo size={72}/></div>
      <div style={{ textAlign: "center", marginBottom: 30, animation: "fadeUp .5s ease .1s both" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, letterSpacing: 4, color: T.text, lineHeight: 1 }}>ESPACE COACH</div>
        <div style={{ fontSize: 12, color: T.textSub, marginTop: 8 }}>Connexion à ton poste de pilotage</div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "26px 22px", width: "100%", maxWidth: 380, boxShadow: `0 14px 50px ${T.shadow}`, animation: "fadeUp .5s ease .2s both" }}>
        <Field label="EMAIL">
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
            placeholder="coach@forge.app" autoCapitalize="none" autoComplete="email" spellCheck={false}
            style={{ ...inputStyle, borderColor: error ? T.danger : T.borderStrong }}/>
        </Field>
        <Field label="MOT DE PASSE">
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="••••••••" autoComplete="current-password"
            style={{ ...inputStyle, borderColor: error ? T.danger : T.borderStrong }}/>
        </Field>
        <div style={{ minHeight: 20, textAlign: "center" }}>
          {error && <div style={{ fontSize: 11, color: T.danger, fontWeight: 600 }}>{error}</div>}
        </div>
        <button onClick={handleSubmit} disabled={loading || !email.trim() || !password}
          style={{ width: "100%", marginTop: 6, padding: "14px 20px",
            background: loading || !email.trim() || !password ? T.surface2 : `linear-gradient(135deg, #064E3B 0%, #0D9488 100%)`,
            color: loading || !email.trim() || !password ? T.textMuted : "white",
            border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1.2,
            cursor: loading || !email.trim() || !password ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading ? (<><Spinner size={15} color={T.textMuted}/> CONNEXION...</>) : "SE CONNECTER"}
        </button>
      </div>
      <button onClick={onBack} style={{ marginTop: 24, background: "transparent", border: "none", color: T.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, animation: "fadeUp .5s ease .3s both" }}>
        <Icon name="chevronLeft" size={14}/> Retour à l'espace coaché
      </button>
    </div>
  );
}

// ── Modale de création d'un coaché ──
function NewCoacheeModal({ supabase, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState(GOAL_OPTIONS[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [offer, setOffer] = useState("essentiel");
  const [code, setCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // Auto-génère le code depuis le nom tant que l'utilisateur ne l'a pas édité
  useEffect(() => {
    if (!codeEdited) setCode(generateAccessCode(name));
  }, [name, codeEdited]);

  async function handleCreate() {
    if (!name.trim() || !code.trim() || loading) return;
    setLoading(true); setError("");
    try {
      const coachee = await createCoacheeViaFunction(supabase, {
        name: name.trim(), accessCode: code.trim().toUpperCase(),
        goal, startDate, offer,
      });
      setResult(coachee);
      onCreated();
    } catch (e) {
      setError(e.message || "Erreur lors de la création");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 300 }}/>
      <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301, background: T.bg, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 50px rgba(30,40,32,0.25)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "10px auto 12px", flexShrink: 0 }}/>

        {result ? (
          // Écran de succès : affiche le code à communiquer
          <div style={{ textAlign: "center", padding: "10px 18px 24px" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Icon name="check" size={28} color={T.accent} stroke={3}/>
            </div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: T.text, letterSpacing: 2 }}>COACHÉ CRÉÉ</div>
            <div style={{ fontSize: 13, color: T.textSub, marginTop: 6, marginBottom: 20 }}>Communique ce code d'accès à {result.name} :</div>
            <div style={{ background: T.surface, border: `2px dashed ${T.accent}`, borderRadius: 14, padding: "18px", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: T.accent, letterSpacing: 4 }}>{result.accessCode}</div>
            </div>
            <button onClick={onClose} style={{ width: "100%", padding: "14px", background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: "pointer" }}>
              TERMINÉ
            </button>
          </div>
        ) : (
          <>
            <div style={{ overflowY: "auto", padding: "0 18px", flex: "0 1 auto", minHeight: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: T.text, letterSpacing: 2, marginBottom: 18 }}>NOUVEAU COACHÉ</div>
              <Field label="NOM">
                <input type="text" value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="Ex : Marie Dupont" style={inputStyle}/>
              </Field>
              <Field label="OBJECTIF">
                <select value={goal} onChange={e => setGoal(e.target.value)} style={inputStyle}>
                  {GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="DATE DE DÉBUT">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, WebkitAppearance: "none", appearance: "none", minWidth: 0, maxWidth: "100%", display: "block" }}/>
              </Field>
              <Field label="OFFRE">
                <div style={{ display: "flex", gap: 8 }}>
                  {OFFER_OPTIONS.map(o => (
                    <button key={o} onClick={() => setOffer(o)} style={{ flex: 1, padding: "12px", background: offer === o ? T.accent : T.surface, color: offer === o ? "white" : T.textSub, border: `1.5px solid ${offer === o ? T.accent : T.border}`, borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: .5, cursor: "pointer", textTransform: "uppercase" }}>
                      {o}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="CODE D'ACCÈS (généré automatiquement)">
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setCodeEdited(true); setError(""); }} style={{ ...inputStyle, fontWeight: 700, letterSpacing: 1 }}/>
                  <button onClick={() => { setCodeEdited(false); setCode(generateAccessCode(name)); }} title="Régénérer" style={{ flexShrink: 0, padding: "0 14px", background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 10, cursor: "pointer", fontSize: 16 }}>↻</button>
                </div>
              </Field>
              <div style={{ minHeight: 20, textAlign: "center" }}>
                {error && <div style={{ fontSize: 11, color: T.danger, fontWeight: 600 }}>{error}</div>}
              </div>
            </div>
            <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "12px 18px calc(18px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, background: T.bg }}>
              <button onClick={onClose} style={{ flex: 1, padding: "14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, color: T.textSub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
              <button onClick={handleCreate} disabled={loading || !name.trim() || !code.trim()}
                style={{ flex: 2, padding: "14px", background: loading || !name.trim() ? T.surface2 : `linear-gradient(135deg, #064E3B, #0D9488)`, color: loading || !name.trim() ? T.textMuted : "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: loading || !name.trim() ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading ? (<><Spinner size={14} color={T.textMuted}/> CRÉATION...</>) : "CRÉER LE COACHÉ"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUPERVISION DES ERREURS
//
//  Jusqu'ici, quand l'app plantait chez un coaché, il voyait un écran d'excuse
//  et Greg n'en savait rien — sauf si le coaché pensait à le dire. Désormais le
//  rapport part en base et l'espace coach l'affiche.
//
//  CE QUI PART, ET RIEN D'AUTRE : le message, le début de la pile d'appels, le
//  navigateur, la version du build et la page. AUCUNE donnée de coaché — pas de
//  charge, pas de reps, pas de bilan. Un rapport d'erreur sert à réparer, pas à
//  observer les gens.
//
//  PAS DE SERVICE EXTERNE. Un Sentry enverrait tout ça chez un tiers et
//  ajouterait une dépendance dans le chemin le plus fragile de l'app. Une table
//  fait le même travail sans rien envoyer nulle part.
// ═══════════════════════════════════════════════════════════════════════════════

// La version du build, lue depuis le nom du cache posé par le service worker.
// Relevée une fois au démarrage pour être disponible immédiatement le jour où
// une erreur survient — on ne veut pas d'un await dans un gestionnaire d'erreur.
let versionApp = "inconnue";
(async () => {
  try {
    const noms = await caches.keys();
    const n = noms.find(x => x.startsWith("forge-coaching-"));
    if (n) versionApp = n.slice("forge-coaching-".length);
  } catch { /* pas de service worker : tant pis, la version restera inconnue */ }
})();

// Un plantage en boucle ne doit pas inonder la table : un même message n'est
// signalé qu'une fois par session de navigation.
const erreursDejaSignalees = new Set();

// Qui est connecté, pour l'attacher au rapport. L'ErrorBoundary vit au-dessus
// de la session dans l'arbre React : plutôt que de faire redescendre l'état à
// travers un composant de classe, la racine tient cette référence à jour.
const contexteRapport = { supabase: null, userId: null, role: null };

async function signalerErreur(supabase, userId, role, error) {
  try {
    if (!supabase || !userId) return;
    const message = String(error?.message || error || "Erreur inconnue").slice(0, 500);
    if (erreursDejaSignalees.has(message)) return;
    erreursDejaSignalees.add(message);

    await supabase.from("error_reports").insert({
      user_id: userId,
      role: role || null,
      message,
      // Les premières lignes suffisent à situer le problème, et évitent
      // d'enregistrer des piles de plusieurs kilo-octets.
      stack: String(error?.stack || "").split("\n").slice(0, 8).join("\n").slice(0, 2000) || null,
      user_agent: (navigator.userAgent || "").slice(0, 300),
      app_version: versionApp,
      // Le chemin seul, jamais les paramètres : ils peuvent porter n'importe quoi.
      page: (location.pathname || "").slice(0, 200),
    });
  } catch { /* signaler une erreur ne doit jamais en provoquer une autre */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SAUVEGARDE — exporter toutes les données du coach dans un fichier
//
//  POURQUOI CETTE FONCTION EXISTE. Le plan gratuit de Supabase ne fait AUCUNE
//  sauvegarde automatique, et sa documentation recommande explicitement aux
//  projets gratuits d'exporter régulièrement leurs données. Perdre l'historique
//  d'un client qui paie ne se rattrape ni techniquement, ni commercialement.
//
//  L'export tourne entièrement côté client, avec la session du coach : la RLS
//  lui donne accès à ses coachés et à rien d'autre. Aucune clé service_role
//  n'intervient, aucune Edge Function — donc aucune surface nouvelle.
//
//  LES CODES D'ACCÈS NE SONT PAS EXPORTÉS. C'est la règle de la Partie K du
//  CLAUDE.md : « un code ne se note ni dans le dépôt, ni dans une conversation,
//  ni dans un fichier ». Un code est l'unique secret d'un compte — l'email et le
//  mot de passe internes s'en déduisent. Un fichier de sauvegarde traîne dans un
//  dossier Téléchargements, se copie sur une clé USB, part par mail : ce n'est
//  pas un endroit pour des identifiants de connexion.
//  Conséquence à connaître : restaurer suppose de recréer les comptes depuis
//  l'espace coach, qui réémettra de nouveaux codes. C'est de toute façon le seul
//  chemin légitime (Partie K).
// ═══════════════════════════════════════════════════════════════════════════════

// Tables rattachées aux coachés, exportées via leur coachee_id.
const SAUVEGARDE_TABLES_COACHES = [
  "programs", "weeks", "sets_logged", "weight_logs",
  "nutrition_profiles", "meal_plans", "periodization_phases",
  "weekly_reviews", "session_notes", "diet_plans", "diet_consents",
];
// Tables qui appartiennent au coach lui-même.
// `foods` n'exporte que les aliments PERSO du coach : la base commune vient de
// la table Ciqual de l'ANSES, elle se retélécharge, il serait absurde de la
// recopier dans chaque sauvegarde.
const SAUVEGARDE_TABLES_COACH = ["exercises_library", "recipes_library", "foods"];

// push_subscriptions et push_config sont volontairement absentes : la première
// ne contient que des secrets d'appareils, sans valeur une fois restaurés ;
// la seconde porte la clé privée VAPID, que personne ne doit jamais manipuler.

async function construireSauvegarde(supabase, coachId, coachees) {
  const ids = coachees.map(c => c.id);
  const donnees = {};

  // Les profils, débarrassés du code d'accès.
  donnees.profiles = coachees.map(({ access_code, ...reste }) => reste);

  for (const table of SAUVEGARDE_TABLES_COACHES) {
    if (ids.length === 0) { donnees[table] = []; continue; }
    const { data, error } = await supabase.from(table).select("*").in("coachee_id", ids);
    // Une table absente (migration pas jouée) ne doit pas faire échouer toute
    // la sauvegarde : on note l'incident et on continue.
    donnees[table] = error ? { _erreur: error.message, lignes: [] } : (data || []);
  }
  for (const table of SAUVEGARDE_TABLES_COACH) {
    const { data, error } = await supabase.from(table).select("*").eq("coach_id", coachId);
    donnees[table] = error ? { _erreur: error.message, lignes: [] } : (data || []);
  }

  // Les repas et leurs aliments pendent d'un plan, pas d'un coaché : ils ne
  // passent donc pas par la boucle ci-dessus. Sans eux la sauvegarde
  // contiendrait des diètes vides, ce qui serait pire que pas de diète du tout.
  try {
    const plans = Array.isArray(donnees.diet_plans) ? donnees.diet_plans : [];
    const planIds = plans.map(p => p.id);
    if (planIds.length) {
      const { data: repas, error: eR } = await supabase.from("diet_meals").select("*").in("plan_id", planIds);
      if (eR) throw eR;
      donnees.diet_meals = repas || [];
      const repasIds = (repas || []).map(r => r.id);
      if (repasIds.length) {
        const { data: items, error: eI } = await supabase.from("diet_items").select("*").in("meal_id", repasIds);
        if (eI) throw eI;
        donnees.diet_items = items || [];
      } else donnees.diet_items = [];
    } else { donnees.diet_meals = []; donnees.diet_items = []; }
  } catch (e) {
    donnees.diet_meals = { _erreur: e.message, lignes: [] };
    donnees.diet_items = { _erreur: e.message, lignes: [] };
  }

  const compter = (v) => Array.isArray(v) ? v.length : 0;
  return {
    _forge_coaching: {
      version: 1,
      exporte_le: new Date().toISOString(),
      coach_id: coachId,
      avertissement:
        "Les codes d'accès ne figurent PAS dans ce fichier, volontairement : " +
        "un code est l'unique secret d'un compte coaché. Restaurer suppose de " +
        "recréer les comptes depuis l'espace coach, qui émettra de nouveaux codes.",
      contenu: Object.fromEntries(Object.entries(donnees).map(([k, v]) => [k, compter(v)])),
    },
    donnees,
  };
}

// Déclenche le téléchargement du fichier. Renvoie false si le navigateur ne
// l'a pas permis — sur iPhone hors écran d'accueil, notamment.
function telechargerJSON(nomFichier, objet) {
  try {
    const blob = new Blob([JSON.stringify(objet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // On libère l'URL après coup : la révoquer immédiatement annulerait le
    // téléchargement sur certains navigateurs.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  } catch { return false; }
}

const CLE_DERNIERE_SAUVEGARDE = "forge_derniere_sauvegarde";

// ── Carte « Sauvegarde » en bas de la liste des coachés ─────────────────────
function CoachBackupCard({ ctx }) {
  const { supabase, coachId, coachees } = ctx;
  const [occupe, setOccupe] = useState(false);
  const [retour, setRetour] = useState(null);   // { ok, message }
  const [derniere, setDerniere] = useState(() => {
    try { return localStorage.getItem(CLE_DERNIERE_SAUVEGARDE); } catch { return null; }
  });

  async function exporter() {
    setOccupe(true); setRetour(null);
    try {
      const sauvegarde = await construireSauvegarde(supabase, coachId, coachees);
      const jour = new Date().toISOString().slice(0, 10);
      const ok = telechargerJSON(`forge-coaching-sauvegarde-${jour}.json`, sauvegarde);
      if (!ok) throw new Error("Ton navigateur a refusé le téléchargement. Réessaie depuis un ordinateur.");

      const total = Object.values(sauvegarde._forge_coaching.contenu).reduce((a, b) => a + b, 0);
      const incomplet = Object.values(sauvegarde.donnees).some(v => v && v._erreur);
      const maintenant = new Date().toISOString();
      try { localStorage.setItem(CLE_DERNIERE_SAUVEGARDE, maintenant); } catch {}
      setDerniere(maintenant);
      setRetour({ ok: !incomplet, message: incomplet
        ? `${total} lignes exportées, mais certaines tables n'ont pas pu être lues.`
        : `${total} lignes exportées. Range le fichier en lieu sûr.` });
    } catch (e) {
      setRetour({ ok: false, message: e?.message || "Export impossible" });
    } finally { setOccupe(false); }
  }

  const jours = derniere
    ? Math.floor((Date.now() - new Date(derniere).getTime()) / 86400000) : null;
  const ancienne = jours === null || jours >= 30;

  return (
    <div style={{ padding: "22px 18px 0" }}>
      <div style={{ background: T.surface, border: `1px solid ${ancienne ? T.warnBorder : T.border}`, borderRadius: 14, padding: "15px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 16, color: T.text, letterSpacing: 1.5 }}>SAUVEGARDE</div>
          {derniere && (
            <span style={{ fontSize: 9.5, color: ancienne ? T.warnText : T.textMuted, fontWeight: 700 }}>
              {jours === 0 ? "Aujourd'hui" : jours === 1 ? "Hier" : `Il y a ${jours} jours`}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: T.textMuted, lineHeight: 1.5, marginBottom: 11 }}>
          {derniere
            ? "Télécharge une copie de tes données : coachés, programmes, séries loguées, pesées, bilans."
            : "Supabase ne sauvegarde rien sur le plan gratuit. Télécharge une copie de tes données et range-la en lieu sûr."}
        </div>

        <button onClick={exporter} disabled={occupe} className="pressable"
          style={{ width: "100%", padding: "12px", background: occupe ? T.surface2 : T.bg, border: `1.5px solid ${occupe ? T.border : T.borderStrong}`, borderRadius: 11, color: occupe ? T.textMuted : T.textSub, fontSize: 11, fontWeight: 800, letterSpacing: .8, cursor: occupe ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {occupe ? (<><Spinner size={13} color={T.textMuted}/> EXPORT EN COURS...</>) : "TÉLÉCHARGER MES DONNÉES"}
        </button>

        {retour && (
          <div style={{ fontSize: 10.5, color: retour.ok ? T.accent : T.danger, marginTop: 9, lineHeight: 1.5, fontWeight: 600 }}>
            {retour.message}
          </div>
        )}

        <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 10, lineHeight: 1.5, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
          Les codes d'accès n'y figurent pas : un code est l'unique secret d'un compte,
          il n'a rien à faire dans un fichier.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUIVI D'ASSIDUITÉ — qui s'entraîne, qui décroche
//
//  Aucune table nouvelle : tout se déduit de sets_logged, qui existe depuis le
//  début. Une séance est comptée comme FAITE dès qu'au moins une série y a été
//  validée — pas besoin qu'elle soit terminée. Un coaché qui commence puis
//  s'arrête s'est quand même entraîné ce jour-là.
//
//  POURQUOI ON BORNE À 8 SEMAINES : la requête ramène les séries de tous les
//  coachés d'un coup. Sans borne, elle grossirait indéfiniment avec l'ancienneté
//  du coaching — 673 séries aujourd'hui, des dizaines de milliers dans deux ans,
//  pour un écran qui ne parle que du comportement récent.
// ═══════════════════════════════════════════════════════════════════════════════
const SUIVI_SEMAINES = 8;          // profondeur d'historique chargée
const SUIVI_FENETRE  = 4;          // sur combien de semaines on calcule le taux

async function loadAssiduite(supabase, coachees) {
  const ids = coachees.map(c => c.id);
  if (ids.length === 0) return {};

  const depuis = new Date();
  depuis.setDate(depuis.getDate() - SUIVI_SEMAINES * 7);

  const [{ data: series }, { data: programmes }] = await Promise.all([
    supabase.from("sets_logged")
      .select("coachee_id, session_config_id, logged_at, week:week_id(week_number)")
      .in("coachee_id", ids).eq("completed", true)
      .gte("logged_at", depuis.toISOString()),
    supabase.from("programs")
      .select("coachee_id, week_structure")
      .in("coachee_id", ids).eq("is_active", true),
  ]);

  // Nombre de séances prévues par semaine, coaché par coaché
  const prevues = {};
  (programmes || []).forEach(p => {
    prevues[p.coachee_id] = (p.week_structure || []).filter(j => j.sessionId != null).length;
  });

  // Séances distinctes réalisées, par coaché et par semaine
  const faites = {};       // { coacheeId: { numSemaine: Set(sessionId) } }
  const derniere = {};     // { coacheeId: date la plus récente }
  (series || []).forEach(s => {
    const num = s.week?.week_number;
    if (!num) return;
    ((faites[s.coachee_id] ||= {})[num] ||= new Set()).add(s.session_config_id);
    const d = s.logged_at;
    if (d && (!derniere[s.coachee_id] || d > derniere[s.coachee_id])) derniere[s.coachee_id] = d;
  });

  const resultat = {};
  for (const c of coachees) {
    const semaineEnCours = currentWeekFromDate(c.created_at);
    const parSemaine = faites[c.id] || {};
    const attenduParSemaine = prevues[c.id] || 0;

    // Taux sur les semaines ÉCOULÉES uniquement : compter la semaine en cours
    // pénaliserait un coaché un lundi matin, alors qu'il n'a encore rien raté.
    let realisees = 0, attendues = 0;
    for (let n = Math.max(1, semaineEnCours - SUIVI_FENETRE); n < semaineEnCours; n++) {
      realisees += (parSemaine[n]?.size || 0);
      attendues += attenduParSemaine;
    }

    const dernier = derniere[c.id] ? new Date(derniere[c.id]) : null;
    const joursDepuis = dernier
      ? Math.floor((Date.now() - dernier.getTime()) / 86400000)
      : null;

    resultat[c.id] = {
      semaineEnCours,
      faitesCetteSemaine: parSemaine[semaineEnCours]?.size || 0,
      prevuesParSemaine: attenduParSemaine,
      taux: attendues > 0 ? Math.round((realisees / attendues) * 100) : null,
      joursDepuis,
      jamaisEntraine: dernier === null,
      statut: statutAssiduite(joursDepuis, attenduParSemaine),
    };
  }
  return resultat;
}

// Trois états, choisis pour être actionnables : un coach veut savoir qui
// relancer aujourd'hui, pas contempler un pourcentage.
function statutAssiduite(joursDepuis, prevuesParSemaine) {
  if (prevuesParSemaine === 0) return "sans_programme";
  if (joursDepuis === null) return "jamais";
  if (joursDepuis <= 4) return "a_jour";
  if (joursDepuis <= 9) return "a_relancer";
  return "decrochage";
}

const STATUTS = {
  a_jour:         { label: "À jour",        bg: "var(--cmp-up-bg)",   tx: "var(--cmp-up-text)",   ordre: 3 },
  a_relancer:     { label: "À relancer",    bg: "var(--warn-bg)",     tx: "var(--warn-text)",     ordre: 1 },
  decrochage:     { label: "Décrochage",    bg: "var(--cmp-down-bg)", tx: "var(--cmp-down-text)", ordre: 0 },
  jamais:         { label: "Jamais démarré",bg: "var(--surface2)",    tx: "var(--text-sub)",      ordre: 2 },
  sans_programme: { label: "Sans programme",bg: "var(--surface2)",    tx: "var(--text-muted)",    ordre: 4 },
};

// ── Panneau des erreurs récentes, en bas de l'onglet Suivi ─────────────────
function CoachErreursCard({ ctx }) {
  const { supabase, coachees } = ctx;
  const { confirm, confirmUI } = useConfirm();
  const [erreurs, setErreurs] = useState(null);
  const [dispo, setDispo]     = useState(true);

  const recharger = useCallback(async () => {
    const { data, error } = await supabase
      .from("error_reports").select("*")
      .order("created_at", { ascending: false }).limit(20);
    if (error) { setDispo(!tableAbsente(error)); setErreurs([]); return; }
    setErreurs(data || []);
  }, [supabase]);

  useEffect(() => { recharger(); }, [recharger]);

  async function effacer() {
    if (!(await confirm({ title: "EFFACER LES RAPPORTS",
      message: `Les ${erreurs.length} rapports affichés seront supprimés. Les données des coachés ne sont pas touchées.`,
      confirmLabel: "Effacer", danger: true }))) return;
    await supabase.from("error_reports").delete().in("id", erreurs.map(e => e.id));
    await recharger();
  }

  // Rien à signaler : on n'affiche rien du tout. Un panneau vide en permanence
  // finit par ne plus être lu, et c'est précisément celui-là qu'il faut voir.
  if (!dispo || erreurs === null || erreurs.length === 0) return null;

  const nomDe = (id) => coachees.find(c => c.id === id)?.name || "Toi";

  return (
    <div style={{ padding: "22px 18px 0" }}>
      {confirmUI}
      <div style={{ background: T.surface, border: `1px solid ${T.warnBorder}`, borderRadius: 14, padding: "15px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 16, color: T.text, letterSpacing: 1.5 }}>
            {erreurs.length} PLANTAGE{erreurs.length > 1 ? "S" : ""}
          </div>
          <button onClick={effacer} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
            Effacer
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: T.textMuted, lineHeight: 1.5, marginBottom: 11 }}>
          L'app a affiché un écran d'erreur à quelqu'un. Transmets-moi ça.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {erreurs.map(e => (
            <div key={e.id} style={{ background: T.bg, borderRadius: 9, padding: "9px 11px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 9.5, color: T.textSub, fontWeight: 800, letterSpacing: .5 }}>
                  {nomDe(e.user_id).toUpperCase()}
                </span>
                <span style={{ fontSize: 9, color: T.textMuted, flexShrink: 0 }}>
                  {new Date(e.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: T.text, lineHeight: 1.45, wordBreak: "break-word" }}>{e.message}</div>
              <div style={{ fontSize: 9, color: T.textMuted, marginTop: 4 }}>
                version {e.app_version || "inconnue"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page coach : SUIVI ──
function CoachFollowUpPage({ ctx }) {
  const { supabase, coachees, openCoachee } = ctx;
  const [assiduite, setAssiduite] = useState(null);
  const [erreur, setErreur] = useState("");

  const actifs = useMemo(() => coachees.filter(c => c.is_active !== false), [coachees]);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const a = await loadAssiduite(supabase, actifs);
        if (!annule) setAssiduite(a);
      } catch (e) {
        if (!annule) setErreur(e?.message || "Chargement impossible");
      }
    })();
    return () => { annule = true; };
  }, [supabase, actifs]);

  if (erreur) return (
    <div style={{ padding: "40px 24px", textAlign: "center", color: T.textMuted, fontSize: 13, lineHeight: 1.6 }}>
      {erreur}
    </div>
  );
  if (!assiduite) return <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24}/></div>;

  const triés = [...actifs].sort((a, b) => {
    const sa = STATUTS[assiduite[a.id]?.statut] || STATUTS.sans_programme;
    const sb = STATUTS[assiduite[b.id]?.statut] || STATUTS.sans_programme;
    if (sa.ordre !== sb.ordre) return sa.ordre - sb.ordre;
    return (b.id === a.id ? 0 : (assiduite[b.id]?.joursDepuis || 0) - (assiduite[a.id]?.joursDepuis || 0));
  });

  const compte = (s) => actifs.filter(c => assiduite[c.id]?.statut === s).length;
  const aRelancer = compte("a_relancer") + compte("decrochage");

  return (
    <div style={{ paddingBottom: 100 }} className="fade-in">
      <div style={{ padding: "22px 18px 14px" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: T.text, letterSpacing: 3, lineHeight: 1 }}>SUIVI</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 5 }}>
          {aRelancer === 0
            ? "Tout le monde est à jour."
            : `${aRelancer} coaché${aRelancer > 1 ? "s" : ""} à relancer`}
        </div>
      </div>

      <div style={{ padding: "0 18px 14px", display: "flex", gap: 8 }}>
        {[["decrochage", "DÉCROCHAGE"], ["a_relancer", "À RELANCER"], ["a_jour", "À JOUR"]].map(([id, label]) => {
          const s = STATUTS[id];
          const n = compte(id);
          return (
            <div key={id} style={{ flex: 1, background: n > 0 ? s.bg : T.surface, border: `1px solid ${n > 0 ? "transparent" : T.border}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: n > 0 ? s.tx : T.textMuted, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 8, color: n > 0 ? s.tx : T.textMuted, letterSpacing: .8, fontWeight: 800, marginTop: 4 }}>{label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {triés.length === 0 && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "30px 20px", textAlign: "center", color: T.textMuted, fontSize: 13 }}>
            Aucun coaché actif à suivre.
          </div>
        )}
        {triés.map((c, i) => {
          const a = assiduite[c.id] || {};
          const s = STATUTS[a.statut] || STATUTS.sans_programme;
          const pct = a.prevuesParSemaine > 0
            ? Math.min(100, Math.round((a.faitesCetteSemaine / a.prevuesParSemaine) * 100)) : 0;
          return (
            <div key={c.id} onClick={() => openCoachee(c)} className="quick-card"
              style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 15px", cursor: "pointer", animation: `fadeUp .35s ease ${i * 0.05}s both` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{c.name}</div>
                  <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 3 }}>
                    {a.jamaisEntraine ? "Aucune séance enregistrée"
                     : a.joursDepuis === 0 ? "Dernière séance aujourd'hui"
                     : a.joursDepuis === 1 ? "Dernière séance hier"
                     : `Dernière séance il y a ${a.joursDepuis} jours`}
                  </div>
                </div>
                <span style={{ background: s.bg, color: s.tx, fontSize: 9, padding: "3px 9px", borderRadius: 20, fontWeight: 800, letterSpacing: .3, flexShrink: 0 }}>
                  {s.label}
                </span>
              </div>

              {a.prevuesParSemaine > 0 && (
                <div style={{ marginTop: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 9.5, color: T.textMuted, fontWeight: 700, letterSpacing: .5 }}>
                      SEMAINE {a.semaineEnCours} · {a.faitesCetteSemaine}/{a.prevuesParSemaine} SÉANCES
                    </span>
                    {a.taux !== null && (
                      <span style={{ fontSize: 9.5, color: T.textMuted, fontWeight: 700, letterSpacing: .5 }}>
                        {a.taux}% SUR {SUIVI_FENETRE} SEM.
                      </span>
                    )}
                  </div>
                  <div style={{ height: 6, background: T.surface2, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? T.accent : s.tx, borderRadius: 3, transition: "width .4s ease" }}/>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <CoachErreursCard ctx={ctx}/>
    </div>
  );
}

// ── Page : liste des coachés ──
function CoachListPage({ ctx }) {
  const { coachees, openCoachee, setShowNewModal } = ctx;
  const [filter, setFilter] = useState("actifs"); // actifs | inactifs

  const filtered = coachees.filter(c => filter === "actifs" ? c.is_active !== false : c.is_active === false);

  return (
    <div style={{ paddingBottom: 100 }} className="fade-in">
      <div style={{ padding: "22px 18px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: T.text, letterSpacing: 3, lineHeight: 1 }}>MES COACHÉS</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 5 }}>{filtered.length} {filter === "actifs" ? "actif" : "inactif"}{filtered.length > 1 ? "s" : ""}</div>
        </div>
        <button onClick={() => setShowNewModal(true)} className="pressable" style={{ background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 12, padding: "10px 14px", fontSize: 11, fontWeight: 800, letterSpacing: .5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: `0 4px 14px rgba(13,148,136,0.3)` }}>
          + NOUVEAU
        </button>
      </div>

      <div style={{ padding: "0 18px 14px", display: "flex", gap: 8 }}>
        {["actifs", "inactifs"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", background: filter === f ? T.accent : T.surface, color: filter === f ? "white" : T.textSub, border: `1px solid ${filter === f ? T.accent : T.border}`, borderRadius: 16, fontSize: 11, fontWeight: 700, letterSpacing: .5, cursor: "pointer", textTransform: "capitalize" }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "30px 20px", textAlign: "center", color: T.textMuted, fontSize: 13 }}>
            {filter === "actifs" ? "Aucun coaché actif. Crée ton premier coaché avec le bouton + Nouveau." : "Aucun coaché inactif."}
          </div>
        ) : filtered.map((c, i) => (
          <div key={c.id} onClick={() => openCoachee(c)} className="quick-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", animation: `fadeUp .35s ease ${i * 0.05}s both` }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, #064E3B, #2DD4BF)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: 20, color: "white" }}>
              {(c.name || "?")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>{c.name}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <OfferBadge offer={c.offer}/>
                <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>{c.access_code}</span>
              </div>
            </div>
            <Icon name="chevronRight" size={20} color={T.borderStrong}/>
          </div>
        ))}
      </div>

      <CoachBackupCard ctx={ctx}/>
    </div>
  );
}

// ── Page : bibliothèque d'exercices ──
function CoachLibraryPage({ ctx }) {
  const { supabase, coachId, library, reloadLibrary } = ctx;
  const { confirm, confirmUI } = useConfirm();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | {} (new) | exercise (edit)
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState(MUSCLE_OPTIONS[0]);
  const [notes, setNotes] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openEditor(ex) {
    setEditing(ex || {});
    setName(ex?.name || "");
    setMuscle(ex?.muscle || MUSCLE_OPTIONS[0]);
    setNotes(ex?.notes || "");
    setVideoUrl(ex?.video_url || "");
    setError("");
  }

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true); setError("");
    try {
      if (editing.id) {
        const { error } = await supabase.from("exercises_library")
          .update({ name: name.trim(), muscle, notes: notes.trim() || null, video_url: videoUrl.trim() || null })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("exercises_library")
          .insert({ coach_id: coachId, name: name.trim(), muscle, notes: notes.trim() || null, video_url: videoUrl.trim() || null });
        if (error) throw error.code === "23505" ? new Error("Un exercice avec ce nom existe déjà") : error;
      }
      await reloadLibrary();
      setEditing(null);
    } catch (e) {
      setError(e.message || "Erreur");
      setSaving(false);
    }
  }

  async function handleDelete(ex) {
    if (!(await confirm({ title: "SUPPRIMER L'EXERCICE", message: `"${ex.name}" sera retiré de ta bibliothèque.`, confirmLabel: "Supprimer", danger: true }))) return;
    await supabase.from("exercises_library").delete().eq("id", ex.id);
    await reloadLibrary();
  }

  const filtered = library.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  const grouped = {};
  filtered.forEach(e => { (grouped[e.muscle] = grouped[e.muscle] || []).push(e); });

  return (
    <>
    <div style={{ paddingBottom: 100 }} className="fade-in">
      <div style={{ padding: "22px 18px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {confirmUI}
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: T.text, letterSpacing: 3, lineHeight: 1 }}>BIBLIOTHÈQUE</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 5 }}>{library.length} exercices</div>
        </div>
        <button onClick={() => openEditor(null)} className="pressable" style={{ background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 12, padding: "10px 14px", fontSize: 11, fontWeight: 800, letterSpacing: .5, cursor: "pointer", boxShadow: `0 4px 14px rgba(13,148,136,0.3)` }}>
          + AJOUTER
        </button>
      </div>

      <div style={{ padding: "0 18px 14px" }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un exercice..." style={inputStyle}/>
      </div>

      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {Object.keys(grouped).length === 0 ? (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "30px 20px", textAlign: "center", color: T.textMuted, fontSize: 13 }}>
            Aucun exercice trouvé.
          </div>
        ) : Object.entries(grouped).map(([m, exs]) => {
          const mStyle = muscleColors[m] || { bg: T.surface2, text: T.textSub };
          return (
            <div key={m}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ background: mStyle.bg, color: mStyle.text, fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 800 }}>{m}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {exs.map(ex => (
                  <div key={ex.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ex.name}</div>
                        {ex.video_url && <Icon name="play" size={13} color={T.accent}/>}
                      </div>
                      {ex.notes && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{ex.notes}</div>}
                    </div>
                    <button onClick={() => openEditor(ex)} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, color: T.textSub, cursor: "pointer", fontWeight: 600 }}>Modifier</button>
                    <button onClick={() => handleDelete(ex)} style={{ background: "transparent", border: "none", color: T.danger, cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>

      {editing && (
        <>
          <div className="sheet-backdrop" onClick={() => setEditing(null)} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 300 }}/>
          <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301, background: T.bg, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 50px rgba(30,40,32,0.25)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "10px auto 12px", flexShrink: 0 }}/>
            <div style={{ overflowY: "auto", padding: "0 18px", flex: "0 1 auto", minHeight: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: T.text, letterSpacing: 2, marginBottom: 18 }}>{editing.id ? "MODIFIER L'EXERCICE" : "NOUVEL EXERCICE"}</div>
              <Field label="NOM DE L'EXERCICE">
                <input type="text" value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="Ex : Développé couché" style={inputStyle}/>
              </Field>
              <Field label="MUSCLE">
                <select value={muscle} onChange={e => setMuscle(e.target.value)} style={inputStyle}>
                  {MUSCLE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="NOTES (optionnel)">
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex : CUFF, sangle de tirage..." style={inputStyle}/>
              </Field>
              <Field label="VIDÉO DE DÉMONSTRATION (optionnel)">
                <input type="url" inputMode="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                  placeholder="Colle un lien YouTube ou Vimeo" style={inputStyle}/>
                {(() => {
                  if (!videoUrl.trim()) return (
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                      Tes coachés la verront depuis leur séance, sur l'exercice concerné.
                    </div>
                  );
                  const v = analyseVideo(videoUrl);
                  if (!v) return (
                    <div style={{ fontSize: 10.5, color: T.danger, marginTop: 6, fontWeight: 600 }}>
                      Ce lien n'est pas valide. Il doit commencer par https://
                    </div>
                  );
                  return (
                    <div style={{ fontSize: 10.5, color: T.accent, marginTop: 6, fontWeight: 600 }}>
                      {v.type === "embed"   ? `Vidéo ${v.source} reconnue, elle sera lue dans l'app.`
                       : v.type === "fichier" ? "Fichier vidéo reconnu, il sera lu dans l'app."
                       : `Lien vers ${v.source} — il s'ouvrira dans le navigateur.`}
                    </div>
                  );
                })()}
              </Field>
              <div style={{ minHeight: 20, textAlign: "center" }}>
                {error && <div style={{ fontSize: 11, color: T.danger, fontWeight: 600 }}>{error}</div>}
              </div>
            </div>
            <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "12px 18px calc(18px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, background: T.bg }}>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: "14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, color: T.textSub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
              <button onClick={handleSave} disabled={saving || !name.trim()} style={{ flex: 2, padding: "14px", background: saving || !name.trim() ? T.surface2 : `linear-gradient(135deg, #064E3B, #0D9488)`, color: saving || !name.trim() ? T.textMuted : "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: saving || !name.trim() ? "default" : "pointer" }}>
                {saving ? "..." : "ENREGISTRER"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Constructeur de programme ──
function ProgramBuilder({ ctx, coachee, onClose }) {
  const { supabase, library, coachees } = ctx;
  const { confirm, confirmUI } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]); // [{id, name, exercises:[...], abdosCardio:[...]}]
  const [week, setWeek] = useState(DAYS_ORDER.map(d => ({ day: d, sessionId: null })));
  const [programName, setProgramName] = useState("");
  const [draftId, setDraftId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [picker, setPicker] = useState(null); // {sessionIdx} quand on ajoute un exercice
  const [pickerSearch, setPickerSearch] = useState("");
  const [editingSession, setEditingSession] = useState(null);
  const [importOpen, setImportOpen] = useState(false);   // modale "Importer depuis un coaché"
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");

  // Importe le planning + les séances d'un autre coaché comme base de travail.
  // On nettoie les id de séance pour qu'ils repartent proprement de 1, et on
  // remappe le week_structure en conséquence. Le snapshot dénormalisé des
  // exercices (exercice, muscle, series, reps, repos...) est conservé tel quel.
  async function importFromCoachee(sourceCoachee) {
    setImportLoading(true); setImportError("");
    try {
      const prog = await loadActiveProgram(supabase, sourceCoachee.id);
      if (!prog || !(prog.sessions_structure || []).length) {
        throw new Error("Ce coaché n'a pas de programme actif à importer.");
      }
      const srcSessions = prog.sessions_structure || [];
      const srcWeek = prog.week_structure || DAYS_ORDER.map(d => ({ day: d, sessionId: null }));

      // Remappe les id de séance vers 1..N pour éviter tout conflit
      const idMap = new Map();
      const cleanedSessions = srcSessions.map((s, i) => {
        idMap.set(s.id, i + 1);
        return {
          id: i + 1,
          name: s.name,
          exercises: (s.exercises || []).map((ex, j) => ({ ...ex, ordre: j + 1 })),
          abdosCardio: Array.isArray(s.abdosCardio) ? [...s.abdosCardio] : [],
        };
      });
      const cleanedWeek = DAYS_ORDER.map(d => {
        const entry = srcWeek.find(w => w.day === d);
        const mapped = entry && entry.sessionId != null ? idMap.get(entry.sessionId) : null;
        return { day: d, sessionId: mapped != null ? mapped : null };
      });

      setSessions(cleanedSessions);
      setWeek(cleanedWeek);
      // On garde le nom du programme du coaché courant (ne pas écraser par celui de la source)
      setDraftId(null); // l'import crée un nouveau programme, pas une mise à jour d'un brouillon existant
      setImportOpen(false);
      setMsg(`Programme de ${sourceCoachee.name} importé — ajuste puis active.`);
    } catch (e) {
      setImportError(e.message || "Erreur lors de l'import");
    }
    setImportLoading(false);
  }

  // Charger le programme actif existant comme base
  useEffect(() => {
    (async () => {
      try {
        const prog = await loadActiveProgram(supabase, coachee.id);
        if (prog) {
          setSessions(prog.sessions_structure || []);
          setWeek(prog.week_structure || DAYS_ORDER.map(d => ({ day: d, sessionId: null })));
          setProgramName(prog.name || "");
        }
      } catch {}
      setLoading(false);
    })();
  }, [coachee.id, supabase]);

  function addSession() {
    const newId = sessions.length ? Math.max(...sessions.map(s => s.id)) + 1 : 1;
    setSessions([...sessions, { id: newId, name: `SÉANCE ${newId}`, exercises: [], abdosCardio: [] }]);
  }
  function removeSession(sid) {
    setSessions(sessions.filter(s => s.id !== sid));
    setWeek(week.map(w => w.sessionId === sid ? { ...w, sessionId: null } : w));
  }
  function updateSessionName(sid, name) {
    setSessions(sessions.map(s => s.id === sid ? { ...s, name } : s));
  }
  function addExerciseToSession(sessionIdx, libEx) {
    const next = [...sessions];
    const ex = {
      ordre: next[sessionIdx].exercises.length + 1,
      library_exercise_id: libEx.id,
      exercice: libEx.name,
      muscle: libEx.muscle,
      series: 3,
      reps: ["8/10", "8/10", "8/10"],
      repos: "2'00",
      commentaire: libEx.notes || "",
      technique: null,
    };
    next[sessionIdx].exercises.push(ex);
    setSessions(next);
    setPicker(null);
    setPickerSearch("");
  }
  function updateExercise(sessionIdx, exIdx, field, value) {
    const next = [...sessions];
    const ex = next[sessionIdx].exercises[exIdx];
    if (field === "series") {
      // Autoriser le champ vide pendant la saisie (sera finalisé au blur)
      if (value === "") {
        ex.series = "";
        setSessions(next);
        return;
      }
      const n = Math.max(1, Math.min(10, parseInt(value) || 1));
      ex.series = n;
      // Redimensionne le tableau reps : on conserve les valeurs existantes,
      // on complète avec la dernière valeur connue si on ajoute des séries.
      if (n > ex.reps.length) {
        const last = ex.reps[ex.reps.length - 1] || "8/10";
        while (ex.reps.length < n) ex.reps.push(last);
      } else if (n < ex.reps.length) {
        ex.reps = ex.reps.slice(0, n);
      }
    } else {
      ex[field] = value;
    }
    setSessions(next);
  }
  // Finalise le champ séries quand on quitte le champ (évite de rester vide)
  function finalizeSeries(sessionIdx, exIdx) {
    const next = [...sessions];
    const ex = next[sessionIdx].exercises[exIdx];
    if (ex.series === "" || isNaN(parseInt(ex.series))) {
      ex.series = 1;
    }
    const n = Math.max(1, Math.min(10, parseInt(ex.series)));
    ex.series = n;
    if (n > ex.reps.length) {
      const last = ex.reps[ex.reps.length - 1] || "8/10";
      while (ex.reps.length < n) ex.reps.push(last);
    } else if (n < ex.reps.length) {
      ex.reps = ex.reps.slice(0, n);
    }
    setSessions(next);
  }
  // Modifie la fourchette de reps d'une série précise
  function updateRep(sessionIdx, exIdx, repIdx, value) {
    const next = [...sessions];
    next[sessionIdx].exercises[exIdx].reps[repIdx] = value;
    setSessions(next);
  }
  function moveExercise(sessionIdx, exIdx, dir) {
    const next = [...sessions];
    const arr = next[sessionIdx].exercises;
    const j = exIdx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[exIdx], arr[j]] = [arr[j], arr[exIdx]];
    arr.forEach((e, i) => e.ordre = i + 1);
    setSessions(next);
  }
  function removeExercise(sessionIdx, exIdx) {
    const next = [...sessions];
    next[sessionIdx].exercises.splice(exIdx, 1);
    next[sessionIdx].exercises.forEach((e, i) => e.ordre = i + 1);
    setSessions(next);
  }
  function updateAbdos(sessionIdx, value) {
    const next = [...sessions];
    next[sessionIdx].abdosCardio = value.split("\n").filter(l => l.trim());
    setSessions(next);
  }

  // Nettoie les séances avant sauvegarde : séries valides (1-10) et reps alignées
  function sanitizeSessions(srcSessions) {
    return srcSessions.map(s => ({
      ...s,
      exercises: (s.exercises || []).map(ex => {
        let n = parseInt(ex.series);
        if (isNaN(n) || n < 1) n = 1;
        if (n > 10) n = 10;
        let reps = Array.isArray(ex.reps) ? [...ex.reps] : [];
        const last = reps[reps.length - 1] || "8/10";
        while (reps.length < n) reps.push(last);
        if (reps.length > n) reps = reps.slice(0, n);
        return { ...ex, series: n, reps };
      }),
    }));
  }

  async function doSaveDraft() {
    setSaving(true); setMsg("");
    try {
      const clean = sanitizeSessions(sessions);
      setSessions(clean);
      const saved = await saveProgramDraft(supabase, coachee.id, week, clean, programName || "Brouillon", draftId);
      setDraftId(saved.id);
      setMsg("Brouillon enregistré ✓");
    } catch (e) { setMsg("Erreur : " + e.message); }
    setSaving(false);
  }
  async function doActivate() {
    if (!sessions.length) { setMsg("Ajoute au moins une séance"); return; }
    if (!(await confirm({ title: "ACTIVER CE PROGRAMME", message: "L'ancien programme actif du coaché sera archivé. La numérotation des semaines continue.", confirmLabel: "Activer" }))) return;
    setSaving(true); setMsg("");
    try {
      const clean = sanitizeSessions(sessions);
      setSessions(clean);
      await activateProgram(supabase, coachee.id, week, clean, programName || "Programme");
      setMsg("Programme activé ✓");
      setTimeout(onClose, 800);
    } catch (e) { setMsg("Erreur : " + e.message); }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24}/></div>;

  const activeSessionsForWeek = sessions;

  return (
    <div style={{ paddingBottom: 120 }} className="fade-in">
      {confirmUI}
      <div style={{ padding: "8px 18px 14px" }}>
        <Field label="NOM DU PROGRAMME">
          <input type="text" value={programName} onChange={e => setProgramName(e.target.value)} placeholder="Ex : Prise de masse - Bloc 1" style={inputStyle}/>
        </Field>
        <button onClick={() => { setImportError(""); setImportOpen(true); }} className="pressable" style={{ width: "100%", marginTop: 2, padding: "11px", background: T.accentLight, border: `1px solid ${T.accent}40`, borderRadius: 10, color: T.accent, fontSize: 12, fontWeight: 700, letterSpacing: .3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="profile" size={15} color={T.accent}/> Importer depuis un coaché existant
        </button>
      </div>

      {/* Planning hebdomadaire */}
      <div style={{ padding: "0 18px 16px" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2, color: T.textSub, marginBottom: 10 }}>PLANNING HEBDOMADAIRE</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {week.map((w, i) => (
            <div key={w.day} style={{ display: "flex", alignItems: "center", gap: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ width: 70, fontSize: 11, fontWeight: 800, color: T.textSub }}>{w.day}</div>
              <select value={w.sessionId || ""} onChange={e => { const v = e.target.value ? parseInt(e.target.value) : null; setWeek(week.map((x, j) => j === i ? { ...x, sessionId: v } : x)); }} style={{ ...inputStyle, padding: "8px 10px", flex: 1 }}>
                <option value="">— Repos —</option>
                {activeSessionsForWeek.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Séances */}
      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2, color: T.textSub }}>SÉANCES</div>
          <button onClick={addSession} style={{ background: T.accentLight, color: T.accent, border: `1px solid ${T.accent}40`, borderRadius: 10, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Séance</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sessions.map((s, sIdx) => (
            <div key={s.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px", boxShadow: `0 1px 8px ${T.shadow}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <input type="text" value={s.name} onChange={e => updateSessionName(s.id, e.target.value)} style={{ ...inputStyle, fontWeight: 700, fontFamily: "'Bebas Neue'", letterSpacing: 1, fontSize: 18, padding: "8px 10px" }}/>
                <button onClick={() => removeSession(s.id)} style={{ flexShrink: 0, background: "transparent", border: "none", color: T.danger, fontSize: 20, cursor: "pointer" }}>×</button>
              </div>

              {/* Exercices de la séance */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {s.exercises.map((ex, exIdx) => {
                  const mStyle = muscleColors[ex.muscle] || { bg: T.surface2, text: T.textSub };
                  return (
                    <div key={exIdx} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <button onClick={() => moveExercise(sIdx, exIdx, -1)} style={{ background: T.surface2, border: "none", borderRadius: 4, width: 22, height: 16, fontSize: 9, cursor: "pointer", lineHeight: 1 }}>▲</button>
                          <button onClick={() => moveExercise(sIdx, exIdx, 1)} style={{ background: T.surface2, border: "none", borderRadius: 4, width: 22, height: 16, fontSize: 9, cursor: "pointer", lineHeight: 1 }}>▼</button>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ex.exercice}</div>
                          <span style={{ background: mStyle.bg, color: mStyle.text, fontSize: 8, padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>{ex.muscle}</span>
                        </div>
                        <button onClick={() => removeExercise(sIdx, exIdx)} style={{ background: "transparent", border: "none", color: T.danger, fontSize: 16, cursor: "pointer" }}>×</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1fr 1.2fr", gap: 6 }}>
                        <div>
                          <label style={{ fontSize: 8, color: T.textMuted, fontWeight: 700, letterSpacing: .5 }}>SÉRIES</label>
                          <input type="number" inputMode="numeric" min="1" max="10" value={ex.series} onChange={e => updateExercise(sIdx, exIdx, "series", e.target.value)} onBlur={() => finalizeSeries(sIdx, exIdx)} style={{ ...inputStyle, padding: "6px 8px", fontSize: 13 }}/>
                        </div>
                        <div>
                          <label style={{ fontSize: 8, color: T.textMuted, fontWeight: 700, letterSpacing: .5 }}>REPOS</label>
                          <input type="text" value={ex.repos} onChange={e => updateExercise(sIdx, exIdx, "repos", e.target.value)} placeholder="2'00" style={{ ...inputStyle, padding: "6px 8px", fontSize: 13 }}/>
                        </div>
                        <div>
                          <label style={{ fontSize: 8, color: T.textMuted, fontWeight: 700, letterSpacing: .5 }}>TECHNIQUE</label>
                          <select value={ex.technique || ""} onChange={e => updateExercise(sIdx, exIdx, "technique", e.target.value || null)} style={{ ...inputStyle, padding: "6px 8px", fontSize: 13 }}>
                            {TECHNIQUE_OPTIONS.map(t => <option key={t.label} value={t.value || ""}>{t.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <label style={{ fontSize: 8, color: T.textMuted, fontWeight: 700, letterSpacing: .5 }}>REPS</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                          {(typeof ex.series === "number" ? ex.reps.slice(0, ex.series) : ex.reps).map((rep, repIdx) => (
                            <div key={repIdx} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "1 1 56px", minWidth: 56 }}>
                              <span style={{ fontSize: 8, color: T.accent, fontWeight: 800, marginBottom: 2 }}>S{repIdx + 1}</span>
                              <input type="text" value={rep} onChange={e => updateRep(sIdx, exIdx, repIdx, e.target.value)} placeholder="8/10" style={{ ...inputStyle, padding: "6px 4px", fontSize: 13, textAlign: "center", width: "100%" }}/>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <label style={{ fontSize: 8, color: T.textMuted, fontWeight: 700, letterSpacing: .5 }}>COMMENTAIRE</label>
                        <input type="text" value={ex.commentaire} onChange={e => updateExercise(sIdx, exIdx, "commentaire", e.target.value)} placeholder="Optionnel" style={{ ...inputStyle, padding: "6px 8px", fontSize: 13 }}/>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => { setPicker({ sessionIdx: sIdx }); setPickerSearch(""); }} style={{ width: "100%", marginTop: 10, background: T.surface2, border: `1px dashed ${T.borderStrong}`, color: T.textSub, borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                + Ajouter un exercice depuis la bibliothèque
              </button>

              {/* Abdos / Cardio */}
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, letterSpacing: 1 }}>ABDOS / CARDIO (une ligne par item)</label>
                <textarea value={(s.abdosCardio || []).join("\n")} onChange={e => updateAbdos(sIdx, e.target.value)} placeholder="3x1 min gainage&#10;3x échec relevé de jambes" rows={2} style={{ ...inputStyle, padding: "8px 10px", fontSize: 12, resize: "vertical", marginTop: 4 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Barre d'actions fixe */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,252,247,0.95)", backdropFilter: "blur(12px)", borderTop: `1px solid ${T.border}`, padding: "12px 18px 20px", zIndex: 50 }}>
        {msg && <div style={{ textAlign: "center", fontSize: 11, color: msg.includes("Erreur") ? T.danger : T.accent, fontWeight: 700, marginBottom: 8 }}>{msg}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={doSaveDraft} disabled={saving} style={{ flex: 1, padding: "13px", background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, color: T.textSub, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Brouillon</button>
          <button onClick={doActivate} disabled={saving} style={{ flex: 2, padding: "13px", background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 12, fontSize: 12, fontWeight: 800, letterSpacing: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? (<><Spinner size={14} color="white"/> ...</>) : "ACTIVER LE PROGRAMME"}
          </button>
        </div>
      </div>

      {/* Sélecteur d'exercice */}
      {picker && (
        <>
          <div className="sheet-backdrop" onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 400 }}/>
          <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 401, background: T.bg, borderRadius: "22px 22px 0 0", maxHeight: "80vh", overflowY: "auto", padding: "10px 18px 28px" }}>
            <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "0 auto 16px" }}/>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: T.text, letterSpacing: 2, marginBottom: 12 }}>CHOISIR UN EXERCICE</div>
            <input type="text" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Rechercher..." style={{ ...inputStyle, marginBottom: 12 }} autoFocus/>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {library.filter(e => e.name.toLowerCase().includes(pickerSearch.toLowerCase())).map(libEx => {
                const mStyle = muscleColors[libEx.muscle] || { bg: T.surface2, text: T.textSub };
                return (
                  <button key={libEx.id} onClick={() => addExerciseToSession(picker.sessionIdx, libEx)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{libEx.name}</div>
                    </div>
                    <span style={{ background: mStyle.bg, color: mStyle.text, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{libEx.muscle}</span>
                  </button>
                );
              })}
              {library.length === 0 && <div style={{ textAlign: "center", color: T.textMuted, fontSize: 12, padding: 20 }}>Ta bibliothèque est vide. Ajoute des exercices dans l'onglet Bibliothèque.</div>}
            </div>
          </div>
        </>
      )}

      {/* Modale : Importer depuis un coaché existant */}
      {importOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setImportOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 400 }}/>
          <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 401, background: T.bg, borderRadius: "22px 22px 0 0", maxHeight: "80vh", overflowY: "auto", padding: "10px 18px 28px" }}>
            <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "0 auto 16px" }}/>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: T.text, letterSpacing: 2, marginBottom: 4 }}>IMPORTER UN PROGRAMME</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
              Choisis un coaché : son programme actif sera copié ici comme base. Tu pourras tout ajuster avant d'activer.
            </div>
            {importError && <div style={{ fontSize: 11, color: T.danger, fontWeight: 600, textAlign: "center", marginBottom: 12 }}>{importError}</div>}
            {importLoading ? (
              <div style={{ padding: 30, textAlign: "center" }}><Spinner size={22}/></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(coachees || []).filter(c => c.id !== coachee.id && c.is_active !== false).length === 0 ? (
                  <div style={{ textAlign: "center", color: T.textMuted, fontSize: 12, padding: 20 }}>
                    Aucun autre coaché disponible. Crée d'abord un programme pour un autre coaché.
                  </div>
                ) : (coachees || []).filter(c => c.id !== coachee.id && c.is_active !== false).map(c => (
                  <button key={c.id} onClick={() => importFromCoachee(c)} className="pressable" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, #064E3B, #2DD4BF)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: 17, color: "white" }}>
                      {(c.name || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{c.access_code}</div>
                    </div>
                    <Icon name="chevronRight" size={18} color={T.borderStrong}/>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setImportOpen(false)} style={{ width: "100%", marginTop: 14, padding: "13px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, color: T.textSub, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Vue progression d'un coaché (lecture seule) ──
function CoachProgressView({ ctx, coachee }) {
  const { supabase } = ctx;
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  const [allCompletedSets, setAllCompletedSets] = useState({});
  const [allSetLogs, setAllSetLogs] = useState({});
  const [sheetExercise, setSheetExercise] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const prog = await loadActiveProgram(supabase, coachee.id);
        setProgram(prog);
        const { allCompletedSets: rcs, allSetLogs: rls } = await loadAllSetsFromSupabase(supabase, coachee.id);
        setAllCompletedSets(rcs);
        setAllSetLogs(rls);
      } catch {}
      setLoading(false);
    })();
  }, [coachee.id, supabase]);

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24}/></div>;
  if (!program) return <div style={{ padding: 30, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Aucun programme actif pour ce coaché.</div>;

  // Réutilise la logique de groupement par muscle de ProgressPage
  const sessions = program.sessions_structure || [];
  const muscleMap = new Map();
  sessions.forEach(s => s.exercises.forEach(ex => {
    if (!muscleMap.has(ex.muscle)) muscleMap.set(ex.muscle, []);
    const list = muscleMap.get(ex.muscle);
    if (!list.find(e => e.name === ex.exercice)) list.push({ name: ex.exercice, muscle: ex.muscle });
  }));

  function getProgress(exName) {
    const weeks = new Set(); let best = 0;
    Object.entries(allSetLogs).forEach(([k, log]) => {
      if (log?.exerciseName === exName && allCompletedSets[k] && log.weight) {
        weeks.add(parseInt(k.split("-")[0]));
        const w = parseFloat(log.weight);
        if (!isNaN(w) && w > best) best = w;
      }
    });
    return { weeksLogged: weeks.size, bestWeight: best };
  }

  const totalLogged = Object.values(allCompletedSets).filter(Boolean).length;

  return (
    <div className="fade-in">
      <div style={{ padding: "0 0 14px", display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: T.accent }}>{totalLogged}</div>
          <div style={{ fontSize: 8, color: T.textMuted, letterSpacing: 1, fontWeight: 700 }}>SÉRIES LOG</div>
        </div>
        <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: T.accent }}>{muscleMap.size}</div>
          <div style={{ fontSize: 8, color: T.textMuted, letterSpacing: 1, fontWeight: 700 }}>MUSCLES</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from(muscleMap.entries()).map(([muscle, exercises]) => {
          const mStyle = muscleColors[muscle] || { bg: T.surface2, text: T.textSub };
          return (
            <div key={muscle} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <span style={{ background: mStyle.bg, color: mStyle.text, fontSize: 10, padding: "2px 9px", borderRadius: 20, fontWeight: 800 }}>{muscle}</span>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {exercises.map(ex => {
                  const prog = getProgress(ex.name);
                  return (
                    <div key={ex.name} onClick={() => setSheetExercise({ exercice: ex.name, muscle: ex.muscle })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ flex: 1, fontSize: 12, color: T.text }}>{ex.name}</div>
                      {prog.bestWeight > 0 ? (
                        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 14, color: T.accent }}>{prog.bestWeight} <span style={{ fontSize: 9 }}>KG</span></div>
                      ) : <span style={{ fontSize: 10, color: T.textMuted }}>—</span>}
                      <Icon name="chevronRight" size={14} color={T.borderStrong}/>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {sheetExercise && (
        <ExerciseSheet exercise={sheetExercise} allSetLogs={allSetLogs} allCompletedSets={allCompletedSets} onClose={() => setSheetExercise(null)}/>
      )}
    </div>
  );
}

// Les notes de séance d'une semaine, telles que le coach les lit.
function NotesDeSeance({ notes }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {notes.map(n => (
        <div key={n.id} style={{ background: T.bg, borderLeft: `2px solid ${T.borderStrong}`, borderRadius: "0 8px 8px 0", padding: "8px 11px" }}>
          <div style={{ fontSize: 8.5, color: T.textMuted, letterSpacing: 1, fontWeight: 800, marginBottom: 3 }}>
            {(n.session_name || `SÉANCE ${n.session_config_id}`).toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.note}</div>
        </div>
      ))}
    </div>
  );
}

// ── Vue coach : les bilans hebdomadaires d'un coaché ────────────────────────
function CoachBilansView({ ctx, coachee }) {
  const { supabase } = ctx;
  const [bilans, setBilans] = useState(null);
  const [notes, setNotes]   = useState([]);      // notes de séance, toutes semaines
  const [dispo, setDispo]   = useState(true);
  const [brouillons, setBrouillons] = useState({});   // { bilanId: texte }
  const [occupe, setOccupe] = useState(null);         // id en cours d'envoi

  const recharger = useCallback(async () => {
    const { data, error } = await supabase
      .from("weekly_reviews").select("*")
      .eq("coachee_id", coachee.id)
      .order("week_number", { ascending: false });
    if (error) { setDispo(!tableAbsente(error)); setBilans([]); return; }
    setBilans(data || []);

    // Les notes de séance vivent dans une autre table : leur absence ne doit
    // pas empêcher d'afficher les bilans, et réciproquement.
    const { data: n, error: eN } = await supabase
      .from("session_notes").select("*")
      .eq("coachee_id", coachee.id)
      .order("week_number", { ascending: false });
    setNotes(eN ? [] : (n || []));
  }, [supabase, coachee.id]);

  useEffect(() => { recharger(); }, [recharger]);

  async function repondre(b) {
    const texte = (brouillons[b.id] ?? "").trim();
    if (!texte) return;
    setOccupe(b.id);
    try {
      await supabase.from("weekly_reviews")
        .update({ coach_reply: texte, coach_replied_at: new Date().toISOString() })
        .eq("id", b.id);
      setBrouillons(d => { const n = { ...d }; delete n[b.id]; return n; });
      await recharger();
    } finally { setOccupe(null); }
  }

  if (!dispo) return (
    <div style={{ padding: "26px 18px", textAlign: "center", color: T.textMuted, fontSize: 12.5, lineHeight: 1.6 }}>
      Les bilans ne sont pas encore activés en base.<br/>
      Joue <span style={{ fontWeight: 700 }}>sql/2026-08-08-bilan-hebdomadaire.sql</span> dans Supabase.
    </div>
  );
  if (bilans === null) return <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24}/></div>;

  // Une carte par semaine, qu'elle porte un bilan, des notes de séance, ou les
  // deux. Un coaché peut très bien laisser un mot sur une séance sans remplir
  // son bilan — ce retour-là ne doit pas se perdre.
  const semaines = [...new Set([...bilans.map(b => b.week_number), ...notes.map(n => n.week_number)])]
    .sort((a, b) => b - a);

  if (semaines.length === 0) return (
    <div style={{ padding: "26px 18px", textAlign: "center", color: T.textMuted, fontSize: 12.5, lineHeight: 1.6 }}>
      {coachee.name} n'a pas encore envoyé de retour.
    </div>
  );

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {semaines.map(num => {
        const b = bilans.find(x => x.week_number === num);
        const notesSem = notes.filter(n => n.week_number === num);
        if (!b) return (
          <div key={`n${num}`} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 17, color: T.text, letterSpacing: 1.5, marginBottom: 4 }}>SEMAINE {num}</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 10 }}>Pas de bilan, mais des notes de séance</div>
            <NotesDeSeance notes={notesSem}/>
          </div>
        );
        const enAttente = !b.coach_reply;
        return (
          <div key={b.id} style={{ background: T.surface, border: `1px solid ${enAttente ? T.accentA38 : T.border}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 17, color: T.text, letterSpacing: 1.5 }}>SEMAINE {b.week_number}</div>
              {enAttente && (
                <span style={{ background: T.warnBg, color: T.warnText, fontSize: 9, padding: "3px 9px", borderRadius: 20, fontWeight: 800 }}>
                  SANS RÉPONSE
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: b.note ? 11 : 0 }}>
              {BILAN_CRITERES.map(c => (
                <div key={c.cle} style={{ flex: 1, textAlign: "center", background: T.bg, borderRadius: 9, padding: "8px 2px" }}>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, lineHeight: 1, color: b[c.cle] == null ? T.textMuted : b[c.cle] <= 2 ? "var(--cmp-down-text)" : b[c.cle] >= 4 ? "var(--cmp-up-text)" : T.textSub }}>
                    {b[c.cle] == null ? "—" : b[c.cle]}
                  </div>
                  <div style={{ fontSize: 7.5, color: T.textMuted, letterSpacing: .4, fontWeight: 700, marginTop: 4 }}>{c.label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            {b.note && (
              <div style={{ background: T.bg, borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                {b.note}
              </div>
            )}

            {notesSem.length > 0 && <div style={{ marginTop: 11 }}><NotesDeSeance notes={notesSem}/></div>}

            {b.coach_reply ? (
              <div style={{ marginTop: 11, background: T.accentLight, border: `1px solid ${T.accentA38}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: T.accent, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>TA RÉPONSE</div>
                <div style={{ fontSize: 12, color: T.accentDark, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{b.coach_reply}</div>
              </div>
            ) : (
              <div style={{ marginTop: 11 }}>
                <textarea rows={2} value={brouillons[b.id] ?? ""}
                  onChange={e => setBrouillons(d => ({ ...d, [b.id]: e.target.value }))}
                  placeholder="Répondre à ce bilan..."
                  style={{ ...inputStyle, fontSize: 12.5, resize: "vertical", lineHeight: 1.5 }}/>
                <button onClick={() => repondre(b)}
                  disabled={!(brouillons[b.id] ?? "").trim() || occupe === b.id} className="pressable"
                  style={{ width: "100%", marginTop: 8, padding: "10px", background: (brouillons[b.id] ?? "").trim() && occupe !== b.id ? T.accent : T.surface2, color: (brouillons[b.id] ?? "").trim() && occupe !== b.id ? T.accentText : T.textMuted, border: "none", borderRadius: 10, fontSize: 11, fontWeight: 800, letterSpacing: .5, cursor: (brouillons[b.id] ?? "").trim() && occupe !== b.id ? "pointer" : "default", fontFamily: "inherit" }}>
                  {occupe === b.id ? "ENVOI..." : "RÉPONDRE"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Envoi d'une notification à un coaché, depuis l'espace coach ──────────────
//
//  Le coach ne peut PAS lire push_subscriptions : la RLS ne l'autorise que le
//  coaché lui-même, et c'est volontaire (moins de portes, moins de risques).
//  Impossible, donc, d'afficher ici « 2 appareils abonnés » avant l'envoi.
//  C'est l'Edge Function qui tranche et renvoie « Aucun appareil abonné » si le
//  coaché n'a pas activé ses notifications. Le coach a la réponse en un clic,
//  sans qu'on ait eu à lui ouvrir un accès dont il n'a pas besoin.
function CoachPushSender({ ctx, coachee }) {
  const { supabase } = ctx;
  const [ouvert, setOuvert]   = useState(false);
  const [titre, setTitre]     = useState("");
  const [texte, setTexte]     = useState("");
  const [occupe, setOccupe]   = useState(false);
  const [retour, setRetour]   = useState(null);   // { ok: bool, message: string }

  const MAX_TITRE = 60;
  const MAX_TEXTE = 160;   // au-delà, les téléphones tronquent de toute façon
  const pret = titre.trim().length > 0 && texte.trim().length > 0 && !occupe;

  async function envoyer() {
    setOccupe(true); setRetour(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: { coacheeId: coachee.id, title: titre.trim(), body: texte.trim() },
      });
      if (error) throw new Error(await messageErreurFonction(error, "Envoi impossible"));
      const n = data?.envoyees || 0;
      setRetour({ ok: n > 0, message: n > 0
        ? `Envoyé sur ${n} appareil${n > 1 ? "s" : ""}.`
        : "Aucun appareil n'a reçu la notification." });
      if (n > 0) { setTitre(""); setTexte(""); }
    } catch (e) {
      setRetour({ ok: false, message: e?.message || "Envoi impossible" });
    } finally { setOccupe(false); }
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="pressable"
        style={{ width: "100%", marginTop: 10, padding: "13px", background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, color: T.textSub, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        Envoyer une notification
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 16, color: T.text, letterSpacing: 1.5 }}>NOTIFICATION</div>
        <button onClick={() => { setOuvert(false); setRetour(null); }}
          style={{ background: "none", border: "none", color: T.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
          Fermer
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: T.textMuted, lineHeight: 1.5, marginBottom: 12 }}>
        Arrive sur le téléphone de {coachee.name}, même app fermée — s'il a activé
        ses notifications de son côté.
      </div>

      <Field label={`TITRE (${titre.length}/${MAX_TITRE})`}>
        <input value={titre} maxLength={MAX_TITRE} onChange={e => setTitre(e.target.value)}
          placeholder="Nouvelle semaine" style={inputStyle}/>
      </Field>
      <Field label={`MESSAGE (${texte.length}/${MAX_TEXTE})`}>
        <textarea value={texte} maxLength={MAX_TEXTE} rows={3} onChange={e => setTexte(e.target.value)}
          placeholder="Ton programme de la semaine 12 est en ligne."
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}/>
      </Field>

      <button onClick={envoyer} disabled={!pret} className="pressable"
        style={{ width: "100%", marginTop: 4, padding: "13px", background: pret ? T.accent : T.surface2, color: pret ? T.accentText : T.textMuted, border: "none", borderRadius: 12, fontSize: 12, fontWeight: 800, letterSpacing: .5, cursor: pret ? "pointer" : "default", fontFamily: "inherit" }}>
        {occupe ? "ENVOI..." : "ENVOYER"}
      </button>

      {retour && (
        <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, lineHeight: 1.5, color: retour.ok ? T.accent : T.danger }}>
          {retour.message}
        </div>
      )}
    </div>
  );
}

// ── Page détail d'un coaché (3 sous-vues : Infos / Programme / Progression) ──
function CoacheeDetailPage({ ctx, coachee, onBack, onChanged }) {
  const { supabase } = ctx;
  const { confirm, confirmUI } = useConfirm();
  const [tab, setTab] = useState("infos");
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function toggleActive() {
    const newState = coachee.is_active === false;
    const ok = await confirm(newState
      ? { title: "RÉACTIVER CE COACHÉ", message: `${coachee.name} retrouvera l'accès à son espace.`, confirmLabel: "Réactiver" }
      : { title: "DÉSACTIVER CE COACHÉ", message: `${coachee.name} ne pourra plus se connecter. Tout son historique est conservé.`, confirmLabel: "Désactiver", danger: true });
    if (!ok) return;
    setBusy(true);
    await supabase.from("profiles").update({ is_active: newState }).eq("id", coachee.id);
    await onChanged();
    setBusy(false);
    onBack();
  }

  return (
    <div style={{ paddingBottom: 100 }} className="fade-in">
      {confirmUI}
      <div style={{ padding: "16px 18px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} className="pressable" style={{ background: T.surface, border: `1px solid ${T.border}`, width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Icon name="chevronLeft" size={20} color={T.text}/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: T.text, letterSpacing: 2, lineHeight: 1 }}>{coachee.name}</div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{coachee.access_code}</div>
        </div>
      </div>

      <div style={{ padding: "0 18px 14px", display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {[["infos", "Infos"], ["bilans", "Retours"], ["programme", "Programme"], ["periodisation", "Périodisation"], ["nutrition", "Nutrition"], ["progression", "Progression"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flexShrink: 0, padding: "9px 13px", background: tab === id ? T.accent : T.surface, color: tab === id ? "white" : T.textSub, border: `1px solid ${tab === id ? T.accent : T.border}`, borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 18px" }}>
        {tab === "infos" && (
          <div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px" }}>
              {[["Nom", coachee.name], ["Code d'accès", coachee.access_code], ["Objectif", coachee.goal || "—"], ["Date de début", coachee.start_date || "—"]].map(([k, v], i, arr) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: 12, color: T.text, fontWeight: 700 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Offre</span>
                <OfferBadge offer={coachee.offer}/>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Statut</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: coachee.is_active === false ? T.danger : T.accent }}>{coachee.is_active === false ? "Inactif" : "Actif"}</span>
              </div>
            </div>
            <button onClick={() => setEditOpen(true)} style={{ width: "100%", marginTop: 14, padding: "13px", background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 12, fontSize: 12, fontWeight: 800, letterSpacing: .5, cursor: "pointer" }}>
              Éditer les infos
            </button>
            <button onClick={toggleActive} disabled={busy} style={{ width: "100%", marginTop: 10, padding: "13px", background: T.surface, border: `1.5px solid ${coachee.is_active === false ? T.accent : T.danger}`, borderRadius: 12, color: coachee.is_active === false ? T.accent : T.danger, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {coachee.is_active === false ? "Réactiver ce coaché" : "Désactiver ce coaché"}
            </button>
            <CoachPushSender ctx={ctx} coachee={coachee}/>
          </div>
        )}
        {tab === "bilans" && <CoachBilansView ctx={ctx} coachee={coachee}/>}
        {tab === "programme" && <ProgramBuilder ctx={ctx} coachee={coachee} onClose={onBack}/>}
        {tab === "periodisation" && <CoachPeriodizationView ctx={ctx} coachee={coachee}/>}
        {tab === "nutrition" && <CoachNutritionView ctx={ctx} coachee={coachee}/>}
        {tab === "progression" && <CoachProgressView ctx={ctx} coachee={coachee}/>}
      </div>
      {editOpen && <EditCoacheeModal supabase={supabase} coachee={coachee} onClose={() => setEditOpen(false)} onSaved={async () => { setEditOpen(false); await onChanged(); onBack(); }}/>}
    </div>
  );
}

// ── Modale : édition d'un coaché (nom / offre / code d'accès) ──
function EditCoacheeModal({ supabase, coachee, onClose, onSaved }) {
  const [name, setName] = useState(coachee.name || "");
  const [offer, setOffer] = useState(coachee.offer || "essentiel");
  const [code, setCode] = useState(coachee.access_code || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const codeChanged = code.trim().toUpperCase() !== String(coachee.access_code || "").toUpperCase();

  async function handleSave() {
    if (!name.trim() || !code.trim() || saving) return;
    setSaving(true); setError("");
    try {
      await updateCoacheeViaFunction(supabase, {
        coacheeId: coachee.id,
        newName: name.trim(),
        newOffer: offer,
        newAccessCode: code.trim().toUpperCase(),
      });
      onSaved();
    } catch (e) { setError(e.message || "Erreur"); setSaving(false); }
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 400 }}/>
      <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 401, background: T.bg, borderRadius: "22px 22px 0 0", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "10px auto 12px", flexShrink: 0 }}/>
        <div style={{ overflowY: "auto", padding: "0 18px", flex: "0 1 auto", minHeight: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: T.text, letterSpacing: 2, marginBottom: 16 }}>ÉDITER LE COACHÉ</div>
          <Field label="NOM"><input type="text" value={name} onChange={e => { setName(e.target.value); setError(""); }} style={inputStyle}/></Field>
          <Field label="OFFRE">
            <div style={{ display: "flex", gap: 8 }}>
              {OFFER_OPTIONS.map(o => (
                <button key={o} onClick={() => setOffer(o)} style={{ flex: 1, padding: "12px", background: offer === o ? T.accent : T.surface, color: offer === o ? "white" : T.textSub, border: `1.5px solid ${offer === o ? T.accent : T.border}`, borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: .5, cursor: "pointer", textTransform: "uppercase" }}>{o}</button>
              ))}
            </div>
          </Field>
          <Field label="CODE D'ACCÈS">
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }} style={{ ...inputStyle, fontWeight: 700, letterSpacing: 1 }}/>
              <button onClick={() => { setCode(generateAccessCode(name)); setError(""); }} title="Générer un nouveau code" style={{ flexShrink: 0, padding: "0 14px", background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 10, cursor: "pointer", fontSize: 16 }}>↻</button>
            </div>
          </Field>
          {codeChanged && (
            <div style={{ background: T.warnBg, border: "1px solid var(--warn-border)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 11, color: T.warnText, lineHeight: 1.5, fontWeight: 600 }}>
              Attention : changer le code modifie les identifiants de connexion du coaché. Il devra utiliser le nouveau code <b>{code.trim().toUpperCase()}</b> pour se connecter, et sera déconnecté de ses sessions actuelles.
            </div>
          )}
          {error && <div style={{ fontSize: 11, color: T.danger, fontWeight: 600, textAlign: "center", marginBottom: 8 }}>{error}</div>}
        </div>
        <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "12px 18px calc(18px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          <button onClick={onClose} style={{ flex: 1, padding: "14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, color: T.textSub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !code.trim()} style={{ flex: 2, padding: "14px", background: saving || !name.trim() ? T.surface2 : `linear-gradient(135deg, #064E3B, #0D9488)`, color: saving || !name.trim() ? T.textMuted : "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? (<><Spinner size={14} color={T.textMuted}/> ...</>) : "ENREGISTRER"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Barre de navigation coach ──
function CoachTabBar({ activePage, onNavigate }) {
  const tabs = [
    { id: "coachees", label: "Coachés", icon: "profile" },
    { id: "suivi",    label: "Suivi",     icon: "trending" },
    { id: "library",  label: "Exercices", icon: "workout" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,252,247,0.92)", backdropFilter: "blur(20px) saturate(180%)", borderTop: `1px solid ${T.border}`, padding: "10px 8px 16px", display: "flex", justifyContent: "space-around", zIndex: 100, boxShadow: `0 -2px 24px ${T.shadow}` }}>
      {tabs.map(tab => {
        const isActive = activePage === tab.id;
        return (
          <button key={tab.id} onClick={() => onNavigate(tab.id)} className="tab-bar-btn" style={{ background: "transparent", border: "none", cursor: "pointer", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 4px", color: isActive ? T.accent : T.textMuted }}>
            <Icon name={tab.icon} size={22} color={isActive ? T.accent : T.textMuted} filled={isActive}/>
            <div style={{ fontSize: 9, fontWeight: isActive ? 800 : 600 }}>{tab.label}</div>
          </button>
        );
      })}
    </div>
  );
}

// ── App coach (racine de l'espace coach) ──
function CoachApp({ session, supabase, coachProfile, onLogout }) {
  const coachId = session.user.id;
  const [page, setPage] = useState("coachees");
  const [coachees, setCoachees] = useState([]);
  const [library, setLibrary] = useState([]);
  const [selectedCoachee, setSelectedCoachee] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const reloadCoachees = useCallback(async () => {
    try { setCoachees(await loadCoachees(supabase, coachId)); } catch {}
  }, [supabase, coachId]);
  const reloadLibrary = useCallback(async () => {
    try { setLibrary(await loadExerciseLibrary(supabase, coachId)); } catch {}
  }, [supabase, coachId]);

  useEffect(() => {
    (async () => {
      await Promise.all([reloadCoachees(), reloadLibrary()]);
      setLoading(false);
    })();
  }, [reloadCoachees, reloadLibrary]);

  const ctx = { supabase, coachId, coachees, library, reloadCoachees, reloadLibrary,
    openCoachee: setSelectedCoachee, setShowNewModal };

  if (loading) return <LoadingScreen text="Chargement de l'espace coach..."/>;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: T.text, overflowX: "hidden" }}>
      <style>{`
        /* Polices auto-hébergées : les @font-face sont déclarées dans le gabarit HTML (build.mjs) — RGPD + hors-ligne */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input,select,textarea{font-family:inherit}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${T.borderStrong};border-radius:2px}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes sheetSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes sheetFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes growUp{from{height:0;opacity:0}to{opacity:1}}
        .fade-in{animation:fadeIn .3s ease forwards}
        .pressable{transition:transform .12s cubic-bezier(0.34,1.56,0.64,1)}
        .pressable:active{transform:scale(.96)}
        .quick-card{transition:transform .15s}
        .quick-card:active{transform:scale(.985)}
        .sheet-backdrop{animation:sheetFadeIn .25s ease both}
        .sheet{animation:sheetSlideUp .38s cubic-bezier(0.32,0.72,0.34,1) both}
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,252,247,0.92)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ForgeLogo size={28}/>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 13, color: T.accent, letterSpacing: 2 }}>FORGE · COACH</div>
        </div>
        <button onClick={onLogout} title="Déconnexion" style={{ background: "transparent", border: "none", cursor: "pointer", color: T.textMuted, display: "flex", alignItems: "center" }}>
          <Icon name="logout" size={18} color={T.textMuted}/>
        </button>
      </div>

      {selectedCoachee ? (
        <CoacheeDetailPage ctx={ctx} coachee={selectedCoachee} onBack={() => { setSelectedCoachee(null); reloadCoachees(); }} onChanged={reloadCoachees}/>
      ) : (
        <>
          {page === "coachees" && <CoachListPage ctx={ctx}/>}
          {page === "suivi"    && <CoachFollowUpPage ctx={ctx}/>}
          {page === "library"  && <CoachLibraryPage ctx={ctx}/>}
          <CoachTabBar activePage={page} onNavigate={setPage}/>
        </>
      )}

      {showNewModal && (
        <NewCoacheeModal supabase={supabase} onClose={() => setShowNewModal(false)} onCreated={reloadCoachees}/>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
//  MODULE DIÈTE (Premium) — Constantes & moteur de calcul
// ═══════════════════════════════════════════════════════════════════════════════
const ACTIVITY_FACTORS = [
  { value: 1.2,  label: "Sédentaire (bureau, peu de pas)" },
  { value: 1.35, label: "Légèrement actif" },
  { value: 1.5,  label: "Actif (debout / beaucoup de marche)" },
  { value: 1.65, label: "Très actif (métier physique)" },
];
const KCAL_FLOOR = { homme: 1500, femme: 1200 };
// Version du cadre accepté par le coaché. La changer redemande l'accord à
// tout le monde : à ne faire QUE si le texte ci-dessous change sur le fond.
const DIET_CONSENT_VERSION = "2026-08-v1";
const NUTRITION_DISCLAIMER ="Les recommandations nutritionnelles fournies sont des suggestions à visée éducative dans le cadre d'un accompagnement sportif. Elles ne constituent pas une prescription ni un avis médical, et ne remplacent pas la consultation d'un médecin ou d'un diététicien, en particulier en cas de pathologie, de traitement, de grossesse ou d'antécédent de trouble du comportement alimentaire.";

function calcAge(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate), now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}
// BMR Mifflin-St Jeor
function calcBMR(sex, weightKg, heightCm, age) {
  if (!sex || !weightKg || !heightCm || age == null) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "homme" ? base + 5 : base - 161);
}
// Estimation des calories d'une séance depuis sa structure
function estimateSessionCalories(session, weightKg, intensityMult) {
  if (!session || !weightKg) return 0;
  let totalSec = 300; // ~5 min d'échauffement
  (session.exercises || []).forEach(ex => {
    const reposSec = parseRepos(ex.repos || "2'00");
    const n = parseInt(ex.series) || 0;
    totalSec += n * (35 + reposSec); // ~35 s de tension par série
  });
  const hours = totalSec / 3600;
  const met = 6.0 * (intensityMult || 1.0);
  return Math.round(met * weightKg * hours);
}
// Calcul complet : BMR → TDEE → cible → macros, avec garde-fous
function computeNutritionTargets({ clientProfile, nutriProfile, lastWeight, sessions, week, activePhasePct }) {
  if (!clientProfile || !nutriProfile || !lastWeight) return { ready: false, missing: "Pesée ou profil manquant" };
  const { sex, birth_date, height_cm } = clientProfile;
  const age = calcAge(birth_date);
  if (!sex || !height_cm || age == null) return { ready: false, missing: "Sexe, taille ou date de naissance manquants" };

  const bmr = calcBMR(sex, lastWeight, height_cm, age);
  const daily = bmr * (parseFloat(nutriProfile.activity_factor) || 1.2);

  // Calories des séances de la semaine (depuis le programme)
  const intensity = nutriProfile.session_intensity || {};
  let weekKcal = 0; const perSession = [];
  (week || []).forEach(w => {
    if (w.sessionId == null) return;
    const s = (sessions || []).find(x => x.id === w.sessionId);
    if (!s) return;
    const mult = parseFloat(intensity[String(s.id)]) || 1.0;
    const kcal = estimateSessionCalories(s, lastWeight, mult);
    weekKcal += kcal;
    perSession.push({ id: s.id, name: s.name, day: w.day, kcal, mult });
  });
  const sportDaily = Math.round(weekKcal / 7);
  const tdee = Math.round(daily + sportDaily);

  // Ajustement objectif, borné
  let pct = (activePhasePct != null && activePhasePct !== "") ? parseInt(activePhasePct) : (parseInt(nutriProfile.goal_adjustment_pct) || 0);
  if (pct < -25) pct = -25;
  if (pct > 25) pct = 25;

  // Garde-fous : plancher BMR + plancher absolu
  const floor = Math.max(bmr, KCAL_FLOOR[sex] || 1200);

  // Protéines et lipides se calculent sur le POIDS, pas sur les calories : ils
  // ne bougent donc pas d'un jour à l'autre. C'est l'usage en diététique du
  // sport, et c'est aussi ce qui rend une diète mémorisable — seuls les
  // féculents changent entre un jour de séance et un jour de repos.
  let pPerKg = parseFloat(nutriProfile.protein_g_per_kg) || 2.0;
  if (pPerKg > 2.4) pPerKg = 2.4;
  const fPerKg = parseFloat(nutriProfile.fat_g_per_kg) || 0.9;
  const protein = Math.round(pPerKg * lastWeight);
  const fat = Math.round(fPerKg * lastWeight);

  // Applique l'objectif et le plancher à une dépense donnée, puis en déduit
  // les glucides par différence.
  function cibleDepuis(depense) {
    let t = Math.round(depense * (1 + pct / 100));
    let fl = false;
    if (t < floor) { t = floor; fl = true; }
    let c = Math.round((t - protein * 4 - fat * 9) / 4);
    if (c < 0) c = 0;
    return { tdee: Math.round(depense), target: t, floored: fl, protein, fat, carbs: c };
  }

  const moyen = cibleDepuis(tdee);
  const target = moyen.target;
  const floored = moyen.floored;
  const carbs = moyen.carbs;

  // ── Les deux journées types ──
  // Un jour de séance coûte les calories de CETTE séance, pas la moyenne
  // hebdomadaire. Étaler l'effort sur sept jours sous-alimente les jours durs
  // et sur-alimente les jours de repos : c'est précisément ce qu'on corrige.
  const joursSeance = (week || []).filter(w => w.sessionId != null
    && (sessions || []).some(s => s.id === w.sessionId));
  const nbJoursSeance = joursSeance.length;
  const kcalParSeance = nbJoursSeance > 0 ? weekKcal / nbJoursSeance : 0;

  const train = cibleDepuis(daily + kcalParSeance);
  const rest  = cibleDepuis(daily);
  // Sans programme, les deux journées se valent : on ne fabrique pas une
  // distinction que rien ne justifie.
  const deuxJournees = nbJoursSeance > 0 && nbJoursSeance < 7;

  return {
    ready: true, age, bmr, dailyActivity: Math.round(daily), sportDaily, perSession,
    tdee, pct, target, floored, floor, protein, fat, carbs,
    train, rest, deuxJournees, nbJoursSeance,
    joursSeance: joursSeance.map(w => w.day),
  };
}

// Type de journée d'aujourd'hui, lu dans la structure hebdomadaire du programme.
const JOUR_PAR_INDEX = { 0: "DIMANCHE", 1: "LUNDI", 2: "MARDI", 3: "MERCREDI", 4: "JEUDI", 5: "VENDREDI", 6: "SAMEDI" };
function typeDeJour(week, sessions) {
  const jour = JOUR_PAR_INDEX[new Date().getDay()];
  const entree = (week || []).find(w => w.day === jour);
  if (!entree || entree.sessionId == null) return "repos";
  if (sessions && !sessions.some(s => s.id === entree.sessionId)) return "repos";
  return "entrainement";
}

// ── Helpers Supabase diète ──
async function loadNutritionProfile(supabase, coacheeId) {
  const { data } = await supabase.from("nutrition_profiles").select("*").eq("coachee_id", coacheeId).maybeSingle();
  return data;
}
async function upsertNutritionProfile(supabase, coacheeId, fields) {
  const { data, error } = await supabase.from("nutrition_profiles")
    .upsert({ coachee_id: coacheeId, ...fields, updated_at: new Date().toISOString() }, { onConflict: "coachee_id" })
    .select().single();
  if (error) throw error;
  return data;
}
async function loadWeightLogs(supabase, coacheeId) {
  const { data } = await supabase.from("weight_logs").select("*").eq("coachee_id", coacheeId).order("logged_date", { ascending: true });
  return data || [];
}
async function addWeightLog(supabase, coacheeId, weightKg, dateStr) {
  const { error } = await supabase.from("weight_logs")
    .upsert({ coachee_id: coacheeId, weight_kg: weightKg, logged_date: dateStr }, { onConflict: "coachee_id,logged_date" });
  if (error) throw error;
}
function weightTrend(logs) {
  if (!logs || logs.length < 2) return null;
  const last = logs.slice(-3);
  const delta = parseFloat(last[last.length - 1].weight_kg) - parseFloat(last[0].weight_kg);
  return { delta: Math.round(delta * 10) / 10, points: last.length };
}
function trendAlert(trend, goalPct) {
  if (!trend || trend.points < 3) return null;
  if (goalPct < -3 && trend.delta >= 0) return "Tendance contraire à la sèche : le poids ne baisse pas. Envisage d'ajuster le déficit.";
  if (goalPct > 3 && trend.delta <= 0) return "Stagnation en prise de masse : le poids ne monte pas. Envisage d'augmenter le surplus.";
  return null;
}
// ═══════════════════════════════════════════════════════════════════════════════
//  DIÈTE PERSONNALISÉE FIXE — modèle, tirage et résolution des grammages
//
//  Deux journées types seulement : entraînement et repos. Le tirage des
//  aliments se fait UNE fois, à la génération ; ensuite tout se modifie à la
//  main, aliment par aliment, depuis l'espace coach.
// ═══════════════════════════════════════════════════════════════════════════════

const DIET_MEALS = [
  { id: "petit_dejeuner",  label: "Petit-déjeuner",     court: "PDJ" },
  { id: "collation_matin", label: "Collation du matin", court: "COL. MATIN" },
  { id: "dejeuner",        label: "Déjeuner",           court: "DÉJ" },
  { id: "collation",       label: "Collation",          court: "COLLATION" },
  { id: "diner",           label: "Dîner",              court: "DÎNER" },
];
const dietMealLabel = (id) => (DIET_MEALS.find(m => m.id === id) || {}).label || id;

// Quels repas composent la journée, selon meals_per_day.
const DIET_MEAL_SETS = {
  3: ["petit_dejeuner", "dejeuner", "diner"],
  4: ["petit_dejeuner", "dejeuner", "collation", "diner"],
  5: ["petit_dejeuner", "collation_matin", "dejeuner", "collation", "diner"],
};
// Part des calories de la journée revenant à chaque repas.
// Les collations pèsent 13 à 15 %, pas 10 : elles portent leur part de
// protéines comme les autres repas, et 10 % ne suffisent pas à la loger.
const DIET_MEAL_SHARES = {
  3: { petit_dejeuner: 0.30, dejeuner: 0.40, diner: 0.30 },
  4: { petit_dejeuner: 0.25, dejeuner: 0.32, collation: 0.15, diner: 0.28 },
  5: { petit_dejeuner: 0.22, collation_matin: 0.12, dejeuner: 0.28, collation: 0.13, diner: 0.25 },
};
// Rôles attendus dans chaque repas, dans l'ordre où le solveur les traite.
const DIET_MEAL_COMPO = {
  petit_dejeuner:  ["fruit", "proteine", "matiere_grasse", "feculent"],
  collation_matin: ["fruit", "proteine"],
  dejeuner:        ["legume", "proteine", "matiere_grasse", "feculent"],
  collation:       ["fruit", "proteine"],
  diner:           ["legume", "proteine", "matiere_grasse", "feculent"],
};
// Grammages plancher / plafond par rôle. Ils existent pour une seule raison :
// empêcher le solveur de produire « 480 g d'huile d'olive » quand il n'arrive
// pas à atteindre une cible. Mieux vaut un écart affiché qu'une aberration.
const DIET_BORNES = {
  proteine:       { min: 30, max: 350, defaut: 130 },
  feculent:       { min: 20, max: 400, defaut: 150 },
  legume:         { min: 80, max: 400, defaut: 200 },
  fruit:          { min: 60, max: 300, defaut: 120 },
  matiere_grasse: { min: 5,  max: 60,  defaut: 15  },
  autre:          { min: 5,  max: 300, defaut: 50  },
};
// Rôles servis en portion fixe : on ne fait pas varier les légumes pour
// rattraper 40 kcal. Ils sont posés d'abord, le reste s'ajuste autour.
const DIET_ROLES_FIXES = ["legume", "fruit"];

const macrosItem = (it) => {
  const g = parseFloat(it.grams) || 0;
  return {
    kcal:    (parseFloat(it.kcal_100)    || 0) * g / 100,
    protein: (parseFloat(it.protein_100) || 0) * g / 100,
    carbs:   (parseFloat(it.carbs_100)   || 0) * g / 100,
    fat:     (parseFloat(it.fat_100)     || 0) * g / 100,
    fiber:   (parseFloat(it.fiber_100)   || 0) * g / 100,
  };
};
function totauxItems(items) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  (items || []).forEach(it => {
    const m = macrosItem(it);
    t.kcal += m.kcal; t.protein += m.protein; t.carbs += m.carbs; t.fat += m.fat; t.fiber += m.fiber;
  });
  Object.keys(t).forEach(k => { t[k] = Math.round(t[k]); });
  return t;
}

// Cibles de chaque repas d'une journée.
// Les PROTÉINES sont réparties à parts égales, pas au prorata des calories :
// la synthèse protéique répond à la dose par prise, pas à la taille du repas.
// Une collation à 10 % des calories mérite donc sa part de protéines.
function ciblesParRepas(cibleJour, mealsPerDay) {
  const n = DIET_MEAL_SETS[mealsPerDay] ? mealsPerDay : 4;
  const ids = DIET_MEAL_SETS[n];
  const shares = DIET_MEAL_SHARES[n];
  const protParRepas = cibleJour.protein / ids.length;
  return ids.map(id => {
    const part = shares[id];
    const kcal = cibleJour.target * part;
    const fat = cibleJour.fat * part;
    const carbs = Math.max(0, (kcal - protParRepas * 4 - fat * 9) / 4);
    return { meal_type: id, kcal, protein: protParRepas, fat, carbs };
  });
}

// Aliments utilisables pour un coaché, par rôle et par repas.
//
// L'ORDRE DES FILTRES EST LA MOITIÉ DU TRAVAIL, parce que tous n'ont pas le
// même statut :
//
//   1. Les ALLERGIES ne sont jamais assouplies. Jamais. Même si le repas
//      finit vide, un allergène ne passe pas.
//   2. Les aliments détestés et les préférences (végétarien, halal…) sont
//      assouplis en dernier recours seulement pour les préférences : mieux
//      vaut une diète à retoucher qu'un repas vide.
//   3. Les ALIMENTS HABITUELS du coaché passent avant tout le reste, et
//      échappent aux plafonds de coût et de préparation : si le coach a noté
//      que la personne mange déjà ça, la question du budget est réglée.
//   4. Les plafonds de coût et de préparation ne s'appliquent donc qu'aux
//      aliments qu'on lui ferait découvrir.
function alimentsUtilisables(foods, nutriProfile, role, mealType, habituels) {
  const bas = (s) => (s || "").toLowerCase();
  const allergies = (nutriProfile?.allergies || []).map(bas).filter(Boolean);
  const detestes  = (nutriProfile?.disliked_foods || []).map(bas).filter(Boolean);
  const prefs     = (nutriProfile?.dietary_preferences || []).map(bas).filter(Boolean);

  let base = (foods || []).filter(f => {
    if (f.role !== role) return false;
    const types = f.meal_types || [];
    if (types.length && !types.includes(mealType)) return false;
    const nom = bas(f.name);
    if (allergies.some(a => nom.includes(a))) return false;
    if (detestes.some(d => nom.includes(d))) return false;
    return true;
  });
  if (prefs.length) {
    const conformes = base.filter(f => prefs.every(p => (f.tags || []).map(bas).includes(p)));
    if (conformes.length) base = conformes;
  }
  if (!base.length) return base;

  // Ce qu'il mange déjà, d'abord.
  if (habituels && habituels.size) {
    const siens = base.filter(f => habituels.has(f.id));
    if (siens.length) return siens;
  }
  // Sinon, ce qu'on peut lui demander d'acheter et de cuisiner.
  const maxC = parseInt(nutriProfile?.max_cost_level) || 3;
  const maxP = parseInt(nutriProfile?.max_prep_level) || 3;
  if (maxC >= 3 && maxP >= 3) return base;
  const praticables = base.filter(f =>
    (parseInt(f.cost_level) || 2) <= maxC && (parseInt(f.prep_level) || 2) <= maxP);
  // Aucun aliment praticable pour ce rôle : on rend la main plutôt que de
  // laisser un trou. Le repas sera juste, et l'écart au budget se voit.
  return praticables.length ? praticables : base;
}

// Restreint un tirage aux aliments que le repas peut réellement se payer.
//
// LE PROBLÈME QU'ELLE RÈGLE. Une collation de 285 kcal doit porter sa part de
// protéines — 31 g dans une diète à 124 g réparties sur quatre prises. Avec un
// yaourt à 9 g de protéines pour 100 g, il en faudrait 344 g, soit 334 kcal :
// la collation dépasse son budget avant même le fruit. Avec du skyr à 11 g
// pour 63 kcal, elle tient. La densité de l'aliment n'est donc pas un détail
// de confort, c'est ce qui décide si le repas est réalisable.
//
// On calcule le coût calorique d'un gramme de la macro visée, et on écarte les
// aliments trop coûteux pour ce repas-là. Si aucun ne passe, on garde le moins
// coûteux plutôt que de rendre le repas impossible — un écart affiché vaut
// mieux qu'un trou.
const DIET_MACRO_DU_ROLE = { proteine: ["protein_100", "protein"], feculent: ["carbs_100", "carbs"], matiere_grasse: ["fat_100", "fat"] };
function poolAbordable(pool, role, cibleRepas) {
  const visee = DIET_MACRO_DU_ROLE[role];
  if (!visee) return pool;
  const [champ, macro] = visee;
  const besoin = cibleRepas[macro];
  if (!(besoin > 0)) return pool;
  // 70 % du repas au maximum pour la macro visée : le reste doit rester
  // disponible pour les autres aliments.
  const budget = (cibleRepas.kcal * 0.7) / besoin;
  const cout = (f) => {
    const d = parseFloat(f[champ]) || 0;
    return d > 0 ? (parseFloat(f.kcal_100) || 0) / d : Infinity;
  };
  const abordables = pool.filter(f => cout(f) <= budget);
  if (abordables.length) return abordables;
  const moindre = Math.min(...pool.map(cout));
  return pool.filter(f => cout(f) === moindre);
}

// Résout les grammages d'un repas dont les aliments sont déjà choisis.
//
// POURQUOI CE N'EST PAS UNE SIMPLE DIVISION. Trois macros à viser, et chaque
// aliment les porte toutes les trois : 200 g de yaourt grec apportent des
// protéines, mais aussi des glucides et des lipides qui mangent le budget des
// deux autres aliments. Une passe séquentielle « protéine puis lipide puis
// glucide » se trompe donc systématiquement — mesuré à +25 % sur la cible.
//
// La méthode retenue est une convergence par itérations : chaque aliment est
// recalculé en tenant compte de ce que les AUTRES apportent déjà, et on
// recommence jusqu'à ce que ça se stabilise. Huit tours suffisent largement,
// chaque aliment étant le porteur dominant de sa macro.
//
// Deux corrections finales, qui valent d'être connues :
//   — une matière grasse dont personne n'a plus besoin est RETIRÉE du repas,
//     au lieu d'être ajoutée à sa dose minimale. Un plat déjà gras n'a pas
//     besoin d'une cuillère d'huile pour la forme.
//   — s'il reste un écart calorique, c'est le féculent qui l'absorbe. Les
//     glucides sont la macro d'ajustement : on ne rogne pas les protéines.
function resoudreGrammages(choix, cibleRepas) {
  const bornes = (role) => DIET_BORNES[role] || DIET_BORNES.autre;
  const arrondi = (g) => Math.max(5, Math.round(g / 5) * 5);
  const dens = (f, champ) => parseFloat(f[champ]) || 0;

  const fixes = choix.filter(c => DIET_ROLES_FIXES.includes(c.role));
  const VISEES = { proteine: ["protein_100", "protein"], matiere_grasse: ["fat_100", "fat"], feculent: ["carbs_100", "carbs"] };
  const ajustables = choix.filter(c => VISEES[c.role]);
  // Tout ce qui n'entre dans aucune des deux familles garde sa portion usuelle.
  const autres = choix.filter(c => !fixes.includes(c) && !ajustables.includes(c));

  const g = new Map();
  [...fixes, ...autres].forEach(c => g.set(c, arrondi(parseFloat(c.food.portion_g) || bornes(c.role).defaut)));
  ajustables.forEach(c => g.set(c, bornes(c.role).defaut));

  // Apport total d'une macro, en excluant éventuellement un aliment.
  const apport = (champ, sauf) => choix.reduce((s, c) =>
    c === sauf ? s : s + dens(c.food, champ) * (g.get(c) || 0) / 100, 0);

  for (let tour = 0; tour < 8; tour++) {
    for (const c of ajustables) {
      const [champ, macro] = VISEES[c.role];
      const b = bornes(c.role);
      const densite = dens(c.food, champ);
      const besoin = cibleRepas[macro] - apport(champ, c);
      let val = densite > 0 ? (besoin / densite) * 100 : b.defaut;
      g.set(c, arrondi(Math.min(b.max, Math.max(b.min, val))));
    }
  }

  // Retrait d'une matière grasse superflue : elle est au plancher alors que
  // le repas dépasse déjà sa cible de lipides.
  let retenus = [...fixes, ...autres, ...ajustables];
  for (const c of ajustables.filter(c => c.role === "matiere_grasse")) {
    const b = bornes(c.role);
    if (g.get(c) <= b.min && apport("fat_100", c) > cibleRepas.fat * 1.05) {
      retenus = retenus.filter(x => x !== c);
      g.delete(c);
    }
  }

  // Correction calorique finale, portée par le féculent.
  const feculent = retenus.find(c => c.role === "feculent");
  if (feculent) {
    const kcalTotal = () => retenus.reduce((s, c) => s + dens(c.food, "kcal_100") * (g.get(c) || 0) / 100, 0);
    const ecart = kcalTotal() - cibleRepas.kcal;
    const densKcal = dens(feculent.food, "kcal_100");
    if (Math.abs(ecart) > 20 && densKcal > 0) {
      const b = bornes("feculent");
      g.set(feculent, arrondi(Math.min(b.max, Math.max(b.min, g.get(feculent) - (ecart / densKcal) * 100))));
    }
  }

  // On rétablit l'ordre de présentation du repas, pas l'ordre de résolution :
  // le coaché lit « poulet, riz, brocolis », pas « brocolis, poulet… ».
  return choix.filter(c => retenus.includes(c)).map(c => ({ ...c, grams: g.get(c) }));
}

// Tire une diète complète : deux journées types, leurs repas, leurs aliments.
// `alea` est injectable pour que les tests soient reproductibles.
function genererDiete({ cibles, nutriProfile, foods, habituels, alea = Math.random }) {
  const mealsPerDay = DIET_MEAL_SETS[parseInt(nutriProfile?.meals_per_day)] ? parseInt(nutriProfile.meals_per_day) : 4;
  const habitude = habituels instanceof Set ? habituels : new Set(habituels || []);
  const journees = [];
  const manquants = new Set();

  for (const dayType of ["entrainement", "repos"]) {
    const cibleJour = dayType === "entrainement" ? cibles.train : cibles.rest;
    const repas = ciblesParRepas(cibleJour, mealsPerDay).map((cible, i) => {
      const roles = DIET_MEAL_COMPO[cible.meal_type] || [];
      // Un aliment ne revient pas deux fois dans la même journée : la variété
      // au sein d'une journée compte plus que la variété entre les deux.
      const dejaVus = new Set();
      const choix = [];
      for (const role of roles) {
        let pool = alimentsUtilisables(foods, nutriProfile, role, cible.meal_type, habitude)
          .filter(f => !dejaVus.has(f.id));
        if (!pool.length) { manquants.add(role); continue; }
        pool = poolAbordable(pool, role, cible);
        const food = pool[Math.floor(alea() * pool.length)];
        dejaVus.add(food.id);
        choix.push({ food, role });
      }
      return {
        meal_type: cible.meal_type,
        meal_order: i,
        cible,
        items: resoudreGrammages(choix, cible).map((c, j) => ({
          food_id: c.food.id,
          food_name: c.food.name,
          grams: c.grams,
          kcal_100: c.food.kcal_100,
          protein_100: c.food.protein_100,
          carbs_100: c.food.carbs_100,
          fat_100: c.food.fat_100,
          fiber_100: c.food.fiber_100,
          item_order: j,
        })),
      };
    });
    journees.push({ day_type: dayType, repas });
  }
  return { mealsPerDay, journees, manquants: [...manquants] };
}

// Recalcule les grammages d'un repas SANS changer les aliments.
// C'est le bouton « ajuster aux cibles » : le coach a remplacé un aliment à la
// main, les totaux ont bougé, il veut retomber sur la cible sans tout refaire.
function ajusterRepas(items, cibleRepas, foods) {
  const roleDe = (it) => {
    const f = (foods || []).find(x => x.id === it.food_id);
    if (f) return f.role;
    // Aliment dont la fiche a disparu de la base : on le classe d'après ses
    // propres macros, ce qui reste plus juste que de l'ignorer.
    const p = parseFloat(it.protein_100) || 0, c = parseFloat(it.carbs_100) || 0, g = parseFloat(it.fat_100) || 0;
    if (g * 9 > (p * 4 + c * 4) * 1.5) return "matiere_grasse";
    if (p * 4 > c * 4) return "proteine";
    return "feculent";
  };
  const choix = items.map(it => ({ role: roleDe(it), food: { ...it, id: it.food_id, portion_g: it.grams } }));
  const resolus = resoudreGrammages(choix, cibleRepas);
  return items.map((it, i) => ({ ...it, grams: (resolus.find(r => r.food.id === it.food_id) || resolus[i] || it).grams }));
}

// ── Helpers Supabase diète fixe ──
async function loadFoods(supabase, coachId) {
  const { data, error } = await supabase.from("foods").select("*").order("name");
  if (error) throw error;
  // La policy filtre déjà : base commune + aliments du coach connecté.
  return data || [];
}
// Les aliments que le coaché mange déjà, validés par le coach.
async function loadHabituels(supabase, coacheeId) {
  const { data, error } = await supabase.from("coachee_staples")
    .select("id, food_id").eq("coachee_id", coacheeId);
  if (error) throw error;
  return data || [];
}
async function loadDiete(supabase, coacheeId) {
  const { data: plan, error } = await supabase.from("diet_plans").select("*").eq("coachee_id", coacheeId).maybeSingle();
  if (error) throw error;
  if (!plan) return null;
  const { data: repas } = await supabase.from("diet_meals").select("*").eq("plan_id", plan.id).order("meal_order");
  const ids = (repas || []).map(r => r.id);
  let items = [];
  if (ids.length) {
    const { data } = await supabase.from("diet_items").select("*").in("meal_id", ids).order("item_order");
    items = data || [];
  }
  return { plan, repas: repas || [], items };
}
async function enregistrerDiete(supabase, coacheeId, cibles, diete, note) {
  const payload = {
    coachee_id: coacheeId,
    meals_per_day: diete.mealsPerDay,
    kcal_train: cibles.train.target, prot_train: cibles.train.protein,
    carbs_train: cibles.train.carbs,  fat_train:  cibles.train.fat,
    kcal_rest:  cibles.rest.target,   prot_rest:  cibles.rest.protein,
    carbs_rest: cibles.rest.carbs,    fat_rest:   cibles.rest.fat,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (note !== undefined) payload.note = note;
  const { data: plan, error } = await supabase.from("diet_plans")
    .upsert(payload, { onConflict: "coachee_id" }).select().single();
  if (error) throw error;

  // Les repas sont remplacés en bloc : la cascade emporte leurs aliments.
  await supabase.from("diet_meals").delete().eq("plan_id", plan.id);
  for (const j of diete.journees) {
    for (const r of j.repas) {
      const { data: repas, error: eR } = await supabase.from("diet_meals")
        .insert({ plan_id: plan.id, day_type: j.day_type, meal_type: r.meal_type, meal_order: r.meal_order })
        .select().single();
      if (eR) throw eR;
      if (r.items.length) {
        const { error: eI } = await supabase.from("diet_items")
          .insert(r.items.map(it => ({ ...it, meal_id: repas.id })));
        if (eI) throw eI;
      }
    }
  }
  return plan;
}

// Choix d'un aliment : recherche, filtre par rôle, et création d'un aliment
// maison quand la base ne couvre pas le besoin.
//
// Les aliments écartés par une ALLERGIE ne sont pas seulement dépriorisés,
// ils sont absents de la liste : un aliment allergène ne doit jamais pouvoir
// être choisi par erreur, même à la main, même par le coach.
const DIET_ROLE_LABELS = [
  ["proteine", "Protéines"], ["feculent", "Féculents"], ["legume", "Légumes"],
  ["fruit", "Fruits"], ["matiere_grasse", "Matières grasses"], ["autre", "Autres"],
];
function FoodPickerSheet({ foods, nutri, coachId, supabase, mealType, itemRemplace, titre, onChoose, onCreated, onClose }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [creation, setCreation] = useState(null);
  const [err, setErr] = useState("");

  const allergies = (nutri?.allergies || []).map(a => (a || "").toLowerCase()).filter(Boolean);
  const liste = useMemo(() => {
    const terme = q.trim().toLowerCase();
    return (foods || [])
      .filter(f => !allergies.some(a => (f.name || "").toLowerCase().includes(a)))
      .filter(f => !role || f.role === role)
      .filter(f => !terme || (f.name || "").toLowerCase().includes(terme))
      .slice(0, 120);
  }, [foods, q, role, allergies.join("|")]);

  async function creer() {
    const c = creation;
    if (!c.name.trim() || !(parseFloat(c.kcal_100) >= 0)) { setErr("Nom et calories sont obligatoires"); return; }
    try {
      const { data, error } = await supabase.from("foods").insert({
        coach_id: coachId, name: c.name.trim(), role: c.role,
        kcal_100: parseFloat(c.kcal_100) || 0,
        protein_100: parseFloat(c.protein_100) || 0,
        carbs_100: parseFloat(c.carbs_100) || 0,
        fat_100: parseFloat(c.fat_100) || 0,
      }).select().single();
      if (error) throw error;
      onCreated(data);
      onChoose(data);
    } catch (e) { setErr("Erreur : " + e.message); }
  }

  return (
    <Portail>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.45)", zIndex: 500, animation: "fadeIn .2s ease" }}/>
      <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 501, background: T.bg, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 50px rgba(30,40,32,0.25)", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 18px 10px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 17, letterSpacing: 1.6, color: T.text }}>
              {titre || (itemRemplace ? "REMPLACER " + itemRemplace.food_name.toUpperCase() : "AJOUTER UN ALIMENT")}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: T.textMuted, cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          {!creation && (<>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un aliment"
              style={{ ...inputStyle, marginBottom: 8 }}/>
            <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2 }}>
              <button onClick={() => setRole("")} style={{ padding: "6px 10px", background: !role ? T.accent : T.surface, color: !role ? "white" : T.textSub, border: `1px solid ${!role ? T.accent : T.border}`, borderRadius: 12, fontSize: 9.5, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 }}>Tous</button>
              {DIET_ROLE_LABELS.map(([id, lab]) => (
                <button key={id} onClick={() => setRole(id)} style={{ padding: "6px 10px", background: role === id ? T.accent : T.surface, color: role === id ? "white" : T.textSub, border: `1px solid ${role === id ? T.accent : T.border}`, borderRadius: 12, fontSize: 9.5, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 }}>{lab}</button>
              ))}
            </div>
          </>)}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 18px calc(20px + env(safe-area-inset-bottom))" }}>
          {err && <div style={{ fontSize: 11, color: T.danger, fontWeight: 700, marginBottom: 8 }}>{err}</div>}
          {creation ? (
            <div>
              <Field label="NOM"><input value={creation.name} onChange={e => setCreation({ ...creation, name: e.target.value })} placeholder="Skyr nature" style={inputStyle}/></Field>
              <Field label="RÔLE DANS LE REPAS">
                <select value={creation.role} onChange={e => setCreation({ ...creation, role: e.target.value })} style={inputStyle}>
                  {DIET_ROLE_LABELS.map(([id, lab]) => <option key={id} value={id}>{lab}</option>)}
                </select>
              </Field>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: 1, margin: "4px 0 8px" }}>VALEURS POUR 100 G</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="CALORIES"><input type="number" min="0" value={creation.kcal_100} onChange={e => setCreation({ ...creation, kcal_100: e.target.value })} style={inputStyle}/></Field>
                <Field label="PROTÉINES (G)"><input type="number" min="0" step="0.1" value={creation.protein_100} onChange={e => setCreation({ ...creation, protein_100: e.target.value })} style={inputStyle}/></Field>
                <Field label="GLUCIDES (G)"><input type="number" min="0" step="0.1" value={creation.carbs_100} onChange={e => setCreation({ ...creation, carbs_100: e.target.value })} style={inputStyle}/></Field>
                <Field label="LIPIDES (G)"><input type="number" min="0" step="0.1" value={creation.fat_100} onChange={e => setCreation({ ...creation, fat_100: e.target.value })} style={inputStyle}/></Field>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button onClick={() => { setCreation(null); setErr(""); }} style={{ flex: 1, padding: 13, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, fontSize: 12, fontWeight: 700, color: T.textSub, cursor: "pointer" }}>Annuler</button>
                <button onClick={creer} style={{ flex: 2, padding: 13, background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 13, fontSize: 12, fontWeight: 800, letterSpacing: 1, cursor: "pointer" }}>CRÉER ET UTILISER</button>
              </div>
            </div>
          ) : (<>
            {liste.length === 0 ? (
              <div style={{ textAlign: "center", color: T.textMuted, fontSize: 12, padding: "24px 10px", lineHeight: 1.6 }}>
                Aucun aliment ne correspond.<br/>Crée le tien ci-dessous.
              </div>
            ) : liste.map(f => {
              const horsRepas = mealType && (f.meal_types || []).length && !(f.meal_types || []).includes(mealType);
              return (
                <button key={f.id} onClick={() => onChoose(f)} className="pressable" style={{ width: "100%", textAlign: "left", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, opacity: horsRepas ? 0.55 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text, lineHeight: 1.35 }}>{f.name}</div>
                    <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 2 }}>
                      {Math.round(f.kcal_100)} kcal · P{Math.round(f.protein_100)} G{Math.round(f.carbs_100)} L{Math.round(f.fat_100)} / 100 g
                      {" · "}{"€".repeat(parseInt(f.cost_level) || 2)}
                      {" · "}{["immédiat", "à cuisiner", "long"][(parseInt(f.prep_level) || 2) - 1]}
                      {f.coach_id ? " · à toi" : ""}{horsRepas ? " · inhabituel à ce repas" : ""}
                    </div>
                  </div>
                  <Icon name="chevronRight" size={16} color={T.borderStrong}/>
                </button>
              );
            })}
            <button onClick={() => setCreation({ name: q, role: "proteine", kcal_100: "", protein_100: "", carbs_100: "", fat_100: "" })}
              style={{ width: "100%", padding: 12, marginTop: 6, background: T.surface2, border: `1px dashed ${T.borderStrong}`, borderRadius: 12, fontSize: 11, fontWeight: 700, color: T.textSub, cursor: "pointer" }}>
              CRÉER UN ALIMENT
            </button>
          </>)}
        </div>
      </div>
    </Portail>
  );
}

// ── Composants UI diète partagés ──
function MacroRing({ label, value, unit, color, size = 84 }) {
  const R = size / 2 - 7, circ = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={R} fill="none" stroke={T.surface2} strokeWidth="7"/>
          <circle cx={size/2} cy={size/2} r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * 0.25} style={{ transition: "stroke-dashoffset .6s ease" }}/>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: size * 0.26, color: T.text, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 8, color: T.textMuted, fontWeight: 700 }}>{unit}</div>
        </div>
      </div>
      <div style={{ fontSize: 9, color: T.textSub, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
    </div>
  );
}
function WeightChart({ logs }) {
  if (!logs || logs.length < 2) return (
    <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 12 }}>
      {logs && logs.length === 1 ? "Une seule pesée enregistrée — la courbe apparaîtra dès la prochaine." : "Aucune pesée enregistrée pour le moment."}
    </div>
  );
  const data = logs.slice(-12);
  const W = 300, H = 110, PAD = 22;
  const vals = data.map(l => parseFloat(l.weight_kg));
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = Math.max(max - min, 1);
  const pts = data.map((l, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((parseFloat(l.weight_kg) - min) / range) * (H - PAD * 2);
    return { x, y, v: parseFloat(l.weight_kg) };
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <path d={path} fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={T.accent}/>
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="8" fill={T.textSub} fontWeight="700">{p.v}</text>
        </g>
      ))}
    </svg>
  );
}
// ── Sous-vue coach : Nutrition d'un coaché ──
function CoachNutritionView({ ctx, coachee }) {
  const { supabase, coachId } = ctx;
  const [loading, setLoading] = useState(true);
  const [nutri, setNutri] = useState(null);
  const [clientProfile, setClientProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [program, setProgram] = useState(null);
  const [foods, setFoods] = useState([]);
  const [diete, setDiete] = useState(null);
  const [retours, setRetours] = useState([]);
  const [consent, setConsent] = useState(null);
  const [phases, setPhases] = useState([]);
  const [dieteAbsente, setDieteAbsente] = useState(false); // migration pas encore jouée
  const [habituels, setHabituels] = useState([]);          // [{ id, food_id }]
  const [pickerHabitude, setPickerHabitude] = useState(false);
  // La praticité est arrivée après la diète : elle a sa propre migration, donc
  // son propre garde-fou. Sans lui, un coach qui a joué la première migration
  // mais pas la seconde verrait une erreur en touchant un curseur.
  const [praticiteAbsente, setPraticiteAbsente] = useState(false);
  const [jourVu, setJourVu] = useState("entrainement");
  const [picker, setPicker] = useState(null); // { mealId, item } — remplacement ou ajout
  const [section, setSection] = useState("parametres"); // parametres | sante | cibles | diete | poids
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [{ data: prof }, np, wl, prog, phs] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", coachee.id).single(),
      loadNutritionProfile(supabase, coachee.id),
      loadWeightLogs(supabase, coachee.id),
      loadActiveProgram(supabase, coachee.id),
      loadPhases(supabase, coachee.id),
    ]);
    setPhases(phs);
    setClientProfile(prof);
    setNutri(np || { coachee_id: coachee.id, allergies: [], dietary_preferences: [], disliked_foods: [], medical_flag: false, ed_screening_flag: false, consent_disclaimer: false, activity_factor: 1.2, goal_adjustment_pct: 0, meals_per_day: 4, protein_g_per_kg: 2.0, fat_g_per_kg: 0.9, session_intensity: {} });
    setLogs(wl);
    setProgram(prog);
    // La diète et sa base d'aliments. Tant que la migration n'est pas jouée,
    // l'onglet Nutrition doit rester utilisable : paramètres, cibles et poids
    // n'ont besoin d'aucune de ces tables.
    try {
      const [f, d] = await Promise.all([loadFoods(supabase, coachId), loadDiete(supabase, coachee.id)]);
      setFoods(f); setDiete(d); setDieteAbsente(false);
      // La liste des habitudes est arrivée après la diète : son absence ne doit
      // pas rendre l'onglet inutilisable chez qui n'a pas joué la migration.
      try {
        setHabituels(await loadHabituels(supabase, coachee.id));
        setPraticiteAbsente(false);
      } catch (e) {
        if (tableAbsente(e)) setPraticiteAbsente(true); else throw e;
      }
      const { data: fb } = await supabase.from("diet_feedback").select("*")
        .eq("coachee_id", coachee.id).order("created_at", { ascending: false });
      setRetours(fb || []);
      const { data: c } = await supabase.from("diet_consents").select("*")
        .eq("coachee_id", coachee.id).eq("version", DIET_CONSENT_VERSION)
        .order("accepted_at", { ascending: false }).limit(1).maybeSingle();
      setConsent(c || false);
    } catch (e) {
      if (tableAbsente(e)) setDieteAbsente(true); else throw e;
    }
    setLoading(false);
  }, [supabase, coachee.id, coachId]);
  useEffect(() => { reload(); }, [reload]);

  const lastWeight = logs.length ? parseFloat(logs[logs.length - 1].weight_kg) : null;
  const activePhase = findActivePhase(phases);
  const targets = useMemo(() => computeNutritionTargets({
    clientProfile, nutriProfile: nutri, lastWeight,
    sessions: program?.sessions_structure, week: program?.week_structure,
    activePhasePct: activePhase ? activePhase.goal_adjustment_pct : null,
  }), [clientProfile, nutri, lastWeight, program, activePhase]);
  const trend = weightTrend(logs);
  const alert = trendAlert(trend, parseInt(nutri?.goal_adjustment_pct) || 0);

  async function saveParams(extraProfileFields, extraNutriFields) {
    setBusy(true); setMsg("");
    try {
      if (extraProfileFields) {
        const { error } = await supabase.from("profiles").update(extraProfileFields).eq("id", coachee.id);
        if (error) throw error;
        setClientProfile({ ...clientProfile, ...extraProfileFields });
      }
      if (extraNutriFields) {
        const saved = await upsertNutritionProfile(supabase, coachee.id, { ...stripNutri(nutri), ...extraNutriFields });
        setNutri(saved);
      }
      setMsg("Enregistré ✓");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) { setMsg("Erreur : " + e.message); }
    setBusy(false);
  }
  function stripNutri(n) {
    const { id, coachee_id, updated_at, ...rest } = n || {};
    return rest;
  }
  function updNutri(field, val) { setNutri({ ...nutri, [field]: val }); }

  // ── Diète ─────────────────────────────────────────────────────────────────
  //
  // Le CONSENTEMENT n'est plus une condition pour générer : il appartient
  // désormais au coaché, qui le donne depuis son compte avant de voir sa
  // première diète. Le coach doit donc pouvoir la préparer AVANT — sinon
  // personne ne peut commencer, chacun attendant l'autre.
  //
  // Le garde-fou TCA, lui, reste : il ne dépend d'aucun accord et protège une
  // personne qui n'est pas en mesure de se protéger elle-même.
  async function genererLaDiete() {
    if (!targets.ready) { setMsg("Complète d'abord les paramètres et saisis une pesée"); return; }
    if (nutri.ed_screening_flag && targets.pct < 0) {
      setMsg("Profil sensible (antécédent TCA) : pas de diète en déficit automatique. Accompagnement professionnel recommandé — gestion manuelle uniquement.");
      return;
    }
    if (!foods.length) { setMsg("La base d'aliments est vide : la table Ciqual n'a pas encore été importée"); return; }
    setBusy(true); setMsg("");
    try {
      const d = genererDiete({ cibles: targets, nutriProfile: nutri, foods, habituels: idsHabituels });
      if (d.manquants.length) {
        setMsg("Aucun aliment disponible pour : " + d.manquants.join(", ") + ". Vérifie les allergies et les aliments détestés.");
        setBusy(false); return;
      }
      await enregistrerDiete(supabase, coachee.id, targets, d, diete?.plan?.note);
      setDiete(await loadDiete(supabase, coachee.id));
      setMsg("Diète générée ✓");
    } catch (e) { setMsg("Erreur : " + e.message); }
    setBusy(false);
  }

  async function majItem(item, champs) {
    await supabase.from("diet_items").update(champs).eq("id", item.id);
    setDiete(await loadDiete(supabase, coachee.id));
  }
  async function supprimerItem(item) {
    await supabase.from("diet_items").delete().eq("id", item.id);
    setDiete(await loadDiete(supabase, coachee.id));
  }
  // Remplacement et ajout partagent le même chemin : un aliment choisi arrive
  // avec un grammage de départ, et le coach l'affine ensuite.
  async function poserAliment(mealId, food, itemRemplace) {
    const b = DIET_BORNES[food.role] || DIET_BORNES.autre;
    const grams = itemRemplace ? itemRemplace.grams : (parseFloat(food.portion_g) || b.defaut);
    const payload = {
      food_id: food.id, food_name: food.name, grams,
      kcal_100: food.kcal_100, protein_100: food.protein_100,
      carbs_100: food.carbs_100, fat_100: food.fat_100, fiber_100: food.fiber_100,
    };
    if (itemRemplace) {
      await supabase.from("diet_items").update(payload).eq("id", itemRemplace.id);
    } else {
      const dejaLa = diete.items.filter(i => i.meal_id === mealId).length;
      await supabase.from("diet_items").insert({ ...payload, meal_id: mealId, item_order: dejaLa });
    }
    setPicker(null);
    setDiete(await loadDiete(supabase, coachee.id));
  }
  // Recalcule les grammages d'un repas sans en changer les aliments.
  async function ajusterLeRepas(repas, cibleRepas) {
    const items = diete.items.filter(i => i.meal_id === repas.id).sort((a, b) => a.item_order - b.item_order);
    if (!items.length) return;
    setBusy(true);
    try {
      const ajustes = ajusterRepas(items, cibleRepas, foods);
      for (const it of ajustes) {
        const avant = items.find(x => x.id === it.id);
        if (avant && Math.round(avant.grams) !== Math.round(it.grams)) {
          await supabase.from("diet_items").update({ grams: it.grams }).eq("id", it.id);
        }
      }
      setDiete(await loadDiete(supabase, coachee.id));
    } catch (e) { setMsg("Erreur : " + e.message); }
    setBusy(false);
  }
  async function ajouterHabitude(food) {
    setPickerHabitude(false);
    if (habituels.some(h => h.food_id === food.id)) return;
    const { error } = await supabase.from("coachee_staples")
      .insert({ coachee_id: coachee.id, food_id: food.id });
    if (error) { setMsg("Erreur : " + error.message); return; }
    setHabituels(await loadHabituels(supabase, coachee.id));
  }
  async function retirerHabitude(h) {
    await supabase.from("coachee_staples").delete().eq("id", h.id);
    setHabituels(hs => hs.filter(x => x.id !== h.id));
  }

  async function traiterRetour(r, ajouterAuxDetestes) {
    if (ajouterAuxDetestes) {
      const liste = [...new Set([...(nutri.disliked_foods || []), r.food_name])];
      const saved = await upsertNutritionProfile(supabase, coachee.id, { ...stripNutri(nutri), disliked_foods: liste });
      setNutri(saved);
    }
    await supabase.from("diet_feedback").delete().eq("id", r.id);
    setRetours(rs => rs.filter(x => x.id !== r.id));
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24}/></div>;
  if ((coachee.offer || "essentiel") !== "premium") return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "26px 20px", textAlign: "center", color: T.textMuted, fontSize: 13, lineHeight: 1.6 }}>
      Ce coaché est en offre Essentiel.<br/>Le module diète est réservé à l'offre <b style={{ color: T.warnText }}>Premium</b>.
    </div>
  );

  const sectionBtn = (id, label) => (
    <button key={id} onClick={() => setSection(id)} style={{ padding: "7px 11px", background: section === id ? T.accent : T.surface, color: section === id ? "white" : T.textSub, border: `1px solid ${section === id ? T.accent : T.border}`, borderRadius: 14, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 }}>{label}</button>
  );
  // Volontairement PAS des hooks : on est ici après les `return` anticipés du
  // composant (chargement, offre Essentiel). Un useMemo placé après un return
  // n'est pas appelé à tous les rendus, et React refuse de rendre le composant.
  const idsHabituels = new Set(habituels.map(h => h.food_id));
  const foodById = (id) => foods.find(f => f.id === id);

  // Repas de la journée affichée, garnis de leurs aliments et de leur cible.
  const cibleJourVu = targets.ready ? (jourVu === "entrainement" ? targets.train : targets.rest) : null;
  const ciblesRepas = cibleJourVu ? ciblesParRepas(cibleJourVu, diete?.plan?.meals_per_day || parseInt(nutri.meals_per_day) || 4) : [];
  const repasVus = diete
    ? diete.repas.filter(r => r.day_type === jourVu).sort((a, b) => a.meal_order - b.meal_order)
        .map(r => ({
          ...r,
          items: diete.items.filter(i => i.meal_id === r.id).sort((a, b) => a.item_order - b.item_order),
          cible: ciblesRepas.find(c => c.meal_type === r.meal_type) || null,
        }))
    : [];
  // Dérive : la cible d'aujourd'hui contre celle figée à la génération. Un
  // coaché qui a pris 3 kg n'a plus les mêmes besoins, et rien ne le signale
  // sinon.
  const derive = (diete && targets.ready && diete.plan.kcal_train != null)
    ? targets.train.target - diete.plan.kcal_train : 0;

  return (
    <div className="fade-in">
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12 }}>
        {sectionBtn("parametres", "Paramètres")}{sectionBtn("sante", "Santé")}{sectionBtn("cibles", "Cibles")}{sectionBtn("diete", "Diète")}{sectionBtn("poids", "Poids")}
      </div>
      {msg && <div style={{ fontSize: 11, color: msg.includes("Erreur") || msg.includes("requis") || msg.includes("sensible") ? T.danger : T.accent, fontWeight: 700, textAlign: "center", marginBottom: 10, lineHeight: 1.5 }}>{msg}</div>}
      {nutri.medical_flag && (
        <div style={{ background: T.warnBg, border: "1px solid var(--warn-border)", borderRadius: 10, padding: "9px 12px", marginBottom: 12, fontSize: 11, color: T.warnText, lineHeight: 1.5, fontWeight: 600 }}>
          Pathologie déclarée : l'avis d'un médecin ou diététicien est recommandé avant toute mise en place.
        </div>
      )}

      {section === "parametres" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="SEXE">
              <select value={clientProfile?.sex || ""} onChange={e => setClientProfile({ ...clientProfile, sex: e.target.value })} style={inputStyle}>
                <option value="">—</option><option value="homme">Homme</option><option value="femme">Femme</option>
              </select>
            </Field>
            <Field label="TAILLE (CM)">
              <input type="number" value={clientProfile?.height_cm || ""} onChange={e => setClientProfile({ ...clientProfile, height_cm: e.target.value ? parseInt(e.target.value) : null })} placeholder="178" style={inputStyle}/>
            </Field>
          </div>
          <Field label="DATE DE NAISSANCE">
            <input type="date" value={clientProfile?.birth_date || ""} onChange={e => setClientProfile({ ...clientProfile, birth_date: e.target.value })} style={{ ...inputStyle, WebkitAppearance: "none", appearance: "none", maxWidth: "100%", display: "block" }}/>
          </Field>
          <Field label="ACTIVITÉ QUOTIDIENNE (HORS SPORT)">
            <select value={nutri.activity_factor} onChange={e => updNutri("activity_factor", parseFloat(e.target.value))} style={inputStyle}>
              {ACTIVITY_FACTORS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
          <Field label={`OBJECTIF : ${nutri.goal_adjustment_pct > 0 ? "+" : ""}${nutri.goal_adjustment_pct}% (surplus / déficit)`}>
            <input type="range" min="-25" max="25" step="1" value={nutri.goal_adjustment_pct} onChange={e => updNutri("goal_adjustment_pct", parseInt(e.target.value))} style={{ width: "100%", accentColor: T.accent }}/>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.textMuted, fontWeight: 700 }}><span>−25% (sèche)</span><span>0</span><span>+25% (masse)</span></div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="REPAS / JOUR">
              <select value={nutri.meals_per_day} onChange={e => updNutri("meals_per_day", parseInt(e.target.value))} style={inputStyle}>
                <option value={3}>3</option><option value={4}>4</option>
              </select>
            </Field>
            <Field label="PROT (G/KG)">
              <input type="number" step="0.1" min="1" max="2.4" value={nutri.protein_g_per_kg} onChange={e => updNutri("protein_g_per_kg", e.target.value)} style={inputStyle}/>
            </Field>
            <Field label="LIP (G/KG)">
              <input type="number" step="0.1" min="0.5" max="1.5" value={nutri.fat_g_per_kg} onChange={e => updNutri("fat_g_per_kg", e.target.value)} style={inputStyle}/>
            </Field>
          </div>
          {program && (
            <Field label="INTENSITÉ PAR SÉANCE (estimation calorique)">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(program.sessions_structure || []).map(s => {
                  const v = parseFloat((nutri.session_intensity || {})[String(s.id)]) || 1.0;
                  return (
                    <div key={s.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                        <span>{s.name}</span><span style={{ color: T.accent }}>×{v.toFixed(2)}</span>
                      </div>
                      <input type="range" min="0.8" max="1.3" step="0.05" value={v} onChange={e => updNutri("session_intensity", { ...(nutri.session_intensity || {}), [String(s.id)]: parseFloat(e.target.value) })} style={{ width: "100%", accentColor: T.accent }}/>
                    </div>
                  );
                })}
              </div>
            </Field>
          )}
          <button onClick={() => saveParams({ sex: clientProfile?.sex || null, birth_date: clientProfile?.birth_date || null, height_cm: clientProfile?.height_cm || null }, stripNutri(nutri))} disabled={busy} style={{ width: "100%", padding: "14px", background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: "pointer" }}>
            {busy ? "..." : "ENREGISTRER LES PARAMÈTRES"}
          </button>
        </div>
      )}

      {section === "sante" && (
        <div>
          <Field label="ALLERGIES (séparées par des virgules)">
            <input type="text" value={(nutri.allergies || []).join(", ")} onChange={e => updNutri("allergies", e.target.value.split(",").map(x => x.trim()).filter(Boolean))} placeholder="arachide, lactose" style={inputStyle}/>
          </Field>
          <Field label="PRÉFÉRENCES / RESTRICTIONS (tags de recettes)">
            <input type="text" value={(nutri.dietary_preferences || []).join(", ")} onChange={e => updNutri("dietary_preferences", e.target.value.split(",").map(x => x.trim().toLowerCase()).filter(Boolean))} placeholder="vegetarien, halal, sans porc" style={inputStyle}/>
          </Field>
          {/* Ce qu'il mange déjà. Le levier le plus fort sur le suivi : on ne
              demande à personne de tout changer d'un coup. */}
          {!dieteAbsente && !praticiteAbsente && (
            <Field label="ALIMENTS HABITUELS (LE GÉNÉRATEUR Y PIOCHE EN PRIORITÉ)">
              {habituels.length === 0 ? (
                <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
                  Rien pour l'instant. Ajoute ce qu'il mange déjà et que tu valides pour une diète
                  de sportif — sa diète se construira autour, il aura beaucoup moins à changer.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {habituels.map(h => {
                    const f = foodById(h.food_id);
                    return (
                      <span key={h.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.accentLight, border: `1px solid ${T.accent}44`, borderRadius: 10, padding: "5px 8px", fontSize: 11, color: T.text }}>
                        {f ? f.name : "aliment retiré de la base"}
                        <button onClick={() => retirerHabitude(h)} style={{ background: "none", border: "none", color: T.accent, fontSize: 13, cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
                      </span>
                    );
                  })}
                </div>
              )}
              <button onClick={() => setPickerHabitude(true)} style={{ width: "100%", padding: 10, background: T.surface2, border: `1px dashed ${T.borderStrong}`, borderRadius: 10, fontSize: 11, fontWeight: 700, color: T.textSub, cursor: "pointer" }}>
                AJOUTER UN ALIMENT HABITUEL
              </button>
            </Field>
          )}
          <Field label="ALIMENTS DÉTESTÉS">
            <input type="text" value={(nutri.disliked_foods || []).join(", ")} onChange={e => updNutri("disliked_foods", e.target.value.split(",").map(x => x.trim()).filter(Boolean))} placeholder="brocoli, thon" style={inputStyle}/>
          </Field>
          <Field label="SITUATION MÉDICALE">
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={() => updNutri("medical_flag", !nutri.medical_flag)} style={{ flex: 1, padding: "11px", background: nutri.medical_flag ? T.warnBg : T.surface, color: nutri.medical_flag ? T.warnText : T.textSub, border: `1.5px solid ${nutri.medical_flag ? T.warnText : T.border}`, borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {nutri.medical_flag ? "Pathologie déclarée" : "Aucune pathologie déclarée"}
              </button>
            </div>
            {nutri.medical_flag && <textarea value={nutri.medical_notes || ""} onChange={e => updNutri("medical_notes", e.target.value)} rows={2} placeholder="Notes (diabète, traitement...)" style={{ ...inputStyle, resize: "vertical" }}/>}
          </Field>
          <Field label="ANTÉCÉDENT DE TROUBLE ALIMENTAIRE (déclaré avec bienveillance)">
            <button onClick={() => updNutri("ed_screening_flag", !nutri.ed_screening_flag)} style={{ width: "100%", padding: "11px", background: nutri.ed_screening_flag ? "var(--cmp-down-bg)" : T.surface, color: nutri.ed_screening_flag ? "var(--cmp-down-text)" : T.textSub, border: `1.5px solid ${nutri.ed_screening_flag ? T.danger : T.border}`, borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {nutri.ed_screening_flag ? "Antécédent / risque signalé — pas de déficit automatique" : "Aucun antécédent signalé"}
            </button>
          </Field>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>DISCLAIMER</div>
            <p style={{ fontSize: 11, color: T.textSub, lineHeight: 1.6, margin: 0 }}>{NUTRITION_DISCLAIMER}</p>
          </div>
          <button onClick={() => { const v = !nutri.consent_disclaimer; updNutri("consent_disclaimer", v); }} style={{ width: "100%", padding: "12px", background: nutri.consent_disclaimer ? T.accentLight : T.surface, color: nutri.consent_disclaimer ? T.accent : T.textSub, border: `1.5px solid ${nutri.consent_disclaimer ? T.accent : T.border}`, borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {nutri.consent_disclaimer && <Icon name="check" size={15} stroke={3} color={T.accent}/>}
            {nutri.consent_disclaimer ? "Consentement donné" : "Le client consent au disclaimer ci-dessus"}
          </button>
          <button onClick={() => saveParams(null, { ...stripNutri(nutri), consent_date: nutri.consent_disclaimer ? new Date().toISOString() : null })} disabled={busy} style={{ width: "100%", padding: "14px", background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: "pointer" }}>
            {busy ? "..." : "ENREGISTRER LE QUESTIONNAIRE"}
          </button>
        </div>
      )}

      {section === "cibles" && (
        <div>
          {!targets.ready ? (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "24px 20px", textAlign: "center", color: T.textMuted, fontSize: 13, lineHeight: 1.6 }}>
              Calcul impossible : {targets.missing}.<br/>Complète les paramètres et enregistre au moins une pesée.
            </div>
          ) : (<>
            {targets.floored && (
              <div style={{ background: "var(--cmp-down-bg)", border: `1px solid ${T.danger}40`, borderRadius: 10, padding: "9px 12px", marginBottom: 12, fontSize: 11, color: "var(--cmp-down-text)", fontWeight: 600, lineHeight: 1.5 }}>
                La cible calculée passait sous le plancher de sécurité ({targets.floor} kcal). Elle a été plafonnée au plancher.
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-around", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 8px", marginBottom: 12 }}>
              <MacroRing label="CALORIES" value={targets.target} unit="KCAL" color={T.accent}/>
              <MacroRing label="PROTÉINES" value={targets.protein} unit="G" color="var(--cmp-up-text)" size={72}/>
              <MacroRing label="GLUCIDES" value={targets.carbs} unit="G" color={T.warnText} size={72}/>
              <MacroRing label="LIPIDES" value={targets.fat} unit="G" color="var(--p-seche-tx)" size={72}/>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "4px 16px", marginBottom: 12 }}>
              {[["Âge / Poids / Taille", `${targets.age} ans · ${lastWeight} kg · ${clientProfile.height_cm} cm`],
                ["Métabolisme de base (BMR)", `${targets.bmr} kcal`],
                ["Dépense quotidienne (hors sport)", `${targets.dailyActivity} kcal`],
                ["Séances (moyenne / jour)", `+${targets.sportDaily} kcal`],
                ["Dépense totale (TDEE)", `${targets.tdee} kcal`],
                ["Ajustement objectif", `${targets.pct > 0 ? "+" : ""}${targets.pct}%`],
                ["Cible quotidienne", `${targets.target} kcal`]].map(([k, v], i, arr) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: 12, color: i === arr.length - 1 ? T.accent : T.text, fontWeight: 800 }}>{v}</span>
                </div>
              ))}
            </div>
            {targets.perSession.length > 0 && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "4px 16px" }}>
                {targets.perSession.map((s, i, arr) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 11 }}>
                    <span style={{ color: T.textSub }}>{s.day} · {s.name} <span style={{ color: T.textMuted }}>(×{s.mult})</span></span>
                    <span style={{ color: T.text, fontWeight: 700 }}>~{s.kcal} kcal</span>
                  </div>
                ))}
              </div>
            )}
          </>)}
        </div>
      )}

      {section === "diete" && (
        <div>
          {dieteAbsente ? (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "24px 20px", textAlign: "center", color: T.textMuted, fontSize: 12, lineHeight: 1.6 }}>
              La diète personnalisée attend sa migration SQL.<br/>
              Joue <b style={{ color: T.textSub }}>sql/2026-08-14-diete-personnalisee.sql</b> dans Supabase.
            </div>
          ) : (<>

          {/* Retours du coaché : en tête, parce que c'est ce qui appelle une action */}
          {retours.length > 0 && (
            <div style={{ background: T.warnBg, border: "1px solid var(--warn-border)", borderRadius: 13, padding: "12px 13px", marginBottom: 12 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 13, letterSpacing: 1.6, color: T.warnText, marginBottom: 8 }}>
                {retours.length} ALIMENT{retours.length > 1 ? "S" : ""} SIGNALÉ{retours.length > 1 ? "S" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {retours.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: T.text, lineHeight: 1.4 }}>
                      <b>{r.food_name}</b>{r.meal_label ? <span style={{ color: T.textMuted }}> · {r.meal_label}</span> : null}
                    </div>
                    <button onClick={() => traiterRetour(r, true)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 9px", fontSize: 9.5, fontWeight: 700, color: T.textSub, cursor: "pointer", whiteSpace: "nowrap" }}>NE PLUS PROPOSER</button>
                    <button onClick={() => traiterRetour(r, false)} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 15, cursor: "pointer", padding: "0 3px", lineHeight: 1 }} title="Ignorer">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Praticité. Ces deux curseurs décident si la diète sera suivie ou
              abandonnée en dix jours : une diète juste que la personne n'a ni
              le temps ni les moyens de faire ne vaut rien. */}
          {praticiteAbsente && (
            <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 11, padding: "9px 12px", marginBottom: 12, fontSize: 10.5, color: T.textSub, lineHeight: 1.55 }}>
              Budget et temps de préparation : joue <b>sql/2026-08-15-diete-praticite.sql</b> dans
              Supabase pour les activer. La génération fonctionne sans, sans contrainte de praticité.
            </div>
          )}
          {!praticiteAbsente && (() => {
            const maxC = parseInt(nutri.max_cost_level) || 3;
            const maxP = parseInt(nutri.max_prep_level) || 3;
            const retenus = foods.filter(f => f.role !== "autre"
              && (parseInt(f.cost_level) || 2) <= maxC && (parseInt(f.prep_level) || 2) <= maxP).length;
            const total = foods.filter(f => f.role !== "autre").length;
            const curseur = (champ, val, labels) => (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: T.textMuted, marginBottom: 5 }}>
                  <span>{champ === "max_cost_level" ? "BUDGET" : "PRÉPARATION"}</span>
                  <span style={{ color: val < 3 ? T.accent : T.textMuted }}>{labels[val - 1]}</span>
                </div>
                <input type="range" min="1" max="3" step="1" value={val}
                  onChange={e => saveParams(null, { [champ]: parseInt(e.target.value) })}
                  style={{ width: "100%", accentColor: T.accent }}/>
              </div>
            );
            return (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: "12px 14px", marginBottom: 12 }}>
                {curseur("max_cost_level", maxC, ["Serré", "Modéré", "Sans contrainte"])}
                {curseur("max_prep_level", maxP, ["Rapide", "Normal", "Sans contrainte"])}
                <div style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.55 }}>
                  {retenus} aliments retenus sur {total}
                  {habituels.length > 0 && ` · ${habituels.length} aliment${habituels.length > 1 ? "s" : ""} habituel${habituels.length > 1 ? "s" : ""}, prioritaire${habituels.length > 1 ? "s" : ""} et hors plafonds`}
                </div>
              </div>
            );
          })()}

          <button onClick={genererLaDiete} disabled={busy} className="pressable" style={{ width: "100%", padding: "13px", background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 13, fontSize: 12, fontWeight: 800, letterSpacing: 1, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {busy ? (<><Spinner size={14} color="white"/> ...</>) : (diete ? "REGÉNÉRER LA DIÈTE" : "GÉNÉRER LA DIÈTE")}
          </button>

          {!diete ? (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "24px 20px", textAlign: "center", color: T.textMuted, fontSize: 12, lineHeight: 1.6 }}>
              Aucune diète pour ce coaché.<br/>
              {foods.length ? `${foods.length} aliments disponibles dans la base.` : "La base d'aliments est vide : importe d'abord la table Ciqual."}
            </div>
          ) : (<>
            {consent === false && (
              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 11, padding: "9px 12px", marginBottom: 10, fontSize: 10.5, color: T.textSub, lineHeight: 1.55 }}>
                En attente : le coaché doit accepter le cadre nutrition depuis son app avant de voir sa diète.
              </div>
            )}
            {Math.abs(derive) >= 100 && (
              <div style={{ background: T.warnBg, border: "1px solid var(--warn-border)", borderRadius: 11, padding: "9px 12px", marginBottom: 10, fontSize: 10.5, color: T.warnText, lineHeight: 1.55, fontWeight: 600 }}>
                La cible a bougé de {derive > 0 ? "+" : ""}{derive} kcal depuis la génération
                {diete.plan.weight_at_gen ? ` (poids passé de ${diete.plan.weight_at_gen} à ${lastWeight} kg)` : ""}. Régénère ou ajuste les repas.
              </div>
            )}

            {/* Bascule des deux journées types */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[["entrainement", "ENTRAÎNEMENT"], ["repos", "REPOS"]].map(([id, lab]) => (
                <button key={id} onClick={() => setJourVu(id)} style={{ flex: 1, padding: "9px 6px", background: jourVu === id ? T.accent : T.surface, color: jourVu === id ? "white" : T.textSub, border: `1px solid ${jourVu === id ? T.accent : T.border}`, borderRadius: 11, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, cursor: "pointer" }}>{lab}</button>
              ))}
            </div>

            {/* Total de la journée face à sa cible */}
            {cibleJourVu && (() => {
              const tot = totauxItems(repasVus.flatMap(r => r.items));
              const ecart = tot.kcal - cibleJourVu.target;
              const couleur = Math.abs(ecart) <= 60 ? T.accent : T.warnText;
              return (
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: "11px 14px", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: T.textMuted }}>TOTAL DE LA JOURNÉE</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: couleur }}>{tot.kcal} / {cibleJourVu.target} kcal</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: T.textSub, fontWeight: 600 }}>
                    P {tot.protein}/{cibleJourVu.protein} · G {tot.carbs}/{cibleJourVu.carbs} · L {tot.fat}/{cibleJourVu.fat}
                    {tot.fiber ? ` · Fibres ${tot.fiber} g` : ""}
                  </div>
                </div>
              );
            })()}

            {/* Les repas, aliment par aliment */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {repasVus.map(r => {
                const tot = totauxItems(r.items);
                const cible = r.cible;
                const ecart = cible ? tot.kcal - Math.round(cible.kcal) : 0;
                return (
                  <div key={r.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 13px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 13.5, letterSpacing: 1.4, color: T.text }}>{dietMealLabel(r.meal_type).toUpperCase()}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: Math.abs(ecart) <= 40 ? T.accent : T.warnText }}>
                        {tot.kcal}{cible ? ` / ${Math.round(cible.kcal)}` : ""} kcal
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {r.items.map(it => (
                        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 0", borderTop: `1px solid ${T.border}55` }}>
                          <button onClick={() => setPicker({ mealId: r.id, item: it })} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, fontSize: 12, color: T.text, lineHeight: 1.35, cursor: "pointer" }}>
                            {it.food_name}
                            {habituels.length > 0 && !idsHabituels.has(it.food_id) && (
                              <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5, color: T.warnText, background: T.warnBg, border: "1px solid var(--warn-border)", borderRadius: 5, padding: "1px 4px", whiteSpace: "nowrap" }}>NOUVEAU</span>
                            )}
                            <span style={{ display: "block", fontSize: 9, color: T.textMuted, marginTop: 1 }}>
                              {Math.round(macrosItem(it).kcal)} kcal · P{Math.round(macrosItem(it).protein)} G{Math.round(macrosItem(it).carbs)} L{Math.round(macrosItem(it).fat)}
                            </span>
                          </button>
                          <input type="number" min="1" max="2000" step="5" value={Math.round(it.grams)}
                            onChange={e => { const v = parseInt(e.target.value); if (v > 0 && v <= 2000) majItem(it, { grams: v }); }}
                            style={{ width: 58, padding: "6px 4px", textAlign: "right", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: T.text, flexShrink: 0 }}/>
                          <span style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>g</span>
                          <button onClick={() => supprimerItem(it)} title="Retirer" style={{ flexShrink: 0, background: "none", border: "none", color: T.textMuted, fontSize: 14, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                      <button onClick={() => setPicker({ mealId: r.id, item: null })} style={{ flex: 1, padding: "8px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 10, fontWeight: 700, color: T.textSub, cursor: "pointer" }}>AJOUTER UN ALIMENT</button>
                      {cible && (
                        <button onClick={() => ajusterLeRepas(r, cible)} disabled={busy} style={{ flex: 1, padding: "8px", background: T.accentLight, border: `1px solid ${T.accent}55`, borderRadius: 9, fontSize: 10, fontWeight: 700, color: T.accent, cursor: "pointer" }}>AJUSTER AUX CIBLES</button>
                      )}
                    </div>
                    <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 7, fontWeight: 600 }}>
                      P {tot.protein} · G {tot.carbs} · L {tot.fat}{cible ? ` — cible P ${Math.round(cible.protein)} · G ${Math.round(cible.carbs)} · L ${Math.round(cible.fat)}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mot du coach, affiché en tête de la diète du coaché */}
            <Field label="MOT AFFICHÉ EN TÊTE DE SA DIÈTE (FACULTATIF)">
              <textarea value={diete.plan.note || ""} rows={2}
                onChange={e => setDiete({ ...diete, plan: { ...diete.plan, note: e.target.value } })}
                onBlur={async e => { await supabase.from("diet_plans").update({ note: e.target.value || null }).eq("id", diete.plan.id); }}
                placeholder="Bois 2 L d'eau par jour. Les quantités sont données pour des aliments crus."
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}/>
            </Field>
          </>)}
          </>)}
        </div>
      )}

      {section === "poids" && (
        <div>
          {alert && (
            <div style={{ background: T.warnBg, border: "1px solid var(--warn-border)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 11, color: T.warnText, fontWeight: 600, lineHeight: 1.5, display: "flex", gap: 8 }}>
              <Icon name="alert" size={15} color={T.warnText}/>
              <span>{alert}</span>
            </div>
          )}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px", marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>ÉVOLUTION DU POIDS</div>
            <WeightChart logs={logs}/>
          </div>
          {logs.length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "4px 14px" }}>
              {logs.slice(-6).reverse().map((l, i, arr) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 12 }}>
                  <span style={{ color: T.textSub }}>{l.logged_date}</span>
                  <span style={{ color: T.text, fontWeight: 800 }}>{l.weight_kg} kg</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {pickerHabitude && (
        <FoodPickerSheet
          foods={foods} nutri={nutri} coachId={coachId} supabase={supabase}
          titre="AJOUTER UN ALIMENT HABITUEL" itemRemplace={null}
          onCreated={f => setFoods(fs => [...fs, f].sort((a, b) => a.name.localeCompare(b.name)))}
          onChoose={ajouterHabitude}
          onClose={() => setPickerHabitude(false)}
        />
      )}
      {picker && (
        <FoodPickerSheet
          foods={foods} nutri={nutri} coachId={coachId} supabase={supabase}
          mealType={(diete?.repas || []).find(r => r.id === picker.mealId)?.meal_type}
          itemRemplace={picker.item}
          onCreated={f => setFoods(fs => [...fs, f].sort((a, b) => a.name.localeCompare(b.name)))}
          onChoose={f => poserAliment(picker.mealId, f, picker.item)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

// ── Page coaché : NUTRITION (Premium uniquement) ──
function NutritionPage({ ctx }) {
  const { supabase, userId, appData, refreshWeighedToday } = ctx;
  const [loading, setLoading] = useState(true);
  const [nutri, setNutri] = useState(null);
  const [clientProfile, setClientProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [diete, setDiete] = useState(null);
  const [phases, setPhases] = useState([]);
  const [weekInfo, setWeekInfo] = useState(null);
  // null = on ne sait pas encore, false = pas encore donné, objet = donné
  const [consent, setConsent] = useState(null);
  const [jourVu, setJourVu] = useState(null);
  const [signales, setSignales] = useState({});
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [wMsg, setWMsg] = useState("");
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: prof }, np, wl, phs] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          loadNutritionProfile(supabase, userId),
          loadWeightLogs(supabase, userId),
          loadPhases(supabase, userId),
        ]);
        setClientProfile(prof); setNutri(np); setLogs(wl); setPhases(phs);
        // Semaine courante = la plus récente
        const { data: wk } = await supabase.from("weeks").select("id, week_number")
          .eq("coachee_id", userId).order("week_number", { ascending: false }).limit(1).maybeSingle();
        if (wk) setWeekInfo(wk);
        // La diète et le consentement. Tant que la migration n'est pas jouée,
        // les deux restent muets : le calculateur et la pesée doivent marcher
        // sans eux, ce sont les parties que le coaché utilise tous les jours.
        try {
          setDiete(await loadDiete(supabase, userId));
        } catch (e) { if (!tableAbsente(e)) throw e; }
        try {
          const { data: c, error } = await supabase.from("diet_consents")
            .select("*").eq("coachee_id", userId).eq("version", DIET_CONSENT_VERSION)
            .order("accepted_at", { ascending: false }).limit(1).maybeSingle();
          if (error) throw error;
          setConsent(c || false);
        } catch (e) { if (!tableAbsente(e)) throw e; }
      } catch {}
      setLoading(false);
    })();
  }, [supabase, userId]);

  async function accepterCadre() {
    try {
      const { data, error } = await supabase.from("diet_consents")
        .insert({ coachee_id: userId, version: DIET_CONSENT_VERSION }).select().single();
      if (error) throw error;
      setConsent(data);
    } catch { /* le refus laisse l'écran en place, il réessaiera */ }
  }

  async function signaler(item, mealType) {
    if (signales[item.id]) return;
    setSignales(s => ({ ...s, [item.id]: true }));
    try {
      await supabase.from("diet_feedback").insert({
        coachee_id: userId, item_id: item.id,
        food_name: item.food_name, meal_label: dietMealLabel(mealType),
      });
    } catch { /* le retour est un confort, jamais un blocage */ }
  }

  const lastWeight = logs.length ? parseFloat(logs[logs.length - 1].weight_kg) : null;
  const activePhase = findActivePhase(phases);
  const targets = useMemo(() => computeNutritionTargets({
    clientProfile, nutriProfile: nutri, lastWeight,
    sessions: appData?.sessions, week: appData?.week,
    activePhasePct: activePhase ? activePhase.goal_adjustment_pct : null,
  }), [clientProfile, nutri, lastWeight, appData, activePhase]);

  async function saveWeight() {
    const v = parseFloat(weightInput);
    if (!v || v < 30 || v > 300 || savingWeight) return;
    setSavingWeight(true); setWMsg("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      await addWeightLog(supabase, userId, v, today);
      setLogs(await loadWeightLogs(supabase, userId));
      setWeightInput("");
      setWMsg("Pesée enregistrée ✓");
      if (refreshWeighedToday) refreshWeighedToday();
      setTimeout(() => setWMsg(""), 2500);
    } catch (e) { setWMsg("Erreur : " + e.message); }
    setSavingWeight(false);
  }

  if (loading) return <div style={{ padding: 60, textAlign: "center" }}><Spinner size={26}/></div>;

  // Type de journée d'aujourd'hui, et celui que le coaché regarde. Par défaut
  // on ouvre sur AUJOURD'HUI : il consulte sa diète pour savoir quoi manger
  // maintenant, pas pour explorer.
  const jourAujourdhui = typeDeJour(appData?.week, appData?.sessions);
  const jourActif = jourVu || jourAujourdhui;
  const cibleDuJour = targets.ready
    ? (targets.deuxJournees ? (jourAujourdhui === "entrainement" ? targets.train : targets.rest) : targets)
    : null;

  const repasDuJour = diete
    ? diete.repas.filter(r => r.day_type === jourActif)
        .sort((a, b) => a.meal_order - b.meal_order)
        .map(r => ({ ...r, items: diete.items.filter(i => i.meal_id === r.id).sort((a, b) => a.item_order - b.item_order) }))
    : [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const weighedTodayLocal = logs.some(l => l.logged_date === todayStr);

  // Fait défiler jusqu'au bloc de pesée
  function scrollToWeigh() {
    const el = document.getElementById("forge-weigh-block");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "22px 18px 14px" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: T.text, letterSpacing: 3, lineHeight: 1 }}>NUTRITION</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 5 }}>Ton plan personnalisé{weekInfo ? ` · Semaine ${weekInfo.week_number}` : ""}</div>
      </div>

      {!weighedTodayLocal && (
        <div style={{ padding: "0 18px 14px" }}>
          <button onClick={scrollToWeigh} className="pressable" style={{ width: "100%", background: T.warnBg, border: "1px solid var(--warn-border)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 11, cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--warn-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="trending" size={18} color={T.warnText}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--warn-text)" }}>Pense à te peser aujourd'hui</div>
              <div style={{ fontSize: 10.5, color: T.warnText, marginTop: 1 }}>Un suivi quotidien affine tes cibles. Appuie pour saisir.</div>
            </div>
            <Icon name="chevronRight" size={18} color={T.warnText}/>
          </button>
        </div>
      )}

      {/* Cibles du jour */}
      <div style={{ padding: "0 18px 14px" }}>
        {targets.ready ? (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: "14px 8px 18px", boxShadow: `0 2px 14px ${T.shadow}` }}>
            {targets.deuxJournees && (
              <div style={{ textAlign: "center", fontSize: 9.5, fontWeight: 800, letterSpacing: 1.4, color: jourAujourdhui === "entrainement" ? T.accent : T.textMuted, marginBottom: 10 }}>
                {jourAujourdhui === "entrainement" ? "AUJOURD'HUI · JOUR D'ENTRAÎNEMENT" : "AUJOURD'HUI · JOUR DE REPOS"}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-around" }}>
              <MacroRing label="CALORIES" value={cibleDuJour.target} unit="KCAL" color={T.accent}/>
              <MacroRing label="PROT" value={cibleDuJour.protein} unit="G" color="var(--cmp-up-text)" size={70}/>
              <MacroRing label="GLUC" value={cibleDuJour.carbs} unit="G" color={T.warnText} size={70}/>
              <MacroRing label="LIP" value={cibleDuJour.fat} unit="G" color="var(--p-seche-tx)" size={70}/>
            </div>
          </div>
        ) : (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px", textAlign: "center", color: T.textMuted, fontSize: 12, lineHeight: 1.6 }}>
            Tes cibles apparaîtront dès que ton coach aura complété ton profil et que tu auras saisi ta première pesée ci-dessous.
          </div>
        )}
      </div>

      {/* Ma diète */}
      {diete && consent === false ? (
        // Le cadre, avant la première consultation. Un consentement donné par
        // le coach à la place du coaché n'en est pas un : c'est lui qui accepte,
        // depuis son compte, et l'acceptation est horodatée.
        <div style={{ padding: "0 18px 6px" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2.5, color: T.textSub, marginBottom: 10 }}>MA DIÈTE</div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 16px", boxShadow: `0 2px 12px ${T.shadow}` }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 17, letterSpacing: 1.6, color: T.text, marginBottom: 10 }}>AVANT DE COMMENCER</div>
            <p style={{ fontSize: 12, color: T.textSub, lineHeight: 1.65, margin: "0 0 14px" }}>{NUTRITION_DISCLAIMER}</p>
            <button onClick={accepterCadre} className="pressable" style={{ width: "100%", padding: 14, background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1.2, cursor: "pointer" }}>
              J'AI COMPRIS
            </button>
          </div>
        </div>
      ) : diete ? (
        <div style={{ padding: "0 18px 6px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2.5, color: T.textSub }}>MA DIÈTE</div>
            {jourActif !== jourAujourdhui && (
              <button onClick={() => setJourVu(null)} style={{ background: "none", border: "none", color: T.accent, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>Revenir à aujourd'hui</button>
            )}
          </div>

          {diete.plan.note && (
            <div style={{ background: T.accentLight, border: `1px solid ${T.accent}33`, borderRadius: 12, padding: "10px 13px", marginBottom: 10, fontSize: 11.5, color: T.text, lineHeight: 1.6 }}>
              {diete.plan.note}
            </div>
          )}

          {/* Bascule entraînement / repos */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[["entrainement", "JOUR D'ENTRAÎNEMENT"], ["repos", "JOUR DE REPOS"]].map(([id, lab]) => (
              <button key={id} onClick={() => setJourVu(id)} className="pressable" style={{ flex: 1, padding: "10px 6px", background: jourActif === id ? T.accent : T.surface, color: jourActif === id ? "white" : T.textSub, border: `1px solid ${jourActif === id ? T.accent : T.border}`, borderRadius: 12, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, cursor: "pointer" }}>
                {lab}{id === jourAujourdhui ? " ·" : ""}
              </button>
            ))}
          </div>

          {repasDuJour.length === 0 ? (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "22px", textAlign: "center", color: T.textMuted, fontSize: 12, lineHeight: 1.6 }}>
              Aucun repas pour cette journée.<br/>Ton coach finalise ta diète.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {repasDuJour.map((r, i) => {
                const tot = totauxItems(r.items);
                return (
                  <div key={r.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 15, padding: "13px 14px", animation: `fadeUp .3s ease ${i * 0.05}s both` }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
                      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: 1.4, color: T.text }}>{dietMealLabel(r.meal_type).toUpperCase()}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: T.accent }}>{tot.kcal} kcal</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {r.items.map(it => (
                        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderTop: `1px solid ${T.border}55` }}>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.text, lineHeight: 1.4 }}>{it.food_name}</div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.textSub, flexShrink: 0 }}>{Math.round(it.grams)} g</div>
                          <button onClick={() => signaler(it, r.meal_type)} disabled={!!signales[it.id]} title="Je n'aime pas cet aliment"
                            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: signales[it.id] ? T.accentLight : "transparent", border: `1px solid ${signales[it.id] ? T.accent : T.border}`, color: signales[it.id] ? T.accent : T.textMuted, fontSize: 9, fontWeight: 800, cursor: signales[it.id] ? "default" : "pointer", lineHeight: 1 }}>
                            {signales[it.id] ? "OK" : "✕"}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 8, fontWeight: 600 }}>
                      P {tot.protein} g · G {tot.carbs} g · L {tot.fat} g{tot.fiber ? ` · Fibres ${tot.fiber} g` : ""}
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.6, padding: "2px 2px 0" }}>
                La croix signale à ton coach qu'un aliment ne te convient pas. Il te le remplacera.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "0 18px 6px" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2.5, color: T.textSub, marginBottom: 10 }}>MA DIÈTE</div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "22px", textAlign: "center", color: T.textMuted, fontSize: 12, lineHeight: 1.6 }}>
            Ton coach n'a pas encore établi ta diète.<br/>Tes cibles ci-dessus restent valables en attendant.
          </div>
        </div>
      )}

      {/* Pesée quotidienne */}
      <div id="forge-weigh-block" style={{ padding: "14px 18px 0", scrollMarginTop: 80 }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2.5, color: T.textSub, marginBottom: 10 }}>MA PESÉE</div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px", boxShadow: `0 2px 12px ${T.shadow}` }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input type="number" inputMode="decimal" step="0.1" min="30" max="300" value={weightInput} onChange={e => setWeightInput(e.target.value)} placeholder={lastWeight ? `Dernier : ${lastWeight} kg` : "Ton poids (kg)"} style={{ ...inputStyle, flex: 1 }}/>
            <button onClick={saveWeight} disabled={savingWeight || !weightInput} style={{ flexShrink: 0, padding: "0 18px", background: !weightInput ? T.surface2 : `linear-gradient(135deg, #064E3B, #0D9488)`, color: !weightInput ? T.textMuted : "white", border: "none", borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              {savingWeight ? "..." : "OK"}
            </button>
          </div>
          {wMsg && <div style={{ fontSize: 11, color: wMsg.includes("Erreur") ? T.danger : T.accent, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>{wMsg}</div>}
          <WeightChart logs={logs}/>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ padding: "14px 18px 0", textAlign: "center" }}>
        <button onClick={() => setShowDisclaimer(!showDisclaimer)} style={{ background: "transparent", border: "none", color: T.textMuted, fontSize: 10, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
          Avertissement nutritionnel
        </button>
        {showDisclaimer && (
          <p style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.6, marginTop: 8, textAlign: "left", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px" }}>{NUTRITION_DISCLAIMER}</p>
        )}
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════════════
//  PÉRIODISATION — Constantes, modèles & helpers
// ═══════════════════════════════════════════════════════════════════════════════
const PHASE_TYPES = {
  prise_de_masse: { label: "Prise de masse", text: "var(--p-masse-tx)",    bg: "var(--p-masse-bg)" },
  seche:          { label: "Sèche",          text: "var(--p-seche-tx)",    bg: "var(--p-seche-bg)" },
  recomposition:  { label: "Recomposition",  text: "var(--p-recomp-tx)",   bg: "var(--p-recomp-bg)" },
  maintien:       { label: "Maintien",       text: "var(--p-maintien-tx)", bg: "var(--p-maintien-bg)" },
  decharge:       { label: "Décharge",       text: "var(--p-decharge-tx)", bg: "var(--p-decharge-bg)" },
};
const PHASE_TYPE_LIST = Object.keys(PHASE_TYPES);
const phaseLabel = (t) => (PHASE_TYPES[t] || {}).label || t;

// Modèles de périodisation (données de référence, pas de table)
const PERIODIZATION_TEMPLATES = [
  {
    id: "debutant", name: "Débutant · Premiers résultats", weeks: 24,
    desc: "Apprendre la technique, puis recomposition, légère prise de masse, décharge.",
    phases: [
      { phase_type: "maintien",       weeks: 4,  goal_adjustment_pct: 0,   name: "Adaptation & technique", target_note: "Apprendre les mouvements, installer les habitudes" },
      { phase_type: "recomposition",  weeks: 12, goal_adjustment_pct: -5,  name: "Recomposition",          target_note: "Construire du muscle en affinant" },
      { phase_type: "prise_de_masse", weeks: 6,  goal_adjustment_pct: 10,  name: "Prise de masse légère",  target_note: "Accélérer la prise de muscle" },
      { phase_type: "decharge",       weeks: 2,  goal_adjustment_pct: 0,   name: "Décharge",               target_note: "Récupération avant le prochain cycle" },
    ],
  },
  {
    id: "inter_masse_seche", name: "Intermédiaire · Masse & Sèche", weeks: 31,
    desc: "Cycle classique prise de masse → sèche, avec transitions et décharge.",
    phases: [
      { phase_type: "prise_de_masse", weeks: 16, goal_adjustment_pct: 12,  name: "Prise de masse",            target_note: "Maximiser la prise de muscle" },
      { phase_type: "decharge",       weeks: 1,  goal_adjustment_pct: 0,   name: "Décharge",                  target_note: "Récupération" },
      { phase_type: "recomposition",  weeks: 4,  goal_adjustment_pct: -5,  name: "Transition / recomposition",target_note: "Stabiliser avant la sèche" },
      { phase_type: "seche",          weeks: 8,  goal_adjustment_pct: -18, name: "Sèche",                     target_note: "Révéler la définition musculaire" },
      { phase_type: "maintien",       weeks: 2,  goal_adjustment_pct: 0,   name: "Maintien",                  target_note: "Stabiliser le nouveau poids" },
    ],
  },
  {
    id: "seche_estivale", name: "Sèche estivale", weeks: 16,
    desc: "Être sec pour l'été, entrée en douceur puis sèche franche.",
    phases: [
      { phase_type: "recomposition", weeks: 4,  goal_adjustment_pct: -5,  name: "Entrée en douceur", target_note: "Amorcer en douceur" },
      { phase_type: "seche",         weeks: 10, goal_adjustment_pct: -18, name: "Sèche",             target_note: "Perdre la masse grasse" },
      { phase_type: "maintien",      weeks: 2,  goal_adjustment_pct: 0,   name: "Stabilisation",     target_note: "Maintenir les résultats" },
    ],
  },
  {
    id: "recomp_longue", name: "Recomposition longue", weeks: 24,
    desc: "Rester autour du même poids en améliorant la composition corporelle.",
    phases: [
      { phase_type: "recomposition", weeks: 10, goal_adjustment_pct: -5, name: "Recomposition", target_note: "Échanger du gras contre du muscle" },
      { phase_type: "decharge",      weeks: 1,  goal_adjustment_pct: 0,  name: "Décharge",      target_note: "Récupération" },
      { phase_type: "recomposition", weeks: 10, goal_adjustment_pct: -5, name: "Recomposition", target_note: "Poursuivre la transformation" },
      { phase_type: "maintien",      weeks: 3,  goal_adjustment_pct: 0,  name: "Maintien",      target_note: "Consolider les acquis" },
    ],
  },
];

// ── Date utils ──
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}
function fmtDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function fmtMonthYear(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

// ── Helpers Supabase périodisation ──
async function loadPhases(supabase, coacheeId) {
  const { data } = await supabase.from("periodization_phases").select("*")
    .eq("coachee_id", coacheeId).order("phase_order", { ascending: true });
  return data || [];
}
// Détecte la phase active à la date du jour
function findActivePhase(phases) {
  if (!phases || !phases.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  return phases.find(p => p.start_date <= today && today <= p.end_date) || null;
}
// Applique un modèle : génère les phases depuis une date de début
function buildPhasesFromTemplate(template, startDate, coacheeId) {
  const rows = [];
  let cursor = startDate;
  template.phases.forEach((ph, i) => {
    const end = addDays(cursor, ph.weeks * 7);
    rows.push({
      coachee_id: coacheeId,
      phase_type: ph.phase_type,
      name: ph.name,
      start_date: cursor,
      end_date: end,
      goal_adjustment_pct: ph.goal_adjustment_pct,
      target_note: ph.target_note || null,
      program_id: null,
      phase_order: i + 1,
    });
    cursor = end;
  });
  return rows;
}
async function replaceAllPhases(supabase, coacheeId, rows) {
  await supabase.from("periodization_phases").delete().eq("coachee_id", coacheeId);
  if (rows.length) {
    const { error } = await supabase.from("periodization_phases").insert(rows);
    if (error) throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PÉRIODISATION — Frise chronologique (composant central)
// ═══════════════════════════════════════════════════════════════════════════════
function PhaseTimeline({ phases, weightLogs, onPhaseClick, selectedId }) {
  if (!phases || !phases.length) return null;
  const sorted = [...phases].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const first = sorted[0].start_date;
  const last = sorted[sorted.length - 1].end_date;
  const totalDays = Math.max(daysBetween(first, last), 1);
  const today = new Date().toISOString().slice(0, 10);

  // Largeur : ~9px par jour, minimum pour tenir à l'écran
  const PX_PER_DAY = 9;
  const widthPx = Math.max(totalDays * PX_PER_DAY, 320);
  const H_BANDS = 84;     // hauteur des bandes
  const H_CURVE = 56;     // hauteur de la zone courbe au-dessus
  const H_AXIS = 22;      // axe temporel en bas
  const totalH = H_CURVE + H_BANDS + H_AXIS;

  const xForDate = (d) => (daysBetween(first, d) / totalDays) * widthPx;

  // Points de la courbe de poids dans la fenêtre de la frise
  const logsIn = (weightLogs || [])
    .filter(l => l.logged_date >= first && l.logged_date <= last)
    .map(l => ({ x: xForDate(l.logged_date), w: parseFloat(l.weight_kg) }));
  let curvePath = "", curvePts = [];
  if (logsIn.length >= 1) {
    const ws = logsIn.map(p => p.w);
    const wMin = Math.min(...ws), wMax = Math.max(...ws);
    const wRange = Math.max(wMax - wMin, 1);
    curvePts = logsIn.map(p => ({ x: p.x, y: 8 + (1 - (p.w - wMin) / wRange) * (H_CURVE - 16), w: p.w }));
    curvePath = curvePts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }

  // Repères de mois sur l'axe
  const months = [];
  let mc = new Date(first + "T00:00:00"); mc.setDate(1);
  while (mc.toISOString().slice(0, 10) <= last) {
    const ds = mc.toISOString().slice(0, 10);
    if (ds >= first) months.push(ds);
    mc.setMonth(mc.getMonth() + 1);
  }

  return (
    <div style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
      <div style={{ position: "relative", width: widthPx, height: totalH, minWidth: "100%" }}>
        {/* Courbe de poids (zone haute) */}
        {curvePts.length > 0 && (
          <svg width={widthPx} height={H_CURVE} style={{ position: "absolute", top: 0, left: 0 }}>
            {curvePts.length > 1 && <path d={curvePath} fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>}
            {curvePts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="2.5" fill={T.accent}/>
                {(i === 0 || i === curvePts.length - 1) && <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="8" fontWeight="700" fill={T.accentDark}>{p.w}</text>}
              </g>
            ))}
          </svg>
        )}

        {/* Bandes de phases */}
        <div style={{ position: "absolute", top: H_CURVE, left: 0, height: H_BANDS, width: widthPx }}>
          {sorted.map(ph => {
            const x = xForDate(ph.start_date);
            const w = Math.max((daysBetween(ph.start_date, ph.end_date) / totalDays) * widthPx, 28);
            const st = PHASE_TYPES[ph.phase_type] || { bg: T.surface2, text: T.textSub };
            const isActive = ph.start_date <= today && today <= ph.end_date;
            const isSel = selectedId === ph.id;
            const weeks = Math.round(daysBetween(ph.start_date, ph.end_date) / 7);
            return (
              <button key={ph.id} onClick={() => onPhaseClick && onPhaseClick(ph)} style={{
                position: "absolute", left: x, top: 0, width: w - 3, height: "100%",
                background: st.bg, border: isSel ? `2.5px solid ${st.text}` : isActive ? `2px solid ${st.text}` : `1px solid ${st.text}30`,
                borderRadius: 10, cursor: "pointer", padding: "8px 6px", textAlign: "left", overflow: "hidden",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                boxShadow: isActive ? `0 3px 12px ${st.text}30` : "none",
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: st.text, lineHeight: 1.15, letterSpacing: .2 }}>{phaseLabel(ph.phase_type)}</div>
                {w > 60 && <div style={{ fontSize: 8, color: st.text, opacity: .75, fontWeight: 600 }}>{weeks} sem{ph.goal_adjustment_pct != null ? ` · ${ph.goal_adjustment_pct > 0 ? "+" : ""}${ph.goal_adjustment_pct}%` : ""}</div>}
                {isActive && <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: st.text }}/>}
              </button>
            );
          })}
        </div>

        {/* Repère "aujourd'hui" */}
        {today >= first && today <= last && (
          <div style={{ position: "absolute", top: 0, left: xForDate(today), height: H_CURVE + H_BANDS, width: 2, background: T.danger, zIndex: 5 }}>
            <div style={{ position: "absolute", top: -2, left: -4, width: 10, height: 10, borderRadius: "50%", background: T.danger, border: `2px solid ${T.surface}` }}/>
          </div>
        )}

        {/* Axe temporel (mois) */}
        <div style={{ position: "absolute", top: H_CURVE + H_BANDS, left: 0, height: H_AXIS, width: widthPx }}>
          {months.map((m, i) => (
            <div key={i} style={{ position: "absolute", left: xForDate(m), top: 4, fontSize: 8, color: T.textMuted, fontWeight: 700, transform: "translateX(2px)", whiteSpace: "nowrap" }}>
              {fmtMonthYear(m)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Carte "phase en cours" mise en avant
function ActivePhaseCard({ phase, phases, programs }) {
  if (!phase) return null;
  const st = PHASE_TYPES[phase.phase_type] || { bg: T.surface2, text: T.textSub };
  const today = new Date().toISOString().slice(0, 10);
  const totalW = Math.max(Math.round(daysBetween(phase.start_date, phase.end_date) / 7), 1);
  const curW = Math.min(Math.max(Math.ceil(daysBetween(phase.start_date, today) / 7), 1), totalW);
  const weeksLeft = Math.max(Math.ceil(daysBetween(today, phase.end_date) / 7), 0);
  const prog = programs && phase.program_id ? programs.find(p => p.id === phase.program_id) : null;
  return (
    <div style={{ background: st.bg, border: `1.5px solid ${st.text}40`, borderRadius: 16, padding: "16px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: st.text, letterSpacing: 1, opacity: .8 }}>PHASE EN COURS</div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: st.text, letterSpacing: 1, lineHeight: 1.1, marginTop: 2 }}>{phase.name || phaseLabel(phase.phase_type)}</div>
        </div>
        <span style={{ background: st.text, color: "#FFF", fontSize: 9, padding: "3px 9px", borderRadius: 20, fontWeight: 800, whiteSpace: "nowrap" }}>{phaseLabel(phase.phase_type)}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.5)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: st.text }}>{curW} / {totalW}</div>
          <div style={{ fontSize: 8, color: st.text, opacity: .7, fontWeight: 700 }}>SEMAINE</div>
        </div>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.5)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: st.text }}>{weeksLeft}</div>
          <div style={{ fontSize: 8, color: st.text, opacity: .7, fontWeight: 700 }}>SEM. RESTANTES</div>
        </div>
      </div>
      {/* Barre de progression */}
      <div style={{ height: 6, background: "rgba(255,255,255,0.5)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(curW / totalW) * 100}%`, background: st.text, borderRadius: 3, transition: "width .5s ease" }}/>
      </div>
      {phase.target_note && <div style={{ fontSize: 11, color: st.text, marginTop: 10, fontStyle: "italic", opacity: .9 }}>« {phase.target_note} »</div>}
    </div>
  );
}

// Panneau de détail d'une phase (au clic)
function PhaseDetailSheet({ phase, programs, isPremium, onClose }) {
  if (!phase) return null;
  const st = PHASE_TYPES[phase.phase_type] || { bg: T.surface2, text: T.textSub };
  const weeks = Math.round(daysBetween(phase.start_date, phase.end_date) / 7);
  const prog = programs && phase.program_id ? programs.find(p => p.id === phase.program_id) : null;
  const pct = phase.goal_adjustment_pct;
  const nutriQual = pct == null ? "Non défini" : pct > 3 ? "Surplus calorique (prise de masse)" : pct < -3 ? "Déficit calorique (sèche)" : "Maintien calorique";
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 500 }}/>
      <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 501, background: T.bg, borderRadius: "22px 22px 0 0", maxHeight: "82vh", overflowY: "auto", padding: "10px 18px calc(26px + env(safe-area-inset-bottom))" }}>
        <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "0 auto 16px" }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 12, height: 12, borderRadius: 4, background: st.text }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 21, color: T.text, letterSpacing: 1, lineHeight: 1.1 }}>{phase.name || phaseLabel(phase.phase_type)}</div>
            <div style={{ fontSize: 10, color: st.text, fontWeight: 700, marginTop: 2 }}>{phaseLabel(phase.phase_type)}</div>
          </div>
          <button onClick={onClose} style={{ background: T.surface, border: `1px solid ${T.border}`, width: 32, height: 32, borderRadius: 10, fontSize: 16, color: T.textSub, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "4px 16px" }}>
          {[
            ["Durée", `${weeks} semaines`],
            ["Dates", `${fmtDateShort(phase.start_date)} → ${fmtDateShort(phase.end_date)}`],
            ["Programme associé", prog ? prog.name : "Aucun"],
            ["Approche nutrition", nutriQual],
            ...(isPremium && pct != null ? [["Ajustement calorique", `${pct > 0 ? "+" : ""}${pct}%`]] : []),
            ...(phase.target_note ? [["Objectif", phase.target_note]] : []),
          ].map(([k, v], i, arr) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: 12, color: T.text, fontWeight: 700, textAlign: "right" }}>{v}</span>
            </div>
          ))}
        </div>
        {!isPremium && pct != null && (
          <div style={{ marginTop: 12, fontSize: 10, color: T.textMuted, textAlign: "center", lineHeight: 1.5 }}>
            Les cibles caloriques chiffrées sont disponibles avec l'offre Premium.
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PÉRIODISATION — Page coaché "PARCOURS" (lecture seule, accessible à tous)
// ═══════════════════════════════════════════════════════════════════════════════
function ParcoursPage({ ctx }) {
  const { supabase, userId, appData } = ctx;
  const isPremium = appData?.client?.offer === "premium";
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState([]);
  const [logs, setLogs] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [ph, wl, { data: progs }] = await Promise.all([
          loadPhases(supabase, userId),
          loadWeightLogs(supabase, userId),
          supabase.from("programs").select("id, name").eq("coachee_id", userId),
        ]);
        setPhases(ph); setLogs(wl); setPrograms(progs || []);
      } catch {}
      setLoading(false);
    })();
  }, [supabase, userId]);

  const active = findActivePhase(phases);

  if (loading) return <div style={{ padding: 60, textAlign: "center" }}><Spinner size={26}/></div>;

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "22px 18px 14px" }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: T.text, letterSpacing: 3, lineHeight: 1 }}>PARCOURS</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 5 }}>Ta planification sur le long terme</div>
      </div>

      {phases.length === 0 ? (
        <div style={{ padding: "0 18px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Icon name="calendar" size={26} color={T.accent}/>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>Ton coach prépare ton parcours</div>
            <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>Tes phases d'entraînement (prise de masse, sèche...) apparaîtront ici dès que ton coach les aura planifiées.</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: "0 18px" }}>
          <ActivePhaseCard phase={active} phases={phases} programs={programs}/>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2.5, color: T.textSub, marginBottom: 10 }}>FRISE COMPLÈTE</div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 12px", marginBottom: 14 }}>
            <PhaseTimeline phases={phases} weightLogs={logs} onPhaseClick={setSelected} selectedId={selected?.id}/>
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, textAlign: "center", lineHeight: 1.6 }}>
            Appuie sur une phase pour voir son détail.{logs.length >= 1 ? " La courbe verte montre l'évolution de ton poids." : ""}
          </div>
        </div>
      )}

      {selected && <PhaseDetailSheet phase={selected} programs={programs} isPremium={isPremium} onClose={() => setSelected(null)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PÉRIODISATION — Sous-vue coach "Périodisation"
// ═══════════════════════════════════════════════════════════════════════════════
function CoachPeriodizationView({ ctx, coachee }) {
  const { supabase } = ctx;
  const { confirm, confirmUI } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState([]);
  const [logs, setLogs] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editPhase, setEditPhase] = useState(null);   // null | {} (new) | phase (edit)
  const [tplOpen, setTplOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [transitionProposal, setTransitionProposal] = useState(null);

  const reload = useCallback(async () => {
    const [ph, wl, { data: progs }] = await Promise.all([
      loadPhases(supabase, coachee.id),
      loadWeightLogs(supabase, coachee.id),
      supabase.from("programs").select("id, name, is_active").eq("coachee_id", coachee.id).order("program_order", { ascending: true }),
    ]);
    setPhases(ph); setLogs(wl); setPrograms(progs || []);
    setLoading(false);
  }, [supabase, coachee.id]);
  useEffect(() => { reload(); }, [reload]);

  const active = findActivePhase(phases);
  const isPremium = (coachee.offer || "essentiel") === "premium";

  // Détecte si la phase active a un programme non encore activé → propose la transition
  useEffect(() => {
    if (!active || !active.program_id) { setTransitionProposal(null); return; }
    const prog = programs.find(p => p.id === active.program_id);
    if (prog && !prog.is_active) setTransitionProposal({ phase: active, program: prog });
    else setTransitionProposal(null);
  }, [active, programs]);

  async function confirmTransition() {
    if (!transitionProposal) return;
    setMsg("");
    try {
      const { phase, program } = transitionProposal;
      // Activer le programme (logique de changement : ancien inactif, numérotation continue)
      const full = await supabase.from("programs").select("*").eq("id", program.id).single();
      if (full.data) {
        await activateProgram(supabase, coachee.id, full.data.week_structure, full.data.sessions_structure, full.data.name);
      }
      // L'objectif diète est piloté par la phase active automatiquement (lecture prioritaire)
      setMsg("Programme activé. L'objectif diète suit la phase active.");
      await reload();
    } catch (e) { setMsg("Erreur : " + e.message); }
  }

  async function applyTemplate(tpl, startDate) {
    setMsg("");
    try {
      const rows = buildPhasesFromTemplate(tpl, startDate, coachee.id);
      await replaceAllPhases(supabase, coachee.id, rows);
      setTplOpen(false);
      setMsg("Modèle appliqué — ajuste les phases si besoin.");
      await reload();
    } catch (e) { setMsg("Erreur : " + e.message); }
  }

  async function deletePhase(ph) {
    if (!(await confirm({ title: "SUPPRIMER LA PHASE", message: `"${ph.name || phaseLabel(ph.phase_type)}" sera retirée du parcours.`, confirmLabel: "Supprimer", danger: true }))) return;
    await supabase.from("periodization_phases").delete().eq("id", ph.id);
    await reload();
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24}/></div>;

  return (
    <>
    {confirmUI}
    <div className="fade-in">
      {msg && <div style={{ fontSize: 11, color: msg.includes("Erreur") ? T.danger : T.accent, fontWeight: 700, textAlign: "center", marginBottom: 12, lineHeight: 1.5 }}>{msg}</div>}

      {/* Proposition de transition */}
      {transitionProposal && (
        <div style={{ background: T.accentLight, border: `1.5px solid ${T.accent}`, borderRadius: 14, padding: "14px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.accentDark, marginBottom: 6 }}>Transition de phase détectée</div>
          <div style={{ fontSize: 11.5, color: T.text, lineHeight: 1.5, marginBottom: 12 }}>
            Phase active : <b>{transitionProposal.phase.name || phaseLabel(transitionProposal.phase.phase_type)}</b>. Activer le programme <b>{transitionProposal.program.name}</b>{transitionProposal.phase.goal_adjustment_pct != null ? ` et passer l'objectif nutrition à ${transitionProposal.phase.goal_adjustment_pct > 0 ? "+" : ""}${transitionProposal.phase.goal_adjustment_pct}%` : ""} ?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setTransitionProposal(null)} style={{ flex: 1, padding: "11px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, color: T.textSub, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Plus tard</button>
            <button onClick={confirmTransition} style={{ flex: 2, padding: "11px", background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 11, fontSize: 12, fontWeight: 800, letterSpacing: .5, cursor: "pointer" }}>Confirmer</button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => setTplOpen(true)} className="pressable" style={{ flex: 1, padding: "11px", background: T.surface, border: `1.5px solid ${T.accent}50`, borderRadius: 12, color: T.accent, fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>Appliquer un modèle</button>
        <button onClick={() => setEditPhase({})} className="pressable" style={{ flex: 1, padding: "11px", background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 12, fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>+ Nouvelle phase</button>
      </div>

      {phases.length === 0 ? (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "30px 20px", textAlign: "center", color: T.textMuted, fontSize: 13, lineHeight: 1.6 }}>
          Aucune phase planifiée. Applique un modèle pré-construit ou crée une phase manuellement.
        </div>
      ) : (<>
        <ActivePhaseCard phase={active} phases={phases} programs={programs}/>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 12px", marginBottom: 14 }}>
          <PhaseTimeline phases={phases} weightLogs={logs} onPhaseClick={setSelected} selectedId={selected?.id}/>
        </div>

        {/* Liste éditable des phases */}
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 2, color: T.textSub, marginBottom: 10 }}>PHASES</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...phases].sort((a, b) => a.start_date.localeCompare(b.start_date)).map(ph => {
            const st = PHASE_TYPES[ph.phase_type] || { bg: T.surface2, text: T.textSub };
            const weeks = Math.round(daysBetween(ph.start_date, ph.end_date) / 7);
            const prog = ph.program_id ? programs.find(p => p.id === ph.program_id) : null;
            return (
              <div key={ph.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 13px", display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 10, height: 38, borderRadius: 4, background: st.text, flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{ph.name || phaseLabel(ph.phase_type)}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{fmtDateShort(ph.start_date)} → {fmtDateShort(ph.end_date)} · {weeks} sem{prog ? ` · ${prog.name}` : ""}</div>
                </div>
                <button onClick={() => setEditPhase(ph)} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 10, color: T.textSub, cursor: "pointer", fontWeight: 700 }}>Éditer</button>
                <button onClick={() => deletePhase(ph)} style={{ background: "transparent", border: "none", color: T.danger, cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            );
          })}
        </div>
      </>)}
    </div>
    {selected && <PhaseDetailSheet phase={selected} programs={programs} isPremium={isPremium} onClose={() => setSelected(null)}/>}
    {editPhase && <PhaseEditorModal supabase={supabase} coacheeId={coachee.id} phase={editPhase.id ? editPhase : null} programs={programs} existingPhases={phases} onClose={() => setEditPhase(null)} onSaved={() => { setEditPhase(null); reload(); }}/>}
    {tplOpen && <TemplateModal onClose={() => setTplOpen(false)} onApply={applyTemplate}/>}
    </>
  );
}

// ── Modale : éditeur de phase ──
function PhaseEditorModal({ supabase, coacheeId, phase, programs, existingPhases, onClose, onSaved }) {
  const [type, setType] = useState(phase?.phase_type || "prise_de_masse");
  const [name, setName] = useState(phase?.name || "");
  const [startDate, setStartDate] = useState(phase?.start_date || new Date().toISOString().slice(0, 10));
  const [weeks, setWeeks] = useState(phase ? Math.round(daysBetween(phase.start_date, phase.end_date) / 7) : 8);
  const [programId, setProgramId] = useState(phase?.program_id || "");
  const [pct, setPct] = useState(phase?.goal_adjustment_pct != null ? phase.goal_adjustment_pct : 0);
  const [note, setNote] = useState(phase?.target_note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const endDate = addDays(startDate, (parseInt(weeks) || 1) * 7);
      const maxOrder = existingPhases.length ? Math.max(...existingPhases.map(p => p.phase_order || 0)) : 0;
      const payload = {
        coachee_id: coacheeId, phase_type: type, name: name.trim() || null,
        start_date: startDate, end_date: endDate,
        program_id: programId || null, goal_adjustment_pct: parseInt(pct),
        target_note: note.trim() || null,
        phase_order: phase?.phase_order || (maxOrder + 1),
      };
      if (phase?.id) {
        const { error } = await supabase.from("periodization_phases").update(payload).eq("id", phase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("periodization_phases").insert(payload);
        if (error) throw error;
      }
      onSaved();
    } catch (e) { setError(e.message || "Erreur"); setSaving(false); }
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 500 }}/>
      <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 501, background: T.bg, borderRadius: "22px 22px 0 0", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "10px auto 12px", flexShrink: 0 }}/>
        <div style={{ overflowY: "auto", padding: "0 18px", flex: "0 1 auto", minHeight: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: T.text, letterSpacing: 2, marginBottom: 16 }}>{phase ? "MODIFIER LA PHASE" : "NOUVELLE PHASE"}</div>
          <Field label="TYPE DE PHASE">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PHASE_TYPE_LIST.map(t => {
                const st = PHASE_TYPES[t];
                const on = type === t;
                return <button key={t} onClick={() => setType(t)} style={{ padding: "8px 11px", background: on ? st.bg : T.surface, color: on ? st.text : T.textSub, border: `1.5px solid ${on ? st.text : T.border}`, borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{st.label}</button>;
              })}
            </div>
          </Field>
          <Field label="LIBELLÉ (optionnel)"><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={phaseLabel(type)} style={inputStyle}/></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
            <Field label="DATE DE DÉBUT"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, WebkitAppearance: "none", appearance: "none", maxWidth: "100%", display: "block" }}/></Field>
            <Field label="DURÉE (SEM.)"><input type="number" min="1" max="52" value={weeks} onChange={e => setWeeks(e.target.value)} style={inputStyle}/></Field>
          </div>
          <Field label="PROGRAMME ASSOCIÉ (optionnel)">
            <select value={programId} onChange={e => setProgramId(e.target.value)} style={inputStyle}>
              <option value="">Aucun</option>
              {(programs || []).map(p => <option key={p.id} value={p.id}>{p.name}{p.is_active ? " (actif)" : ""}</option>)}
            </select>
          </Field>
          <Field label={`OBJECTIF NUTRITION : ${pct > 0 ? "+" : ""}${pct}%`}>
            <input type="range" min="-25" max="25" step="1" value={pct} onChange={e => setPct(parseInt(e.target.value))} style={{ width: "100%", accentColor: T.accent }}/>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.textMuted, fontWeight: 700 }}><span>−25% sèche</span><span>0</span><span>+25% masse</span></div>
          </Field>
          <Field label="NOTE D'OBJECTIF (optionnel)"><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ex : Atteindre 80 kg" style={inputStyle}/></Field>
          {error && <div style={{ fontSize: 11, color: T.danger, fontWeight: 600, textAlign: "center", marginBottom: 8 }}>{error}</div>}
        </div>
        <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "12px 18px calc(18px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          <button onClick={onClose} style={{ flex: 1, padding: "14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, color: T.textSub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "14px", background: `linear-gradient(135deg, #064E3B, #0D9488)`, color: "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: "pointer" }}>{saving ? "..." : "ENREGISTRER"}</button>
        </div>
      </div>
    </>
  );
}

// ── Modale : choix d'un modèle de périodisation ──
function TemplateModal({ onClose, onApply }) {
  const [chosen, setChosen] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,40,32,0.5)", backdropFilter: "blur(4px)", zIndex: 500 }}/>
      <div className="sheet" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 501, background: T.bg, borderRadius: "22px 22px 0 0", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 40, height: 4, background: T.borderStrong, borderRadius: 2, margin: "10px auto 12px", flexShrink: 0 }}/>
        <div style={{ overflowY: "auto", padding: "0 18px", flex: "0 1 auto", minHeight: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: T.text, letterSpacing: 2, marginBottom: 4 }}>MODÈLES DE PÉRIODISATION</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14, lineHeight: 1.5 }}>Choisis une trame : elle génère les phases automatiquement depuis une date de début. Tu pourras tout ajuster ensuite. Attention : appliquer un modèle remplace les phases existantes.</div>
          <Field label="DATE DE DÉBUT DU PARCOURS">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, WebkitAppearance: "none", appearance: "none", maxWidth: "100%", display: "block" }}/>
          </Field>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PERIODIZATION_TEMPLATES.map(tpl => {
              const on = chosen?.id === tpl.id;
              return (
                <div key={tpl.id} onClick={() => setChosen(tpl)} style={{ background: on ? T.accentLight : T.surface, border: `1.5px solid ${on ? T.accent : T.border}`, borderRadius: 14, padding: "13px 14px", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text }}>{tpl.name}</div>
                    <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, flexShrink: 0 }}>~{tpl.weeks} sem</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.5, marginBottom: 8 }}>{tpl.desc}</div>
                  <div style={{ display: "flex", gap: 3, height: 8, borderRadius: 4, overflow: "hidden" }}>
                    {tpl.phases.map((ph, i) => {
                      const st = PHASE_TYPES[ph.phase_type];
                      return <div key={i} style={{ flex: ph.weeks, background: st.text }} title={st.label}/>;
                    })}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                    {tpl.phases.map((ph, i) => {
                      const st = PHASE_TYPES[ph.phase_type];
                      return <span key={i} style={{ fontSize: 8, background: st.bg, color: st.text, padding: "2px 6px", borderRadius: 8, fontWeight: 700 }}>{ph.weeks}sem {st.label}</span>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "12px 18px calc(18px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          <button onClick={onClose} style={{ flex: 1, padding: "14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, color: T.textSub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
          <button onClick={() => chosen && onApply(chosen, startDate)} disabled={!chosen} style={{ flex: 2, padding: "14px", background: chosen ? `linear-gradient(135deg, #064E3B, #0D9488)` : T.surface2, color: chosen ? "white" : T.textMuted, border: "none", borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: chosen ? "pointer" : "default" }}>APPLIQUER</button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT — login (coaché ou coach) / app coaché / espace coach / démo
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
//  SERVICE WORKER — mise à jour sans réinstaller la PWA
//
//  Jusqu'ici, une PWA installée gardait l'ancienne version en cache et il fallait
//  supprimer puis réinstaller l'icône pour voir une mise à jour. Le service
//  worker détecte la nouvelle version et propose au coaché de recharger.
//  La bascule n'est JAMAIS automatique : personne ne se fait recharger l'app en
//  pleine séance.
// ═══════════════════════════════════════════════════════════════════════════════
function useServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false);
  const regRef = useRef(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let annule = false;

    // Une nouvelle version est prête quand un worker est "installed" ALORS QU'UN
    // autre contrôle déjà la page. Sans contrôleur, c'est la première visite :
    // rien à signaler.
    const surveiller = (sw) => {
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (!annule && sw.state === "installed" && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }
      });
    };

    navigator.serviceWorker.register("./sw.js").then((reg) => {
      if (annule) return;
      regRef.current = reg;
      if (reg.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
      surveiller(reg.installing);
      reg.addEventListener("updatefound", () => surveiller(reg.installing));
    }).catch(() => {
      // Un échec d'enregistrement ne doit jamais empêcher l'app de fonctionner.
    });

    // Une PWA installée peut rester ouverte des jours : on revérifie à chaque
    // retour au premier plan.
    const verifier = () => {
      const reg = regRef.current;
      if (reg && document.visibilityState === "visible") reg.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", verifier);

    // Quand le nouveau worker prend la main, on recharge une seule fois.
    let dejaRecharge = false;
    const surBascule = () => {
      if (dejaRecharge) return;
      dejaRecharge = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", surBascule);

    return () => {
      annule = true;
      document.removeEventListener("visibilitychange", verifier);
      navigator.serviceWorker.removeEventListener("controllerchange", surBascule);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const reg = regRef.current;
    if (reg && reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    else window.location.reload();
  }, []);

  return { updateReady, applyUpdate };
}

// Bannière de mise à jour. Rendue à la racine, hors de tout parent transformé
// (piège de la Partie L : un transform casse position:fixed).
function UpdateBanner({ onUpdate }) {
  const [enCours, setEnCours] = useState(false);
  return (
    <>
      <style>{`@keyframes forgeSlideDown{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: "linear-gradient(135deg, #064E3B 0%, #0D9488 100%)",
        color: "white", fontFamily: "'DM Sans', sans-serif",
        padding: "calc(10px + env(safe-area-inset-top)) 16px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
        boxShadow: "0 4px 24px rgba(30,40,32,0.28)",
        animation: "forgeSlideDown .35s ease both",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 15, letterSpacing: 1.8, lineHeight: 1.1 }}>
            MISE À JOUR DISPONIBLE
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            Une nouvelle version de l'app est prête.
          </div>
        </div>
        <button
          onClick={() => { setEnCours(true); onUpdate(); }}
          disabled={enCours}
          style={{
            flexShrink: 0, background: "white", color: "#064E3B", border: "none",
            borderRadius: 11, padding: "10px 16px", fontSize: 11, fontWeight: 800,
            letterSpacing: 1, cursor: enCours ? "default" : "pointer",
            opacity: enCours ? 0.7 : 1, fontFamily: "inherit",
            boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          }}>
          {enCours ? "..." : "RECHARGER"}
        </button>
      </div>
    </>
  );
}

// Filet de sécurité : une erreur JavaScript imprévue affiche un écran de
// secours avec un bouton Recharger, au lieu d'un écran blanc définitif.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) {
    try { console.error("Erreur applicative :", error); } catch {}
    // Le rapport part en base pour que le coach le voie. Volontairement sans
    // await ni catch remonté : si le signalement échoue, l'écran d'excuse doit
    // s'afficher quand même.
    try {
      signalerErreur(contexteRapport.supabase, contexteRapport.userId, contexteRapport.role, error);
    } catch {}
  }
  render() {
    if (this.state.hasError) {
      return <ErrorScreen title="UN PROBLÈME EST SURVENU" message="Une erreur inattendue s'est produite. Tes données sont en sécurité — recharge l'application pour reprendre." onLogout={() => window.location.reload()} actionLabel="Recharger l'application"/>;
    }
    return this.props.children;
  }
}

function ForgeCoachingRoot() {
  // bootState : "loading" | "login" | "coachLogin" | "ready" | "demo" | "bootError"
  const [bootState, setBootState] = useState("loading");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // profil lu en base (contient role)
  const supabaseRef = useRef(null);

  // Tient à jour de quoi attribuer un éventuel rapport d'erreur (voir
  // contexteRapport). Sans ça, un plantage arriverait anonyme et inexploitable.
  useEffect(() => {
    contexteRapport.supabase = supabaseRef.current;
    contexteRapport.userId   = session?.user?.id || null;
    contexteRapport.role     = profile?.role || null;
  }, [session, profile]);

  // Lit le profil pour déterminer le rôle, puis route
  const resolveSession = useCallback(async (supabase, sess) => {
    try {
      const { data: prof } = await supabase
        .from("profiles").select("*").eq("id", sess.user.id).single();
      setProfile(prof || null);
    } catch {
      setProfile(null);
    }
    setSession(sess);
    setBootState("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured) { setBootState("demo"); return; }
      try {
        const supabase = await getSupabase();
        supabaseRef.current = supabase;
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data?.session) {
          await resolveSession(supabase, data.session);
        } else {
          setBootState("login");
        }
        supabase.auth.onAuthStateChange((_event, newSession) => {
          if (cancelled) return;
          if (newSession) {
            resolveSession(supabase, newSession);
          } else {
            setSession(null); setProfile(null);
            setBootState("login");
          }
        });
      } catch (e) {
        // Échec technique (CDN Supabase injoignable, réseau coupé au premier
        // lancement...) : on l'affiche. Basculer en démo ici montrerait des
        // données d'exemple à un vrai coaché — c'est pire qu'une erreur.
        if (!cancelled) setBootState("bootError");
      }
    })();
    return () => { cancelled = true; };
  }, [resolveSession]);

  const handleAuthSuccess = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data?.session) await resolveSession(supabase, data.session);
  }, [resolveSession]);

  const handleLogout = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (supabase) await supabase.auth.signOut();
    setSession(null); setProfile(null);
    setBootState("login");
  }, []);

  if (bootState === "loading")    return <LoadingScreen text="Initialisation..."/>;
  if (bootState === "bootError")  return <ErrorScreen title="CONNEXION IMPOSSIBLE" message="L'application n'a pas réussi à joindre le serveur. Vérifie ta connexion internet, puis réessaie." onLogout={() => window.location.reload()} actionLabel="Réessayer"/>;
  if (bootState === "login")      return <LoginScreen onAuthSuccess={handleAuthSuccess} onCoachClick={() => setBootState("coachLogin")}/>;
  if (bootState === "coachLogin") return <CoachLoginScreen onBack={() => setBootState("login")} onAuthSuccess={handleAuthSuccess}/>;

  // ready : router selon le rôle
  if (bootState === "ready" && profile?.role === "coach") {
    return <CoachApp session={session} supabase={supabaseRef.current} coachProfile={profile} onLogout={handleLogout}/>;
  }

  // coaché (ou démo) → app d'entraînement existante, inchangée
  return (
    <AuthenticatedApp
      session={session}
      supabase={supabaseRef.current}
      isDemo={bootState === "demo"}
      onLogout={bootState === "demo" ? null : handleLogout}
    />
  );
}

export default function ForgeCoachingApp() {
  const { updateReady, applyUpdate } = useServiceWorker();
  // Le thème est déjà posé par le script du <head> ; on aligne ici la couleur de
  // la barre d'état, y compris sur l'écran de connexion et dans l'espace coach.
  useEffect(() => { applyTheme(loadTheme()); }, []);
  return (
    <ErrorBoundary>
      {updateReady && <UpdateBanner onUpdate={applyUpdate}/>}
      <ForgeCoachingRoot/>
    </ErrorBoundary>
  );
}
