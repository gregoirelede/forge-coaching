-- ═══════════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — INSTANTANÉ DU SCHÉMA SUPABASE
--
--  Projet   : xlquzhwmdyyiugtezasg  ·  Postgres 17.6
--  Relevé le: 4 août 2026.
--
--  NIVEAU DE CERTITUDE — à lire avant de se fier à ce fichier :
--    · Tables, colonnes, contraintes, index : relevés par introspection directe
--      de la base de production. Fiables.
--    · Section 4, POLICIES : les NOMS des 20 policies sont vérifiés (fournis par
--      le conseiller Supabase). Leurs conditions `USING` en revanche sont
--      RECONSTITUÉES d'après la règle générale de la Partie G.1 du CLAUDE.md,
--      et n'ont PAS été relevées en base. Elles sont plausibles, pas prouvées.
--      Ne pas s'en servir pour réécrire des policies sur la production sans les
--      avoir d'abord confrontées à `SELECT * FROM pg_policies`.
--
--  À QUOI SERT CE FICHIER
--  Les 4 fichiers d'origine (supabase-setup.sql, supabase-espace-coach.sql,
--  supabase-diete.sql, supabase-periodisation.sql) ne sont pas dans le dépôt.
--  Ce fichier les remplace : il décrit l'état exact de la base telle qu'elle
--  tourne aujourd'hui. Il sert de référence de lecture, et permettrait de
--  reconstruire le schéma à neuf sur un projet Supabase vierge.
--
--  IL EST IDEMPOTENT : chaque instruction peut être relancée sans risque sur la
--  base actuelle. Sur la base de production, il ne fera donc RIEN — c'est voulu.
--  Il ne recrée pas les données, uniquement la structure.
--
--  ATTENTION : ce fichier ne modifie jamais une table existante. Si une colonne
--  a été ajoutée depuis, ce fichier ne la posera pas sur une table déjà en place.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. TABLES ────────────────────────────────────────────────────────────────

-- profiles — extension de auth.users. Racine de tout le modèle.
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  access_code text NOT NULL UNIQUE,
  goal        text,
  start_date  date,
  role        text DEFAULT 'coachee' CHECK (role IN ('coach', 'coachee')),
  created_at  timestamptz DEFAULT now(),
  coach_id    uuid REFERENCES public.profiles(id),
  offer       text DEFAULT 'essentiel' CHECK (offer IN ('essentiel', 'premium')),
  is_active   boolean DEFAULT true,
  sex         text CHECK (sex IN ('homme', 'femme')),
  birth_date  date,
  height_cm   integer
);

-- programs — un programme d'entraînement rattaché à un coaché.
CREATE TABLE IF NOT EXISTS public.programs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coachee_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name               text,
  week_structure     jsonb NOT NULL,
  sessions_structure jsonb NOT NULL,
  is_active          boolean DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  program_order      integer DEFAULT 1
);

-- weeks — numérotation CONTINUE depuis le début du coaching (règle métier J.4).
CREATE TABLE IF NOT EXISTS public.weeks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coachee_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id  uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  start_date  date,
  UNIQUE (coachee_id, week_number)
);

-- sets_logged — une ligne par série effectuée.
CREATE TABLE IF NOT EXISTS public.sets_logged (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coachee_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_id           uuid NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  session_config_id integer NOT NULL,
  exercise_index    integer NOT NULL,
  exercise_name     text NOT NULL,
  set_index         integer NOT NULL,
  weight            numeric,
  actual_reps       integer,
  completed         boolean DEFAULT false,
  logged_at         timestamptz DEFAULT now(),
  UNIQUE (coachee_id, week_id, session_config_id, exercise_index, set_index)
);

-- exercises_library — bibliothèque d'exercices du coach.
-- muscle doit correspondre à une clé de muscleColors (liste fermée, Partie H).
CREATE TABLE IF NOT EXISTS public.exercises_library (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   uuid NOT NULL REFERENCES public.profiles(id),
  name       text NOT NULL,
  muscle     text NOT NULL,
  notes      text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (coach_id, name)
);

-- weight_logs — pesées du coaché, une par jour au maximum.
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coachee_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight_kg   numeric NOT NULL,
  logged_date date NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (coachee_id, logged_date)
);

