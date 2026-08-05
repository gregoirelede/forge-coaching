// ═══════════════════════════════════════════════════════════════════════════════
//  EDGE FUNCTION — update-coachee
//  Met à jour un coaché de façon sécurisée. Le changement de CODE D'ACCÈS modifie
//  les identifiants Auth (email + mot de passe dérivés), ce qui nécessite la clé
//  service_role — donc côté serveur uniquement.
//
//  Déploiement : voir GUIDE-edge-function-update.md
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Vérifier l'identité du coach appelant
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: coach }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !coach) return json({ error: "Session invalide" }, 401);

    const { data: coachProfile } = await callerClient
      .from("profiles").select("role").eq("id", coach.id).single();
    if (!coachProfile || coachProfile.role !== "coach") return json({ error: "Accès réservé aux coachs" }, 403);

    const body = await req.json();
    const { coacheeId, newName, newOffer, newAccessCode } = body;
    if (!coacheeId) return json({ error: "coacheeId requis" }, 400);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Vérifier que ce coaché appartient bien à ce coach
    const { data: target } = await adminClient
      .from("profiles").select("id, coach_id, access_code").eq("id", coacheeId).single();
    if (!target || target.coach_id !== coach.id) return json({ error: "Ce coaché ne t'appartient pas" }, 403);

    const profileUpdate: Record<string, unknown> = {};
    if (typeof newName === "string" && newName.trim()) profileUpdate.name = newName.trim();
    if (newOffer === "premium" || newOffer === "essentiel") profileUpdate.offer = newOffer;

    // Changement de code d'accès → met à jour l'email + mot de passe Auth
    if (newAccessCode && String(newAccessCode).trim().toUpperCase() !== String(target.access_code || "").toUpperCase()) {
      const code = String(newAccessCode).trim().toUpperCase().replace(/\s+/g, "");
      // Unicité du code
      const { data: dup } = await adminClient
        .from("profiles").select("id").eq("access_code", code).neq("id", coacheeId).maybeSingle();
      if (dup) return json({ error: "Ce code d'accès est déjà utilisé" }, 400);

      const cleanForEmail = code.toLowerCase().replace(/[^a-z0-9-]/g, "");
      const email    = `${cleanForEmail}@coachee.forge.app`;
      const password = `Forge_${code}_2025!`;

      const { error: authErr } = await adminClient.auth.admin.updateUserById(coacheeId, { email, password, email_confirm: true });
      if (authErr) return json({ error: `Mise à jour du compte échouée : ${authErr.message}` }, 400);
      profileUpdate.access_code = code;
    }

    if (Object.keys(profileUpdate).length > 0) {
      const { error: updErr } = await adminClient.from("profiles").update(profileUpdate).eq("id", coacheeId);
      if (updErr) return json({ error: `Mise à jour du profil échouée : ${updErr.message}` }, 400);
    }

    return json({ success: true, updated: profileUpdate }, 200);
  } catch (e) {
    return json({ error: `Erreur serveur : ${e?.message || e}` }, 500);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
