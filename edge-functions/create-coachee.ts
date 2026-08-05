// ═══════════════════════════════════════════════════════════════════════════════
//  EDGE FUNCTION — create-coachee
//  Crée un compte coaché de façon sécurisée (la clé service_role reste côté serveur).
//
//  Appelée par l'espace coach. Vérifie que l'appelant est bien un coach authentifié,
//  puis crée : le compte Auth du coaché + son profil (role=coachee, lié au coach).
//
//  Déploiement : voir le guide GUIDE-edge-function-windows.md
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Préflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Récupérer le token de l'appelant (le coach connecté) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Non authentifié" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client "appelant" : utilise le token du coach pour vérifier son identité
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: coach }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !coach) {
      return json({ error: "Session invalide" }, 401);
    }

    // ── 2. Vérifier que l'appelant est bien un COACH ──
    const { data: coachProfile, error: profErr } = await callerClient
      .from("profiles").select("role").eq("id", coach.id).single();
    if (profErr || !coachProfile || coachProfile.role !== "coach") {
      return json({ error: "Accès réservé aux coachs" }, 403);
    }

    // ── 3. Lire les données du nouveau coaché ──
    const body = await req.json();
    const { name, accessCode, goal, startDate, offer } = body;
    if (!name || !accessCode) {
      return json({ error: "Nom et code d'accès requis" }, 400);
    }

    const code = String(accessCode).trim().toUpperCase().replace(/\s+/g, "");
    const cleanForEmail = code.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const email    = `${cleanForEmail}@coachee.forge.app`;
    const password = `Forge_${code}_2025!`;

    // ── 4. Client admin (service_role) pour créer le compte ──
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Créer le compte Auth (auto-confirmé)
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return json({ error: `Création du compte échouée : ${createErr?.message || "inconnu"}` }, 400);
    }

    const newUserId = created.user.id;

    // ── 5. Créer le profil du coaché, lié à ce coach ──
    const { error: insertErr } = await adminClient.from("profiles").insert({
      id: newUserId,
      name,
      access_code: code,
      goal: goal || null,
      start_date: startDate || null,
      role: "coachee",
      coach_id: coach.id,
      offer: offer === "premium" ? "premium" : "essentiel",
      is_active: true,
    });

    if (insertErr) {
      // Rollback : supprimer le compte Auth créé si le profil échoue
      await adminClient.auth.admin.deleteUser(newUserId);
      return json({ error: `Création du profil échouée : ${insertErr.message}` }, 400);
    }

    // ── 6. Succès : renvoyer le code d'accès à communiquer au coaché ──
    return json({
      success: true,
      coachee: { id: newUserId, name, accessCode: code, email },
    }, 200);

  } catch (e) {
    return json({ error: `Erreur serveur : ${e?.message || e}` }, 500);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
