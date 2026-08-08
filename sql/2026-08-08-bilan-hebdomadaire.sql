-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — BILAN HEBDOMADAIRE (Sprint 3)
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable autant de fois que voulu, sans risque.
--
--  Le coaché fait le point une fois par semaine : énergie, sommeil, motivation,
--  récupération, plus un mot libre. Le coach lit et répond. C'est la boucle qui
--  manquait — jusqu'ici l'information ne circulait que dans un sens, du coach
--  vers le coaché.
--
--  UNE LIGNE PAR COACHÉ ET PAR SEMAINE. La contrainte d'unicité est ce qui
--  permet au coaché de revenir corriger son bilan dans la semaine sans en
--  créer un second, et au coach de savoir de quelle semaine on parle.
--
--  POURQUOI week_number ET PAS week_id : la numérotation des semaines est
--  continue depuis le début du coaching (règle métier J.4) et se calcule à
--  partir de profiles.created_at. Un bilan existe même une semaine où le
--  coaché n'a validé aucune série — or la ligne dans `weeks` n'est créée qu'au
--  premier log. Dépendre de `weeks` empêcherait justement de recevoir le bilan
--  des semaines où il ne s'est rien passé, qui sont les plus intéressantes.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.weekly_reviews (
  id               uuid primary key default gen_random_uuid(),
  coachee_id       uuid not null references public.profiles(id) on delete cascade,
  week_number      int  not null,

  -- Quatre curseurs de 1 à 5. NULL = le coaché n'a pas répondu à celui-là.
  energie          smallint check (energie     between 1 and 5),
  sommeil          smallint check (sommeil     between 1 and 5),
  motivation       smallint check (motivation  between 1 and 5),
  recuperation     smallint check (recuperation between 1 and 5),
  note             text,

  -- La réponse du coach vit sur la même ligne : un bilan, un échange.
  coach_reply      text,
  coach_replied_at timestamptz,

  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (coachee_id, week_number)
);

create index if not exists idx_bilans_coachee
  on public.weekly_reviews (coachee_id, week_number desc);

alter table public.weekly_reviews enable row level security;

-- Le coaché gère SES bilans.
-- Il peut aussi écrire dans coach_reply au niveau SQL — c'est sans intérêt
-- pour lui (il verrait sa propre réponse) et l'app ne le propose pas. Une
-- policy par colonne demanderait un trigger : disproportionné ici.
drop policy if exists "own weekly reviews" on public.weekly_reviews;
create policy "own weekly reviews" on public.weekly_reviews
  for all using ((select auth.uid()) = coachee_id);

-- Le coach lit et répond aux bilans de SES coachés.
drop policy if exists "coach manages coachee reviews" on public.weekly_reviews;
create policy "coach manages coachee reviews" on public.weekly_reviews
  for all using (exists (
    select 1 from public.profiles p
    where p.id = weekly_reviews.coachee_id
      and p.coach_id = (select auth.uid())
  ));

-- ── Contrôle : à lancer après, doit renvoyer 2 lignes ──────────────────────
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'weekly_reviews';
--   own weekly reviews            | ALL
--   coach manages coachee reviews | ALL
