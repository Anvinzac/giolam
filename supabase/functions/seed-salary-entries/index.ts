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

  // Get the active period (contains today), or fall back to most recent
  const today = new Date().toISOString().split("T")[0];
  const { data: periods } = await supabase
    .from("working_periods")
    .select("*")
    .eq("is_archived", false)
    .lte("start_date", today)
    .gte("end_date", today)
    .limit(1);

  let period = (periods || [])[0];

  // Fallback: if no period covers today, grab the most recent one
  if (!period) {
    const { data: fallback } = await supabase
      .from("working_periods")
      .select("*")
      .eq("is_archived", false)
      .order("end_date", { ascending: false })
      .limit(1);
    period = (fallback || [])[0];
  }

  if (!period) {
    return new Response(JSON.stringify({ error: "No period found" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
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

  // Get special day rates for the period (include description for note text)
  const { data: ratesData } = await supabase
    .from("special_day_rates")
    .select("special_date, description_vi, rate_percent")
    .eq("period_id", periodId);
  const specialDateMap = new Map();
  (ratesData || []).forEach((r: any) => {
    specialDateMap.set(r.special_date, { description: r.description_vi, rate: r.rate_percent });
  });

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
        entriesToInsert.push({
          user_id: userId,
          period_id: periodId,
          entry_date: dateStr,
          sort_order: 0,
          is_day_off: false,
          off_percent: 0,
          note: null,
          clock_in: profile.default_clock_in || "08:00",
          clock_out: profile.default_clock_out || "17:30",
          is_admin_reviewed: true,
        });
      }
    } else if (profile.shift_type === "basic" || profile.shift_type === "daily") {
      // Type A/E: seed only special dates (rate > 0) that don't exist
      for (const [dateStr, info] of specialDateMap) {
        if (existingDates.has(dateStr)) continue;
        if (info.rate <= 0) continue;
        entriesToInsert.push({
          user_id: userId,
          period_id: periodId,
          entry_date: dateStr,
          sort_order: 0,
          is_day_off: false,
          note: info.description || null,
          is_admin_reviewed: true,
        });
      }
    } else if (profile.shift_type === "overtime") {
      // Type B: seed ALL dates — clock_in pre-filled, clock_out blank, special rate notes
      for (const dateStr of allDates) {
        if (existingDates.has(dateStr)) continue;
        const special = specialDateMap.get(dateStr);
        entriesToInsert.push({
          user_id: userId,
          period_id: periodId,
          entry_date: dateStr,
          sort_order: 0,
          is_day_off: false,
          off_percent: 0,
          note: special?.description || null,
          clock_in: profile.default_clock_in || "17:00",
          clock_out: null,
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

    // Seed employee allowances for Type B (gui_xe)
    if (profile.shift_type === "overtime") {
      const { data: existingAllowances } = await supabase
        .from("employee_allowances")
        .select("allowance_key")
        .eq("user_id", userId)
        .eq("period_id", periodId);
      const existingKeys = new Set((existingAllowances || []).map((a: any) => a.allowance_key));

      if (!existingKeys.has("gui_xe")) {
        const { error: allowErr } = await supabase.from("employee_allowances").insert({
          user_id: userId,
          period_id: periodId,
          allowance_key: "gui_xe",
          is_enabled: true,
          amount: 0,
        });
        if (allowErr) {
          results.push(`  ⚠️  Failed to seed gui_xe allowance: ${allowErr.message}`);
        } else {
          results.push(`  ✅ Seeded gui_xe allowance`);
        }
      } else {
        results.push(`  📋 gui_xe allowance already exists`);
      }
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
