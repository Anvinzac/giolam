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

  const employees = [
    { email: "alice@lunarflow.test", name: "Alice Chen", clock_in: "08:00", clock_out: "17:00", shift_type: "basic" },
    { email: "bob@lunarflow.test", name: "Bob Williams", clock_in: "09:00", clock_out: "18:00", shift_type: "basic" },
    { email: "carol@lunarflow.test", name: "Carol Davis", clock_in: "07:30", clock_out: "16:30", shift_type: "overtime" },
    { email: "dave@lunarflow.test", name: "Dave Miller", clock_in: "08:30", clock_out: "17:30", shift_type: "basic" },
    { email: "eve@lunarflow.test", name: "Eve Johnson", clock_in: null, clock_out: null, shift_type: "basic" },
    { email: "frank@lunarflow.test", name: "Frank Brown", clock_in: "10:00", clock_out: "19:00", shift_type: "overtime" },
    { email: "grace@lunarflow.test", name: "Grace Lee", clock_in: "08:00", clock_out: "17:00", shift_type: "notice_only" },
    { email: "henry@lunarflow.test", name: "Henry Taylor", clock_in: "07:00", clock_out: "16:00", shift_type: "basic" },
    { email: "iris@lunarflow.test", name: "Iris Wang", clock_in: "09:30", clock_out: "18:30", shift_type: "basic" },
    { email: "jack@lunarflow.test", name: "Jack Martinez", clock_in: "08:00", clock_out: "17:00", shift_type: "overtime" },
    { email: "kate@lunarflow.test", name: "Kate Anderson", clock_in: null, clock_out: null, shift_type: "basic" },
    { email: "liam@lunarflow.test", name: "Liam Thomas", clock_in: "08:00", clock_out: "17:00", shift_type: "basic" },
  ];

  // Also create an admin
  const adminEmail = "admin@lunarflow.test";

  const results: string[] = [];

  // Create admin
  const { data: adminAuth } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: "admin123456",
    email_confirm: true,
    user_metadata: { full_name: "Admin User" },
  });
  if (adminAuth?.user) {
    await supabase.from('user_roles').upsert({ user_id: adminAuth.user.id, role: 'admin' }, { onConflict: 'user_id,role' });
    results.push(`Admin created: ${adminEmail}`);
  }

  // Get periods
  const { data: periods } = await supabase.from('working_periods').select('*').order('start_date');
  if (!periods?.length) {
    return new Response(JSON.stringify({ error: "No periods found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  for (const emp of employees) {
    const { data: auth } = await supabase.auth.admin.createUser({
      email: emp.email,
      password: "test123456",
      email_confirm: true,
      user_metadata: { full_name: emp.name },
    });
    if (!auth?.user) { results.push(`Skipped ${emp.email}`); continue; }

    // Update profile with defaults
    await supabase.from('profiles').update({
      default_clock_in: emp.clock_in,
      default_clock_out: emp.clock_out,
      shift_type: emp.shift_type,
    }).eq('user_id', auth.user.id);

    // Generate shifts for each period
    for (const period of periods) {
      const start = new Date(period.start_date);
      const end = new Date(period.end_date);
      const offDays = period.off_days || [];
      
      const current = new Date(start);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const dayOfWeek = current.getDay();
        const isOff = offDays.includes(dateStr);
        
        // Randomly activate ~70% of working days
        const isActive = !isOff && Math.random() > 0.3;
        
        if (isActive && emp.shift_type !== 'notice_only') {
          await supabase.from('shifts').upsert({
            user_id: auth.user.id,
            period_id: period.id,
            shift_date: dateStr,
            is_active: true,
            clock_in: emp.clock_in || `${7 + Math.floor(Math.random() * 3)}:${Math.random() > 0.5 ? '00' : '30'}`,
            clock_out: emp.clock_out || `${16 + Math.floor(Math.random() * 3)}:${Math.random() > 0.5 ? '00' : '30'}`,
            main_clock_in: emp.shift_type === 'overtime' ? emp.clock_in : null,
            main_clock_out: emp.shift_type === 'overtime' ? emp.clock_out : null,
            notice: dayOfWeek === 6 || dayOfWeek === 0 ? 'Weekend shift' : null,
          }, { onConflict: 'user_id,shift_date' });
        } else if (emp.shift_type === 'notice_only') {
          await supabase.from('shifts').upsert({
            user_id: auth.user.id,
            period_id: period.id,
            shift_date: dateStr,
            is_active: false,
            notice: isActive ? 'Available' : 'Unavailable',
          }, { onConflict: 'user_id,shift_date' });
        }

        current.setDate(current.getDate() + 1);
      }
    }
    results.push(`Created: ${emp.name}`);
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
