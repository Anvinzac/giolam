import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Edit3 } from 'lucide-react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { roundToThousand, calcDailyBase, getRateForDate, formatVND, formatDateViet, VIET_DAYS } from '@/lib/salaryCalculations';
import { getMoonEmoji } from '@/lib/lunarUtils';
import OffPercentSnapper from './OffPercentSnapper';
import EmployeeAllowanceEditor from './EmployeeAllowanceEditor';
import TotalSalaryDisplay from './TotalSalaryDisplay';
import SalaryBreakdownPopup from './SalaryBreakdownPopup';

interface SalaryTableTypeAProps {
  entries: SalaryEntry[];
  rates: SpecialDayRate[];
  allowances: EmployeeAllowance[];
  baseSalary: number;
  onEntryUpdate: (entryDate: string, sortOrder: number, updates: Partial<SalaryEntry>) => void;
  onAllowanceToggle: (key: AllowanceKey) => void;
  onAllowanceUpdate: (key: AllowanceKey, updates: { label?: string; amount?: number }) => void;
  breakdown: SalaryBreakdown | null;
  isPreview?: boolean;
}

export default function SalaryTableTypeA({
  entries, rates, allowances, baseSalary,
  onEntryUpdate, onAllowanceToggle, onAllowanceUpdate, breakdown, isPreview = false,
}: SalaryTableTypeAProps) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editRate, setEditRate] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [expandedOff, setExpandedOff] = useState<string | null>(null);

  const dailyBase = useMemo(() => calcDailyBase(baseSalary), [baseSalary]);

  // Filter to only show special days + off days
  const visibleEntries = useMemo(() => {
    const specialDates = new Set(rates.map(r => r.special_date));
    return entries.filter(e =>
      specialDates.has(e.entry_date) ||
      e.is_day_off ||
      e.allowance_rate_override !== null
    ).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  }, [entries, rates]);

  const computeRow = (e: SalaryEntry) => {
    const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
    const allowance = roundToThousand(dailyBase * rate / 100);
    const deduction = e.is_day_off ? roundToThousand(dailyBase * e.off_percent / 100) : 0;
    const total = e.is_day_off ? -(deduction) : dailyBase + allowance;
    return { rate, allowance, deduction, total };
  };

  const totalFromEntries = useMemo(() => {
    return visibleEntries.reduce((sum, e) => {
      const { total } = computeRow(e);
      return sum + total;
    }, 0);
  }, [visibleEntries, dailyBase, rates]);

  const startEditRow = (e: SalaryEntry) => {
    setEditingRow(e.entry_date);
    setEditNote(e.note || '');
    setEditRate(e.allowance_rate_override?.toString() || '');
  };

  const saveEditRow = (entryDate: string) => {
    const updates: Partial<SalaryEntry> = { note: editNote || null };
    if (editRate !== '') {
      updates.allowance_rate_override = parseFloat(editRate);
    }
    onEntryUpdate(entryDate, 0, updates);
    setEditingRow(null);
  };

  const getMoon = (dateStr: string) => getMoonEmoji(new Date(dateStr + 'T00:00:00'));

  const getDayColor = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    if (day === 6) return 'text-[hsl(175,70%,45%)]';
    if (day === 0) return 'text-[hsl(280,60%,55%)]';
    return '';
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="glass-card p-3">
        <h3 className="font-display font-semibold text-[15px] text-foreground">Bảng lương - Loại A</h3>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto w-full">
          <div className="min-w-[500px]">
            {/* Column headers */}
            <div className="grid grid-cols-[90px_1fr_60px_90px_100px] gap-x-1 gap-y-0 px-3 py-4 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Ngày</span>
              <span>Ghi chú</span>
              <span className="text-right">Tỷ lệ</span>
              <span className="text-right">Phụ cấp</span>
              <span className="text-right">Tổng ngày</span>
            </div>

        <div className="divide-y divide-border/30">
          {visibleEntries.map((e, idx) => {
            const { rate, allowance, deduction, total } = computeRow(e);
            const isEditing = editingRow === e.entry_date && !isPreview;
            const isOff = e.is_day_off;
            const rateDesc = rates.find(r => r.special_date === e.entry_date)?.description_vi;

            return (
              <div key={`${e.entry_date}-${e.sort_order}`}>
                <div
                  className={`grid grid-cols-[90px_1fr_60px_90px_100px] gap-x-1 gap-y-0 px-3 py-4 items-center text-base ${
                    isOff ? 'bg-muted/15 opacity-75' : ''
                  } ${isEditing ? 'ring-1 ring-primary/30 bg-primary/8' : ''} ${idx % 2 !== 0 ? 'bg-muted/30' : ''}`}
                >
                  {/* Date */}
                  <span className={`font-semibold text-sm ${getDayColor(e.entry_date)}`}>
                    {formatDateViet(e.entry_date)}
                  </span>

                  {/* Note */}
                  {isEditing ? (
                    <input
                      value={editNote}
                      onChange={ev => setEditNote(ev.target.value)}
                      className="px-2 py-1 rounded bg-background border border-border text-sm min-w-0"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => !isPreview && startEditRow(e)}
                      className={`text-left text-sm text-muted-foreground truncate transition-colors ${!isPreview ? 'hover:text-foreground' : 'cursor-default'}`}
                    >
                      {e.note || rateDesc || (isOff ? 'Nghỉ' : '—')}
                    </button>
                  )}

                  {/* Rate */}
                  {isEditing ? (
                    <div className="flex items-center justify-end">
                      <input
                        value={editRate}
                        onChange={ev => setEditRate(ev.target.value)}
                        placeholder={rate.toString()}
                        className="w-14 px-2 py-1.5 rounded bg-background border border-border text-sm text-right"
                        inputMode="decimal"
                      />
                    </div>
                  ) : (
                    <span className={`text-right text-sm font-medium ${
                      e.allowance_rate_override !== null ? 'text-accent' : 'text-foreground'
                    }`}>
                      {rate > 0 ? `${rate}%` : '—'}
                      {e.allowance_rate_override !== null && <Edit3 className="inline w-3 h-3 ml-1" />}
                    </span>
                  )}

                  {/* Allowance */}
                  <span className={`text-right text-sm font-semibold ${
                    isOff ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {isOff ? `-${formatVND(deduction)}` : (allowance > 0 ? formatVND(allowance) : '—')}
                  </span>

                  {/* Total */}
                  <span className={`text-right text-base font-bold ${
                    total < 0 ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {formatVND(total)}
                  </span>
                </div>

                {/* Edit save bar */}
                {isEditing && (
                  <div className="flex gap-2 px-3 pb-3 pt-1">
                    <button onClick={() => {
                      onEntryUpdate(e.entry_date, 0, {
                        is_day_off: !e.is_day_off,
                        off_percent: e.is_day_off ? 0 : 100,
                      });
                    }} className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      isOff ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isOff ? 'Đang nghỉ' : 'Đánh nghỉ'}
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => saveEditRow(e.entry_date)} className="text-[11px] px-4 py-1.5 rounded-lg gradient-gold text-primary-foreground font-semibold">
                      Lưu
                    </button>
                    <button onClick={() => setEditingRow(null)} className="text-[11px] px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">
                      Hủy
                    </button>
                  </div>
                )}

                {/* Off percent snapper */}
                {isOff && expandedOff === e.entry_date && !isPreview && (
                  <div className="px-3 pb-3 pt-1">
                    <OffPercentSnapper
                      value={e.off_percent}
                      onChange={(v) => onEntryUpdate(e.entry_date, 0, { off_percent: v })}
                    />
                  </div>
                )}
                {isOff && !isEditing && !isPreview && (
                  <button
                    onClick={() => setExpandedOff(expandedOff === e.entry_date ? null : e.entry_date)}
                    className="w-full text-[10px] text-center text-muted-foreground py-1 hover:text-foreground transition-colors"
                  >
                    {expandedOff === e.entry_date ? 'Ẩn' : `Nghỉ ${e.off_percent}% · Nhấn để chỉnh`}
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
        </div>
      </div>

      {/* Allowances */}
      <EmployeeAllowanceEditor
        allowances={allowances}
        onToggle={onAllowanceToggle}
        onUpdate={onAllowanceUpdate}
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
