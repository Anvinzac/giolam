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

  // Step 1: Create or find the test accounts
  const testAccounts = [
    { username: "nviena", full_name: "N. Viên A", password: "ab12nv01" },
    { username: "nvienc", full_name: "N. Viên C", password: "ab12nv03" },
    { username: "nviend", full_name: "N. Viên D", password: "ab12nv04" },
  ];

  const userMap: Record<string, string> = {};

  for (const acc of testAccounts) {
    // Check if profile already has this username
    const { data: existing } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", acc.username)
      .maybeSingle();

    if (existing) {
      userMap[acc.username] = existing.user_id;
      results.push(`✅ Found existing account: ${acc.username}`);
      continue;
    }

    // Check if there's a profile with this full_name but null username (from fix-test-accounts)
    const { data: nullUsername } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("full_name", acc.full_name)
      .is("username", null)
      .maybeSingle();

    if (nullUsername) {
      await supabase
        .from("profiles")
        .update({ username: acc.username, must_change_password: false })
        .eq("user_id", nullUsername.user_id);

      await supabase.auth.admin.updateUserById(nullUsername.user_id, {
        password: acc.password,
      });

      userMap[acc.username] = nullUsername.user_id;
      results.push(`🔧 Fixed null-username account: ${acc.username}`);
      continue;
    }

    // Create new auth user
    const email = `${acc.username}@lunarflow.local`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { full_name: acc.full_name },
    });

    if (authError) {
      results.push(`❌ Failed to create ${acc.username}: ${authError.message}`);
      continue;
    }

    if (authData?.user) {
      // Insert or update profile
      await supabase.from("profiles").upsert({
        user_id: authData.user.id,
        username: acc.username,
        full_name: acc.full_name,
        shift_type: "basic",
        must_change_password: false,
      }, { onConflict: "user_id" });

      userMap[acc.username] = authData.user.id;
      results.push(`✅ Created new account: ${acc.username}`);
    }
  }

  // Step 2: Assign ingredients to each employee
  const ingredientAssignments: Record<string, string[]> = {
    nviena: ["v1", "v2", "v3", "v4", "v5", "s1", "s2", "s3", "g1", "g2", "p1", "p2", "o1"],
    nvienc: ["v6", "v7", "v8", "v9", "v10", "s4", "s5", "s6", "g3", "g4", "p3", "p4", "o2"],
    nviend: ["v11", "v12", "v13", "v14", "v15", "s7", "s8", "s9", "g5", "g6", "p5", "p6", "o3", "sp1", "sp2"],
  };

  for (const [username, ingredientIds] of Object.entries(ingredientAssignments)) {
    const userId = userMap[username];
    if (!userId) {
      results.push(`⚠️  Skipping ingredient assignment for ${username} (no user ID)`);
      continue;
    }

    for (const ingredientId of ingredientIds) {
      const { error } = await supabase.from("employee_ingredients").upsert({
        employee_id: userId,
        ingredient_id: ingredientId,
      }, { onConflict: "employee_id,ingredient_id", ignoreDuplicates: true });

      if (error) {
        results.push(`❌ Failed to assign ${ingredientId} to ${username}: ${error.message}`);
      }
    }
    results.push(`📦 Assigned ${ingredientIds.length} ingredients to ${username}`);
  }

  // Step 3: Create stock reports with sample data
  const now = new Date();
  const reportsPerUser = 5;

  const reportTemplates: Record<string, Array<{ ingredientId: string; remaining: number; warning: string; lowStock: boolean }>> = {
    nviena: [
      { ingredientId: "v1", remaining: 3.5, warning: "Sắp hết, cần nhập thêm", lowStock: true },
      { ingredientId: "v2", remaining: 12, warning: "", lowStock: false },
      { ingredientId: "s1", remaining: 1, warning: "Chỉ còn 1 chai nước mắm", lowStock: true },
      { ingredientId: "g1", remaining: 25, warning: "", lowStock: false },
      { ingredientId: "p1", remaining: 2, warning: "Thịt heo sắp hết, cần mua thêm 5kg", lowStock: true },
    ],
    nvienc: [
      { ingredientId: "v6", remaining: 8, warning: "", lowStock: false },
      { ingredientId: "v7", remaining: 0.5, warning: "Xà lách gần hết!", lowStock: true },
      { ingredientId: "s4", remaining: 3, warning: "", lowStock: false },
      { ingredientId: "g3", remaining: 10, warning: "", lowStock: false },
      { ingredientId: "p3", remaining: 1, warning: "Gà còn ít, cần đặt thêm", lowStock: true },
    ],
    nviend: [
      { ingredientId: "v11", remaining: 5, warning: "", lowStock: false },
      { ingredientId: "v12", remaining: 2, warning: "Hành tím sắp hết", lowStock: true },
      { ingredientId: "s7", remaining: 10, warning: "", lowStock: false },
      { ingredientId: "sp1", remaining: 0.2, warning: "Tiêu gần hết!", lowStock: true },
      { ingredientId: "sp2", remaining: 1, warning: "Hành khô cần bổ sung", lowStock: true },
    ],
  };

  for (const [username, reports] of Object.entries(reportTemplates)) {
    const userId = userMap[username];
    if (!userId) {
      results.push(`⚠️  Skipping reports for ${username} (no user ID)`);
      continue;
    }

    // Clear existing reports for this user this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    await supabase
      .from("stock_reports")
      .delete()
      .eq("reported_by", userId)
      .gte("reported_at", monthStart);

    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      const reportedAt = new Date(now.getTime() - (i * 2 * 60 * 60 * 1000)).toISOString();

      const { error } = await supabase.from("stock_reports").insert({
        ingredient_id: r.ingredientId,
        reported_by: userId,
        remaining_quantity: r.remaining,
        warning_message: r.warning,
        is_low_stock: r.lowStock,
        reported_at: reportedAt,
      });

      if (error) {
        results.push(`❌ Failed to create report for ${username} ${r.ingredientId}: ${error.message}`);
      }
    }
    results.push(`📝 Created ${reports.length} stock reports for ${username}`);
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
