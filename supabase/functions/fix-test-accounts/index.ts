import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const results: string[] = [];

  // Fix null-username test accounts by matching full_name
  const fixes: Record<string, string> = {
    "N. Viên A": "nviena",
    "N. Viên C": "nvienc",
    "N. Viên D": "nviend",
  };

  const { data: nullProfiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .is("username", null);

  for (const p of (nullProfiles || [])) {
    const username = fixes[p.full_name];
    if (username) {
      await supabase.from("profiles").update({ username, must_change_password: false }).eq("user_id", p.user_id);
      results.push(`🔧 ${p.full_name} → ${username}`);

      // Update password
      const { error } = await supabase.auth.admin.updateUserById(p.user_id, {
        password: username === "nviena" ? "ab12nv01" : username === "nvienc" ? "ab12nv03" : "ab12nv04",
      });
      results.push(error ? `❌ Password failed: ${error.message}` : `✅ Password set`);
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
