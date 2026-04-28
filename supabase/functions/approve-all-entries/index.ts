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

  // Count pending entries
  const { count } = await supabase
    .from("salary_entries")
    .select("*", { count: "exact", head: true })
    .eq("is_admin_reviewed", false);

  // Approve all pending entries
  const { error } = await supabase
    .from("salary_entries")
    .update({ is_admin_reviewed: true })
    .eq("is_admin_reviewed", false);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    approved: count || 0,
    message: `Approved ${count || 0} pending entries across all employees`
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
