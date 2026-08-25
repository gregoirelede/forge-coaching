-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — PROGRAMME DE MEYSSA RAZZOUK
--  Full body 2x/semaine · mercredi et dimanche · focus fessier
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable autant de fois que voulu. La deuxième exécution
--  met à jour le programme existant au lieu d'en créer un second, et garde
--  les mêmes numéros de séance — donc l'historique de Meyssa reste attaché.
--
--  CE SCRIPT NE DEVINE AUCUN IDENTIFIANT. Il retrouve Meyssa par son nom et
--  chaque exercice dans TA bibliothèque par son nom exact, avec un motif de
--  repli. Si un exercice a été renommé, le script s'arrête net en te disant
--  lequel, sans rien avoir modifié — plutôt que d'écrire un programme troué.
--
--  ─────────────────────────────────────────────────────────────────────────
--  POURQUOI CE PROGRAMME-LÀ
--
--  Quatre exercices imposés, et ils forment déjà un jeu complet :
--
--    Hip thrust          fessier sous tension maximale, en position COURTE.
--                        Spécifique : il fait peu grossir les cuisses.
--    SDT roumain         chaîne postérieure en position LONGUE.
--    Split squat bulgare unilatéral, grande amplitude, position LONGUE.
--    Hack squat          genou-dominant profond, fessier en bas de course.
--
--  Hanche + genou, court + long : rien ne manque de ce côté. La littérature
--  2023-2026 est claire sur deux points qui orientent tout le reste :
--
--   1. Hip thrust et squat produisent une hypertrophie du grand fessier
--      ÉQUIVALENTE (Plotkin 2023, mesure IRM) — malgré une EMG bien plus
--      élevée au hip thrust. L'EMG ne prédit pas la croissance. Le hip thrust
--      n'est donc pas « le » exercice fessier, c'est celui qui charge le
--      fessier sans faire grossir les cuisses, et sur lequel la charge monte
--      le plus vite. Il est premier, pas seul.
--
--   2. L'entraînement à LONGUE longueur musculaire produit plus
--      d'hypertrophie (méta-analyse 2026). Le hip thrust charge le fessier
--      raccourci : il DOIT être accompagné de travail en position longue.
--      D'où le SDT roumain et le split squat bulgare dans les deux séances,
--      et le hack squat en descente complète — un squat complet recrute le
--      grand fessier environ 35 % de plus qu'un demi-squat.
--
--  LE SEUL AJOUT : l'abduction de hanche. C'est le trou classique de tout
--  programme fessier. Les exercices d'extension de hanche recrutent le haut
--  et le bas du grand fessier de façon comparable ; ce sont les exercices
--  d'ABDUCTION et de rotation externe qui ciblent préférentiellement le HAUT
--  du grand fessier et le moyen fessier — la partie qui donne la rondeur
--  haute. Un programme fessier sans abduction laisse cette portion de côté.
--
--  VOLUME. 17 séries/semaine réellement fessier (hip thrust 7, bulgare 4,
--  abduction 6), plus 6 de SDT roumain et 4 de hack squat qui y contribuent.
--  C'est le haut de la fourchette utile pour une intermédiaire à 2 séances.
--  Chaque mouvement est vu 2 fois par semaine sauf le bulgare et le hack
--  squat, qui alternent — c'est la fréquence bien soutenue par les données.
--
--  DURÉE : 70 minutes par séance, calculées avec estimateSessionMinutes de
--  l'app. 25 séries mercredi, 27 dimanche.
--
--  L'ORDRE EST UN CHOIX, PAS UN HASARD. Le fessier passe en premier dans les
--  deux séances, donc le haut du corps est toujours travaillé fatigué. À
--  2 séances par semaine avec une priorité esthétique annoncée, c'est le bon
--  arbitrage : le haut du corps est entretenu et progresse doucement, le
--  fessier prend tout ce qui reste.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  1. LA BIBLIOTHÈQUE, POUR MÉMOIRE
--  Si le bloc suivant s'arrête sur un exercice introuvable, c'est ici que tu
--  liras son vrai nom.
-- ───────────────────────────────────────────────────────────────────────────
select name as "exercice en bibliothèque", muscle
  from public.exercises_library
 order by name;


