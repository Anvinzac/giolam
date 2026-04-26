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

  // Find the auth user — search all users for nbinh
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 });
  const allEmails = users?.users?.map(u => `${u.email} (${u.id})`) || [];
  results.push(`All auth users: ${JSON.stringify(allEmails)}`);
  
  const nbinhAuth = users?.users?.find(u => u.email?.includes("nbinh"));
  results.push(`nbinh match: ${nbinhAuth ? `${nbinhAuth.id} ${nbinhAuth.email}` : "none"}`);

  if (!nbinhAuth) {
    results.push("❌ Cannot find nbinh auth user at all");
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  results.push(`Found auth user: ${nbinhAuth.id} (${nbinhAuth.email})`);

  // Check profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", nbinhAuth.id)
    .maybeSingle();

  if (profile) {
    // Profile exists, just fix username
    await supabase.from("profiles").update({
      username: "nbinh",
      full_name: "N. Bình",
      shift_type: "overtime",
      base_salary: 4500000,
      hourly_rate: 30000,
      default_clock_in: "17:00",
      default_clock_out: "22:00",
      must_change_password: false,
    }).eq("user_id", nbinhAuth.id);
    results.push(`✅ Updated existing profile with username nbinh`);
  } else {
    // No profile — insert one
    await supabase.from("profiles").insert({
      user_id: nbinhAuth.id,
      username: "nbinh",
      full_name: "N. Bình",
      shift_type: "overtime",
      base_salary: 4500000,
      hourly_rate: 30000,
      default_clock_in: "17:00",
      default_clock_out: "22:00",
      must_change_password: false,
    });
    results.push(`✅ Created profile for nbinh`);
  }

  // Update password
  const { error } = await supabase.auth.admin.updateUserById(nbinhAuth.id, {
    password: "ab123cd4",
  });
  results.push(error ? `❌ Password: ${error.message}` : `✅ Password set: ab123cd4`);

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
