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

  // Get the active period (contains today)
  const today = new Date().toISOString().split("T")[0];
  const { data: periods } = await supabase
    .from("working_periods")
    .select("*")
    .eq("is_archived", false)
    .lte("start_date", today)
    .gte("end_date", today)
    .limit(1);

  if (!periods || periods.length === 0) {
    return new Response(JSON.stringify({ error: "No active period found" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const period = periods[0];
  const periodId = period.id;
  results.push(`📅 Using period: ${period.start_date} → ${period.end_date}`);

  // Generate all dates in the period
  const allDates: string[] = [];
  const start = new Date(period.start_date + "T00:00:00");
  const end = new Date(period.end_date + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    allDates.push(dateStr);
  }

  const offDaySet = new Set((period.off_days || []) as string[]);

  // Get special day rates for the period
  const { data: ratesData } = await supabase
    .from("special_day_rates")
    .select("special_date")
    .eq("period_id", periodId);
  const specialDates = new Set((ratesData || []).map((r: any) => r.special_date));

  // Seed salary entries for nvienc and nviend
  const accounts = ["nvienc", "nviend"];

  for (const username of accounts) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, shift_type, default_clock_in, default_clock_out")
      .eq("username", username)
      .maybeSingle();

    if (!profile) {
      results.push(`⚠️  ${username}: profile not found`);
      continue;
    }

    const userId = profile.user_id;
    results.push(`\n👤 ${username} (shift_type=${profile.shift_type}):`);

    // Ensure salary_records exists
    const { data: existingRecord } = await supabase
      .from("salary_records")
      .select("id, status")
      .eq("user_id", userId)
      .eq("period_id", periodId)
      .maybeSingle();

    if (!existingRecord) {
      await supabase.from("salary_records").insert({
        user_id: userId,
        period_id: periodId,
        total_salary: 0,
        status: "draft",
      });
      results.push(`  ✅ Created draft salary record`);
    } else {
      results.push(`  📋 Existing salary record: status=${existingRecord.status}`);
    }

    // Get existing entries
    const { data: existingEntries } = await supabase
      .from("salary_entries")
      .select("entry_date")
      .eq("user_id", userId)
      .eq("period_id", periodId);
    const existingDates = new Set((existingEntries || []).map((e: any) => e.entry_date));

    // Seed entries based on shift type
    const entriesToInsert: any[] = [];

    if (profile.shift_type === "notice_only" || profile.shift_type === "lunar_rate") {
      // Type C/D: seed ALL dates in the period with default clock times
      for (const dateStr of allDates) {
        if (existingDates.has(dateStr)) continue;
        const isOff = offDaySet.has(dateStr);
        entriesToInsert.push({
          user_id: userId,
          period_id: periodId,
          entry_date: dateStr,
          sort_order: 0,
          is_day_off: isOff,
          off_percent: isOff ? 100 : 0,
          note: isOff ? "Nghỉ" : null,
          clock_in: isOff ? null : (profile.default_clock_in || "08:00"),
          clock_out: isOff ? null : (profile.default_clock_out || "17:30"),
          is_admin_reviewed: true,
        });
      }
    } else if (profile.shift_type === "basic" || profile.shift_type === "daily") {
      // Type A: seed only special dates that don't exist
      for (const dateStr of specialDates) {
        if (existingDates.has(dateStr)) continue;
        entriesToInsert.push({
          user_id: userId,
          period_id: periodId,
          entry_date: dateStr,
          sort_order: 0,
          is_day_off: false,
          is_admin_reviewed: true,
        });
      }
    } else if (profile.shift_type === "overtime") {
      // Type B: seed ALL dates with clock times
      for (const dateStr of allDates) {
        if (existingDates.has(dateStr)) continue;
        const isOff = offDaySet.has(dateStr);
        entriesToInsert.push({
          user_id: userId,
          period_id: periodId,
          entry_date: dateStr,
          sort_order: 0,
          is_day_off: isOff,
          off_percent: isOff ? 100 : 0,
          note: isOff ? "Nghỉ" : null,
          clock_in: isOff ? null : (profile.default_clock_in || "17:00"),
          clock_out: isOff ? null : (profile.default_clock_out || "22:00"),
          is_admin_reviewed: true,
        });
      }
    }

    if (entriesToInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from("salary_entries")
        .insert(entriesToInsert)
        .select();
      if (error) {
        results.push(`  ❌ Failed to seed entries: ${error.message}`);
      } else {
        results.push(`  ✅ Seeded ${inserted?.length || 0} salary entries`);
      }
    } else {
      results.push(`  ⏭️  No new entries needed`);
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
