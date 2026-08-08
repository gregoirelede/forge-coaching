-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — SPRINT 3, TOUT EN UN
--
--  POUR GREG : ouvre Supabase → SQL Editor → New query, colle TOUT ce fichier,
--  et clique Run. Une seule fois suffit. Si tu le relances, il ne se passera
--  rien de plus : chaque instruction est écrite pour être rejouable sans
--  risque. Rien n'est supprimé, rien n'est écrasé.
--
--  Ce fichier est la CONCATÉNATION des trois migrations du Sprint 3, réunies
--  ici pour t'éviter trois copier-coller. Les fichiers d'origine restent dans
--  sql/ : ce sont eux qui font foi, celui-ci n'est qu'une commodité.
--
--    1. 2026-08-08-videos-exercices.sql      vidéos de démonstration
--    2. 2026-08-08-bilan-hebdomadaire.sql    bilan de la semaine
--    3. 2026-08-08-notes-de-seance.sql       notes de séance
--
--  APRÈS LE RUN : rien à faire de plus. L'app est déjà déployée et détecte
--  toute seule que les tables existent. Ferme puis rouvre l'app, et les trois
--  fonctionnalités apparaissent.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═════════════════════════════════════════════════════════════════════════
--  SOURCE : sql/2026-08-08-videos-exercices.sql
-- ═════════════════════════════════════════════════════════════════════════

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

-- ═════════════════════════════════════════════════════════════════════════
--  SOURCE : sql/2026-08-08-bilan-hebdomadaire.sql
-- ═════════════════════════════════════════════════════════════════════════

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

-- ═════════════════════════════════════════════════════════════════════════
--  SOURCE : sql/2026-08-08-notes-de-seance.sql
-- ═════════════════════════════════════════════════════════════════════════

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
