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

  // Varied passwords per employee (all 8 chars, easy to remember)
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
  };

  const results: string[] = [];

  for (const [username, newPassword] of Object.entries(passwordMap)) {
    // Find profile by username
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .ilike("username", username)
      .maybeSingle();

    if (profileError || !profile) {
      results.push(`⚠️ ${username}: not found`);
      continue;
    }

    // Update password via admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: newPassword }
    );

    if (updateError) {
      results.push(`❌ ${username}: ${updateError.message}`);
    } else {
      results.push(`✅ ${username} (${profile.full_name}): updated`);
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
