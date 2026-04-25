import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Plus, Trash2, Clock, Check } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcDailyBase, calcHoursFromTimes, getRateForDate, formatDateViet, formatVND } from '@/lib/salaryCalculations';
import { generateDateRange, splitIntoPages } from '@/lib/salaryPaging';
import SwipeablePages from './SwipeablePages';
import EmployeeAllowanceEditor from './EmployeeAllowanceEditor';
import TotalSalaryDisplay from './TotalSalaryDisplay';
import SalaryBreakdownPopup from './SalaryBreakdownPopup';

interface SalaryTableTypeBProps {
  entries: SalaryEntry[];
  rates: SpecialDayRate[];
  allowances: EmployeeAllowance[];
  baseSalary: number;
  hourlyRate: number;
  periodStart: string;
  periodEnd: string;
  onEntryUpdate: (entryDate: string, sortOrder: number, updates: Partial<SalaryEntry>) => void;
  onAddDuplicateRow: (entryDate: string) => void;
  onRemoveEntry: (id: string) => void;
  onAllowanceToggle: (key: AllowanceKey) => void;
  onAllowanceUpdate: (key: AllowanceKey, updates: { label?: string; amount?: number }) => void;
  onAddAllowance?: (label: string, amount: number) => void;
  onHourlyRateChange: (rate: number) => void;
  globalClockIn: string;
  onGlobalClockInChange: (time: string) => void;
  breakdown: SalaryBreakdown | null;
  isPreview?: boolean;
  editMode?: 'admin' | 'employee' | 'preview';
  onAcceptEntry?: (id: string) => void;
  currentUserId?: string | null;
}

// ── Time helpers ──────────────────────────────────────────────────────────────
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function formatMinutesToTime(totalMins: number): string {
  const clamped = Math.max(0, Math.min(1439, totalMins));
  return `${Math.floor(clamped / 60).toString().padStart(2, '0')}:${(clamped % 60).toString().padStart(2, '0')}`;
}
// Offsets (minutes) from the row's clock-in time to suggest as clock-out chips.
// The first 4 and last 4 are "extra" — hidden behind a fade mask so the user
// must scroll to reveal them; the middle 6 are the defaults initially visible.
const CHIP_OFFSETS_LEFT = [-120, -90, -60, -30];
const CHIP_OFFSETS_CORE = [30, 60, 90, 120, 150, 180];
const CHIP_OFFSETS_RIGHT = [210, 240, 270, 300];
const CHIP_OFFSETS_ALL = [
  ...CHIP_OFFSETS_LEFT,
  ...CHIP_OFFSETS_CORE,
  ...CHIP_OFFSETS_RIGHT,
];
const CHIP_CORE_START_INDEX = CHIP_OFFSETS_LEFT.length;

function getClockOutChips(clockIn: string): string[] {
  const base = parseTimeToMinutes(clockIn);
  return CHIP_OFFSETS_ALL.map(offset => formatMinutesToTime(base + offset));
}

const CHIP_FADE_MASK =
  'linear-gradient(to right, transparent 0, black 28px, black calc(100% - 28px), transparent 100%)';

