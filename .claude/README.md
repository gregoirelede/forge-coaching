# Dossier `.claude/`

## `settings.json` — autorisations permanentes de l'accès Supabase

**Pourquoi ce fichier existe.** Le connecteur Supabase se reconnecte plusieurs fois
par session et change d'identifiant à chaque fois : tantôt `Supabase`, tantôt
`6ad508a5-3c00-4157-9ee5-3e11e8a656d5`. L'autorisation accordée en cliquant dans
l'interface est attachée à l'identifiant du moment ; à la reconnexion suivante,
l'outil est vu comme un inconnu et redemande la permission. Sur une session de
travail, ça bloquait toute vérification en base.

Ce fichier accorde l'autorisation une fois pour toutes, en couvrant **les deux
formes d'identifiant**.

**Pourquoi il est committé.** La machine de travail est recréée de zéro à chaque
session (voir Partie N du `CLAUDE.md`). Un `settings.local.json` ignoré par git
serait perdu à chaque fois. Seul un fichier committé survit.

## Ce qui est autorisé (décision de Greg, 6 août 2026)

Tout ce qui touche à la base et aux fonctions du projet, sans redemander :
lecture du schéma, requêtes SQL, conseillers sécurité et performance, journaux,
**migrations** (`apply_migration`) et **déploiement d'Edge Functions**.

## Ce qui reste bloqué

Les opérations qui détruisent ou suspendent le projet lui-même :

| Outil refusé | Effet évité |
|---|---|
| `pause_project` | mettre la base hors service |
| `restore_project` | restauration écrasant l'état courant |
| `create_project` | créer un projet non voulu (et facturé) |
| `delete_branch` | supprimer une branche de base |
| `merge_branch` · `reset_branch` | écraser la base de production depuis une branche |

Ces quatre-là demanderont toujours une validation explicite.

## CE FICHIER NE SUFFIT PAS — constaté le 6 août 2026

Il y a **deux couches d'autorisation superposées**, et ce fichier n'en gouverne
qu'une.

| Couche | Gouvernée par | Constat |
|---|---|---|
| Locale (Claude Code) | ce fichier | **Fonctionne.** Les règles `deny` retirent bien les outils de la liste disponible |
| Connecteur (côté Supabase) | validation dans l'interface | **Non couverte.** Les outils capables d'écrire y sont soumis |

Conséquence observée : sous l'identité `6ad508a5-…`, `get_advisors` répond
normalement, mais `execute_sql` et `apply_migration` renvoient
`MCP error -32003: requires approval` **instantanément**, sans qu'aucune demande
ne soit présentée à l'utilisateur. Il n'y a donc rien à accepter — ce n'est pas
un clic manqué.

Sous l'identité `Supabase`, ces mêmes outils fonctionnent : cette identité-là a
reçu la validation du connecteur le 5 août 2026.

**Donc :** quand le connecteur démarre sous `Supabase`, tout marche. Sous
`6ad508a5-…`, les écritures sont impossibles et il faut attendre une session
qui reparte sur l'autre identité. Ce fichier reste utile pour ses `deny`, qui
sont de vrais garde-fous actifs, mais il ne débloque pas les écritures.

**Si un troisième identifiant apparaît**, l'ajouter aux deux listes. Le nom
complet est visible dans le message d'erreur, sous la forme
`mcp__<identifiant>__execute_sql`.

## Pour révoquer

Supprimer ce fichier, ou retirer les lignes concernées de la liste `allow`.
La permission redeviendra demandée à chaque appel.
