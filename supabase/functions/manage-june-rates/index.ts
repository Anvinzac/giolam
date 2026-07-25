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

  // Find period containing June 2026 dates (start_date <= 2026-06-28 and end_date >= 2026-06-30)
  const { data: period, error: pErr } = await supabase
    .from("working_periods")
    .select("id, start_date, end_date")
    .lte("start_date", "2026-06-28")
    .gte("end_date", "2026-06-30")
    .maybeSingle();

  if (!period) {
    return new Response(
      JSON.stringify({ error: "Period not found", pErr }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const periodId = period.id;

  // 1. Remove July 15th
  const { error: err15 } = await supabase
    .from("special_day_rates")
    .delete()
    .eq("period_id", periodId)
    .eq("special_date", "2026-07-15");
  if (err15) results.push(`❌ Error removing 2026-07-15: ${err15.message}`);
  else results.push("✅ Removed 2026-07-15 from special rates");

  // 2. Set July 14 to New Moon (40%)
  const { data: existing14 } = await supabase
    .from("special_day_rates")
    .select("id")
    .eq("period_id", periodId)
    .eq("special_date", "2026-07-14")
    .maybeSingle();

  if (existing14) {
    const { error: err14 } = await supabase
      .from("special_day_rates")
      .update({
        day_type: "new_moon",
        description_vi: "Mùng 1 + 40%",
        rate_percent: 40,
      })
      .eq("id", existing14.id);
    if (err14) results.push(`❌ Error updating 2026-07-14: ${err14.message}`);
    else results.push("✅ Updated 2026-07-14: Mùng 1 + 40%");
  } else {
    const { error: err14 } = await supabase.from("special_day_rates").insert({
      period_id: periodId,
      special_date: "2026-07-14",
      day_type: "new_moon",
      description_vi: "Mùng 1 + 40%",
      rate_percent: 40,
      sort_order: 3,
    });
    if (err14) results.push(`❌ Error inserting 2026-07-14: ${err14.message}`);
    else results.push("✅ Inserted 2026-07-14: Mùng 1 + 40%");
  }

  // 3. Set July 13 to Day Before New Moon (30%)
  const { data: existing13 } = await supabase
    .from("special_day_rates")
    .select("id")
    .eq("period_id", periodId)
    .eq("special_date", "2026-07-13")
    .maybeSingle();

  if (existing13) {
    const { error: err13 } = await supabase
      .from("special_day_rates")
      .update({
        day_type: "day_before_new_moon",
        description_vi: "30AL + 15%",
        rate_percent: 15,
      })
      .eq("id", existing13.id);
    if (err13) results.push(`❌ Error updating 2026-07-13: ${err13.message}`);
    else results.push("✅ Updated 2026-07-13: 30AL + 15%");
  } else {
    const { error: err13 } = await supabase.from("special_day_rates").insert({
      period_id: periodId,
      special_date: "2026-07-13",
      day_type: "day_before_new_moon",
      description_vi: "30AL + 15%",
      rate_percent: 15,
      sort_order: 4,
    });
    if (err13) results.push(`❌ Error inserting 2026-07-13: ${err13.message}`);
    else results.push("✅ Inserted 2026-07-13: 30AL + 15%");
  }

  // Fetch updated rates for confirmation
  const { data: updatedRates } = await supabase
    .from("special_day_rates")
    .select("*")
    .eq("period_id", periodId)
    .order("special_date", { ascending: true });

  return new Response(
    JSON.stringify({ success: true, results, updatedRates }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
