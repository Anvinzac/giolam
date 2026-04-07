import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { EmployeeAllowance, AllowanceKey } from '@/types/salary';
import { formatVND } from './TotalSalaryDisplay';

interface EmployeeAllowanceEditorProps {
  allowances: EmployeeAllowance[];
  onToggle: (key: AllowanceKey) => void;
  onUpdate: (key: AllowanceKey, updates: { label?: string; amount?: number }) => void;
  onAddAllowance?: (label: string, amount: number) => void;
  isAdmin?: boolean;
}

export default function EmployeeAllowanceEditor({
  allowances,
  onToggle,
  onUpdate,
  onAddAllowance,
  isAdmin = true,
}: EmployeeAllowanceEditorProps) {
  const [editingKey, setEditingKey] = useState<AllowanceKey | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const fmtDot = (n: number) => n.toLocaleString('vi-VN');
  const fmtInput = (raw: string) => {
    const n = raw ? parseInt(raw, 10) : 0;
    return { typed: n > 0 ? fmtDot(n) : '', ghost: n > 0 ? '.000' : '000' };
  };

  const visible = isAdmin ? allowances : allowances.filter(a => a.is_enabled);

  const startEdit = (a: EmployeeAllowance) => {
    setEditingKey(a.allowance_key);
    setEditLabel(a.label);
    setEditAmount((a.amount / 1000).toString());
  };

  const saveEdit = (key: AllowanceKey) => {
    let amt = parseInt(editAmount) || 0;
    if (amt > 0) amt = amt * 1000;
    onUpdate(key, {
      label: editLabel,
      amount: amt,
    });
    setEditingKey(null);
  };

  const handleAddNew = () => {
    if (newLabel.trim() && onAddAllowance) {
      let amt = parseInt(newAmount) || 0;
      if (amt > 0) amt = amt * 1000;
      onAddAllowance(newLabel, amt);
      setNewLabel('');
      setNewAmount('');
      setAddingNew(false);
    }
  };

  if (visible.length === 0 && !isAdmin) return null;

  return (
    <div className="glass-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Phụ cấp thêm
        </h4>
        {isAdmin && (
          <button
            onClick={() => setAddingNew(true)}
            className="p-1 hover:bg-muted/50 rounded-lg transition-colors"
            title="Thêm phụ cấp mới"
          >
            <Plus size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {addingNew && (
        <motion.div
          layout
          className="flex items-center gap-2 p-2 rounded-xl bg-muted/50"
        >
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Tên phụ cấp"
            className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-background border border-border text-[16px] text-foreground"
            autoFocus
          />
          <div className="flex items-center px-2 py-1 rounded-lg bg-background border border-border relative">
            <input
              value={newAmount}
              onChange={e => setNewAmount(e.target.value.replace(/\D/g, ''))}
              className="absolute inset-0 opacity-0 text-[16px]"
              inputMode="numeric"
            />
            <span className="text-[16px] text-foreground pointer-events-none">{fmtInput(newAmount).typed}</span>
            <span className="text-[16px] text-muted-foreground/40 pointer-events-none">{fmtInput(newAmount).ghost}</span>
          </div>
          <button
            onClick={handleAddNew}
            className="px-2 py-1 rounded-lg gradient-gold text-primary-foreground text-xs font-semibold"
          >
            OK
          </button>
          <button
            onClick={() => {
              setAddingNew(false);
              setNewLabel('');
              setNewAmount('');
            }}
            className="px-2 py-1 rounded-lg border border-border text-xs font-semibold hover:bg-muted/50"
          >
            Hủy
          </button>
        </motion.div>
      )}

      {visible.map(a => (
        <motion.div
          key={a.allowance_key}
          layout
          className={`flex items-center gap-2 p-2 rounded-xl transition-colors ${
            a.is_enabled ? 'bg-muted/50' : 'bg-muted/20 opacity-50'
          }`}
        >
          {/* Toggle */}
          {isAdmin && (
            <button
              onClick={() => onToggle(a.allowance_key)}
              className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
                a.is_enabled ? 'bg-primary' : 'bg-border'
              }`}
            >
              <motion.div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                animate={{ left: a.is_enabled ? 18 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          )}

          {editingKey === a.allowance_key ? (
            <div className="flex-1 flex items-center gap-1.5">
              <input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-background border border-border text-[16px] text-foreground"
              />
              <div className="flex items-center px-2 py-1 rounded-lg bg-background border border-border relative">
                <input
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value.replace(/\D/g, ''))}
                  className="absolute inset-0 opacity-0 text-[16px]"
                  inputMode="numeric"
                />
                <span className="text-[16px] text-foreground pointer-events-none">{fmtInput(editAmount).typed}</span>
                <span className="text-[16px] text-muted-foreground/40 pointer-events-none">{fmtInput(editAmount).ghost}</span>
              </div>
                  <button
                onClick={() => saveEdit(a.allowance_key)}
                className="px-2 py-1 rounded-lg gradient-gold text-primary-foreground text-xs font-semibold"
              >
                OK
              </button>
            </div>
          ) : (
            <button
              onClick={() => isAdmin && startEdit(a)}
              className="flex-1 flex items-center justify-between min-w-0"
            >
              <span className="text-sm text-foreground truncate">{a.label}</span>
              <span className={`text-sm font-medium flex-shrink-0 ml-2 ${
                a.is_enabled ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {formatVND(a.amount)}
              </span>
            </button>
          )}
        </motion.div>
      ))}
    </div>
  );
}
