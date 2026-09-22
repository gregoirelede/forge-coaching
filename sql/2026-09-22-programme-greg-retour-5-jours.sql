-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — PROGRAMME DE GRÉGOIRE LEDÉ
--  RETOUR À SON PROGRAMME 5 JOURS, avec trois modifications
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable autant de fois que voulu. La deuxième exécution
--  met à jour le programme existant au lieu d'en créer un second, et garde
--  les mêmes numéros de séance — donc les 561 séries loguées restent
--  attachées.
--
--  CE SCRIPT NE DEVINE AUCUN IDENTIFIANT. Il retrouve Greg par son nom, son
--  programme par son nom, et chaque exercice dans la bibliothèque par son nom
--  exact avec un motif de repli. Si un exercice a été renommé, le script
--  s'arrête net en disant lequel, SANS RIEN AVOIR MODIFIÉ.
--
--  ─────────────────────────────────────────────────────────────────────────
--  CE QU'IL FAIT, ET RIEN D'AUTRE
--
--  L'upper/lower 4 jours du 22 septembre est désactivé (jamais supprimé :
--  aucune série n'y a été loguée, mais on ne détruit pas un programme).
--  « Programme 5/7 focus bras/épaules » redevient actif, avec ses séances
--  1 à 5 et son calendrier lundi · mardi · jeudi · vendredi · dimanche.
--
--  TROIS MODIFICATIONS DEMANDÉES, ET TROIS SEULEMENT :
--
--  1. MOINS DE JAMBES — 26 séries hebdomadaires deviennent 10.
--     Retirés : leg extension du mardi, leg curl couché, adducteur à la
--     machine, hack squat du dimanche, hip extensions sur banc.
--     Restent : hack squat 3 · leg extension 2 · leg curl assis 3 ·
--     mollet press 2.
--
--     À SAVOIR, et c'est le seul point sur lequel je ne suis pas neutre :
--     10 séries réparties sur trois muscles, ça met chacun SOUS le volume
--     de maintien mesuré (≈ 6 séries par muscle et par semaine, P.5). Le
--     quadriceps à 5 en est proche, l'ischio à 3 et le mollet à 2 non. Ce
--     n'est pas du maintien, c'est une décrue lente et assumée — le choix
--     de Greg, sur un point fort, le 22 septembre. L'arrêt TOTAL, lui,
--     coûte jusqu'à −30 % de section sur 32 semaines (Bickel et coll.) :
--     c'est pour ça que les trois muscles restent présents plutôt que
--     supprimés.
--
--     Le leg curl gardé est le leg curl ASSIS, pas le couché. Hanche
--     fléchie = ischio en position allongée, et c'est l'effet le mieux
--     documenté du lot (×1,5 sur la longue portion du triceps chez Maeo,
--     même mécanique ici). Quand il ne reste que 3 séries, autant qu'elles
--     soient les plus rentables.
--
--  2. LES ABDOS DEVIENNENT DE VRAIS EXERCICES — 12 séries par semaine.
--     Ils existaient déjà, mais en texte libre dans le champ « Abdos /
--     cardio » : « 3x1 min GAINAGE, 3x échec relevé de jambes ». Ce champ
--     n'est pas logué — pas de charge, pas de répétitions, pas de
--     progression, pas de couleur de comparaison. Autant dire que les abdos
--     n'étaient pas dans le programme.
--     Ils y entrent : deux exercices en bibliothèque, chacun deux fois par
--     semaine (la fréquence de référence, P.5), aux emplacements libérés
--     par les jambes. Le champ texte est vidé — sinon le gainage serait
--     compté deux fois.
--
--  3. MOINS D'UNILATÉRAL DE DOS LE JEUDI — un seul au lieu de trois.
--     Le jeudi enchaînait tirage horizontal sur banc (Uni) 3, tirage
--     vertical au sol (Uni) 4 et pull over unilat 3 : 10 séries de dos,
--     TOUTES unilatérales, donc 20 séries de travail réel et une séance qui
--     n'en finit pas. Les deux tirages passent en bilatéral — tirage
--     semi-incliné et tirage vertical, déjà tous les deux en bibliothèque.
--     Le PULL OVER reste unilatéral : c'est celui qui gagne le plus à
--     l'être (course complète du grand dorsal, sans que le tronc compense).
--     Le dimanche garde son tirage vertical au sol (Uni) — la demande
--     portait sur le jeudi.
--
--  ─────────────────────────────────────────────────────────────────────────
--  VOLUME HEBDOMADAIRE RÉSULTANT (105 séries, contre 109 avant) :
--    triceps 14 · biceps 14 · grand dorsal 13 · pectoraux 13
--    deltoïde latéral 12 · ABDOS 12 · haut du dos 9 · deltoïde post 8
--    quadriceps 5 · ischios 3 · mollets 2
--
--  DURÉES, calculées avec estimateSessionMinutes de l'app :
--    lundi 65 min · mardi 65 · jeudi 65 · vendredi 65 · dimanche 55.
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
--  2. DEUX EXERCICES D'ABDOS ENTRENT EN BIBLIOTHÈQUE
--
--  La bibliothèque n'en contenait AUCUN : 42 exercices, pas un seul abdo.
--  C'est la raison de fond pour laquelle ils vivaient en texte libre.
--
--  Les deux commentaires ne sont pas décoratifs. Ce sont exactement les deux
--  points qui font la différence entre un exercice d'abdos et un exercice de
--  psoas ou de lombaires :
--    · au relevé de jambes, le bassin doit S'ENROULER en fin de course —
--      sans ça, ce sont les fléchisseurs de hanche qui travaillent ;
--    · au crunch à la poulie, c'est le DOS qui s'arrondit, pas la hanche qui
--      se plie — sans ça, c'est un good morning à l'envers.
--
--  Le muscle est laissé au coach : si la fiche existe déjà, RIEN n'est
--  touché (on conflict do nothing).
-- ───────────────────────────────────────────────────────────────────────────
insert into public.exercises_library (coach_id, name, muscle, notes)
select p.id, v.name, v.muscle, v.notes
  from public.profiles p,
       (values
         ('Crunch à la poulie haute',  'Abdos', 'ENROULER LE DOS, LES BRAS NE TIRENT PAS'),
         ('Relevé de jambes suspendu', 'Abdos', 'LE BASSIN S''ENROULE EN FIN DE COURSE')
       ) as v(name, muscle, notes)
 where p.role = 'coach'