-- ───────────────────────────────────────────────────────────────────────────
--  2. LE PROGRAMME
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  NOM_PROG constant text := 'Full body fessier · mercredi et dimanche';
  v_coachee uuid;
  v_coach   uuid;
  v_nom     text;
  v_prog    uuid;
  v_id_a    int;
  v_id_b    int;
  v_ordre   int;
  v_a       jsonb;
  v_b       jsonb;
  v_semaine jsonb;
  n         int;
  r         record;
  v_ex      uuid;
  v_ex_nom  text;
  v_ex_mus  text;
begin

  -- ── Meyssa ───────────────────────────────────────────────────────────────
  select count(*) into n
    from public.profiles
   where role = 'coachee' and name ilike '%razzouk%';
  if n <> 1 then
    raise exception 'Coachée « Razzouk » : % profil(s) trouvé(s), il en faut exactement 1.', n;
  end if;

  select id, coach_id, name into v_coachee, v_coach, v_nom
    from public.profiles
   where role = 'coachee' and name ilike '%razzouk%';

  if v_coach is null then
    raise exception 'Le profil de % n''est rattaché à aucun coach (coach_id vide).', v_nom;
  end if;

  -- ── Le plan, tel qu'il sera écrit ────────────────────────────────────────
  -- nom_exact d'abord ; si l'exercice a été renommé, on retombe sur le motif.
  -- muscle_defaut ne sert QUE si la fiche de bibliothèque n'a pas de muscle :
  -- ce que le coach a saisi prime toujours.
  drop table if exists _plan;
  drop table if exists _resolu;

  create temp table _plan (
    seance        char(1),
    ordre         int,
    nom_exact     text,
    motif         text,
    muscle_defaut text,
    series        int,
    reps          jsonb,
    repos         text,
    commentaire   text,
    technique     text
  ) on commit drop;

  insert into _plan values
    -- ══ MERCREDI · dominante hanche ══════════════════════════════════════
    ('A', 1, 'Hip thrust barre',                  '%hip thrust%',              'Fessier/Ischios', 4, '["8-10","8-10","10-12","10-12"]',  '2''30', 'PAUSE 1 S EN HAUT',    null),
    ('A', 2, 'Soulevé de terre roumain haltères', '%roumain%',                 'Fessier/Ischios', 3, '["8-10","10-12","10-12"]',         '2''30', 'JUSQU''À L''ÉTIREMENT', null),
    ('A', 3, 'Hack squat',                        '%hack squat%',              'Quadriceps',      4, '["8-10","8-10","10-12","12-15"]',  '2''30', 'DESCENTE COMPLÈTE',    null),
    ('A', 4, 'Abduction hanche machine',          '%abduction%',               'Fessier/Ischios', 3, '["15-20","15-20","20-25"]',        '1''15', 'BUSTE PENCHÉ AVANT',   'DS'),
    ('A', 5, 'Développé incliné haltère',         '%développé incliné%',       'Pectoraux',       3, '["8-10","10-12","10-12"]',         '2''00', 'BANC À 30°',           null),
    ('A', 6, 'Tirage vertical',                   'tirage vertical',           'Grand dorsal',    3, '["10-12","10-12","12-15"]',        '2''00', '',                     null),
    ('A', 7, 'Élévation latérale haltères',       '%élévation latérale%',      'Deltoïde lat',    3, '["12-15","15-20","15-20"]',        '1''15', 'SANS ÉLAN',            'Superset'),
    ('A', 8, 'Extension triceps banc',            '%extension triceps banc%',  'Triceps',         2, '["10-12","12-15"]',                '1''00', '',                     null),

    -- ══ DIMANCHE · dominante unilatérale ═════════════════════════════════
    ('B', 1, 'Split squat bulgare haltères',      '%bulgare%',                 'Fessier/Ischios', 4, '["8-10","8-10","10-12","10-12"]',  '2''00', 'PAR JAMBE · BUSTE PENCHÉ', null),
    ('B', 2, 'Hip thrust barre',                  '%hip thrust%',              'Fessier/Ischios', 3, '["12-15","12-15","15-20"]',        '2''00', 'PLUS LÉGER QUE MERCREDI',  null),
    ('B', 3, 'Soulevé de terre roumain haltères', '%roumain%',                 'Fessier/Ischios', 3, '["6-8","8-10","8-10"]',            '2''30', 'PLUS LOURD QUE MERCREDI',  null),
    ('B', 4, 'Abduction hanche machine',          '%abduction%',               'Fessier/Ischios', 3, '["15-20","15-20","20-25"]',        '1''15', 'BUSTE PENCHÉ AVANT',       'DS'),
    ('B', 5, 'Leg curl assis',                    '%leg curl assis%',          'Ischios',         3, '["10-12","12-15","12-15"]',        '1''30', 'DESCENTE EN 3 S',          null),
    ('B', 6, 'Tirage horizontal (Haut du dos)',   '%tirage horizontal (haut%', 'Haut du dos',     3, '["10-12","10-12","12-15"]',        '2''00', '',                         null),
    ('B', 7, 'Chest press couché',                '%chest press%',             'Pectoraux',       3, '["8-10","10-12","10-12"]',         '2''00', '',                         null),
    ('B', 8, 'Curl incliné haltères',             '%curl incliné%',            'Biceps',          2, '["10-12","12-15"]',                '1''00', '',                         'Superset'),
    ('B', 9, 'Mollet press horizontal',           '%mollet press%',            'Mollets',         3, '["12-15","12-15","15-20"]',        '1''00', 'PAUSE 1 S EN BAS',         null);

  -- ── Résolution dans la bibliothèque ──────────────────────────────────────
  create temp table _resolu (
    seance char(1), ordre int, ex_id uuid, ex_nom text, ex_muscle text
  ) on commit drop;

  for r in select * from _plan order by seance, ordre loop
    -- Nom exact d'abord.
    select el.id, el.name, coalesce(nullif(el.muscle, ''), r.muscle_defaut)
      into v_ex, v_ex_nom, v_ex_mus
      from public.exercises_library el
     where el.coach_id = v_coach and el.name = r.nom_exact;

    -- Sinon le motif, qui doit désigner un exercice et un seul.
    if v_ex is null then
      select count(*) into n
        from public.exercises_library el
       where el.coach_id = v_coach and el.name ilike r.motif;
      if n <> 1 then
        raise exception
          'Exercice introuvable ou ambigu : « % » (motif de repli « % » → % correspondance(s)). Regarde la liste renvoyée par la requête 1 et dis-moi son vrai nom.',
          r.nom_exact, r.motif, n;
      end if;
      select el.id, el.name, coalesce(nullif(el.muscle, ''), r.muscle_defaut)
        into v_ex, v_ex_nom, v_ex_mus
        from public.exercises_library el
       where el.coach_id = v_coach and el.name ilike r.motif;
    end if;

    insert into _resolu values (r.seance, r.ordre, v_ex, v_ex_nom, v_ex_mus);
    v_ex := null;
  end loop;

  -- ── Numéros de séance ────────────────────────────────────────────────────
  -- Règle P.3 : ne JAMAIS réutiliser un session_config_id déjà employé par un
  -- programme précédent. Les séries loguées sont indexées dessus — un id
  -- recyclé ferait apparaître les anciennes charges sous les nouveaux noms
  -- d'exercices quand Meyssa consulte ses semaines passées.
  select p.id into v_prog
    from public.programs p
   where p.coachee_id = v_coachee and p.name = NOM_PROG
   order by p.created_at
   limit 1;

  if v_prog is not null then
    -- Relance : on garde les numéros déjà en place.
    select (s->>'id')::int into v_id_a
      from public.programs p, jsonb_array_elements(p.sessions_structure) s
     where p.id = v_prog order by (s->>'id')::int limit 1;
    select (s->>'id')::int into v_id_b
      from public.programs p, jsonb_array_elements(p.sessions_structure) s
     where p.id = v_prog order by (s->>'id')::int desc limit 1;
  else
    select coalesce(max((s->>'id')::int), 0) into n
      from public.programs p, jsonb_array_elements(p.sessions_structure) s
     where p.coachee_id = v_coachee;
    v_id_a := n + 1;
    v_id_b := n + 2;
  end if;

  -- ── Les deux séances ─────────────────────────────────────────────────────
  select jsonb_build_object(
           'id', v_id_a,
           'name', 'FULL BODY A',
           'abdosCardio', jsonb_build_array(
             '3x45 s gainage planche',
             '3x12 relevés de jambes genoux fléchis'),
           'exercises', jsonb_agg(
             jsonb_build_object(
               'ordre', p.ordre,
               'library_exercise_id', x.ex_id,
               'exercice', x.ex_nom,
               'muscle', x.ex_muscle,
               'series', p.series,
               'reps', p.reps,
               'repos', p.repos,
               'commentaire', p.commentaire,
               'technique', p.technique)
             order by p.ordre))
    into v_a
    from _plan p join _resolu x on x.seance = p.seance and x.ordre = p.ordre
   where p.seance = 'A';

  select jsonb_build_object(
           'id', v_id_b,
           'name', 'FULL BODY B',
           'abdosCardio', jsonb_build_array(
             '3x45 s gainage planche',
             '3x15 crunchs à la poulie'),
           'exercises', jsonb_agg(
             jsonb_build_object(
               'ordre', p.ordre,
               'library_exercise_id', x.ex_id,
               'exercice', x.ex_nom,
               'muscle', x.ex_muscle,
               'series', p.series,
               'reps', p.reps,
               'repos', p.repos,
               'commentaire', p.commentaire,
               'technique', p.technique)
             order by p.ordre))
    into v_b
    from _plan p join _resolu x on x.seance = p.seance and x.ordre = p.ordre
   where p.seance = 'B';

  v_semaine := jsonb_build_array(
    jsonb_build_object('day', 'LUNDI',    'sessionId', null),
    jsonb_build_object('day', 'MARDI',    'sessionId', null),
    jsonb_build_object('day', 'MERCREDI', 'sessionId', v_id_a),
    jsonb_build_object('day', 'JEUDI',    'sessionId', null),
    jsonb_build_object('day', 'VENDREDI', 'sessionId', null),
    jsonb_build_object('day', 'SAMEDI',   'sessionId', null),
    jsonb_build_object('day', 'DIMANCHE', 'sessionId', v_id_b));

  -- ── Écriture ─────────────────────────────────────────────────────────────
  -- Un seul programme actif à la fois : l'app lit is_active = true en
  -- maybeSingle(). On désactive les autres, on ne les supprime JAMAIS —
  -- l'historique des séries y est rattaché.
  update public.programs
     set is_active = false
   where coachee_id = v_coachee
     and (v_prog is null or id <> v_prog);

  if v_prog is null then
    select coalesce(max(program_order), 0) + 1 into v_ordre
      from public.programs where coachee_id = v_coachee;

    insert into public.programs
      (coachee_id, name, week_structure, sessions_structure, is_active, program_order)
    values
      (v_coachee, NOM_PROG, v_semaine, jsonb_build_array(v_a, v_b), true, v_ordre)
    returning id into v_prog;

    raise notice 'Programme CRÉÉ pour % (séances % et %).', v_nom, v_id_a, v_id_b;
  else
    update public.programs
       set week_structure     = v_semaine,
           sessions_structure = jsonb_build_array(v_a, v_b),
           is_active          = true
     where id = v_prog;

    raise notice 'Programme MIS À JOUR pour % (séances % et %).', v_nom, v_id_a, v_id_b;
  end if;

