// Inspect anhcuong profile + auth status.
// Run: SUPABASE_SERVICE_ROLE_KEY=... node inspect_anhcuong.cjs

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rrjmkqpexcjsqkxenpet.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, KEY);

async function run() {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', 'anhcuong')
    .maybeSingle();
  if (error) { console.error(error); process.exit(1); }
  console.log('PROFILE:', JSON.stringify(profile, null, 2));
  if (!profile) return;

  const { data: auth, error: authErr } = await supabase.auth.admin.getUserById(profile.user_id);
  if (authErr) console.error('AUTH ERR', authErr);
  const u = auth?.user;
  console.log('AUTH:', JSON.stringify({
    id: u?.id,
    email: u?.email,
    banned_until: u?.banned_until,
    deleted_at: u?.deleted_at,
    last_sign_in_at: u?.last_sign_in_at,
    created_at: u?.created_at,
    email_confirmed_at: u?.email_confirmed_at,
    role: u?.role,
  }, null, 2));

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', profile.user_id);
  console.log('ROLES:', roles);
}

run().catch((err) => { console.error(err); process.exit(1); });
