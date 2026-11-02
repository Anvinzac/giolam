/**
 * Audit published salary totals for all completed periods.
 * Recomputes from live entries + from frozen snapshots, then diffs.
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx audit_past_salary.mts
 */
import { createClient } from '@supabase/supabase-js';
import {
  computeTotalSalaryTypeA,
  computeTotalSalaryTypeB,
  computeTotalSalaryTypeC,
  computeTotalSalaryTypeD,
  computeTotalSalaryTypeE,
} from '../../src/lib/salaryCalculations.ts';
import { normalizeDeposits, sumDeposits } from '../../src/lib/salaryDeposits.ts';
import type {
  EmployeeAllowance,
  SalaryBreakdown,
  SalaryEntry,
  SpecialDayRate,
} from '../../src/types/salary.ts';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rrjmkqpexcjsqkxenpet.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, KEY);

const HIDDEN = new Set(['test_loaia', 'test_loaib', 'test_loaic']);

type Profile = {
  user_id: string;
  username: string | null;
  full_name: string;
  shift_type: string | null;
  base_salary: number | null;
  hourly_rate: number | null;
  default_clock_in: string | null;
  default_clock_out: string | null;
};

type Period = {
  id: string;
  start_date: string;
  end_date: string;
  off_days: string[] | null;
};

type Issue = {
  severity: 'error' | 'warn' | 'info';
  period: string;
  account: string;
  name: string;
  shift: string;
  code: string;
  detail: string;
  published?: number;
  recomputed?: number;
  delta?: number;
};

function periodLabel(p: Period) {
  return `${p.start_date} → ${p.end_date}`;
}

function fmt(n: number) {
  return n.toLocaleString('vi-VN');
}

function resolvePeriodBounds(profile: Profile, period: Period) {
  let start = period.start_date;
  let end = period.end_date;
  // Mirror SalaryAdmin account-specific overrides used at publish time.
  if (profile.username === 'maiyen' && period.start_date === '2026-06-24') {
    start = '2026-05-25';
  }
  if (profile.username === 'ttu') {
    end = '2026-05-31';
  }
  return { start, end };
}

function recompute(
  shiftType: string,
  entries: SalaryEntry[],
  allowances: EmployeeAllowance[],
  rates: SpecialDayRate[],
  profile: Profile,
  period: Period,
): SalaryBreakdown | null {
  const base = profile.base_salary ?? 0;
  const hourly = profile.hourly_rate ?? 0;
  const clockIn = (profile.default_clock_in || '17:00').slice(0, 5);
  const { start, end } = resolvePeriodBounds(profile, period);
  const offDays = period.off_days || [];

  switch (shiftType) {
    case 'basic':
      return computeTotalSalaryTypeA(entries, allowances, base, hourly, rates, start, end);
    case 'daily':
      return computeTotalSalaryTypeE(entries, allowances, base, hourly, rates, end);
    case 'overtime':
      return computeTotalSalaryTypeB(entries, allowances, base, hourly, rates, clockIn, offDays, start, end);
    case 'notice_only':
      return computeTotalSalaryTypeC(entries, allowances, hourly, rates);
    case 'lunar_rate':
      return computeTotalSalaryTypeD(entries, allowances, 27000, 35000, rates);
    default:
      return null;
  }
}

