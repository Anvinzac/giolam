import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Clock, Check } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcDailyBase, getRateForDate, formatDateViet, VIET_DAYS, formatVND } from '@/lib/salaryCalculations';
import { getMoonEmoji } from '@/lib/lunarUtils';
import OffPercentSnapper from './OffPercentSnapper';
import EmployeeAllowanceEditor from './EmployeeAllowanceEditor';
import TotalSalaryDisplay from './TotalSalaryDisplay';
import SalaryBreakdownPopup from './SalaryBreakdownPopup';
import PeriodDatePicker from './PeriodDatePicker';
import FormulaTooltip from './FormulaTooltip';

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
  editMode?: 'admin' | 'employee' | 'preview';
  onAcceptEntry?: (id: string) => void;
  currentUserId?: string | null;
  deposit?: number;
  onDepositChange?: (amount: number) => void;
}

export default function SalaryTableTypeA({
  entries, rates, allowances, baseSalary, hourlyRate,
  onEntryUpdate, onAddRowAtDate, onRemoveEntry, onAllowanceToggle, onAllowanceUpdate, onAddAllowance,
  onHourlyRateChange,
  periodStart, periodEnd, breakdown, isPreview = false,
  editMode, onAcceptEntry, currentUserId,
  deposit = 0, onDepositChange,
}: SalaryTableTypeAProps) {
  const mode: 'admin' | 'employee' | 'preview' = editMode ?? (isPreview ? 'preview' : 'admin');
  const readOnly = mode === 'preview';
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editHours, setEditHours] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [expandedOff, setExpandedOff] = useState<string | null>(null);
  const [expandedRate, setExpandedRate] = useState<string | null>(null);
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
    const cappedPercent = Math.min(e.off_percent, 100);
    const deduction = e.is_day_off ? roundToThousand(dailyBase * cappedPercent / 100) : 0;
    const total = e.is_day_off ? -(deduction) : dailyBase + allowance + extraWage;
    return { rate, allowance, extraWage, deduction, total };
  };

  const totalFromEntries = useMemo(() => {
    return visibleEntries.reduce((sum, e) => {
      const { total } = computeRow(e);
      return sum + total;
    }, 0);
  }, [visibleEntries, dailyBase, rates]);

  const dailyTotals = useMemo(() => {
    // Type A formula: base salary + each day's rate allowance - deductions
    const parts: number[] = [baseSalary];
    for (const e of visibleEntries) {
      const { allowance, deduction } = computeRow(e);
      if (e.is_day_off && deduction > 0) {
        parts.push(-deduction);
      } else if (allowance > 0) {
        parts.push(allowance);
      }
    }
    // Add extra wages if any
    for (const e of visibleEntries) {
      const { extraWage } = computeRow(e);
      if (extraWage > 0) parts.push(extraWage);
    }
    return parts;
  }, [visibleEntries, dailyBase, rates, baseSalary]);

  const rowKey = (e: SalaryEntry) => `${e.entry_date}-${e.sort_order}`;

  const formatK = (n: number) => Math.round(n / 1000).toString();
  const formulaAllowance = (rate: number): string | null => {
    if (dailyBase <= 0 || rate <= 0) return null;
    return `${rate}% × ${formatK(dailyBase)}`;
  };

  const guiXeSummary = useMemo(() => {
    const fromBreakdown = breakdown?.allowances?.find(a => a.key === 'gui_xe');
    const offDaysCount = visibleEntries.reduce((sum, e) => sum + (e.is_day_off ? 1 : 0), 0);
    const computedAmount = (28 - offDaysCount) * 10000;
    return {
      amount: fromBreakdown?.amount ?? computedAmount,
      enabled: fromBreakdown?.enabled ?? (allowances.find(a => a.allowance_key === 'gui_xe')?.is_enabled ?? false),
    };
  }, [breakdown, visibleEntries, allowances]);

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
    // When extra hours are entered, auto-set the allowance rate to the special day rate
    if (parsedHours > 0 && !updates.allowance_rate_override) {
      const specialRate = rates.find(r => r.special_date === e.entry_date);
      if (specialRate && specialRate.rate_percent > 0) {
        updates.allowance_rate_override = specialRate.rate_percent;
      }
    }
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
    if (day === 6) return 'text-saturday';
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
                  onClick={() => !readOnly && onAddRowAtDate && setAddingDate(prev => !prev)}
                  className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-wider whitespace-nowrap ${
                    !readOnly && onAddRowAtDate
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
              <span className="w-[46px] text-center">Tỷ lệ</span>
              <span className="w-[50px] text-right">Phụ cấp</span>
            </div>

        {addingDate && !readOnly && onAddRowAtDate && (
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
            const isEditing = editingRow === key && !readOnly;
            const isOff = e.is_day_off;
            const matchedRate = rates.find(r => r.special_date === e.entry_date);
            const rateDesc = matchedRate?.description_vi;
            // Show delete for manually added rows: no matching rate OR a duplicate sort_order
            const isDeletable = !readOnly && onRemoveEntry && e.id &&
              (!matchedRate || e.sort_order > 0) &&
              (mode !== 'employee' || e.is_admin_reviewed === false);
            const isPending = mode === 'admin' && e.is_admin_reviewed === false;
            const showAccept = isPending && !!e.id && !!onAcceptEntry &&
              (!currentUserId || e.submitted_by !== currentUserId);

            return (
              <div key={key}>
                <div
                  className={`flex items-center gap-2 pl-3 pr-3 py-3.5 border-b border-border/20 ${
                    isOff ? 'bg-red-950/25 border-l-2 border-l-red-800/40' : ''
                  } ${isPending ? 'border-l-4 border-l-amber-400 bg-amber-500/5' : ''} ${isEditing ? 'ring-1 ring-primary/30 bg-primary/8 rounded-lg' : ''} ${idx % 2 !== 0 && !isOff && !isPending ? 'bg-muted/20' : ''}`}
                >
                  {isPending && (
                    <Clock size={12} className="text-amber-400 shrink-0" aria-label="Chờ duyệt" />
                  )}
                  {/* Date */}
                  <button
                    onClick={() => handleDateTap(e.entry_date, e.sort_order)}
                    className={`w-[52px] font-semibold text-[14px] text-left ${getDayColor(e.entry_date)} ${!readOnly ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
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
                      onClick={() => !readOnly && startEditRow(e)}
                      className={`flex-1 text-left text-[14px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis transition-colors ${!readOnly ? 'hover:text-foreground' : 'cursor-default'}`}
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

                  {/* Rate % */}
                  <span
                    className={`w-[46px] text-center text-[13px] font-medium ${
                      isOff ? 'text-destructive' : rate < 0 ? 'text-destructive' : 'text-muted-foreground'
                    } ${!readOnly && mode === 'admin' && !isOff ? 'cursor-pointer hover:text-foreground transition-colors' : ''}`}
                    onClick={(ev) => {
                      if (readOnly || mode !== 'admin' || isOff) return;
                      ev.stopPropagation();
                      setExpandedRate(expandedRate === key ? null : key);
                    }}
                  >
                    {isOff ? `-${e.off_percent}%` : (rate > 0 ? `${rate}%` : rate < 0 ? `${rate}%` : '—')}
                  </span>

                  {/* Allowance */}
                  <FormulaTooltip formula={formulaAllowance(rate)} className={`w-[50px] text-right text-[14px] font-semibold ${
                    isOff ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {isOff ? formatCompact(-deduction) : (allowance > 0 ? formatCompact(allowance) : '—')}
                  </FormulaTooltip>
                </div>

                {/* Accept pending submission */}
                {showAccept && !isEditing && (
                  <div className="flex justify-end px-3 pb-2 pt-1">
                    <button
                      onClick={() => onAcceptEntry!(e.id!)}
                      className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors flex items-center gap-1"
                    >
                      <Check size={12} /> Duyệt
                    </button>
                  </div>
                )}

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
                {isOff && expandedOff === key && !readOnly && (
                  <div className="px-3 pb-3 pt-1">
                    <OffPercentSnapper
                      value={e.off_percent}
                      onChange={(v) => onEntryUpdate(e.entry_date, e.sort_order, { off_percent: v })}
                    />
                  </div>
                )}
                {isOff && !isEditing && !readOnly && (
                  <button
                    onClick={() => setExpandedOff(expandedOff === key ? null : key)}
                    className="w-full text-[10px] text-center text-muted-foreground py-1 hover:text-foreground transition-colors"
                  >
                    {expandedOff === key ? 'Ẩn' : `Nghỉ ${e.off_percent}% · Nhấn để chỉnh`}
                  </button>
                )}
                {isOff && readOnly && (
                  <div className="w-full text-[10px] text-center text-muted-foreground py-1">
                    Nghỉ {e.off_percent}%
                  </div>
                )}

                {/* Rate snapper — admin can adjust allowance rate */}
                {!isOff && expandedRate === key && !readOnly && mode === 'admin' && (() => {
                  const RATE_SNAPS = [0, 10, 15, 20, 25, 30];
                  const currentRate = e.allowance_rate_override ?? (rates.find(r => r.special_date === e.entry_date)?.rate_percent ?? 0);
                  return (
                    <div className="px-3 pb-3 pt-1">
                      <div className="flex items-center gap-1 py-1.5 overflow-x-auto no-scrollbar">
                        {RATE_SNAPS.map(snap => {
                          const isActive = currentRate === snap;
                          return (
                            <motion.button
                              key={snap}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                onEntryUpdate(e.entry_date, e.sort_order, {
                                  allowance_rate_override: snap === 0 ? null : snap,
                                });
                                setExpandedRate(null);
                              }}
                              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                                isActive
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border/60 bg-muted/60 text-foreground hover:bg-muted'
                              }`}
                            >
                              {snap > 0 ? `+${snap}%` : `${snap}%`}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
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
          allowances={allowances.map(a =>
            a.allowance_key === 'gui_xe' && a.is_enabled
              ? { ...a, amount: guiXeSummary.amount }
              : a
          )}
          onToggle={onAllowanceToggle}
          onUpdate={onAllowanceUpdate}
          onAddAllowance={onAddAllowance}
          isAdmin={mode === 'admin'}
        />
      )}

      {/* Total */}
      <TotalSalaryDisplay
        total={breakdown?.total ?? totalFromEntries}
        deposit={deposit}
        onTap={() => setShowBreakdown(true)}
        onDepositChange={onDepositChange}
        isAdmin={mode === 'admin'}
      />

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
