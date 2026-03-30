import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcDailyBase, calcHoursFromTimes, getRateForDate, formatVND, formatDateViet } from '@/lib/salaryCalculations';
import { splitIntoPages } from '@/lib/salaryPaging';
import SwipeablePages from './SwipeablePages';
import EmployeeAllowanceEditor from './EmployeeAllowanceEditor';
import TotalSalaryDisplay from './TotalSalaryDisplay';
import SalaryBreakdownPopup from './SalaryBreakdownPopup';
import AnalogClock from '../AnalogClock';

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
  onHourlyRateChange: (rate: number) => void;
  globalClockIn: string;
  onGlobalClockInChange: (time: string) => void;
  breakdown: SalaryBreakdown | null;
  isPreview?: boolean;
}

export default function SalaryTableTypeB({
  entries, rates, allowances, baseSalary, hourlyRate,
  periodStart, periodEnd,
  onEntryUpdate, onAddDuplicateRow, onRemoveEntry,
  onAllowanceToggle, onAllowanceUpdate, onHourlyRateChange,
  globalClockIn, onGlobalClockInChange,
  breakdown,
  isPreview = false,
}: SalaryTableTypeBProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [pickingClockOut, setPickingClockOut] = useState<{ entryDate: string; sortOrder: number } | null>(null);

  const dailyBase = useMemo(() => calcDailyBase(baseSalary), [baseSalary]);
  const pages = useMemo(() => splitIntoPages(periodStart, periodEnd, entries), [periodStart, periodEnd, entries]);

  const getDayColor = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    if (day === 6) return 'text-[hsl(175,70%,45%)]';
    if (day === 0) return 'text-[hsl(280,60%,55%)]';
    return '';
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
    if (field === 'clock_out') updates.clock_out = nextValue || null;
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

  const renderPage = (pageEntries: SalaryEntry[]) => (
    <div>
          {/* Column headers */}
          <div className="grid grid-cols-[70px_1fr_50px_40px_70px_80px] gap-1.5 px-1 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40">
            <span>Ngày</span>
            <span className="text-center">Ghi chú</span>
            <span className="text-right">Ra</span>
            <span className="text-right">Giờ</span>
            <span className="text-right">Phụ cấp</span>
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

          // Show week separator after Sunday, if not the last row and next row is a different date
          const isSunday = new Date(e.entry_date + 'T00:00:00').getDay() === 0;
          const nextEntry = pageEntries[idx + 1];
          const isLastSundayRow = isSunday && (!nextEntry || nextEntry.entry_date !== e.entry_date);
          const showWeekSep = isLastSundayRow && nextEntry !== undefined;

          return (
            <div key={cellKey}>
            <div className={`grid grid-cols-[70px_1fr_50px_40px_70px_80px] gap-1.5 px-1 py-3.5 items-center text-[14px] border-b border-border/20 ${
              e.is_day_off ? 'opacity-50' : ''
            } ${idx % 2 !== 0 ? 'bg-muted/20' : ''} ${
              isMoonDay ? 'bg-[linear-gradient(90deg,rgba(236,201,75,0.08),rgba(236,201,75,0.02),transparent)]' : ''
            }`}>
              {/* Date */}
              <div className="flex items-center gap-1">
                {!isPreview && (
                  isDupe ? (
                    <button onClick={() => e.id && onRemoveEntry(e.id)} className="text-destructive/60 hover:text-destructive">
                      <Trash2 size={10} />
                    </button>
                  ) : (
                    <button onClick={() => onAddDuplicateRow(e.entry_date)} className="text-muted-foreground hover:text-primary transition-colors">
                      <Plus size={10} />
                    </button>
                  )
                )}
                <span className={`font-semibold text-sm ${getDayColor(e.entry_date)}`}>
                  {isDupe ? '↳' : formatDateViet(e.entry_date)}
                </span>
              </div>

              {/* Note */}
              {editingCell === `${cellKey}-note` && !isPreview ? (
                <input
                  value={cellValue}
                  onChange={ev => setCellValue(ev.target.value)}
                  onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
                  onKeyDown={ev => ev.key === 'Enter' && saveCellEdit(e.entry_date, e.sort_order, 'note')}
                  className="px-2 py-1.5 rounded bg-background border border-border text-sm min-w-0"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => !isPreview && startCellEdit(`${cellKey}-note`, e.note || '')}
                  className={`text-left truncate text-sm transition-colors ${
                    isMoonDay ? 'text-[hsl(42,55%,70%)]' : 'text-muted-foreground'
                  } ${
                    !isPreview ? 'hover:text-foreground' : 'cursor-default'
                  }`}
                >
                  {e.note || rateDesc || '—'}
                </button>
              )}

              {/* Clock out */}
              {editingCell === `${cellKey}-clock_out` && !isPreview ? (
                <button
                  onClick={() => setPickingClockOut({ entryDate: e.entry_date, sortOrder: e.sort_order })}
                  className="w-full rounded border border-border bg-background px-1 py-1.5 text-right text-sm text-accent"
                >
                  Chọn giờ
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!isPreview) {
                      setEditingCell(`${cellKey}-clock_out`);
                      setPickingClockOut({ entryDate: e.entry_date, sortOrder: e.sort_order });
                    }
                  }}
                  className={`text-right text-sm font-medium ${
                    !isPreview ? 'text-accent hover:underline' : 'text-accent cursor-default'
                  }`}
                >
                  {formatClockDecimal(e.clock_out)}
                </button>
              )}

              {/* Hours */}
              <span className="text-right font-semibold text-[13px]">
                {formatHours(hours)}
              </span>

              {/* Allowance */}
              <span className="text-right text-emerald-400 font-semibold text-[14px]">
                {allowance > 0 ? formatVND(allowance).replace(' đ', '') : ''}
              </span>

              {/* Total */}
              <span className={`text-right font-bold text-[15px] ${total === 0 ? 'text-muted-foreground' : ''}`}>
                {formatVND(total).replace(' đ', '')}
              </span>
            </div>
            {showWeekSep && (
              <div className="py-1.5">
                <div className="h-[2px] rounded-full week-separator" />
              </div>
            )}
            </div>
          );
        })}
        </div>
    </div>
);

  return (
    <div className="space-y-3">
      {/* Swipeable pages */}
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

      {/* Allowances */}
      <EmployeeAllowanceEditor
        allowances={allowances}
        onToggle={onAllowanceToggle}
        onUpdate={onAllowanceUpdate}
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

      {pickingClockOut && (
        <AnalogClock
          label="Giờ ra"
          onTimeSelect={(time) => {
            saveCellEdit(pickingClockOut.entryDate, pickingClockOut.sortOrder, 'clock_out', time);
            setPickingClockOut(null);
          }}
          onClose={() => {
            setEditingCell(null);
            setPickingClockOut(null);
          }}
        />
      )}
    </div>
  );
}
