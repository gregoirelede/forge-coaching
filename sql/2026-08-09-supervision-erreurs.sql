-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — SUPERVISION DES ERREURS (Sprint 4)
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable autant de fois que voulu, sans risque.
--
--  Aujourd'hui, quand l'app plante chez un coaché, il voit un écran d'excuse
--  et Greg n'en sait rien — sauf si le coaché pense à le dire. Cette table
--  reçoit le rapport, et l'espace coach l'affiche.
--
--  CE QUI EST ENREGISTRÉ, ET RIEN D'AUTRE : le message d'erreur, le début de
--  la pile d'appels, le navigateur, la version de l'app et la page. AUCUNE
--  donnée de coaché — pas de charge, pas de reps, pas de note, pas de bilan.
--  Un rapport d'erreur sert à réparer, pas à observer les gens.
--
--  PAS DE SERVICE EXTERNE. Un Sentry ou équivalent enverrait ces rapports chez
--  un tiers, imposerait un compte de plus et une dépendance dans le chemin le
--  plus fragile de l'app. Une table de treize colonnes fait le même travail
--  ici, sans rien envoyer nulle part.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.error_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  role        text,              -- 'coach' ou 'coachee', pour trier d'un coup d'œil
  message     text not null,
  stack       text,              -- tronqué côté client
  user_agent  text,
  app_version text,              -- l'empreinte du build, pour savoir si c'est corrigé
  page        text,
  created_at  timestamptz default now()
);

create index if not exists idx_erreurs_recentes
  on public.error_reports (created_at desc);

alter table public.error_reports enable row level security;

-- Chacun peut déposer SON rapport. C'est une écriture seule : personne ne
-- relit ses propres rapports, ils ne servent qu'au coach.
drop policy if exists "signaler sa propre erreur" on public.error_reports;
create policy "signaler sa propre erreur" on public.error_reports
  for insert with check ((select auth.uid()) = user_id);

-- Le coach lit les siens et ceux de SES coachés.
drop policy if exists "coach lit les erreurs de ses coaches" on public.error_reports;
create policy "coach lit les erreurs de ses coaches" on public.error_reports
  for select using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.profiles p
               where p.id = error_reports.user_id
                 and p.coach_id = (select auth.uid()))
  );

-- Le coach peut effacer ce qu'il a traité.
drop policy if exists "coach efface les erreurs traitees" on public.error_reports;
create policy "coach efface les erreurs traitees" on public.error_reports
  for delete using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.profiles p
               where p.id = error_reports.user_id
                 and p.coach_id = (select auth.uid()))
  );

-- ── Contrôle : à lancer après, doit renvoyer 3 lignes ──────────────────────
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'error_reports';
--   signaler sa propre erreur           | INSERT
--   coach lit les erreurs de ses coaches | SELECT
--   coach efface les erreurs traitees    | DELETE
