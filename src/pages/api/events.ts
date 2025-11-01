import type { APIRoute } from "astro";
import { supabase } from "../../utils/database";
import { isAIReferrer } from "../../utils/aiReferrers";

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();

    const ref = String(payload?.referrer || "");
    const row = {
      claim_slug: String(payload?.claim_slug || "unknown"),
      page: String(payload?.page || "/"),
      referrer: ref || null,
      is_ai_referrer: isAIReferrer(ref),
      event_type: String(payload?.event_type || "session"),
      meta: payload?.meta ?? {}
    };

    if (supabase) {
      await supabase.from("events").insert(row);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid request" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }
};
