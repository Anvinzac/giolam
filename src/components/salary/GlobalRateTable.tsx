import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { SpecialDayRate, DayType, DAY_TYPE_LABELS, DEFAULT_RATES } from '@/types/salary';
import { getVietnameseDescription, formatDateViet } from '@/lib/salaryCalculations';
import { toast } from 'sonner';

interface GlobalRateTableProps {
  rates: SpecialDayRate[];
  onUpdate: (id: string, updates: Partial<SpecialDayRate>) => void;
  onAdd: (rate: Omit<SpecialDayRate, 'id'>) => void;
  onRemove: (id: string) => void;
  periodId: string;
}

const DAY_TYPES: DayType[] = ['saturday', 'sunday', 'day_before_new_moon', 'day_before_full_moon', 'new_moon', 'full_moon', 'public_holiday', 'custom'];

export default function GlobalRateTable({ rates, onUpdate, onAdd, onRemove, periodId }: GlobalRateTableProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editRate, setEditRate] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [addType, setAddType] = useState<DayType>('public_holiday');
  const [addDesc, setAddDesc] = useState('');
  const [addRate, setAddRate] = useState('0');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const startEdit = (r: SpecialDayRate) => {
    setEditId(r.id!);
    setEditDesc(r.description_vi);
    setEditRate(r.rate_percent.toString());
  };

  const saveEdit = (id: string) => {
    onUpdate(id, {
      description_vi: editDesc,
      rate_percent: parseFloat(editRate) || 0,
    });
    setEditId(null);
    toast.success('Đã cập nhật');
  };

  const handleAdd = () => {
    if (!addDate) { toast.error('Chọn ngày'); return; }
    onAdd({
      period_id: periodId,
      special_date: addDate,
      day_type: addType,
      description_vi: addDesc || getVietnameseDescription(addType, parseFloat(addRate) || 0),
      rate_percent: parseFloat(addRate) || 0,
      sort_order: rates.length,
    });
    setShowAdd(false);
    setAddDate('');
    setAddDesc('');
    setAddRate('0');
    toast.success('Đã thêm');
  };

  const handleDelete = (id: string) => {
    onRemove(id);
    setDeleteConfirm(null);
    toast.success('Đã xóa');
  };

  const getDayTypeColor = (dt: DayType) => {
    switch (dt) {
      case 'saturday': return 'text-[hsl(175,70%,45%)]';
      case 'sunday': return 'text-[hsl(280,60%,55%)]';
      case 'full_moon': case 'new_moon': return 'text-amber-400';
      case 'day_before_full_moon': case 'day_before_new_moon': return 'text-amber-400/60';
      case 'public_holiday': return 'text-destructive';
      default: return 'text-foreground';
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-3 border-b border-border">
        <h3 className="font-display font-semibold text-sm text-foreground">Bảng phụ cấp đặc biệt</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">Áp dụng cho tất cả nhân viên</p>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[90px_1fr_60px_36px] gap-1 px-3 py-2 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase">
        <span>Ngày</span>
        <span>Mô tả</span>
        <span className="text-right">Tỷ lệ</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/50">
        {rates.map((r, idx) => (
          <div
            key={r.id || idx}
            className={`grid grid-cols-[90px_1fr_60px_36px] gap-1 px-3 py-2 items-center text-sm ${
              editId === r.id ? 'bg-primary/5 ring-1 ring-primary/20' : idx % 2 === 0 ? '' : 'bg-muted/10'
            }`}
          >
            <span className={`text-xs font-medium ${getDayTypeColor(r.day_type)}`}>
              {formatDateViet(r.special_date)}
            </span>

            {editId === r.id ? (
              <>
                <input
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="px-1.5 py-0.5 rounded bg-background border border-border text-xs text-foreground min-w-0"
                />
                <div className="flex items-center justify-end gap-0.5">
                  <input
                    value={editRate}
                    onChange={e => setEditRate(e.target.value)}
                    className="w-12 px-1 py-0.5 rounded bg-background border border-border text-xs text-right"
                    inputMode="decimal"
                  />
                  <span className="text-[10px] text-muted-foreground">%</span>
                </div>
                <div className="flex gap-0.5">
                  <button onClick={() => saveEdit(r.id!)} className="p-0.5 text-emerald-400"><Check size={12} /></button>
                  <button onClick={() => setEditId(null)} className="p-0.5 text-muted-foreground"><X size={12} /></button>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => startEdit(r)} className="text-left text-xs text-foreground truncate hover:text-primary transition-colors">
                  {r.description_vi}
                </button>
                <span className="text-xs text-right text-foreground">{r.rate_percent}%</span>
                <div>
                  {deleteConfirm === r.id ? (
                    <div className="flex gap-0.5">
                      <button onClick={() => handleDelete(r.id!)} className="p-0.5 text-destructive"><Check size={12} /></button>
                      <button onClick={() => setDeleteConfirm(null)} className="p-0.5 text-muted-foreground"><X size={12} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(r.id!)}
                      className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {rates.length === 0 && (
        <div className="p-6 text-center text-muted-foreground text-sm">
          Chưa có phụ cấp nào. Nhấn nút bên dưới để thêm.
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-3 space-y-2 bg-muted/20">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Ngày</label>
                  <input
                    type="date"
                    value={addDate}
                    onChange={e => setAddDate(e.target.value)}
                    className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Loại</label>
                  <select
                    value={addType}
                    onChange={e => {
                      const t = e.target.value as DayType;
                      setAddType(t);
                      setAddRate(DEFAULT_RATES[t].toString());
                      setAddDesc(getVietnameseDescription(t, DEFAULT_RATES[t]));
                    }}
                    className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-xs"
                  >
                    {DAY_TYPES.map(dt => (
                      <option key={dt} value={dt}>{DAY_TYPE_LABELS[dt]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Mô tả</label>
                  <input
                    value={addDesc}
                    onChange={e => setAddDesc(e.target.value)}
                    placeholder="Tự động tạo"
                    className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Tỷ lệ (%)</label>
                  <input
                    value={addRate}
                    onChange={e => setAddRate(e.target.value)}
                    inputMode="decimal"
                    className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-xs text-right"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAdd}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl gradient-gold text-primary-foreground font-semibold text-xs"
                >
                  <Plus size={14} /> Thêm
                </motion.button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-xs"
                >
                  Hủy
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showAdd && (
        <div className="p-3 border-t border-border">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAdd(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
          >
            <Plus size={14} /> Thêm hàng
          </motion.button>
        </div>
      )}
    </div>
  );
}
