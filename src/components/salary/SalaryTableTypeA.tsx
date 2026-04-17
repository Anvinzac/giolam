import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcDailyBase, getRateForDate, formatDateViet, VIET_DAYS } from '@/lib/salaryCalculations';
import { getMoonEmoji } from '@/lib/lunarUtils';
import OffPercentSnapper from './OffPercentSnapper';
import EmployeeAllowanceEditor from './EmployeeAllowanceEditor';
import TotalSalaryDisplay from './TotalSalaryDisplay';
import SalaryBreakdownPopup from './SalaryBreakdownPopup';
import PeriodDatePicker from './PeriodDatePicker';

interface SalaryTableTypeAProps {
  entries: SalaryEntry[];
  rates: SpecialDayRate[];
  allowances: EmployeeAllowance[];
  baseSalary: number;
  hourlyRate: number;
  onEntryUpdate: (entryDate: string, sortOrder: number, updates: Partial<SalaryEntry>) => void;
  onAddRowAtDate?: (entryDate: string) => void;
  onRemoveEntry?: (id: string) => void;
  onAllowanceToggle: (key: AllowanceKey) => void;
  onAllowanceUpdate: (key: AllowanceKey, updates: { label?: string; amount?: number }) => void;
  onAddAllowance?: (label: string, amount: number) => void;
  onHourlyRateChange?: (rate: number) => void;
  periodStart?: string;
  periodEnd?: string;
  breakdown: SalaryBreakdown | null;
  isPreview?: boolean;
}

