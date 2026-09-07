import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, X as XIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  generateDefaultSpecialDays,
  getVietnameseDescription,
  formatDateViet,
} from '@/lib/salaryCalculations';
import {
  DayType,
  DAY_TYPE_LABELS,
  DEFAULT_RATES,
  SpecialDayRate,
} from '@/types/salary';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayAfter(iso: string): string {
  return addDays(iso, 1);
}

export function suggestNewPeriodRange(existing: { end_date: string }[]): { start: string; end: string } {
  if (existing.length > 0) {
    const latestEnd = [...existing].sort((a, b) => b.end_date.localeCompare(a.end_date))[0].end_date;
    const start = dayAfter(latestEnd);
    return { start, end: addDays(start, 29) };
  }
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const start = `${lastMonth.getFullYear()}-${pad(lastMonth.getMonth() + 1)}-01`;
  return { start, end: addDays(start, 29) };
}

interface Props {
  open: boolean;
  onClose: () => void;
  existingPeriods: { end_date: string }[];
  onCreated: (periodId: string) => void;
}

export default function CreateWorkingPeriodDialog({
  open,
  onClose,
  existingPeriods,
  onCreated,
}: Props) {
  const suggested = useMemo(() => suggestNewPeriodRange(existingPeriods), [existingPeriods]);
  const [startDate, setStartDate] = useState(suggested.start);
  const [endDate, setEndDate] = useState(suggested.end);
  const [offDaysSet, setOffDaysSet] = useState<Set<string>>(new Set());
  const [rates, setRates] = useState<SpecialDayRate[]>([]);
  const [rateEditId, setRateEditId] = useState<string | null>(null);
  const [rateEditDesc, setRateEditDesc] = useState('');
  const [rateEditPercent, setRateEditPercent] = useState('');
  const [showAddRate, setShowAddRate] = useState(false);
  const [addRateDate, setAddRateDate] = useState('');
  const [addRateType, setAddRateType] = useState<DayType>('custom');
  const [addRateDesc, setAddRateDesc] = useState('');
  const [addRatePercent, setAddRatePercent] = useState('0');
  const [rateDeleteConfirm, setRateDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = suggestNewPeriodRange(existingPeriods);
    setStartDate(next.start);
    setEndDate(next.end);
    setOffDaysSet(new Set());
    setShowAddRate(false);
    setRateEditId(null);
    setRateDeleteConfirm(null);
  }, [open, existingPeriods]);

  useEffect(() => {
    if (!startDate || !endDate || endDate < startDate) {
      setRates([]);
      return;
    }
    setRates(generateDefaultSpecialDays(startDate, endDate, '__preview__', Array.from(offDaysSet)));
  }, [startDate, endDate, offDaysSet]);

  const dateRange = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return [] as string[];
    const out: string[] = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (cur <= end) {
      out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [startDate, endDate]);

  const toggleOffDay = (date: string) => {
    setOffDaysSet(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const createPeriod = async () => {
    if (!startDate || !endDate) {
      toast.error('Cần chọn ngày bắt đầu và kết thúc');
      return;
    }
    if (endDate < startDate) {
      toast.error('Ngày kết thúc phải sau ngày bắt đầu');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: period, error } = await supabase
        .from('working_periods')
        .insert({
          start_date: startDate,
          end_date: endDate,
          off_days: Array.from(offDaysSet),
          created_by: user?.id,
        })
        .select()
        .single();

      if (error || !period) {
        toast.error(error?.message || 'Không tạo được kỳ');
        return;
      }

      if (rates.length > 0) {
        const periodRates = rates.map(({ id: _id, ...r }) => ({
          ...r,
          period_id: period.id,
        }));
        const { error: ratesErr } = await supabase.from('special_day_rates').insert(periodRates);
        if (ratesErr) {
          toast.error(`Kỳ đã tạo nhưng lỗi phụ cấp: ${ratesErr.message}`);
        }
      }

      toast.success('Đã tạo kỳ làm việc mới');
      onCreated(period.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-5 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <Plus size={20} />
          Tạo kỳ làm việc mới
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Ngày bắt đầu</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ngày kết thúc</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {dateRange.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground">
                Ngày quán nghỉ — chạm để chọn ({offDaysSet.size})
              </label>
              <div className="mt-1 p-2 rounded-xl bg-muted border border-border max-h-[160px] overflow-y-auto">
                <div className="grid grid-cols-7 gap-0.5">
                  {dateRange.map(date => {
                    const d = new Date(date + 'T00:00:00');
                    const isOff = offDaysSet.has(date);
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => toggleOffDay(date)}
                        className={`py-1.5 rounded-md text-[11px] font-medium transition-all ${
                          isOff
                            ? 'bg-destructive/20 text-destructive ring-1 ring-destructive/40'
                            : 'bg-background/50 text-foreground hover:bg-background'
                        }`}
                        title={date}
                      >
                        {d.getDate()}/{d.getMonth() + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {rates.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground">
                  Phụ cấp đặc biệt ({rates.length}) — gồm Mùng 1 / Rằm
                </label>
                <button
                  type="button"
                  onClick={() => { setShowAddRate(!showAddRate); setRateDeleteConfirm(null); }}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20"
                >
                  + Thêm
                </button>
              </div>
              <div className="rounded-xl bg-muted border border-border max-h-[180px] overflow-y-auto divide-y divide-border/30">
                {rates.map(r => {
                  const key = r.id || r.special_date + r.day_type;
                  return (
                    <div key={key} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                      <span className="w-[60px] font-medium text-muted-foreground shrink-0">
                        {formatDateViet(r.special_date)}
                      </span>
                      {rateEditId === key ? (
                        <>
                          <input
                            value={rateEditDesc}
                            onChange={e => setRateEditDesc(e.target.value)}
                            className="flex-1 px-1.5 py-0.5 rounded bg-background border border-border text-xs min-w-0"
                          />
                          <input
                            value={rateEditPercent}
                            onChange={e => setRateEditPercent(e.target.value)}
                            className="w-12 px-1 py-0.5 rounded bg-background border border-border text-xs text-right"
                            inputMode="decimal"
                          />
                          <span className="text-[10px] text-muted-foreground">%</span>
                          <button
                            type="button"
                            onClick={() => {
                              setRates(prev => prev.map(rr =>
                                (rr.id || rr.special_date + rr.day_type) === rateEditId
                                  ? { ...rr, description_vi: rateEditDesc, rate_percent: parseFloat(rateEditPercent) || 0 }
                                  : rr,
                              ));
                              setRateEditId(null);
                            }}
                            className="p-0.5 text-emerald-400"
                          >
                            <Check size={12} />
                          </button>
                          <button type="button" onClick={() => setRateEditId(null)} className="p-0.5 text-muted-foreground">
                            <XIcon size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setRateEditId(key);
                              setRateEditDesc(r.description_vi);
                              setRateEditPercent(String(r.rate_percent));
                              setRateDeleteConfirm(null);
                            }}
                            className="flex-1 text-left truncate hover:text-primary"
                          >
                            {r.description_vi}
                          </button>
                          <span className="text-foreground">{r.rate_percent}%</span>
                          {rateDeleteConfirm === key ? (
                            <div className="flex gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setRates(prev => prev.filter(rr => (rr.id || rr.special_date + rr.day_type) !== key));
                                  setRateDeleteConfirm(null);
                                }}
                                className="p-0.5 text-destructive"
                              >
                                <Check size={12} />
                              </button>
                              <button type="button" onClick={() => setRateDeleteConfirm(null)} className="p-0.5 text-muted-foreground">
                                <XIcon size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setRateDeleteConfirm(key); setRateEditId(null); }}
                              className="p-0.5 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {showAddRate && (
                <div className="mt-2 p-3 rounded-xl bg-muted/50 border border-border space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Ngày</label>
                      <input
                        type="date"
                        value={addRateDate}
                        onChange={e => setAddRateDate(e.target.value)}
                        className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Loại</label>
                      <select
                        value={addRateType}
                        onChange={e => {
                          const t = e.target.value as DayType;
                          setAddRateType(t);
                          setAddRatePercent(String(DEFAULT_RATES[t]));
                          setAddRateDesc(getVietnameseDescription(t, DEFAULT_RATES[t]));
                        }}
                        className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-xs"
                      >
                        {([
                          'saturday', 'sunday',
                          'day_before_new_moon', 'day_before_full_moon',
                          'new_moon', 'full_moon',
                          'public_holiday', 'custom',
                        ] as DayType[]).map(dt => (
                          <option key={dt} value={dt}>{DAY_TYPE_LABELS[dt]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_80px] gap-2">
                    <input
                      value={addRateDesc}
                      onChange={e => setAddRateDesc(e.target.value)}
                      placeholder="Mô tả"
                      className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs"
                    />
                    <input
                      value={addRatePercent}
                      onChange={e => setAddRatePercent(e.target.value)}
                      inputMode="decimal"
                      className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs text-right"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!addRateDate) { toast.error('Chọn ngày'); return; }
                        const newId = `${addRateDate}_${addRateType}`;
                        setRates(prev => [...prev, {
                          period_id: '__preview__',
                          special_date: addRateDate,
                          day_type: addRateType,
                          description_vi: addRateDesc || getVietnameseDescription(addRateType, parseFloat(addRatePercent) || 0),
                          rate_percent: parseFloat(addRatePercent) || 0,
                          sort_order: prev.length,
                          id: newId,
                        }].sort((a, b) => a.special_date.localeCompare(b.special_date)));
                        setShowAddRate(false);
                        setAddRateDate('');
                        setAddRateDesc('');
                        setAddRatePercent('0');
                      }}
                      className="flex-1 py-1.5 rounded-lg gradient-gold text-primary-foreground text-xs font-semibold"
                    >
                      + Thêm
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddRate(false); setAddRateDate(''); }}
                      className="px-4 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Kỳ cũ vẫn giữ nguyên — không lưu trữ / không xóa dữ liệu.
          </p>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 text-sm font-medium"
          >
            Hủy
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={createPeriod}
            disabled={saving || !startDate || !endDate}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl gradient-gold text-primary-foreground font-semibold text-sm disabled:opacity-50"
          >
            <Plus size={16} />
            {saving ? 'Đang tạo...' : 'Tạo kỳ'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
