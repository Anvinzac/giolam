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

  // Get active period
  const { data: period } = await supabase
    .from("working_periods")
    .select("*")
    .eq("is_archived", false)
    .order("start_date", { ascending: false })
    .limit(1)
    .single();

  const results: any = {};

  const usernamesToTest = ['chithu', 'anhkhanh', 'codung', 'maiyen'];

  for (const username of usernamesToTest) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, username, full_name, shift_type")
      .eq("username", username)
      .single();

    if (!profile) {
      results[username] = "Not found";
      continue;
    }

    const { data: entries } = await supabase
      .from("salary_entries")
      .select("entry_date, is_day_off, clock_in, clock_out")
      .eq("user_id", profile.user_id)
      .eq("period_id", period?.id);

    const offDays = (entries || []).filter(e => e.is_day_off).length;
    const workingDays = (entries || []).filter(e => !e.is_day_off).length;

    results[username] = {
      fullName: profile.full_name,
      shiftType: profile.shift_type,
      totalEntries: (entries || []).length,
      workingDays,
      offDays,
      sampleEntry: entries && entries.length > 0 ? entries[0] : null
    };
  }

  return new Response(JSON.stringify({ period, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