-- nutrition_profiles — paramètres du moteur de calcul nutrition (Partie J.1).
CREATE TABLE IF NOT EXISTS public.nutrition_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coachee_id          uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  allergies           text[] DEFAULT '{}',
  dietary_preferences text[] DEFAULT '{}',
  disliked_foods      text[] DEFAULT '{}',
  medical_flag        boolean DEFAULT false,
  medical_notes       text,
  ed_screening_flag   boolean DEFAULT false,
  consent_disclaimer  boolean DEFAULT false,
  consent_date        timestamptz,
  activity_factor     numeric DEFAULT 1.2,
  goal_adjustment_pct integer DEFAULT 0,
  meals_per_day       integer DEFAULT 4,
  protein_g_per_kg    numeric DEFAULT 2.0,
  fat_g_per_kg        numeric DEFAULT 0.9,
  session_intensity   jsonb DEFAULT '{}'::jsonb,
  updated_at          timestamptz DEFAULT now()
);

-- recipes_library — bibliothèque de recettes du coach.
CREATE TABLE IF NOT EXISTS public.recipes_library (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  meal_type     text CHECK (meal_type IN ('petit_dejeuner', 'dejeuner', 'diner', 'collation')),
  ingredients   jsonb DEFAULT '[]'::jsonb,
  steps         text[] DEFAULT '{}',
  total_kcal    integer DEFAULT 0,
  protein_g     integer DEFAULT 0,
  carbs_g       integer DEFAULT 0,
  fat_g         integer DEFAULT 0,
  base_servings integer DEFAULT 1,
  image_url     text,
  tags          text[] DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

-- meal_plans — plan de repas d'une semaine. day_index : 0 = lundi … 6 = dimanche.
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coachee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_id    uuid NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  day_index  integer NOT NULL,
  meal_type  text NOT NULL,
  recipe_id  uuid REFERENCES public.recipes_library(id) ON DELETE SET NULL,
  servings   numeric DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE (coachee_id, week_id, day_index, meal_type)
);

-- periodization_phases — les phases ne se chevauchent jamais (contrainte métier,
-- garantie par l'application, pas par la base).
CREATE TABLE IF NOT EXISTS public.periodization_phases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coachee_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phase_type          text NOT NULL CHECK (phase_type IN
                      ('prise_de_masse', 'seche', 'recomposition', 'maintien', 'decharge')),
  name                text,
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  program_id          uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  goal_adjustment_pct integer,
  target_note         text,
  phase_order         integer NOT NULL,
  created_at          timestamptz DEFAULT now()
);


-- ─── 2. INDEX ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_exlib_coach            ON public.exercises_library    (coach_id);
CREATE INDEX IF NOT EXISTS idx_exlib_muscle           ON public.exercises_library    (coach_id, muscle);
CREATE INDEX IF NOT EXISTS idx_mealplans_coachee_week ON public.meal_plans           (coachee_id, week_id);
CREATE INDEX IF NOT EXISTS idx_phases_coachee         ON public.periodization_phases (coachee_id, phase_order);
CREATE INDEX IF NOT EXISTS idx_programs_coachee_active ON public.programs            (coachee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recipes_coach          ON public.recipes_library      (coach_id, meal_type);
CREATE INDEX IF NOT EXISTS idx_sets_coachee_week      ON public.sets_logged          (coachee_id, week_id);
CREATE INDEX IF NOT EXISTS idx_sets_session_exercise  ON public.sets_logged          (session_config_id, exercise_index);
CREATE INDEX IF NOT EXISTS idx_weeks_coachee_number   ON public.weeks                (coachee_id, week_number);


-- ─── 3. RLS ACTIVÉE SUR TOUTES LES TABLES ─────────────────────────────────────

ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sets_logged          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises_library    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes_library      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodization_phases ENABLE ROW LEVEL SECURITY;


-- ─── 4. POLICIES (20, telles qu'elles existent en production) ─────────────────
--
--  Principe : le coaché voit ses propres lignes (auth.uid() = coachee_id) ;
--  le coach voit celles de SES coachés (jointure sur profiles.coach_id).
--  La création de comptes passe par les Edge Functions en service_role, qui
--  contournent la RLS — d'où l'absence de policy INSERT sur profiles.

-- profiles
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "coach manages own coachees" ON public.profiles;
CREATE POLICY "coach manages own coachees" ON public.profiles
  FOR ALL USING (coach_id = auth.uid());

-- programs
DROP POLICY IF EXISTS "own programs" ON public.programs;
CREATE POLICY "own programs" ON public.programs
  FOR ALL USING (auth.uid() = coachee_id);

DROP POLICY IF EXISTS "coach manages coachee programs" ON public.programs;
CREATE POLICY "coach manages coachee programs" ON public.programs
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p
                         WHERE p.id = programs.coachee_id AND p.coach_id = auth.uid()));

