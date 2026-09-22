-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — PROGRAMME DE GRÉGOIRE LEDÉ
--  Upper / Lower 4 jours · lundi, mardi, jeudi, vendredi
--  Focus : triceps + brachial · épaules · pectoraux (haut accentué)
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable autant de fois que voulu. La deuxième exécution
--  met à jour le programme existant au lieu d'en créer un second, et garde
--  les mêmes numéros de séance — donc l'historique reste attaché.
--
--  CE SCRIPT NE DEVINE AUCUN IDENTIFIANT. Il retrouve Greg par son nom et
--  chaque exercice dans la bibliothèque par son nom exact, avec un motif de
--  repli. Si un exercice a été renommé, le script s'arrête net en disant
--  lequel, sans rien avoir modifié.
--
--  ─────────────────────────────────────────────────────────────────────────
--  CE QUI A ÉTÉ LU EN BASE AVANT D'ÉCRIRE (règle P.1)
--
--    18 ans · 180 cm · prise de masse · 552 séries loguées sur 17 semaines.
--    Chest press à 129 kg, pec deck à 120 kg : ce n'est pas un débutant.
--
--    DEUX CONSTATS QUI ONT ORIENTÉ LE PROGRAMME :
--
--    1. Les jambes étaient DÉJÀ à l'arrêt. Sur les 6 dernières semaines :
--       3 séries de leg extension, 3 d'adducteurs, ZÉRO hack squat, ZÉRO leg
--       curl. Le « faible volume jambes » demandé n'est donc pas un
--       changement — c'est la réalité constatée. Ce programme la CADRE à
--       6 séries quadriceps + 4 ischios, qui est le volume de MAINTIEN
--       mesuré (P.5). Sur un point fort, c'est ce qui est le plus rentable à
--       conserver à bas coût : l'arrêt total coûte jusqu'à −30 % de section
--       sur 32 semaines.
--
--    2. Aucun mouvement incliné dans le programme précédent. Chest press
--       couché et pec deck, rien d'autre. Pour une accentuation du HAUT des
--       pectoraux, c'était le premier levier et il était inutilisé.
--
--  ─────────────────────────────────────────────────────────────────────────
--  LES ARBITRAGES, ET POURQUOI
--
--  LA RÉPARTITION. Upper = pectoraux, épaules, triceps. Lower = jambes
--  courtes + DOS. Sortir le dos des séances Upper libère la place qu'il
--  fallait pour l'incliné et les épaules, sans sacrifier un ensemble qui
--  représente la moitié du haut du corps. C'est le choix de Greg, posé le
--  22 septembre.
--
--  LE HAUT DES PECTORAUX. 11 des 17 séries pectoraux biaisent le haut :
--  8 en incliné (haltère lundi, machine jeudi) et 3 en écarté poulie basse,
--  dont la trajectoire va du bas vers le haut. L'angle est prescrit à 30-45° :
--  un travail d'octobre 2025 mesure une activation significativement plus
--  basse à 20° qu'à 32° et 43°, sans écart significatif entre ces deux-là.
--
--  LES DIPS SONT RETIRÉS, ET C'EST VOLONTAIRE. Greg en faisait 12 séries
--  lestées à 20 kg. C'est un bon exercice — mais il biaise le BAS du pectoral,
--  exactement l'inverse de l'objectif annoncé. Le garder aurait été mettre du
--  volume là où il n'est pas demandé.
--
--  LE TRICEPS EN POSITION ALLONGÉE. L'extension overhead est présente les
--  DEUX jours Upper : 12 semaines d'entraînement en overhead contre bras le
--  long du corps donnent +28,5 % contre +19,6 % de volume sur la longue
--  portion (Maeo et coll.), soit ×1,5. C'est l'effet le mieux documenté du
--  programme, il ne se négocie pas.
--
--  14 séries directes de triceps, pas 18. Le compte paraît bas pour une
--  priorité, et il ne l'est pas : le développé incliné, le chest press et le
--  JM press ajoutent un travail indirect substantiel. Monter plus haut
--  obligerait à entraîner le triceps quatre jours d'affilée, ce que le
--  calendrier lundi-mardi-jeudi-vendredi rend inutilement coûteux.
--
--  LES BICEPS PASSENT EN MAINTIEN : 6 séries, dont 3 de curl marteau qui
--  travaillent aussi le BRACHIAL — lui, dans les focus. Six séries, c'est
--  dix minutes par semaine et la garantie de ne pas avoir à reconstruire.
--
--  L'ORDRE N'EST PAS UN HASARD. L'exercice le plus exigeant du muscle
--  prioritaire ouvre chaque séance Upper, quand le muscle est frais. Sur une
--  priorité, c'est le levier gratuit le plus fort.
--
--  VOLUME HEBDOMADAIRE RÉSULTANT :
--    pectoraux 17 · triceps 14 · deltoïde latéral 12 · deltoïde postérieur 6
--    grand dorsal 13 · haut du dos 9 · biceps/brachial 6
--    quadriceps 6 · ischios 4 · mollets 3          = 90 séries
--
--  DURÉES, calculées avec estimateSessionMinutes de l'app :
--    lundi 70 min · mardi 60 · jeudi 70 · vendredi 60.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  1. LA BIBLIOTHÈQUE, POUR MÉMOIRE
--  Si le bloc 3 s'arrête sur un exercice introuvable, c'est ici que tu liras
--  son vrai nom.
-- ───────────────────────────────────────────────────────────────────────────
select name as "exercice en bibliothèque", muscle
  from public.exercises_library
 order by muscle, name;


