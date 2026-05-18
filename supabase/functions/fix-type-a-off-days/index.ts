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

  // Find current period
  const { data: period, error: periodError } = await supabase
    .from("working_periods")
    .select("id, start_date, end_date")
    .eq("is_archived", false)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (periodError || !period) {
    return new Response(
      JSON.stringify({ error: "No active period found", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  results.push(`Period: ${period.start_date} → ${period.end_date}`);

  // Find all Type A employees with off-day entries
  const { data: employees } = await supabase
    .from("profiles")
    .select("user_id, username, full_name")
    .eq("shift_type", "basic");

  if (!employees || employees.length === 0) {
    return new Response(
      JSON.stringify({ error: "No Type A employees found", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let totalFixed = 0;

  for (const emp of employees) {
    // Find off-day entries
    const { data: entries } = await supabase
      .from("salary_entries")
      .select("id, entry_date, is_day_off")
      .eq("user_id", emp.user_id)
      .eq("period_id", period.id)
      .eq("is_day_off", true);

    if (!entries || entries.length === 0) {
      results.push(`${emp.full_name}: No off-day entries to fix ✓`);
      continue;
    }

    // Update to active
    const { error: updateError } = await supabase
      .from("salary_entries")
      .update({ is_day_off: false })
      .eq("user_id", emp.user_id)
      .eq("period_id", period.id)
      .eq("is_day_off", true);

    if (updateError) {
      results.push(`${emp.full_name}: Update failed - ${updateError.message}`);
      continue;
    }

    totalFixed += entries.length;
    results.push(`${emp.full_name}: Fixed ${entries.length} off-day entries → active`);
  }

  results.push(`Total: Fixed ${totalFixed} entries`);

  return new Response(
    JSON.stringify({ success: true, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
