-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — LE RETOUR SUR UN ALIMENT DEVIENT RÉVERSIBLE
--
--  À JOUER DANS : Supabase → SQL Editor → New query → coller → Run.
--  IDEMPOTENT : relançable autant de fois que voulu, sans risque.
--
--  CE QUI NE VA PAS AUJOURD'HUI. `diet_feedback` a été conçue en écriture
--  seule pour le coaché, sur le modèle de `error_reports` : il dépose, il ne
--  relit pas. C'était une erreur, et un retour d'Anaïs l'a montrée.
--
--  Deux conséquences, dont une que personne n'avait vue :
--
--   1. Un appui par erreur est DÉFINITIF. Elle signale un aliment qu'elle
--      aime, et rien ne lui permet de revenir dessus. Le coach reçoit un
--      signal faux et remplace un aliment qui convenait.
--
--   2. Plus grave, parce qu'invisible : l'état « signalé » ne vit que dans la
--      mémoire de la page. Ne pouvant pas relire ses retours, l'app ne peut
--      pas les réafficher au chargement suivant — la croix réapparaît vierge,
--      et le même aliment part une deuxième fois.
--
--  UN RAPPORT D'ERREUR ET UN RETOUR SUR UN ALIMENT NE SONT PAS LA MÊME CHOSE.
--  Le premier est une trace technique que personne ne relit. Le second est un
--  message adressé à quelqu'un, à propos de sa propre alimentation : son
--  auteur doit pouvoir le relire et le retirer. Le parallèle avec
--  `error_reports` était le mauvais modèle.
--
--  Ce que ça N'ouvre PAS : le coaché ne voit toujours que SES retours, ne peut
--  toujours pas modifier sa diète, et ne peut pas toucher à ceux d'un autre.
-- ═══════════════════════════════════════════════════════════════════════════


-- Le coaché relit ses propres retours. S'ajoute à la policy du coach, qui
-- reste inchangée : deux policies SELECT se cumulent, elles ne se remplacent
-- pas.
drop policy if exists "coache relit ses retours" on public.diet_feedback;
create policy "coache relit ses retours" on public.diet_feedback
  for select using ((select auth.uid()) = coachee_id);

-- Et il peut les retirer. Même remarque : la policy DELETE du coach reste.
drop policy if exists "coache annule son retour" on public.diet_feedback;
create policy "coache annule son retour" on public.diet_feedback
  for delete using ((select auth.uid()) = coachee_id);

-- Filet de sécurité contre le double signalement. L'app l'empêche désormais
-- en relisant l'état réel, mais une contrainte vaut mieux qu'une intention :
-- deux appuis rapprochés, deux appareils, une reconnexion au mauvais moment.
-- Index partiel, parce que `item_id` peut être NULL quand le coach a supprimé
-- l'aliment entre-temps — et deux retours orphelins n'ont rien à voir.
create unique index if not exists idx_retour_unique
  on public.diet_feedback (coachee_id, item_id) where item_id is not null;


-- ═══════════════════════════════════════════════════════════════════════════
--  CONTRÔLE — doit renvoyer 5 lignes
-- ═══════════════════════════════════════════════════════════════════════════
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'diet_feedback'
--  order by cmd, policyname;
--   coach efface les retours traites  | DELETE
--   coache annule son retour          | DELETE
--   coache signale un aliment         | INSERT
--   coach lit les retours             | SELECT
--   coache relit ses retours          | SELECT