export default function SalaryTableTypeB({
  entries, rates, allowances, baseSalary, hourlyRate,
  periodStart, periodEnd,
  onEntryUpdate, onAddDuplicateRow, onRemoveEntry,
  onAllowanceToggle, onAllowanceUpdate, onAddAllowance, onHourlyRateChange,
  globalClockIn, onGlobalClockInChange,
  breakdown,
  isPreview = false,
  editMode, onAcceptEntry, currentUserId,
}: SalaryTableTypeBProps) {
  const mode: 'admin' | 'employee' | 'preview' = editMode ?? (isPreview ? 'preview' : 'admin');
  const readOnly = mode === 'preview';
  const canDeleteRow = (e: SalaryEntry) =>
    mode === 'admin' || (mode === 'employee' && e.is_admin_reviewed === false);
  const tableGridClass = 'sm:grid-cols-[70px_minmax(120px,1fr)_50px_40px_55px_60px_75px]';
  const tableGapClass = 'sm:gap-1.5 sm:px-1';
  const [currentPage, setCurrentPage] = useState(0);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Chip state for sequential clock-out entry
  const [chipRowKey, setChipRowKey] = useState<string | null>(null);
  const chipAutoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Scroller refs keyed by "{cellKey}-{variant}" so we can align each chip row
  // so the first *core* chip sits near the left edge (extras to the left live
  // behind the fade mask and are discoverable by scrolling back).
  const chipScrollRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const registerChipScroller = (key: string) => (el: HTMLDivElement | null) => {
    if (el) chipScrollRefs.current.set(key, el);
    else chipScrollRefs.current.delete(key);
  };

  useEffect(() => {
    if (!chipRowKey) return;
    // Align the just-activated row's chip scroller so the first core chip is
    // at the left edge. Use rAF so refs are populated after the render.
    const raf = requestAnimationFrame(() => {
      chipScrollRefs.current.forEach((scroller, key) => {
        if (!scroller) return;
        if (!key.startsWith(chipRowKey)) return;
        const coreChip = scroller.querySelector<HTMLElement>('[data-chip-core-start="true"]');
        if (coreChip) {
          scroller.scrollLeft = coreChip.offsetLeft - scroller.offsetLeft;
        }
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [chipRowKey]);

  // Double-tap ref for day-off toggle on date
  const lastTapRef = useRef<{ key: string; time: number } | null>(null);

  const dailyBase = useMemo(() => calcDailyBase(baseSalary), [baseSalary]);
  const pages = useMemo(() => splitIntoPages(periodStart, periodEnd, entries), [periodStart, periodEnd, entries]);

  const guiXeSummary = useMemo(() => {
    const fromBreakdown = breakdown?.allowances?.find(a => a.key === 'gui_xe');
    const offDaysCount = entries.reduce((sum, e) => sum + (e.is_day_off ? 1 : 0), 0);
    const computedAmount = (28 - offDaysCount) * 10000;
    return {
      amount: fromBreakdown?.amount ?? computedAmount,
      enabled: fromBreakdown?.enabled ?? (allowances.find(a => a.allowance_key === 'gui_xe')?.is_enabled ?? false),
    };
  }, [breakdown, entries, allowances]);

  // NOTE: `computeRow` MUST be declared before this `dailyTotals` useMemo —
  // the factory runs synchronously during render, and `.map(e => computeRow(e))`
  // accesses `computeRow` immediately. With const arrow functions that's a
  // temporal-dead-zone ReferenceError ("Cannot access X before initialization")
  // and the whole page blanks. Same hazard already bit Type C; mirror that fix.
  const computeRow = (e: SalaryEntry) => {
    const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
    const allowance = roundToThousand(dailyBase * rate / 100);
    const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in || globalClockIn, e.clock_out) ?? 0;
    const extraWage = roundToThousand(hours * hourlyRate);
    const total = e.is_day_off ? 0 : dailyBase + allowance + extraWage;
    return { rate, allowance, hours, extraWage, total };
  };

  const dailyTotals = useMemo(() =>
    entries.map(e => computeRow(e).total),
    [entries, dailyBase, rates, hourlyRate, globalClockIn]
  );

  // ── Chip helpers ────────────────────────────────────────────────────────────
  const startChipAutoHide = (rowKey: string) => {
    if (chipAutoHideTimerRef.current) clearTimeout(chipAutoHideTimerRef.current);
    chipAutoHideTimerRef.current = setTimeout(() => {
      setChipRowKey(prev => (prev === rowKey ? null : prev));
      chipAutoHideTimerRef.current = null;
    }, 3000);
  };

  const showRowChips = (rowKey: string) => {
    if (chipAutoHideTimerRef.current) clearTimeout(chipAutoHideTimerRef.current);
    setChipRowKey(rowKey);
    startChipAutoHide(rowKey);
  };

  const handleChipSelect = (entry: SalaryEntry, pageEntries: SalaryEntry[], clockOut: string) => {
    onEntryUpdate(entry.entry_date, entry.sort_order, { clock_out: clockOut });

    // Advance to next non-off-day entry in same page
    const currentIdx = pageEntries.findIndex(
      e => e.entry_date === entry.entry_date && e.sort_order === entry.sort_order
    );
    let nextEntry: SalaryEntry | null = null;
    for (let i = currentIdx + 1; i < pageEntries.length; i++) {
      if (!pageEntries[i].is_day_off) {
        nextEntry = pageEntries[i];
        break;
      }
    }

    if (nextEntry) {
      const nextKey = `${nextEntry.entry_date}-${nextEntry.sort_order}`;
      showRowChips(nextKey);
    } else {
      setChipRowKey(null);
    }
  };

  // ── Day helpers ─────────────────────────────────────────────────────────────
  const getDayColor = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    if (day === 6) return 'text-saturday';
    if (day === 0) return 'text-[hsl(280,60%,55%)]';
    return '';
  };

  const handleDateTap = (entry: SalaryEntry) => {
    if (readOnly) return;
    const key = `${entry.entry_date}-${entry.sort_order}`;
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.key === key && now - last.time < 300) {
      // Double tap → toggle day off
      onEntryUpdate(entry.entry_date, entry.sort_order, {
        is_day_off: !entry.is_day_off,
      });
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { key, time: now };
    }
  };

  const activateEmptyDay = (entryDate: string) => {
    if (readOnly) return;
    const rowKey = `${entryDate}-0`;
    onEntryUpdate(entryDate, 0, {
      is_day_off: false,
      clock_in: globalClockIn,
      clock_out: null,
      total_hours: null,
      note: null,
    });
    showRowChips(rowKey);
  };

  const startCellEdit = (key: string, val: string) => {
    setEditingCell(key);
    setCellValue(val);
  };

  const saveCellEdit = (entryDate: string, sortOrder: number, field: string, overrideValue?: string) => {
    const nextValue = overrideValue ?? cellValue;
    const updates: Partial<SalaryEntry> = {};
    if (field === 'note') updates.note = nextValue || null;
    if (field === 'total_hours') updates.total_hours = parseFloat(nextValue) || null;
    onEntryUpdate(entryDate, sortOrder, updates);
    setEditingCell(null);
  };

  const formatHours = (hours: number) => {
    if (hours <= 0) return '—';
    return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
  };

  const formatClockDecimal = (time: string | null) => {
    if (!time) return '—';
    const [hoursStr, minutesStr] = time.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return '—';
    const decimalHours = hours + minutes / 60;
    return Number.isInteger(decimalHours) ? `${decimalHours}` : decimalHours.toFixed(1);
  };

  const formatCompact = (amount: number) => {
    if (amount === 0) return '0';
    return `${amount / 1000}`;
  };

  const formatDayOnly = (dateStr: string) => dateStr.slice(8, 10);

  // ── Chip row renderer ──────────────────────────────────────────────────────
  const renderChips = (entry: SalaryEntry, pageEntries: SalaryEntry[]) => {
    const baseTime = entry.clock_in || globalClockIn;
    const chips = getClockOutChips(baseTime);
    const cellKey = `${entry.entry_date}-${entry.sort_order}`;
    return (
      <div
        className="relative flex-1 min-w-0"
        style={{ maskImage: CHIP_FADE_MASK, WebkitMaskImage: CHIP_FADE_MASK }}
      >
        <div
          ref={registerChipScroller(`${cellKey}-mobile`)}
          className="flex items-center gap-1 overflow-x-auto py-0.5 px-1 no-scrollbar"
        >
          {chips.map((time, i) => (
            <motion.button
              key={time}
              data-chip-core-start={i === CHIP_CORE_START_INDEX ? 'true' : undefined}
              initial={{ opacity: 0, scale: 0.82, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26, delay: i * 0.015 }}
              onClick={() => handleChipSelect(entry, pageEntries, time)}
              className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors backdrop-blur-sm ${
                entry.clock_out === time
                  ? 'border-primary/70 bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.55)]'
                  : 'border-primary/25 bg-background/70 text-foreground hover:border-primary/60 hover:bg-primary/10'
              }`}
            >
              {formatClockDecimal(time)}
            </motion.button>
          ))}
        </div>
      </div>
    );
  };

  // ── Page renderer ──────────────────────────────────────────────────────────
  const renderEmptyRow = (dateStr: string, idx: number) => (
    <div key={`empty-${dateStr}`}>
      <div className={`flex items-start justify-between gap-2 py-3.5 pl-3 pr-3 text-[14px] border-b border-border/20 sm:hidden ${
        idx % 2 !== 0 ? 'bg-muted/20' : ''
      }`}>
        <div className="min-w-0 flex-1 pr-1">
          <button
            onClick={() => activateEmptyDay(dateStr)}
            className={`block font-semibold text-[15px] leading-none ${getDayColor(dateStr)} ${!readOnly ? 'hover:underline' : 'cursor-default'}`}
          >
            {formatDayOnly(dateStr)}
          </button>
          <button
            onClick={() => activateEmptyDay(dateStr)}
            className={`mt-1 block text-left text-[12px] leading-tight text-muted-foreground ${!readOnly ? 'hover:text-foreground transition-colors' : 'cursor-default'}`}
          >
            —
          </button>
        </div>
        <div className="ml-1 flex shrink-0 items-center gap-3 text-right text-muted-foreground">
          <span className="w-[38px] text-right text-sm font-medium">—</span>
          <span className="w-[24px] text-right font-semibold text-[12px]">—</span>
          <span className="w-[34px] text-right font-medium text-[12px]">—</span>
          <span className="w-[30px] text-right font-semibold text-[12px]">—</span>
          <span className="w-[40px] text-right font-bold text-[14px]">—</span>
        </div>
      </div>

      <div className={`hidden sm:grid ${tableGridClass} ${tableGapClass} py-3.5 items-center text-[14px] border-b border-border/20 ${
        idx % 2 !== 0 ? 'bg-muted/20' : ''
      }`}>
        <button
          onClick={() => activateEmptyDay(dateStr)}
          className={`text-left font-semibold text-[14px] ${getDayColor(dateStr)} ${!readOnly ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
        >
          {formatDateViet(dateStr).split(' ')[0]}
        </button>
        <button
          onClick={() => activateEmptyDay(dateStr)}
          className={`text-left text-muted-foreground ${!readOnly ? 'hover:text-foreground transition-colors' : 'cursor-default'}`}
        >
          —
        </button>
        <span className="text-right text-muted-foreground">—</span>
        <span className="text-right text-muted-foreground font-semibold">—</span>
        <span className="text-right text-muted-foreground font-medium">—</span>
        <span className="text-right text-muted-foreground font-semibold">—</span>
        <span className="text-right text-muted-foreground font-bold">—</span>
      </div>
    </div>
  );

  const renderPage = (page: { startDate: string; endDate: string; entries: SalaryEntry[] }) => {
    const pageDates = generateDateRange(page.startDate, page.endDate);
    const pageRows = pageDates.flatMap((dateStr) => {
      const dateEntries = page.entries.filter(entry => entry.entry_date === dateStr);
      return dateEntries.length > 0
        ? dateEntries.map(entry => ({ dateStr, entry }))
        : [{ dateStr, entry: null }];
    });
    const orderedEntries = pageRows
      .filter((row): row is { dateStr: string; entry: SalaryEntry } => row.entry !== null)
      .map(row => row.entry);

    return (
    <div>
      {/* Mobile column headers */}
      <div className="flex items-center justify-between gap-2 py-3 pl-3 pr-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 sm:hidden">
        <span>Ngày</span>
        <div className="ml-2 flex shrink-0 items-center gap-3 text-right">
          <span className="w-[38px]">Ra</span>
          <span className="w-[24px]">Giờ</span>
          <span className="w-[34px]">Lương</span>
          <span className="w-[30px]">PC</span>
          <span className="w-[40px]">Tổng</span>
        </div>
      </div>
      {/* Desktop column headers */}
      <div className={`hidden sm:grid ${tableGridClass} ${tableGapClass} py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40`}>
        <span>Ngày</span>
        <span className="text-center">Ghi chú</span>
        <span className="text-right">Ra</span>
        <span className="text-right">Giờ</span>
        <span className="text-right">Lương</span>
        <span className="text-right">PC</span>
        <span className="text-right">Tổng</span>
      </div>

      <LayoutGroup>
      <div className="divide-y divide-border/20">
        {pageRows.map((row, idx) => {
          if (!row.entry) return renderEmptyRow(row.dateStr, idx);
          const e = row.entry;
          const { rate, allowance, hours, extraWage, total } = computeRow(e);
          const cellKey = `${e.entry_date}-${e.sort_order}`;
          const isDupe = e.sort_order > 0;
          const matchedRate = rates.find(r => r.special_date === e.entry_date);
          const rateDesc = matchedRate?.description_vi;
          const isMoonDay = matchedRate?.day_type === 'new_moon' || matchedRate?.day_type === 'full_moon';
          const chipsActive = !readOnly && chipRowKey === cellKey && !e.is_day_off;
          const isPending = mode === 'admin' && e.is_admin_reviewed === false;
          const showAccept = isPending && !!e.id && !!onAcceptEntry &&
            (!currentUserId || e.submitted_by !== currentUserId);
          const canDelete = canDeleteRow(e);

          const isSunday = new Date(e.entry_date + 'T00:00:00').getDay() === 0;
          const nextRow = pageRows[idx + 1];
          const isLastSundayRow = isSunday && (!nextRow || nextRow.dateStr !== e.entry_date);
          const showWeekSep = isLastSundayRow && nextRow !== undefined;

          return (
            <motion.div
              key={cellKey}
              layout
              transition={{ layout: { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 } }}
            >
              {/* ── Mobile row ─────────────────────────────────────────────── */}
              <div
                className={`relative min-h-[52px] py-2.5 pl-3 pr-3 text-[14px] border-b border-border/20 sm:hidden overflow-hidden ${
                  e.is_day_off ? 'opacity-40' : ''
                } ${idx % 2 !== 0 && !isPending ? 'bg-muted/20' : ''} ${
                  isMoonDay ? 'moon-accent-row' : ''
                } ${isPending ? 'border-l-4 border-l-amber-400 bg-amber-500/5' : ''}`}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {chipsActive ? (
                    <motion.div
                      key="chips"
                      initial={{ y: '180%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '-180%' }}
                      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                      className="w-full min-h-[38px] flex items-center"
                    >
                      {renderChips(e, orderedEntries)}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="body"
                      initial={{ y: '180%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '-180%' }}
                      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-center justify-between gap-2 w-full"
                    >
                      {/* Left: date + note */}
                      <div className="min-w-0 flex-1 pr-1">
                        <div className="flex items-start gap-1">
                          {!readOnly && (
                            isDupe ? (
                              canDelete ? (
                                <button onClick={() => e.id && onRemoveEntry(e.id)} className="mt-0.5 text-destructive/60 hover:text-destructive">
                                  <Trash2 size={10} />
                                </button>
                              ) : null
                            ) : (
                              <button onClick={() => onAddDuplicateRow(e.entry_date)} className="mt-0.5 text-muted-foreground hover:text-primary transition-colors">
                                <Plus size={10} />
                              </button>
                            )
                          )}
                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => handleDateTap(e)}
                              className={`block font-semibold text-[15px] leading-none ${getDayColor(e.entry_date)} ${!readOnly ? 'hover:opacity-70 transition-opacity' : 'cursor-default'}`}
                            >
                              {isDupe ? '↳' : formatDayOnly(e.entry_date)}
                            </button>
                            {editingCell === `${cellKey}-note` && !readOnly ? (
                              <div className="relative mt-1">
                                <input
                                  value={cellValue}
                                  onChange={ev => setCellValue(ev.target.value)}
                                  onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
                                  onKeyDown={ev => ev.key === 'Enter' && saveCellEdit(e.entry_date, e.sort_order, 'note')}
                                  className="block w-full rounded bg-background border border-border px-2 py-1 pr-6 text-[12px] min-w-0"
                                  autoFocus
                                />
                                {cellValue && (
                                  <button
                                    onMouseDown={ev => { ev.preventDefault(); setCellValue(''); }}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground p-0.5 text-[10px]"
                                    tabIndex={-1}
                                  >✕</button>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => !readOnly && !e.is_day_off && startCellEdit(`${cellKey}-note`, e.note || '')}
                                className={`mt-1 block text-left text-[12px] leading-tight ${
                                  isMoonDay ? 'moon-accent-text' : 'text-muted-foreground'
                                } ${!readOnly && !e.is_day_off ? 'hover:text-foreground transition-colors' : 'cursor-default'}`}
                              >
                                {e.is_day_off ? 'Nghỉ' : (e.note || rateDesc || '—')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Right: normal columns */}
                      <div className="ml-1 flex shrink-0 items-center gap-3 text-right">
                        <button
                          onClick={() => !readOnly && !e.is_day_off && showRowChips(cellKey)}
                          className={`w-[38px] text-right text-sm font-medium ${
                            !readOnly && !e.is_day_off ? 'text-accent hover:underline' : 'text-accent cursor-default'
                          }`}
                        >
                          {formatClockDecimal(e.clock_out)}
                        </button>
                        <span className="w-[24px] text-right font-semibold text-[12px]">{formatHours(hours)}</span>
                        <span className="w-[34px] text-right font-medium text-[12px] text-foreground/70">
                          {extraWage > 0 ? formatCompact(extraWage) : '—'}
                        </span>
                        <span className="w-[30px] text-right allowance-amt font-semibold text-[12px]">
                          {allowance > 0 ? formatCompact(allowance) : ''}
                        </span>
                        <span className={`w-[40px] text-right font-bold text-[14px] ${total === 0 ? 'text-muted-foreground' : ''}`}>
                          {formatCompact(total)}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {showWeekSep && (
                  <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full week-separator z-10" />
                )}
              </div>


              {/* ── Desktop row ────────────────────────────────────────────── */}
              <div className={`hidden sm:grid ${tableGridClass} ${tableGapClass} py-3.5 items-center text-[14px] border-b border-border/20 ${
                e.is_day_off ? 'opacity-40' : ''
              } ${idx % 2 !== 0 && !isPending ? 'bg-muted/20' : ''} ${
                isMoonDay ? 'moon-accent-row' : ''
              } ${isPending ? 'border-l-4 border-l-amber-400 bg-amber-500/5' : ''} ${showWeekSep ? 'relative' : ''}`}>
                {/* Date */}
                <div className="pr-4 sm:pr-2">
                  <div className="flex items-start gap-1">
                    {!readOnly && (
                      isDupe ? (
                        canDelete ? (
                          <button onClick={() => e.id && onRemoveEntry(e.id)} className="mt-0.5 text-destructive/60 hover:text-destructive">
                            <Trash2 size={10} />
                          </button>
                        ) : null
                      ) : (
                        <button onClick={() => onAddDuplicateRow(e.entry_date)} className="mt-0.5 text-muted-foreground hover:text-primary transition-colors">
                          <Plus size={10} />
                        </button>
                      )
                    )}
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => handleDateTap(e)}
                        className={`block font-semibold text-sm ${getDayColor(e.entry_date)} ${!readOnly ? 'hover:opacity-70 transition-opacity' : 'cursor-default'}`}
                      >
                        {isDupe ? '↳' : formatDateViet(e.entry_date)}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Note */}
                {editingCell === `${cellKey}-note` && !readOnly && !e.is_day_off ? (
                  <div className="relative min-w-0">
                    <input
                      value={cellValue}
                      onChange={ev => setCellValue(ev.target.value)}
                      onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
                      onKeyDown={ev => ev.key === 'Enter' && saveCellEdit(e.entry_date, e.sort_order, 'note')}
                      className="w-full px-2 py-1.5 pr-6 rounded bg-background border border-border text-sm min-w-0"
                      autoFocus
                    />
                    {cellValue && (
                      <button
                        onMouseDown={ev => { ev.preventDefault(); setCellValue(''); }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground p-0.5 text-[10px]"
                        tabIndex={-1}
                      >✕</button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => !readOnly && !e.is_day_off && startCellEdit(`${cellKey}-note`, e.note || '')}
                    className={`text-left truncate text-sm transition-colors ${
                      isMoonDay ? 'moon-accent-text' : 'text-muted-foreground'
                    } ${
                      !readOnly && !e.is_day_off ? 'hover:text-foreground' : 'cursor-default'
                    }`}
                  >
                    {e.is_day_off ? 'Nghỉ' : (e.note || rateDesc || '—')}
                  </button>
                )}

                {/* Clock out — or chips spanning remaining columns */}
                {chipsActive ? (
                  <div
                    className="col-span-5 relative min-w-0"
                    style={{ maskImage: CHIP_FADE_MASK, WebkitMaskImage: CHIP_FADE_MASK }}
                  >
                    <div
                      ref={registerChipScroller(`${cellKey}-desktop`)}
                      className="flex items-center gap-1 overflow-x-auto py-0.5 px-1 no-scrollbar"
                    >
                      {getClockOutChips(e.clock_in || globalClockIn).map((time, i) => (
                        <motion.button
                          key={time}
                          data-chip-core-start={i === CHIP_CORE_START_INDEX ? 'true' : undefined}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                          onClick={() => handleChipSelect(e, orderedEntries, time)}
                          className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                            e.clock_out === time
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border/60 bg-muted/60 text-foreground hover:border-primary/60 hover:bg-primary/10'
                          }`}
                        >
                          {formatClockDecimal(time)}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Clock out */}
                    <button
                      onClick={() => !readOnly && !e.is_day_off && showRowChips(cellKey)}
                      className={`justify-self-end text-right text-sm font-medium ${
                        !readOnly && !e.is_day_off ? 'text-accent hover:underline' : 'text-accent cursor-default'
                      }`}
                    >
                      {formatClockDecimal(e.clock_out)}
                    </button>

                    {/* Hours */}
                    <span className="justify-self-end text-right font-semibold text-[13px]">
                      {formatHours(hours)}
                    </span>

                    {/* Wage */}
                    <span className="justify-self-end text-right font-medium text-[13px] text-foreground/70">
                      {extraWage > 0 ? formatCompact(extraWage) : '—'}
                    </span>

                    {/* Allowance */}
                    <span className="justify-self-end text-right allowance-amt font-semibold text-[13px]">
                      {allowance > 0 ? formatCompact(allowance) : ''}
                    </span>

                    {/* Total */}
                    <span className={`justify-self-end text-right font-bold text-[14px] ${total === 0 ? 'text-muted-foreground' : ''}`}>
                      {formatCompact(total)}
                    </span>
                  </>
                )}

                {showWeekSep && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full week-separator" />
                )}
              </div>

              {/* Pending review strip (admin sees yellow + Accept button) */}
              {isPending && (
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-500/5 border-b border-border/20 sm:px-1">
                  <span className="flex items-center gap-1 text-[11px] text-amber-400">
                    <Clock size={11} /> Chờ duyệt
                  </span>
                  {showAccept && (
                    <button
                      onClick={() => onAcceptEntry!(e.id!)}
                      className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors flex items-center gap-1"
                    >
                      <Check size={12} /> Duyệt
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      </LayoutGroup>
    </div>
  );
  };

  return (
    <div className="space-y-3">
      {/* Swipeable pages */}
      <div className="-mx-4 sm:mx-0">
        {pages.length > 0 ? (
          <SwipeablePages
            pages={pages.map(p => renderPage(p))}
            labels={pages.map(p => `${formatDateViet(p.startDate)} — ${formatDateViet(p.endDate)}`)}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        ) : (
          <div className="glass-card p-6 text-center text-muted-foreground text-xs">
            Chưa có dữ liệu
          </div>
        )}
      </div>

      {/* Allowances */}
      {mode === 'employee' ? (
        <div className="glass-card p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gửi xe (tự động)
            </h4>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              guiXeSummary.enabled
                ? 'text-success bg-success/10 border-success/30'
                : 'text-muted-foreground bg-muted/30 border-muted-foreground/20'
            }`}>
              {guiXeSummary.enabled ? 'Đang áp dụng' : 'Đang tắt'}
            </span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Tính theo công thức cố định (cập nhật theo ngày nghỉ).
            </p>
            <div className="text-sm font-semibold text-foreground">
              {formatVND(guiXeSummary.amount)}
            </div>
          </div>
        </div>
      ) : (
        <EmployeeAllowanceEditor
          allowances={allowances}
          onToggle={onAllowanceToggle}
          onUpdate={onAllowanceUpdate}
          onAddAllowance={onAddAllowance}
          isAdmin={mode === 'admin'}
        />
      )}

      {/* Total - show notice for employees, amount for admin */}
      {mode === 'employee' ? (
        <div className="glass-card p-4 sm:p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Tổng lương sẽ được hiển thị sau khi quản lý xác nhận
          </p>
        </div>
      ) : (
        <TotalSalaryDisplay
          total={breakdown?.total ?? 0}
          onTap={() => setShowBreakdown(true)}
        />
      )}

      <SalaryBreakdownPopup
        isOpen={showBreakdown}
        onClose={() => setShowBreakdown(false)}
        breakdown={breakdown}
        visibleAllowanceKeys={mode === 'employee' ? ['gui_xe'] : null}
        isPublished={mode === 'preview'}
        dailyTotals={dailyTotals}
      />
    </div>
  );
}
