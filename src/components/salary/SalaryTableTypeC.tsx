import { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, X } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcHoursFromTimes, getRateForDate, formatVND, formatDateViet } from '@/lib/salaryCalculations';
import { generateDateRange, splitIntoPages } from '@/lib/salaryPaging';
import SwipeablePages from './SwipeablePages';
import EmployeeAllowanceEditor from './EmployeeAllowanceEditor';
import TotalSalaryDisplay from './TotalSalaryDisplay';
import SalaryBreakdownPopup from './SalaryBreakdownPopup';
import AnalogClock from '../AnalogClock';

interface SalaryTableTypeCProps {
  entries: SalaryEntry[];
  rates: SpecialDayRate[];
  allowances: EmployeeAllowance[];
  offDays: string[];
  hourlyRate: number;
  periodStart: string;
  periodEnd: string;
  customStartDate: string | null;
  customEndDate: string | null;
  onEntryUpdate: (entryDate: string, sortOrder: number, updates: Partial<SalaryEntry>) => void;
  onEntryDateChange: (id: string, currentEntryDate: string, currentSortOrder: number, nextEntryDate: string) => void;
  onAddRowAtDate: (entryDate: string) => void;
  onAllowanceToggle: (key: AllowanceKey) => void;
  onAllowanceUpdate: (key: AllowanceKey, updates: { label?: string; amount?: number }) => void;
  onHourlyRateChange: (rate: number) => void;
  onCustomDateChange: (start: string | null, end: string | null) => void;
  breakdown: SalaryBreakdown | null;
  isPreview?: boolean;
}