-- ───────────────────────────────────────────────────────────────────────────
--  2. QUATRE EXERCICES ENTRENT EN BIBLIOTHÈQUE
--
--  Trois d'entre eux sont utilisés depuis des mois dans les programmes de
--  3 à 4 coachés SANS jamais avoir existé en bibliothèque — ils ne pouvaient
--  donc porter ni vidéo ni note. Les ajouter répare ce trou pour tout le
--  monde, pas seulement pour Greg.
--
--  Le quatrième, le développé incliné machine, est le seul vrai ajout : la
--  bibliothèque ne contenait qu'UN seul mouvement incliné (aux haltères),
--  alors que le haut des pectoraux devient une priorité. La machine permet
--  de charger lourd sans dépenser dans la stabilisation — utile chez
--  quelqu'un qui pousse déjà 129 kg au chest press.
--
--  Le muscle est laissé au coach : si la fiche existe déjà, RIEN n'est
--  touché (on conflict do nothing).
-- ───────────────────────────────────────────────────────────────────────────
insert into public.exercises_library (coach_id, name, muscle, notes)
select p.id, v.name, v.muscle, v.notes
  from public.profiles p,
       (values
         ('Extension triceps corde',              'Triceps',      'COUDES FIXES'),
         ('Élévation latérale haltères (Debout)', 'Deltoïde lat', 'SANS ÉLAN'),
         ('Pull over unilat (Lats)',              'Grand dorsal', ''),
         ('Développé incliné machine',            'Pectoraux',    'DOSSIER À 30-45°')
       ) as v(name, muscle, notes)
 where p.role = 'coach'
on conflict (coach_id, name) do nothing;


-- ───────────────────────────────────────────────────────────────────────────
--  3. LE PROGRAMME
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  NOM_PROG constant text := 'Upper / Lower 4 jours · focus pecs / épaules / triceps';
  v_coachee uuid;
  v_coach   uuid;
  v_nom     text;
  v_prog    uuid;
  v_ordre   int;
  v_semaine jsonb;
  v_seances jsonb := '[]'::jsonb;
  v_bloc    jsonb;
  n         int;
  r         record;
  v_ex      uuid;
  v_ex_nom  text;
  v_ex_mus  text;
  v_lettre  char(1);
  v_id      int;
  v_base    int;
