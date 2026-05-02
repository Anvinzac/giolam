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

  // Get the period and its off_days
  const { data: periods } = await supabase
    .from("working_periods")
    .select("id, off_days")
    .order("end_date", { ascending: false })
    .limit(1);

  const period = periods?.[0];
  if (!period || !period.off_days?.length) {
    return new Response(JSON.stringify({ error: "No period or off_days found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  results.push(`Period: ${period.id}, off_days: ${JSON.stringify(period.off_days)}`);

  // Get all Type B employee IDs
  const { data: typeBProfiles } = await supabase
    .from("profiles")
    .select("user_id, username")
    .eq("shift_type", "overtime");

  const userIds = (typeBProfiles || []).map(p => p.user_id);
  results.push(`Type B employees: ${typeBProfiles?.map(p => p.username).join(", ")}`);

  // Find active entries on off_days for Type B employees
  const { data: badEntries } = await supabase
    .from("salary_entries")
    .select("id, user_id, entry_date, is_day_off")
    .in("user_id", userIds)
    .eq("period_id", period.id)
    .in("entry_date", period.off_days)
    .eq("is_day_off", false);

  results.push(`Active entries on off_days: ${badEntries?.length || 0}`);
  for (const e of (badEntries || [])) {
    const p = typeBProfiles?.find(x => x.user_id === e.user_id);
    results.push(`  → ${p?.username} on ${e.entry_date}`);
  }

  if (badEntries && badEntries.length > 0) {
    const { error } = await supabase
      .from("salary_entries")
      .update({
        is_day_off: true,
        clock_in: null,
        clock_out: null,
        total_hours: null,
        is_admin_reviewed: true,
      })
      .in("id", badEntries.map(e => e.id));

    results.push(error ? `❌ ${error.message}` : `✅ Fixed ${badEntries.length} entries`);
  } else {
    results.push("Nothing to fix.");
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