function anomalyChecks(
  entries: SalaryEntry[],
  allowances: EmployeeAllowance[],
  profile: Profile,
  shiftType: string,
): string[] {
  const notes: string[] = [];
  for (const e of entries) {
    if (e.total_hours != null && e.total_hours < 0) {
      notes.push(`negative hours ${e.entry_date}: ${e.total_hours}`);
    }
    if (e.off_percent < 0 || e.off_percent > 100) {
      notes.push(`bad off_percent ${e.entry_date}: ${e.off_percent}`);
    }
    if (e.is_day_off && e.clock_out && e.clock_in && e.clock_in !== e.clock_out) {
      notes.push(`day_off with clock times ${e.entry_date}`);
    }
  }
  if ((shiftType === 'basic' || shiftType === 'overtime' || shiftType === 'daily') && (profile.base_salary ?? 0) <= 0) {
    notes.push('base_salary is 0');
  }
  if ((shiftType === 'notice_only' || shiftType === 'lunar_rate' || shiftType === 'overtime') && (profile.hourly_rate ?? 0) <= 0) {
    notes.push('hourly_rate is 0');
  }
  const enabledNoAmt = allowances.filter(a => a.is_enabled && a.allowance_key !== 'gui_xe' && (a.amount ?? 0) === 0);
  if (enabledNoAmt.length) {
    notes.push(`enabled zero-amount allowances: ${enabledNoAmt.map(a => a.label).join(', ')}`);
  }
  return notes;
}

