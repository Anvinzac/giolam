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

  // Find tphi
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, base_salary, hourly_rate")
    .ilike("username", "tphi")
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: "tphi not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find the current period
  const { data: periods } = await supabase
    .from("working_periods")
    .select("id")
    .order("end_date", { ascending: false })
    .limit(1);

  const periodId = periods?.[0]?.id;
  if (!periodId) {
    return new Response(JSON.stringify({ error: "No period" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const DATE = "2026-03-28";

  // Find existing entry for Apr 28
  const { data: existing } = await supabase
    .from("salary_entries")
    .select("*")
    .eq("user_id", profile.user_id)
    .eq("period_id", periodId)
    .eq("entry_date", DATE)
    .order("sort_order");

  results.push(`Existing entries on ${DATE}: ${existing?.length || 0}`);
  for (const e of (existing || [])) {
    results.push(`  sort_order=${e.sort_order}, hours=${e.total_hours}, note=${e.note}, rate=${e.allowance_rate_override}`);
  }

  // Update sort_order=0 to be a normal working day with 15% rate
  const row0 = existing?.find(e => e.sort_order === 0);
  if (row0) {
    await supabase
      .from("salary_entries")
      .update({
        is_day_off: false,
        total_hours: null,
        allowance_rate_override: 15,
        note: null,
        is_admin_reviewed: true,
      })
      .eq("id", row0.id);
    results.push(`✅ Updated row 0: normal day 15%`);
  } else {
    await supabase
      .from("salary_entries")
      .insert({
        user_id: profile.user_id,
        period_id: periodId,
        entry_date: DATE,
        sort_order: 0,
        is_day_off: false,
        off_percent: 0,
        total_hours: null,
        allowance_rate_override: 15,
        note: null,
        clock_in: null,
        clock_out: null,
        base_daily_wage: 0,
        allowance_amount: 0,
        extra_wage: 0,
        total_daily_wage: 0,
        is_admin_reviewed: true,
      });
    results.push(`✅ Created row 0: normal day 15%`);
  }

  // Check if sort_order=1 already exists
  const row1 = existing?.find(e => e.sort_order === 1);
  if (row1) {
    // Update it
    await supabase
      .from("salary_entries")
      .update({
        is_day_off: false,
        total_hours: -3.5,
        allowance_rate_override: null,
        note: "Về sớm -3.5h",
        is_admin_reviewed: true,
      })
      .eq("id", row1.id);
    results.push(`✅ Updated row 1: -3.5h early leave`);
  } else {
    // Insert new row
    await supabase
      .from("salary_entries")
      .insert({
        user_id: profile.user_id,
        period_id: periodId,
        entry_date: DATE,
        sort_order: 1,
        is_day_off: false,
        off_percent: 0,
        total_hours: -3.5,
        allowance_rate_override: null,
        note: "Về sớm -3.5h",
        clock_in: null,
        clock_out: null,
        base_daily_wage: 0,
        allowance_amount: 0,
        extra_wage: 0,
        total_daily_wage: 0,
        is_admin_reviewed: true,
      });
    results.push(`✅ Created row 1: -3.5h early leave`);
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
