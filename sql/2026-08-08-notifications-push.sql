-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — NOTIFICATIONS PUSH (Sprint 2)
--  Appliquée le 8 août 2026 · migration Supabase « notifications_push »
--
--  Ce fichier est le double, dans le dépôt, de ce qui tourne réellement en base.
--  Il est IDEMPOTENT : on peut le relancer autant de fois qu'on veut.
--
--  Deux tables :
--    push_subscriptions — un appareil abonné, par coaché. Un coaché peut en
--                         avoir plusieurs (iPhone + ordinateur), d'où l'absence
--                         de contrainte d'unicité sur coachee_id.
--    push_config        — la paire de clés VAPID du serveur. UNE SEULE LIGNE.
--
--  LE POINT DE SÉCURITÉ IMPORTANT — push_config
--  La clé privée VAPID signe les envois : quiconque la lit peut envoyer des
--  notifications au nom de Forge Coaching. Elle est donc protégée deux fois :
--    1. RLS activée SANS AUCUNE POLICY  → aucune ligne ne passe jamais le filtre
--    2. AUCUN GRANT pour anon/authenticated → l'accès est refusé avant même la RLS
--  Seule la clé service_role, qui ne vit que dans les Edge Functions, y accède.
--  Le conseiller Supabase signale cette table en INFO (« RLS enabled, no
--  policy ») : c'est voulu, ce n'est pas un oubli.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Abonnements des appareils ──────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  coachee_id      uuid not null references public.profiles(id) on delete cascade,
  -- L'adresse que le navigateur nous donne. Unique : réabonner le même appareil
  -- met à jour la ligne au lieu d'en créer une seconde (upsert on conflict).
  endpoint        text not null unique,
  p256dh          text not null,   -- clé publique de l'appareil (chiffrement)
  auth            text not null,   -- secret d'authentification de l'appareil
  user_agent      text,            -- pour que le coaché reconnaisse ses appareils
  created_at      timestamptz default now(),
  last_success_at timestamptz,
  failure_count   int default 0
);

create index if not exists idx_push_subs_coachee
  on public.push_subscriptions(coachee_id);

alter table public.push_subscriptions enable row level security;

-- Chaque coaché ne voit et ne gère QUE ses propres appareils.
-- La forme (select auth.uid()) est délibérée : elle évite de réévaluer la
-- fonction ligne par ligne (voir sql/NOTE-optimisation-rls.md).
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all using ((select auth.uid()) = coachee_id);

-- Le coach n'a volontairement AUCUN accès direct à cette table : il n'en a pas
-- besoin. L'envoi passe par l'Edge Function send-push, qui vérifie elle-même
-- que le coaché lui appartient. Moins de portes, moins de risques.

-- ── Clés VAPID du serveur ──────────────────────────────────────────────────
-- Le CHECK (id = 1) est le garde-fou : une seule ligne possible, quoi qu'il
-- arrive. Il porte le nom donné automatiquement par PostgreSQL,
-- push_config_id_check, qui est bien celui présent en base.
create table if not exists public.push_config (
  id            int primary key default 1 check (id = 1),
  vapid_public  text not null,
  vapid_private text not null,
  subject       text not null default 'mailto:gregoire.lede777@gmail.com',
  created_at    timestamptz default now()
);

alter table public.push_config enable row level security;
-- Aucune policy, volontairement. Voir l'en-tête.

-- Ceinture et bretelles : on retire tout privilège aux rôles de l'API publique.
revoke all on public.push_config from anon, authenticated;

-- La paire de clés n'est PAS insérée ici : elle est générée côté serveur par
-- l'Edge Function push-config au tout premier abonnement. Personne — ni Greg,
-- ni Claude, ni le dépôt — n'a jamais la clé privée entre les mains.
