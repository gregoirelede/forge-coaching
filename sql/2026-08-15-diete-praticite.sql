-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — PRATICITÉ DES DIÈTES
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable autant de fois que voulu, sans risque.
--
--  LE PROBLÈME. Le générateur tire dans 3 286 aliments sans savoir lesquels
--  sont chers ni lesquels demandent une heure de cuisine. Il compose donc des
--  diètes justes sur le papier et intenables dans une vraie semaine : un
--  coaché qui n'a ni le temps ni le budget abandonne en dix jours, et une
--  diète abandonnée ne vaut rien, même parfaitement calculée.
--
--  CE QUE ÇA AJOUTE, en trois morceaux :
--
--   1. Deux niveaux sur chaque aliment — COÛT et PRÉPARATION, de 1 à 3.
--      Deux axes séparés parce qu'ils sont indépendants : le thon en conserve
--      est bon marché ET immédiat, un pot-au-feu est bon marché mais long,
--      le saumon fumé est cher mais instantané.
--
--   2. Deux plafonds par coaché, qui bornent ce que le générateur peut tirer.
--
--   3. La liste des ALIMENTS HABITUELS du coaché : ce qu'il mange déjà, et que
--      le coach a validé comme compatible avec une diète de sportif. Le
--      générateur y pioche en priorité. C'est le point qui change le plus le
--      taux de suivi — on ne demande pas à quelqu'un de tout changer d'un coup.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  1. COÛT ET PRÉPARATION, SUR CHAQUE ALIMENT
--
--  Le défaut est 2 — « ni cher ni gratuit, ni instantané ni long ». Un aliment
--  jamais classé reste donc utilisable, mais sort dès que le coach serre l'un
--  des deux curseurs. C'est le bon défaut : il ne ment pas dans un sens qui
--  ferait entrer un homard dans une diète à budget serré.
--
--  Ces valeurs sont PRÉ-REMPLIES par scripts/importer-ciqual.py, par famille
--  d'aliments. Ce sont des estimations, pas des relevés de prix : le coach
--  corrige n'importe quel aliment depuis l'espace coach, et sa correction
--  survit aux réimports (l'import ne touche que les aliments de la base
--  commune, et n'écrase que ce qu'il a lui-même écrit).
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.foods
  add column if not exists cost_level int not null default 2,
  add column if not exists prep_level int not null default 2;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'foods_cost_level_check') then
    alter table public.foods add constraint foods_cost_level_check
      check (cost_level between 1 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'foods_prep_level_check') then
    alter table public.foods add constraint foods_prep_level_check
      check (prep_level between 1 and 3);
  end if;
end $$;

create index if not exists idx_foods_praticite on public.foods (cost_level, prep_level);


-- ═══════════════════════════════════════════════════════════════════════════
--  2. LES PLAFONDS DU COACHÉ
--
--  3 = aucune contrainte, c'est le comportement d'avant. Les diètes déjà
--  générées ne bougent donc pas.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.nutrition_profiles
  add column if not exists max_cost_level int not null default 3,
  add column if not exists max_prep_level int not null default 3;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'np_max_cost_check') then
    alter table public.nutrition_profiles add constraint np_max_cost_check
      check (max_cost_level between 1 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'np_max_prep_check') then
    alter table public.nutrition_profiles add constraint np_max_prep_check
      check (max_prep_level between 1 and 3);
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  3. LES ALIMENTS HABITUELS
--
--  POURQUOI UNE TABLE ET PAS UN text[] À CÔTÉ DE disliked_foods.
--  `disliked_foods` est du texte libre, et c'est suffisant pour EXCLURE : on
--  compare au nom, un faux positif écarte un aliment de plus, sans gravité.
--  Ici c'est l'inverse — il faut retrouver l'aliment exact pour en lire les
--  macros. « poulet » en texte libre ne dit pas s'il s'agit du blanc à 165 kcal
--  ou de la cuisse avec peau à 260. On pointe donc la vraie ligne de `foods`.
--
--  Écrite par le COACH uniquement : c'est lui qui a validé que l'aliment a sa
--  place dans une diète de sportif. Le coaché la lit, sans plus.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.coachee_staples (
  id         uuid primary key default gen_random_uuid(),
  coachee_id uuid references public.profiles(id) on delete cascade not null,
  food_id    uuid references public.foods(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (coachee_id, food_id)
);
create index if not exists idx_habitudes_coachee on public.coachee_staples (coachee_id);

alter table public.coachee_staples enable row level security;

drop policy if exists "lire les aliments habituels" on public.coachee_staples;
create policy "lire les aliments habituels" on public.coachee_staples
  for select using (
    (select auth.uid()) = coachee_id
    or exists (select 1 from public.profiles p
               where p.id = coachee_staples.coachee_id and p.coach_id = (select auth.uid()))
  );

drop policy if exists "coach ecrit les aliments habituels" on public.coachee_staples;
create policy "coach ecrit les aliments habituels" on public.coachee_staples
  for all using (
    exists (select 1 from public.profiles p
            where p.id = coachee_staples.coachee_id and p.coach_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = coachee_staples.coachee_id and p.coach_id = (select auth.uid()))
  );


-- ═══════════════════════════════════════════════════════════════════════════
--  CONTRÔLE — doit renvoyer une ligne, puis 2 policies
-- ═══════════════════════════════════════════════════════════════════════════
-- select
--   (select count(*) from information_schema.columns
--     where table_name='foods' and column_name in ('cost_level','prep_level'))        as colonnes_foods,
--   (select count(*) from information_schema.columns
--     where table_name='nutrition_profiles'
--       and column_name in ('max_cost_level','max_prep_level'))                       as colonnes_profil,
--   (select count(*) from pg_policies where tablename='coachee_staples')              as policies;
--   → 2 | 2 | 2
