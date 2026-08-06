# Dossier `sql/`

## Ce qu'il contient

- **`2026-08-06-index-cles-etrangeres.sql`** — 6 index manquants. Risque nul.
- **`2026-08-06-optimisation-rls.sql`** — optimisation des 20 policies RLS.
  Auto-vérifiée : s'annule entièrement au moindre écart.
- **`NOTE-optimisation-rls.md`** — l'analyse derrière ces deux migrations, et
  pourquoi 80 signalements sur 108 ne doivent PAS être corrigés.
- **`schema-snapshot.sql`** — l'état exact de la base Supabase de production, relevé
  le 4 août 2026 par introspection directe. Idempotent : relançable sans risque.

## Ce qui manque

Les 4 fichiers de migration d'origine cités dans le `CLAUDE.md` (Partie B.4) ne sont
pas dans le dépôt et n'ont pas pu être récupérés :

- `supabase-setup.sql`
- `supabase-espace-coach.sql`
- `supabase-diete.sql`
- `supabase-periodisation.sql`

Ils ont bien été exécutés sur la base — le schéma en place le prouve. Si tu les
retrouves (conversation Claude Chat « développement app », ou historique Supabase →
SQL Editor → onglet des requêtes sauvegardées), ajoute-les ici : ils gardent la trace
de l'ordre historique des migrations, que l'instantané ne restitue pas.

## Règle pour la suite

Toute nouvelle migration arrive ici sous la forme d'un fichier daté, par exemple
`2026-08-10-ajout-messagerie.sql`, et doit être **idempotente** (`IF NOT EXISTS`,
`DROP POLICY IF EXISTS`) pour pouvoir être relancée sans risque.

## Comment exécuter une migration

Supabase → projet **Forge Coaching** → **SQL Editor** → **New query** → coller le
contenu du fichier → **Run**. Vérifier ensuite dans **Table Editor** que le résultat
est celui attendu.
