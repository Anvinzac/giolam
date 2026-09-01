// Repair Type B (overtime) salary_entries rows whose clock_out is still NULL.
// The Type B convention is a sentinel: clock_out === clock_in (total_hours: 0)
// so the clock-out cell renders as '—' while staying fully tappable. Rows
// seeded before that convention (or by older seed paths) landed with
// clock_out = null and were not tappable / surfaced as empty.
//
// For every overtime employee, working rows (is_day_off = false) with a null
// clock_out are rewritten to:
//   clock_out   = COALESCE(clock_in, profiles.default_clock_in, '17:00')
//   total_hours = COALESCE(total_hours, 0)
// Off-day rows (is_day_off = true) are left untouched — they legitimately
// have no clock times.
//
// Auth: uses SUPABASE_SERVICE_ROLE_KEY if set; otherwise signs in with
// ADMIN_USER / ADMIN_PASS via the login-by-username edge function.
//
// Run: SUPABASE_SERVICE_ROLE_KEY=... node fix_typeb_null_clockout.cjs
//   or ADMIN_USER=admin ADMIN_PASS=... node fix_typeb_null_clockout.cjs
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rrjmkqpexcjsqkxenpet.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyam1rcXBleGNqc3FreGVucGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjEyMTUsImV4cCI6MjA5MDMzNzIxNX0.UQRi9s3MQt-Gpj3uYzW6ghoKZo608d6r0KEnPcKIgeo';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  let supabase;

  if (SERVICE_KEY) {
    console.log('Using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)');
    supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  } else {
    const ADMIN_USER = process.env.ADMIN_USER;
    const ADMIN_PASS = process.env.ADMIN_PASS;
    if (!ADMIN_USER || !ADMIN_PASS) {
      console.error('Set SUPABASE_SERVICE_ROLE_KEY, or ADMIN_USER + ADMIN_PASS');
      process.exit(1);
    }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/login-by-username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    });
    const authData = await res.json();
    if (!res.ok || !authData.session) {
      console.error('Admin sign-in failed:', authData.error || authData);
      process.exit(1);
    }
    console.log(`Signed in as ${ADMIN_USER}`);
    supabase = createClient(SUPABASE_URL, ANON_KEY);
    await supabase.auth.setSession({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    });
  }

  // 1. All overtime (Type B) employees with their default clock-in
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('user_id, username, shift_type, default_clock_in')
    .eq('shift_type', 'overtime');
  if (profErr) { console.error('Failed to load profiles:', profErr); process.exit(1); }
  if (!profiles?.length) { console.log('No overtime employees found. Nothing to do.'); return; }
  console.log(`Type B employees: ${profiles.map(p => p.username).join(', ')}`);

  let totalFixed = 0;
  for (const p of profiles) {
    // 2. Working rows with a null clock_out
    const { data: rows, error: rowsErr } = await supabase
      .from('salary_entries')
      .select('id, entry_date, clock_in, total_hours')
      .eq('user_id', p.user_id)
      .eq('is_day_off', false)
      .is('clock_out', null);
    if (rowsErr) { console.error(`Failed to load entries for ${p.username}:`, rowsErr); continue; }
    if (!rows?.length) {
      console.log(`  ${p.username}: no null clock_out rows`);
      continue;
    }

    for (const row of rows) {
      const fixOut = row.clock_in || p.default_clock_in || '17:00';
      const { error: upErr } = await supabase
        .from('salary_entries')
        .update({ clock_out: fixOut, total_hours: row.total_hours == null ? 0 : row.total_hours })
        .eq('id', row.id);
      if (upErr) {
        console.error(`  ${p.username} ${row.entry_date}: UPDATE FAILED:`, upErr.message);
      } else {
        totalFixed++;
        console.log(`  ${p.username} ${row.entry_date}: clock_out null → ${fixOut}`);
      }
    }
  }

  console.log(`\nDone. Fixed ${totalFixed} row(s).`);
}

main().catch(console.error);