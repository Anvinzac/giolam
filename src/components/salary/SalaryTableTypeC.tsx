import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcHoursFromTimes, getRateForDate, formatVND, formatDateViet } from '@/lib/salaryCalculations';
import { splitIntoPages } from '@/lib/salaryPaging';
import { getMoonEmoji } from '@/lib/lunarUtils';
import SwipeablePages from './SwipeablePages';
import EmployeeAllowanceEditor from './EmployeeAllowanceEditor';
import TotalSalaryDisplay from './TotalSalaryDisplay';
import SalaryBreakdownPopup from './SalaryBreakdownPopup';

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
}

export default function SalaryTableTypeC({
  entries, rates, allowances, hourlyRate,
  periodStart, periodEnd, customStartDate, customEndDate,
  onEntryUpdate, onAllowanceToggle, onAllowanceUpdate,
  onHourlyRateChange, onCustomDateChange, breakdown,
}: SalaryTableTypeCProps) {
  const [compact, setCompact] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [editingHourly, setEditingHourly] = useState(false);
  const [hourlyInput, setHourlyInput] = useState(hourlyRate.toString());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

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
      ...(e.is_day_off ? {} : { clock_in: null, clock_out: null, total_hours: null }),
    });
  };

  const renderRow = (e: SalaryEntry, idx?: number, allEntries?: SalaryEntry[]) => {
    const { rate, hours, baseWage, allowanceAmt, total } = computeRow(e);
    const moon = getMoonEmoji(new Date(e.entry_date + 'T00:00:00'));
    const cellKey = `${e.entry_date}-${e.sort_order}`;

    // Show week separator after Sunday, if not the last row
    const isSunday = new Date(e.entry_date + 'T00:00:00').getDay() === 0;
    const entries = allEntries || [];
    const nextEntry = idx !== undefined ? entries[idx + 1] : undefined;
    const showWeekSep = isSunday && nextEntry !== undefined;

    return (
      <div key={cellKey}>
      <div className={`grid grid-cols-[65px_1fr_45px_45px_35px_55px_65px] gap-1 px-1 py-2.5 items-center text-[13px] border-b border-border/20 ${
        e.is_day_off ? 'opacity-50' : ''
      } ${idx && idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
        {/* Date + toggle */}
        <div className="flex items-center gap-1">
          <button onClick={() => toggleDayOff(e)} className={`flex-shrink-0 transition-colors ${e.is_day_off ? 'text-destructive/60 hover:text-destructive' : 'text-emerald-400/60 hover:text-emerald-400'}`}>
            {e.is_day_off ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
          <span className={`font-semibold text-[12px] truncate ${getDayColor(e.entry_date)}`}>
            {moon}{formatDateViet(e.entry_date).split(' ')[0]}
          </span>
        </div>

        {/* Note */}
        {editingCell === `${cellKey}-note` ? (
          <input value={cellValue} onChange={ev => setCellValue(ev.target.value)}
            onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
            className="px-2 py-1 rounded bg-background border border-border text-[11px] min-w-0" autoFocus />
        ) : (
          <button onClick={() => startCellEdit(`${cellKey}-note`, e.note || '')}
            className="text-left truncate text-muted-foreground hover:text-foreground transition-colors">
            {e.note || '—'}
          </button>
        )}

        {/* Clock in */}
        {editingCell === `${cellKey}-clock_in` ? (
          <input type="time" value={cellValue} onChange={ev => setCellValue(ev.target.value)}
            onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'clock_in')}
            className="px-1 py-1 rounded bg-background border border-border text-[10px] w-full text-right" autoFocus />
        ) : (
          <button onClick={() => startCellEdit(`${cellKey}-clock_in`, e.clock_in || '')}
            className="text-right text-emerald-400 hover:underline font-medium">
            {e.clock_in?.slice(0, 5) || '—'}
          </button>
        )}

        {/* Clock out */}
        {editingCell === `${cellKey}-clock_out` ? (
          <input type="time" value={cellValue} onChange={ev => setCellValue(ev.target.value)}
            onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'clock_out')}
            className="px-1 py-1 rounded bg-background border border-border text-[10px] w-full text-right" autoFocus />
        ) : (
          <button onClick={() => startCellEdit(`${cellKey}-clock_out`, e.clock_out || '')}
            className="text-right text-accent hover:underline font-medium">
            {e.clock_out?.slice(0, 5) || '—'}
          </button>
        )}

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

  const renderTableHeader = () => (
    <div className="grid grid-cols-[65px_1fr_45px_45px_35px_55px_65px] gap-1 px-1 py-2.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40">
      <span>Ngày</span>
      <span>Ghi chú</span>
      <span className="text-right">Vào</span>
      <span className="text-right">Ra</span>
      <span className="text-right">Giờ</span>
      <span className="text-right">Thêm</span>
      <span className="text-right">Tổng</span>
    </div>
  );

  const renderCompact = () => (
    <div>
      <div className="px-1 py-2 text-[11px] text-muted-foreground font-semibold flex items-center justify-between border-b border-border/40">
        <span>Chế độ gọn · {workingEntries.length} ngày làm</span>
      </div>
      {renderTableHeader()}
      <div className="divide-y divide-border/20">
        {workingEntries.map((e, idx) => renderRow(e, idx, workingEntries))}
      </div>
      {workingEntries.length === 0 && (
        <div className="p-6 text-center text-muted-foreground text-sm">Chưa có ngày làm</div>
      )}
    </div>
  );

  const renderPage = (pageEntries: SalaryEntry[]) => (
    <div>
      {renderTableHeader()}
      <div className="divide-y divide-border/20">
        {pageEntries.map((e, idx) => renderRow(e, idx, pageEntries))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="glass-card p-3">
        <h3 className="font-display font-semibold text-[15px] text-foreground">Bảng lương - Loại C</h3>

        {/* Custom date range */}
        <div className="flex items-center gap-2 mt-2">
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

        {/* Compact toggle */}
        <div className="flex items-center gap-2 mt-2">
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
    </div>
  );
}
