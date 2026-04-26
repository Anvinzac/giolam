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

  // The email is soft-deleted in auth. List ALL users including deleted.
  // Use the REST API directly to find the ghost user.
  const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
    },
  });
  const body = await resp.json();
  const allUsers = body.users || body || [];
  
  // Find any user with nbinh email
  const ghost = Array.isArray(allUsers) 
    ? allUsers.find((u: any) => u.email === "nbinh@lunarflow.local")
    : null;

  if (ghost) {
    results.push(`Found ghost user: ${ghost.id} (deleted_at: ${ghost.deleted_at})`);
    
    // If it's soft-deleted, hard-delete it first
    if (ghost.deleted_at) {
      // Can't hard-delete via SDK, but we can update the email to free it
      const { error: updateErr } = await supabase.auth.admin.updateUserById(ghost.id, {
        email: `deleted_nbinh_${Date.now()}@lunarflow.local`,
      });
      results.push(updateErr ? `Update ghost email failed: ${updateErr.message}` : "Freed ghost email");
    } else {
      // Active user exists — just update password and fix profile
      const { error } = await supabase.auth.admin.updateUserById(ghost.id, {
        password: "ab123cd4",
      });
      results.push(error ? `Password update failed: ${error.message}` : "Password updated");
      
      await supabase.from("profiles").upsert({
        user_id: ghost.id,
        username: "nbinh",
        full_name: "N. Bình",
        shift_type: "overtime",
        base_salary: 4500000,
        hourly_rate: 30000,
        default_clock_in: "17:00",
        default_clock_out: "22:00",
        must_change_password: false,
      }, { onConflict: "user_id" });
      results.push("Profile upserted");
      
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    results.push("No ghost user found");
  }

  // Now try creating
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: "nbinh@lunarflow.local",
    password: "ab123cd4",
    email_confirm: true,
    user_metadata: { full_name: "N. Bình" },
  });

  if (authError) {
    results.push(`❌ Create still failed: ${authError.message}`);
    
    // Last resort: use a different email
    const altEmail = "nbinh2@lunarflow.local";
    const { data: altAuth, error: altErr } = await supabase.auth.admin.createUser({
      email: altEmail,
      password: "ab123cd4",
      email_confirm: true,
      user_metadata: { full_name: "N. Bình" },
    });
    
    if (altErr) {
      results.push(`❌ Alt email also failed: ${altErr.message}`);
    } else if (altAuth?.user) {
      await new Promise(r => setTimeout(r, 500));
      await supabase.from("profiles").update({
        username: "nbinh",
        full_name: "N. Bình",
        shift_type: "overtime",
        base_salary: 4500000,
        hourly_rate: 30000,
        default_clock_in: "17:00",
        default_clock_out: "22:00",
        must_change_password: false,
      }).eq("user_id", altAuth.user.id);
      results.push(`✅ Created nbinh with alt email ${altEmail}, password: ab123cd4`);
    }
  } else if (authData?.user) {
    await new Promise(r => setTimeout(r, 500));
    await supabase.from("profiles").update({
      username: "nbinh",
      full_name: "N. Bình",
      shift_type: "overtime",
      base_salary: 4500000,
      hourly_rate: 30000,
      default_clock_in: "17:00",
      default_clock_out: "22:00",
      must_change_password: false,
    }).eq("user_id", authData.user.id);
    results.push(`✅ Created nbinh: ${authData.user.id}, password: ab123cd4`);
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
