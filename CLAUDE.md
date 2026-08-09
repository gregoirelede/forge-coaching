# FORGE COACHING — CONTEXTE PROJET COMPLET
### Fichier de référence pour Claude Code · Version 1.3 · Build v7m (522 Ko / 6 200 lignes)

> **Utilisation :** placer ce fichier à la racine du repo sous le nom `CLAUDE.md` — Claude Code le lira automatiquement à chaque session. Sinon, le coller en premier message.

---

# PARTIE A — RÈGLES DE TRAVAIL

Tu travailles sur **Forge Coaching**, une application web de coaching sportif en production, utilisée par de vrais coachés. Lis ce document intégralement avant toute action.

1. **Réponds toujours en français.** Toute l'interface de l'app est en français.
2. **Je suis non technique.** Guide-moi étape par étape pour chaque opération sur GitHub, Supabase ou en ligne de commande. Ne suppose jamais que je sais où cliquer.
3. **L'app est en production. Ne casse rien.** Toute évolution est **additive**. Avant de modifier un bloc, lis-le en entier. En cas de doute sur l'impact, demande-moi avant.
4. **Charte visuelle "Forest & Sand" stricte** (Partie F). **Zéro emoji dans l'UI**, sans exception.
5. **Toute migration SQL doit être idempotente** (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`) — je dois pouvoir la relancer sans risque.
6. **Après chaque build, annonce-moi la taille du fichier `index.html`** — je la vérifie systématiquement après upload.
7. **Jamais la clé `service_role` côté client.** Elle vit uniquement dans les secrets des Edge Functions.
8. **Fournis toujours un parcours de test** après une modification : quoi ouvrir, quoi cliquer, quel résultat attendre.
9. Si une modification touche la base **et** le code, donne-moi l'**ordre exact** des opérations (SQL d'abord, puis déploiement).
10. **Va au bout toi-même (règle du 5 août 2026).** Tout ce qui peut être fait depuis la session doit l'être : builder, fusionner dans `main`, vérifier que GitHub Pages a redéployé, contrôler la base. Ne me laisse que ce qui est réellement hors de ta portée — et dans ce cas, dis-le explicitement au lieu de me donner une consigne à exécuter. Le parcours de test se joue en entier avant de me rendre la main.
11. **Vérifie toujours sur la dernière version (règle du 7 août 2026).** Avant d'affirmer l'état de quoi que ce soit — code, base, déploiement — repars du dépôt à jour (`git pull`) et d'un relevé frais. Une mesure prise avant un déploiement ne prouve rien sur l'état d'après : la citer comme preuve est une faute de méthode.

### Cycle de travail standard pour toute nouvelle fonctionnalité
```
1. Lire les parties concernées de training-app.jsx
2. Modifier training-app.jsx (source unique de vérité)
3. Vérifier la syntaxe : esbuild en dry-run
4. Builder :            npm run build
5. Contrôles auto (Partie E) — le build les fait — + annoncer la taille
6. Jouer la série de tests : npm test    (voir tests/README.md)
7. Me donner : ordre des opérations + parcours de test restant sur téléphone
8. Commit + push + fusion dans main + vérification du déploiement
```

> **`npm test` n'est pas facultatif.** L'app est en production. La série ouvre
> l'app dans un vrai navigateur et rejoue les parcours : connexion, PWA, thèmes,
> notifications. Elle a déjà rattrapé des régressions silencieuses.

---

# PARTIE B — IDENTITÉ & ÉTAT DU PROJET

## B.1 — Fiche d'identité

| Élément | Valeur |
|---|---|
| Nom | **Forge Coaching** |
| Slogan | *Forge ton corps. Forge ta discipline.* |
| Porteur | Grégoire (Greg) Lede — coach sportif, BPJEPS AF |
| Nature | App web React **mono-fichier**, installable en PWA |
| Production | `https://gregoirelede.github.io/forge-coaching/` |
| GitHub | compte `gregoirelede` · repo `forge-coaching` |
| Hébergement | GitHub Pages (HTTPS obligatoire) |
| Backend | Supabase — project ref `xlquzhwmdyyiugtezasg` |
| Compte Supabase | `gregoire.lede777@gmail.com` |
| Poste de dev | PC Windows (PowerShell) |
| Tests | iPhone Safari + Android Chrome |
| Langue UI | Français intégral |

**App Store / Google Play : écarté pour l'instant** (coût + Mac requis pour iOS). L'app reste une PWA installable.

## B.2 — Modèle économique

- Coaching musculation en ligne, cible **débutants et intermédiaires**.
- Deux offres : **Essentiel ~49 €/mois** · **Premium ~89 €/mois**.
- `profiles.offer` vaut `'essentiel'` ou `'premium'`.
- **Module Nutrition = Premium uniquement.** Un coaché Essentiel ne voit jamais l'onglet.
- **Onglet Parcours (périodisation) = toutes offres**, mais les cibles caloriques chiffrées y restent masquées pour l'Essentiel.

## B.3 — Journal des versions

| Build | Contenu | Taille | Lignes |
|---|---|---|---|
| v1–v3 | App coaché : séances, logs kg/reps, comparaison inter-semaines, progrès | — | ~1 551 |
| v4 | Supabase + Auth par code d'accès + RLS | — | — |
| v5 | **Espace coach** : coachés, bibliothèque d'exercices, constructeur de programme | ~303 Ko | — |
| v6 | **Module Nutrition Premium** : BMR/TDEE, recettes, plans de repas, pesées | ~390 Ko | — |
| v7a | **Calendrier de périodisation** : frise, 4 modèles, onglet Parcours | ~435 Ko | 4 575 |
| **v7b** | Fix "semaine en cours" · Réglages chronos/sonnerie · Édition des coachés | 456 617 o | 4 762 |
| **v7c** | Placeholder de l'écran de connexion aligné sur la convention de codes (Partie K.1) | 456 615 o | 4 762 |
| **v7d** | Sprint 1 : codes d'accès + 2 chiffres · icône iOS · polices auto-hébergées · ErrorBoundary · écran d'erreur réseau · confirmations maison · file hors-ligne au retour du réseau · durée de séance calculée | 468 593 o | 4 884 |
| **v7e** | Code d'accès garanti à 8 caractères minimum (`MIN_CODE_LENGTH`) | 468 723 o | 4 894 |
| **v7f** | Sprint 2 : PWA complète — manifest, service worker, bannière de mise à jour, démarrage hors-ligne | 472 501 o | 5 013 |
| **v7g** | Sprint 2 : mode sombre — 64 variables CSS, réglage Auto/Clair/Sombre dans Profil | 484 534 o | 5 114 |
| **v7h** | Sprint 2 : notifications push — chiffrement maison RFC 8291/8292, 2 Edge Functions, réglage Notifications dans Profil | 491 361 o | 5 283 |
| **v7i** | Envoi d'une notification depuis l'espace coach + vraie raison affichée quand une Edge Function refuse | 495 919 o | 5 380 |
| **v7j** | Sprint 3 : onglet **Suivi** côté coach — assiduité, statuts À jour / À relancer / Décrochage | 505 162 o | 5 598 |
| **v7k** | Sprint 3 : vidéos de démonstration sur les exercices (YouTube / Vimeo / fichier) | 512 965 o | 5 758 |
| **v7l** | Sprint 3 : **bilan hebdomadaire** — le coaché fait le point, le coach répond. Correctif : les feuilles passent par un portail | 528 369 o | 6 060 |
| **v7m** | Sprint 3 : **notes de séance** — un mot du coaché sur une séance précise, lu par le coach à côté du bilan. **Sprint 3 terminé** | 534 919 o | 6 200 |
| **v7n** | Sprint 4 : **export de sauvegarde** — le coach télécharge toutes ses données, codes d'accès exclus | 541 304 o | 6 365 |

## B.4 — État d'installation

**Déployé et fonctionnel :**
- [x] `index.html` **v7h** en ligne sur GitHub Pages
- [x] Schéma complet en base — 12 tables, RLS active sur les 12 (voir `sql/schema-snapshot.sql`)
- [x] Edge Functions `create-coachee` et `update-coachee` déployées
- [x] Edge Functions `push-config` et `send-push` déployées *(v7h)*
- [x] PWA installable iOS (Safari → Partager → Sur l'écran d'accueil) et Android (Chrome → bannière)
- [x] Service worker : démarrage hors-ligne + bannière de mise à jour *(v7f)*
- [x] Mode sombre Auto / Clair / Sombre *(v7g)*
- [x] Notifications push, réglage dans Profil *(v7h)*
- [x] Envoi d'une notification par le coach, depuis la fiche d'un coaché *(v7i)*

**Optionnel, non fait :**
- [ ] Clé API Anthropic (`sk-ant-...`) pour la génération de recettes par IA — le bouton "IA" de la page Recettes reste inactif sans elle. Compte sur `console.anthropic.com`, 5 $ de crédit suffisent pour des centaines de générations.

> Si un doute subsiste sur l'état réel de la base, la vérité est dans Supabase → Table Editor. Les **12** tables de la Partie G doivent toutes exister (10 d'origine + `push_subscriptions` et `push_config`, ajoutées en v7h).