export default function SalaryTableTypeC({
  entries, rates, allowances, offDays, hourlyRate,
  periodStart, periodEnd, customStartDate, customEndDate,
  onEntryUpdate, onEntryDateChange, onAddRowAtDate, onAllowanceToggle, onAllowanceUpdate,
  onHourlyRateChange, onCustomDateChange, breakdown, isPreview = false,
}: SalaryTableTypeCProps) {
  const OFF_DAY_NOTE = 'Quán nghỉ';
  const tableGridClass = 'sm:grid-cols-[75px_minmax(140px,1fr)_84px_60px_70px_80px]';
  const tableGapClass = 'sm:gap-1.5 sm:px-2';
  const [compact, setCompact] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [editingHourly, setEditingHourly] = useState(false);
  const [hourlyInput, setHourlyInput] = useState(hourlyRate.toString());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [pickingRange, setPickingRange] = useState<'start' | 'end' | null>(null);
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState('');
  const [addingDate, setAddingDate] = useState(false);
  const [newRowDate, setNewRowDate] = useState(periodStart);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const pendingDateTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTappedDateRef = useRef<string | null>(null);

  const [defaultClockIn, setDefaultClockIn] = useState<string>('08:00');
  const [defaultClockOut, setDefaultClockOut] = useState<string>('17:30');
  const [pickingClock, setPickingClock] = useState<{
    scope: 'default' | 'cell';
    kind: 'in' | 'out';
    entryDate?: string;
    sortOrder?: number;
  } | null>(null);

  const effectiveStart = customStartDate || periodStart;
  const effectiveEnd = customEndDate || periodEnd;

  useEffect(() => {
    setNewRowDate(effectiveEnd >= periodStart ? effectiveStart : periodStart);
  }, [effectiveStart, effectiveEnd, periodStart]);

  useEffect(() => {
    return () => {
      if (pendingDateTapRef.current) clearTimeout(pendingDateTapRef.current);
    };
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => e.entry_date >= effectiveStart && e.entry_date <= effectiveEnd);
  }, [entries, effectiveStart, effectiveEnd]);
  const scheduledOffDays = useMemo(
    () => new Set(offDays.filter(date => date >= effectiveStart && date <= effectiveEnd)),
    [offDays, effectiveStart, effectiveEnd]
  );

  const pages = useMemo(() =>
    splitIntoPages(effectiveStart, effectiveEnd, filteredEntries),
    [effectiveStart, effectiveEnd, filteredEntries]
  );

  const workingEntries = useMemo(() =>
    filteredEntries.filter(e => !e.is_day_off && (e.clock_in || e.clock_out)),
    [filteredEntries]
  );

  useEffect(() => {
    scheduledOffDays.forEach((dateStr) => {
      const existingEntry = filteredEntries.find(e => e.entry_date === dateStr && e.sort_order === 0)
        || filteredEntries.find(e => e.entry_date === dateStr);
      if (existingEntry) {
        if (!existingEntry.is_day_off || existingEntry.note !== OFF_DAY_NOTE || existingEntry.clock_in || existingEntry.clock_out || existingEntry.total_hours !== null) {
          onEntryUpdate(dateStr, existingEntry.sort_order, {
            is_day_off: true,
            note: OFF_DAY_NOTE,
            clock_in: null,
            clock_out: null,
            total_hours: null,
          });
        }
        return;
      }

      onEntryUpdate(dateStr, 0, {
        is_day_off: true,
        note: OFF_DAY_NOTE,
        clock_in: null,
        clock_out: null,
        total_hours: null,
      });
    });
  }, [scheduledOffDays, filteredEntries, onEntryUpdate]);

  const getDayColor = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    if (day === 6) return 'text-[hsl(175,70%,45%)]';
    if (day === 0) return 'text-[hsl(280,60%,55%)]';
    return '';
  };

  const computeRow = (e: SalaryEntry) => {
    const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
    const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in, e.clock_out) ?? 0;
    const baseWage = roundToThousand(hours * hourlyRate);
    const allowanceAmt = roundToThousand(baseWage * rate / 100);
    const total = e.is_day_off ? 0 : baseWage + allowanceAmt;
    return { rate, hours, baseWage, allowanceAmt, total };
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

  const formatDayOnly = (dateStr: string) => `${parseInt(dateStr.slice(8, 10), 10)}`;

  const saveHourlyRate = () => {
    onHourlyRateChange(parseInt(hourlyInput) || 25000);
    setEditingHourly(false);
  };

  const startCellEdit = (key: string, val: string) => {
    setEditingCell(key);
    setCellValue(val);
  };

  const openCellClockPicker = (entryDate: string, sortOrder: number, kind: 'in' | 'out', currentValue: string | null) => {
    setEditingCell(`${entryDate}-${sortOrder}-clock_${kind}`);
    setCellValue(currentValue || '');
    setPickingClock({
      scope: 'cell',
      kind,
      entryDate,
      sortOrder,
    });
  };

  const startDateEdit = (key: string, val: string) => {
    setEditingDateKey(key);
    setEditingDateValue(val);
  };

  const saveDateEdit = (e: SalaryEntry) => {
    if (!e.id) {
      setEditingDateKey(null);
      return;
    }
    const nextDate = editingDateValue || e.entry_date;
    onEntryDateChange(e.id, e.entry_date, e.sort_order, nextDate);
    setEditingDateKey(null);
  };

  const formatNextDay = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    date.setDate(date.getDate() + 1);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const clampDateToPeriod = (dateStr: string) => {
    if (!dateStr) return periodStart;
    if (dateStr < periodStart) return periodStart;
    if (dateStr > periodEnd) return periodEnd;
    return dateStr;
  };

  const queueDateTapAction = (e: SalaryEntry, cellKey: string) => {
    if (isPreview) return;
    if (pendingDateTapRef.current && lastTappedDateRef.current === cellKey) {
      clearTimeout(pendingDateTapRef.current);
      pendingDateTapRef.current = null;
      lastTappedDateRef.current = null;
      onAddRowAtDate(formatNextDay(e.entry_date));
      return;
    }

    lastTappedDateRef.current = cellKey;
    pendingDateTapRef.current = setTimeout(() => {
      startDateEdit(`${cellKey}-date`, e.entry_date);
      pendingDateTapRef.current = null;
      lastTappedDateRef.current = null;
    }, 220);
  };

  const saveCellEdit = (entryDate: string, sortOrder: number, field: string, overrideValue?: string) => {
    const nextValue = overrideValue ?? cellValue;
    const updates: Partial<SalaryEntry> = {};
    if (field === 'clock_in') updates.clock_in = nextValue || null;
    if (field === 'clock_out') updates.clock_out = nextValue || null;
    if (field === 'note') updates.note = nextValue || null;
    onEntryUpdate(entryDate, sortOrder, updates);
    setEditingCell(null);
  };

  const toggleDayOff = (e: SalaryEntry) => {
    onEntryUpdate(e.entry_date, e.sort_order, {
      is_day_off: !e.is_day_off,
      ...(e.is_day_off
        ? {
            clock_in: defaultClockIn,
            clock_out: defaultClockOut,
            total_hours: calcHoursFromTimes(defaultClockIn, defaultClockOut),
          }
        : { clock_in: null, clock_out: null, total_hours: null }),
    });
  };

  const activateEmptyDay = (dateStr: string) => {
    if (scheduledOffDays.has(dateStr)) return;
    const totalHours = calcHoursFromTimes(defaultClockIn, defaultClockOut);
    onEntryUpdate(dateStr, 0, {
      is_day_off: false,
      clock_in: defaultClockIn,
      clock_out: defaultClockOut,
      total_hours: totalHours,
      note: null,
    });
  };

  const renderRow = (e: SalaryEntry, idx?: number, allEntries?: SalaryEntry[]) => {
    const { rate, hours, baseWage, allowanceAmt, total } = computeRow(e);
    const matchedRate = rates.find(r => r.special_date === e.entry_date);
    const rateDesc = matchedRate?.description_vi;
    const cellKey = `${e.entry_date}-${e.sort_order}`;
    const isScheduledOffDay = scheduledOffDays.has(e.entry_date);
    const isMoonDay = matchedRate?.day_type === 'new_moon' || matchedRate?.day_type === 'full_moon';

    // Show week separator after Sunday, if not the last row
    const isSunday = new Date(e.entry_date + 'T00:00:00').getDay() === 0;
    const entries = allEntries || [];
    const nextEntry = idx !== undefined ? entries[idx + 1] : undefined;
    const showWeekSep = isSunday && nextEntry !== undefined;

    return (
      <div key={cellKey}>
      <div className={`flex items-start justify-between gap-2 py-2.5 pl-3 pr-3 text-[13px] border-b border-border/20 w-full sm:hidden ${
        e.is_day_off || isScheduledOffDay ? 'opacity-50' : ''
      } ${idx && idx % 2 !== 0 ? 'bg-muted/20' : ''} ${
        isMoonDay ? 'moon-accent-row' : ''
      }`}>
        <div className="min-w-0 flex-1 pr-3">
          <div className="flex items-start gap-1.5">
            {!isPreview && (
              <button onClick={() => toggleDayOff(e)} className={`mt-0.5 flex-shrink-0 transition-colors ${e.is_day_off ? 'text-destructive/60 hover:text-destructive' : 'text-emerald-400/60 hover:text-emerald-400'}`}>
                {e.is_day_off ? <X size={11} /> : <Check size={11} />}
              </button>
            )}
            <div className="min-w-0 flex-1">
              {editingDateKey === `${cellKey}-date` && !isPreview ? (
                <input
                  type="date"
                  value={editingDateValue}
                  min={periodStart}
                  max={periodEnd}
                  onChange={(ev) => setEditingDateValue(ev.target.value)}
                  onBlur={() => saveDateEdit(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') saveDateEdit(e);
                    if (ev.key === 'Escape') setEditingDateKey(null);
                  }}
                  className="px-1 py-1 rounded bg-background border border-border text-[10px] min-w-0 w-full"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => toggleDayOff(e)}
                  className={`block -mt-0.5 font-semibold text-[15px] leading-none whitespace-nowrap ${getDayColor(e.entry_date)} ${!isPreview ? 'hover:underline' : 'cursor-default'}`}
                >
                  {formatDayOnly(e.entry_date)}
                </button>
              )}
              {editingCell === `${cellKey}-note` && !isPreview ? (
                <input value={cellValue} onChange={ev => setCellValue(ev.target.value)}
                  onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
                  className="mt-1 px-2 py-1 rounded bg-background border border-border text-[12px] min-w-0 w-full" autoFocus />
              ) : (
                <button onClick={() => !isPreview && startCellEdit(`${cellKey}-note`, e.note || '')}
                  className={`mt-1 block text-left text-[12px] leading-tight ${
                    isMoonDay ? 'moon-accent-text' : 'text-muted-foreground'
                  } ${!isPreview ? 'hover:text-foreground transition-colors' : 'cursor-default'}`}>
                  {e.note || (isScheduledOffDay ? OFF_DAY_NOTE : rateDesc) || '—'}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="ml-2 flex shrink-0 items-start gap-3 text-right">
          <div className="flex w-[40px] flex-col gap-[0.15rem] min-h-[38px] items-end">
            {editingCell === `${cellKey}-clock_in` && !isPreview ? (
              <button
                onClick={() => openCellClockPicker(e.entry_date, e.sort_order, 'in', e.clock_in)}
                className="w-full rounded border border-border bg-background px-1 py-1 text-center text-[10px] text-emerald-400"
              >
                Chọn
              </button>
            ) : (
              <button onClick={() => !isPreview && openCellClockPicker(e.entry_date, e.sort_order, 'in', e.clock_in)}
                className={`w-full text-right font-medium ${!isPreview ? 'text-emerald-400 hover:underline' : 'text-emerald-400 cursor-default'}`}>
                {formatClockDecimal(e.clock_in)}
              </button>
            )}
            {editingCell === `${cellKey}-clock_out` && !isPreview ? (
              <button
                onClick={() => openCellClockPicker(e.entry_date, e.sort_order, 'out', e.clock_out)}
                className="w-full rounded border border-border bg-background px-1 py-1 text-center text-[10px] text-accent"
              >
                Chọn
              </button>
            ) : (
              <button onClick={() => !isPreview && openCellClockPicker(e.entry_date, e.sort_order, 'out', e.clock_out)}
                className={`w-full text-right font-medium ${!isPreview ? 'text-accent hover:underline' : 'text-accent cursor-default'}`}>
                {formatClockDecimal(e.clock_out)}
              </button>
            )}
          </div>
          <span className="w-[24px] text-right font-semibold text-[12px]">{formatHours(hours)}</span>
          <span className="w-[30px] text-right text-emerald-400 font-semibold text-[12px]">
            {allowanceAmt > 0 ? (allowanceAmt / 1000).toFixed(0) + 'k' : ''}
          </span>
          <span className="w-[40px] text-right font-bold text-[13px]">{total > 0 ? (total / 1000).toFixed(0) + 'k' : '—'}</span>
        </div>
      </div>
      <div className={`hidden sm:grid ${tableGridClass} ${tableGapClass} py-2.5 items-center text-[13px] sm:text-[14px] border-b border-border/20 w-full ${
        e.is_day_off || isScheduledOffDay ? 'opacity-50' : ''
      } ${idx && idx % 2 !== 0 ? 'bg-muted/20' : ''} ${
        isMoonDay ? 'moon-accent-row' : ''
      }`}>
        {/* Date + note */}
        <div className="pr-4 sm:pr-2">
          <div className="flex items-start gap-1.5">
            {!isPreview && (
              <button onClick={() => toggleDayOff(e)} className={`mt-0.5 flex-shrink-0 transition-colors ${e.is_day_off ? 'text-destructive/60 hover:text-destructive' : 'text-emerald-400/60 hover:text-emerald-400'}`}>
                {e.is_day_off ? <X size={11} /> : <Check size={11} />}
              </button>
            )}
            <div className="min-w-0 flex-1">
              {editingDateKey === `${cellKey}-date` && !isPreview ? (
                <input
                  type="date"
                  value={editingDateValue}
                  min={periodStart}
                  max={periodEnd}
                  onChange={(ev) => setEditingDateValue(ev.target.value)}
                  onBlur={() => saveDateEdit(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') saveDateEdit(e);
                    if (ev.key === 'Escape') setEditingDateKey(null);
                  }}
                  className="px-1 py-1 rounded bg-background border border-border text-[10px] min-w-0 w-full"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => toggleDayOff(e)}
                  className={`block -mt-0.5 font-semibold text-[15px] leading-none sm:text-[14px] sm:leading-normal whitespace-nowrap ${getDayColor(e.entry_date)} ${!isPreview ? 'hover:underline' : 'cursor-default'}`}
                >
                  <span className="sm:hidden">{formatDayOnly(e.entry_date)}</span>
                  <span className="hidden sm:inline">{formatDateViet(e.entry_date).split(' ')[0]}</span>
                </button>
              )}

              
            </div>
          </div>
        </div>

        {/* Note */}
        {editingCell === `${cellKey}-note` && !isPreview ? (
          <input value={cellValue} onChange={ev => setCellValue(ev.target.value)}
            onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
            className="hidden sm:block sm:ml-1 px-2 py-1 rounded bg-background border border-border text-[12px] sm:text-[13px] min-w-0 w-full" autoFocus />
        ) : (
          <button onClick={() => !isPreview && startCellEdit(`${cellKey}-note`, e.note || '')}
            className={`hidden sm:block sm:ml-1 text-left whitespace-nowrap overflow-hidden text-ellipsis text-[13px] sm:text-[14px] mr-1 sm:mr-2 ${
              isMoonDay ? 'moon-accent-text' : 'text-muted-foreground'
            } ${!isPreview ? 'hover:text-foreground transition-colors' : 'cursor-default'}`}>
            {e.note || (isScheduledOffDay ? OFF_DAY_NOTE : rateDesc) || '—'}
          </button>
        )}

        {/* Combined clock column */}
        <div className="flex flex-col gap-[0.15rem] min-h-[38px] items-center justify-self-end w-full">
          {editingCell === `${cellKey}-clock_in` && !isPreview ? (
            <button
              onClick={() => openCellClockPicker(e.entry_date, e.sort_order, 'in', e.clock_in)}
              className="w-full rounded border border-border bg-background px-1 py-1 text-center text-[10px] text-emerald-400"
            >
              Chọn giờ
            </button>
          ) : (
            <button onClick={() => !isPreview && openCellClockPicker(e.entry_date, e.sort_order, 'in', e.clock_in)}
              className={`w-full text-center font-medium ${!isPreview ? 'text-emerald-400 hover:underline' : 'text-emerald-400 cursor-default'} self-center -translate-x-1`}>
              {formatClockDecimal(e.clock_in)}
            </button>
          )}
          {editingCell === `${cellKey}-clock_out` && !isPreview ? (
            <button
              onClick={() => openCellClockPicker(e.entry_date, e.sort_order, 'out', e.clock_out)}
              className="w-full rounded border border-border bg-background px-1 py-1 text-center text-[10px] text-accent"
            >
              Chọn giờ
            </button>
          ) : (
            <button onClick={() => !isPreview && openCellClockPicker(e.entry_date, e.sort_order, 'out', e.clock_out)}
              className={`w-full text-center font-medium ${!isPreview ? 'text-accent hover:underline' : 'text-accent cursor-default'} self-center translate-x-1`}>
              {formatClockDecimal(e.clock_out)}
            </button>
          )}
        </div>

        {/* Hours */}
        <div className="justify-self-end flex items-center h-full">
          <span className="text-right font-semibold text-[13px] sm:text-[14px]">{formatHours(hours)}</span>
        </div>

        {/* Allowance */}
        <div className="justify-self-end flex items-center h-full">
          <span className="text-right text-emerald-400 font-semibold text-[13px] sm:text-[14px]">
            {allowanceAmt > 0 ? (allowanceAmt / 1000).toFixed(0) + 'k' : ''}
          </span>
        </div>

        {/* Total */}
        <div className="justify-self-end flex items-center h-full">
          <span className="text-right font-bold text-[14px] sm:text-[16px]">{total > 0 ? (total / 1000).toFixed(0) + 'k' : '—'}</span>
        </div>
      </div>
      {showWeekSep && (
        <div className="py-1.5">
          <div className="h-[2px] rounded-full week-separator" />
        </div>
      )}
      </div>
    );
  };

  const renderEmptyRow = (dateStr: string | null, idx: number) => (
    <div key={`empty-${dateStr || idx}`}>
      <div className={`flex items-start justify-between gap-2 py-2.5 pl-3 pr-3 text-[13px] border-b border-border/20 w-full sm:hidden ${
        idx % 2 !== 0 ? 'bg-muted/20' : ''
      } ${dateStr && scheduledOffDays.has(dateStr) ? 'opacity-50' : ''}`}>
        <div className="min-w-0 flex-1 pr-3">
          <div className="flex items-start gap-1.5">
            {!isPreview && dateStr ? (
              <button
                onClick={() => !scheduledOffDays.has(dateStr) && activateEmptyDay(dateStr)}
                className={`mt-0.5 flex-shrink-0 transition-colors ${
                  scheduledOffDays.has(dateStr)
                    ? 'text-destructive/60 cursor-default'
                    : 'text-destructive/50 hover:text-emerald-400'
                }`}
              >
                <X size={11} />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {dateStr ? (
                <button
                  onClick={() => !isPreview && !scheduledOffDays.has(dateStr) && activateEmptyDay(dateStr)}
                  className={`block -mt-0.5 font-semibold text-[15px] leading-none whitespace-nowrap ${getDayColor(dateStr)} ${
                    !isPreview && !scheduledOffDays.has(dateStr) ? 'hover:underline' : 'cursor-default'
                  }`}
                >
                  {formatDayOnly(dateStr)}
                </button>
              ) : (
                <span className="block font-semibold text-[15px] leading-none whitespace-nowrap opacity-0">00</span>
              )}
              <span className="mt-1 block text-left text-[12px] leading-tight text-muted-foreground">
                {dateStr && scheduledOffDays.has(dateStr) ? OFF_DAY_NOTE : '—'}
              </span>
            </div>
          </div>
        </div>
        <div className="ml-2 flex shrink-0 items-start gap-3 text-right">
          <div className="flex w-[40px] flex-col gap-[0.15rem] text-muted-foreground min-h-[38px] items-end">
            <span className="w-full text-right">—</span>
            <span className="w-full text-right">—</span>
          </div>
          <span className="w-[24px] text-right text-muted-foreground font-semibold">—</span>
          <span className="w-[30px] text-right text-muted-foreground font-semibold">—</span>
          <span className="w-[40px] text-right text-[13px] text-muted-foreground font-bold">—</span>
        </div>
      </div>
      <div className={`hidden sm:grid ${tableGridClass} ${tableGapClass} py-2.5 items-center text-[13px] sm:text-[14px] border-b border-border/20 w-full ${
        idx % 2 !== 0 ? 'bg-muted/20' : ''
      } ${dateStr && scheduledOffDays.has(dateStr) ? 'opacity-50' : ''}`}>
        <div className="pr-4 sm:pr-2">
          <div className="flex items-start gap-1.5">
            {!isPreview && dateStr ? (
              <button
                onClick={() => !scheduledOffDays.has(dateStr) && activateEmptyDay(dateStr)}
                className={`mt-0.5 flex-shrink-0 transition-colors ${
                  scheduledOffDays.has(dateStr)
                    ? 'text-destructive/60 cursor-default'
                    : 'text-destructive/50 hover:text-emerald-400'
                }`}
              >
                <X size={11} />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {dateStr ? (
                <button
                  onClick={() => !isPreview && !scheduledOffDays.has(dateStr) && activateEmptyDay(dateStr)}
                  className={`block -mt-0.5 font-semibold text-[15px] leading-none sm:text-[14px] sm:leading-normal whitespace-nowrap ${getDayColor(dateStr)} ${
                    !isPreview && !scheduledOffDays.has(dateStr) ? 'hover:underline' : 'cursor-default'
                  }`}
                >
                  <span className="sm:hidden">{formatDayOnly(dateStr)}</span>
                  <span className="hidden sm:inline">{formatDateViet(dateStr).split(' ')[0]}</span>
                </button>
              ) : (
                <span className="block font-semibold text-[15px] leading-none sm:text-[14px] sm:leading-normal whitespace-nowrap opacity-0">00</span>
              )}
              <span className="mt-1 block text-left text-[12px] leading-tight text-muted-foreground sm:hidden">
                {dateStr && scheduledOffDays.has(dateStr) ? OFF_DAY_NOTE : '—'}
              </span>
            </div>
          </div>
        </div>
        <span className="hidden sm:block sm:ml-1 text-left text-[13px] sm:text-[14px] text-muted-foreground mr-1 sm:mr-2">
          {dateStr && scheduledOffDays.has(dateStr) ? OFF_DAY_NOTE : '—'}
        </span>
        <div className="flex flex-col gap-[0.15rem] text-muted-foreground min-h-[38px] items-center justify-self-end w-full">
          <span className="w-full self-center -translate-x-0.5 text-center">—</span>
          <span className="w-full self-center translate-x-0.5 text-center">—</span>
        </div>
        <span className="justify-self-end text-right text-muted-foreground font-semibold">—</span>
        <span className="justify-self-end text-right text-muted-foreground font-semibold">—</span>
        <span className="justify-self-end text-right text-[13px] sm:text-[15px] text-muted-foreground font-bold">—</span>
      </div>
    </div>
  );

  const renderTableHeader = () => (
    <>
    <div className="flex items-center justify-between gap-2 py-2.5 pl-3 pr-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 w-full sm:hidden">
      <span className="flex items-center justify-center">
        <button
          onClick={() => !isPreview && setAddingDate(prev => !prev)}
          className={`mx-auto flex items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-wider ${
            !isPreview
              ? 'border-border/60 bg-muted/40 hover:border-border hover:bg-muted/70 hover:text-foreground transition-colors'
              : 'border-border/30 bg-muted/20 cursor-default'
          }`}
          aria-label="Thêm dòng theo ngày"
        >
          <span>Ngày</span>
          <Plus size={11} />
        </button>
      </span>
      <div className="ml-2 flex shrink-0 items-center gap-3 text-right">
        <span className="w-[40px] text-center normal-case">Vào / Ra</span>
        <span className="w-[24px] text-right">Giờ</span>
        <span className="w-[30px] text-right">PC</span>
        <span className="w-[40px] text-right">Tổng</span>
      </div>
    </div>
    <div className={`hidden sm:grid ${tableGridClass} ${tableGapClass} py-2.5 items-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 w-full`}>
      <span className="flex items-center justify-center sm:justify-center">
        <button
          onClick={() => !isPreview && setAddingDate(prev => !prev)}
          className={`mx-auto flex items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-wider ${
            !isPreview
              ? 'border-border/60 bg-muted/40 hover:border-border hover:bg-muted/70 hover:text-foreground transition-colors'
              : 'border-border/30 bg-muted/20 cursor-default'
          }`}
          aria-label="Thêm dòng theo ngày"
        >
          <span>Ngày</span>
          <Plus size={11} />
        </button>
      </span>
      <span className="hidden sm:block text-center">Ghi chú</span>
      <span className="text-center">Vào / Ra</span>
      <span className="text-right">Giờ</span>
      <span className="text-right">Phụ cấp</span>
      <span className="text-right">Tổng</span>
    </div>
    </>
  );

  const renderCompact = () => {
    const emptyCount = Math.max(0, 10 - workingEntries.length);
    const emptyRows = Array.from({ length: emptyCount }, (_, i) => ({
      idx: i + workingEntries.length,
      dateStr: null,
    }));

    return (
      <div className="w-full overflow-x-auto pb-2">
        <div className="w-full min-w-0">
          {addingDate && !isPreview && (
            <div className="flex items-center gap-2 px-2 py-2 border-b border-border/20">
              <input
                type="date"
                value={newRowDate}
                min={periodStart}
                max={periodEnd}
                onChange={(e) => setNewRowDate(clampDateToPeriod(e.target.value))}
                onBlur={(e) => setNewRowDate(clampDateToPeriod(e.target.value))}
                className="px-2 py-1 rounded bg-background border border-border text-[11px]"
              />
              <button
                onClick={() => {
                  onAddRowAtDate(clampDateToPeriod(newRowDate));
                  setAddingDate(false);
                }}
                className="px-2 py-1 rounded bg-muted text-[10px] text-foreground hover:bg-muted/80 transition-colors"
              >
                Tạo dòng
              </button>
              <button
                onClick={() => setAddingDate(false)}
                className="px-2 py-1 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              >
                Hủy
              </button>
            </div>
          )}
          <div className="px-2 py-2 text-[11px] text-muted-foreground font-semibold flex items-center justify-between border-b border-border/40">
            <span>Chế độ gọn · {workingEntries.length} ngày làm</span>
          </div>
          {renderTableHeader()}
          <div className="divide-y divide-border/20">
            {workingEntries.map((e, idx) => renderRow(e, idx, workingEntries))}
            {emptyRows.map(({ idx, dateStr }) => renderEmptyRow(dateStr, idx))}
          </div>
        </div>
      </div>
    );
  };

  const renderPage = (page: { startDate: string; endDate: string; entries: SalaryEntry[] }) => {
    const pageDates = generateDateRange(page.startDate, page.endDate);
    const pageRows = pageDates.map((dateStr, idx) => ({
      idx,
      dateStr,
      entry: page.entries.find(entry => entry.entry_date === dateStr) || null,
    }));
    const orderedEntries = pageRows
      .filter((row): row is { idx: number; dateStr: string; entry: SalaryEntry } => row.entry !== null)
      .map(row => row.entry);

    return (
      <div className="w-full overflow-x-auto pb-2">
        <div className="w-full min-w-0">
          {addingDate && !isPreview && (
            <div className="flex items-center gap-2 px-2 py-2 border-b border-border/20">
              <input
                type="date"
                value={newRowDate}
                min={periodStart}
                max={periodEnd}
                onChange={(e) => setNewRowDate(clampDateToPeriod(e.target.value))}
                onBlur={(e) => setNewRowDate(clampDateToPeriod(e.target.value))}
                className="px-2 py-1 rounded bg-background border border-border text-[11px]"
              />
              <button
                onClick={() => {
                  onAddRowAtDate(clampDateToPeriod(newRowDate));
                  setAddingDate(false);
                }}
                className="px-2 py-1 rounded bg-muted text-[10px] text-foreground hover:bg-muted/80 transition-colors"
              >
                Tạo dòng
              </button>
              <button
                onClick={() => setAddingDate(false)}
                className="px-2 py-1 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              >
                Hủy
              </button>
            </div>
          )}
          {renderTableHeader()}
          <div className="divide-y divide-border/20">
            {pageRows.map((row, idx) =>
              row.entry
                ? renderRow(row.entry, idx, orderedEntries)
                : renderEmptyRow(row.dateStr, idx)
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {!isPreview && (
        <div className="glass-card p-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Từ:</span>
                {pickingRange === 'start' ? (
                  <input type="date" value={customStartDate || periodStart}
                    onChange={e => onCustomDateChange(e.target.value, customEndDate)}
                    onBlur={() => setPickingRange(null)}
                    className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]" autoFocus />
                ) : (
                  <button
                    onClick={() => setPickingRange('start')}
                    className="px-2 py-0.5 rounded bg-background border border-border text-[10px] hover:bg-muted/60 transition-colors"
                  >
                    {formatDateViet(customStartDate || periodStart)}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Đến:</span>
                {pickingRange === 'end' ? (
                  <input type="date" value={customEndDate || periodEnd}
                    onChange={e => onCustomDateChange(customStartDate, e.target.value)}
                    onBlur={() => setPickingRange(null)}
                    className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]" autoFocus />
                ) : (
                  <button
                    onClick={() => setPickingRange('end')}
                    className="px-2 py-0.5 rounded bg-background border border-border text-[10px] hover:bg-muted/60 transition-colors"
                  >
                    {formatDateViet(customEndDate || periodEnd)}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground mr-1">Mặc định:</span>
                <button onClick={() => setPickingClock({ scope: 'default', kind: 'in' })} className="px-2 py-0.5 rounded bg-muted/50 border border-border text-[10px] font-medium text-emerald-400 hover:bg-muted transition-colors">
                  {defaultClockIn}
                </button>
                <span className="text-muted-foreground text-[10px]">-</span>
                <button onClick={() => setPickingClock({ scope: 'default', kind: 'out' })} className="px-2 py-0.5 rounded bg-muted/50 border border-border text-[10px] font-medium text-accent hover:bg-muted transition-colors">
                  {defaultClockOut}
                </button>
              </div>

              <button
                onClick={() => setCompact(!compact)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                  compact ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {compact ? <Check size={10} /> : <X size={10} />}
                Chế độ gọn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table content */}
      <div className="-mx-4 sm:mx-0">
        {compact ? (
          renderCompact()
        ) : pages.length > 0 ? (
          <SwipeablePages
            pages={pages.map(p => renderPage(p))}
            labels={pages.map(p => `${formatDateViet(p.startDate)} — ${formatDateViet(p.endDate)}`)}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        ) : (
          <div className="glass-card p-6 text-center text-muted-foreground text-xs">Chưa có dữ liệu</div>
        )}
      </div>

      {/* Allowances */}
      <EmployeeAllowanceEditor
        allowances={allowances}
        onToggle={onAllowanceToggle}
        onUpdate={onAllowanceUpdate}
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

      {pickingClock && (
        <AnalogClock
          label={
            pickingClock.scope === 'default'
              ? (pickingClock.kind === 'in' ? 'Giờ vào mặc định' : 'Giờ ra mặc định')
              : (pickingClock.kind === 'in' ? 'Giờ vào' : 'Giờ ra')
          }
          onTimeSelect={(time) => {
            if (pickingClock.scope === 'default') {
              if (pickingClock.kind === 'in') setDefaultClockIn(time);
              else setDefaultClockOut(time);
            } else if (pickingClock.entryDate && pickingClock.sortOrder !== undefined) {
              saveCellEdit(
                pickingClock.entryDate,
                pickingClock.sortOrder,
                pickingClock.kind === 'in' ? 'clock_in' : 'clock_out',
                time,
              );
            }
            setPickingClock(null);
          }}
          onClose={() => setPickingClock(null)}
        />
      )}
    </div>
  );
}
