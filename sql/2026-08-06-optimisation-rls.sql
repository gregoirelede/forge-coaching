-- ═══════════════════════════════════════════════════════════════════════════════
--  MIGRATION — 6 août 2026
--  Optimisation des 20 policies RLS signalées par le conseiller Supabase
--  (signalement « auth_rls_initplan »).
--
--  CE QU'ELLE FAIT
--  Remplace `auth.uid()` par `(select auth.uid())` dans chaque policy. PostgreSQL
--  évalue alors la fonction UNE FOIS par requête au lieu d'une fois PAR LIGNE.
--  Le sens de la règle est strictement identique ; seul le moment du calcul change.
--
--  POURQUOI ELLE EST SÛRE — lis ce paragraphe, il compte
--  Cette migration ne réécrit AUCUNE règle à la main. Elle demande à PostgreSQL la
--  définition actuelle de chaque policy, y applique la substitution, et la remet en
--  place. Aucun risque de faute de frappe dans un `USING`.
--
--  Elle se vérifie elle-même : elle photographie l'état AVANT, applique les
--  changements, puis recompare. Si la moindre policy diverge autrement que par la
--  substitution prévue — commande modifiée, rôle modifié, condition altérée,
--  policy disparue — elle LÈVE UNE ERREUR et **annule tout**. Le tout est dans une
--  transaction : soit la totalité passe, soit la base reste exactement comme avant.
--  Il n'existe pas d'état intermédiaire.
--
--  Elle est idempotente : relançable autant de fois que voulu. Une policy déjà
--  optimisée est d'abord ramenée à sa forme d'origine avant d'être réécrite, donc
--  jamais d'imbrication en double.
--
--  CE QU'ELLE NE FAIT PAS
--  Elle ne touche pas au signalement « multiple_permissive_policies » (80 lignes).
--  Voir EN-ATTENTE-optimisation-rls.md : sur 8 tables sur 10, fusionner les
--  policies élargirait les droits d'écriture du coach. C'est une régression de
--  sécurité déguisée en optimisation, on ne la fait pas.
--
--  OÙ L'EXÉCUTER
--  Supabase → projet Forge Coaching → SQL Editor → New query → coller tout ce
--  fichier → Run. Aucune interruption de service, aucune donnée touchée.
--
--  RÉSULTAT ATTENDU
--  Un tableau final listant les policies traitées, puis le message
--  « MIGRATION VALIDEE ». Si tu vois une erreur rouge à la place, rien n'a été
--  modifié — envoie-la-moi telle quelle.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Photo de l'état AVANT ──────────────────────────────────────────────────
CREATE TEMP TABLE _rls_avant ON COMMIT DROP AS
SELECT schemaname, tablename, policyname, cmd,
       roles::text AS roles, permissive, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';

CREATE TEMP TABLE _rls_traitees (tablename text, policyname text, cmd text) ON COMMIT DROP;


-- ── 2. Réécriture, à partir de la définition réelle lue en base ────────────────
DO $migration$
DECLARE
  r          record;
  base_qual  text;
  base_check text;
  new_qual   text;
  new_check  text;
  ordre      text;
BEGIN
  FOR r IN
    SELECT * FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
    ORDER BY tablename, policyname
  LOOP
    -- On repart toujours de la forme NON optimisée : garantit l'idempotence.
    base_qual  := regexp_replace(coalesce(r.qual, ''),
                    '\( SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'g');
    base_check := regexp_replace(coalesce(r.with_check, ''),
                    '\( SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'g');

    new_qual  := replace(base_qual,  'auth.uid()', '( SELECT auth.uid() AS uid)');
    new_check := replace(base_check, 'auth.uid()', '( SELECT auth.uid() AS uid)');

    ordre := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);

    IF r.qual IS NOT NULL THEN
      ordre := ordre || format(' USING (%s)', new_qual);
    END IF;
    IF r.with_check IS NOT NULL THEN
      ordre := ordre || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE ordre;
    INSERT INTO _rls_traitees VALUES (r.tablename, r.policyname, r.cmd);
  END LOOP;
END
$migration$;


-- ── 3. Vérification — annule tout au moindre écart ────────────────────────────
DO $verif$
DECLARE
  nb_avant   int;
  nb_apres   int;
  nb_diff    int;
  nb_traite  int;
BEGIN
  SELECT count(*) INTO nb_avant FROM _rls_avant;
  SELECT count(*) INTO nb_apres FROM pg_policies WHERE schemaname = 'public';
  SELECT count(*) INTO nb_traite FROM _rls_traitees;

  -- 3a. Aucune policy perdue ni ajoutée
  IF nb_avant <> nb_apres THEN
    RAISE EXCEPTION
      'ANNULATION : % policies avant, % apres. Aucune policy ne doit apparaitre ni disparaitre.',
      nb_avant, nb_apres;
  END IF;

  -- 3b. Chaque policy existe toujours, sur la meme table, avec la meme commande,
  --     les memes roles, et une condition identique une fois la substitution
  --     neutralisee des deux cotes.
  SELECT count(*) INTO nb_diff
  FROM _rls_avant a
  FULL OUTER JOIN (
    SELECT schemaname, tablename, policyname, cmd,
           roles::text AS roles, permissive, qual, with_check
    FROM pg_policies WHERE schemaname = 'public'
  ) p
    ON  p.schemaname = a.schemaname
    AND p.tablename  = a.tablename
    AND p.policyname = a.policyname
  WHERE a.policyname IS NULL
     OR p.policyname IS NULL
     OR a.cmd        IS DISTINCT FROM p.cmd
     OR a.roles      IS DISTINCT FROM p.roles
     OR a.permissive IS DISTINCT FROM p.permissive
     OR regexp_replace(coalesce(a.qual, ''),
          '\( SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'g')
        IS DISTINCT FROM
        regexp_replace(coalesce(p.qual, ''),
          '\( SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'g')
     OR regexp_replace(coalesce(a.with_check, ''),
          '\( SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'g')
        IS DISTINCT FROM
        regexp_replace(coalesce(p.with_check, ''),
          '\( SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'g');

  IF nb_diff > 0 THEN
    RAISE EXCEPTION
      'ANNULATION : % policy(s) divergent au-dela de la substitution prevue. Base inchangee.',
      nb_diff;
  END IF;

  -- 3c. La substitution a bien été appliquée partout où elle devait l'être
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
      AND coalesce(qual, '') || coalesce(with_check, '') NOT LIKE '%SELECT auth.uid()%'
  ) THEN
    RAISE EXCEPTION 'ANNULATION : des policies utilisent encore auth.uid() non optimise.';
  END IF;

  RAISE NOTICE 'Verification OK — % policies traitees, % policies au total, aucune divergence.',
    nb_traite, nb_apres;
END
$verif$;


-- ── 4. Compte rendu ───────────────────────────────────────────────────────────
SELECT tablename AS "Table", policyname AS "Policy", cmd AS "Commande"
FROM _rls_traitees
ORDER BY tablename, policyname;

SELECT 'MIGRATION VALIDEE — ' || count(*) || ' policies optimisees, aucune divergence.' AS resultat
FROM _rls_traitees;

COMMIT;

-- Après exécution, le conseiller de performance doit passer de 108 à environ 88
-- signalements : les 20 « auth_rls_initplan » disparaissent. Les 80
-- « multiple_permissive_policies » restants sont structurels et assumés.
