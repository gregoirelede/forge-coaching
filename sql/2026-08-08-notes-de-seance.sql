-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — NOTES DE SÉANCE (Sprint 3)
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable autant de fois que voulu, sans risque.
--
--  Le bilan hebdomadaire dit comment s'est passée LA SEMAINE. Une note de
--  séance dit ce qui s'est passé sur UNE séance précise : « épaule douloureuse
--  au 3e set du développé », « salle bondée, j'ai remplacé le squat ». Deux
--  granularités différentes, deux besoins différents — d'où deux tables.
--
--  UNE NOTE PAR SÉANCE ET PAR SEMAINE, modifiable. Pas un fil de discussion :
--  un coaché ne va pas tenir une conversation depuis la salle, entre deux
--  séries. Il laisse un mot, le coach le lit avec le bilan de la semaine.
--
--  Même choix que pour les bilans : la clé est week_number, pas week_id.
--  Voir l'explication dans sql/2026-08-08-bilan-hebdomadaire.sql.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.session_notes (
  id                uuid primary key default gen_random_uuid(),
  coachee_id        uuid not null references public.profiles(id) on delete cascade,
  week_number       int  not null,
  session_config_id int  not null,     -- l'id de la séance dans le programme (1..5)
  session_name      text,              -- figé à l'écriture : le programme peut changer de nom
  note              text not null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (coachee_id, week_number, session_config_id)
);

create index if not exists idx_notes_seance_coachee
  on public.session_notes (coachee_id, week_number desc);

alter table public.session_notes enable row level security;

-- Le coaché gère SES notes.
drop policy if exists "own session notes" on public.session_notes;
create policy "own session notes" on public.session_notes
  for all using ((select auth.uid()) = coachee_id);

-- Le coach lit les notes de SES coachés. En lecture seule : une note de séance
-- est la parole du coaché, le coach répond dans le bilan de la semaine.
drop policy if exists "coach reads coachee session notes" on public.session_notes;
create policy "coach reads coachee session notes" on public.session_notes
  for select using (exists (
    select 1 from public.profiles p
    where p.id = session_notes.coachee_id
      and p.coach_id = (select auth.uid())
  ));

-- ── Contrôle : à lancer après, doit renvoyer 2 lignes ──────────────────────
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'session_notes';
--   own session notes                | ALL
--   coach reads coachee session notes | SELECT
