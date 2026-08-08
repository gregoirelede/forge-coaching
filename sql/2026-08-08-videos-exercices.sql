-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — VIDÉOS DE DÉMONSTRATION (Sprint 3)
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable autant de fois que voulu, sans risque.
--
--  Ce que ça change :
--    1. Une colonne video_url sur les exercices de la bibliothèque du coach.
--    2. Une policy de LECTURE pour que le coaché puisse voir la vidéo.
--
--  POURQUOI LA POLICY EST NÉCESSAIRE
--  Le programme d'un coaché ne stocke pas le lien de la vidéo : il stocke
--  library_exercise_id, une référence vers la fiche de l'exercice. C'est ce
--  qui permet au coach de corriger une vidéo une seule fois, dans sa
--  bibliothèque, et que tous ses coachés voient la correction. Sans droit de
--  lecture sur exercices_library, le coaché ne peut pas suivre cette
--  référence, et aucune vidéo ne s'affiche.
--
--  Cette policy n'est pas une nouveauté conceptuelle : la règle G.1 du
--  CLAUDE.md décrit depuis le début une « lecture seule pour les coachés
--  rattachés à ce coach ». Elle n'avait simplement jamais été créée en base
--  (constat O.4 du 4 août 2026). On aligne donc la base sur la règle écrite.
--
--  CE QU'ELLE OUVRE, EXACTEMENT : un coaché peut lire les exercices de SON
--  coach — nom, muscle, notes, vidéo. Rien d'autre. Il ne voit pas les
--  exercices d'un autre coach, ne peut rien modifier, et cette policy ne
--  touche à AUCUNE policy existante (elle s'ajoute à « coach manages own
--  library », qui reste inchangée).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La colonne ──────────────────────────────────────────────────────────
alter table public.exercises_library
  add column if not exists video_url text;

comment on column public.exercises_library.video_url is
  'Lien de démonstration : YouTube, Vimeo, ou fichier vidéo direct (.mp4/.webm). NULL = pas de vidéo.';

-- ── 2. La lecture par le coaché ────────────────────────────────────────────
drop policy if exists "coachee reads coach library" on public.exercises_library;
create policy "coachee reads coach library" on public.exercises_library
  for select using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.coach_id = exercises_library.coach_id
  ));

-- ── Contrôle : à lancer après, doit renvoyer 2 lignes ──────────────────────
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'exercises_library';
--   coach manages own library    | ALL
--   coachee reads coach library  | SELECT