-- weeks
DROP POLICY IF EXISTS "own weeks" ON public.weeks;
CREATE POLICY "own weeks" ON public.weeks
  FOR ALL USING (auth.uid() = coachee_id);

DROP POLICY IF EXISTS "coach reads coachee weeks" ON public.weeks;
CREATE POLICY "coach reads coachee weeks" ON public.weeks
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p
                            WHERE p.id = weeks.coachee_id AND p.coach_id = auth.uid()));

-- sets_logged
DROP POLICY IF EXISTS "own sets" ON public.sets_logged;
CREATE POLICY "own sets" ON public.sets_logged
  FOR ALL USING (auth.uid() = coachee_id);

DROP POLICY IF EXISTS "coach reads coachee sets" ON public.sets_logged;
CREATE POLICY "coach reads coachee sets" ON public.sets_logged
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p
                            WHERE p.id = sets_logged.coachee_id AND p.coach_id = auth.uid()));

-- exercises_library
DROP POLICY IF EXISTS "coach manages own library" ON public.exercises_library;
CREATE POLICY "coach manages own library" ON public.exercises_library
  FOR ALL USING (coach_id = auth.uid());

-- weight_logs
DROP POLICY IF EXISTS "own weight logs" ON public.weight_logs;
CREATE POLICY "own weight logs" ON public.weight_logs
  FOR ALL USING (auth.uid() = coachee_id);

DROP POLICY IF EXISTS "coach reads coachee weights" ON public.weight_logs;
CREATE POLICY "coach reads coachee weights" ON public.weight_logs
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p
                         WHERE p.id = weight_logs.coachee_id AND p.coach_id = auth.uid()));

-- nutrition_profiles
DROP POLICY IF EXISTS "own nutrition profile" ON public.nutrition_profiles;
CREATE POLICY "own nutrition profile" ON public.nutrition_profiles
  FOR SELECT USING (auth.uid() = coachee_id);

DROP POLICY IF EXISTS "coach manages coachee nutrition" ON public.nutrition_profiles;
CREATE POLICY "coach manages coachee nutrition" ON public.nutrition_profiles
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p
                         WHERE p.id = nutrition_profiles.coachee_id AND p.coach_id = auth.uid()));

-- recipes_library
DROP POLICY IF EXISTS "coach manages own recipes" ON public.recipes_library;
CREATE POLICY "coach manages own recipes" ON public.recipes_library
  FOR ALL USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "coachee reads coach recipes" ON public.recipes_library;
CREATE POLICY "coachee reads coach recipes" ON public.recipes_library
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p
                            WHERE p.id = auth.uid() AND p.coach_id = recipes_library.coach_id));

-- meal_plans
DROP POLICY IF EXISTS "own meal plans" ON public.meal_plans;
CREATE POLICY "own meal plans" ON public.meal_plans
  FOR SELECT USING (auth.uid() = coachee_id);

DROP POLICY IF EXISTS "coach manages coachee meal plans" ON public.meal_plans;
CREATE POLICY "coach manages coachee meal plans" ON public.meal_plans
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p
                         WHERE p.id = meal_plans.coachee_id AND p.coach_id = auth.uid()));

-- periodization_phases
DROP POLICY IF EXISTS "own phases" ON public.periodization_phases;
CREATE POLICY "own phases" ON public.periodization_phases
  FOR SELECT USING (auth.uid() = coachee_id);

DROP POLICY IF EXISTS "coach manages coachee phases" ON public.periodization_phases;
CREATE POLICY "coach manages coachee phases" ON public.periodization_phases
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p
                         WHERE p.id = periodization_phases.coachee_id AND p.coach_id = auth.uid()));

-- FIN DE L'INSTANTANÉ.
