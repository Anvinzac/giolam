import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const KITCHEN_ID = "d0000000-0000-0000-0000-000000000001";

  const updates = [
    { username: "ntruong", department_id: KITCHEN_ID },
    { username: "tphi", department_id: KITCHEN_ID },
  ];

  const results: string[] = [];

  for (const u of updates) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ department_id: u.department_id })
      .eq("username", u.username)
      .select("username, full_name, department_id");

    if (error) {
      results.push(`Error updating ${u.username}: ${error.message}`);
    } else if (!data || data.length === 0) {
      results.push(`Not found: ${u.username}`);
    } else {
      results.push(`Updated: ${u.username} → Kitchen`);
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
