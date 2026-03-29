import { useState } from 'react';
import { motion } from 'framer-motion';
import { EmployeeAllowance, AllowanceKey } from '@/types/salary';
import { formatVND } from './TotalSalaryDisplay';

interface EmployeeAllowanceEditorProps {
  allowances: EmployeeAllowance[];
  onToggle: (key: AllowanceKey) => void;
  onUpdate: (key: AllowanceKey, updates: { label?: string; amount?: number }) => void;
  isAdmin?: boolean;
}

export default function EmployeeAllowanceEditor({
  allowances,
  onToggle,
  onUpdate,
  isAdmin = true,
}: EmployeeAllowanceEditorProps) {
  const [editingKey, setEditingKey] = useState<AllowanceKey | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const visible = isAdmin ? allowances : allowances.filter(a => a.is_enabled);

  const startEdit = (a: EmployeeAllowance) => {
    setEditingKey(a.allowance_key);
    setEditLabel(a.label);
    setEditAmount(a.amount.toString());
  };

  const saveEdit = (key: AllowanceKey) => {
    onUpdate(key, {
      label: editLabel,
      amount: parseInt(editAmount) || 0,
    });
    setEditingKey(null);
  };

  if (visible.length === 0) return null;

  return (
    <div className="glass-card p-3 space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Phụ cấp thêm
      </h4>
      {visible.map(a => (
        <motion.div
          key={a.allowance_key}
          layout
          className={`flex items-center gap-2 p-2 rounded-xl transition-colors ${
            a.is_enabled ? 'bg-muted/50' : 'bg-muted/20 opacity-50'
          }`}
        >
          {/* Toggle */}
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

          {editingKey === a.allowance_key ? (
            <div className="flex-1 flex items-center gap-1.5">
              <input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-background border border-border text-xs text-foreground"
              />
              <input
                value={editAmount}
                onChange={e => setEditAmount(e.target.value.replace(/\D/g, ''))}
                className="w-24 px-2 py-1 rounded-lg bg-background border border-border text-xs text-foreground text-right"
                inputMode="numeric"
              />
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
