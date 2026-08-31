// Preview: export JSON for the most recent completed payroll period.
// Run: SUPABASE_SERVICE_ROLE_KEY=... node export_last_payroll_preview.cjs

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rrjmkqpexcjsqkxenpet.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, KEY);

const HIDDEN = new Set(['test_loaia', 'test_loaib', 'test_loaic']);

const SCHEMA = {
  version: '1.0',
  description:
    'Published payroll export for one completed working period. ' +
    'Import apps should read `employees[]` and match rows by `account` (login username).',
  root_fields: {
    schema: 'Self-describing import contract (this object).',
    period: 'Payroll period metadata (id, start_date, end_date, label).',
    exported_at: 'ISO-8601 timestamp when this file was generated.',
    employees: 'One row per employee with a published salary for this period.',
    summary: 'Roll-up counts and totals for validation after import.',
  },
  employee_fields: {
    account: 'Login username (profiles.username). Required. Unique within the file.',
    name: 'Display name (profiles.full_name). Required.',
    amount: 'Published gross salary in VND (salary_records.total_salary). Required.',
    deposit: 'Optional advance/deduction held back (salary_breakdown.deposit). Defaults to 0.',
    transfer_amount: 'Optional net bank transfer = amount - deposit.',
    published_at: 'Optional ISO timestamp when this employee payroll was published.',
  },
  import_notes: [
    'Only employees with status=published are included.',
    'amount is the gross published total, not the net transfer.',
    'Use transfer_amount when paying net of deposit/advance.',
    'Period is complete when end_date is before today (local calendar day).',
  ],
};

function formatDateViet(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function run() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: periods, error: pErr } = await supabase
    .from('working_periods')
    .select('id, start_date, end_date, is_archived')
    .eq('is_archived', false)
    .lt('end_date', today)
    .order('end_date', { ascending: false })
    .limit(1);
  if (pErr) throw pErr;
  const period = periods?.[0];
  if (!period) {
    console.error('No completed period found (end_date < today)');
    process.exit(1);
  }

  const [{ data: profiles }, { data: adminRoles }, { data: records }] = await Promise.all([
    supabase.from('profiles').select('user_id, username, full_name'),
    supabase.from('user_roles').select('user_id').eq('role', 'admin'),
    supabase
      .from('salary_records')
      .select('user_id, total_salary, salary_breakdown, published_at, status')
      .eq('period_id', period.id)
      .eq('status', 'published'),
  ]);

  const adminIds = new Set((adminRoles || []).map(r => r.user_id));
  const employees = (profiles || [])
    .filter(p => !HIDDEN.has((p.username || '').toLowerCase()))
    .filter(p => !adminIds.has(p.user_id));

  const byUser = new Map((records || []).map(r => [r.user_id, r]));
  const rows = [];
  for (const emp of employees) {
    const rec = byUser.get(emp.user_id);
    if (!rec) continue;
    const deposit = rec.salary_breakdown?.deposit ?? 0;
    const amount = rec.total_salary ?? 0;
    const row = {
      account: emp.username || emp.user_id,
      name: emp.full_name,
      amount,
    };
    if (deposit > 0) {
      row.deposit = deposit;
      row.transfer_amount = amount - deposit;
    }
    if (rec.published_at) row.published_at = rec.published_at;
    rows.push(row);
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalDeposit = rows.reduce((s, r) => s + (r.deposit ?? 0), 0);

  const payload = {
    schema: SCHEMA,
    period: {
      id: period.id,
      start_date: period.start_date,
      end_date: period.end_date,
      label: `${formatDateViet(period.start_date)} – ${formatDateViet(period.end_date)}`,
    },
    exported_at: new Date().toISOString(),
    employees: rows,
    summary: {
      employee_count: rows.length,
      total_amount: totalAmount,
      total_deposit: totalDeposit,
      total_transfer: totalAmount - totalDeposit,
    },
  };

  const outPath = `payroll_${period.start_date}_${period.end_date}.json`;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log('PERIOD:', period.start_date, '->', period.end_date);
  console.log('FILE:', outPath);
  console.log('EMPLOYEES:', rows.length);
  console.log('--- JSON ---');
  console.log(JSON.stringify(payload, null, 2));
}

run().catch((e) => { console.error(e); process.exit(1); });
