import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcHoursFromTimes, getRateForDate, formatVND, formatDateViet } from '@/lib/salaryCalculations';
import { splitIntoPages } from '@/lib/salaryPaging';
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
  onEntryUpdate, onAllowanceToggle, onAllowanceUpdate,
  onHourlyRateChange, onCustomDateChange, breakdown, isPreview = false,
}: SalaryTableTypeCProps) {
  const [compact, setCompact] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [editingHourly, setEditingHourly] = useState(false);
  const [hourlyInput, setHourlyInput] = useState(hourlyRate.toString());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [defaultClockIn, setDefaultClockIn] = useState<string>('08:00');
  const [defaultClockOut, setDefaultClockOut] = useState<string>('17:30');
  const [pickingClock, setPickingClock] = useState<'in' | 'out' | null>(null);

  const effectiveStart = customStartDate || periodStart;
  const effectiveEnd = customEndDate || periodEnd;

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
      <div className={`grid grid-cols-[75px_minmax(140px,1fr)_84px_60px_70px_80px] gap-1.5 px-2 py-2.5 items-center text-[13px] border-b border-border/20 min-w-max ${
        e.is_day_off ? 'opacity-50' : ''
      } ${idx && idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
        {/* Date + toggle */}
        <div className="flex items-center gap-1.5 pr-2">
          {!isPreview && (
            <button onClick={() => toggleDayOff(e)} className={`flex-shrink-0 transition-colors ${e.is_day_off ? 'text-destructive/60 hover:text-destructive' : 'text-emerald-400/60 hover:text-emerald-400'}`}>
              {e.is_day_off ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          )}
          <span className={`font-semibold text-[12px] whitespace-nowrap ${getDayColor(e.entry_date)}`}>
            {formatDateViet(e.entry_date).split(' ')[0]}
          </span>
        </div>

        {/* Note */}
        {editingCell === `${cellKey}-note` && !isPreview ? (
          <input value={cellValue} onChange={ev => setCellValue(ev.target.value)}
            onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
            className="px-2 py-1 rounded bg-background border border-border text-[11px] min-w-0" autoFocus />
        ) : (
          <button onClick={() => !isPreview && startCellEdit(`${cellKey}-note`, e.note || '')}
            className={`text-left whitespace-nowrap overflow-hidden text-ellipsis text-muted-foreground mr-2 ${!isPreview ? 'hover:text-foreground transition-colors' : 'cursor-default'}`}>
            {e.note || rateDesc || '—'}
          </button>
        )}

        {/* Combined clock column */}
        <div className="flex flex-col gap-[0.15rem] min-h-[38px] items-center">
          {editingCell === `${cellKey}-clock_in` && !isPreview ? (
            <input type="time" value={cellValue} onChange={ev => setCellValue(ev.target.value)}
              onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'clock_in')}
              className="px-1 py-1 rounded bg-background border border-border text-[10px] w-full text-left" autoFocus />
          ) : (
            <button onClick={() => !isPreview && startCellEdit(`${cellKey}-clock_in`, e.clock_in || '')}
              className={`text-center font-medium ${!isPreview ? 'text-emerald-400 hover:underline' : 'text-emerald-400 cursor-default'} self-center -translate-x-1`}>
              {e.clock_in?.slice(0, 5) || '—'}
            </button>
          )}
          {editingCell === `${cellKey}-clock_out` && !isPreview ? (
            <input type="time" value={cellValue} onChange={ev => setCellValue(ev.target.value)}
              onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'clock_out')}
              className="px-1 py-1 rounded bg-background border border-border text-[10px] w-full text-right" autoFocus />
          ) : (
            <button onClick={() => !isPreview && startCellEdit(`${cellKey}-clock_out`, e.clock_out || '')}
              className={`text-center font-medium ${!isPreview ? 'text-accent hover:underline' : 'text-accent cursor-default'} self-center translate-x-1`}>
              {e.clock_out?.slice(0, 5) || '—'}
            </button>
          )}
        </div>

        {/* Hours */}
        <span className="text-right font-semibold text-[13px]">{hours > 0 ? hours.toFixed(1) : '—'}</span>

        {/* Extra wage */}
        <span className="text-right text-emerald-400 font-semibold text-[13px]">
          {baseWage > 0 ? (baseWage / 1000).toFixed(0) + 'k' : '—'}
        </span>

        {/* Total */}
        <span className="text-right font-bold text-[14px]">{total > 0 ? (total / 1000).toFixed(0) + 'k' : '—'}</span>
      </div>
      {showWeekSep && (
        <div className="py-1.5">
          <div className="h-[2px] rounded-full week-separator" />
        </div>
      )}
      </div>
    );
  };

  const renderEmptyRow = (idx: number) => (
    <div key={`empty-${idx}`}>
      <div className={`grid grid-cols-[75px_minmax(140px,1fr)_84px_60px_70px_80px] gap-1.5 px-2 py-2.5 items-center text-[13px] border-b border-border/20 min-w-max ${
        idx % 2 !== 0 ? 'bg-muted/20' : ''
      }`}>
        <div className="flex items-center gap-1.5 pr-2 opacity-0">
          <button className="flex-shrink-0"><Eye size={11} /></button>
          <span className="font-semibold text-[12px]">00/00</span>
        </div>
        <span className="text-left text-muted-foreground mr-2">—</span>
        <div className="flex flex-col gap-[0.15rem] text-muted-foreground min-h-[38px] items-center">
          <span className="self-center -translate-x-1 text-center">—</span>
          <span className="self-center translate-x-1 text-center">—</span>
        </div>
        <span className="text-right text-muted-foreground font-semibold">—</span>
        <span className="text-right text-muted-foreground font-semibold">—</span>
        <span className="text-right text-muted-foreground font-bold">—</span>
      </div>
    </div>
  );

  const renderTableHeader = () => (
    <div className="grid grid-cols-[75px_minmax(140px,1fr)_84px_60px_70px_80px] gap-1.5 px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 min-w-max">
      <span>Ngày</span>
      <span>Ghi chú</span>
      <span className="text-right">Vào / Ra</span>
      <span className="text-right">Giờ</span>
      <span className="text-right">Thêm</span>
      <span className="text-right">Tổng</span>
    </div>
  );

  const renderCompact = () => {
    const emptyCount = Math.max(0, 10 - workingEntries.length);
    const emptyRows = Array.from({ length: emptyCount }, (_, i) => i + workingEntries.length);

    return (
      <div className="w-full overflow-x-auto pb-2">
        <div className="min-w-max">
          <div className="px-2 py-2 text-[11px] text-muted-foreground font-semibold flex items-center justify-between border-b border-border/40">
            <span>Chế độ gọn · {workingEntries.length} ngày làm</span>
          </div>
          {renderTableHeader()}
          <div className="divide-y divide-border/20">
            {workingEntries.map((e, idx) => renderRow(e, idx, workingEntries))}
            {emptyRows.map(idx => renderEmptyRow(idx))}
          </div>
        </div>
      </div>
    );
  };

  const renderPage = (pageEntries: SalaryEntry[]) => {
    const emptyCount = Math.max(0, 10 - pageEntries.length);
    const emptyRows = Array.from({ length: emptyCount }, (_, i) => i + pageEntries.length);

    return (
      <div className="w-full overflow-x-auto pb-2">
        <div className="min-w-max">
          {renderTableHeader()}
          <div className="divide-y divide-border/20">
            {pageEntries.map((e, idx) => renderRow(e, idx, pageEntries))}
            {emptyRows.map(idx => renderEmptyRow(idx))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="glass-card p-3">
        <h3 className="font-display font-semibold text-[15px] text-foreground">Bảng lương - Loại C</h3>
        
        {/* Controls Panel */}
        {!isPreview && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
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
          pages={pages.map(p => renderPage(p.entries))}
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
