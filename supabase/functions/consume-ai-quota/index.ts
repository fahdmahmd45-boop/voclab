import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://voclab.website",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: { cost?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const cost = Number(body?.cost ?? 1);
  if (cost !== 1 && cost !== 5) {
    return json({ error: "Invalid AI credit cost" }, 400);
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await admin.rpc("consume_voclab_ai_quota", {
    p_user_id: userId,
    p_cost: cost
  });

  if (error) {
    console.error("quota rpc failed", error.code, error.message);
    return json({ error: "Quota unavailable" }, 503);
  }

  const quota = Array.isArray(data) ? data[0] : data;
  return json(quota || { allowed: false, code: "QUOTA_UNAVAILABLE" });
});
