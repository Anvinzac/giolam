import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase URL or anon key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAccount(username, password) {
  console.log(`\nTesting login for ${username}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: username.includes('@') ? username : `${username}@test.com`,
    password: password
  });

  if (authError) {
    console.error(`Login failed for ${username}: ${authError.message}`);
    
    // Check if it's the username suffix thing
    const { data: authData2, error: authError2 } = await supabase.auth.signInWithPassword({
      email: `${username}@giolam.com`,
      password: password
    });
    if (authError2) {
      console.error(`Login with @giolam.com also failed: ${authError2.message}`);
      return;
    }
  }
  
  console.log(`✅ Login successful for ${username}`);
  
  // Get active period
  const { data: periods } = await supabase
    .from('working_periods')
    .select('*')
    .eq('is_archived', false)
    .order('start_date', { ascending: false })
    .limit(1)
    .single();
    
  if (periods) {
    console.log(`Active Period: ${periods.start_date} to ${periods.end_date}`);
    
    // Get salary entries
    const { data: entries } = await supabase
      .from('salary_entries')
      .select('*')
      .eq('period_id', periods.id);
      
    if (entries) {
      console.log(`Found ${entries.length} salary entries for ${username}`);
      
      const offDays = entries.filter(e => e.is_day_off);
      const workingDays = entries.filter(e => !e.is_day_off);
      
      console.log(`- Working Days: ${workingDays.length}`);
      console.log(`- Off Days: ${offDays.length}`);
      
      if (workingDays.length > 0) {
        console.log(`- Sample Working Day: clock_in=${workingDays[0].clock_in}, clock_out=${workingDays[0].clock_out}, is_day_off=${workingDays[0].is_day_off}`);
      }
      if (offDays.length > 0) {
         console.log(`- Sample Off Day: date=${offDays[0].entry_date}, is_day_off=${offDays[0].is_day_off}`);
      }
    } else {
      console.log(`No salary entries found.`);
    }
  } else {
    console.log("No active period found");
  }

  await supabase.auth.signOut();
}

async function run() {
  await checkAccount('chithu', 'l@123456');
  await checkAccount('anhkhanh', 'l@123456');
  await checkAccount('codung', 'l@123456');
  await checkAccount('maiyen', 'l@123456');
}

run();
