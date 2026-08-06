# En attente — optimisation des policies RLS

**Statut : rédigée mais NON livrée, volontairement.** À traiter au Sprint 2.

## Ce que le conseiller Supabase signale

108 signalements de performance au 6 août 2026, tous de niveau WARN ou INFO,
**aucun impact mesurable aujourd'hui** (4 profils, 673 séries loguées) :

| Nombre | Signalement | Traité ? |
|---|---|---|
| 20 | `auth_rls_initplan` — `auth.uid()` réévalué à chaque ligne | Non, voir ci-dessous |
| 80 | `multiple_permissive_policies` — deux policies évaluées par requête | Non, voir ci-dessous |
| 6 | `unindexed_foreign_keys` | **Oui** → `2026-08-06-index-cles-etrangeres.sql` |
| 2 | `unused_index` | Non, sans intérêt à cette échelle |

## Pourquoi je ne l'ai pas livrée

**1. `auth_rls_initplan` — le correctif est sûr, mais je ne peux pas le prouver ici.**

Le correctif consiste à écrire `(select auth.uid())` au lieu de `auth.uid()` dans
les 20 policies : PostgreSQL évalue alors la fonction une seule fois par requête
au lieu d'une fois par ligne. La transformation ne change pas le sens de la
règle — mais elle **réécrit les 20 policies de la base de production**. Une
erreur de frappe dans un `USING` et un coaché ne voit plus ses données, ou pire,
voit celles d'un autre.

Livrer ça sans l'avoir testé serait irresponsable. Le test doit simuler chaque
rôle en base (`SET LOCAL ROLE authenticated` + `request.jwt.claims`), compter les
lignes visibles avant et après, et exiger une égalité stricte. Tant que je n'ai
pas pu exécuter ce harnais, la migration reste ici.

**2. `multiple_permissive_policies` — en grande partie non corrigeable, et c'est normal.**

Ces 80 signalements viennent du modèle à deux publics : sur chaque table, une
policy pour le coaché (ses propres lignes) et une pour le coach (celles de ses
coachés). PostgreSQL les combine par OU, donc il les évalue toutes les deux.

Les fusionner en une seule règle n'est **sûr que si les deux policies couvrent
exactement les mêmes commandes**. C'est le cas sur deux tables seulement :

- `programs` : les deux policies sont en `FOR ALL` → fusionnables
- `weight_logs` : idem → fusionnables (et ça corrigerait au passage l'intitulé
  trompeur « coach reads coachee weights », qui accorde en réalité l'écriture)

Partout ailleurs (`weeks`, `sets_logged`, `meal_plans`, `periodization_phases`,
`nutrition_profiles`, `recipes_library`, `profiles`), le coaché a `FOR ALL` et le
coach `FOR SELECT` — ou l'inverse. Les fusionner **élargirait les droits du
coach à l'écriture**. C'est une régression de sécurité déguisée en optimisation.
On ne le fait pas.

## Décision

Au Sprint 2, avec l'accès Supabase stabilisé :

1. Écrire le harnais de vérification par simulation de rôle.
2. Relever la matrice des droits actuels (qui voit quoi, sur les 10 tables).
3. Appliquer `(select auth.uid())` sur les 20 policies.
4. Rejouer le harnais : la matrice doit être **identique à l'unité près**.
5. Fusionner les policies de `programs` et `weight_logs` uniquement.
6. Relancer le conseiller : on doit passer de 108 à environ 70 signalements,
   les 70 restants étant structurels et assumés.
