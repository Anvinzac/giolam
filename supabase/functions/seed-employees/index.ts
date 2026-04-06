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

  const KITCHEN_ID = "d0000000-0000-0000-0000-000000000001";
  const RECEPTION_ID = "d0000000-0000-0000-0000-000000000002";

  const employees = [
    // Kitchen (12 employees)
    { username: "chithoa", full_name: "Chị Thoa", department_id: KITCHEN_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 5000000, hourly_rate: 25000 },
    { username: "chithu", full_name: "Chị Thu", department_id: KITCHEN_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "chioanh", full_name: "Chị Oanh", department_id: KITCHEN_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "chinuong", full_name: "Chị Nương", department_id: KITCHEN_ID, shift_type: "overtime", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4500000, hourly_rate: 30000 },
    { username: "chixuan", full_name: "Chị Xuân", department_id: KITCHEN_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "coha", full_name: "Cô Hà", department_id: KITCHEN_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 5000000, hourly_rate: 25000 },
    { username: "anhcuong", full_name: "Anh Cường", department_id: KITCHEN_ID, shift_type: "overtime", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4500000, hourly_rate: 30000 },
    { username: "chichi", full_name: "Chị Chi", department_id: KITCHEN_ID, shift_type: "overtime", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4500000, hourly_rate: 30000 },
    { username: "tphi", full_name: "T. Phi", department_id: KITCHEN_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "ntruong", full_name: "N. Trường", department_id: KITCHEN_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "chinu", full_name: "Chị Nụ", department_id: KITCHEN_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "chilinh", full_name: "Chị Linh", department_id: KITCHEN_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    
    // Service (8 employees)
    { username: "ptuan", full_name: "P. Tuấn", department_id: RECEPTION_ID, shift_type: "overtime", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4500000, hourly_rate: 30000 },
    { username: "hthao", full_name: "H. Thảo", department_id: RECEPTION_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "vtuan", full_name: "V. Tuấn", department_id: RECEPTION_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "mhieu", full_name: "M. Hiếu", department_id: RECEPTION_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "nhuyen", full_name: "N. Huyền", department_id: RECEPTION_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "tphat", full_name: "T. Phát", department_id: RECEPTION_ID, shift_type: "overtime", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4500000, hourly_rate: 30000 },
    { username: "ghan", full_name: "G. Hân", department_id: RECEPTION_ID, shift_type: "basic", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4800000, hourly_rate: 25000 },
    { username: "nbinh", full_name: "N. Bình", department_id: RECEPTION_ID, shift_type: "overtime", default_clock_in: "17:00", default_clock_out: "22:00", base_salary: 4500000, hourly_rate: 30000 },
    
    // Other (2 employees)
    { username: "ttu", full_name: "T. Tư", department_id: null, shift_type: "notice_only", default_clock_in: "08:00", default_clock_out: "17:30", base_salary: 0, hourly_rate: 35000 },
    { username: "qlam", full_name: "Q. Lâm", department_id: null, shift_type: "notice_only", default_clock_in: "08:00", default_clock_out: "17:30", base_salary: 0, hourly_rate: 35000 },
  ];

  const results: string[] = [];

  for (const emp of employees) {
    // Create auth user with email derived from username
    const email = `${emp.username}@lunarflow.local`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: "l@123456",
      email_confirm: true,
      user_metadata: { full_name: emp.full_name },
    });

    if (authError) {
      results.push(`Error creating ${emp.username}: ${authError.message}`);
      continue;
    }

    if (authData?.user) {
      // Update profile with username, department, shift info, and salary
      await supabase.from("profiles").update({
        username: emp.username,
        full_name: emp.full_name,
        department_id: emp.department_id,
        shift_type: emp.shift_type,
        default_clock_in: emp.default_clock_in,
        default_clock_out: emp.default_clock_out,
        base_salary: emp.base_salary,
        hourly_rate: emp.hourly_rate,
        must_change_password: false,
      }).eq("user_id", authData.user.id);

      results.push(`Created: ${emp.username} (${emp.full_name})`);
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
