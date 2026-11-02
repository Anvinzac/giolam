// Diagnostic: dump tphi's profile, period, special_day_rates, and salary_entries.
// Run: SUPABASE_SERVICE_ROLE_KEY=... node diag_tphi.cjs

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rrjmkqpexcjsqkxenpet.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, KEY);

async function run() {
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, username, full_name, shift_type, base_salary, hourly_rate, default_clock_in, default_clock_out')
    .ilike('username', 'tphi')
    .single();
  console.log('PROFILE:', JSON.stringify(profile, null, 2));

  const { data: periods } = await supabase
    .from('working_periods')
    .select('id, start_date, end_date, is_archived, off_days')
    .order('start_date', { ascending: false })
    .limit(3);
  console.log('PERIODS:', JSON.stringify(periods, null, 2));

  const period = periods?.[0];
  if (!period || !profile) return;

  const { data: rates } = await supabase
    .from('special_day_rates')
    .select('special_date, rate_percent, day_type')
    .eq('period_id', period.id)
    .order('special_date');
  console.log('SPECIAL RATES count:', rates?.length, 'dates:', rates?.map(r => r.special_date));

  const { data: entries } = await supabase
    .from('salary_entries')
    .select('id, entry_date, sort_order, is_day_off, off_percent, total_hours, clock_in, clock_out, note, allowance_rate_override, is_admin_reviewed, submitted_by')
    .eq('user_id', profile.user_id)
    .eq('period_id', period.id)
    .order('entry_date')
    .order('sort_order');
  console.log('ENTRIES count:', entries?.length);
  for (const e of (entries || [])) {
    console.log(`  ${e.entry_date} so=${e.sort_order} off=${e.is_day_off} off%=${e.off_percent} hrs=${e.total_hours} in=${e.clock_in} out=${e.clock_out} rate=${e.allowance_rate_override} note=${e.note} reviewed=${e.is_admin_reviewed}`);
  }

  // Group by date to find duplicates
  const byDate = {};
  for (const e of (entries || [])) {
    (byDate[e.entry_date] = byDate[e.entry_date] || []).push(e);
  }
  const dups = Object.entries(byDate).filter(([_, arr]) => arr.length > 1);
  console.log('DATES WITH MULTIPLE ROWS:', dups.map(([d, arr]) => `${d}(${arr.length})`).join(', '));
}

run().catch(console.error);
