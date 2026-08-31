import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECEPTION_ID = "d0000000-0000-0000-0000-000000000002";

// Format a Date as YYYY-MM-DD using LOCAL time (not UTC).
// Using toISOString() here would shift dates by one day in UTC+7 (Vietnam).
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const TEST_ACCOUNTS = [
  { username: "nvienc", full_name: "N. Viên C", password: "ab12nv03", default_clock_in: "08:00", default_clock_out: "15:00" },
  { username: "nviend", full_name: "N. Viên D", password: "ab12nv04", default_clock_in: "15:00", default_clock_out: "22:00" },
];

function getNextMonday(from: Date): Date {
  const day = from.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const monday = new Date(from);
  monday.setDate(from.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateStr(d: Date): string {
  return localDateStr(d);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const results: string[] = [];

  // 1. Ensure test accounts exist as Reception employees
  for (const acc of TEST_ACCOUNTS) {
    const email = `${acc.username}@lunarflow.local`;

    // Try to find existing auth user by email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = (existingUsers?.users || []).find(
      (u: any) => u.email === email || u.user_metadata?.username === acc.username
    );

    let userId: string;

    if (existing) {
      userId = existing.id;
      results.push(`Found existing user: ${acc.username} (${userId})`);
      // Ensure password is correct
      await supabase.auth.admin.updateUserById(userId, { password: acc.password });
    } else {
      const { data: auth, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: acc.password,
        email_confirm: true,
        user_metadata: { full_name: acc.full_name, username: acc.username },
      });
      if (authError) {
        results.push(`Error creating ${acc.username}: ${authError.message}`);
        continue;
      }
      userId = auth.user!.id;
      results.push(`Created: ${acc.username} (${userId})`);
    }

    // Update profile to Reception department, basic shift type
    const { error: profileError } = await supabase.from("profiles").upsert({
      user_id: userId,
      full_name: acc.full_name,
      username: acc.username,
      department_id: RECEPTION_ID,
      shift_type: "basic",
      default_clock_in: acc.default_clock_in,
      default_clock_out: acc.default_clock_out,
      must_change_password: false,
    }, { onConflict: "user_id" });

    if (profileError) {
      results.push(`Profile update error for ${acc.username}: ${profileError.message}`);
    } else {
      results.push(`Profile updated: ${acc.username} → Reception, basic shift`);
    }
  }

  // 2. Seed shift_registrations for next 2 weeks
  const now = new Date();
  const nextMonday = getNextMonday(now);
  const weekAfterMonday = new Date(nextMonday);
  weekAfterMonday.setDate(nextMonday.getDate() + 7);

  const weeks = [nextMonday, weekAfterMonday];

  for (const acc of TEST_ACCOUNTS) {
    const email = `${acc.username}@lunarflow.local`;
    const { data: userList } = await supabase.auth.admin.listUsers();
    const user = (userList?.users || []).find(
      (u: any) => u.email === email || u.user_metadata?.username === acc.username
    );
    if (!user) {
      results.push(`Skipping registrations for ${acc.username}: user not found`);
      continue;
    }
    const userId = user.id;

    for (let w = 0; w < weeks.length; w++) {
      const weekDates = getWeekDates(weeks[w]);
      const rows: any[] = [];

      for (const d of weekDates) {
        const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

        // Skip weekends
        if (dayOfWeek === 0) continue;

        const sDate = dateStr(d);

        if (w === 0) {
          // Week 1 (next week): mix of statuses
          const slot = acc.default_clock_in && acc.default_clock_in.startsWith("08:")
            ? "morning" : acc.default_clock_in ? "afternoon" : "morning";
          if (dayOfWeek === 1) {
            // Monday — pending
            rows.push({
              user_id: userId,
              shift_date: sDate,
              shift_slot: slot,
              clock_in: acc.default_clock_in,
              clock_out: acc.default_clock_out,
              status: "pending",
            });
          } else if (dayOfWeek === 2) {
            // Tuesday — approved (admin confirmed)
            rows.push({
              user_id: userId,
              shift_date: sDate,
              shift_slot: slot,
              clock_in: acc.default_clock_in,
              clock_out: acc.default_clock_out,
              status: "approved",
              admin_clock_in: acc.default_clock_in,
              admin_clock_out: acc.default_clock_out,
              admin_note: "OK",
            });
          } else if (dayOfWeek === 3) {
            // Wednesday — rejected
            rows.push({
              user_id: userId,
              shift_date: sDate,
              shift_slot: slot,
              clock_in: acc.default_clock_in,
              clock_out: acc.default_clock_out,
              status: "rejected",
              admin_note: "Đủ người rồi",
            });
          } else if (dayOfWeek === 4) {
            // Thursday — modified
            rows.push({
              user_id: userId,
              shift_date: sDate,
              shift_slot: slot,
              clock_in: acc.default_clock_in,
              clock_out: acc.default_clock_out,
              status: "modified",
              admin_clock_in: acc.username === "nvienc" ? "08:30" : "15:30",
              admin_clock_out: acc.username === "nvienc" ? "14:30" : "21:30",
              admin_note: "Điều chỉnh giờ",
            });
          } else if (dayOfWeek === 5) {
            // Friday — pending (regular registration)
            rows.push({
              user_id: userId,
              shift_date: sDate,
              shift_slot: slot,
              clock_in: acc.default_clock_in,
              clock_out: acc.default_clock_out,
              status: "pending",
            });
          } else if (dayOfWeek === 6) {
            // Saturday — off day request (null clock_in/out)
            rows.push({
              user_id: userId,
              shift_date: sDate,
              shift_slot: "morning",
              clock_in: null,
              clock_out: null,
              status: "pending",
            });
          }
        } else {
          // Week 2 (week after next): all pending — so they can practice submitting
          if (dayOfWeek <= 5) {
            const slot = acc.default_clock_in && acc.default_clock_in.startsWith("08:")
              ? "morning" : acc.default_clock_in ? "afternoon" : "morning";
            rows.push({
              user_id: userId,
              shift_date: sDate,
              shift_slot: slot,
              clock_in: acc.default_clock_in,
              clock_out: acc.default_clock_out,
              status: "pending",
            });
          }
        }
      }

      if (rows.length > 0) {
        const { error } = await supabase.from("shift_registrations").upsert(rows, {
          onConflict: "user_id,shift_date,shift_slot",
        });
        if (error) {
          results.push(`Registration error for ${acc.username} week ${w + 1}: ${error.message}`);
        } else {
          results.push(`Seeded ${rows.length} registrations for ${acc.username} — week ${w + 1}`);
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
