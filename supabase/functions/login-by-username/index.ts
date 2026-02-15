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

  const { username, password } = await req.json();
  
  if (!username || !password) {
    return new Response(JSON.stringify({ error: "Username and password required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find profile by username (case-insensitive)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, username")
    .ilike("username", username)
    .single();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: "Không tìm thấy tài khoản" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get the user's email from auth
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profile.user_id);
  
  if (authError || !authUser?.user?.email) {
    return new Response(JSON.stringify({ error: "Lỗi hệ thống" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Sign in with the email and provided password
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: authUser.user.email,
    password,
  });

  if (signInError) {
    return new Response(JSON.stringify({ error: "Sai mật khẩu" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ 
    session: signInData.session,
    must_change_password: false, // Will be checked client-side from profile
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
