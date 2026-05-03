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

  // Find chioanh
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("username", "chioanh")
    .single();

  if (!profile) return new Response(JSON.stringify({ error: "chioanh not found" }), { headers: corsHeaders });

  // Find current period
  const { data: periods } = await supabase
    .from("working_periods")
    .select("id")
    .order("end_date", { ascending: false })
    .limit(1);

  const periodId = periods?.[0]?.id;

  // Check existing allowances
  const { data: existing } = await supabase
    .from("employee_allowances")
    .select("*")
    .eq("user_id", profile.user_id)
    .eq("period_id", periodId);

  // Try inserting a test allowance
  const uniqueKey = `custom_test_${Date.now()}`;
  const { data: inserted, error } = await supabase
    .from("employee_allowances")
    .insert([{
      user_id: profile.user_id,
      period_id: periodId,
      allowance_key: uniqueKey,
      label: "Test allowance",
      amount: 100000,
      is_enabled: true,
    }])
    .select();

  return new Response(JSON.stringify({
    existing_count: existing?.length,
    existing_keys: existing?.map(a => a.allowance_key),
    insert_error: error?.message || null,
    insert_code: error?.code || null,
    inserted: inserted?.[0] || null,
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