async function fetchAll<T>(table: string, select: string, filters: Record<string, string>): Promise<T[]> {
  // Paginate past default 1000 row cap.
  const pageSize = 1000;
  let from = 0;
  const out: T[] = [];
  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    for (const [k, v] of Object.entries(filters)) {
      if (k === 'in_period_ids') {
        q = q.in('period_id', v.split(','));
      } else if (k === 'eq_status') {
        q = q.eq('status', v);
      } else if (k === 'eq_period_id') {
        q = q.eq('period_id', v);
      }
    }
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`Audit date (UTC): ${today}\n`);

  const { data: periods, error: pErr } = await supabase
    .from('working_periods')
    .select('id, start_date, end_date, off_days')
    .lt('end_date', today)
    .order('start_date', { ascending: true });
  if (pErr) throw pErr;
  if (!periods?.length) {
    console.log('No completed periods found.');
    return;
  }

  const periodIds = periods.map(p => p.id);
  const periodById = new Map(periods.map(p => [p.id, p as Period]));

  const [{ data: profiles }, { data: adminRoles }, { data: records }] = await Promise.all([
    supabase.from('profiles').select(
      'user_id, username, full_name, shift_type, base_salary, hourly_rate, default_clock_in, default_clock_out',
    ),
    supabase.from('user_roles').select('user_id').eq('role', 'admin'),
    supabase
      .from('salary_records')
      .select('id, user_id, period_id, total_salary, salary_breakdown, status, published_at')
      .in('period_id', periodIds)
      .eq('status', 'published'),
  ]);

  const adminIds = new Set((adminRoles || []).map(r => r.user_id));
  const profileById = new Map<string, Profile>();
  for (const p of profiles || []) {
    if (HIDDEN.has((p.username || '').toLowerCase())) continue;
    if (adminIds.has(p.user_id)) continue;
    profileById.set(p.user_id, p as Profile);
  }

  const published = (records || []).filter(r => profileById.has(r.user_id));
  console.log(`Completed periods: ${periods.length}`);
  console.log(`Published employee-period rows: ${published.length}\n`);

  // Load snapshots for all published records
  const { data: snapshots, error: sErr } = await supabase
    .from('salary_published_snapshots')
    .select(
      'salary_record_id, user_id, period_id, total_salary, breakdown, entries, allowances, rates, period_info, profile_info, published_at',
    )
    .in('period_id', periodIds);
  if (sErr) throw sErr;
  const snapByKey = new Map<string, any>();
  for (const s of snapshots || []) {
    snapByKey.set(`${s.user_id}|${s.period_id}`, s);
  }

  // Batch-load live entries / allowances / rates per period
  const liveEntriesByKey = new Map<string, SalaryEntry[]>();
  const liveAllowByKey = new Map<string, EmployeeAllowance[]>();
  const ratesByPeriod = new Map<string, SpecialDayRate[]>();

  for (const period of periods as Period[]) {
    const [{ data: entries }, { data: allows }, { data: rates }] = await Promise.all([
      supabase
        .from('salary_entries')
        .select('*')
        .eq('period_id', period.id)
        .order('entry_date')
        .order('sort_order')
        .limit(5000),
      supabase.from('employee_allowances').select('*').eq('period_id', period.id).limit(5000),
      supabase.from('special_day_rates').select('*').eq('period_id', period.id),
    ]);
    ratesByPeriod.set(period.id, (rates || []) as SpecialDayRate[]);
    for (const e of (entries || []) as SalaryEntry[]) {
      const k = `${e.user_id}|${period.id}`;
      if (!liveEntriesByKey.has(k)) liveEntriesByKey.set(k, []);
      liveEntriesByKey.get(k)!.push(e);
    }
    for (const a of (allows || []) as EmployeeAllowance[]) {
      const k = `${a.user_id}|${period.id}`;
      if (!liveAllowByKey.has(k)) liveAllowByKey.set(k, []);
      liveAllowByKey.get(k)!.push(a);
    }
  }

  const issues: Issue[] = [];
  const periodStats: Record<
    string,
    { published: number; ok: number; mismatch: number; missingSnap: number; drift: number }
  > = {};

  for (const rec of published) {
    const profile = profileById.get(rec.user_id)!;
    const period = periodById.get(rec.period_id)!;
    const label = periodLabel(period);
    if (!periodStats[label]) {
      periodStats[label] = { published: 0, ok: 0, mismatch: 0, missingSnap: 0, drift: 0 };
    }
    periodStats[label].published++;

    const key = `${rec.user_id}|${rec.period_id}`;
    const snap = snapByKey.get(key);
    const shift =
      (snap?.profile_info?.shift_type as string) ||
      profile.shift_type ||
      'basic';

    const publishedTotal = rec.total_salary ?? 0;
    const deposit = sumDeposits(normalizeDeposits(rec.salary_breakdown as SalaryBreakdown | null));

    if (!snap) {
      periodStats[label].missingSnap++;
      issues.push({
        severity: 'error',
        period: label,
        account: profile.username || rec.user_id,
        name: profile.full_name,
        shift,
        code: 'MISSING_SNAPSHOT',
        detail: 'Published salary_records row has no salary_published_snapshots row',
        published: publishedTotal,
      });
      continue;
    }

    // 1) Admin record vs employee snapshot totals
    if ((snap.total_salary ?? 0) !== publishedTotal) {
      issues.push({
        severity: 'error',
        period: label,
        account: profile.username || rec.user_id,
        name: profile.full_name,
        shift,
        code: 'RECORD_VS_SNAPSHOT',
        detail: `salary_records.total=${fmt(publishedTotal)} ≠ snapshot.total=${fmt(snap.total_salary ?? 0)}`,
        published: publishedTotal,
        recomputed: snap.total_salary ?? 0,
        delta: (snap.total_salary ?? 0) - publishedTotal,
      });
    }

    // 2) Recompute from snapshot payload (what was frozen at publish)
    const snapProfile: Profile = {
      user_id: profile.user_id,
      username: profile.username,
      full_name: profile.full_name,
      shift_type: snap.profile_info?.shift_type ?? profile.shift_type,
      base_salary: snap.profile_info?.base_salary ?? profile.base_salary,
      hourly_rate: snap.profile_info?.hourly_rate ?? profile.hourly_rate,
      default_clock_in: snap.profile_info?.default_clock_in ?? profile.default_clock_in,
      default_clock_out: snap.profile_info?.default_clock_out ?? profile.default_clock_out,
    };
    const snapPeriod: Period = {
      id: period.id,
      start_date: snap.period_info?.start_date ?? period.start_date,
      end_date: snap.period_info?.end_date ?? period.end_date,
      off_days: snap.period_info?.off_days ?? period.off_days,
    };
    const snapEntries = (snap.entries || []) as SalaryEntry[];
    const snapAllows = (snap.allowances || []) as EmployeeAllowance[];
    const snapRates = (snap.rates || []) as SpecialDayRate[];

    const fromSnap = recompute(shift, snapEntries, snapAllows, snapRates, snapProfile, snapPeriod);
    if (!fromSnap) {
      issues.push({
        severity: 'error',
        period: label,
        account: profile.username || rec.user_id,
        name: profile.full_name,
        shift,
        code: 'UNKNOWN_SHIFT',
        detail: `Unrecognized shift_type "${shift}"`,
        published: publishedTotal,
      });
      continue;
    }

    const snapDelta = fromSnap.total - (snap.total_salary ?? 0);
    if (Math.abs(snapDelta) > 0) {
      periodStats[label].mismatch++;
      issues.push({
        severity: Math.abs(snapDelta) >= 1000 ? 'error' : 'warn',
        period: label,
        account: profile.username || rec.user_id,
        name: profile.full_name,
        shift,
        code: 'SNAPSHOT_RECOMPUTE_MISMATCH',
        detail:
          `Frozen snapshot total ${fmt(snap.total_salary ?? 0)} ≠ recompute ${fmt(fromSnap.total)} ` +
          `(daily=${fmt(fromSnap.total_daily_wages)}, allowRates=${fmt(fromSnap.total_allowances_from_rates)}, ` +
          `deduct=${fmt(fromSnap.total_deductions)}, allowances=${fmt(
            fromSnap.allowances.filter(a => a.enabled).reduce((s, a) => s + a.amount, 0),
          )})`,
        published: snap.total_salary ?? 0,
        recomputed: fromSnap.total,
        delta: snapDelta,
      });
    } else {
      periodStats[label].ok++;
    }

    // Also compare frozen breakdown.total if present
    const frozenBreakdownTotal = (snap.breakdown as SalaryBreakdown | null)?.total;
    if (frozenBreakdownTotal != null && frozenBreakdownTotal !== (snap.total_salary ?? 0)) {
      issues.push({
        severity: 'warn',
        period: label,
        account: profile.username || rec.user_id,
        name: profile.full_name,
        shift,
        code: 'SNAPSHOT_BREAKDOWN_TOTAL_MISMATCH',
        detail: `snapshot.breakdown.total=${fmt(frozenBreakdownTotal)} ≠ snapshot.total_salary=${fmt(snap.total_salary ?? 0)}`,
        published: snap.total_salary ?? 0,
        recomputed: frozenBreakdownTotal,
        delta: frozenBreakdownTotal - (snap.total_salary ?? 0),
      });
    }

    // 3) Live recompute vs published (post-publish drift)
    const liveEntries = liveEntriesByKey.get(key) || [];
    const liveAllows = liveAllowByKey.get(key) || [];
    const liveRates = ratesByPeriod.get(period.id) || [];
    const fromLive = recompute(shift, liveEntries, liveAllows, liveRates, profile, period);
    if (fromLive && Math.abs(fromLive.total - publishedTotal) > 0) {
      // Only flag drift if entries/allowances actually differ from snapshot,
      // or if calc itself diverges.
      const liveDelta = fromLive.total - publishedTotal;
      const sameEntryCount = liveEntries.length === snapEntries.length;
      periodStats[label].drift++;
      issues.push({
        severity: Math.abs(liveDelta) >= 10000 ? 'error' : 'warn',
        period: label,
        account: profile.username || rec.user_id,
        name: profile.full_name,
        shift,
        code: 'LIVE_DRIFT',
        detail:
          `Live recompute ${fmt(fromLive.total)} vs published ${fmt(publishedTotal)} ` +
          `(entries live=${liveEntries.length}/snap=${snapEntries.length}` +
          `${sameEntryCount ? '' : ' DIFFER'})` +
          (deposit > 0 ? `; deposit=${fmt(deposit)}` : ''),
        published: publishedTotal,
        recomputed: fromLive.total,
        delta: liveDelta,
      });
    }

    // 4) Data hygiene
    for (const note of anomalyChecks(snapEntries, snapAllows, snapProfile, shift)) {
      issues.push({
        severity: 'warn',
        period: label,
        account: profile.username || rec.user_id,
        name: profile.full_name,
        shift,
        code: 'DATA_ANOMALY',
        detail: note,
        published: publishedTotal,
      });
    }

    // Deposit sanity
    if (deposit > publishedTotal && publishedTotal > 0) {
      issues.push({
        severity: 'error',
        period: label,
        account: profile.username || rec.user_id,
        name: profile.full_name,
        shift,
        code: 'DEPOSIT_GT_TOTAL',
        detail: `deposit ${fmt(deposit)} > published total ${fmt(publishedTotal)}`,
        published: publishedTotal,
      });
    }
  }

  // Employees with entries in a completed period but never published
  for (const period of periods as Period[]) {
    const label = periodLabel(period);
    const usersWithEntries = new Set(
      [...liveEntriesByKey.keys()]
        .filter(k => k.endsWith(`|${period.id}`))
        .map(k => k.split('|')[0]),
    );
    const publishedUsers = new Set(
      published.filter(r => r.period_id === period.id).map(r => r.user_id),
    );
    for (const uid of usersWithEntries) {
      if (publishedUsers.has(uid)) continue;
      const profile = profileById.get(uid);
      if (!profile) continue;
      const entries = liveEntriesByKey.get(`${uid}|${period.id}`) || [];
      const worked = entries.filter(e => !e.is_day_off && (e.clock_in || e.clock_out || (e.total_hours ?? 0) !== 0));
      if (worked.length === 0) continue;
      issues.push({
        severity: 'info',
        period: label,
        account: profile.username || uid,
        name: profile.full_name,
        shift: profile.shift_type || '?',
        code: 'UNPUBLISHED_WITH_ENTRIES',
        detail: `${worked.length} worked entries exist but salary not published`,
      });
    }
  }

  // ---- Report ----
  console.log('=== Period summary ===');
  for (const [label, s] of Object.entries(periodStats)) {
    console.log(
      `${label}  published=${s.published}  ok=${s.ok}  snapMismatch=${s.mismatch}  missingSnap=${s.missingSnap}  liveDrift=${s.drift}`,
    );
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warns = issues.filter(i => i.severity === 'warn');
  const infos = issues.filter(i => i.severity === 'info');

  console.log(`\n=== Issues: ${errors.length} errors, ${warns.length} warns, ${infos.length} info ===\n`);

  const printGroup = (title: string, list: Issue[]) => {
    if (!list.length) return;
    console.log(`--- ${title} (${list.length}) ---`);
    for (const i of list) {
      const money =
        i.delta != null
          ? `  Δ=${i.delta > 0 ? '+' : ''}${fmt(i.delta)}`
          : '';
      console.log(
        `[${i.severity}] ${i.period} | ${i.account} (${i.name}) [${i.shift}] ${i.code}${money}\n  ${i.detail}`,
      );
    }
    console.log('');
  };

  printGroup('ERRORS', errors);
  printGroup('WARNINGS', warns);
  printGroup('INFO', infos);

  // Write JSON for canvas / follow-up
  const outPath = 'audit_past_salary_report.json';
  const report = {
    audited_at: new Date().toISOString(),
    today,
    periods: periods.map(p => ({
      id: p.id,
      start_date: p.start_date,
      end_date: p.end_date,
      label: periodLabel(p as Period),
      stats: periodStats[periodLabel(p as Period)] || null,
    })),
    totals: {
      published_rows: published.length,
      errors: errors.length,
      warns: warns.length,
      infos: infos.length,
    },
    issues,
  };
  await import('node:fs/promises').then(fs =>
    fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8'),
  );
  console.log(`Wrote ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
