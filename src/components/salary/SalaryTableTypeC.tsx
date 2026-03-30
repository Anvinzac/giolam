import { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Plus } from 'lucide-react';
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
  entries, rates, allowances, hourlyRate,
  periodStart, periodEnd, customStartDate, customEndDate,
  onEntryUpdate, onEntryDateChange, onAddRowAtDate, onAllowanceToggle, onAllowanceUpdate,
  onHourlyRateChange, onCustomDateChange, breakdown, isPreview = false,
}: SalaryTableTypeCProps) {
  const tableGridClass = 'grid-cols-[56px_minmax(88px,1fr)_62px_38px_46px_52px] sm:grid-cols-[75px_minmax(140px,1fr)_84px_60px_70px_80px]';
  const tableGapClass = 'gap-1 sm:gap-1.5 px-1.5 sm:px-2';
  const [compact, setCompact] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [editingHourly, setEditingHourly] = useState(false);
  const [hourlyInput, setHourlyInput] = useState(hourlyRate.toString());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState('');
  const [addingDate, setAddingDate] = useState(false);
  const [newRowDate, setNewRowDate] = useState(periodStart);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const pendingDateTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTappedDateRef = useRef<string | null>(null);

  const [defaultClockIn, setDefaultClockIn] = useState<string>('08:00');
  const [defaultClockOut, setDefaultClockOut] = useState<string>('17:30');
  const [pickingClock, setPickingClock] = useState<'in' | 'out' | null>(null);

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

  const pages = useMemo(() =>
    splitIntoPages(effectiveStart, effectiveEnd, filteredEntries),
    [effectiveStart, effectiveEnd, filteredEntries]
  );

  const workingEntries = useMemo(() =>
    filteredEntries.filter(e => !e.is_day_off && (e.clock_in || e.clock_out)),
    [filteredEntries]
  );

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

  const saveHourlyRate = () => {
    onHourlyRateChange(parseInt(hourlyInput) || 25000);
    setEditingHourly(false);
  };

  const startCellEdit = (key: string, val: string) => {
    setEditingCell(key);
    setCellValue(val);
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
    return date.toISOString().slice(0, 10);
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

  const saveCellEdit = (entryDate: string, sortOrder: number, field: string) => {
    const updates: Partial<SalaryEntry> = {};
    if (field === 'clock_in') updates.clock_in = cellValue || null;
    if (field === 'clock_out') updates.clock_out = cellValue || null;
    if (field === 'note') updates.note = cellValue || null;
    onEntryUpdate(entryDate, sortOrder, updates);
    setEditingCell(null);
  };

  const toggleDayOff = (e: SalaryEntry) => {
    onEntryUpdate(e.entry_date, e.sort_order, {
      is_day_off: !e.is_day_off,
      ...(e.is_day_off ? { clock_in: defaultClockIn, clock_out: defaultClockOut } : { clock_in: null, clock_out: null, total_hours: null }),
    });
  };

  const renderRow = (e: SalaryEntry, idx?: number, allEntries?: SalaryEntry[]) => {
    const { rate, hours, baseWage, allowanceAmt, total } = computeRow(e);
    const rateDesc = rates.find(r => r.special_date === e.entry_date)?.description_vi;
    const cellKey = `${e.entry_date}-${e.sort_order}`;

    // Show week separator after Sunday, if not the last row
    const isSunday = new Date(e.entry_date + 'T00:00:00').getDay() === 0;
    const entries = allEntries || [];
    const nextEntry = idx !== undefined ? entries[idx + 1] : undefined;
    const showWeekSep = isSunday && nextEntry !== undefined;

    return (
      <div key={cellKey}>
      <div className={`grid ${tableGridClass} ${tableGapClass} py-2.5 items-center text-[12px] sm:text-[13px] border-b border-border/20 w-full ${
        e.is_day_off ? 'opacity-50' : ''
      } ${idx && idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
        {/* Date + toggle */}
        <div className="flex items-center gap-1.5 pr-2">
          {!isPreview && (
          <button onClick={() => toggleDayOff(e)} className={`flex-shrink-0 transition-colors ${e.is_day_off ? 'text-destructive/60 hover:text-destructive' : 'text-emerald-400/60 hover:text-emerald-400'}`}>
              {e.is_day_off ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          )}
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
              onClick={() => queueDateTapAction(e, cellKey)}
              onDoubleClick={() => {
                if (isPreview) return;
                if (pendingDateTapRef.current) clearTimeout(pendingDateTapRef.current);
                pendingDateTapRef.current = null;
                lastTappedDateRef.current = null;
                onAddRowAtDate(formatNextDay(e.entry_date));
              }}
              className={`font-semibold text-[11px] sm:text-[12px] whitespace-nowrap ${getDayColor(e.entry_date)} ${!isPreview ? 'hover:underline' : 'cursor-default'}`}
            >
              {formatDateViet(e.entry_date).split(' ')[0]}
            </button>
          )}
        </div>

        {/* Note */}
        {editingCell === `${cellKey}-note` && !isPreview ? (
          <input value={cellValue} onChange={ev => setCellValue(ev.target.value)}
            onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
            className="px-2 py-1 rounded bg-background border border-border text-[11px] min-w-0 w-full" autoFocus />
        ) : (
          <button onClick={() => !isPreview && startCellEdit(`${cellKey}-note`, e.note || '')}
            className={`text-left whitespace-nowrap overflow-hidden text-ellipsis text-muted-foreground mr-1 sm:mr-2 ${!isPreview ? 'hover:text-foreground transition-colors' : 'cursor-default'}`}>
            {e.note || rateDesc || '—'}
          </button>
        )}

        {/* Combined clock column */}
        <div className="flex flex-col gap-[0.15rem] min-h-[38px] items-center">
          {editingCell === `${cellKey}-clock_in` && !isPreview ? (
            <input type="time" value={cellValue} onChange={ev => setCellValue(ev.target.value)}
              onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'clock_in')}
              className="px-1 py-1 rounded bg-background border border-border text-[10px] w-full text-center" autoFocus />
          ) : (
            <button onClick={() => !isPreview && startCellEdit(`${cellKey}-clock_in`, e.clock_in || '')}
              className={`w-full text-center font-medium ${!isPreview ? 'text-emerald-400 hover:underline' : 'text-emerald-400 cursor-default'} self-center -translate-x-0.5`}>
              {e.clock_in?.slice(0, 5) || '—'}
            </button>
          )}
          {editingCell === `${cellKey}-clock_out` && !isPreview ? (
            <input type="time" value={cellValue} onChange={ev => setCellValue(ev.target.value)}
              onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'clock_out')}
              className="px-1 py-1 rounded bg-background border border-border text-[10px] w-full text-center" autoFocus />
          ) : (
            <button onClick={() => !isPreview && startCellEdit(`${cellKey}-clock_out`, e.clock_out || '')}
              className={`w-full text-center font-medium ${!isPreview ? 'text-accent hover:underline' : 'text-accent cursor-default'} self-center translate-x-0.5`}>
              {e.clock_out?.slice(0, 5) || '—'}
            </button>
          )}
        </div>

        {/* Hours */}
        <span className="text-right font-semibold text-[12px] sm:text-[13px]">{hours > 0 ? hours.toFixed(1) : '—'}</span>

        {/* Extra wage */}
        <span className="text-right text-emerald-400 font-semibold text-[12px] sm:text-[13px]">
          {baseWage > 0 ? (baseWage / 1000).toFixed(0) + 'k' : '—'}
        </span>

        {/* Total */}
        <span className="text-right font-bold text-[12px] sm:text-[14px]">{total > 0 ? (total / 1000).toFixed(0) + 'k' : '—'}</span>
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
      <div className={`grid ${tableGridClass} ${tableGapClass} py-2.5 items-center text-[12px] sm:text-[13px] border-b border-border/20 w-full ${
        idx % 2 !== 0 ? 'bg-muted/20' : ''
      }`}>
        <div className="flex items-center gap-1.5 pr-2">
          <span className={`font-semibold text-[11px] sm:text-[12px] whitespace-nowrap ${dateStr ? getDayColor(dateStr) : 'opacity-0'}`}>
            {dateStr ? formatDateViet(dateStr).split(' ')[0] : '00/00'}
          </span>
        </div>
        <span className="text-left text-muted-foreground mr-1 sm:mr-2">—</span>
        <div className="flex flex-col gap-[0.15rem] text-muted-foreground min-h-[38px] items-center">
          <span className="w-full self-center -translate-x-0.5 text-center">—</span>
          <span className="w-full self-center translate-x-0.5 text-center">—</span>
        </div>
        <span className="text-right text-muted-foreground font-semibold">—</span>
        <span className="text-right text-muted-foreground font-semibold">—</span>
        <span className="text-right text-muted-foreground font-bold">—</span>
      </div>
    </div>
  );

  const renderTableHeader = () => (
    <div className={`grid ${tableGridClass} ${tableGapClass} py-2.5 items-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 w-full`}>
      <span className="flex items-center">
        <button
          onClick={() => !isPreview && setAddingDate(prev => !prev)}
          className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-wider ${
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
      <span>Ghi chú</span>
      <span className="text-center">Vào / Ra</span>
      <span className="text-right">Giờ</span>
      <span className="text-right">Thêm</span>
      <span className="text-right">Tổng</span>
    </div>
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
    const filledDates = new Set(page.entries.map(entry => entry.entry_date));
    const emptyRows = pageDates
      .filter(dateStr => !filledDates.has(dateStr))
      .map((dateStr, idx) => ({ dateStr, idx: page.entries.length + idx }));

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
            </div>
          )}
          {renderTableHeader()}
          <div className="divide-y divide-border/20">
            {page.entries.map((e, idx) => renderRow(e, idx, page.entries))}
            {emptyRows.map(({ dateStr, idx }) => renderEmptyRow(dateStr, idx))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="glass-card p-2.5">
        {/* Controls Panel */}
        {!isPreview && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Custom date range */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Từ:</span>
              <input type="date" value={customStartDate || periodStart}
                onChange={e => onCustomDateChange(e.target.value, customEndDate)}
                className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Đến:</span>
              <input type="date" value={customEndDate || periodEnd}
                onChange={e => onCustomDateChange(customStartDate, e.target.value)}
                className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Default Clocks */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground mr-1">Mặc định:</span>
              <button onClick={() => setPickingClock('in')} className="px-2 py-0.5 rounded bg-muted/50 border border-border text-[10px] font-medium text-emerald-400 hover:bg-muted transition-colors">
                {defaultClockIn}
              </button>
              <span className="text-muted-foreground text-[10px]">-</span>
              <button onClick={() => setPickingClock('out')} className="px-2 py-0.5 rounded bg-muted/50 border border-border text-[10px] font-medium text-accent hover:bg-muted transition-colors">
                {defaultClockOut}
              </button>
            </div>

            {/* Compact toggle */}
            <button
              onClick={() => setCompact(!compact)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                compact ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {compact ? <Eye size={10} /> : <EyeOff size={10} />}
              Chế độ gọn
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Table content */}
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
          label={pickingClock === 'in' ? 'Giờ vào mặc định' : 'Giờ ra mặc định'}
          onTimeSelect={(time) => {
            if (pickingClock === 'in') setDefaultClockIn(time);
            else setDefaultClockOut(time);
            setPickingClock(null);
          }}
          onClose={() => setPickingClock(null)}
        />
      )}
    </div>
  );
}