end $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  3. CONTRÔLE — ce que Meyssa verra dans son app
-- ═══════════════════════════════════════════════════════════════════════════
select
  s->>'name'                                    as "séance",
  (w.jour)                                      as "jour",
  jsonb_array_length(s->'exercises')            as "exercices",
  (select sum((e->>'series')::int)
     from jsonb_array_elements(s->'exercises') e) as "séries",
  (select count(*)
     from jsonb_array_elements(s->'exercises') e
    where e->>'library_exercise_id' is not null) as "liés à la bibliothèque"
from public.programs p
cross join lateral jsonb_array_elements(p.sessions_structure) s
cross join lateral (
  select string_agg(d->>'day', ', ') as jour
    from jsonb_array_elements(p.week_structure) d
   where d->>'sessionId' = s->>'id') w
where p.is_active
  and p.coachee_id = (select id from public.profiles
                       where role = 'coachee' and name ilike '%razzouk%')
order by s->>'id';


-- Le détail exercice par exercice.
select
  s->>'name'                as "séance",
  (e->>'ordre')::int        as "n°",
  e->>'exercice'            as "exercice",
  e->>'muscle'              as "muscle",
  (e->>'series')::int       as "séries",
  e->'reps'                 as "reps",
  e->>'repos'               as "repos",
  coalesce(e->>'technique', '—') as "technique"
from public.programs p
cross join lateral jsonb_array_elements(p.sessions_structure) s
cross join lateral jsonb_array_elements(s->'exercises') e
where p.is_active
  and p.coachee_id = (select id from public.profiles
                       where role = 'coachee' and name ilike '%razzouk%')
order by s->>'id', (e->>'ordre')::int;
