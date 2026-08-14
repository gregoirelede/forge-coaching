-- ═══════════════════════════════════════════════════════════════════════════
--  DIÈTE D'ANAÏS MONCOMBLE — composée à la main, 15 août 2026
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable, elle remplace la diète existante d'Anaïs.
--
--  PRÉREQUIS : sql/2026-08-14-diete-personnalisee.sql et la base d'aliments
--  Ciqual doivent être chargées.
--
--  SANS GLUTEN, D'UN BOUT À L'AUTRE. Ni blé, ni orge, ni seigle : pas de
--  muesli (blé + orge), pas de pâtes, pas de pain. Les flocons d'avoine sont
--  naturellement sans gluten mais presque toujours contaminés en usine — le
--  nom de l'aliment porte l'instruction d'acheter un paquet certifié.
--
--  Base du calcul : femme, 67,5 kg, 171 cm, 23 ans, facteur d'activité 1,35,
--  phase « prise de masse » à +12 %, protéines 2,0 g/kg, lipides 0,9 g/kg.
--  Programme : les 4 séances upper/lower, 1 508 kcal sur la semaine.
--
--  Les protéines ne sont PAS réparties à parts égales : les deux repas à
--  viande en portent 42 et 40 g, les deux repas laitiers 28 et 25 g. Une
--  répartition égale donnait 60 g de poulet au déjeuner, ce qui n'est pas une
--  portion de repas. Chaque prise reste au-dessus de 0,4 g/kg (27 g).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_coachee uuid;
  v_plan    uuid;
  v_repas   uuid;
