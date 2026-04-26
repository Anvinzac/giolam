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

  // ── Step 1: Fix null usernames by matching full_name ──
  const nameToUsername: Record<string, string> = {
    "Anh Cường": "anhcuong",
    "Chị Linh": "chilinh",
    "Chị Nụ": "chinu",
    "Chi Xuân": "chixuan",
    "Chị Trân": "chitran",
  };

  const { data: nullProfiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, username")
    .is("username", null);

  for (const p of (nullProfiles || [])) {
    const mapped = nameToUsername[p.full_name];
    if (mapped) {
      await supabase.from("profiles").update({ username: mapped }).eq("user_id", p.user_id);
      results.push(`🔧 Fixed username: ${p.full_name} → ${mapped}`);
    } else {
      results.push(`⚠️ Skipped null username: ${p.full_name} (no mapping)`);
    }
  }

  // ── Step 2: Create missing accounts (nbinh, ttu) ──
  const toCreate = [
    { username: "nbinh", full_name: "N. Bình", shift_type: "overtime", base_salary: 4500000, hourly_rate: 30000, default_clock_in: "17:00", default_clock_out: "22:00" },
    { username: "ttu", full_name: "T. Tư", shift_type: "notice_only", base_salary: 0, hourly_rate: 35000, default_clock_in: "08:00", default_clock_out: "17:30" },
  ];

  for (const emp of toCreate) {
    // Check if already exists now (maybe username was just fixed)
    const { data: existing } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("username", emp.username)
      .maybeSingle();

    if (existing) {
      results.push(`⏭️ ${emp.username} already exists, skipping creation`);
      continue;
    }

    const email = `${emp.username}@lunarflow.local`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: "temp12345",
      email_confirm: true,
      user_metadata: { full_name: emp.full_name },
    });

    if (authError) {
      results.push(`❌ Failed to create ${emp.username}: ${authError.message}`);
      continue;
    }

    if (authData?.user) {
      await supabase.from("profiles").update({
        username: emp.username,
        full_name: emp.full_name,
        shift_type: emp.shift_type,
        base_salary: emp.base_salary,
        hourly_rate: emp.hourly_rate,
        default_clock_in: emp.default_clock_in,
        default_clock_out: emp.default_clock_out,
        must_change_password: false,
      }).eq("user_id", authData.user.id);
      results.push(`✅ Created ${emp.username} (${emp.full_name})`);
    }
  }

  // ── Step 3: Update all passwords ──
  const passwordMap: Record<string, string> = {
    chithoa:  "ab123456",
    chithu:   "abcd1234",
    chioanh:  "abcde123",
    chinuong: "a1234567",
    chixuan:  "abc12345",
    coha:     "ab1234cd",
    anhcuong: "abcdef12",
    chichi:   "a12345bc",
    tphi:     "ab12cd34",
    ntruong:  "abc1de23",
    chinu:    "abcd12ef",
    chilinh:  "a1b2c3d4",
    chitran:  "abc1234d",
    ptuan:    "ab12345c",
    hthao:    "abc123de",
    vtuan:    "abcde1f2",
    mhieu:    "a12bc345",
    nhuyen:   "ab1c2d34",
    tphat:    "abcd1e2f",
    ghan:     "a1bcde23",
    nbinh:    "ab123cd4",
    ttu:      "abc12de3",
    qlam:     "a1b23c45",
    chiloan:  "abcde12f",
    thanhtu:  "a12cde34",
  };

  results.push("", "── Password updates ──");

  for (const [username, newPassword] of Object.entries(passwordMap)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .ilike("username", username)
      .maybeSingle();

    if (!profile) {
      results.push(`⚠️ ${username}: not found`);
      continue;
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: newPassword }
    );

    if (updateError) {
      results.push(`❌ ${username}: ${updateError.message}`);
    } else {
      results.push(`✅ ${username} → ${newPassword}`);
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