export default function SalaryTableTypeA({
  entries, rates, allowances, baseSalary, hourlyRate,
  onEntryUpdate, onAddRowAtDate, onRemoveEntry, onAllowanceToggle, onAllowanceUpdate, onAddAllowance,
  onHourlyRateChange,
  periodStart, periodEnd, breakdown, isPreview = false,
}: SalaryTableTypeAProps) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editHours, setEditHours] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [expandedOff, setExpandedOff] = useState<string | null>(null);
  const [addingDate, setAddingDate] = useState(false);
  const lastTapRef = useRef<{ date: string; time: number } | null>(null);

  const dailyBase = useMemo(() => calcDailyBase(baseSalary), [baseSalary]);

  // Show all persisted Type A rows, including manually added normal dates.
  const visibleEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => a.entry_date.localeCompare(b.entry_date) || a.sort_order - b.sort_order
    );
  }, [entries]);

  const computeRow = (e: SalaryEntry) => {
    const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
    const allowance = roundToThousand(dailyBase * rate / 100);
    const extraWage = e.total_hours ? roundToThousand(e.total_hours * hourlyRate) : 0;
    const deduction = e.is_day_off ? roundToThousand(dailyBase * e.off_percent / 100) : 0;
    const total = e.is_day_off ? -(deduction) : dailyBase + allowance + extraWage;
    return { rate, allowance, extraWage, deduction, total };
  };

  const totalFromEntries = useMemo(() => {
    return visibleEntries.reduce((sum, e) => {
      const { total } = computeRow(e);
      return sum + total;
    }, 0);
  }, [visibleEntries, dailyBase, rates]);

  const rowKey = (e: SalaryEntry) => `${e.entry_date}-${e.sort_order}`;

  const startEditRow = (e: SalaryEntry) => {
    setEditingRow(rowKey(e));
    setEditNote(e.note || '');
    setEditRate(e.allowance_rate_override?.toString() || '');
    setEditHours(e.total_hours?.toString() || '');
  };

  const saveEditRow = (e: SalaryEntry) => {
    const updates: Partial<SalaryEntry> = { note: editNote || null };
    if (editRate !== '') {
      updates.allowance_rate_override = parseFloat(editRate);
    }
    const parsedHours = parseFloat(editHours);
    updates.total_hours = (!editHours || isNaN(parsedHours) || parsedHours <= 0) ? null : parsedHours;
    onEntryUpdate(e.entry_date, e.sort_order, updates);
    setEditingRow(null);
  };

  const getMoon = (dateStr: string) => getMoonEmoji(new Date(dateStr + 'T00:00:00'));

  const handleDateTap = (entryDate: string, sortOrder: number) => {
    const now = Date.now();
    const last = lastTapRef.current;
    
    if (last && last.date === entryDate && now - last.time < 300) {
      // Double tap detected - toggle off day
      const entry = visibleEntries.find(e => e.entry_date === entryDate && e.sort_order === sortOrder);
      if (entry) {
        onEntryUpdate(entryDate, sortOrder, {
          is_day_off: !entry.is_day_off,
          off_percent: entry.is_day_off ? 0 : 100,
        });
      }
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { date: entryDate, time: now };
    }
  };

  const formatCompact = (amount: number) => {
    if (amount === 0) return '0';
    const isNeg = amount < 0;
    const abs = Math.abs(amount);
    return `${isNeg ? '-' : ''}${abs / 1000}`;
  };

  const getDayColor = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    if (day === 6) return 'text-[hsl(175,70%,45%)]';
    if (day === 0) return 'text-[hsl(280,60%,55%)]';
    return '';
  };

  return (
    <div className="space-y-3">
      {/* Table — bleed to screen edges like Type B/C */}
      <div className="-mx-4 sm:mx-0">
            {/* Column headers */}
            <div className="flex items-center gap-2 pl-3 pr-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40">
              <span className="w-[52px] flex items-center justify-end">
                <button
                  onClick={() => !isPreview && onAddRowAtDate && setAddingDate(prev => !prev)}
                  className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-wider whitespace-nowrap ${
                    !isPreview && onAddRowAtDate
                      ? 'border-border/60 bg-muted/40 hover:border-border hover:bg-muted/70 hover:text-foreground transition-colors'
                      : 'border-border/30 bg-muted/20 cursor-default'
                  }`}
                  aria-label="Thêm ngày"
                >
                  <span>Ngày</span>
                  <Plus size={11} />
                </button>
              </span>
              <span className="flex-1 text-center">Ghi chú</span>
              <span className="w-[40px] text-right">Phụ cấp</span>
              <span className="w-[44px] text-right">Giờ +</span>
              <span className="w-[58px] text-right">Tổng</span>
            </div>

        {addingDate && !isPreview && onAddRowAtDate && (
          <PeriodDatePicker
            periodStart={periodStart || ''}
            periodEnd={periodEnd || ''}
            rates={rates}
            entries={entries}
            onSelect={(date) => {
              onAddRowAtDate(date);
              setAddingDate(false);
            }}
            onClose={() => setAddingDate(false)}
          />
        )}

        <div className="divide-y divide-border/30">
          {visibleEntries.map((e, idx) => {
            const { rate, allowance, extraWage, deduction, total } = computeRow(e);
            const key = rowKey(e);
            const isEditing = editingRow === key && !isPreview;
            const isOff = e.is_day_off;
            const matchedRate = rates.find(r => r.special_date === e.entry_date);
            const rateDesc = matchedRate?.description_vi;
            // Show delete for manually added rows: no matching rate OR a duplicate sort_order
            const isDeletable = !isPreview && onRemoveEntry && e.id &&
              (!matchedRate || e.sort_order > 0);

            return (
              <div key={key}>
                <div
                  className={`flex items-center gap-2 pl-3 pr-3 py-3.5 border-b border-border/20 ${
                    isOff ? 'bg-red-950/25 border-l-2 border-l-red-800/40' : ''
                  } ${isEditing ? 'ring-1 ring-primary/30 bg-primary/8 rounded-lg' : ''} ${idx % 2 !== 0 && !isOff ? 'bg-muted/20' : ''}`}
                >
                  {/* Date */}
                  <button
                    onClick={() => handleDateTap(e.entry_date, e.sort_order)}
                    className={`w-[52px] font-semibold text-[14px] text-left ${getDayColor(e.entry_date)} ${!isPreview ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                  >
                    {formatDateViet(e.entry_date)}
                  </button>

                  {/* Note */}
                  {isEditing ? (
                    <div className="relative flex-1 min-w-0">
                      <input
                        value={editNote}
                        onChange={ev => setEditNote(ev.target.value)}
                        className="w-full px-2 py-1 pr-7 rounded bg-background border border-border text-[14px]"
                        autoFocus
                      />
                      {editNote && (
                        <button
                          onMouseDown={ev => { ev.preventDefault(); setEditNote(''); }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground p-0.5 text-sm"
                          tabIndex={-1}
                        >✕</button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => !isPreview && startEditRow(e)}
                      className={`flex-1 text-left text-[14px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis transition-colors ${!isPreview ? 'hover:text-foreground' : 'cursor-default'}`}
                    >
                      {isOff ? `Nghỉ -${e.off_percent}%` : (rateDesc || '—')}
                    </button>
                  )}

                  {/* Delete button for manually-added rows */}
                  {isDeletable && !isEditing && (
                    <button
                      onClick={() => onRemoveEntry!(e.id!)}
                      className="w-7 flex items-center justify-center text-destructive/40 hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}

                  {/* Allowance */}
                  <span className={`w-[40px] text-right text-[13px] font-semibold ${
                    isOff ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {isOff ? formatCompact(-deduction) : (allowance > 0 ? formatCompact(allowance) : '—')}
                  </span>

                  {/* Extra wage */}
                  <span className={`w-[44px] text-right text-[13px] font-medium ${
                    extraWage > 0 ? 'text-accent' : 'text-muted-foreground/40'
                  }`}>
                    {isOff ? '—' : (extraWage > 0 ? formatCompact(extraWage) : '—')}
                  </span>

                  {/* Total */}
                  <span className={`w-[58px] text-right text-[15px] font-bold ${
                    total < 0 ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {formatCompact(total)}
                  </span>
                </div>

                {/* Edit save bar */}
                {isEditing && (
                  <div className="space-y-2 px-3 pb-3 pt-1">
                    {/* Hours row */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground shrink-0">Giờ thêm</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={editHours}
                        onChange={ev => setEditHours(ev.target.value)}
                        placeholder="0"
                        className="w-[64px] px-2 py-1 rounded bg-background border border-border text-[13px] text-right"
                      />
                      <span className="text-[11px] text-muted-foreground">giờ</span>
                      {editHours && parseFloat(editHours) > 0 && (
                        <span className="text-[11px] text-accent ml-1">
                          = {formatCompact(roundToThousand(parseFloat(editHours) * hourlyRate))}k
                        </span>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button onClick={() => {
                        onEntryUpdate(e.entry_date, e.sort_order, {
                          is_day_off: !e.is_day_off,
                          off_percent: e.is_day_off ? 0 : 100,
                        });
                      }} className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        isOff ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isOff ? 'Đang nghỉ' : 'Đánh nghỉ'}
                      </button>
                      <div className="flex-1" />
                      <button onClick={() => saveEditRow(e)} className="text-[11px] px-4 py-1.5 rounded-lg gradient-gold text-primary-foreground font-semibold">
                        Lưu
                      </button>
                      <button onClick={() => setEditingRow(null)} className="text-[11px] px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                {/* Off percent snapper */}
                {isOff && expandedOff === key && !isPreview && (
                  <div className="px-3 pb-3 pt-1">
                    <OffPercentSnapper
                      value={e.off_percent}
                      onChange={(v) => onEntryUpdate(e.entry_date, e.sort_order, { off_percent: v })}
                    />
                  </div>
                )}
                {isOff && !isEditing && !isPreview && (
                  <button
                    onClick={() => setExpandedOff(expandedOff === key ? null : key)}
                    className="w-full text-[10px] text-center text-muted-foreground py-1 hover:text-foreground transition-colors"
                  >
                    {expandedOff === key ? 'Ẩn' : `Nghỉ ${e.off_percent}% · Nhấn để chỉnh`}
                  </button>
                )}
                {isOff && isPreview && (
                  <div className="w-full text-[10px] text-center text-muted-foreground py-1">
                    Nghỉ {e.off_percent}%
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {visibleEntries.length === 0 && (
          <div className="p-6 text-center text-muted-foreground text-xs">
            Chưa có dữ liệu ngày đặc biệt
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
        total={breakdown?.total ?? totalFromEntries}
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
