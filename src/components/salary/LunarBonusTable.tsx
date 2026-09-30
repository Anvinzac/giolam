import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SalaryEntry } from '@/types/salary';
import {
  calcDailyBase,
  calcHoursFromTimes,
  formatDateViet,
  roundToThousand,
} from '@/lib/salaryCalculations';
/**
 * Correction ledger for the Aug-2026 lunar-date mix-up.
 *
 * The live rate computation currently applies the dynamic fallback:
 *   Aug 11 = 15% (should be 0%), Aug 12 = 40% (should be 15%),
 *   Aug 13 = 0%  (should be 40%).
 * For each employee the tab shows the four adjustment lines and the net:
 *   −40% on 12/08, −15% on 11/08 (if any), +15% on 12/08, +40% on 13/08.
 *
 * Loại D is hourly-based (27.000đ/h → 35.000đ/h): nothing to take back on
 * 11/12 (they were correctly paid the normal rate); its "add 40% on 13/08"
 * is the +8.000đ/h lunar bonus.
 */
const CORRECTION_DAYS = [
  { date: '2026-08-11', takeBackPct: 15, addPct: 0 },
  { date: '2026-08-12', takeBackPct: 40, addPct: 15 },
  { date: '2026-08-13', takeBackPct: 0, addPct: 40 },
] as const;

const LUNAR_BONUS_PER_HOUR = 8000; // 35.000 − 27.000 for Loại D

interface CorrectionEmployee {
  user_id: string;
  full_name: string;
  shift_type: string;
  base_salary: number;
  hourly_rate: number;
  default_clock_in: string | null;
}

interface LunarBonusTableProps {
  /** All employees of the current period view. */
  employees: CorrectionEmployee[];
  periodId: string | null;
  periodStart: string;
  periodEnd: string;
}

interface CorrectionLine {
  takeBack40Aug12: number;
  takeBack15Aug11: number;
  add15Aug12: number;
  add40Aug13: number;
}

interface CorrectionRow extends CorrectionLine {
  user_id: string;
  fullName: string;
  shiftType: string;
}

const fmtVnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

const ZERO_LINE: CorrectionLine = {
  takeBack40Aug12: 0,
  takeBack15Aug11: 0,
  add15Aug12: 0,
  add40Aug13: 0,
};

/**
 * Rate-driven premium for one date at one percentage, mirroring each
 * type's row formula (Type A/E primary = dailyBase-based; Type A/E
 * supplemental + Type B = hours-based with the dailyBase add-on for
 * Type B primary rows; Type C = pure hours × rate). Off days and
 * manual allowance_rate_override rows contribute nothing.
 */
function pctPremium(
  entries: SalaryEntry[],
  emp: CorrectionEmployee,
  date: string,
  pct: number,
): number {
  if (pct <= 0) return 0;
  if (emp.shift_type === 'lunar_rate') return 0; // hourly model, see below
  const dailyBase = calcDailyBase(emp.base_salary);
  let sum = 0;
  for (const e of entries) {
    if (e.entry_date !== date) continue;
    if (e.is_day_off) continue;
    if (e.allowance_rate_override !== null && e.allowance_rate_override !== undefined) continue;
    if (emp.shift_type === 'basic' || emp.shift_type === 'daily') {
      if (e.sort_order > 0) {
        const extraWage = e.total_hours ? roundToThousand(e.total_hours * emp.hourly_rate) : 0;
        sum += roundToThousand((extraWage * pct) / 100);
      } else {
        sum += roundToThousand((dailyBase * pct) / 100);
      }
    } else if (emp.shift_type === 'overtime') {
      const baseIn = e.clock_in || emp.default_clock_in || '17:00';
      const clockHours =
        e.clock_out && baseIn && baseIn !== e.clock_out
          ? calcHoursFromTimes(baseIn, e.clock_out)
          : null;
      const hours = clockHours ?? e.total_hours ?? 0;
      const extraWage = roundToThousand(hours * emp.hourly_rate);
      const allowanceBase = e.sort_order > 0 ? extraWage : dailyBase + extraWage;
      sum += roundToThousand((allowanceBase * pct) / 100);
    } else if (emp.shift_type === 'notice_only') {
      const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in, e.clock_out) ?? 0;
      const baseWage = roundToThousand(hours * emp.hourly_rate);
      sum += roundToThousand((baseWage * pct) / 100);
    }
  }
  return sum;
}

