import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const periodId = "b786c4bf-9bf9-4915-84df-114d11e55357";
  const startDate = new Date("2026-01-26");
  const endDate = new Date("2026-02-24");
  const offDays = ["2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05"];

  // Get all employees (non-admin)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username, shift_type, default_clock_in, default_clock_out")
    .not("username", "eq", "admin")
    .not("username", "is", null);

  if (!profiles?.length) {
    return new Response(JSON.stringify({ error: "No employees found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: string[] = [];

  for (const emp of profiles) {
    const shifts: any[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split("T")[0];
      const isOff = offDays.includes(dateStr);
      const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat

      // Activate ALL working days (off-days remain inactive)
      const isActive = !isOff;

      if (isActive) {
        // Set clock_in to default, leave clock_out null so only clock-out needs entry
        const baseIn = emp.default_clock_in || "08:00";

        const shift: any = {
          user_id: emp.user_id,
          period_id: periodId,
          shift_date: dateStr,
          is_active: true,
          clock_in: baseIn,
          clock_out: null,
        };

        // For overtime employees, also set main clock fields
        if (emp.shift_type === "overtime") {
          shift.main_clock_in = baseIn;
          shift.main_clock_out = null;
        }

        // Weekend notice
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          shift.notice = "Ca cuối tuần";
        }

        shifts.push(shift);
      }

      current.setDate(current.getDate() + 1);
    }

    // Batch upsert
    if (shifts.length > 0) {
      const { error } = await supabase.from("shifts").upsert(shifts, {
        onConflict: "user_id,shift_date",
      });
      if (error) {
        results.push(`Error for ${emp.username}: ${error.message}`);
      } else {
        results.push(`Seeded ${shifts.length} shifts for ${emp.username}`);
      }
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
