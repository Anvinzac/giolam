// Fix active payroll period: 2026-05-25 → 2026-06-23 (30 days, 3 pages of 10).
// Removes June 24 from working_periods, salary_entries, special_day_rates,
// and published snapshots for every employee.
//
// Run: SUPABASE_SERVICE_ROLE_KEY=... node fix_may25_jun23_period.cjs

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rrjmkqpexcjsqkxenpet.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PERIOD_START = '2026-05-25';
const OLD_END = '2026-06-24';
const NEW_END = '2026-06-23';
const TRIM_DATE = '2026-06-24';

async function fix() {
  console.log(`=== Fixing period ${PERIOD_START} → ${NEW_END} ===\n`);

  const { data: period, error: periodErr } = await supabase
    .from('working_periods')
    .select('id, start_date, end_date, off_days')
    .eq('start_date', PERIOD_START)
    .eq('end_date', OLD_END)
    .maybeSingle();

  if (periodErr) {
    console.error('Period lookup failed:', periodErr.message);
    process.exit(1);
  }

  if (!period) {
    const { data: alreadyFixed } = await supabase
      .from('working_periods')
      .select('id, end_date')
      .eq('start_date', PERIOD_START)
      .eq('end_date', NEW_END)
      .maybeSingle();

    if (alreadyFixed) {
      console.log(`Already fixed (period ${alreadyFixed.id} ends ${alreadyFixed.end_date}).`);
      return;
    }

    console.error(`No period found for ${PERIOD_START} → ${OLD_END}.`);
    process.exit(1);
  }

  const periodId = period.id;
  console.log('Period ID:', periodId);

  const { count: entriesRemoved, error: entriesErr } = await supabase
    .from('salary_entries')
    .delete({ count: 'exact' })
    .eq('period_id', periodId)
    .eq('entry_date', TRIM_DATE);

  if (entriesErr) {
    console.error('Failed to delete salary entries:', entriesErr.message);
    process.exit(1);
  }
  console.log(`Removed ${entriesRemoved ?? 0} salary entries on ${TRIM_DATE}`);

  const { count: ratesRemoved, error: ratesErr } = await supabase
    .from('special_day_rates')
    .delete({ count: 'exact' })
    .eq('period_id', periodId)
    .eq('special_date', TRIM_DATE);

  if (ratesErr) {
    console.error('Failed to delete special day rates:', ratesErr.message);
    process.exit(1);
  }
  console.log(`Removed ${ratesRemoved ?? 0} special day rates on ${TRIM_DATE}`);

  const offDays = (period.off_days || []).filter((d) => d !== TRIM_DATE);
  const { error: periodUpdateErr } = await supabase
    .from('working_periods')
    .update({ end_date: NEW_END, off_days: offDays })
    .eq('id', periodId);

  if (periodUpdateErr) {
    console.error('Failed to update working period:', periodUpdateErr.message);
    process.exit(1);
  }
  console.log(`Updated working_periods end_date → ${NEW_END}`);

  const { data: snapshots, error: snapFetchErr } = await supabase
    .from('salary_published_snapshots')
    .select('id, entries, rates, period_info')
    .eq('period_id', periodId);

  if (snapFetchErr) {
    console.error('Failed to fetch snapshots:', snapFetchErr.message);
    process.exit(1);
  }

  let snapshotsUpdated = 0;
  for (const snap of snapshots || []) {
    const entries = (snap.entries || []).filter((e) => e.entry_date !== TRIM_DATE);
    const rates = (snap.rates || []).filter((r) => r.special_date !== TRIM_DATE);
    const periodInfo = snap.period_info
      ? { ...snap.period_info, end_date: NEW_END }
      : null;

    const changed =
      entries.length !== (snap.entries || []).length ||
      rates.length !== (snap.rates || []).length ||
      snap.period_info?.end_date === OLD_END;

    if (!changed) continue;

    const { error: snapUpdateErr } = await supabase
      .from('salary_published_snapshots')
      .update({ entries, rates, period_info: periodInfo })
      .eq('id', snap.id);

    if (snapUpdateErr) {
      console.error(`Failed to update snapshot ${snap.id}:`, snapUpdateErr.message);
      process.exit(1);
    }
    snapshotsUpdated += 1;
  }

  console.log(`Updated ${snapshotsUpdated} published snapshot(s)`);
  console.log('\n=== Done ===');
}

fix().catch((err) => {
  console.error(err);
  process.exit(1);
});
