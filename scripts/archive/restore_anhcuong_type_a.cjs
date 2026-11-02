// Switch anhcuong back to Type A (basic). Account is active.
// Run: SUPABASE_SERVICE_ROLE_KEY=... node restore_anhcuong_type_a.cjs

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rrjmkqpexcjsqkxenpet.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, KEY);

const USER_ID = '2f668850-0fb1-4e2c-84f1-df69a4b72236';

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .update({ shift_type: 'basic' })
    .eq('user_id', USER_ID)
    .select('username, full_name, shift_type, base_salary, hourly_rate, default_clock_in, default_clock_out, work_shift');
  if (error) { console.error(error); process.exit(1); }
  console.log('UPDATED:', JSON.stringify(data, null, 2));
}

run().catch((err) => { console.error(err); process.exit(1); });
