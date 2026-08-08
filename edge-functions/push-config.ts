// ═══════════════════════════════════════════════════════════════════════════════
//  EDGE FUNCTION — push-config
//
//  Renvoie la CLÉ PUBLIQUE VAPID dont l'app a besoin pour s'abonner aux
//  notifications. Au tout premier appel, la paire de clés est générée et rangée
//  dans la table push_config.
//
//  POURQUOI EN BASE PLUTÔT QU'EN SECRET : personne n'a jamais à manipuler la clé
//  privée, ni à la coller quelque part. Elle naît côté serveur et n'en sort
//  jamais. La table push_config a la RLS activée SANS AUCUNE POLICY : elle est
//  donc inaccessible via l'API publique, y compris à un utilisateur connecté.
//  Seule la clé service_role, qui ne vit que dans les Edge Functions, la lit.
//
//  Cette fonction est publique : elle ne renvoie que la clé publique, qui est
//  faite pour être connue de tous les navigateurs.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateVapidKeys } from "./_webpush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: existant } = await admin
      .from("push_config").select("vapid_public").eq("id", 1).maybeSingle();

    if (existant?.vapid_public) {
      return json({ publicKey: existant.vapid_public }, 200);
    }

    // Première utilisation : on fabrique la paire de clés du serveur.
    const paire = await generateVapidKeys();
    // ignoreDuplicates protège d'un doublon si deux coachés s'abonnent en même temps.
    await admin.from("push_config").upsert({
      id: 1, vapid_public: paire.publicKey, vapid_private: paire.privateKey,
    }, { onConflict: "id", ignoreDuplicates: true });

    // On relit : si un autre appel a gagné la course, c'est SA clé qui fait foi.
    const { data: final } = await admin
      .from("push_config").select("vapid_public").eq("id", 1).single();

    return json({ publicKey: final.vapid_public }, 200);
  } catch (e) {
    return json({ error: `Erreur serveur : ${e?.message || e}` }, 500);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