---

# PARTIE C — ARCHITECTURE TECHNIQUE

## C.1 — Stack runtime (verrouillée)

- **React 18 + ReactDOM 18** en bundles **UMD inlinés** dans le HTML.
- **Supabase JS** chargé depuis le **CDN jsDelivr** via une balise `<script>` classique, exposé en `window.supabaseJs`.
- Le JS de l'app est **pré-compilé avec esbuild** puis inliné.
- Aucune dépendance npm au runtime. Aucun bundler côté navigateur.
- **Service worker** (`sw.js`, généré au build depuis `src/sw-template.js`) : cache l'app pour le démarrage hors-ligne, détecte les mises à jour, et reçoit les notifications push. Il n'intercepte **jamais** Supabase ni le CDN — aucune donnée de coaché, aucun jeton ne transite par le cache.
- **Notifications push** : chiffrement écrit à la main dans `edge-functions/_webpush.ts` (RFC 8291 + RFC 8292, WebCrypto pur, zéro dépendance). Détail et justification en Partie G.2.

## C.2 — Les quatre pièges déjà rencontrés — ne jamais les reproduire

1. **Pas d'`import()` dynamique** pour Supabase → faisait planter l'app silencieusement (écran blanc). Utiliser `window.supabaseJs.createClient()`.
2. **Pas de Babel standalone dans le navigateur** → échoue silencieusement sur un fichier de cette taille (écran "CHARGEMENT..." infini). La compilation se fait avec esbuild, en amont.
3. **Ne pas inliner le bundle Supabase** → son webpack tente de résoudre un `publicPath` et échoue. CDN uniquement.
4. **L'app ne peut pas joindre Supabase en `file://`** → le navigateur bloque les requêtes d'origine `null`. Tester **uniquement** via l'URL GitHub Pages en HTTPS. Ouvrir `index.html` par double-clic ne prouve rien.

## C.3 — Structure du repo

Arborescence **réelle** au 8 août 2026 (relevée sur le dépôt, pas une intention) :

```
forge-coaching/
├── index.html                          ← LE fichier déployé (produit par le build)
├── sw.js                               ← service worker (produit par le build)
├── manifest.webmanifest                ← PWA installable
├── CLAUDE.md                           ← ce document
├── build.mjs                           ← script de build (Parties E et O)
├── package.json / package-lock.json    ← déclarent esbuild
├── src/
│   ├── training-app.jsx                ← SOURCE UNIQUE (6 365 lignes)
│   ├── theme.css                       ← 64 variables CSS, clair + sombre
│   ├── sw-template.js                  ← gabarit du service worker
│   └── README.md
├── vendor/
│   ├── react.production.min.js         ← React 18.3.1 UMD
│   └── react-dom.production.min.js     ← ReactDOM 18.3.1 UMD
├── fonts/                              ← 14 .woff2 auto-hébergés (DM Sans, Bebas Neue)
├── icons/                              ← icon-192, icon-512, apple-touch-icon
├── sql/
│   ├── schema-snapshot.sql             ← instantané du schéma réel
│   ├── 2026-08-06-index-cles-etrangeres.sql
│   ├── 2026-08-06-optimisation-rls.sql
│   ├── 2026-08-08-notifications-push.sql
│   ├── 2026-08-08-videos-exercices.sql
│   ├── 2026-08-08-bilan-hebdomadaire.sql
│   ├── 2026-08-08-notes-de-seance.sql
│   ├── SPRINT-3-A-JOUER.sql            ← les 3 ci-dessus réunies, pour Greg
│   ├── VERIFIER-SPRINT-3.sql           ← contrôle en lecture seule, 8 lignes de verdict
│   ├── NOTE-optimisation-rls.md
│   └── README.md
├── edge-functions/
│   ├── create-coachee.ts
│   ├── update-coachee.ts
│   ├── push-config.ts                  ← v7h
│   ├── send-push.ts                    ← v7h
│   ├── _webpush.ts                     ← chiffrement RFC 8291/8292, sans dépendance
│   └── _webpush.test.mjs               ← rejoue le protocole à l'envers
├── guides/
│   ├── GUIDE-edge-function-windows.md
│   └── README.md
├── tests/                              ← 12 séries de tests, `npm test`
└── .claude/
    ├── settings.json                   ← autorisations durables (voir O.1)
    └── README.md
```

> `index.html` doit **impérativement rester à la racine**, sinon GitHub Pages ne le sert plus.
> Même chose pour `sw.js` : un service worker ne contrôle que son propre dossier et ceux
> en dessous. Rangé dans un sous-dossier, il ne verrait plus l'app.

---

# PARTIE D — CARTE DU CODE (`training-app.jsx`)

Composants et constantes clés, à connaître avant toute modification :

| Nom | Rôle |
|---|---|
| `SUPABASE_CONFIG` | URL + clé anon, tout en haut du fichier (~lignes 14-15) |
| `getSupabase()` | Fabrique le client Supabase — **transformé au build** |
| `codeToCredentials()` | Convertit un code d'accès en email/mot de passe internes |
| `ForgeCoachingApp` | Composant racine, routage par rôle — **`export default` retiré au build** |
| `LoadingScreen` / `LoginScreen` / `CoachLoginScreen` | Écrans de démarrage |
| `AuthenticatedApp` | Toute l'app côté coaché |
| `CoachApp` | Toute l'app côté coach |
| `NutritionPage` | Nutrition côté coaché |
| `CoachNutritionView` / `CoachRecipesPage` | Nutrition + recettes côté coach |
| `ParcoursPage` | Onglet Parcours côté coaché |
| `CoachPeriodizationView` | Sous-vue Périodisation côté coach |
| `PhaseTimeline` | Frise chronologique (composant partagé) |
| `FloatingBanner` | Bannière flottante des chronomètres |
| `muscleColors` | Couleurs par groupe musculaire — **liste fermée** |
| `PHASE_TYPES` / `PERIODIZATION_TEMPLATES` | Périodisation (Partie I) |
| `DEFAULT_SESSIONS` / `WEEK` | Structure de programme par défaut |
| `activePhasePct` | Objectif nutrition piloté par la phase active |

**États de démarrage de `ForgeCoachingApp`** : `loading` → `login` / `coachLogin` → `ready` (routage `role === 'coach'` vs `coachee`) ou `demo`.

---

# PARTIE E — PIPELINE DE BUILD

> **Correctif du 4 août 2026 — lire la Partie O avant d'utiliser cette partie.** Le `build.mjs` reproduit en E.2 ne redonne **pas** le fichier en production, et deux de ses défauts sont graves : `format: "iife"` provoquerait un écran blanc, et son remplacement de `getSupabase()` supprimerait la persistance de session, déconnectant tous les coachés à chaque fermeture de l'app. **Ne jamais copier le script de E.2.** Le seul script valide est le `build.mjs` présent à la racine du dépôt, prouvé conforme à l'octet près. Les 4 intentions de E.1 et les contrôles de E.3, eux, restent exacts.

## E.1 — Les 4 transformations obligatoires

Appliquées à `training-app.jsx` **avant** compilation :

1. **Ligne d'import React** → `const { useState, useEffect, useCallback, useMemo, useRef } = React;`
2. **`getSupabase()`** → suppression de l'import dynamique, remplacement par `window.supabaseJs.createClient(...)`
3. **`export default function ForgeCoachingApp()`** → `function ForgeCoachingApp()`
4. **URL Supabase** → retirer tout suffixe `/rest/v1/` : `https://xlquzhwmdyyiugtezasg.supabase.co`

## E.2 — Script de build (`build.mjs`, Node 18+)

Prérequis, une seule fois : `npm install esbuild` à la racine du repo.
Et télécharger les deux UMD React 18 dans `vendor/` (production, minifiés).

```js
// build.mjs — node build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { transform } from "esbuild";

const SRC  = "src/training-app.jsx";
const OUT  = "index.html";
const SUPA = "https://xlquzhwmdyyiugtezasg.supabase.co";

let code = readFileSync(SRC, "utf8");

// 1 — import React → destructuring global
code = code.replace(
  /^import\s*\{[^}]*\}\s*from\s*["']react["'];?\s*$/m,
  "const { useState, useEffect, useCallback, useMemo, useRef } = React;"
);

// 2 — getSupabase() → client UMD du CDN
code = code.replace(
  /(const|let|var|async function)\s+getSupabase[\s\S]*?return\s+_supabasePromise;\s*\}/m,
  `let _supabaseClient = null;
