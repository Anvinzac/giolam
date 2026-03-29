import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
}

function randomTime(minH: number, maxH: number): string {
  const h = minH + Math.floor(Math.random() * (maxH - minH));
  const m = Math.random() > 0.5 ? 30 : 0;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log("Starting salary test data seed...");

    // Get departments
    const { data: depts } = await supabase.from("departments").select("id, name");
    const kitchenId = depts?.find((d: any) => d.name === "Kitchen")?.id;
    const receptionId = depts?.find((d: any) => d.name === "Reception")?.id;

    // Create test employees
    const testEmployees = [
      {
        email: "test.typea@lunarflow.local",
        username: "test_loaia",
        full_name: "Nguyễn Văn A (Test)",
        shift_type: "basic",
        base_salary: 8400000,
        hourly_rate: 25000,
        department_id: kitchenId,
      },
      {
        email: "test.typeb@lunarflow.local",
        username: "test_loaib",
        full_name: "Trần Thị B (Test)",
        shift_type: "overtime",
        base_salary: 7000000,
        hourly_rate: 25000,
        department_id: kitchenId,
      },
      {
        email: "test.typec@lunarflow.local",
        username: "test_loaic",
        full_name: "Lê Văn C (Test)",
        shift_type: "notice_only",
        base_salary: 0,
        hourly_rate: 25000,
        department_id: receptionId,
      },
    ];

    const userIds: string[] = [];

    for (const emp of testEmployees) {
      // Check if user exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", emp.username)
        .maybeSingle();

      let userId: string;

      if (existingProfile) {
        userId = existingProfile.user_id;
        console.log(`User ${emp.username} already exists: ${userId}`);
      } else {
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email: emp.email,
          password: "abc12345",
          email_confirm: true,
        });
        if (authErr) {
          console.error(`Failed to create user ${emp.email}:`, authErr.message);
          continue;
        }
        userId = authData.user.id;
        console.log(`Created user ${emp.username}: ${userId}`);
      }

      // Update profile
      await supabase.from("profiles").update({
        username: emp.username,
        full_name: emp.full_name,
        shift_type: emp.shift_type,
        base_salary: emp.base_salary,
        hourly_rate: emp.hourly_rate,
        department_id: emp.department_id,
        must_change_password: false,
      }).eq("user_id", userId);

      userIds.push(userId);
    }

    // Create working period for Feb 25 - Mar 25 2026
    let periodId: string;
    const { data: existingPeriod } = await supabase
      .from("working_periods")
      .select("id")
      .eq("start_date", "2026-02-25")
      .eq("end_date", "2026-03-25")
      .maybeSingle();

    if (existingPeriod) {
      periodId = existingPeriod.id;
      console.log("Period already exists:", periodId);
    } else {
      const { data: newPeriod } = await supabase
        .from("working_periods")
        .insert({
          start_date: "2026-02-25",
          end_date: "2026-03-25",
          off_days: ["2026-03-23"],
        })
        .select()
        .single();
      periodId = newPeriod!.id;
      console.log("Created period:", periodId);
    }

    // Create special day rates
    const specialDays = [
      { date: "2026-02-28", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 },
      { date: "2026-03-01", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },
      { date: "2026-03-02", type: "day_before_full_moon", desc: "Trước Rằm + 15%", rate: 15 },
      { date: "2026-03-03", type: "full_moon", desc: "Rằm + 40%", rate: 40 },
      { date: "2026-03-07", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 },
      { date: "2026-03-08", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },
      { date: "2026-03-14", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 },
      { date: "2026-03-15", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },
      { date: "2026-03-18", type: "day_before_new_moon", desc: "Trước Mùng 1 + 15%", rate: 15 },
      { date: "2026-03-19", type: "new_moon", desc: "Mùng 1 + 40%", rate: 40 },
      { date: "2026-03-21", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 },
      { date: "2026-03-22", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },
    ];

    // Delete existing rates for this period first
    await supabase.from("special_day_rates").delete().eq("period_id", periodId);

    for (let i = 0; i < specialDays.length; i++) {
      const sd = specialDays[i];
      await supabase.from("special_day_rates").insert({
        period_id: periodId,
        special_date: sd.date,
        day_type: sd.type,
        description_vi: sd.desc,
        rate_percent: sd.rate,
        sort_order: i,
      });
    }
    console.log("Created special day rates");

    // Helper to find rate for a date
    const getRate = (date: string) => specialDays.find(s => s.date === date)?.rate ?? 0;

    // =========================================
    // Employee A entries (only special days)
    // =========================================
    if (userIds[0]) {
      await supabase.from("salary_entries").delete().eq("user_id", userIds[0]).eq("period_id", periodId);
      await supabase.from("employee_allowances").delete().eq("user_id", userIds[0]).eq("period_id", periodId);

      const dailyBaseA = roundToThousand(8400000 / 28); // 300000
      const entriesA = specialDays.map(sd => {
        const isOff = sd.date === "2026-03-23";
        const isHalfOff = false; // Feb-Mar range has no specific half-off for A
        const rate = sd.rate;
        const allowance = roundToThousand(dailyBaseA * rate / 100);
        const deduction = isOff ? dailyBaseA : isHalfOff ? roundToThousand(dailyBaseA * 50 / 100) : 0;
        return {
          user_id: userIds[0],
          period_id: periodId,
          entry_date: sd.date,
          sort_order: 0,
          is_day_off: isOff,
          off_percent: isOff ? 100 : isHalfOff ? 50 : 0,
          note: sd.date === "2026-03-07" ? "Tăng ca cuối tuần" : null,
          clock_in: null,
          clock_out: null,
          total_hours: null,
          allowance_rate_override: null,
          base_daily_wage: dailyBaseA,
          allowance_amount: isOff ? 0 : allowance,
          extra_wage: 0,
          total_daily_wage: isOff ? -deduction : isHalfOff ? dailyBaseA + allowance - deduction : dailyBaseA + allowance,
        };
      });

      await supabase.from("salary_entries").insert(entriesA);

      // Allowances for A
      await supabase.from("employee_allowances").insert([
        { user_id: userIds[0], period_id: periodId, allowance_key: "chuyen_can", label: "Chuyên cần", amount: 500000, is_enabled: true },
        { user_id: userIds[0], period_id: periodId, allowance_key: "nang_luc", label: "Năng lực", amount: 300000, is_enabled: true },
        { user_id: userIds[0], period_id: periodId, allowance_key: "gui_xe", label: "Gửi xe", amount: 0, is_enabled: false },
      ]);

      const totalA = entriesA.reduce((s, e) => s + e.total_daily_wage, 0) + 500000 + 300000;
      await supabase.from("salary_records").upsert({
        user_id: userIds[0], period_id: periodId, total_salary: totalA, status: "draft",
        salary_breakdown: { base_salary: 8400000, daily_base: dailyBaseA, total_daily_wages: entriesA.reduce((s, e) => s + e.total_daily_wage, 0), total_allowances_from_rates: entriesA.reduce((s, e) => s + e.allowance_amount, 0), total_deductions: 0, allowances: [{ key: "chuyen_can", label: "Chuyên cần", amount: 500000, enabled: true }, { key: "nang_luc", label: "Năng lực", amount: 300000, enabled: true }, { key: "gui_xe", label: "Gửi xe", amount: 0, enabled: false }], total: totalA },
      }, { onConflict: "user_id,period_id" });

      console.log("Created Employee A data");
    }

    // =========================================
    // Employee B entries (all 31 days)
    // =========================================
    if (userIds[1]) {
      await supabase.from("salary_entries").delete().eq("user_id", userIds[1]).eq("period_id", periodId);
      await supabase.from("employee_allowances").delete().eq("user_id", userIds[1]).eq("period_id", periodId);

      const dailyBaseB = roundToThousand(7000000 / 28); // 250000
      const entriesB = [];

      for (let d_it = new Date("2026-02-25T00:00:00"); d_it <= new Date("2026-03-25T00:00:00"); d_it.setDate(d_it.getDate() + 1)) {
        const date = d_it.toISOString().split('T')[0];
        const dow = d_it.getDay();
        const isOff = date === "2026-03-23";
        const isWeekend = dow === 0 || dow === 6;
        const rate = getRate(date);
        const allowance = roundToThousand(dailyBaseB * rate / 100);
        const hasOT = isWeekend && !isOff;
        const hours = hasOT ? (1 + Math.floor(Math.random() * 3) + (Math.random() > 0.5 ? 0.5 : 0)) : 0;
        const extraWage = roundToThousand(hours * 25000);

        entriesB.push({
          user_id: userIds[1],
          period_id: periodId,
          entry_date: date,
          sort_order: 0,
          is_day_off: isOff,
          off_percent: isOff ? 100 : 0,
          note: isOff ? "Nghỉ" : null,
          clock_in: null,
          clock_out: hasOT ? randomTime(18, 21) : null,
          total_hours: hours > 0 ? hours : null,
          allowance_rate_override: null,
          base_daily_wage: dailyBaseB,
          allowance_amount: isOff ? 0 : allowance,
          extra_wage: extraWage,
          total_daily_wage: isOff ? 0 : dailyBaseB + allowance + extraWage,
        });
      }

      // Add duplicate rows for special days with OT
      for (const dupDate of ["2026-03-03", "2026-03-19"]) {
        const rate = getRate(dupDate);
        const allowance = roundToThousand(dailyBaseB * rate / 100);
        const hours = 2;
        const extraWage = roundToThousand(hours * 25000);
        entriesB.push({
          user_id: userIds[1],
          period_id: periodId,
          entry_date: dupDate,
          sort_order: 1,
          is_day_off: false,
          off_percent: 0,
          note: "Ca thêm",
          clock_in: null,
          clock_out: "20:00",
          total_hours: hours,
          allowance_rate_override: null,
          base_daily_wage: 0,
          allowance_amount: allowance,
          extra_wage: extraWage,
          total_daily_wage: allowance + extraWage,
        });
      }

      await supabase.from("salary_entries").insert(entriesB);

      await supabase.from("employee_allowances").insert([
        { user_id: userIds[1], period_id: periodId, allowance_key: "chuyen_can", label: "Chuyên cần", amount: 500000, is_enabled: true },
        { user_id: userIds[1], period_id: periodId, allowance_key: "nang_luc", label: "Năng lực", amount: 0, is_enabled: false },
        { user_id: userIds[1], period_id: periodId, allowance_key: "gui_xe", label: "Gửi xe", amount: 200000, is_enabled: true },
      ]);

      const totalB = entriesB.reduce((s, e) => s + e.total_daily_wage, 0) + 500000 + 200000;
      await supabase.from("salary_records").upsert({
        user_id: userIds[1], period_id: periodId, total_salary: totalB, status: "draft",
        salary_breakdown: { base_salary: 7000000, daily_base: dailyBaseB, total_daily_wages: entriesB.reduce((s, e) => s + e.total_daily_wage, 0), total_allowances_from_rates: entriesB.reduce((s, e) => s + e.allowance_amount, 0), total_deductions: 0, allowances: [{ key: "chuyen_can", label: "Chuyên cần", amount: 500000, enabled: true }, { key: "nang_luc", label: "Năng lực", amount: 0, enabled: false }, { key: "gui_xe", label: "Gửi xe", amount: 200000, enabled: true }], total: totalB },
      }, { onConflict: "user_id,period_id" });

      console.log("Created Employee B data");
    }

    // =========================================
    // Employee C entries (March 5-25, partial)
    // =========================================
    if (userIds[2]) {
      await supabase.from("salary_entries").delete().eq("user_id", userIds[2]).eq("period_id", periodId);
      await supabase.from("employee_allowances").delete().eq("user_id", userIds[2]).eq("period_id", periodId);

      const entriesC = [];
      const offDaysC = new Set(["2026-03-23"]);

      for (let d_it = new Date("2026-02-25T00:00:00"); d_it <= new Date("2026-03-15T00:00:00"); d_it.setDate(d_it.getDate() + 1)) {
        const date = d_it.toISOString().split('T')[0];
        const isOff = offDaysC.has(date);
        const rate = getRate(date);
        const clockIn = isOff ? null : randomTime(8, 10);
        const clockOut = isOff ? null : randomTime(14, 18);

        let hours = 0;
        if (clockIn && clockOut) {
          const [h1, m1] = clockIn.split(":").map(Number);
          const [h2, m2] = clockOut.split(":").map(Number);
          hours = Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 30) * 0.5;
        }

        const baseWage = roundToThousand(hours * 25000);
        const allowanceAmt = roundToThousand(baseWage * rate / 100);

        entriesC.push({
          user_id: userIds[2],
          period_id: periodId,
          entry_date: date,
          sort_order: 0,
          is_day_off: isOff,
          off_percent: 0,
          note: isOff ? "Nghỉ" : null,
          clock_in: clockIn,
          clock_out: clockOut,
          total_hours: hours > 0 ? hours : null,
          allowance_rate_override: null,
          base_daily_wage: 0,
          allowance_amount: allowanceAmt,
          extra_wage: baseWage,
          total_daily_wage: isOff ? 0 : baseWage + allowanceAmt,
        });
      }

      await supabase.from("salary_entries").insert(entriesC);

      await supabase.from("employee_allowances").insert([
        { user_id: userIds[2], period_id: periodId, allowance_key: "chuyen_can", label: "Chuyên cần", amount: 300000, is_enabled: true },
        { user_id: userIds[2], period_id: periodId, allowance_key: "nang_luc", label: "Năng lực", amount: 0, is_enabled: false },
        { user_id: userIds[2], period_id: periodId, allowance_key: "gui_xe", label: "Gửi xe", amount: 0, is_enabled: false },
      ]);

      const totalC = entriesC.reduce((s, e) => s + e.total_daily_wage, 0) + 300000;
      await supabase.from("salary_records").upsert({
        user_id: userIds[2], period_id: periodId, total_salary: totalC, status: "draft",
        salary_breakdown: { base_salary: 0, daily_base: 0, total_daily_wages: entriesC.reduce((s, e) => s + e.total_daily_wage, 0), total_allowances_from_rates: entriesC.reduce((s, e) => s + e.allowance_amount, 0), total_deductions: 0, allowances: [{ key: "chuyen_can", label: "Chuyên cần", amount: 300000, enabled: true }, { key: "nang_luc", label: "Năng lực", amount: 0, enabled: false }, { key: "gui_xe", label: "Gửi xe", amount: 0, enabled: false }], total: totalC },
      }, { onConflict: "user_id,period_id" });

      console.log("Created Employee C data");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test salary data created successfully",
        userIds,
        periodId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Seed error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
