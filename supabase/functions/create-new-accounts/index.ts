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

  const PASSWORD = "l@123456";

  const newEmployees = [
    {
      username: "anhkhanh",
      full_name: "Anh Khánh",
      shift_type: "daily", // Type E
      default_clock_in: "17:00",
      default_clock_out: "22:00",
      base_salary: 0,
      hourly_rate: 25000,
    },
    {
      username: "codung",
      full_name: "Cô Dung",
      shift_type: "basic", // Type A
      default_clock_in: "17:00",
      default_clock_out: "22:00",
      base_salary: 4800000,
      hourly_rate: 25000,
    },
    {
      username: "maiyen",
      full_name: "Mai Yến",
      shift_type: "notice_only", // Type C
      default_clock_in: "08:00",
      default_clock_out: "17:30",
      base_salary: 0,
      hourly_rate: 35000,
    },
  ];

  const results: string[] = [];

  for (const emp of newEmployees) {
    const email = `${emp.username}@lunarflow.local`;

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", emp.username)
      .maybeSingle();

    let userId: string | null = existingProfile?.user_id || null;

    if (!userId) {
      // Check auth users
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: emp.full_name },
      });

      if (authError) {
        // If email exists in auth but profile didn't match
        const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
        });
        const body = await resp.json();
        const allUsers = body.users || body || [];
        const found = Array.isArray(allUsers) ? allUsers.find((u: any) => u.email === email) : null;
        if (found) {
          userId = found.id;
          await supabase.auth.admin.updateUserById(userId, { password: PASSWORD, user_metadata: { full_name: emp.full_name } });
          results.push(`Found existing auth user for ${emp.username}: ${userId}`);
        } else {
          results.push(`❌ Error creating ${emp.username}: ${authError.message}`);
          continue;
        }
      } else if (authData?.user) {
        userId = authData.user.id;
        results.push(`✅ Created auth user for ${emp.username}: ${userId}`);
      }
    } else {
      // Update password & user_metadata for existing user
      await supabase.auth.admin.updateUserById(userId, { password: PASSWORD, user_metadata: { full_name: emp.full_name } });
      results.push(`Updated existing user password and metadata for ${emp.username}: ${userId}`);
    }

    if (userId) {
      // Update profile
      const { error: profErr } = await supabase.from("profiles").upsert({
        user_id: userId,
        username: emp.username,
        full_name: emp.full_name,
        shift_type: emp.shift_type,
        default_clock_in: emp.default_clock_in,
        default_clock_out: emp.default_clock_out,
        base_salary: emp.base_salary,
        hourly_rate: emp.hourly_rate,
        must_change_password: false,
      }, { onConflict: "user_id" });

      if (profErr) {
        results.push(`❌ Profile update failed for ${emp.username}: ${profErr.message}`);
      } else {
        results.push(`✅ Profile set for ${emp.username} (${emp.full_name}, ${emp.shift_type})`);
      }

      // Pre-activate period entries
      const resolvedShift = emp.shift_type;
      const shouldPreActivate = resolvedShift === "basic" || resolvedShift === "daily" || resolvedShift === "overtime";
      if (shouldPreActivate) {
        const { data: periods } = await supabase
          .from("working_periods")
          .select("id, start_date, end_date");

        for (const period of periods || []) {
          await supabase
            .from("salary_records")
            .upsert(
              { user_id: userId, period_id: period.id, status: "draft" },
              { onConflict: "user_id,period_id", ignoreDuplicates: true }
            );

          const entries: any[] = [];

          if (resolvedShift === "basic" || resolvedShift === "daily") {
            // Type A/E: seed only dates from special_day_rates with rate > 0
            const { data: rates } = await supabase
              .from("special_day_rates")
              .select("special_date, description_vi, rate_percent")
              .eq("period_id", period.id)
              .gt("rate_percent", 0);

            for (const rate of (rates || [])) {
              entries.push({
                user_id: userId,
                period_id: period.id,
                entry_date: rate.special_date,
                sort_order: 0,
                is_day_off: false,
                note: rate.description_vi || null,
                is_admin_reviewed: true,
              });
            }
          } else {
            // Type B (overtime): seed all dates with clock_in pre-filled
            const start = new Date(period.start_date + "T00:00:00Z");
            const end = new Date(period.end_date + "T00:00:00Z");
            const cur = new Date(start);
            const defaultIn = emp.default_clock_in || "17:00";
            while (cur <= end) {
              entries.push({
                user_id: userId,
                period_id: period.id,
                entry_date: cur.toISOString().slice(0, 10),
                sort_order: 0,
                is_day_off: false,
                clock_in: defaultIn,
                clock_out: null,
                is_admin_reviewed: true,
              });
              cur.setUTCDate(cur.getUTCDate() + 1);
            }
          }

          if (entries.length) {
            await supabase
              .from("salary_entries")
              .upsert(entries, {
                onConflict: "user_id,period_id,entry_date,sort_order",
                ignoreDuplicates: true,
              });
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true, results, password: PASSWORD }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
