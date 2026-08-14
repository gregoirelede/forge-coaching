-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — DIÈTE PERSONNALISÉE FIXE
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable autant de fois que voulu, sans risque.
--
--  CE QUE ÇA REMPLACE. Jusqu'ici la nutrition du coaché était un « plan de la
--  semaine » : sept jours, chacun garni de recettes entières tirées de
--  recipes_library. Le coach ne pouvait échanger qu'une recette complète —
--  jamais un aliment. Or une diète se règle à l'aliment près : 20 g de riz en
--  plus, le beurre de cacahuète remplacé par des amandes.
--
--  CE QUI ARRIVE À LA PLACE. Une diète FIXE par coaché, en deux journées
--  types : jour d'entraînement et jour de repos. Chaque repas est une liste
--  d'aliments avec leur grammage. Tout est modifiable, aliment par aliment.
--
--  RIEN N'EST DÉTRUIT. meal_plans et recipes_library restent en base, avec
--  leurs données et leurs policies. Elles ne sont simplement plus alimentées.
--  Les sauvegardes déjà téléchargées restent lisibles.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  1. LA BASE D'ALIMENTS
--
--  coach_id IS NULL  → aliment de la base commune (table Ciqual de l'ANSES),
--                      lisible par tous, modifiable par personne depuis l'app.
--  coach_id RENSEIGNÉ → aliment ajouté par un coach, à lui seul.
--
--  Les valeurs sont POUR 100 G. C'est la convention de toutes les tables de
--  composition, Ciqual compris : on ne la change pas, sinon toute
--  comparaison avec une étiquette de produit devient fausse.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.foods (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid references public.profiles(id) on delete cascade,
  ciqual_code   text,              -- alim_code de la table Ciqual, NULL si aliment perso
  name          text not null,
  role          text not null default 'autre'
                check (role in ('proteine','feculent','legume','fruit','matiere_grasse','autre')),
  meal_types    text[] default array['petit_dejeuner','collation_matin','dejeuner','collation','diner'],
  kcal_100      numeric not null,
  protein_100   numeric not null default 0,
  carbs_100     numeric not null default 0,
  fat_100       numeric not null default 0,
  fiber_100     numeric,
  portion_g     numeric,           -- portion usuelle, pour proposer un grammage de départ
  portion_label text,              -- « 1 yaourt », « 1 c. à soupe » — parlant pour le coaché
  tags          text[],            -- vegetarien, vegan, sans_gluten, sans_lactose, halal…
  created_at    timestamptz default now()
);

-- Un même aliment Ciqual ne doit pas entrer deux fois dans la base commune.
-- Index partiel : la contrainte ne vise QUE la base commune, un coach reste
-- libre de créer son propre « Riz basmati » à côté.
create unique index if not exists idx_foods_ciqual_unique
  on public.foods (ciqual_code) where coach_id is null and ciqual_code is not null;
create index if not exists idx_foods_coach on public.foods (coach_id);
create index if not exists idx_foods_role  on public.foods (role);
create index if not exists idx_foods_nom   on public.foods (lower(name));

alter table public.foods enable row level security;

-- La base commune est de la donnée publique de l'ANSES : tout le monde la lit.
-- Un aliment perso n'est lisible que par son coach.
drop policy if exists "lire les aliments" on public.foods;
create policy "lire les aliments" on public.foods
  for select using (coach_id is null or coach_id = (select auth.uid()));

drop policy if exists "coach cree ses aliments" on public.foods;
create policy "coach cree ses aliments" on public.foods
  for insert with check (coach_id = (select auth.uid()));

drop policy if exists "coach modifie ses aliments" on public.foods;
create policy "coach modifie ses aliments" on public.foods
  for update using (coach_id = (select auth.uid()))
              with check (coach_id = (select auth.uid()));

drop policy if exists "coach efface ses aliments" on public.foods;
create policy "coach efface ses aliments" on public.foods
  for delete using (coach_id = (select auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════
--  2. LA DIÈTE
--
--  UNE seule diète par coaché — contrainte UNIQUE, pas une convention. Un
--  coaché qui verrait deux diètes ne saurait pas laquelle suivre, et la règle
--  « un seul programme actif » a déjà montré que la convention seule finit
--  par se faire violer.
--
--  Les cibles sont FIGÉES à la génération. Le poids du coaché bouge, donc ses
--  besoins aussi : en gardant la cible d'origine, l'espace coach peut dire
--  « la cible a bougé de 180 kcal depuis que tu as construit cette diète ».
--  Sans cette photo, la dérive serait invisible.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.diet_plans (
  id            uuid primary key default gen_random_uuid(),
  coachee_id    uuid references public.profiles(id) on delete cascade not null unique,
  meals_per_day int not null default 4,
  -- Cibles du jour d'entraînement, telles qu'au moment de la génération
  kcal_train    int, prot_train  int, carbs_train int, fat_train int,
  -- Cibles du jour de repos
  kcal_rest     int, prot_rest   int, carbs_rest  int, fat_rest  int,
  weight_at_gen numeric,          -- le poids qui a servi au calcul
  note          text,             -- mot du coach, affiché en tête de la diète
  generated_at  timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_diete_coachee on public.diet_plans (coachee_id);

alter table public.diet_plans enable row level security;

drop policy if exists "coache lit sa diete" on public.diet_plans;
create policy "coache lit sa diete" on public.diet_plans
  for select using (
    (select auth.uid()) = coachee_id
    or exists (select 1 from public.profiles p
               where p.id = diet_plans.coachee_id and p.coach_id = (select auth.uid()))
  );

drop policy if exists "coach ecrit la diete de ses coaches" on public.diet_plans;
create policy "coach ecrit la diete de ses coaches" on public.diet_plans
  for all using (
    exists (select 1 from public.profiles p
            where p.id = diet_plans.coachee_id and p.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = diet_plans.coachee_id and p.coach_id = (select auth.uid()))
  );


-- ═══════════════════════════════════════════════════════════════════════════
--  3. LES REPAS
--
--  day_type : 'entrainement' ou 'repos'. Deux journées types, pas sept.
--  Un jour de séance demande plus de glucides ; un jour de repos moins. Le
--  reste identique, parce qu'une diète qu'on ne sait pas refaire de tête le
--  jeudi soir n'est pas suivie.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.diet_meals (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid references public.diet_plans(id) on delete cascade not null,
  day_type   text not null check (day_type in ('entrainement','repos')),
  meal_type  text not null check (meal_type in
              ('petit_dejeuner','collation_matin','dejeuner','collation','diner')),
  meal_order int not null default 0,
  unique (plan_id, day_type, meal_type)
);
create index if not exists idx_repas_diete on public.diet_meals (plan_id, day_type, meal_order);

alter table public.diet_meals enable row level security;

drop policy if exists "coache lit ses repas" on public.diet_meals;
create policy "coache lit ses repas" on public.diet_meals
  for select using (
    exists (select 1 from public.diet_plans d
            where d.id = diet_meals.plan_id
              and (d.coachee_id = (select auth.uid())
                   or exists (select 1 from public.profiles p
                              where p.id = d.coachee_id and p.coach_id = (select auth.uid()))))
  );

drop policy if exists "coach ecrit les repas" on public.diet_meals;
create policy "coach ecrit les repas" on public.diet_meals
  for all using (
    exists (select 1 from public.diet_plans d join public.profiles p on p.id = d.coachee_id
            where d.id = diet_meals.plan_id and p.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.diet_plans d join public.profiles p on p.id = d.coachee_id
            where d.id = diet_meals.plan_id and p.coach_id = (select auth.uid()))
  );


-- ═══════════════════════════════════════════════════════════════════════════
--  4. LES ALIMENTS D'UN REPAS
--
--  POURQUOI LES MACROS SONT RECOPIÉES ICI, et pas seulement référencées.
--  C'est l'inverse du choix fait pour les vidéos d'exercices (Partie G du
--  CLAUDE.md), et c'est délibéré. Une vidéo corrigée doit profiter à tous ;
--  une diète, elle, est un document que le coach a validé à 2 480 kcal. Si la
--  base d'aliments est mise à jour un jour, les grammages ne changeraient pas
--  mais les totaux si — la diète cesserait d'atteindre sa cible sans que
--  personne ne l'ait décidé. On fige donc la photo, et on garde food_id pour
--  savoir d'où elle vient.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.diet_items (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid references public.diet_meals(id) on delete cascade not null,
  food_id     uuid references public.foods(id) on delete set null,
  food_name   text not null,
  grams       numeric not null check (grams > 0),
  kcal_100    numeric not null,
  protein_100 numeric not null default 0,
  carbs_100   numeric not null default 0,
  fat_100     numeric not null default 0,
  fiber_100   numeric,
  item_order  int not null default 0,
  created_at  timestamptz default now()
);
create index if not exists idx_aliments_repas on public.diet_items (meal_id, item_order);

alter table public.diet_items enable row level security;

drop policy if exists "coache lit ses aliments" on public.diet_items;
create policy "coache lit ses aliments" on public.diet_items
  for select using (
    exists (select 1 from public.diet_meals m join public.diet_plans d on d.id = m.plan_id
            where m.id = diet_items.meal_id
              and (d.coachee_id = (select auth.uid())
                   or exists (select 1 from public.profiles p
                              where p.id = d.coachee_id and p.coach_id = (select auth.uid()))))
  );

drop policy if exists "coach ecrit les aliments" on public.diet_items;
create policy "coach ecrit les aliments" on public.diet_items
  for all using (
    exists (select 1 from public.diet_meals m
            join public.diet_plans d on d.id = m.plan_id
            join public.profiles p on p.id = d.coachee_id
            where m.id = diet_items.meal_id and p.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.diet_meals m
            join public.diet_plans d on d.id = m.plan_id
            join public.profiles p on p.id = d.coachee_id
            where m.id = diet_items.meal_id and p.coach_id = (select auth.uid()))
  );


-- ═══════════════════════════════════════════════════════════════════════════
--  5. « JE N'AIME PAS CET ALIMENT »
--
--  Le coaché ne modifie pas sa diète — c'est la règle de l'app, la nutrition
--  se pilote depuis l'espace coach. Mais il doit pouvoir DIRE qu'un aliment ne
--  passe pas, sinon il l'abandonne en silence et la diète est fausse sans que
--  personne ne le sache.
--
--  Écriture seule, comme error_reports : il dépose, il ne relit pas. C'est le
--  coach qui traite. Aucune policy UPDATE : un retour ne se réécrit pas.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.diet_feedback (
  id         uuid primary key default gen_random_uuid(),
  coachee_id uuid references public.profiles(id) on delete cascade not null,
  item_id    uuid references public.diet_items(id) on delete cascade,
  food_name  text not null,
  meal_label text,
  created_at timestamptz default now()
);
create index if not exists idx_retours_diete on public.diet_feedback (coachee_id, created_at desc);

alter table public.diet_feedback enable row level security;

drop policy if exists "coache signale un aliment" on public.diet_feedback;
create policy "coache signale un aliment" on public.diet_feedback
  for insert with check ((select auth.uid()) = coachee_id);

drop policy if exists "coach lit les retours" on public.diet_feedback;
create policy "coach lit les retours" on public.diet_feedback
  for select using (
    exists (select 1 from public.profiles p
            where p.id = diet_feedback.coachee_id and p.coach_id = (select auth.uid()))
  );

drop policy if exists "coach efface les retours traites" on public.diet_feedback;
create policy "coach efface les retours traites" on public.diet_feedback
  for delete using (
    exists (select 1 from public.profiles p
            where p.id = diet_feedback.coachee_id and p.coach_id = (select auth.uid()))
  );


-- ═══════════════════════════════════════════════════════════════════════════
--  6. LE CONSENTEMENT, DONNÉ PAR LE COACHÉ LUI-MÊME
--
--  nutrition_profiles.consent_disclaimer existe déjà, mais c'est le COACH qui
--  la coche, depuis son espace, au nom du coaché. Un consentement donné par
--  quelqu'un d'autre n'est pas un consentement.
--
--  Cette table le recueille depuis le compte du coaché, horodaté, et versionné
--  pour qu'un changement du texte puisse redemander l'accord. Écriture seule
--  et aucune policy DELETE ni UPDATE : un registre de consentement ne se
--  réécrit pas, y compris par le coach. C'est ce qui lui donne sa valeur.
--
--  Le cadre : BPJEPS n'est pas diététicien — titre protégé par l'article
--  L4371-2 du Code de la santé publique. Ce que l'app produit est une
--  suggestion à visée éducative, jamais une prescription (règle J.10).
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.diet_consents (
  id          uuid primary key default gen_random_uuid(),
  coachee_id  uuid references public.profiles(id) on delete cascade not null,
  version     text not null,
  accepted_at timestamptz default now()
);
create index if not exists idx_consentements on public.diet_consents (coachee_id, accepted_at desc);

alter table public.diet_consents enable row level security;

drop policy if exists "coache donne son consentement" on public.diet_consents;
create policy "coache donne son consentement" on public.diet_consents
  for insert with check ((select auth.uid()) = coachee_id);

drop policy if exists "lire les consentements" on public.diet_consents;
create policy "lire les consentements" on public.diet_consents
  for select using (
    (select auth.uid()) = coachee_id
    or exists (select 1 from public.profiles p
               where p.id = diet_consents.coachee_id and p.coach_id = (select auth.uid()))
  );


-- ═══════════════════════════════════════════════════════════════════════════
--  CONTRÔLE — doit renvoyer 6 lignes, RLS active partout
-- ═══════════════════════════════════════════════════════════════════════════
-- select c.relname as table,
--        c.relrowsecurity as rls_active,
--        (select count(*) from pg_policies g
--          where g.schemaname='public' and g.tablename=c.relname) as policies
-- from pg_class c join pg_namespace n on n.oid=c.relnamespace
-- where n.nspname='public'
--   and c.relname in ('foods','diet_plans','diet_meals','diet_items',
--                     'diet_feedback','diet_consents')
-- order by 1;
--
--   diet_consents | true | 2
--   diet_feedback | true | 3
--   diet_items    | true | 2
--   diet_meals    | true | 2
--   diet_plans    | true | 2
--   foods         | true | 4