/** Loại D: the "add 40% on 13/08" line = +8.000đ/h lunar bonus (35k → 27k per hour worked). */
function lunarBonusAug13(entries: SalaryEntry[]): number {
  let sum = 0;
  for (const e of entries) {
    if (e.entry_date !== '2026-08-13') continue;
    const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in, e.clock_out) ?? 0;
    sum += roundToThousand(hours * LUNAR_BONUS_PER_HOUR);
  }
  return sum;
}

export default function LunarBonusTable({
  employees,
  periodId,
  periodStart,
  periodEnd,
}: LunarBonusTableProps) {
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const activeDates = useMemo(
    () => CORRECTION_DAYS.filter(d => d.date >= periodStart && d.date <= periodEnd),
    [periodStart, periodEnd]
  );

  useEffect(() => {
    let isMounted = true;
    const fetchEntries = async () => {
      if (!periodId || employees.length === 0 || activeDates.length === 0) {
        if (isMounted) { setEntries([]); setLoading(false); }
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('salary_entries')
        .select('*')
        .eq('period_id', periodId)
        .in('user_id', employees.map(e => e.user_id));
      if (!isMounted) return;
      setEntries((data || []) as SalaryEntry[]);
      setLoading(false);
    };
    fetchEntries();
    return () => { isMounted = false; };
  }, [periodId, employees, activeDates]);

  const rows = useMemo<CorrectionRow[]>(() => {
    const out: CorrectionRow[] = [];
    const inActive = (d: string) => activeDates.some(a => a.date === d);
    for (const emp of employees) {
      const mine = entries.filter(e => e.user_id === emp.user_id);
      if (!mine.some(e => activeDates.some(a => a.date === e.entry_date))) continue;
      const isTypeD = emp.shift_type === 'lunar_rate';
      const line: CorrectionLine = {
        takeBack40Aug12: inActive('2026-08-12') ? -pctPremium(mine, emp, '2026-08-12', 40) : 0,
        takeBack15Aug11: inActive('2026-08-11') ? -pctPremium(mine, emp, '2026-08-11', 15) : 0,
        add15Aug12: inActive('2026-08-12') ? pctPremium(mine, emp, '2026-08-12', 15) : 0,
        add40Aug13: inActive('2026-08-13')
          ? (isTypeD ? lunarBonusAug13(mine) : pctPremium(mine, emp, '2026-08-13', 40))
          : 0,
      };
      out.push({
        user_id: emp.user_id,
        fullName: emp.full_name,
        shiftType: emp.shift_type,
        ...line,
      });
    }
    out.sort((a, b) => {
      const totalA = a.takeBack40Aug12 + a.takeBack15Aug11 + a.add15Aug12 + a.add40Aug13;
      const totalB = b.takeBack40Aug12 + b.takeBack15Aug11 + b.add15Aug12 + b.add40Aug13;
      return totalB - totalA || a.fullName.localeCompare(b.fullName, 'vi');
    });
    return out;
  }, [entries, employees, activeDates]);

  const columnTotals = useMemo(() => {
    const t = { ...ZERO_LINE };
    for (const r of rows) {
      t.takeBack40Aug12 += r.takeBack40Aug12;
      t.takeBack15Aug11 += r.takeBack15Aug11;
      t.add15Aug12 += r.add15Aug12;
      t.add40Aug13 += r.add40Aug13;
    }
    return t;
  }, [rows]);

  const grandTotal =
    columnTotals.takeBack40Aug12 + columnTotals.takeBack15Aug11 +
    columnTotals.add15Aug12 + columnTotals.add40Aug13;

  if (activeDates.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground text-sm">
        Kỳ này không chứa các ngày 11–13/08 cần điều chỉnh
      </div>
    );
  }
  if (loading) {
    return <div className="glass-card p-6 text-center text-muted-foreground text-sm">Đang tải…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground text-sm">
        Không có dữ liệu chấm công trong các ngày 11–13/08
      </div>
    );
  }

  const fmtSigned = (v: number) =>
    `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtVnd(Math.abs(v))}`;
  const valueClass = (v: number) =>
    v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-muted-foreground/40';

  return (
    <div className="glass-card p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Điều chỉnh Mùng 1 — 11, 12 &amp; 13/08/2026
        </h3>
        <span className="text-[11px] text-muted-foreground">
          Trừ 40% 12/08 &amp; 15% 11/08 đang áp dụng sai · Cộng đúng 15% 12/08 &amp; 40% 13/08
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/40">
              <th className="text-left py-1.5 pr-2 font-semibold">Nhân viên</th>
              <th className="text-right py-1.5 pr-2 font-semibold">Trừ 40% (12/08)</th>
              <th className="text-right py-1.5 pr-2 font-semibold">Trừ 15% (11/08)</th>
              <th className="text-right py-1.5 pr-2 font-semibold">Cộng 15% (12/08)</th>
              <th className="text-right py-1.5 pr-2 font-semibold">Cộng 40% (13/08)</th>
              <th className="text-right py-1.5 font-semibold">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const total = r.takeBack40Aug12 + r.takeBack15Aug11 + r.add15Aug12 + r.add40Aug13;
              return (
                <tr key={r.user_id} className="border-b border-border/20">
                  <td className="py-1.5 pr-2 text-foreground">
                    {r.fullName}
                    {r.shiftType === 'lunar_rate' && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">Loại D</span>
                    )}
                  </td>
                  <td className={`py-1.5 pr-2 text-right tabular-nums ${valueClass(r.takeBack40Aug12)}`}>
                    {fmtSigned(r.takeBack40Aug12)}
                  </td>
                  <td className={`py-1.5 pr-2 text-right tabular-nums ${valueClass(r.takeBack15Aug11)}`}>
                    {fmtSigned(r.takeBack15Aug11)}
                  </td>
                  <td className={`py-1.5 pr-2 text-right tabular-nums ${valueClass(r.add15Aug12)}`}>
                    {fmtSigned(r.add15Aug12)}
                  </td>
                  <td className={`py-1.5 pr-2 text-right tabular-nums ${valueClass(r.add40Aug13)}`}>
                    {fmtSigned(r.add40Aug13)}
                  </td>
                  <td className={`py-1.5 text-right tabular-nums font-semibold ${valueClass(total)}`}>
                    {fmtSigned(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/40">
              <td className="pt-2 pr-2 text-right text-[12px] text-muted-foreground font-medium">Tổng cộng</td>
              <td className={`pt-2 pr-2 text-right text-[12px] tabular-nums font-semibold ${valueClass(columnTotals.takeBack40Aug12)}`}>
                {fmtSigned(columnTotals.takeBack40Aug12)}
              </td>
              <td className={`pt-2 pr-2 text-right text-[12px] tabular-nums font-semibold ${valueClass(columnTotals.takeBack15Aug11)}`}>
                {fmtSigned(columnTotals.takeBack15Aug11)}
              </td>
              <td className={`pt-2 pr-2 text-right text-[12px] tabular-nums font-semibold ${valueClass(columnTotals.add15Aug12)}`}>
                {fmtSigned(columnTotals.add15Aug12)}
              </td>
              <td className={`pt-2 pr-2 text-right text-[12px] tabular-nums font-semibold ${valueClass(columnTotals.add40Aug13)}`}>
                {fmtSigned(columnTotals.add40Aug13)}
              </td>
              <td className={`pt-2 text-right text-[13px] font-bold tabular-nums ${valueClass(grandTotal)}`}>
                {fmtSigned(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/20">
        Tổng = cộng các dòng bên trái · dấu − là số tiền cần trừ lại, + là số tiền cần cộng thêm ·
        Loại D được tính theo lương giờ (35.000đ/h ngày 13/08) · ô “—” = không phát sinh
      </p>
    </div>
  );
}

