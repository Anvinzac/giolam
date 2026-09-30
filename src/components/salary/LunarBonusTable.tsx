import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SpecialDayRate, SalaryEntry, DAY_TYPE_LABELS } from '@/types/salary';
import { calcHoursFromTimes, formatDateViet, roundToThousand } from '@/lib/salaryCalculations';

/** Type D pay constants — must stay in sync with computeTotalSalaryTypeD callers. */
const NORMAL_RATE = 27000;
const LUNAR_RATE = 35000;
export const LUNAR_BONUS_PER_HOUR = LUNAR_RATE - NORMAL_RATE;

interface LunarEmployee {
  user_id: string;
  full_name: string;
}

interface LunarBonusTableProps {
  /** Loại D employees of the current period view. */
  employees: LunarEmployee[];
  rates: SpecialDayRate[];
  periodId: string | null;
}

interface BonusRow {
  user_id: string;
  fullName: string;
  date: string;
  dayLabel: string;
  hours: number;
  bonus: number;
}

const fmtVnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

/**
 * Per-employee breakdown of the Loại D lunar hourly bonus
 * (27.000đ/h normally → 35.000đ/h on Mùng 1 & Rằm, i.e. +8.000đ/h)
 * for the selected period, so admins can see who got how much added.
 */
export default function LunarBonusTable({ employees, rates, periodId }: LunarBonusTableProps) {
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const lunarDates = useMemo(
    () => rates.filter(r => r.day_type === 'new_moon' || r.day_type === 'full_moon'),
    [rates]
  );
  const lunarDateSet = useMemo(() => new Set(lunarDates.map(r => r.special_date)), [lunarDates]);
  const dayLabelFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of lunarDates) m.set(r.special_date, DAY_TYPE_LABELS[r.day_type] ?? r.day_type);
    return m;
  }, [lunarDates]);

  useEffect(() => {
    let isMounted = true;
    const fetchEntries = async () => {
      if (!periodId || employees.length === 0) {
        if (isMounted) { setEntries([]); setLoading(false); }
        return;
      }
      setLoading(true);
      const ids = employees.map(e => e.user_id);
      const { data } = await supabase
        .from('salary_entries')
        .select('*')
        .eq('period_id', periodId)
        .in('user_id', ids);
      if (!isMounted) return;
      setEntries((data || []) as SalaryEntry[]);
      setLoading(false);
    };
    fetchEntries();
    return () => { isMounted = false; };
  }, [periodId, employees]);

  const rows = useMemo<BonusRow[]>(() => {
    const nameById = new Map(employees.map(e => [e.user_id, e.full_name]));
    const out: BonusRow[] = [];
    for (const e of entries) {
      if (!lunarDateSet.has(e.entry_date) || e.is_day_off) continue;
      const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in, e.clock_out) ?? 0;
      if (hours <= 0) continue;
      out.push({
        user_id: e.user_id,
        fullName: nameById.get(e.user_id) || '—',
        date: e.entry_date,
        dayLabel: dayLabelFor.get(e.entry_date) || '',
        hours,
        bonus: roundToThousand(hours * LUNAR_BONUS_PER_HOUR),
      });
    }
    out.sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'vi') || a.date.localeCompare(b.date));
    return out;
  }, [entries, employees, lunarDateSet, dayLabelFor]);

  const totalByEmployee = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.user_id, (m.get(r.user_id) || 0) + r.bonus);
    return m;
  }, [rows]);

  const grandTotal = useMemo(
    () => rows.reduce((s, r) => s + r.bonus, 0),
    [rows]
  );

  if (loading) {
    return <div className="glass-card p-6 text-center text-muted-foreground text-sm">Đang tải…</div>;
  }

  if (employees.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground text-sm">
        Không có nhân viên Loại D trong kỳ này
      </div>
    );
  }

  return (
    <div className="glass-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Bonus lunar (Loại D)
        </h3>
        <span className="text-[11px] text-muted-foreground">
          27.000đ/h → 35.000đ/h ngày Mùng 1 & Rằm (+8.000đ/h)
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground text-xs">
          Không có ngày làm việc trùng Mùng 1 / Rằm trong kỳ này
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/40">
                <th className="text-left py-1.5 pr-2 font-semibold">Nhân viên</th>
                <th className="text-left py-1.5 pr-2 font-semibold">Ngày</th>
                <th className="text-right py-1.5 pr-2 font-semibold">Giờ</th>
                <th className="text-right py-1.5 pr-2 font-semibold">Tăng thêm</th>
                <th className="text-right py-1.5 font-semibold">Tổng NV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={`${r.user_id}-${r.date}`} className="border-b border-border/20">
                  <td className="py-1.5 pr-2 text-foreground">{r.fullName}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">
                    {formatDateViet(r.date)}
                    {r.dayLabel && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400">
                        {r.dayLabel}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right text-foreground tabular-nums">{r.hours}h</td>
                  <td className="py-1.5 pr-2 text-right text-accent font-medium tabular-nums">
                    +{fmtVnd(r.bonus)}
                  </td>
                  <td className="py-1.5 text-right text-primary font-semibold tabular-nums">
                    {fmtVnd(totalByEmployee.get(r.user_id) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="pt-2 text-right text-[12px] text-muted-foreground font-medium">
                  Tổng cộng kỳ này
                </td>
                <td className="pt-2 text-right text-[13px] font-bold text-primary tabular-nums">
                  {fmtVnd(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}