begin
  select id into v_coachee from public.profiles
   where name = 'Anaïs Moncomble' and role = 'coachee';
  if v_coachee is null then
    raise exception 'Coachée introuvable — vérifie l''orthographe du nom en base';
  end if;

  insert into public.diet_plans
    (coachee_id, meals_per_day, kcal_train, prot_train, carbs_train, fat_train,
     kcal_rest, prot_rest, carbs_rest, fat_rest, weight_at_gen, note, generated_at, updated_at)
  values (v_coachee, 4, 2642, 135, 388, 61, 2220, 135, 283, 61, 67.5,
    'Diète sans gluten. Les flocons d''avoine doivent être certifiés sans gluten — '
    'l''avoine est naturellement sans gluten mais presque toujours contaminée en usine. '
    'Les grammages du riz, des pommes de terre et des légumes sont donnés CUITS ; '
    'les viandes aussi. Bois au moins 2 L d''eau par jour.',
    now(), now())
  on conflict (coachee_id) do update set
    meals_per_day = excluded.meals_per_day,
    kcal_train = excluded.kcal_train, prot_train = excluded.prot_train,
    carbs_train = excluded.carbs_train, fat_train = excluded.fat_train,
    kcal_rest  = excluded.kcal_rest,  prot_rest  = excluded.prot_rest,
    carbs_rest = excluded.carbs_rest, fat_rest   = excluded.fat_rest,
    weight_at_gen = excluded.weight_at_gen, note = excluded.note,
    generated_at = now(), updated_at = now()
  returning id into v_plan;

  delete from public.diet_meals where plan_id = v_plan;

  -- ── ENTRAINEMENT ──────────────────────────────────────────────
  -- petit_dejeuner : 652 kcal · P 27 G 97 L 15
  insert into public.diet_meals (plan_id, day_type, meal_type, meal_order)
  values (v_plan, 'entrainement', 'petit_dejeuner', 0) returning id into v_repas;
  insert into public.diet_items
    (meal_id, food_id, food_name, grams, kcal_100, protein_100, carbs_100, fat_100, fiber_100, item_order)
  values
    (v_repas, (select id from public.foods where ciqual_code = '13005' and coach_id is null), 'Banane, chair sans peau, crue', 120, 88, 1.1, 19.7, 0.5, 2.7, 0),
    (v_repas, (select id from public.foods where ciqual_code = '19644' and coach_id is null), 'Fromage blanc, nature, 0% MG', 185, 48, 7.3, 4.2, 0.1, 0, 1),
    (v_repas, (select id from public.foods where ciqual_code = '15202' and coach_id is null), 'Beurre de cacahuète ou pâte d''arachide', 15, 643, 22.2, 17.3, 51.4, 6, 2),
    (v_repas, (select id from public.foods where ciqual_code = '32140' and coach_id is null), 'Flocons d''avoine — prendre un paquet CERTIFIÉ SANS GLUTEN', 80, 369, 10.6, 57.7, 7.8, 9.1, 3),
    (v_repas, (select id from public.foods where ciqual_code = '31008' and coach_id is null), 'Miel', 20, 331, 0.7, 82.1, 0, 0, 4);
  -- dejeuner : 847 kcal · P 42 G 119 L 20
  insert into public.diet_meals (plan_id, day_type, meal_type, meal_order)
  values (v_plan, 'entrainement', 'dejeuner', 1) returning id into v_repas;
  insert into public.diet_items
    (meal_id, food_id, food_name, grams, kcal_100, protein_100, carbs_100, fat_100, fiber_100, item_order)
  values
    (v_repas, (select id from public.foods where ciqual_code = '20030' and coach_id is null), 'Haricot vert, cuit', 200, 29, 2, 3, 0.2, 3.4, 0),
    (v_repas, (select id from public.foods where ciqual_code = '36018' and coach_id is null), 'Poulet, filet sans peau grillé/poêlé', 90, 141, 30.1, 0, 2, 0, 1),
    (v_repas, (select id from public.foods where ciqual_code = '17270' and coach_id is null), 'Huile d''olive vierge extra', 15, 899, 0.2, 0, 99.9, 0, 2),
    (v_repas, (select id from public.foods where ciqual_code = '9104' and coach_id is null), 'Riz blanc, cuit, sans sel ajouté', 340, 155, 3.1, 33.2, 0.7, 1.4, 3);
  -- collation : 387 kcal · P 26 G 66 L 2
  insert into public.diet_meals (plan_id, day_type, meal_type, meal_order)
  values (v_plan, 'entrainement', 'collation', 2) returning id into v_repas;
  insert into public.diet_items
    (meal_id, food_id, food_name, grams, kcal_100, protein_100, carbs_100, fat_100, fiber_100, item_order)
  values
    (v_repas, (select id from public.foods where ciqual_code = '13005' and coach_id is null), 'Banane, chair sans peau, crue', 120, 88, 1.1, 19.7, 0.5, 2.7, 0),
    (v_repas, (select id from public.foods where ciqual_code = '19644' and coach_id is null), 'Fromage blanc, nature, 0% MG', 305, 48, 7.3, 4.2, 0.1, 0, 1),
    (v_repas, (select id from public.foods where ciqual_code = '7354' and coach_id is null), 'Galette de maïs soufflé', 35, 387, 7, 83.5, 1.9, 3, 2);
  -- diner : 739 kcal · P 40 G 98 L 19
  insert into public.diet_meals (plan_id, day_type, meal_type, meal_order)
  values (v_plan, 'entrainement', 'diner', 3) returning id into v_repas;
  insert into public.diet_items
    (meal_id, food_id, food_name, grams, kcal_100, protein_100, carbs_100, fat_100, fiber_100, item_order)
  values
    (v_repas, (select id from public.foods where ciqual_code = '20304' and coach_id is null), 'Brocoli, cuit à la vapeur', 200, 38, 4.1, 2.5, 0.7, 3, 0),
    (v_repas, (select id from public.foods where ciqual_code = '6251' and coach_id is null), 'Boeuf, steak haché 5% MG cuit', 90, 155, 25.5, 0, 5.8, 0, 1),
    (v_repas, (select id from public.foods where ciqual_code = '17270' and coach_id is null), 'Huile d''olive vierge extra', 10, 899, 0.2, 0, 99.9, 0, 2),
    (v_repas, (select id from public.foods where ciqual_code = '9104' and coach_id is null), 'Riz blanc, cuit, sans sel ajouté', 280, 155, 3.1, 33.2, 0.7, 1.4, 3);

  -- ── REPOS ──────────────────────────────────────────────
  -- petit_dejeuner : 566 kcal · P 28 G 77 L 14
  insert into public.diet_meals (plan_id, day_type, meal_type, meal_order)
  values (v_plan, 'repos', 'petit_dejeuner', 0) returning id into v_repas;
  insert into public.diet_items
    (meal_id, food_id, food_name, grams, kcal_100, protein_100, carbs_100, fat_100, fiber_100, item_order)
  values
    (v_repas, (select id from public.foods where ciqual_code = '13005' and coach_id is null), 'Banane, chair sans peau, crue', 120, 88, 1.1, 19.7, 0.5, 2.7, 0),
    (v_repas, (select id from public.foods where ciqual_code = '19644' and coach_id is null), 'Fromage blanc, nature, 0% MG', 245, 48, 7.3, 4.2, 0.1, 0, 1),
    (v_repas, (select id from public.foods where ciqual_code = '15202' and coach_id is null), 'Beurre de cacahuète ou pâte d''arachide', 20, 643, 22.2, 17.3, 51.4, 6, 2),
    (v_repas, (select id from public.foods where ciqual_code = '32140' and coach_id is null), 'Flocons d''avoine — prendre un paquet CERTIFIÉ SANS GLUTEN', 40, 369, 10.6, 57.7, 7.8, 9.1, 3),
    (v_repas, (select id from public.foods where ciqual_code = '31008' and coach_id is null), 'Miel', 20, 331, 0.7, 82.1, 0, 0, 4);
  -- dejeuner : 714 kcal · P 42 G 87 L 19
  insert into public.diet_meals (plan_id, day_type, meal_type, meal_order)
  values (v_plan, 'repos', 'dejeuner', 1) returning id into v_repas;
  insert into public.diet_items
    (meal_id, food_id, food_name, grams, kcal_100, protein_100, carbs_100, fat_100, fiber_100, item_order)
  values
    (v_repas, (select id from public.foods where ciqual_code = '20030' and coach_id is null), 'Haricot vert, cuit', 200, 29, 2, 3, 0.2, 3.4, 0),
    (v_repas, (select id from public.foods where ciqual_code = '36018' and coach_id is null), 'Poulet, filet sans peau grillé/poêlé', 100, 141, 30.1, 0, 2, 0, 1),
    (v_repas, (select id from public.foods where ciqual_code = '17270' and coach_id is null), 'Huile d''olive vierge extra', 15, 899, 0.2, 0, 99.9, 0, 2),
    (v_repas, (select id from public.foods where ciqual_code = '9104' and coach_id is null), 'Riz blanc, cuit, sans sel ajouté', 245, 155, 3.1, 33.2, 0.7, 1.4, 3);
  -- collation : 329 kcal · P 25 G 53 L 1
  insert into public.diet_meals (plan_id, day_type, meal_type, meal_order)
  values (v_plan, 'repos', 'collation', 2) returning id into v_repas;
  insert into public.diet_items
    (meal_id, food_id, food_name, grams, kcal_100, protein_100, carbs_100, fat_100, fiber_100, item_order)
  values
    (v_repas, (select id from public.foods where ciqual_code = '13005' and coach_id is null), 'Banane, chair sans peau, crue', 120, 88, 1.1, 19.7, 0.5, 2.7, 0),
    (v_repas, (select id from public.foods where ciqual_code = '19644' and coach_id is null), 'Fromage blanc, nature, 0% MG', 305, 48, 7.3, 4.2, 0.1, 0, 1),
    (v_repas, (select id from public.foods where ciqual_code = '7354' and coach_id is null), 'Galette de maïs soufflé', 20, 387, 7, 83.5, 1.9, 3, 2);
  -- diner : 623 kcal · P 40 G 70 L 19
  insert into public.diet_meals (plan_id, day_type, meal_type, meal_order)
  values (v_plan, 'repos', 'diner', 3) returning id into v_repas;
  insert into public.diet_items
    (meal_id, food_id, food_name, grams, kcal_100, protein_100, carbs_100, fat_100, fiber_100, item_order)
  values
    (v_repas, (select id from public.foods where ciqual_code = '20304' and coach_id is null), 'Brocoli, cuit à la vapeur', 200, 38, 4.1, 2.5, 0.7, 3, 0),
    (v_repas, (select id from public.foods where ciqual_code = '6251' and coach_id is null), 'Boeuf, steak haché 5% MG cuit', 100, 155, 25.5, 0, 5.8, 0, 1),
    (v_repas, (select id from public.foods where ciqual_code = '17270' and coach_id is null), 'Huile d''olive vierge extra', 10, 899, 0.2, 0, 99.9, 0, 2),
    (v_repas, (select id from public.foods where ciqual_code = '9104' and coach_id is null), 'Riz blanc, cuit, sans sel ajouté', 195, 155, 3.1, 33.2, 0.7, 1.4, 3);

  raise notice 'Diète d''Anaïs enregistrée : 8 repas, 2 journées types.';
end $$;

-- ── Contrôle ──────────────────────────────────────────────────────────────
-- select m.day_type, m.meal_type, round(sum(i.grams * i.kcal_100 / 100)) as kcal
--   from diet_items i join diet_meals m on m.id = i.meal_id
--   join diet_plans d on d.id = m.plan_id
--   join profiles p on p.id = d.coachee_id
--  where p.name = 'Anaïs Moncomble'
--  group by 1,2 order by 1, min(m.meal_order);
