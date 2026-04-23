import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const userId = claims.claims.sub as string;

  // Check admin role using service client
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await serviceClient.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { username, full_name, shift_type, default_clock_in, default_clock_out, department_id } = body;

    if (!username || !full_name) {
      return new Response(JSON.stringify({ error: "Username and full_name required" }), { status: 400, headers: corsHeaders });
    }

    const email = `${username}@lunarflow.local`;
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password: "abc12345",
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: corsHeaders });
    }

    if (authData?.user) {
      const newUserId = authData.user.id;
      await serviceClient.from("profiles").update({
        username,
        full_name,
        department_id: department_id || null,
        shift_type: shift_type || "basic",
        default_clock_in: default_clock_in || null,
        default_clock_out: default_clock_out || null,
        must_change_password: true,
      }).eq("user_id", newUserId);

      // Pre-activate every day of every existing period so the allowance/base
      // accrues by default. Two shift types need this:
      //   • overtime (Type B) — seeded with the default clock-in so the user
      //     only fills clock-out or toggles day-off. Skipped if no
      //     default_clock_in is set.
      //   • basic (Type A) — seeded as "working" (no clock times); the daily
      //     base + allowance rate applies automatically unless the day is
      //     later flipped to off.
      const resolvedShift = shift_type || "basic";
      const shouldPreActivate =
        resolvedShift === "basic" ||
        (resolvedShift === "overtime" && !!default_clock_in);

      if (shouldPreActivate) {
        const { data: periods } = await serviceClient
          .from("working_periods")
          .select("id, start_date, end_date");

        for (const period of periods || []) {
          // Ensure draft salary_record exists
          await serviceClient
            .from("salary_records")
            .upsert(
              { user_id: newUserId, period_id: period.id, status: "draft" },
              { onConflict: "user_id,period_id", ignoreDuplicates: true }
            );

          // Generate every date in the period
          const entries: any[] = [];
          const start = new Date(period.start_date + "T00:00:00Z");
          const end = new Date(period.end_date + "T00:00:00Z");
          const cur = new Date(start);
          while (cur <= end) {
            entries.push({
              user_id: newUserId,
              period_id: period.id,
              entry_date: cur.toISOString().slice(0, 10),
              sort_order: 0,
              is_day_off: false,
              // Type B gets its default clock-in preloaded; Type A doesn't
              // use clock times for base pay so leave it null.
              clock_in: resolvedShift === "overtime" ? default_clock_in : null,
              clock_out: null,
              is_admin_reviewed: true,
            });
            cur.setUTCDate(cur.getUTCDate() + 1);
          }

          if (entries.length) {
            await serviceClient
              .from("salary_entries")
              .upsert(entries, {
                onConflict: "user_id,period_id,entry_date,sort_order",
                ignoreDuplicates: true,
              });
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: authData?.user?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
});
