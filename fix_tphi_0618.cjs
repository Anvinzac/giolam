// Fix the stray tphi row on 2026-06-18 (is_day_off=true, note=null) that was
// neither seeded (seeding uses note='Quán nghỉ' for off-days) nor set by the
// off-day toggle (which sets note='Nghỉ'). Restore it to a normal pending-input
// sentinel row so it matches the other empty days.
//
// Run: SUPABASE_SERVICE_ROLE_KEY=... node fix_tphi_0618.cjs
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rrjmkqpexcjsqkxenpet.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, KEY);

const TPHI_USER_ID = '99801c3e-bd96-4805-aa1d-9c07f81e0326';
const PERIOD_ID = 'b36f9681-4069-44ee-b1e8-7b4d4d202171';
const DATE = '2026-06-18';

async function run() {
  const { data: before } = await supabase
    .from('salary_entries')
    .select('*')
    .eq('user_id', TPHI_USER_ID)
    .eq('period_id', PERIOD_ID)
    .eq('entry_date', DATE);
  console.log('BEFORE:', JSON.stringify(before, null, 2));

  const { data, error } = await supabase
    .from('salary_entries')
    .update({
      is_day_off: false,
      off_percent: 0,
      note: null,
      clock_in: '14:30:00',
      clock_out: '14:30:00',
      total_hours: 0,
      allowance_rate_override: null,
    })
    .eq('user_id', TPHI_USER_ID)
    .eq('period_id', PERIOD_ID)
    .eq('entry_date', DATE)
    .eq('sort_order', 0)
    .select();
  if (error) { console.error('UPDATE ERROR:', error); process.exit(1); }
  console.log('AFTER:', JSON.stringify(data, null, 2));
}

run().catch(console.error);
