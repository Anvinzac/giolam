import { createClient } from '@supabase/supabase-js';
import {
  computeTotalSalaryTypeA,
  computeTotalSalaryTypeB,
  computeTotalSalaryTypeC,
  computeTotalSalaryTypeD,
  calcDailyBase,
  computeTypeARowAmounts,
  getRateForDate,
  roundToThousand,
  calcHoursFromTimes,
} from '../../src/lib/salaryCalculations.ts';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://rrjmkqpexcjsqkxenpet.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function dig(username: string, periodStart: string) {
  const { data: profile } = await supabase.from('profiles').select('*').eq('username', username).single();
  const { data: period } = await supabase.from('working_periods').select('*').eq('start_date', periodStart).single();
  const { data: snap } = await supabase
    .from('salary_published_snapshots')
    .select('*')
    .eq('user_id', profile!.user_id)
    .eq('period_id', period!.id)
    .single();
  const { data: rec } = await supabase
    .from('salary_records')
    .select('total_salary, salary_breakdown, status')
    .eq('user_id', profile!.user_id)
    .eq('period_id', period!.id)
    .single();

  console.log('\n====', username, periodStart, '====');
  console.log(
    'shift',
    snap!.profile_info?.shift_type,
    'base',
    snap!.profile_info?.base_salary,
    'hourly',
    snap!.profile_info?.hourly_rate,
  );
  console.log('published', rec!.total_salary, 'snap.total', snap!.total_salary, 'breakdown.total', snap!.breakdown?.total);
  console.log(
    'breakdown summary',
    JSON.stringify(
      {
        base_salary: snap!.breakdown?.base_salary,
        daily_base: snap!.breakdown?.daily_base,
        total_daily_wages: snap!.breakdown?.total_daily_wages,
        total_allowances_from_rates: snap!.breakdown?.total_allowances_from_rates,
        total_deductions: snap!.breakdown?.total_deductions,
        allowances: snap!.breakdown?.allowances,
        total: snap!.breakdown?.total,
        deposit: snap!.breakdown?.deposit,
      },
      null,
      2,
    ),
  );

  const entries = snap!.entries || [];
  const allows = snap!.allowances || [];
  const rates = snap!.rates || [];
  const shift = snap!.profile_info?.shift_type as string;
  const pi = snap!.profile_info;
  let recomputed: any;
  if (shift === 'basic') {
    recomputed = computeTotalSalaryTypeA(
      entries,
      allows,
      pi.base_salary,
      pi.hourly_rate,
      rates,
      period!.start_date,
      period!.end_date,
    );
    const dailyBase = calcDailyBase(pi.base_salary);
    console.log('dailyBase now', dailyBase, 'snap.daily_base', snap!.breakdown?.daily_base);
    // Compare per-row stored vs recomputed
    for (const e of entries) {
      const row = computeTypeARowAmounts(e, dailyBase, pi.hourly_rate, rates);
      const diffs: string[] = [];
      if ((e.allowance_amount || 0) !== row.allowance) diffs.push(`allow ${e.allowance_amount}->${row.allowance}`);
      if ((e.extra_wage || 0) !== row.extraWage) diffs.push(`extra ${e.extra_wage}->${row.extraWage}`);
      if ((e.total_daily_wage || 0) !== row.total) diffs.push(`total ${e.total_daily_wage}->${row.total}`);
      if (diffs.length) {
        console.log(
          'row',
          e.entry_date,
          'so',
          e.sort_order,
          'off',
          e.is_day_off,
          e.off_percent,
          'hrs',
          e.total_hours,
          'rate',
          getRateForDate(e.entry_date, rates, e.allowance_rate_override),
          diffs.join(', '),
        );
      }
    }
  } else if (shift === 'overtime') {
    const clockIn = (pi.default_clock_in || '17:00').slice(0, 5);
    recomputed = computeTotalSalaryTypeB(
      entries,
      allows,
      pi.base_salary,
      pi.hourly_rate,
      rates,
      clockIn,
      period!.off_days || [],
      period!.start_date,
      period!.end_date,
    );
    // Manual row walk for Type B
    const dailyBase = calcDailyBase(pi.base_salary);
    for (const e of entries) {
      if (e.is_day_off) continue;
      const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
      const baseIn = e.clock_in || clockIn;
      const clockHours =
        e.clock_out && baseIn && baseIn !== e.clock_out ? calcHoursFromTimes(baseIn, e.clock_out) : null;
      const hours = clockHours ?? e.total_hours ?? 0;
      const extraWage = roundToThousand(hours * pi.hourly_rate);
      const allowanceBase = e.sort_order > 0 ? extraWage : dailyBase + extraWage;
      const allowance = roundToThousand((allowanceBase * rate) / 100);
      if ((e.extra_wage || 0) !== extraWage || (e.allowance_amount || 0) !== allowance) {
        console.log('rowB', e.entry_date, 'so', e.sort_order, {
          in: e.clock_in,
          out: e.clock_out,
          hours,
          rate,
          extraStored: e.extra_wage,
          extraNow: extraWage,
          allowStored: e.allowance_amount,
          allowNow: allowance,
        });
      }
    }
  } else if (shift === 'notice_only') {
    recomputed = computeTotalSalaryTypeC(entries, allows, pi.hourly_rate, rates);
    for (const e of entries) {
      const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
      const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in, e.clock_out) ?? 0;
      const baseWage = roundToThousand(hours * pi.hourly_rate);
      const allowanceAmt = roundToThousand((baseWage * rate) / 100);
      const rowTotal = e.is_day_off ? 0 : baseWage + allowanceAmt;
      if ((e.total_daily_wage || 0) !== rowTotal || (e.allowance_amount || 0) !== allowanceAmt) {
        console.log('rowC', e.entry_date, {
          hours,
          rate,
          storedTotal: e.total_daily_wage,
          nowTotal: rowTotal,
          storedAllow: e.allowance_amount,
          nowAllow: allowanceAmt,
          in: e.clock_in,
          out: e.clock_out,
          th: e.total_hours,
        });
      }
    }
  } else if (shift === 'lunar_rate') {
    recomputed = computeTotalSalaryTypeD(entries, allows, 27000, 35000, rates);
    for (const e of entries) {
      const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in, e.clock_out) ?? 0;
      const matchedRate = rates.find((r: any) => r.special_date === e.entry_date);
      const isLunar = matchedRate?.day_type === 'new_moon' || matchedRate?.day_type === 'full_moon';
      const hourly = isLunar ? 35000 : 27000;
      const baseWage = roundToThousand(hours * hourly);
      const rowTotal = e.is_day_off ? 0 : baseWage;
      if ((e.total_daily_wage || 0) !== rowTotal) {
        console.log('rowD', e.entry_date, {
          hours,
          isLunar,
          day_type: matchedRate?.day_type,
          stored: e.total_daily_wage,
          now: rowTotal,
          in: e.clock_in,
          out: e.clock_out,
          th: e.total_hours,
        });
      }
    }
  }
  if (!recomputed) return;

  const oldAllowSum = (snap!.breakdown?.allowances || [])
    .filter((a: any) => a.enabled)
    .reduce((s: number, a: any) => s + a.amount, 0);
  const newAllowSum = recomputed.allowances.filter((a: any) => a.enabled).reduce((s: number, a: any) => s + a.amount, 0);
  console.log('delta total', recomputed.total - (snap!.total_salary || 0));
  console.log('delta daily', recomputed.total_daily_wages - (snap!.breakdown?.total_daily_wages || 0));
  console.log(
    'delta allowRates',
    recomputed.total_allowances_from_rates - (snap!.breakdown?.total_allowances_from_rates || 0),
  );
  console.log('delta deduct', recomputed.total_deductions - (snap!.breakdown?.total_deductions || 0));
  console.log('delta enabledAllowances', newAllowSum - oldAllowSum, 'old', oldAllowSum, 'new', newAllowSum);

  for (const a of recomputed.allowances) {
    const o = (snap!.breakdown?.allowances || []).find((x: any) => x.key === a.key);
    if (!o || o.amount !== a.amount || !!o.enabled !== !!a.enabled) {
      console.log('allowance diff', a.key, 'old', o, 'new', a);
    }
  }
}

async function main() {
  await dig('chilinh', '2026-03-26');
  await dig('chilinh', '2026-06-24');
  await dig('nhuyen', '2026-03-26');
  await dig('tphat', '2026-03-26');
  await dig('chioanh', '2026-04-25');
  await dig('ntruong', '2026-03-26');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
