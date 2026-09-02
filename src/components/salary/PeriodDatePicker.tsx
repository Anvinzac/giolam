import { useState, useMemo, useRef, useEffect, PointerEvent as ReactPointerEvent } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { SpecialDayRate, SalaryEntry } from '@/types/salary';
import { generateDateRange } from '@/lib/salaryPaging';

interface PeriodDatePickerProps {
  periodStart: string;  // YYYY-MM-DD
  periodEnd: string;    // YYYY-MM-DD
  rates: SpecialDayRate[];
  entries: SalaryEntry[];
  onSelect: (date: string) => void;
  onClose: () => void;
}

const DAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 12;

function formatDayMonth(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

function jsToMonFirst(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function toPaddedDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function PeriodDatePicker({
  periodStart, periodEnd, rates, entries, onSelect, onClose,
}: PeriodDatePickerProps) {
  // Initialize view to the month containing periodStart (or current month)
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (periodStart) {
      const d = new Date(periodStart + 'T00:00:00');
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Slide direction of the last month change, for the flick transition
  const [direction, setDirection] = useState(0);

  const entryMap = useMemo(() => {
    const map = new Map<string, SalaryEntry>();
    for (const e of entries) {
      const existing = map.get(e.entry_date);
      if (!existing || e.sort_order < existing.sort_order) map.set(e.entry_date, e);
    }
    return map;
  }, [entries]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed

  const { cells, leadingEmpties } = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1);
    const leading = jsToMonFirst(firstDay.getDay());

    const dayCells: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      dayCells.push(toPaddedDate(year, month + 1, d));
    }

    return { cells: dayCells, leadingEmpties: leading };
  }, [year, month]);

  const allSlots: Array<string | null> = useMemo(() => {
    const slots: Array<string | null> = [...Array(leadingEmpties).fill(null), ...cells];
    const remainder = slots.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) slots.push(null);
    }
    return slots;
  }, [leadingEmpties, cells]);

  const getDayColor = (dateStr: string) => {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    if (dow === 6) return 'text-saturday';
    if (dow === 0) return 'text-[hsl(280,60%,55%)]';
    return 'text-foreground';
  };

  const goToMonth = (delta: number) => {
    setDirection(delta);
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const handlePrevMonth = () => goToMonth(-1);

  const handleNextMonth = () => goToMonth(1);

  // Flick / swipe on the grid moves between months
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 40;
    if (info.offset.x < -threshold) {
      goToMonth(1);
    } else if (info.offset.x > threshold) {
      goToMonth(-1);
    }
  };

  const handleResetPeriod = () => {
    if (periodStart) {
      const d = new Date(periodStart + 'T00:00:00');
      if (!isNaN(d.getTime())) setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  // Long-press a date to start a consecutive range; the next tap is the end.
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const rangeAnchorRef = useRef<string | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const setAnchor = (date: string | null) => {
    rangeAnchorRef.current = date;
    setRangeAnchor(date);
  };

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => () => clearHoldTimer(), []);

  const handleDatePointerDown = (e: ReactPointerEvent<HTMLButtonElement>, dateStr: string) => {
    if (e.button > 0) return;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    suppressClickRef.current = false;
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      suppressClickRef.current = true;
      setAnchor(dateStr);
      try { navigator.vibrate?.(15); } catch { /* unsupported */ }
    }, LONG_PRESS_MS);
  };

  const handleDatePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!startPosRef.current || holdTimerRef.current === null) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
      clearHoldTimer();
    }
  };

  const handleDatePointerEnd = () => {
    clearHoldTimer();
    startPosRef.current = null;
  };

  const handleDateClick = (dateStr: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const anchor = rangeAnchorRef.current;
    if (anchor) {
      const start = dateStr < anchor ? dateStr : anchor;
      const end = dateStr < anchor ? anchor : dateStr;
      for (const d of generateDateRange(start, end)) onSelect(d);
      setAnchor(null);
      return;
    }
    onSelect(dateStr);
  };

  return (
    <>
      {/* Backdrop — closes picker on outside tap */}
      <div className="fixed inset-0 z-10" onClick={onClose} />

      <div className="overflow-hidden border-b border-border/20 relative z-20 bg-background/95 backdrop-blur-sm">
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div className="px-3 pt-2.5 pb-2">
            {/* Header: Month switcher & Reset */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Tháng trước"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="font-display font-semibold text-xs text-foreground tracking-wide">
                  Tháng {String(month + 1).padStart(2, '0')}/{year}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Tháng sau"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                {periodStart && (
                  <button
                    onClick={handleResetPeriod}
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline px-1.5 py-0.5 rounded bg-primary/10 transition-colors"
                    title="Quay lại tháng của kỳ làm việc"
                  >
                    <Calendar size={11} />
                    <span>Kỳ hiện tại</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted/50 transition-colors"
                  aria-label="Đóng"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1 gap-1">
              {DAY_HEADERS.map((h, i) => (
                <div
                  key={h}
                  className={`text-center text-[10px] font-semibold py-0.5 ${
                    i === 5 ? 'text-saturday' : i === 6 ? 'text-[hsl(280,60%,55%)]' : 'text-muted-foreground'
                  }`}
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Date grid — flick left/right to change month */}
            <div className="relative overflow-hidden">
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={`${year}-${month}`}
                  custom={direction}
                  initial={{ x: direction >= 0 ? '40%' : '-40%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: direction >= 0 ? '-40%' : '40%', opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.15}
                  onDragEnd={handleDragEnd}
                  className="grid grid-cols-7 gap-1 touch-pan-y"
                >
                  {allSlots.map((dateStr, idx) => {
                    if (!dateStr) return <div key={`e-${idx}`} className="h-8" />;

                    const entry = entryMap.get(dateStr);
                    const isOff = entry?.is_day_off === true;
                    const hasEntry = !!entry;
                    const isInRange = !!(periodStart && periodEnd && dateStr >= periodStart && dateStr <= periodEnd);
                    const d = new Date(dateStr + 'T00:00:00');
                    const dayNum = d.getDate();

                    const isAnchor = rangeAnchor === dateStr;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => handleDateClick(dateStr)}
                        onPointerDown={(e) => handleDatePointerDown(e, dateStr)}
                        onPointerMove={handleDatePointerMove}
                        onPointerUp={handleDatePointerEnd}
                        onPointerCancel={handleDatePointerEnd}
                        onContextMenu={(e) => e.preventDefault()}
                        aria-pressed={isAnchor}
                        className={`relative flex flex-col items-center justify-center h-8 rounded-lg text-[12px] font-medium transition-all active:scale-90 select-none [-webkit-touch-callout:none] ${
                          isAnchor
                            ? 'bg-primary text-primary-foreground font-bold border border-primary shadow-sm ring-2 ring-primary/40'
                            : isInRange
                            ? 'bg-primary/15 text-primary font-bold border border-primary/35 shadow-sm hover:bg-primary/25'
                            : 'border border-dashed border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/50'
                        } ${isOff && !isAnchor ? 'opacity-50 text-destructive/80' : !isAnchor ? getDayColor(dateStr) : ''}`}
                        title={`${dateStr} ${isInRange ? '(Trong kỳ)' : '(Ngoài kỳ - Thêm công)'}`}
                      >
                        <span>{dayNum}</span>
                        {hasEntry && !isOff && (
                          <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary/70" />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer: range prompt, or color legend */}
            {rangeAnchor ? (
              <div className="flex items-center justify-between text-[10px] mt-2 pt-1 border-t border-border/20">
                <span className="text-primary font-medium">
                  Từ {formatDayMonth(rangeAnchor)} — chạm ngày kết thúc
                </span>
                <button
                  onClick={() => setAnchor(null)}
                  className="text-muted-foreground px-1.5 py-0.5 rounded"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 pt-1 border-t border-border/20">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-primary/20 border border-primary/40 inline-block" />
                  <span>Trong kỳ làm việc</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-border/80 inline-block" />
                  <span>Ngoài kỳ (Cộng thêm)</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
