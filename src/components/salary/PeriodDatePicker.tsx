import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { SpecialDayRate, SalaryEntry } from '@/types/salary';

interface PeriodDatePickerProps {
  periodStart: string;  // YYYY-MM-DD
  periodEnd: string;    // YYYY-MM-DD
  rates: SpecialDayRate[];
  entries: SalaryEntry[];
  onSelect: (date: string) => void;
  onClose: () => void;
}

const DAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function jsToMonFirst(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function toPaddedDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function PeriodDatePicker({
  periodStart, periodEnd, rates, entries, onSelect, onClose,
}: PeriodDatePickerProps) {
  const entryMap = useMemo(() => {
    const map = new Map<string, SalaryEntry>();
    for (const e of entries) {
      const existing = map.get(e.entry_date);
      if (!existing || e.sort_order < existing.sort_order) map.set(e.entry_date, e);
    }
    return map;
  }, [entries]);

  const cells = useMemo(() => {
    if (!periodStart || !periodEnd) return [];
    const start = new Date(periodStart + 'T00:00:00');
    const end = new Date(periodEnd + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
    const result: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      result.push(toPaddedDate(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()));
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [periodStart, periodEnd]);

  const leadingEmpties = useMemo(() => {
    if (cells.length === 0) return 0;
    return jsToMonFirst(new Date(cells[0] + 'T00:00:00').getDay());
  }, [cells]);

  const allSlots: Array<string | null> = [...Array(leadingEmpties).fill(null), ...cells];
  const remainder = allSlots.length % 7;
  if (remainder !== 0) for (let i = 0; i < 7 - remainder; i++) allSlots.push(null);

  const getDayColor = (dateStr: string) => {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    if (dow === 6) return 'text-[hsl(175,70%,45%)]';
    if (dow === 0) return 'text-[hsl(280,60%,55%)]';
    return 'text-foreground';
  };

  return (
    <>
      {/* Backdrop — closes picker on outside tap */}
      <div className="fixed inset-0 z-10" onClick={onClose} />

    <div className="overflow-hidden border-b border-border/20 relative z-20">
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <div className="px-2 pt-2 pb-1">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map((h, i) => (
              <div key={h} className={`text-center text-[10px] font-semibold py-0.5 ${
                i === 5 ? 'text-[hsl(175,70%,45%)]' : i === 6 ? 'text-[hsl(280,60%,55%)]' : 'text-muted-foreground'
              }`}>{h}</div>
            ))}
          </div>

          {/* Date grid */}
          <div className="grid grid-cols-7">
            {allSlots.map((dateStr, idx) => {
              if (!dateStr) return <div key={`e-${idx}`} />;

              const entry = entryMap.get(dateStr);
              const isOff = entry?.is_day_off === true;
              const d = new Date(dateStr + 'T00:00:00');
              const dayNum = d.getDate();
              const isFirstOfMonth = dayNum === 1;

              return (
                <button
                  key={dateStr}
                  onClick={() => !isOff && onSelect(dateStr)}
                  disabled={isOff}
                  className={`relative text-center py-1.5 text-[13px] font-medium leading-none transition-opacity active:scale-90 ${
                    isOff
                      ? 'text-muted-foreground/40 cursor-default'
                      : `${getDayColor(dateStr)} hover:opacity-60 cursor-pointer`
                  }`}
                >
                  {isFirstOfMonth && (
                    <span className="absolute top-0 left-0.5 text-[7px] text-muted-foreground/50 leading-none">
                      {String(d.getMonth() + 1).padStart(2, '0')}
                    </span>
                  )}
                  <span className={isFirstOfMonth ? 'mt-2 block' : ''}>{dayNum}</span>
                </button>
              );
            })}
          </div>

          {/* Close */}
          <div className="flex justify-end mt-1.5 pt-1 border-t border-border/20">
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/50"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
    </>
  );
}