function getSupabase() {
  if (!_supabaseClient) {
    _supabaseClient = window.supabaseJs.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }
  return Promise.resolve(_supabaseClient);
}`
);

// 3 — export default
code = code.replace("export default function ForgeCoachingApp()", "function ForgeCoachingApp()");

// 4 — URL Supabase
code = code.replaceAll(SUPA + "/rest/v1/", SUPA);

// Compilation JSX → JS
const { code: appJs } = await transform(code, {
  loader: "jsx", target: "es2017", format: "iife", minify: false,
});

const reactJs    = readFileSync("vendor/react.production.min.js", "utf8");
const reactDomJs = readFileSync("vendor/react-dom.production.min.js", "utf8");

const ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
  + "<defs><linearGradient id='g' x1='0%25' y1='100%25' x2='100%25' y2='0%25'>"
  + "<stop offset='0%25' stop-color='%23064E3B'/><stop offset='100%25' stop-color='%232DD4BF'/>"
  + "</linearGradient></defs>"
  + "<path d='M32 3 L58 12 L58 37 C58 51 32 62 32 62 C32 62 6 51 6 37 L6 12 Z' fill='url(%23g)'/></svg>";

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1"/>
  <title>Forge Coaching</title>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
  <link rel="icon" type="image/svg+xml" href="${ICON}"/>
  <style>* { box-sizing: border-box; margin: 0; padding: 0; } body { background: #F5F1EB; } #root { min-height: 100vh; }</style>
</head>
<body>
  <div id="root"></div>
  <script>${reactJs}</script>
  <script>${reactDomJs}</script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script>window.supabaseJs = window.supabase;</script>
  <script>
${appJs}
const _root = ReactDOM.createRoot(document.getElementById("root"));
_root.render(React.createElement(ForgeCoachingApp));
  </script>
</body>
</html>`;

writeFileSync(OUT, html);
console.log(`index.html : ${Math.round(html.length / 1024)} Ko`);
```

> **Attention aux regex des étapes 1 et 2** : si la source a évolué, elles peuvent ne plus matcher. **Toujours vérifier après build** avec les contrôles ci-dessous. En cas de doute, l'`index.html` actuellement en production est la référence : son squelette HTML est celui qui fonctionne.

## E.3 — Contrôles obligatoires après chaque build

```bash
grep -c "React.createElement" index.html   # doit être > 0
grep -c "esm.sh" index.html                # doit être 0
grep -c "export default" index.html        # doit être 0
grep -c "type=\"text/babel\"" index.html   # doit être 0
grep -c "window.supabaseJs" index.html     # doit être > 0
grep -c "/rest/v1/" index.html             # doit être 0
grep -c "function CoachApp" index.html     # doit être > 0
grep -c "function AuthenticatedApp" index.html
grep -c "ParcoursPage\|PhaseTimeline\|PERIODIZATION_TEMPLATES" index.html
grep -c "NutritionPage\|CoachRecipesPage" index.html
ls -la index.html                          # annoncer la taille
```

---

# PARTIE F — DÉPLOIEMENT

## F.1 — Deux méthodes

**Via Git (à privilégier depuis Claude Code) :**
```bash
git add index.html src/training-app.jsx
git commit -m "v7c : <description courte>"
git push
```

**Via l'interface GitHub (méthode historique de Greg) :**
repo `forge-coaching` → **Add file → Upload files** → déposer `index.html` (il remplace l'ancien) → **Commit changes**.

GitHub Pages redéploie en **~1 minute**. Suivi dans l'onglet **Actions** → ligne "pages build and deployment" avec une coche verte.

## F.2 — La mise à jour n'apparaît pas : procédure de diagnostic

Ordre à respecter, ce piège s'est déjà produit :

1. **Vérifier la taille du fichier sur GitHub** — si elle correspond à l'ancienne version, le remplacement n'a pas pris.
2. **Ouvrir dans le navigateur avec un anti-cache** : `https://gregoirelede.github.io/forge-coaching/?v=2` (incrémenter le chiffre).
3. **Si ça marche avec `?v=` mais pas sur l'icône installée** → c'est le cache de la PWA. Supprimer l'icône de l'écran d'accueil (appui long → Supprimer), puis réinstaller depuis Safari (Partager → Sur l'écran d'accueil).

