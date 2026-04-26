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

  const { username } = await req.json().catch(() => ({ username: "ptuan" }));

  // Get user_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("username", username)
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: "not found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get allowances
  const { data: allowances } = await supabase
    .from("employee_allowances")
    .select("*")
    .eq("user_id", profile.user_id);

  // Get allowance defaults
  const { data: defaults } = await supabase
    .from("employee_allowance_defaults")
    .select("*")
    .eq("user_id", profile.user_id);

  // Get entries count
  const { data: entries } = await supabase
    .from("salary_entries")
    .select("entry_date, is_day_off, clock_in, clock_out")
    .eq("user_id", profile.user_id);

  const workingDays = (entries || []).filter(
    (e: any) => !e.is_day_off && (e.clock_in || e.clock_out)
  ).length;

  // Get salary record
  const { data: record } = await supabase
    .from("salary_records")
    .select("total_salary, salary_breakdown, status")
    .eq("user_id", profile.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return new Response(JSON.stringify({
    user_id: profile.user_id,
    allowances,
    defaults,
    workingDays,
    totalEntries: entries?.length || 0,
    record,
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
