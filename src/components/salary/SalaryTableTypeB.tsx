import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcDailyBase, calcHoursFromTimes, getRateForDate, formatVND, formatDateViet } from '@/lib/salaryCalculations';
import { splitIntoPages } from '@/lib/salaryPaging';
import { getMoonEmoji } from '@/lib/lunarUtils';
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
  onHourlyRateChange: (rate: number) => void;
  breakdown: SalaryBreakdown | null;
}

export default function SalaryTableTypeB({
  entries, rates, allowances, baseSalary, hourlyRate,
  periodStart, periodEnd,
  onEntryUpdate, onAddDuplicateRow, onRemoveEntry,
  onAllowanceToggle, onAllowanceUpdate, onHourlyRateChange,
  breakdown,
}: SalaryTableTypeBProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [editingHourly, setEditingHourly] = useState(false);
  const [hourlyInput, setHourlyInput] = useState(hourlyRate.toString());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

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
    const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in, e.clock_out) ?? 0;
    const extraWage = roundToThousand(hours * hourlyRate);
    const total = e.is_day_off ? 0 : dailyBase + allowance + extraWage;
    return { rate, allowance, hours, extraWage, total };
  };

  const saveHourlyRate = () => {
    const val = parseInt(hourlyInput) || 25000;
    onHourlyRateChange(val);
    setEditingHourly(false);
  };

  const startCellEdit = (key: string, val: string) => {
    setEditingCell(key);
    setCellValue(val);
  };

  const saveCellEdit = (entryDate: string, sortOrder: number, field: string) => {
    const updates: Partial<SalaryEntry> = {};
    if (field === 'clock_out') updates.clock_out = cellValue || null;
    if (field === 'note') updates.note = cellValue || null;
    if (field === 'total_hours') updates.total_hours = parseFloat(cellValue) || null;
    onEntryUpdate(entryDate, sortOrder, updates);
    setEditingCell(null);
  };

  const renderPage = (pageEntries: SalaryEntry[], pageStart: string, pageEnd: string) => (
    <div className="glass-card overflow-hidden">
      <div className="px-2 py-1.5 bg-muted/20 text-[10px] text-muted-foreground font-medium">
        {formatDateViet(pageStart)} — {formatDateViet(pageEnd)}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[62px_minmax(40px,1fr)_48px_36px_36px_56px_68px] gap-0.5 px-1.5 py-1.5 bg-muted/30 text-[8px] font-semibold text-muted-foreground uppercase">
        <span>Ngày</span>
        <span>Ghi chú</span>
        <span className="text-right">Ra</span>
        <span className="text-right">Giờ</span>
        <span className="text-right">TL</span>
        <span className="text-right">Thêm</span>
        <span className="text-right">Tổng</span>
      </div>

      <div className="divide-y divide-border/20">
        {pageEntries.map((e) => {
          const { rate, allowance, hours, extraWage, total } = computeRow(e);
          const moon = getMoonEmoji(new Date(e.entry_date + 'T00:00:00'));
          const cellKey = `${e.entry_date}-${e.sort_order}`;
          const isDupe = e.sort_order > 0;

          return (
            <div key={cellKey} className={`grid grid-cols-[62px_minmax(40px,1fr)_48px_36px_36px_56px_68px] gap-0.5 px-1.5 py-1.5 items-center text-[10px] ${
              e.is_day_off ? 'opacity-40' : ''
            }`}>
              {/* Date */}
              <div className="flex items-center gap-0.5">
                {isDupe ? (
                  <button onClick={() => e.id && onRemoveEntry(e.id)} className="text-destructive/60">
                    <Trash2 size={8} />
                  </button>
                ) : (
                  <button onClick={() => onAddDuplicateRow(e.entry_date)} className="text-muted-foreground hover:text-primary">
                    <Plus size={8} />
                  </button>
                )}
                <span className={`font-medium ${getDayColor(e.entry_date)}`}>
                  {moon && <span className="mr-0.5">{moon}</span>}
                  {isDupe ? '↳' : formatDateViet(e.entry_date).split(' ')[0]}
                </span>
              </div>

              {/* Note */}
              {editingCell === `${cellKey}-note` ? (
                <input
                  value={cellValue}
                  onChange={ev => setCellValue(ev.target.value)}
                  onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'note')}
                  onKeyDown={ev => ev.key === 'Enter' && saveCellEdit(e.entry_date, e.sort_order, 'note')}
                  className="px-0.5 py-0 rounded bg-background border border-border text-[10px] min-w-0"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => startCellEdit(`${cellKey}-note`, e.note || '')}
                  className="text-left truncate text-muted-foreground hover:text-foreground"
                >
                  {e.note || '—'}
                </button>
              )}

              {/* Clock out */}
              {editingCell === `${cellKey}-clock_out` ? (
                <input
                  type="time"
                  value={cellValue}
                  onChange={ev => setCellValue(ev.target.value)}
                  onBlur={() => saveCellEdit(e.entry_date, e.sort_order, 'clock_out')}
                  className="px-0 py-0 rounded bg-background border border-border text-[9px] w-full"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => startCellEdit(`${cellKey}-clock_out`, e.clock_out || '')}
                  className="text-right text-accent hover:underline"
                >
                  {e.clock_out?.slice(0, 5) || '—'}
                </button>
              )}

              {/* Hours */}
              <span className="text-right font-medium">
                {hours > 0 ? hours.toFixed(1) : '—'}
              </span>

              {/* Rate */}
              <span className={`text-right ${e.allowance_rate_override !== null ? 'text-accent' : ''}`}>
                {rate > 0 ? `${rate}%` : '—'}
              </span>

              {/* Extra wage */}
              <span className="text-right text-emerald-400 font-medium">
                {extraWage > 0 ? formatVND(extraWage).replace(' đ', '') : '—'}
              </span>

              {/* Total */}
              <span className={`text-right font-semibold ${total === 0 ? 'text-muted-foreground' : ''}`}>
                {formatVND(total).replace(' đ', '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="glass-card p-3">
        <h3 className="font-display font-semibold text-sm text-foreground">Bảng lương - Loại B</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">Đơn giá giờ:</span>
          {editingHourly ? (
            <div className="flex items-center gap-1">
              <input
                value={hourlyInput}
                onChange={e => setHourlyInput(e.target.value.replace(/\D/g, ''))}
                className="w-20 px-1.5 py-0.5 rounded bg-background border border-border text-xs text-right"
                inputMode="numeric"
                autoFocus
              />
              <button onClick={saveHourlyRate} className="text-[10px] px-2 py-0.5 rounded gradient-gold text-primary-foreground font-semibold">OK</button>
              <button onClick={() => setEditingHourly(false)} className="text-[10px] text-muted-foreground">Hủy</button>
            </div>
          ) : (
            <button onClick={() => { setHourlyInput(hourlyRate.toString()); setEditingHourly(true); }} className="text-[10px] text-accent hover:underline">
              {formatVND(hourlyRate)}/giờ
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Lương cơ bản: {formatVND(baseSalary)} → {formatVND(dailyBase)}/ngày
        </p>
      </div>

      {/* Swipeable pages */}
      {pages.length > 0 ? (
        <SwipeablePages
          pages={pages.map(p => renderPage(p.entries, p.startDate, p.endDate))}
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
