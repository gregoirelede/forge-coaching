-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — VÉRIFIER QUE LE SPRINT 3 EST BIEN EN PLACE
--
--  POUR GREG : Supabase → SQL Editor → New query → colle ce fichier → Run.
--  Ne modifie RIEN. Ne fait que lire et te dire ce qui va et ce qui ne va pas.
--
--  Tu dois obtenir 8 lignes, toutes en « OK ».
--  Si l'une dit « MANQUANT », rejoue sql/SPRINT-3-A-JOUER.sql puis relance ceci.
-- ═══════════════════════════════════════════════════════════════════════════

with controles as (

  -- ── Vidéos de démonstration ──────────────────────────────────────────────
  select 1 as ordre, 'Vidéos · colonne video_url' as controle,
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='exercises_library'
                   and column_name='video_url') as ok
  union all
  select 2, 'Vidéos · le coaché peut lire la bibliothèque',
         exists (select 1 from pg_policies
                 where schemaname='public' and tablename='exercises_library'
                   and policyname='coachee reads coach library')

  -- ── Bilan hebdomadaire ───────────────────────────────────────────────────
  union all
  select 3, 'Bilan · table weekly_reviews',
         to_regclass('public.weekly_reviews') is not null
  union all
  select 4, 'Bilan · RLS activée',
         coalesce((select c.relrowsecurity from pg_class c
                   join pg_namespace n on n.oid=c.relnamespace
                   where n.nspname='public' and c.relname='weekly_reviews'), false)
  union all
  select 5, 'Bilan · 2 policies (coaché + coach)',
         (select count(*) from pg_policies
          where schemaname='public' and tablename='weekly_reviews') = 2

  -- ── Notes de séance ──────────────────────────────────────────────────────
  union all
  select 6, 'Notes · table session_notes',
         to_regclass('public.session_notes') is not null
  union all
  select 7, 'Notes · RLS activée',
         coalesce((select c.relrowsecurity from pg_class c
                   join pg_namespace n on n.oid=c.relnamespace
                   where n.nspname='public' and c.relname='session_notes'), false)
  union all
  select 8, 'Notes · 2 policies (coaché écrit, coach lit)',
         (select count(*) from pg_policies
          where schemaname='public' and tablename='session_notes') = 2
)
select controle,
       case when ok then 'OK' else 'MANQUANT' end as resultat
from controles
order by ordre;

-- ═══════════════════════════════════════════════════════════════════════════
--  BONUS — l'état complet de la base après le Sprint 3.
--  Tu dois voir 14 tables, toutes avec la RLS activée.
--  push_config est la seule sans policy : c'est VOULU, elle garde la clé
--  privée des notifications (voir Partie G du CLAUDE.md).
-- ═══════════════════════════════════════════════════════════════════════════
select c.relname as table_name,
       case when c.relrowsecurity then 'oui' else 'NON — ANOMALIE' end as rls,
       (select count(*) from pg_policies p
        where p.schemaname='public' and p.tablename=c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;
