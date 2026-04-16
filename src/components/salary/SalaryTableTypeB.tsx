import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcDailyBase, calcHoursFromTimes, getRateForDate, formatDateViet } from '@/lib/salaryCalculations';
import { splitIntoPages } from '@/lib/salaryPaging';
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
function getClockOutChips(clockIn: string): string[] {
  const base = parseTimeToMinutes(clockIn);
  return [30, 60, 90, 120, 150, 180].map(offset => formatMinutesToTime(base + offset));
}

export default function SalaryTableTypeB({
  entries, rates, allowances, baseSalary, hourlyRate,
  periodStart, periodEnd,
  onEntryUpdate, onAddDuplicateRow, onRemoveEntry,
  onAllowanceToggle, onAllowanceUpdate, onAddAllowance, onHourlyRateChange,
  globalClockIn, onGlobalClockInChange,
  breakdown,
  isPreview = false,
}: SalaryTableTypeBProps) {
  const tableGridClass = 'sm:grid-cols-[70px_minmax(120px,1fr)_50px_40px_55px_60px_75px]';
  const tableGapClass = 'sm:gap-1.5 sm:px-1';
  const [currentPage, setCurrentPage] = useState(0);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Chip state for sequential clock-out entry
  const [chipRowKey, setChipRowKey] = useState<string | null>(null);
  const chipAutoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Double-tap ref for day-off toggle on date
  const lastTapRef = useRef<{ key: string; time: number } | null>(null);

  const dailyBase = useMemo(() => calcDailyBase(baseSalary), [baseSalary]);
  const pages = useMemo(() => splitIntoPages(periodStart, periodEnd, entries), [periodStart, periodEnd, entries]);

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
    if (day === 6) return 'text-[hsl(175,70%,45%)]';
    if (day === 0) return 'text-[hsl(280,60%,55%)]';
    return '';
  };

  const handleDateTap = (entry: SalaryEntry) => {
    if (isPreview) return;
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

  const computeRow = (e: SalaryEntry) => {
    const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
    const allowance = roundToThousand(dailyBase * rate / 100);
    const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in || globalClockIn, e.clock_out) ?? 0;
    const extraWage = roundToThousand(hours * hourlyRate);
    const total = e.is_day_off ? 0 : dailyBase + allowance + extraWage;
    return { rate, allowance, hours, extraWage, total };
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
    return (
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto py-0.5 pr-1">
        {chips.map(time => (
          <motion.button
            key={time}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={() => handleChipSelect(entry, pageEntries, time)}
            className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
              entry.clock_out === time
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 bg-muted/60 text-foreground hover:border-primary/60 hover:bg-primary/10'
            }`}
          >
            {formatClockDecimal(time)}
          </motion.button>
        ))}
      </div>
    );
  };

  // ── Page renderer ──────────────────────────────────────────────────────────
  const renderPage = (pageEntries: SalaryEntry[]) => (
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

      <div className="divide-y divide-border/20">
        {pageEntries.map((e, idx) => {
          const { rate, allowance, hours, extraWage, total } = computeRow(e);
          const cellKey = `${e.entry_date}-${e.sort_order}`;
          const isDupe = e.sort_order > 0;
          const matchedRate = rates.find(r => r.special_date === e.entry_date);
          const rateDesc = matchedRate?.description_vi;
          const isMoonDay = matchedRate?.day_type === 'new_moon' || matchedRate?.day_type === 'full_moon';
          const chipsActive = !isPreview && chipRowKey === cellKey && !e.is_day_off;

          const isSunday = new Date(e.entry_date + 'T00:00:00').getDay() === 0;
          const nextEntry = pageEntries[idx + 1];
          const isLastSundayRow = isSunday && (!nextEntry || nextEntry.entry_date !== e.entry_date);
          const showWeekSep = isLastSundayRow && nextEntry !== undefined;

          return (
            <div key={cellKey}>
              {/* ── Mobile row ─────────────────────────────────────────────── */}
              <div className={`flex items-start justify-between gap-2 py-3.5 pl-3 pr-3 text-[14px] border-b border-border/20 sm:hidden ${
                e.is_day_off ? 'opacity-40' : ''
              } ${idx % 2 !== 0 ? 'bg-muted/20' : ''} ${
                isMoonDay ? 'moon-accent-row' : ''
              } ${showWeekSep ? 'relative' : ''}`}>
                {/* Left: date + note */}
                <div className="min-w-0 flex-1 pr-1">
                  <div className="flex items-start gap-1">
                    {!isPreview && (
                      isDupe ? (
                        <button onClick={() => e.id && onRemoveEntry(e.id)} className="mt-0.5 text-destructive/60 hover:text-destructive">
                          <Trash2 size={10} />
                        </button>
                      ) : (
                        <button onClick={() => onAddDuplicateRow(e.entry_date)} className="mt-0.5 text-muted-foreground hover:text-primary transition-colors">
                          <Plus size={10} />
                        </button>
                      )
                    )}
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => handleDateTap(e)}
                        className={`block font-semibold text-[15px] leading-none ${getDayColor(e.entry_date)} ${!isPreview ? 'hover:opacity-70 transition-opacity' : 'cursor-default'}`}
                      >
                        {isDupe ? '↳' : formatDayOnly(e.entry_date)}
                      </button>
                      {editingCell === `${cellKey}-note` && !isPreview ? (
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
                          onClick={() => !isPreview && !e.is_day_off && startCellEdit(`${cellKey}-note`, e.note || '')}
                          className={`mt-1 block text-left text-[12px] leading-tight ${
                            isMoonDay ? 'moon-accent-text' : 'text-muted-foreground'
                          } ${!isPreview && !e.is_day_off ? 'hover:text-foreground transition-colors' : 'cursor-default'}`}
                        >
                          {e.is_day_off ? 'Nghỉ' : (e.note || rateDesc || '—')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: chips OR normal columns */}
                {chipsActive ? (
                  renderChips(e, pageEntries)
                ) : (
                  <div className="ml-1 flex shrink-0 items-center gap-3 text-right">
                    {/* RA (clock-out) */}
                    <button
                      onClick={() => !isPreview && !e.is_day_off && showRowChips(cellKey)}
                      className={`w-[38px] text-right text-sm font-medium ${
                        !isPreview && !e.is_day_off ? 'text-accent hover:underline' : 'text-accent cursor-default'
                      }`}
                    >
                      {formatClockDecimal(e.clock_out)}
                    </button>
                    <span className="w-[24px] text-right font-semibold text-[12px]">{formatHours(hours)}</span>
                    <span className="w-[34px] text-right font-medium text-[12px] text-foreground/70">
                      {extraWage > 0 ? formatCompact(extraWage) : '—'}
                    </span>
                    <span className="w-[30px] text-right text-emerald-400 font-semibold text-[12px]">
                      {allowance > 0 ? formatCompact(allowance) : ''}
                    </span>
                    <span className={`w-[40px] text-right font-bold text-[14px] ${total === 0 ? 'text-muted-foreground' : ''}`}>
                      {formatCompact(total)}
                    </span>
                  </div>
                )}

                {showWeekSep && (
                  <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full week-separator" />
                )}
              </div>

              {/* ── Desktop row ────────────────────────────────────────────── */}
              <div className={`hidden sm:grid ${tableGridClass} ${tableGapClass} py-3.5 items-center text-[14px] border-b border-border/20 ${
                e.is_day_off ? 'opacity-40' : ''
              } ${idx % 2 !== 0 ? 'bg-muted/20' : ''} ${
                isMoonDay ? 'moon-accent-row' : ''
              } ${showWeekSep ? 'relative' : ''}`}>
                {/* Date */}
                <div className="pr-4 sm:pr-2">
                  <div className="flex items-start gap-1">
                    {!isPreview && (
                      isDupe ? (
                        <button onClick={() => e.id && onRemoveEntry(e.id)} className="mt-0.5 text-destructive/60 hover:text-destructive">
                          <Trash2 size={10} />
                        </button>
                      ) : (
                        <button onClick={() => onAddDuplicateRow(e.entry_date)} className="mt-0.5 text-muted-foreground hover:text-primary transition-colors">
                          <Plus size={10} />
                        </button>
                      )
                    )}
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => handleDateTap(e)}
                        className={`block font-semibold text-sm ${getDayColor(e.entry_date)} ${!isPreview ? 'hover:opacity-70 transition-opacity' : 'cursor-default'}`}
                      >
                        {isDupe ? '↳' : formatDateViet(e.entry_date)}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Note */}
                {editingCell === `${cellKey}-note` && !isPreview && !e.is_day_off ? (
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
                    onClick={() => !isPreview && !e.is_day_off && startCellEdit(`${cellKey}-note`, e.note || '')}
                    className={`text-left truncate text-sm transition-colors ${
                      isMoonDay ? 'moon-accent-text' : 'text-muted-foreground'
                    } ${
                      !isPreview && !e.is_day_off ? 'hover:text-foreground' : 'cursor-default'
                    }`}
                  >
                    {e.is_day_off ? 'Nghỉ' : (e.note || rateDesc || '—')}
                  </button>
                )}

                {/* Clock out — or chips spanning remaining columns */}
                {chipsActive ? (
                  <div className="col-span-5 flex items-center gap-1 overflow-x-auto py-0.5">
                    {getClockOutChips(e.clock_in || globalClockIn).map(time => (
                      <motion.button
                        key={time}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        onClick={() => handleChipSelect(e, pageEntries, time)}
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
                ) : (
                  <>
                    {/* Clock out */}
                    <button
                      onClick={() => !isPreview && !e.is_day_off && showRowChips(cellKey)}
                      className={`justify-self-end text-right text-sm font-medium ${
                        !isPreview && !e.is_day_off ? 'text-accent hover:underline' : 'text-accent cursor-default'
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
                    <span className="justify-self-end text-right text-emerald-400 font-semibold text-[13px]">
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
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Swipeable pages */}
      <div className="-mx-4 sm:mx-0">
        {pages.length > 0 ? (
          <SwipeablePages
            pages={pages.map(p => renderPage(p.entries))}
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
      <EmployeeAllowanceEditor
        allowances={allowances}
        onToggle={onAllowanceToggle}
        onUpdate={onAllowanceUpdate}
        onAddAllowance={onAddAllowance}
        isAdmin={!isPreview}
      />

      {/* Total */}
      <TotalSalaryDisplay
        total={breakdown?.total ?? 0}
        onTap={() => setShowBreakdown(true)}
      />

      <SalaryBreakdownPopup
        isOpen={showBreakdown}
        onClose={() => setShowBreakdown(false)}
        breakdown={breakdown}
      />
    </div>
  );
}
