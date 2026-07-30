import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECEPTION_ID = "d0000000-0000-0000-0000-000000000002";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const results: string[] = [];

  // Step 1: Add 'other' to shift_type enum
  const { error: enumError } = await supabase.rpc("exec_sql", {
    sql: "ALTER TYPE public.shift_type ADD VALUE IF NOT EXISTS 'other';",
  });

  if (enumError) {
    // If exec_sql doesn't exist, try raw query via REST
    const { error: directError } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    if (directError) {
      results.push(`❌ Cannot reach database: ${directError.message}`);
    } else {
      results.push("⚠️ exec_sql RPC not available, trying direct approach...");
      // The enum might already have 'other' if added manually
      results.push("⏭️ Assuming 'other' enum exists or will be added by migration");
    }
  } else {
    results.push("✅ Added 'other' to shift_type enum");
  }

  // Step 2: Update cloan and chiloan to 'other'
  for (const username of ["cloan", "chiloan"]) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name, shift_type")
      .ilike("username", username)
      .maybeSingle();

    if (!profile) {
      results.push(`⚠️ ${username}: profile not found`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ shift_type: "other", department_id: null })
      .eq("user_id", profile.user_id);

    if (updateError) {
      results.push(`❌ ${username}: ${updateError.message}`);
    } else {
      results.push(`✅ ${username} (${profile.full_name}): shift_type → other, department → null`);
    }
  }

  // Step 3: Create minhvu, minhanh, huukhang as Type D (lunar_rate)
  const newAccounts = [
    { username: "minhvu", full_name: "Minh Vũ", password: "minhvu123" },
    { username: "minhanh", full_name: "Minh Anh", password: "minhanh123" },
    { username: "huukhang", full_name: "Hữu Khang", password: "huukhang123" },
  ];

  for (const acc of newAccounts) {
    const email = `${acc.username}@lunarflow.local`;

    // Check if already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = (existingUsers?.users || []).find(
      (u: any) => u.email === email
    );

    if (existing) {
      // Update to lunar_rate
      await supabase.from("profiles")
        .update({ shift_type: "lunar_rate", department_id: RECEPTION_ID, must_change_password: false })
        .eq("user_id", existing.id);
      results.push(`⏭️ ${acc.username} already exists, updated to lunar_rate + Reception`);
      continue;
    }

    const { data: auth, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { full_name: acc.full_name, username: acc.username },
    });

    if (authError) {
      results.push(`❌ ${acc.username}: ${authError.message}`);
      continue;
    }

    if (auth?.user) {
      await supabase.from("profiles").update({
        username: acc.username,
        full_name: acc.full_name,
        shift_type: "lunar_rate",
        department_id: RECEPTION_ID,
        must_change_password: false,
      }).eq("user_id", auth.user.id);

      results.push(`✅ Created ${acc.username} (${acc.full_name}) — lunar_rate`);
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