on conflict (coach_id, name) do nothing;


-- ───────────────────────────────────────────────────────────────────────────
--  3. LE PROGRAMME
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  NOM_PROG constant text := 'Programme 5/7 focus bras/épaules';
  v_coachee uuid;
  v_coach   uuid;
  v_nom     text;
  v_prog    uuid;
  v_semaine jsonb;
  v_seances jsonb := '[]'::jsonb;
  v_bloc    jsonb;
  n         int;
  r         record;
  v_ex      uuid;
  v_ex_nom  text;
  v_ex_mus  text;
  v_id      int;
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

  -- ── LE programme à restaurer ─────────────────────────────────────────────
  -- Greg a DEUX programmes portant ce nom (program_order 2 et 3). Celui qui
  -- porte son historique est le plus récent — d'où le max(program_order), et
  -- non un identifiant recopié à la main qui serait faux tôt ou tard.
  select p.id into v_prog
    from public.programs p
   where p.coachee_id = v_coachee and p.name = NOM_PROG
   order by p.program_order desc
   limit 1;

  if v_prog is null then
    raise exception
      'Programme « % » introuvable chez %. Ce script RESTAURE un programme existant, il n''en crée pas.',
      NOM_PROG, v_nom;
  end if;

  -- Les numéros de séance 1 à 5 sont écrits en dur plus bas, parce que ce
  -- sont EUX qui portent les 561 séries loguées. On vérifie donc que c'est
  -- bien ce que le programme utilise aujourd'hui, au lieu de le supposer.
  select count(*) into n
    from public.programs p, jsonb_array_elements(p.sessions_structure) s
   where p.id = v_prog and (s->>'id')::int between 1 and 5;
  if n <> 5 then
    raise exception
      'Le programme « % » n''utilise pas les séances 1 à 5 (% trouvée(s)). Ce script les réécrit : il faut vérifier à la main avant d''aller plus loin.',
      NOM_PROG, n;
  end if;

  -- ── Le plan, tel qu'il sera écrit ────────────────────────────────────────
  drop table if exists _plan;
  drop table if exists _resolu;

  create temp table _plan (
    seance        int,
    seance_nom    text,
    jour          text,
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
    -- ══ SÉANCE 1 · LUNDI — PUSH A ═══════════════════ inchangée ═══════════
    (1, 'PUSH A', 'LUNDI', 1, 'Extension triceps overhead (Uni)', '%overhead (uni)%',        'Triceps',       3, '["6-9","9-12","9-12"]',          '2''30 / 3''', 'CUFF',         null),
    (1, 'PUSH A', 'LUNDI', 2, 'Chest press couché',               '%chest press%',           'Pectoraux',     3, '["6-9","9-12","9-12"]',          '2''30 / 3''', '',             null),
    (1, 'PUSH A', 'LUNDI', 3, 'Écarté Pec deck',                  '%pec deck%',              'Pectoraux',     2, '["6-9","9-12"]',                 '2''30 / 3''', '',             null),
    (1, 'PUSH A', 'LUNDI', 4, 'Extension triceps corde',          '%triceps corde%',         'Triceps',       3, '["6-9","9-12","9-12"]',          '2''30 / 3''', '',             null),
    (1, 'PUSH A', 'LUNDI', 5, 'JM Press',                         '%jm press%',              'Triceps',       3, '["6-9","9-12","9-12"]',          '2''30 / 3''', '',             null),
    (1, 'PUSH A', 'LUNDI', 6, 'Dips PDC',                         '%dips%',                  'Pectoraux',     3, '["12-15","12-15","12-15"]',      '2''30 / 3''', 'SE LESTER ?',  null),
    (1, 'PUSH A', 'LUNDI', 7, 'Oiseau unilatéral poulie haute',   '%oiseau%',                'Deltoïde post', 4, '["6-9","9-12","9-12","12-15"]',  '2'' / 2''30', 'CUFF',         null),

    -- ══ SÉANCE 2 · MARDI — UPPER X LOWER (1) ════════ jambes ↓ · abdos ↑ ══
    (2, 'UPPER X LOWER (1)', 'MARDI', 1, 'Élévation Y (Uni)',                     '%élévation y%',            'Deltoïde lat', 4, '["6-9","9-12","9-12","12-15"]', '2''30 / 3''', 'CUFF',              null),
    (2, 'UPPER X LOWER (1)', 'MARDI', 2, 'Élévation latérale haltères (Debout)',  '%latérale haltères (deb%', 'Deltoïde lat', 4, '["6-9","9-12","9-12","12-15"]', '2''30 / 3''', 'SANS ÉLAN',         null),
    (2, 'UPPER X LOWER (1)', 'MARDI', 3, 'Hack squat',                            '%hack squat%',             'Quadriceps',   3, '["6-9","9-12","9-12"]',         '3'' / 4''',   'SANGLE DE YOGA',    null),
    (2, 'UPPER X LOWER (1)', 'MARDI', 4, 'Leg curl assis',                        '%leg curl assis%',         'Ischios',      3, '["6-9","9-12","9-12"]',         '2''30 / 3''', 'SANGLE DE YOGA',    null),
    (2, 'UPPER X LOWER (1)', 'MARDI', 5, 'Mollet press horizontal',               '%mollet press%',           'Mollets',      2, '["9-12","12-15"]',              '1''30 / 2''', '',                  null),
    (2, 'UPPER X LOWER (1)', 'MARDI', 6, 'Relevé de jambes suspendu',             '%relevé de jambes%',       'Abdos',        3, '["9-12","12-15","12-15"]',      '1''30 / 2''', 'BASSIN QUI S''ENROULE', null),
    (2, 'UPPER X LOWER (1)', 'MARDI', 7, 'Crunch à la poulie haute',              '%crunch à la poulie%',     'Abdos',        3, '["9-12","12-15","12-15"]',      '1''30 / 2''', 'LE DOS S''ARRONDIT',    null),

    -- ══ SÉANCE 3 · JEUDI — PULL ═════════════════ deux tirages bilatéraux ══
    (3, 'PULL', 'JEUDI', 1, 'Tirage semi-incliné',              '%semi-incliné%',           'Grand dorsal',  3, '["6-9","9-12","9-12"]',         '2''30 / 3''', 'SANGLE DE TIRAGE', null),
    (3, 'PULL', 'JEUDI', 2, 'Tirage vertical',                  'tirage vertical',          'Grand dorsal',  4, '["6-9","9-12","9-12","12-15"]', '2''30 / 3''', 'SANGLE DE TIRAGE', null),
    (3, 'PULL', 'JEUDI', 3, 'Tirage vertical (Haut du dos)',    '%vertical (haut du dos)%', 'Haut du dos',   3, '["6-9","9-12","9-12"]',         '2''30 / 3''', 'SANGLE DE TIRAGE', null),
    (3, 'PULL', 'JEUDI', 4, 'Pull over unilat (Lats)',          '%pull over unilat%',       'Grand dorsal',  3, '["6-9","9-12","9-12"]',         '2''30 / 3''', 'CUFF',             null),
    (3, 'PULL', 'JEUDI', 5, 'Extension triceps overhead (Uni)', '%overhead (uni)%',         'Triceps',       3, '["6-9","9-12","9-12"]',         '2''30 / 3''', 'CUFF',             null),
    (3, 'PULL', 'JEUDI', 6, 'Extension triceps corde',          '%triceps corde%',          'Triceps',       2, '["6-9","9-12"]',                '2''30 / 3''', '',                 null),
    (3, 'PULL', 'JEUDI', 7, 'Oiseau unilatéral poulie haute',   '%oiseau%',                 'Deltoïde post', 4, '["6-9","9-12","12-15","12-15"]','2'' / 2''30', 'CUFF',             null),

    -- ══ SÉANCE 4 · VENDREDI — PUSH B ══════ hip extensions → abdos ════════
    (4, 'PUSH B', 'VENDREDI', 1, 'Élévation Y (Uni)',          '%élévation y%',       'Deltoïde lat', 4, '["6-9","9-12","9-12","12-15"]', '2''30 / 3''', 'CUFF', null),
    (4, 'PUSH B', 'VENDREDI', 2, 'Curl Larry Scott',           '%larry scott%',       'Biceps',       4, '["6-9","9-12","9-12","12-15"]', '2''30 / 3''', '',     null),
    (4, 'PUSH B', 'VENDREDI', 3, 'Curl incliné haltères',      '%curl incliné%',      'Biceps',       3, '["6-9","9-12","9-12"]',         '2''30 / 3''', '',     null),
    (4, 'PUSH B', 'VENDREDI', 4, 'Chest press couché',         '%chest press%',       'Pectoraux',    2, '["6-9","9-12"]',                '2''30 / 3''', '',     null),
    (4, 'PUSH B', 'VENDREDI', 5, 'Écarté Pec deck',            '%pec deck%',          'Pectoraux',    3, '["6-9","9-12","9-12"]',         '2''30 / 3''', '',     null),
    (4, 'PUSH B', 'VENDREDI', 6, 'Curl marteau supported',     '%curl marteau%',      'Biceps',       3, '["6-9","9-12","9-12"]',         '2''30 / 3''', '',     null),
    (4, 'PUSH B', 'VENDREDI', 7, 'Relevé de jambes suspendu',  '%relevé de jambes%',  'Abdos',        3, '["9-12","12-15","12-15"]',      '1''30 / 2''', 'BASSIN QUI S''ENROULE', null),

    -- ══ SÉANCE 5 · DIMANCHE — UPPER X LOWER (2) ═══ jambes ↓ · abdos ↑ ════
    (5, 'UPPER X LOWER (2)', 'DIMANCHE', 1, 'Leg extension',                  '%leg extension%',          'Quadriceps',   2, '["6-9","9-12"]',           '2''30 / 3''', 'SANGLE DE YOGA + TIRAGE', null),
    (5, 'UPPER X LOWER (2)', 'DIMANCHE', 2, 'Tirage horizontal (Haut du dos)','%horizontal (haut du dos)%','Haut du dos',  3, '["6-9","9-12","9-12"]',    '2''30 / 3''', 'SANGLE DE TIRAGE',        null),
    (5, 'UPPER X LOWER (2)', 'DIMANCHE', 3, 'Tirage vertical au sol (Uni)',   '%vertical au sol%',        'Grand dorsal', 3, '["8/10","8/10","8/10"]',   '2''00',       'SANGLE DE TIRAGE',        null),
    (5, 'UPPER X LOWER (2)', 'DIMANCHE', 4, 'Tirage vertical (Haut du dos)',  '%vertical (haut du dos)%', 'Haut du dos',  3, '["6-9","9-12","9-12"]',    '2''30 / 3''', 'SANGLE DE TIRAGE',        null),
    (5, 'UPPER X LOWER (2)', 'DIMANCHE', 5, 'Curl Larry Scott',               '%larry scott%',            'Biceps',       4, '["6-9","9-12","9-12","12-15"]', '2''30 / 3''', '',                null),
    (5, 'UPPER X LOWER (2)', 'DIMANCHE', 6, 'Crunch à la poulie haute',       '%crunch à la poulie%',     'Abdos',        3, '["9-12","12-15","12-15"]', '1''30 / 2''', 'LE DOS S''ARRONDIT',      null);

  -- ── Résolution dans la bibliothèque ──────────────────────────────────────
  -- Le muscle saisi par le coach PRIME sur celui que je propose : c'est lui
  -- qui décide du code couleur sur toutes les vues.
  create temp table _resolu (
    seance int, ordre int, ex_id uuid, ex_nom text, ex_muscle text
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

  -- ── Les cinq séances ─────────────────────────────────────────────────────
  -- Les numéros 1 à 5 sont CONSERVÉS, et c'est le point délicat : les 561
  -- séries loguées de Greg sont indexées dessus. Ce programme est le sien,
  -- il garde ses numéros — la règle P.3 interdit de RECYCLER l'id d'un autre
  -- programme, pas de rester sur les siens.
  for v_id in select distinct seance from _plan order by 1 loop
    select jsonb_build_object(
             'id', v_id,
             'name', max(p.seance_nom),
             -- Le champ texte « Abdos / cardio » est vidé : les abdos sont
             -- devenus de vrais exercices, les compter deux fois serait faux.
             'abdosCardio', '[]'::jsonb,
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
     where p.seance = v_id;

    v_seances := v_seances || jsonb_build_array(v_bloc);
  end loop;

  select jsonb_agg(
           jsonb_build_object('day', j.jour, 'sessionId',
             (select min(p.seance) from _plan p where p.jour = j.jour))
           order by j.rang)
    into v_semaine
    from (values ('LUNDI',1),('MARDI',2),('MERCREDI',3),('JEUDI',4),
                 ('VENDREDI',5),('SAMEDI',6),('DIMANCHE',7)) as j(jour, rang);

  -- ── Écriture ─────────────────────────────────────────────────────────────
  -- Un seul programme actif à la fois : l'app lit is_active = true en
  -- maybeSingle(). On désactive les autres, on ne les supprime JAMAIS.
  update public.programs
     set is_active = false
   where coachee_id = v_coachee and id <> v_prog;

  update public.programs
     set week_structure = v_semaine,
         sessions_structure = v_seances,
         is_active = true
   where id = v_prog;

  raise notice 'Programme « % » RESTAURÉ et modifié pour % — séances 1 à 5, numéros conservés.',
    NOM_PROG, v_nom;

end $$;


-- ───────────────────────────────────────────────────────────────────────────
--  4. VÉRIFICATION — à lire après le Run
-- ───────────────────────────────────────────────────────────────────────────
select p.name as "programme actif",
       (s->>'id')::int as "n° séance", s->>'name' as "séance",
       jsonb_array_length(s->'exercises') as "exos",
       (select sum((e->>'series')::int) from jsonb_array_elements(s->'exercises') e) as "séries",
       jsonb_array_length(s->'abdosCardio') as "lignes texte abdos"
  from public.programs p, jsonb_array_elements(p.sessions_structure) s
 where p.coachee_id = (select id from public.profiles where role='coachee' and name ilike '%ledé%')
   and p.is_active
 order by 2;

select e->>'muscle' as "muscle", sum((e->>'series')::int) as "séries / semaine"
  from public.programs p, jsonb_array_elements(p.sessions_structure) s,
       jsonb_array_elements(s->'exercises') e
 where p.coachee_id = (select id from public.profiles where role='coachee' and name ilike '%ledé%')
   and p.is_active
 group by 1 order by 2 desc;

-- Aucun exercice ne doit rester sans lien vers la bibliothèque.
select count(*) as "exercices SANS lien bibliothèque (doit être 0)"
  from public.programs p, jsonb_array_elements(p.sessions_structure) s,
       jsonb_array_elements(s->'exercises') e
 where p.coachee_id = (select id from public.profiles where role='coachee' and name ilike '%ledé%')
   and p.is_active and e->>'library_exercise_id' is null;
