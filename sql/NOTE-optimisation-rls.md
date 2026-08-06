# Optimisation des policies RLS — état au 6 août 2026

## Résumé

Le conseiller de performance Supabase remonte **108 signalements**, tous WARN ou
INFO, **sans impact mesurable aujourd'hui** (4 profils, 673 séries loguées).

| Nombre | Signalement | Traitement |
|---|---|---|
| 20 | `auth_rls_initplan` | **Migration écrite** → `2026-08-06-optimisation-rls.sql` |
| 80 | `multiple_permissive_policies` | **Non corrigeable sans régression** — voir plus bas |
| 6 | `unindexed_foreign_keys` | **Migration écrite** → `2026-08-06-index-cles-etrangeres.sql` |
| 2 | `unused_index` | Ignoré, sans intérêt à cette échelle |

## Les 20 policies à optimiser (liste vérifiée auprès du conseiller)

| Table | Policy |
|---|---|
| `exercises_library` | coach manages own library |
| `meal_plans` | coach manages coachee meal plans · own meal plans |
| `nutrition_profiles` | coach manages coachee nutrition · own nutrition profile |
| `periodization_phases` | coach manages coachee phases · own phases |
| `profiles` | coach manages own coachees · own profile select · own profile update |
| `programs` | coach manages coachee programs · own programs |
| `recipes_library` | coach manages own recipes · coachee reads coach recipes |
| `sets_logged` | coach reads coachee sets · own sets |
| `weeks` | coach reads coachee weeks · own weeks |
| `weight_logs` | coach reads coachee weights · own weight logs |

## Comment la migration évite le danger

Réécrire 20 policies de production à la main est risqué : une faute dans un
`USING` et un coaché ne voit plus ses données — ou voit celles d'un autre.

La migration ne les écrit donc **pas** à la main. Elle demande à PostgreSQL la
définition réelle de chaque policy, applique la substitution
`auth.uid()` → `(select auth.uid())`, et la remet en place. Puis elle recompare
l'état avant et après : si une commande, un rôle ou une condition diverge
autrement que par cette substitution, elle lève une erreur et **annule la
totalité**. Tout est dans une transaction — il n'existe pas d'état intermédiaire.

C'est ce qui la rend exécutable sans relecture technique du SQL.

## Pourquoi les 80 autres ne sont pas corrigées

Elles viennent du modèle à deux publics : sur chaque table, une policy pour le
coaché (ses lignes) et une pour le coach (celles de ses coachés). PostgreSQL les
combine par OU, donc les évalue toutes les deux.

Les fusionner n'est **sûr que si les deux policies couvrent exactement les mêmes
commandes**. Le conseiller donne le détail, table par table :

| Table | Commandes ayant 2 policies | Fusion possible ? |
|---|---|---|
| `programs` | SELECT, INSERT, UPDATE, DELETE | **Oui** — les deux sont en `FOR ALL` |
| `weight_logs` | SELECT, INSERT, UPDATE, DELETE | **Oui** — idem |
| `weeks`, `sets_logged`, `meal_plans`, `nutrition_profiles`, `periodization_phases`, `recipes_library` | SELECT uniquement | **Non** — l'une est `FOR ALL`, l'autre `FOR SELECT` |
| `profiles` | SELECT, UPDATE | **Non** — trois policies aux portées différentes |

Sur les 8 tables du bas, fusionner **élargirait les droits d'écriture du coach**.
C'est une régression de sécurité déguisée en optimisation. On ne le fait pas.

Restent `programs` et `weight_logs`, réellement fusionnables. Le gain est
marginal ; l'intérêt serait surtout de corriger au passage l'intitulé trompeur
« coach reads coachee weights », qui accorde en réalité l'écriture. À traiter
un jour où on touchera à ces tables pour une autre raison, pas avant.

## Ordre d'exécution recommandé

1. `2026-08-06-index-cles-etrangeres.sql` — risque nul, ajoute 6 index.
2. `2026-08-06-optimisation-rls.sql` — auto-vérifiée, s'annule seule en cas d'écart.
3. Relancer le conseiller de performance : on doit passer de 108 à environ 88.