begin

  -- ── Greg ─────────────────────────────────────────────────────────────────
  select count(*) into n
    from public.profiles
   where role = 'coachee' and name ilike '%ledé%';
  if n <> 1 then
    raise exception 'Coaché « Ledé » : % profil(s) trouvé(s), il en faut exactement 1.', n;
  end if;

  select id, coach_id, name into v_coachee, v_coach, v_nom
    from public.profiles
   where role = 'coachee' and name ilike '%ledé%';

  if v_coach is null then
    raise exception 'Le profil de % n''est rattaché à aucun coach (coach_id vide).', v_nom;
  end if;

  -- ── Le plan, tel qu'il sera écrit ────────────────────────────────────────
  drop table if exists _plan;
  drop table if exists _resolu;
  drop table if exists _ids;

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
    -- ══ A · LUNDI — UPPER A : pectoraux inclinés + triceps ════════════════
    ('A', 1, 'Développé incliné haltère',         '%développé incliné haltère%', 'Pectoraux',    4, '["6-9","6-9","9-12","9-12"]',    '2''30 / 3''', 'BANC À 30°',            null),
    ('A', 2, 'Chest press couché',                '%chest press%',               'Pectoraux',    3, '["6-9","9-12","9-12"]',          '2''30 / 3''', '',                      null),
    ('A', 3, 'Écarté poulie basse',               '%écarté poulie basse%',       'Pectoraux',    3, '["9-12","12-15","12-15"]',       '1''45 / 2''', 'BAS VERS HAUT',         null),
    ('A', 4, 'Extension triceps overhead (Uni)',  '%overhead (uni)%',            'Triceps',      4, '["6-9","6-9","9-12","9-12"]',    '2''30 / 3''', 'BRAS À L''OREILLE',     null),
    ('A', 5, 'JM Press',                          '%jm press%',                  'Triceps',      3, '["6-9","9-12","9-12"]',          '2''30 / 3''', '',                      null),
    ('A', 6, 'Élévation latérale haltères (Debout)', '%latérale haltères (deb%','Deltoïde lat',  4, '["9-12","12-15","12-15","12-15"]','1''45 / 2''', 'SANS ÉLAN',            null),
    ('A', 7, 'Oiseau unilatéral poulie haute',    '%oiseau%',                    'Deltoïde post',3, '["12-15","12-15","15-20"]',      '1''45 / 2''', 'CUFF',                  null),

    -- ══ B · MARDI — LOWER A : jambes courtes + dos ════════════════════════
    ('B', 1, 'Hack squat',                        '%hack squat%',                'Quadriceps',   3, '["6-9","9-12","9-12"]',          '2''30 / 3''', 'DESCENTE COMPLÈTE',     null),
    ('B', 2, 'Leg curl couché',                   '%leg curl couché%',           'Ischios',      2, '["9-12","12-15"]',               '2''30 / 3''', '',                      null),
    ('B', 3, 'Tirage vertical au sol (Uni)',      '%vertical au sol%',           'Grand dorsal', 4, '["6-9","6-9","9-12","9-12"]',    '2''30 / 3''', '',                      null),
    ('B', 4, 'Tirage horizontal sur banc (Uni)',  '%horizontal sur banc%',       'Grand dorsal', 3, '["6-9","9-12","9-12"]',          '2''30 / 3''', '',                      null),
    ('B', 5, 'Tirage vertical (Haut du dos)',     '%vertical (haut du dos)%',    'Haut du dos',  3, '["6-9","9-12","9-12"]',          '2''30 / 3''', '',                      null),
    ('B', 6, 'Curl marteau supported',            '%curl marteau%',              'Biceps',       3, '["9-12","9-12","12-15"]',        '1''45 / 2''', 'PRISE NEUTRE · BRACHIAL', null),
    ('B', 7, 'Mollet press horizontal',           '%mollet press%',              'Mollets',      3, '["12-15","12-15","15-20"]',      '1''45 / 2''', 'PAUSE 1 S EN BAS',      null),

    -- ══ C · JEUDI — UPPER B : incliné machine + épaules ═══════════════════
    ('C', 1, 'Développé incliné machine',         '%développé incliné machine%', 'Pectoraux',    4, '["6-9","6-9","9-12","9-12"]',    '2''30 / 3''', 'DOSSIER À 30-45°',      null),
    ('C', 2, 'Écarté Pec deck',                   '%pec deck%',                  'Pectoraux',    3, '["9-12","12-15","12-15"]',       '2''30 / 3''', 'ÉTIREMENT COMPLET',     null),
    ('C', 3, 'Extension triceps corde',           '%triceps corde%',             'Triceps',      4, '["9-12","9-12","12-15","12-15"]','1''45 / 2''', 'COUDES FIXES',          null),
    ('C', 4, 'Extension triceps overhead (Uni)',  '%overhead (uni)%',            'Triceps',      3, '["6-9","9-12","9-12"]',          '2''30 / 3''', 'BRAS À L''OREILLE',     null),
    ('C', 5, 'Élévation Y (Uni)',                 '%élévation y%',               'Deltoïde lat', 4, '["9-12","12-15","12-15","12-15"]','1''45 / 2''', 'CUFF',                 null),
    ('C', 6, 'Élévation latérale haltères (Debout)', '%latérale haltères (deb%','Deltoïde lat',  4, '["9-12","12-15","12-15","15-20"]','1''45 / 2''', 'SANS ÉLAN',            null),
    ('C', 7, 'Oiseau unilatéral poulie haute',    '%oiseau%',                    'Deltoïde post',3, '["12-15","12-15","15-20"]',      '1''45 / 2''', 'CUFF',                  null),

    -- ══ D · VENDREDI — LOWER B : jambes courtes + dos ═════════════════════
    ('D', 1, 'Leg extension',                     '%leg extension%',             'Quadriceps',   3, '["9-12","12-15","12-15"]',       '2''30 / 3''', '',                      null),
    ('D', 2, 'Leg curl assis',                    '%leg curl assis%',            'Ischios',      2, '["9-12","12-15"]',               '2''30 / 3''', 'DESCENTE EN 3 S',       null),
    ('D', 3, 'Tirage semi-incliné',               '%semi-incliné%',              'Grand dorsal', 3, '["6-9","9-12","9-12"]',          '2''30 / 3''', '',                      null),
    ('D', 4, 'Pull over unilat (Lats)',           '%pull over unilat%',          'Grand dorsal', 3, '["9-12","12-15","12-15"]',       '2''30 / 3''', 'ÉTIREMENT COMPLET',     null),
    ('D', 5, 'Tirage horizontal (Haut du dos)',   '%horizontal (haut du dos)%',  'Haut du dos',  3, '["6-9","9-12","9-12"]',          '2''30 / 3''', '',                      null),
    ('D', 6, 'Curl Larry Scott',                  '%larry scott%',               'Biceps',       3, '["9-12","9-12","12-15"]',        '1''45 / 2''', '',                      null),
    ('D', 7, 'Shrugs',                            '%shrugs%',                    'Haut du dos',  3, '["12-15","12-15","15-20"]',      '1''45 / 2''', 'PAUSE 1 S EN HAUT',     null);

  -- ── Résolution dans la bibliothèque ──────────────────────────────────────
  create temp table _resolu (
    seance char(1), ordre int, ex_id uuid, ex_nom text, ex_muscle text
  ) on commit drop;

  for r in select * from _plan order by seance, ordre loop
    select el.id, el.name, coalesce(nullif(el.muscle, ''), r.muscle_defaut)
      into v_ex, v_ex_nom, v_ex_mus
      from public.exercises_library el
     where el.coach_id = v_coach and el.name = r.nom_exact;

    if v_ex is null then
      select count(*) into n
        from public.exercises_library el
       where el.coach_id = v_coach and el.name ilike r.motif;
      if n <> 1 then
        raise exception
          'Exercice introuvable ou ambigu : « % » (motif de repli « % » → % correspondance(s)). Regarde la liste renvoyée par la requête 1.',
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
  -- programme précédent. Greg a utilisé 1 à 5 sur ses trois programmes ; les
  -- séries loguées sont indexées dessus, un id recyclé ferait apparaître ses
  -- anciennes charges sous les nouveaux noms d'exercices.
  create temp table _ids (seance char(1), id int) on commit drop;

  select p.id into v_prog
    from public.programs p
   where p.coachee_id = v_coachee and p.name = NOM_PROG
   order by p.created_at
   limit 1;

  if v_prog is not null then
    -- Relance : on reprend les numéros déjà en place, dans l'ordre.
    insert into _ids (seance, id)
    select x.lettre, x.id from (
      select (s->>'id')::int as id,
             (array['A','B','C','D'])[row_number() over (order by (s->>'id')::int)] as lettre
        from public.programs p, jsonb_array_elements(p.sessions_structure) s
       where p.id = v_prog) x
     where x.lettre is not null;
  else
    select coalesce(max((s->>'id')::int), 0) into v_base
      from public.programs p, jsonb_array_elements(p.sessions_structure) s
     where p.coachee_id = v_coachee;
    insert into _ids values ('A', v_base + 1), ('B', v_base + 2),
                            ('C', v_base + 3), ('D', v_base + 4);
  end if;

  select count(*) into n from _ids;
  if n <> 4 then
    raise exception 'Attribution des numéros de séance : % obtenu(s), 4 attendus.', n;
  end if;

  -- ── Les quatre séances ───────────────────────────────────────────────────
  for v_lettre, v_id in select seance, id from _ids order by seance loop
    select jsonb_build_object(
             'id', v_id,
             'name', case v_lettre
                       when 'A' then 'UPPER A · PECS / TRICEPS'
                       when 'B' then 'LOWER A · JAMBES / DOS'
                       when 'C' then 'UPPER B · PECS / ÉPAULES'
                       else          'LOWER B · JAMBES / DOS' end,
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
      into v_bloc
      from _plan p join _resolu x on x.seance = p.seance and x.ordre = p.ordre
     where p.seance = v_lettre;

    v_seances := v_seances || jsonb_build_array(v_bloc);
  end loop;

  v_semaine := jsonb_build_array(
    jsonb_build_object('day', 'LUNDI',    'sessionId', (select id from _ids where seance = 'A')),
    jsonb_build_object('day', 'MARDI',    'sessionId', (select id from _ids where seance = 'B')),
    jsonb_build_object('day', 'MERCREDI', 'sessionId', null),
    jsonb_build_object('day', 'JEUDI',    'sessionId', (select id from _ids where seance = 'C')),
    jsonb_build_object('day', 'VENDREDI', 'sessionId', (select id from _ids where seance = 'D')),
    jsonb_build_object('day', 'SAMEDI',   'sessionId', null),
    jsonb_build_object('day', 'DIMANCHE', 'sessionId', null));

  -- ── Écriture ─────────────────────────────────────────────────────────────
  -- Un seul programme actif à la fois : l'app lit is_active = true en
  -- maybeSingle(). On désactive les autres, on ne les supprime JAMAIS —
  -- l'historique des 552 séries y est rattaché.
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
      (v_coachee, NOM_PROG, v_semaine, v_seances, true, v_ordre)
    returning id into v_prog;

    raise notice 'Programme CRÉÉ pour % — séances % (lundi), % (mardi), % (jeudi), % (vendredi).',
      v_nom,
      (select id from _ids where seance='A'), (select id from _ids where seance='B'),
      (select id from _ids where seance='C'), (select id from _ids where seance='D');
  else
    update public.programs
       set week_structure = v_semaine,
           sessions_structure = v_seances,
           is_active = true
     where id = v_prog;

    raise notice 'Programme MIS À JOUR pour % (numéros de séance conservés).', v_nom;
  end if;

end $$;


-- ───────────────────────────────────────────────────────────────────────────
--  4. VÉRIFICATION — à lire après le Run
-- ───────────────────────────────────────────────────────────────────────────
select (s->>'id')::int as "n° séance", s->>'name' as "séance",
       jsonb_array_length(s->'exercises') as "exos",
       (select sum((e->>'series')::int) from jsonb_array_elements(s->'exercises') e) as "séries"
  from public.programs p, jsonb_array_elements(p.sessions_structure) s
 where p.coachee_id = (select id from public.profiles where role='coachee' and name ilike '%ledé%')
   and p.is_active
 order by 1;

select e->>'muscle' as "muscle", sum((e->>'series')::int) as "séries / semaine"
  from public.programs p, jsonb_array_elements(p.sessions_structure) s,
       jsonb_array_elements(s->'exercises') e
 where p.coachee_id = (select id from public.profiles where role='coachee' and name ilike '%ledé%')
   and p.is_active
 group by 1 order by 2 desc;
