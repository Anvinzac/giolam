import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const userId = claims.claims.sub as string;

  // Check admin role using service client
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await serviceClient.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { username, full_name, shift_type, default_clock_in, default_clock_out, department_id } = body;

    if (!username || !full_name) {
      return new Response(JSON.stringify({ error: "Username and full_name required" }), { status: 400, headers: corsHeaders });
    }

    const email = `${username}@lunarflow.local`;
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password: "abc12345",
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: corsHeaders });
    }

    if (authData?.user) {
      await serviceClient.from("profiles").update({
        username,
        full_name,
        department_id: department_id || null,
        shift_type: shift_type || "basic",
        default_clock_in: default_clock_in || null,
        default_clock_out: default_clock_out || null,
        must_change_password: true,
      }).eq("user_id", authData.user.id);
    }

    return new Response(JSON.stringify({ success: true, user_id: authData?.user?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
});
