import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { SpecialDayRate, SalaryEntry } from '@/types/salary';
import { getMoonEmoji } from '@/lib/lunarUtils';

interface PeriodDatePickerProps {
  periodStart: string;  // YYYY-MM-DD
  periodEnd: string;    // YYYY-MM-DD
  rates: SpecialDayRate[];
  entries: SalaryEntry[];
  onSelect: (date: string) => void;
  onClose: () => void;
}

const DAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Convert JS getDay() (0=Sun,6=Sat) to Mon-first index (0=Mon,...,6=Sun)
function jsToMonFirst(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function toPaddedDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function PeriodDatePicker({
  periodStart,
  periodEnd,
  rates,
  entries,
  onSelect,
  onClose,
}: PeriodDatePickerProps) {
  // Build a Map<date-string, SpecialDayRate> from rates
  const rateMap = useMemo(() => {
    const map = new Map<string, SpecialDayRate>();
    for (const r of rates) {
      map.set(r.special_date, r);
    }
    return map;
  }, [rates]);

  // Build a Map<date-string, SalaryEntry> — prefer lowest sort_order per date
  const entryMap = useMemo(() => {
    const map = new Map<string, SalaryEntry>();
    for (const e of entries) {
      const existing = map.get(e.entry_date);
      if (!existing || e.sort_order < existing.sort_order) {
        map.set(e.entry_date, e);
      }
    }
    return map;
  }, [entries]);

  // Build the array of day cells between periodStart and periodEnd
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

  // How many empty padding cells before the first date
  const leadingEmpties = useMemo(() => {
    if (cells.length === 0) return 0;
    const first = new Date(cells[0] + 'T00:00:00');
    return jsToMonFirst(first.getDay());
  }, [cells]);

  const getDayTextColor = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay();
    if (dow === 6) return 'text-[hsl(175,70%,45%)]';
    if (dow === 0) return 'text-[hsl(280,60%,55%)]';
    return '';
  };

  const getCellBgAndEmoji = (dateStr: string): { bg: string; emoji: string | null } => {
    const rate = rateMap.get(dateStr);
    if (rate) {
      switch (rate.day_type) {
        case 'new_moon':
          return { bg: 'bg-amber-500/15', emoji: '🌑' };
        case 'full_moon':
          return { bg: 'bg-indigo-400/15', emoji: '🌕' };
        case 'day_before_new_moon':
        case 'day_before_full_moon':
          return { bg: 'bg-amber-500/7', emoji: null };
        case 'public_holiday':
          return { bg: 'bg-rose-500/10', emoji: null };
        default:
          return { bg: '', emoji: null };
      }
    }
    // Not in rates — check getMoonEmoji as fallback
    const moon = getMoonEmoji(new Date(dateStr + 'T00:00:00'));
    if (moon === '🌑' || moon === '🌕') {
      return { bg: '', emoji: moon };
    }
    return { bg: '', emoji: null };
  };

  const getPublicHolidayColor = (dateStr: string): string => {
    const rate = rateMap.get(dateStr);
    if (rate?.day_type === 'public_holiday') return 'text-rose-400';
    return '';
  };

  const handleCellClick = (dateStr: string) => {
    const entry = entryMap.get(dateStr);
    if (entry?.is_day_off) return; // off-day — not re-addable
    onSelect(dateStr);
  };

  const totalCols = 7;
  // Flatten into a grid row by row
  const allSlots: Array<string | null> = [
    ...Array(leadingEmpties).fill(null),
    ...cells,
  ];
  // Pad to full rows
  const remainder = allSlots.length % totalCols;
  if (remainder !== 0) {
    for (let i = 0; i < totalCols - remainder; i++) {
      allSlots.push(null);
    }
  }

  return (
    <div className="overflow-hidden border-b border-border/20">
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <div className="px-2 pt-2 pb-1">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map((h, i) => (
              <div
                key={h}
                className={`text-center text-[10px] font-semibold py-0.5 ${
                  i === 5
                    ? 'text-[hsl(175,70%,45%)]'
                    : i === 6
                    ? 'text-[hsl(280,60%,55%)]'
                    : 'text-muted-foreground'
                }`}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {allSlots.map((dateStr, idx) => {
              if (!dateStr) {
                return <div key={`empty-${idx}`} />;
              }

              const entry = entryMap.get(dateStr);
              const { bg, emoji } = getCellBgAndEmoji(dateStr);
              const textColor = getDayTextColor(dateStr);
              const holidayColor = getPublicHolidayColor(dateStr);

              const isAdded = !!entry;
              const isOff = entry?.is_day_off === true;
              const isWorkday = entry && !entry.is_day_off;

              const d = new Date(dateStr + 'T00:00:00');
              const dayNum = d.getDate();
              const month = d.getMonth() + 1;
              const isFirstOfMonth = dayNum === 1;

              let cellStateClasses = '';
              let interactClasses = '';

              if (isOff) {
                // Off-day: grayed out, not re-addable
                cellStateClasses = 'opacity-35';
                interactClasses = 'cursor-default';
              } else if (isWorkday) {
                // Working day: ringed but still tappable for a duplicate/note row
                cellStateClasses = 'ring-1 ring-primary/40 bg-primary/10';
                interactClasses = 'cursor-pointer hover:bg-primary/20 active:scale-90 transition-transform';
              } else {
                // Free date — tappable
                interactClasses =
                  'cursor-pointer hover:bg-muted/50 active:scale-90 transition-transform';
              }

              return (
                <button
                  key={dateStr}
                  onClick={() => handleCellClick(dateStr)}
                  disabled={isOff}
                  className={[
                    'relative flex flex-col items-center justify-start rounded py-0.5 min-h-[36px]',
                    bg,
                    textColor,
                    holidayColor,
                    cellStateClasses,
                    interactClasses,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {/* Superscript month label for 1st of month */}
                  {isFirstOfMonth && (
                    <span className="absolute top-0 left-0.5 text-[8px] leading-none text-muted-foreground font-medium">
                      {String(month).padStart(2, '0')}
                    </span>
                  )}

                  {/* Day number */}
                  <span className={`text-[13px] font-medium leading-tight ${isFirstOfMonth ? 'mt-2' : 'mt-1'}`}>
                    {dayNum}
                  </span>

                  {/* Moon emoji */}
                  {emoji && (
                    <span className="text-[9px] leading-none">{emoji}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer: legend + close */}
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-[11px]">🌑</span>
                <span className="text-[10px] text-muted-foreground">Mùng 1</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px]">🌕</span>
                <span className="text-[10px] text-muted-foreground">Rằm</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-500/20 border border-rose-500/30" />
                <span className="text-[10px] text-muted-foreground">Lễ</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/50"
              aria-label="Đóng"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
