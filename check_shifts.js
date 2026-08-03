import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@giolam.com',
    password: 'l@123456'
  });
  
  if (error) {
    console.log("Login failed", error.message);
  } else {
    console.log("Logged in!");
  }
  
  // Try to find ANY shifts in August
  const { data: shifts, error: shiftErr } = await supabase
    .from('shifts')
    .select('*')
    .gte('shift_date', '2026-08-01')
    .lte('shift_date', '2026-08-31');
    
  console.log("Shifts found:", shifts ? shifts.length : shiftErr);
  if (shifts && shifts.length > 0) {
    console.log(shifts.slice(0, 5));
  }
}
run();