> **Depuis la v7f, ce problème est résolu.** Le service worker détecte la nouvelle version et affiche une bannière « Mise à jour disponible — Recharger » dans l'app. Plus besoin de supprimer et réinstaller l'icône.
>
> **Exception, une seule fois :** les PWA installées AVANT la v7f n'ont pas encore de service worker. Elles ont besoin d'un dernier rafraîchissement manuel (ou d'une réinstallation) pour l'enregistrer. À partir de là, toutes les mises à jour suivantes se font par la bannière.

---

# PARTIE G — SCHÉMA SUPABASE COMPLET (12 tables)

### `profiles` — extension de `auth.users`
```sql
id                 uuid PK REFERENCES auth.users(id)
name               text NOT NULL
access_code        text UNIQUE NOT NULL      -- code personnel, jamais en clair ici
goal               text
start_date         date
role               text DEFAULT 'coachee' CHECK (role IN ('coach','coachee'))
coach_id           uuid REFERENCES profiles(id)
offer              text DEFAULT 'essentiel' CHECK (offer IN ('essentiel','premium'))
is_active          boolean DEFAULT true
sex                text CHECK (sex IN ('homme','femme'))
birth_date         date
height_cm          int
```

### `programs`
```sql
id                   uuid PK
coachee_id           uuid REFERENCES profiles(id) NOT NULL
name                 text
week_structure       jsonb NOT NULL      -- contenu de WEEK[]
sessions_structure   jsonb NOT NULL      -- contenu de SESSIONS[]
is_active            boolean DEFAULT true
program_order        int DEFAULT 1
created_at           timestamptz DEFAULT now()
```

### `weeks`
```sql
id           uuid PK
coachee_id   uuid REFERENCES profiles(id) NOT NULL
program_id   uuid REFERENCES programs(id) NOT NULL
week_number  int NOT NULL       -- numérotation CONTINUE depuis le début du coaching
start_date   date
UNIQUE (coachee_id, week_number)
```

### `sets_logged`
```sql
id                  uuid PK
coachee_id          uuid REFERENCES profiles(id) NOT NULL
week_id             uuid REFERENCES weeks(id) NOT NULL
session_config_id   int NOT NULL       -- id de la séance (1..5)
exercise_index      int NOT NULL
exercise_name       text NOT NULL
set_index           int NOT NULL       -- 0-based
weight              decimal
actual_reps         int
completed           boolean DEFAULT false
logged_at           timestamptz DEFAULT now()
UNIQUE (coachee_id, week_id, session_config_id, exercise_index, set_index)
```

### `exercises_library`
```sql
id          uuid PK
coach_id    uuid REFERENCES profiles(id) NOT NULL
name        text NOT NULL
muscle      text NOT NULL      -- doit correspondre à une clé de muscleColors
notes       text
video_url   text               -- v7k : YouTube, Vimeo ou fichier .mp4. NULL = pas de vidéo
created_at  timestamptz DEFAULT now()
UNIQUE (coach_id, name)
```
> **La vidéo vit dans la bibliothèque, pas dans le programme.** Le programme d'un coaché ne
> stocke que `library_exercise_id`. Conséquence voulue : le coach corrige une vidéo une seule
> fois, et tous ses coachés voient la correction, sans qu'aucun programme soit retouché.
> Contrepartie : le coaché doit pouvoir **lire** `exercises_library` — d'où la policy ajoutée
> en v7k (voir G.1).

### `weight_logs`
```sql
id          uuid PK
coachee_id  uuid REFERENCES profiles(id) NOT NULL
weight_kg   decimal NOT NULL
logged_date date NOT NULL
created_at  timestamptz DEFAULT now()
UNIQUE (coachee_id, logged_date)
```

### `nutrition_profiles`
```sql
id                   uuid PK
coachee_id           uuid REFERENCES profiles(id) UNIQUE NOT NULL
allergies            text[]
dietary_preferences  text[]
disliked_foods       text[]
medical_flag         boolean DEFAULT false
medical_notes        text
ed_screening_flag    boolean DEFAULT false   -- risque trouble alimentaire
consent_disclaimer   boolean DEFAULT false
consent_date         timestamptz
activity_factor      decimal DEFAULT 1.2     -- vie quotidienne HORS sport
goal_adjustment_pct  int DEFAULT 0           -- surplus(+) / déficit(−) en %
meals_per_day        int DEFAULT 4
protein_g_per_kg     decimal DEFAULT 2.0
fat_g_per_kg         decimal DEFAULT 0.9
updated_at           timestamptz DEFAULT now()
```

### `recipes_library`
```sql
id             uuid PK
coach_id       uuid REFERENCES profiles(id) NOT NULL
name           text NOT NULL
meal_type      text CHECK (meal_type IN ('petit_dejeuner','dejeuner','diner','collation'))
ingredients    jsonb        -- [{name, qty, unit, kcal, protein, carbs, fat}]
steps          text[]
total_kcal     int
protein_g      int
carbs_g        int
fat_g          int
base_servings  int DEFAULT 1
image_url      text         -- une seule image par recette, réutilisée
tags           text[]
created_at     timestamptz DEFAULT now()
```

### `meal_plans`
```sql
id          uuid PK
coachee_id  uuid REFERENCES profiles(id) NOT NULL
week_id     uuid REFERENCES weeks(id) NOT NULL
day_index   int NOT NULL      -- 0 = lundi … 6 = dimanche
meal_type   text NOT NULL
recipe_id   uuid REFERENCES recipes_library(id)
servings    decimal DEFAULT 1
created_at  timestamptz DEFAULT now()
UNIQUE (coachee_id, week_id, day_index, meal_type)
```

### `periodization_phases`
```sql
id                   uuid PK
coachee_id           uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL
phase_type           text NOT NULL CHECK (phase_type IN
                     ('prise_de_masse','seche','recomposition','maintien','decharge'))
name                 text
start_date           date NOT NULL
end_date             date NOT NULL
program_id           uuid REFERENCES programs(id) ON DELETE SET NULL
goal_adjustment_pct  int
target_note          text
phase_order          int NOT NULL
created_at           timestamptz DEFAULT now()
```
Index : `idx_phases_coachee ON periodization_phases(coachee_id, phase_order)`
Contrainte métier : les phases d'un coaché **ne se chevauchent jamais** et sont idéalement contiguës.

### `weekly_reviews` *(v7l)* — la boucle de coaching
```sql
id                uuid PK
coachee_id        uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL
week_number       int NOT NULL
energie           smallint CHECK (1..5)      -- NULL = pas répondu
sommeil           smallint CHECK (1..5)
motivation        smallint CHECK (1..5)
recuperation      smallint CHECK (1..5)
note              text                       -- mot libre du coaché
coach_reply       text                       -- réponse du coach, même ligne
coach_replied_at  timestamptz
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
UNIQUE (coachee_id, week_number)
```
Index : `idx_bilans_coachee ON weekly_reviews(coachee_id, week_number DESC)`

> **Pourquoi `week_number` et pas `week_id`.** La numérotation des semaines est continue depuis
> le début du coaching (règle J.4) et se calcule depuis `profiles.created_at`. Or la ligne dans
> `weeks` n'est créée qu'au premier log de série : dépendre d'elle rendrait impossible le bilan
> d'une semaine où le coaché n'a rien fait — précisément la semaine sur laquelle un coach a le
> plus besoin d'un retour.
>
> Une ligne par coaché et par semaine (`UNIQUE`) : le coaché peut revenir corriger son bilan
> dans la semaine sans en créer un second.

### `session_notes` *(v7m)* — le mot du coaché sur UNE séance
```sql
id                uuid PK
coachee_id        uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL
week_number       int NOT NULL
session_config_id int NOT NULL      -- id de la séance dans le programme (1..5)
session_name      text              -- figé à l'écriture : le programme peut être renommé
note              text NOT NULL
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
UNIQUE (coachee_id, week_number, session_config_id)
```
Index : `idx_notes_seance_coachee ON session_notes(coachee_id, week_number DESC)`

> **Pourquoi une table à part du bilan.** Le bilan dit comment s'est passée *la semaine* ; une
> note dit ce qui s'est passé sur *une séance* — « épaule sensible au 3e set », « salle bondée,
> squat remplacé ». Deux granularités, deux besoins.
>
> Le coach y a un accès **en lecture seule** : une note de séance est la parole du coaché, le
> coach répond dans le bilan de la semaine. Une seule conversation par semaine, pas cinq.

### `push_subscriptions` *(v7h)*
```sql
id               uuid PK
coachee_id       uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL
endpoint         text NOT NULL UNIQUE   -- adresse de l'appareil chez Apple/Google
p256dh           text NOT NULL          -- clé publique de l'appareil
auth             text NOT NULL          -- secret d'authentification de l'appareil
user_agent       text
created_at       timestamptz DEFAULT now()
last_success_at  timestamptz
failure_count    int DEFAULT 0
```
Index : `idx_push_subs_coachee ON push_subscriptions(coachee_id)`
Un coaché peut avoir **plusieurs appareils** (iPhone + ordinateur) : pas d'unicité sur `coachee_id`.
Le coach n'y a **aucun accès direct** — l'envoi passe par `send-push`, qui vérifie l'appartenance.

### `push_config` *(v7h)* — la seule table sans policy, volontairement
```sql
id             int PK DEFAULT 1 CHECK (id = 1)   -- une seule ligne, jamais plus
vapid_public   text NOT NULL
vapid_private  text NOT NULL
subject        text NOT NULL DEFAULT 'mailto:gregoire.lede777@gmail.com'
created_at     timestamptz DEFAULT now()
```
> **À ne pas « corriger ».** La clé privée VAPID signe les envois : qui la lit peut écrire au
> nom de Forge Coaching. La table est donc protégée deux fois — RLS activée **sans aucune
> policy**, et **aucun privilège** pour `anon`/`authenticated`. Seule la clé `service_role`,
> qui ne vit que dans les Edge Functions, y accède. Le conseiller Supabase la signalera
> éternellement en INFO (« RLS enabled, no policy ») : **c'est le comportement voulu**.
>
> La paire de clés n'est écrite nulle part dans le dépôt : elle est générée côté serveur par
> `push-config` au premier abonnement. Personne — ni Greg, ni Claude — ne l'a jamais en main.

## G.1 — Règle RLS générale

RLS activée sur **toutes** les tables, sans exception.

- **Coaché** → ses propres lignes : `auth.uid() = coachee_id`
- **Coach** → celles de ses coachés :
  ```sql
  EXISTS (SELECT 1 FROM profiles p
          WHERE p.id = <table>.coachee_id AND p.coach_id = auth.uid())
  ```
- **Bibliothèques du coach** (`exercises_library`, `recipes_library`) : écriture si `coach_id = auth.uid()` ; lecture seule pour les coachés rattachés à ce coach.

> **`exercises_library` : la lecture coaché existe enfin (v7k).** Elle était décrite ici depuis
> le début mais n'avait jamais été créée en base — c'était le constat n°1 de la Partie O.4. Les
> vidéos de démonstration l'ont rendue nécessaire : sans elle, le coaché ne peut pas suivre le
> `library_exercise_id` de son programme jusqu'à la fiche de l'exercice. Ce qu'elle ouvre
> exactement : lire les exercices de **son** coach — nom, muscle, notes, vidéo. Rien d'autre,
> aucune écriture, et **aucune policy existante n'a été touchée**.

## G.2 — Edge Functions

| Fonction | `verify_jwt` | Rôle |
|---|---|---|
| `create-coachee` | non | Crée le compte Auth + le profil d'un nouveau coaché |
| `update-coachee` | non | Modifie nom, offre et code d'accès (le code change les identifiants Auth) |
| `push-config` *(v7h)* | non | Renvoie la clé **publique** VAPID. Génère la paire au premier appel |
| `send-push` *(v7h)* | **oui** | Envoie une notification. `{test:true}` = à soi-même ; `{coacheeId,title,body}` = coach → son coaché |

Toutes utilisent la clé `service_role` **exclusivement côté serveur**.
`create-coachee` et `update-coachee` sont en `verify_jwt: false` mais vérifient elles-mêmes le
jeton de l'appelant et son `role = 'coach'` — le contrôle est fait, simplement à la main.
`push-config` est réellement publique : elle ne divulgue que la clé publique, faite pour être
connue de tous les navigateurs.

**Le chiffrement des notifications est écrit à la main** (`edge-functions/_webpush.ts`, sans
aucune dépendance) : RFC 8291 pour le contenu (ECDH + HKDF + AES-GCM) et RFC 8292 pour la
signature VAPID (ES256), en WebCrypto pur. Motif : les registres de modules (`esm.sh`, `jsr.io`,
`deno.land`) sont injoignables depuis la VM de travail, et embarquer une bibliothèque
invérifiable dans le chemin qui manipule la clé privée aurait été pire. Le fichier
`_webpush.test.mjs` rejoue le protocole à l'envers — il chiffre, puis déchiffre comme le ferait
le navigateur — et vérifie la signature ES256 avec la clé publique correspondante.

**Redéploiement (PowerShell Windows, Supabase CLI installé via Scoop) :**
```powershell
cd ~\Documents
mkdir -p supabase\functions\<nom-fonction>
# placer le fichier renommé en index.ts dans ce dossier
supabase functions deploy <nom-fonction> --no-verify-jwt
```
Les secrets sont partagés entre toutes les fonctions — inutile de les reconfigurer.
Si `supabase` n'est pas reconnu : fermer/rouvrir PowerShell, ou relancer `supabase login`.

---

# PARTIE H — CHARTE VISUELLE "FOREST & SAND" (verrouillée)

> **Depuis la v7g, toutes les couleurs passent par des variables CSS** définies dans
> `src/theme.css` et inlinées au build. La constante `T` du code ne contient plus que
> des `var(--x)`. Conséquence pratique : **on ne code plus jamais une couleur en dur**
> dans `training-app.jsx` — sinon elle ne suivra pas le mode sombre. Seule exception
> assumée : le dégradé du bouclier (`#064E3B` → `#2DD4BF`), qui est l'identité de
> marque et reste identique dans les deux thèmes.
>
> Le mode sombre garde l'esprit de la charte : fonds vert-charbon plutôt que noirs,
> texte blanc cassé chaud, accent vert éclairci (`#4FA97F`) pour rester lisible.
> Contraste titre/fond mesuré à 14,7:1, très au-dessus du seuil d'accessibilité.

```js
const T = {
  bg: "#F5F1EB", surface: "#FFFCF7", surface2: "#EDE8DF",
  border: "#DDD5C8", borderStrong: "#C8BFB0",
  text: "#1E2820", textSub: "#7A7060", textMuted: "#A89880",
  accent: "#2D6A4F", accentDark: "#1E4D38", accentLight: "#E4F0EB",
  accentText: "#FFFFFF",
};
```

- **Polices** : `DM Sans` (texte courant) · `Bebas Neue` (titres, labels, onglets — majuscules + letter-spacing).
- **Animations** : `fade-in`, `popIn`, transitions douces `0.3s ease`.
- **Zéro emoji** dans l'interface.
- **Logo** : bouclier, monogramme "FC".
- Cartes : `borderRadius` ~13 px, `border: 1px solid T.border`, ombre légère `0 1px 8px`.

### Couleurs des phases de périodisation
| Type | Libellé | Texte | Fond |
|---|---|---|---|
| `prise_de_masse` | Prise de masse | `#C27A00` | `#FEF3DC` |
| `seche` | Sèche | `#1A4A80` | `#DDEEFF` |
| `recomposition` | Recomposition | `#1A6640` | `#E0F5EC` |
| `maintien` | Maintien | `#7A7060` | `#EDE8DF` |
| `decharge` | Décharge | `#5B35B0` | `#EDE8FF` |

### Catégories musculaires (`muscleColors` — liste fermée)
Triceps · Pectoraux · Deltoide post · Deltoide lat · Quadriceps · Ischios · Mollets · Grand dorsal · Haut du dos · Biceps · Fessier/Ischios · Adducteurs

> La saisie du muscle se fait **par menu déroulant**, jamais en texte libre — sinon le code couleur casse. Ajouter une catégorie est une évolution à part entière (couleur + cohérence sur toutes les vues).

---

# PARTIE I — MODULES FONCTIONNELS

## I.1 — Côté coaché

**Connexion** : code d'accès personnel. En interne, l'app génère un email + mot de passe invisibles pour le coaché et ouvre une session Supabase Auth persistée. Déconnexion : lien discret, texte seul, en bas de la page Profil.

**Navigation — 6 onglets** (5 pour un Essentiel) : Accueil · Séances · Parcours · Nutrition *(Premium)* · Progrès · Profil.

- **Séances** — 3 sous-onglets : `SEMAINE` (séances du jour, onglets de jours intégrés, saisie kg/reps par série, chronomètres, badges de technique), `ORGANISATION ENTRAINEMENTS` (structure hebdomadaire), `CONSIGNES` (consignes du coach : label coloré + titre + texte).
  Bandeau "semaine N en cours" en haut.
  En bas de chaque séance, le coaché peut laisser une **note de séance** *(v7m)* : un mot sur
  cette séance-là, modifiable, et effacé s'il vide le champ.
  Un exercice qui a une vidéo de démonstration affiche **Voir la démonstration** une fois déplié
  *(v7k)*. La vidéo n'est chargée qu'au clic : rien ne part sur le réseau tant que le coaché
  n'a rien demandé — il est peut-être en salle, en 4G, entre deux séries.
- **Parcours** *(toutes offres)* — frise de périodisation en lecture seule, phase en cours mise en avant (semaine X/Y + compte à rebours "N semaines restantes"), détail au clic, courbe de poids superposée. Pour un Essentiel : type et objectif affichés, **cibles caloriques chiffrées masquées**.
- **Nutrition** *(Premium)* — cibles kcal + macros, plan de repas de la semaine, saisie de la pesée. **Lecture seule** hors pesée : toute la configuration se fait côté coach.
- **Progrès** — exercices groupés par muscle en accordéon, pastille colorée, record kg, nombre de semaines loguées, mini-graphique au clic.
- **Accueil** — porte la carte **Bilan de la semaine** *(v7l)* : elle invite à faire le point,
  confirme quand c'est envoyé, et passe en vert quand le coach a répondu.
- **Profil** — infos + **Réglages** (voir I.3).

## I.2 — Côté coach

Accès via un lien discret **"Espace coach"** en bas de l'écran de connexion → login email + mot de passe.

- **Suivi** *(v7j)* — l'onglet qui répond à « qui dois-je relancer aujourd'hui ». Trois statuts :
  À jour (séance dans les 4 jours), À relancer (5 à 9 jours), Décrochage (10 jours et plus),
  plus « Jamais démarré » qui n'est pas le même problème. Liste triée par urgence. Par coaché :
  séances de la semaine, taux sur les 4 semaines écoulées, jours depuis la dernière séance.
  Deux règles de calcul à connaître : une séance compte dès la **première** série validée, et le
  taux **ignore la semaine en cours** — la compter ferait chuter tout le monde un lundi matin.

- **Sauvegarde** *(v7n)* — en bas de la liste des coachés. Télécharge un fichier JSON contenant
  tout : profils, programmes, semaines, séries loguées, pesées, nutrition, plans de repas,
  phases, bilans, notes de séance, bibliothèques d'exercices et de recettes. L'export tourne
  côté client avec la session du coach — la RLS lui donne accès à ses coachés et à rien d'autre,
  aucune clé `service_role` n'intervient. La carte se borde d'ambre au-delà de 30 jours sans
  sauvegarde.
  **Les codes d'accès en sont exclus**, conformément à la Partie K : un code est l'unique secret
  d'un compte, et un fichier de sauvegarde traîne dans un dossier Téléchargements. Conséquence à
  connaître : restaurer suppose de recréer les comptes depuis l'espace coach, qui réémettra de
  nouveaux codes — c'est de toute façon le seul chemin légitime.
  `push_config` (clé privée VAPID) et `push_subscriptions` (secrets d'appareils) ne sont pas
  exportées non plus.
- **Liste des coachés** : création (code d'accès + offre, via `create-coachee`), **édition** (nom / offre / code d'accès, via `update-coachee`), désactivation par `is_active` — **jamais de suppression d'historique**.
- **Bibliothèque d'exercices** : CRUD complet, avec un champ **vidéo de démonstration** *(v7k)*.
  Coller un lien suffit : YouTube (toutes ses formes, Shorts compris), Vimeo, ou un fichier
  `.mp4`/`.webm`. L'app dit tout de suite ce qu'elle a reconnu. Un lien non reconnu mais valide
  n'est jamais encastré de force — il s'ouvrira dans le navigateur, plutôt qu'afficher un cadre
  vide et muet. Rien n'est hébergé par Forge Coaching : le plan gratuit Supabase offre 1 Go, une
  seule démonstration filmée le remplirait.
- **Constructeur de programme** : planning hebdomadaire, exercices, séries, reps par série.
- **Détail coaché** : onglets Infos · Programme · Périodisation · Nutrition · Progression (lecture).
  L'onglet **Retours** *(v7l, v7m)* liste les bilans hebdomadaires du coaché, du plus récent au plus
  ancien, avec les quatre curseurs résumés et le mot libre. Un bilan sans réponse est marqué
  « SANS RÉPONSE » ; répondre se fait sur place et la réponse remonte aussitôt côté coaché.
  Les **notes de séance** de la semaine sont affichées juste en dessous du bilan correspondant.
  Une semaine qui n'a que des notes, sans bilan, apparaît quand même — ce retour-là ne se perd pas.
  L'onglet **Infos** porte aussi l'**envoi d'une notification** *(v7i)* : titre (60 car.) + message
  (160 car.), le bouton reste inerte tant que les deux ne sont pas remplis. Le coach ne peut pas
  savoir à l'avance si le coaché a activé ses notifications — la RLS lui interdit de lire
  `push_subscriptions`, volontairement — donc c'est le serveur qui répond « Aucun appareil abonné »
  le cas échéant. La saisie est conservée en cas d'échec.
- **Bibliothèque de recettes** : CRUD + bouton "IA" (API Anthropic) pour aider à remplir la bibliothèque.
- **Périodisation** : appliquer un des 4 modèles depuis une date de début, créer/éditer des phases manuellement, frise + courbe de poids, propositions de transition.

## I.3 — Réglages coaché (v7b, complété en v7g et v7h)

Dans Profil, stockés en **localStorage sur l'appareil de chaque coaché** — rien en base :
- **Apparence** : Automatique / Clair / Sombre. « Automatique » suit le réglage du téléphone, en direct.
- **Chronomètres** actifs ou non.
- **Sonnerie de fin de repos** — modifiable uniquement si les chronomètres sont actifs (grisée sinon).

**Exception, le seul réglage qui vit en base : les Notifications (v7h).** Un abonnement push
appartient à un **appareil**, pas à un compte — il doit donc être connu du serveur pour qu'il
puisse envoyer. La ligne va dans `push_subscriptions`, une par appareil. L'interrupteur reflète
l'état de l'appareil en cours, pas un préférence globale : couper les notifications sur son
téléphone ne les coupe pas sur son ordinateur.

Le réglage prend cinq formes selon ce que permet l'appareil :

| État | Ce que voit le coaché |
|---|---|
| `inactif` | « Être prévenu de tes séances » + interrupteur |
| `actif` | « Rappels de séance et messages de ton coach » + bouton **ENVOYER UN TEST** |
| `refuse` | « Bloquées par ton téléphone » — pas d'interrupteur, il échouerait |
| `ios-non-installee` | Encart expliquant la règle d'Apple et la marche à suivre |
| `indisponible` | « Non disponibles sur cet appareil » |

> Sur iPhone, la sonnerie passe par le son du navigateur : téléphone non silencieux + au moins une interaction préalable avec l'app (règle iOS).
>
> **Sur iPhone, les notifications n'existent QUE si l'app est installée sur l'écran d'accueil.**
> C'est une règle d'Apple, pas une limite de l'app : Safari n'expose même pas `PushManager` hors
> installation. D'où l'encart d'explication plutôt qu'un bouton qui échouerait sans dire pourquoi.

## I.4 — Modèles de périodisation (`PERIODIZATION_TEMPLATES`, constante en dur)

1. **Débutant · Premiers résultats** — 24 semaines
2. **Intermédiaire · Masse & Sèche**
3. **Sèche estivale**
4. **Recomposition longue**

Appliquer un modèle = générer les `periodization_phases` à partir d'une date de début choisie par le coach. Durées et pourcentages sont des **points de départ éditables**.

---

# PARTIE J — RÈGLES MÉTIER (décisions actées)

Ne pas les remettre en cause sans validation explicite de ma part.

1. **Charge et reps comparées indépendamment**, jamais par tonnage. Code couleur vert/rouge sur chaque bulle séparément.
2. Comparaison **strictement avec la semaine immédiatement précédente**. Modifier la semaine N recalcule uniquement les couleurs de N+1, jamais au-delà.
3. **Échec musculaire supposé à chaque série** — c'est le fondement de la comparaison.
4. **Numérotation des semaines continue** depuis le début du coaching, quel que soit le changement de programme.
5. **Semaine "en cours"** = déterminée par la date, **jamais** par la validation d'une série. Loguer dans une semaine future ne doit pas déplacer la semaine en cours (bug corrigé en v7b).
6. Stockage **hybride localStorage + Supabase**.
7. **L'IA sert au coach** pour remplir sa bibliothèque de recettes. **Jamais** de génération par client et par semaine (budget). Une image par recette maximum, réutilisée.
8. **Transitions de phase semi-automatiques** : l'app propose, le coach confirme d'un clic. Jamais de bascule silencieuse.
9. **La phase de périodisation active pilote l'objectif nutrition.** Elle est prioritaire sur `nutrition_profiles.goal_adjustment_pct`. Sans périodisation, le module diète retombe sur le réglage manuel.
10. **Cadre légal nutrition** : questionnaire de santé obligatoire, disclaimers, consentement horodaté, garde-fous dans les calculs. Le contenu est présenté comme **suggestion éducative, jamais comme prescription** — cohérent avec le niveau BPJEPS. Non négociable.
11. **Bornes d'ajustement calorique** : prise de masse +10/+15 % · sèche −15/−20 % · recomposition −5/0 %. Un plancher calorique de sécurité s'applique **toujours**, y compris quand une phase impose un pourcentage plus agressif.

## J.1 — Moteur de calcul nutrition

Recalcul à chaque nouvelle pesée ou changement de paramètre :

1. **Âge** = aujourd'hui − `birth_date`
2. **BMR — Mifflin-St Jeor** (poids = dernière pesée) :
   - Homme : `10×poids + 6.25×taille − 5×âge + 5`
   - Femme : `10×poids + 6.25×taille − 5×âge − 161`
3. **Dépense quotidienne hors sport** = `BMR × activity_factor`
4. **Calories des séances** estimées à partir des données du programme existant
5. **Cible** = TDEE ajusté du `goal_adjustment_pct` (phase active prioritaire), puis **bridé par le plancher de sécurité**
6. **Macros** : protéines = `protein_g_per_kg × poids`, lipides = `fat_g_per_kg × poids`, glucides = le reste
7. **Assemblage des repas** : filtrage par allergies et préférences, ajustement des portions (`servings`) pour approcher les cibles

## J.2 — Ce qu'il ne faut PAS modifier sans discussion

- La logique d'entraînement : programmes, logs, comparaison vert/rouge, chronomètres, numérotation des semaines.
- Le format des données lues par les vues existantes.
- Les garde-fous de sécurité du module nutrition.
- Les policies RLS existantes.

---

# PARTIE K — COMPTES DE TEST

> **Aucun code d'accès réel ne doit figurer dans ce fichier.** Le dépôt est **public**, et un code d'accès suffit à ouvrir la session d'un coaché : l'email et le mot de passe internes s'en déduisent mécaniquement (`codeToCredentials`, formule visible dans l'`index.html` déployé). Publier un code, c'est publier un compte.

| Rôle | Identifiant |
|---|---|
| Coach | `coach@forge.app` + mot de passe choisi |
| Coaché (Greg) | ton code personnel, modifiable depuis l'espace coach |
| Coaché test | Esteban Cervilla — code à demander à Greg |

Les codes se consultent et se modifient dans l'**espace coach → liste des coachés → édition**. C'est le seul endroit légitime : passer par le Table Editor de Supabase désynchroniserait le profil et le compte Auth, et le coaché ne pourrait plus se connecter.

## K.1 — Convention de nommage des codes d'accès (décidée le 5 août 2026)

**Première lettre du prénom + nom de famille + chiffres aléatoires, le tout en majuscules, sans espace ni tiret.**

**Au moins 2 chiffres, et assez pour garantir 8 caractères au total** (constante `MIN_CODE_LENGTH`). Un nom court comme Greg Ledé donne `GLEDE` : avec 2 chiffres seulement, le code ferait 7 caractères, sous le plancher. L'app en ajoute alors un troisième. `GLEDE572`, `MDUPONT35`, `AMONCOMBLE16`.

> **Pourquoi les 2 chiffres (décidé le 6 août 2026).** Le code d'accès est l'**unique secret** du compte : l'email et le mot de passe internes s'en déduisent mécaniquement. Sans chiffres, un code se devine à partir du seul nom de la personne (`MDUPONT` pour Marie Dupont) — or les noms des coachés finissent sur Instagram. Les 2 chiffres multiplient par 100 l'effort de devinette tout en restant dictables au téléphone. L'app les génère automatiquement à la création.

Exemples sur des noms **fictifs** — les codes réels ne s'écrivent nulle part ici :

| Coaché (fictif) | Code |
|---|---|
| Marie Dupont | `MDUPONT27` |
| Jean Bernard | `JBERNARD84` |

À appliquer à **tout nouveau compte coaché**. Le placeholder de l'écran de connexion suit la même forme : `EX : MDUPONT27`.

**Points d'attention lors de l'attribution d'un code :**

- Le code est unique en base (contrainte `UNIQUE` sur `profiles.access_code`). Deux coachés dont le prénom et le nom donneraient le même code — par exemple Marie Dupont et Marc Dupont — entreraient en collision. Dans ce cas, ajouter la deuxième lettre du prénom : `MADUPONT` et `MRDUPONT`.
- Les accents et caractères spéciaux doivent être retirés : l'email interne est dérivé du code via `[^a-z0-9-]`, donc `LEDÉ` deviendrait `led` et non `lede`. Écrire le code sans accent.
- Un code reste **un identifiant de connexion** : il ne se note ni dans le dépôt, ni dans une conversation, ni dans un fichier. Il se transmet directement au coaché.

---

# PARTIE L — BUGS CORRIGÉS (ne pas réintroduire)

- **Modales mal positionnées** : un parent avec `transform` crée un bloc conteneur qui casse `position: fixed`.
- **Feuilles dont les boutons du bas sont incliquables (trouvé le 8 août 2026, v7l).** Même piège
  que le précédent, deuxième variante : la classe `.fade-in` posée sur chaque page anime
  `transform` avec `animation-fill-mode: forwards`. L'élément garde donc un `transform` après
  l'animation, ce qui crée un **contexte d'empilement permanent**. Une feuille rendue à
  l'intérieur d'une page a beau demander `z-index: 301`, elle y reste prisonnière, et la barre
  d'onglets (z-index 100, mais dans le contexte du dessus) repasse par-dessus ses boutons du bas.
  **Solution : rendre les feuilles dans `<body>` via le composant `Portail`** (React
  `createPortal`). Toute nouvelle feuille doit l'utiliser.
- **Inputs `type="date"` qui débordent** sur iOS Safari.
- **Champ "séries" se réinitialisant à 1** pendant l'édition.
- **Badges de technique invisibles** côté coaché.
- **Boutons inaccessibles** dans les modales scrollables.
- **Semaine "en cours" déplacée** par la validation d'une série dans une semaine future, sans retour arrière possible.
- **Onglets tronqués** dans le header (prévoir `padding: 5px 14px` minimum).

---

# PARTIE M — BACKLOG & PROCHAINES ÉTAPES

## M.1 — Où en est le plan en 4 sprints

| Sprint | Contenu | État |
|---|---|---|
| **1 — Sécurité & fondations** | Codes d'accès + 2 chiffres, icône iOS, polices auto-hébergées, ErrorBoundary, écran d'erreur réseau (fin de la fuite du mode démo), confirmations maison, file hors-ligne, index et RLS optimisés en base | **Fait** (v7d–v7e) |
| **2 — PWA, thèmes, notifications** | PWA complète et bannière de mise à jour · mode sombre · notifications push, des deux côtés | **Fait** (v7f–v7i) |
| **3 — Boucle de coaching** | Bilan hebdomadaire, commentaires de séance, vidéos d'exercices, tableau de bord d'assiduité | **Fait** (v7j–v7m) |
| **4 — Mise en conformité & business** | Nom de domaine, pages RGPD, liens de paiement, supervision des erreurs, export de sauvegarde | **En cours** — sauvegarde faite (v7n) |

> **Le Sprint 4 contient un point à ne pas repousser indéfiniment : les sauvegardes.**
> Le plan gratuit de Supabase n'en fait aucune (voir O.7). À prendre le jour du premier client
> payant — perdre les données d'un client qui paie ne se rattrape ni techniquement, ni
> commercialement.

## M.2 — Points d'attention et pistes

**Point d'attention ouvert :** la barre de navigation coaché compte **6 onglets** pour un Premium. C'est le maximum raisonnable sur mobile. Piste si ça devient trop dense à l'usage : intégrer Parcours dans l'écran d'accueil plutôt qu'en onglet dédié. À trancher à l'usage.

**Non fait, envisageable plus tard :** graphiques et analytics avancés côté coach · messagerie intégrée · publication sur les stores · ajout de catégories musculaires · paiement en ligne / gestion des abonnements.

**Phase suivante du projet (hors code) :** acquisition clients — stratégie Instagram, recrutement des premiers bêta-testeurs. Cette partie se traite dans la conversation "Stratégie & Vision", pas ici.

---

# PARTIE N — ENVIRONNEMENT DE TRAVAIL

## N.1 — Où le travail s'exécute

Je travaille **sans machine de développement locale**. Il n'y a pas de dossier du projet sur mon PC, et il n'y en aura pas : je dois pouvoir travailler depuis mon PC Windows, mon iPhone ou mon Android indifféremment.

Le mode de travail est donc **Claude Code sur le web** (`claude.ai/code` ou l'app mobile Claude) : le repo GitHub est cloné dans une machine virtuelle gérée par Anthropic, tu y fais les modifications, et tu pousses une branche que je relis et fusionne.

| Élément | Valeur |
|---|---|
| Repo à connecter | `github.com/gregoirelede/forge-coaching` |
| Branche de production | `main` (c'est elle que GitHub Pages sert) |
| Compte GitHub | `gregoirelede` |
| Machine d'exécution | VM cloud Anthropic, Ubuntu 24.04 — **pas mon PC** |

**Conséquences pratiques à respecter :**

- La VM est **repartie de zéro à chaque session**. Tout ce dont le build a besoin doit être **committé dans le repo** : `vendor/react.production.min.js`, `vendor/react-dom.production.min.js`, `build.mjs`, et un `package.json` déclarant `esbuild`. Ne compte jamais sur un fichier qui ne serait présent que sur ma machine.
- Si `node_modules` est absent, commence par `npm install`.
- Je ne peux **pas** lancer de commande PowerShell moi-même pendant une session cloud. Pour un déploiement d'Edge Function Supabase (qui exige le CLI en local), donne-moi les instructions à part et je les ferai plus tard depuis mon PC.
- Le déploiement se fait **par fusion de branche**, plus par upload manuel. Une fois la branche fusionnée dans `main`, GitHub Pages redéploie tout seul en ~1 minute.
- Je relis les modifications depuis mon téléphone : des messages de commit clairs et une description de PR lisible me sont indispensables.

## N.2 — Repères de version

| Champ | Valeur |
|---|---|
| Dernier build déployé | **8 août 2026** — v7m, 534 919 octets, 6 200 lignes |
| Contenu de ce build | Notes de séance. **Sprint 3 terminé** : assiduité (v7j), vidéos (v7k), bilan hebdomadaire (v7l), notes de séance (v7m) |
| Build précédent | 8 août 2026 — v7l, 528 369 octets. Bilan hebdomadaire + correctif des feuilles rendues dans un portail |
| **En attente** | Les 3 migrations du Sprint 3 ne sont **pas** appliquées en base : le connecteur Supabase a refusé lecture comme écriture toute la session. Greg doit jouer `sql/SPRINT-3-A-JOUER.sql`. Le code déployé fonctionne sans — les 3 fonctionnalités restent simplement invisibles jusque-là |
| Vérification du déploiement | Workflow "pages build and deployment" sur `main` → statut `success`. Consultable depuis la session, pas besoin d'ouvrir GitHub |

> À mettre à jour à chaque déploiement : c'est ce qui te permet de savoir si le `index.html` du repo correspond bien à ce qui est en ligne.
>
> **Comment le vérifier vraiment (règle n°11).** Un `success` sur le workflow prouve que Pages a
> publié, pas que c'est la bonne version. Le contrôle qui tranche : comparer la taille de
> `index.html` sur `main` (via l'API GitHub) à celle du build local. Si les deux nombres sont
> égaux, ce qui est en ligne est bien ce qui a été construit.

## N.3 — Secrets

- **Clé `anon` Supabase** : publique par nature, déjà présente dans l'`index.html` déployé. Aucun problème à la manipuler.
- **Clé API Anthropic** (`sk-ant-...`) : pas encore obtenue. Le jour où elle le sera, elle devra être stockée **hors du repo** et jamais committée.
- ⚠️ **Clé `service_role` Supabase** : ne jamais la coller dans une conversation, ni dans le repo, ni dans un fichier de config. Elle reste uniquement dans les secrets des Edge Functions Supabase.
- Avant chaque commit, vérifie qu'aucun secret ne s'est glissé dans les fichiers modifiés.

---

# PARTIE O — ÉTAT RÉEL DU DÉPÔT (4 août 2026)

Section ajoutée par Claude Code lors de la première session sur le dépôt. Elle décrit ce qui a été **vérifié** ou **corrigé** par rapport aux parties précédentes. En cas de contradiction, c'est cette partie qui fait foi : elle a été établie en lisant le dépôt et la base réels.

## O.1 — Ce qui a été mis en place

Le dépôt ne contenait que `index.html`. L'arborescence de la Partie C.3 a été créée :

| Élément | État |
|---|---|
| `src/training-app.jsx` | **Fourni par Greg le 4 août 2026.** 4 762 lignes, conforme. Le build reproduit la production à l'octet près |
| `CLAUDE.md` | Ajouté à la racine, lu automatiquement à chaque session |
| `build.mjs` | Écrit d'après le fichier de production, gabarit HTML vérifié à l'octet près |
| `package.json` + `package-lock.json` | Déclarent esbuild, `npm install` puis `node build.mjs` |
| `vendor/react*.production.min.js` | **React 18.3.1**, extraits de l'`index.html` de production |
| `sql/schema-snapshot.sql` | Instantané de la base réelle, idempotent |
| `edge-functions/*.ts` | `create-coachee` et `update-coachee` : récupérées depuis Supabase, à l'identique du déployé. `push-config`, `send-push` et `_webpush.ts` *(v7h)* : écrites ici puis déployées — **le code est le même, les commentaires du déployé sont plus courts**. Vérifié le 8 août 2026 avec `get_edge_function`. Pas de redéploiement cosmétique : on ne touche pas à une fonction de production pour des commentaires, surtout sans pouvoir la tester à l'exécution depuis la session (le proxy bloque `supabase.co`) |
| `guides/GUIDE-edge-function-windows.md` | Reconstitué depuis la Partie G.2 |
| `.gitignore` | `node_modules/` |
| `.claude/settings.json` | **Ajouté le 6 août 2026.** Autorise durablement les outils Supabase (le connecteur change d'identifiant entre sessions, l'autorisation cliquée ne survivait pas). Migrations et déploiement d'Edge Functions inclus ; opérations destructrices de projet bloquées. Voir `.claude/README.md` |
| `tests/` + `npm test` | **Ajouté le 8 août 2026.** 6 séries de tests qui ouvrent l'app dans un vrai Chromium et rejouent les parcours. Elles vivaient jusque-là dans le dossier temporaire de la session, donc perdues à chaque fois : elles sont maintenant dans le dépôt. Voir `tests/README.md` |

## O.2 — Corrections apportées à la Partie E

**Le script de E.2 ne doit jamais être utilisé tel quel.** Trois défauts, dont un silencieux et grave.

1. **La transformation 2 (`getSupabase`) est dangereuse.** Le remplacement documenté en E.2 réécrit la fonction en supprimant deux éléments présents dans le fichier réellement en ligne :
   - `auth: { persistSession: true, autoRefreshToken: true }` — sans lui, **plus aucune session n'est conservée** : chaque coaché est déconnecté à la fermeture de l'app et doit ressaisir son code. L'app a l'air de marcher, le dégât n'apparaît qu'à l'usage.
   - `if (!isSupabaseConfigured) return null;` — le garde-fou du mode démo.

   Le bloc exact attendu en sortie de build est celui du `build.mjs` de la racine. Ce dernier vérifie désormais la présence de `persistSession` et du garde-fou, et **interrompt le build** si l'un des deux manque.
2. **`format: "iife"` est faux.** Il enfermerait `ForgeCoachingApp` dans une fonction, `ReactDOM.createRoot` ne le trouverait plus : écran blanc. Le build de production utilise `transform(code, { loader: "jsx", target: "es2017", minify: false })`, **sans `format`**. Vérifié : le code applicatif de l'`index.html` déployé n'est enfermé dans aucune IIFE, et `target: "es2017"` explique les fonctions utilitaires `__spreadValues` en tête de bundle.
3. **Le gabarit HTML de E.2 n'est pas celui de la production.** Les écarts réels : `charset="UTF-8"` (et non `utf-8`), et un `viewport` valant `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`. Le `build.mjs` de la racine reprend le gabarit exact.

**Preuve que le pipeline est juste :** `node build.mjs` lancé sur `src/training-app.jsx` redonne un `index.html` de **456 617 octets, identique à l'octet près** à celui qui tourne en production. C'est le test de non-régression de référence : après toute modification du build, on doit pouvoir retrouver cette égalité en repartant de la source v7b.

`node build.mjs --verifier-gabarit` reste disponible : il reprend le code applicatif de l'`index.html` existant, le repasse dans le gabarit et compare octet par octet, sans avoir besoin de la source.

**Correctif du 8 août 2026 — la taille annoncée par le build était fausse.** Le script
affichait `html.length`, qui compte des **caractères**, pas des octets. Dans une app en
français chaque accent en pèse deux en UTF-8, et l'écart grandissait avec le texte ajouté :
6 octets en v7d, 351 en v7h (491 010 annoncés contre 491 361 réels). Or la règle n°6 veut
que Greg compare ce nombre à celui affiché par GitHub, qui est en octets. Le build mesure
désormais le fichier réel (`statSync(OUT).size`).

Les tailles du journal (Partie B.3) ont été **reprises sur les fichiers réellement
committés**, pas sur la sortie du build. Deux entrées étaient fausses, de 6 octets chacune,
et ont été corrigées : **v7d 468 587 → 468 593** et **v7f 472 495 → 472 501**. Les autres
(v7b, v7c, v7e, v7g) étaient justes : elles avaient été relevées avec `ls`, pas avec le
build.

## O.3 — Corrections apportées à la Partie G

Le schéma décrit est exact, à deux colonnes près, présentes en base mais absentes de la documentation :

- `nutrition_profiles.session_intensity jsonb DEFAULT '{}'` — non documentée.
- `profiles.created_at timestamptz DEFAULT now()` — non documentée.

## O.4 — Deux observations sur la RLS (aucune modification faite)

Constats de lecture, à trancher plus tard. La Partie J.2 interdit de toucher aux policies sans discussion, donc **rien n'a été changé**.

1. ~~**`exercises_library` n'a qu'une seule policy**~~ — **RÉGLÉ le 8 août 2026 (v7k).** La policy de lecture coaché annoncée par G.1 a été créée, parce que les vidéos de démonstration en avaient besoin : le coaché doit pouvoir suivre le `library_exercise_id` de son programme jusqu'à la fiche de l'exercice. Migration `sql/2026-08-08-videos-exercices.sql`.
2. **`weight_logs` → `coach reads coachee weights` est en `FOR ALL`**, pas en `SELECT`. Le nom suggère une lecture seule, la policy accorde l'écriture. Sans danger aujourd'hui (seul le coach concerné est visé), mais l'intitulé induit en erreur.

## O.5 — Vérification de la base au 4 août 2026

Projet `xlquzhwmdyyiugtezasg`, Postgres 17.6, statut ACTIVE_HEALTHY.

- **10 tables sur 10** présentes, **RLS active sur les 10**, 20 policies au total.
- **9 index** conformes, dont `idx_phases_coachee`.
- **2 Edge Functions ACTIVE** (`create-coachee`, `update-coachee`), sans clé en dur : tout passe par `Deno.env`. Chacune vérifie l'identité de l'appelant et son `role = 'coach'`.
- Volumétrie : 4 profils, 14 programmes, 18 semaines, 673 séries loguées, 33 exercices, 23 pesées, 3 phases. `recipes_library` et `meal_plans` sont vides.

## O.7 — Avertissements de sécurité assumés (décidé le 7 août 2026)

**`auth_leaked_password_protection` — ne pas chercher à le corriger.**

Le conseiller de sécurité Supabase signale que la protection contre les mots de
passe fuités est désactivée. Elle l'est parce qu'elle est **réservée au plan Pro**
(~25 $/mois) ; sur le plan gratuit, l'interrupteur du tableau de bord passe au
vert mais la fonction ne s'applique pas.

Décision : **on la laisse désactivée.** Cette protection refuse les mots de passe
figurant dans des fuites connues. Or aucun coaché ne choisit le sien : l'app le
dérive du code d'accès (`Forge_<CODE>_2025!`), une forme qui n'apparaîtra jamais
dans un corpus de fuites. Elle ne couvrirait donc qu'un seul compte, celui du
coach — dont la solidité se règle gratuitement en choisissant un bon mot de passe.

Le conseiller de sécurité restera donc à **1 avertissement** en permanence. C'est
normal, ce n'est pas une régression.

**`rls_auto_enable()` — faux positif, la fonction est une protection.**

Le conseiller signale `public.rls_auto_enable()` comme une fonction
`SECURITY DEFINER` appelable par n'importe qui via `/rest/v1/rpc/`. C'est
inexact : elle est déclarée `RETURNS event_trigger`, et PostgreSQL interdit
d'appeler directement une fonction de ce type — toute tentative échoue.

Ce qu'elle fait : à chaque `CREATE TABLE` dans le schéma `public`, elle exécute
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. C'est un filet de sécurité qui
garantit qu'aucune table ne pourra jamais être créée sans RLS. Elle est durcie
correctement (`SET search_path TO 'pg_catalog'`, propriétaire `postgres`).

**On la garde.** Un `REVOKE EXECUTE ... FROM PUBLIC` suffit à faire taire le
signalement sans rien changer à son fonctionnement : un déclencheur d'événement
est lancé par le moteur, pas via le privilège EXECUTE de l'appelant.

**Le vrai argument du plan Pro, lui, ce sont les sauvegardes.** La documentation
Supabase recommande explicitement aux projets du plan gratuit d'exporter
régulièrement leurs données : **il n'y a aucune sauvegarde automatique**. Le plan
Pro en fait une par jour, conservée 7 jours. À prendre le jour du premier client
payant, pas avant — perdre les données d'un client qui paie n'est récupérable ni
techniquement ni commercialement.

## O.6 — Ce qui manque toujours

**Plus aucun blocage.** Le dépôt est complet et le cycle de travail de la Partie A est opérationnel de bout en bout.

Restent absents, par confort uniquement :

- Les 4 fichiers SQL d'origine (voir `sql/README.md`) — remplacés par `sql/schema-snapshot.sql`.
- Les guides `GUIDE-diete.md` et `GUIDE-periodisation.md` (voir `guides/README.md`).
- La clé API Anthropic, qui laisse le bouton "IA" de la page Recettes inactif (Partie B.4).

---

**FIN DU CONTEXTE.**
Avant de commencer : confirme-moi que tu as tout lu, résume en 5 lignes ce que tu as compris, et dis-moi si quelque chose te manque pour travailler.
