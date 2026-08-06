-- ═══════════════════════════════════════════════════════════════════════════════
--  MIGRATION — 6 août 2026
--  Index manquants sur les clés étrangères (signalés par le conseiller de
--  performance Supabase, niveau INFO).
--
--  RISQUE : NUL. Cette migration n'ajoute que des index. Elle ne modifie aucune
--  donnée, aucune policy, aucune colonne. Elle est idempotente : relançable
--  autant de fois que voulu.
--
--  POURQUOI : sans index sur une clé étrangère, PostgreSQL doit parcourir toute
--  la table pour retrouver les lignes liées. Invisible aujourd'hui (quelques
--  centaines de lignes), pénalisant à mesure que l'historique grossit — et
--  l'historique d'un coaché ne fait que grossir.
--
--  OÙ L'EXÉCUTER : Supabase → projet Forge Coaching → SQL Editor → New query →
--  coller ce fichier → Run. Aucune interruption de service.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_meal_plans_recipe    ON public.meal_plans           (recipe_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_week      ON public.meal_plans           (week_id);
CREATE INDEX IF NOT EXISTS idx_phases_program       ON public.periodization_phases (program_id);
CREATE INDEX IF NOT EXISTS idx_profiles_coach       ON public.profiles             (coach_id);
CREATE INDEX IF NOT EXISTS idx_sets_week            ON public.sets_logged          (week_id);
CREATE INDEX IF NOT EXISTS idx_weeks_program        ON public.weeks                (program_id);

-- Vérification : les 6 index doivent apparaître.
-- SELECT indexname FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND indexname IN ('idx_meal_plans_recipe','idx_meal_plans_week','idx_phases_program',
--                      'idx_profiles_coach','idx_sets_week','idx_weeks_program')
--  ORDER BY indexname;
