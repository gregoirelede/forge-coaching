// ═══════════════════════════════════════════════════════════════════════════════
//  EDGE FUNCTION — send-push
//
//  Envoie une notification push. Deux usages :
//
//    { test: true }
//        L'appelant s'envoie une notification à lui-même, sur tous ses appareils.
//        C'est le bouton « Envoyer un test » des réglages.
//
//    { coacheeId, title, body, url? }
//        Un COACH envoie à l'un de SES coachés. L'appartenance est vérifiée.
//
//  Un abonnement mort (téléphone réinitialisé, notifications révoquées) renvoie
//  404 ou 410 : on le supprime au passage, la table reste propre d'elle-même.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPush } from "./_webpush.ts";

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

    // Identité réelle de l'appelant, via son propre jeton
    const appelant = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await appelant.auth.getUser();
    if (userErr || !user) return json({ error: "Session invalide" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    let cibleId: string;
    let titre: string;
    let texte: string;
    let lien: string = body.url || "./";

    if (body.test) {
      cibleId = user.id;
      titre = "Forge Coaching";
      texte = "Les notifications fonctionnent. Tu es prêt.";
    } else {
      // Envoi par un coach : on vérifie son rôle ET que le coaché lui appartient.
      const { data: profilAppelant } = await admin
        .from("profiles").select("role").eq("id", user.id).single();
      if (!profilAppelant || profilAppelant.role !== "coach") {
        return json({ error: "Accès réservé aux coachs" }, 403);
      }
      if (!body.coacheeId || !body.title || !body.body) {
        return json({ error: "coacheeId, title et body sont requis" }, 400);
      }
      const { data: coache } = await admin
        .from("profiles").select("id, coach_id").eq("id", body.coacheeId).single();
      if (!coache || coache.coach_id !== user.id) {
        return json({ error: "Ce coaché ne t'appartient pas" }, 403);
      }
      cibleId = body.coacheeId;
      titre = String(body.title);
      texte = String(body.body);
    }

    // Clés du serveur
    const { data: config } = await admin
      .from("push_config").select("vapid_public, vapid_private, subject").eq("id", 1).single();
    if (!config) return json({ error: "Notifications non configurées" }, 500);

    const { data: abonnements } = await admin
      .from("push_subscriptions").select("*").eq("coachee_id", cibleId);
    if (!abonnements || abonnements.length === 0) {
      return json({ error: "Aucun appareil abonné" }, 404);
    }

    const charge = JSON.stringify({ title: titre, body: texte, url: lien });
    let envoyees = 0;
    const perimes: string[] = [];

    for (const ab of abonnements) {
      try {
        const r = await sendPush({
          subscription: { endpoint: ab.endpoint, p256dh: ab.p256dh, auth: ab.auth },
          payload: charge,
          vapid: {
            publicKey: config.vapid_public,
            privateKey: config.vapid_private,
            subject: config.subject,
          },
        });
        if (r.ok) {
          envoyees++;
          await admin.from("push_subscriptions")
            .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
            .eq("id", ab.id);
        } else if (r.perime) {
          perimes.push(ab.id);
        } else {
          await admin.from("push_subscriptions")
            .update({ failure_count: (ab.failure_count || 0) + 1 }).eq("id", ab.id);
        }
      } catch {
        await admin.from("push_subscriptions")
          .update({ failure_count: (ab.failure_count || 0) + 1 }).eq("id", ab.id);
      }
    }

    // Ménage : les abonnements morts n'ont aucune raison de rester.
    if (perimes.length) await admin.from("push_subscriptions").delete().in("id", perimes);

    return json({ success: envoyees > 0, envoyees, supprimes: perimes.length,
                  total: abonnements.length }, envoyees > 0 ? 200 : 502);
  } catch (e) {
    return json({ error: `Erreur serveur : ${e?.message || e}` }, 500);
  }
});

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
