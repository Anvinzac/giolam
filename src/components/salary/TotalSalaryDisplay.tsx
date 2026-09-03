import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DEFAULT_DEPOSIT_LABEL,
  newDepositItem,
  sumDeposits,
  type SalaryDepositItem,
} from '@/lib/salaryDeposits';

export function formatVND(amount: number): string {
  if (amount === 0) return '0 đ';
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNeg ? '-' : ''}${formatted} đ`;
}

interface TotalSalaryDisplayProps {
  total: number;
  deposits?: SalaryDepositItem[];
  onDepositsChange?: (items: SalaryDepositItem[]) => void;
  /** @deprecated Prefer `deposits` / `onDepositsChange`. */
  deposit?: number;
  /** @deprecated Prefer `deposits` / `onDepositsChange`. */
  depositLabel?: string;
  /** @deprecated Prefer `onDepositsChange`. */
  onDepositLabelChange?: (label: string) => void;
  onTap: () => void;
  /** @deprecated Prefer `onDepositsChange`. */
  onDepositChange?: (amount: number) => void;
  isAdmin?: boolean;
}

export default function TotalSalaryDisplay({
  total,
  deposits: depositsProp,
  onDepositsChange,
  deposit = 0,
  depositLabel = DEFAULT_DEPOSIT_LABEL,
  onDepositLabelChange,
  onTap,
  onDepositChange,
  isAdmin = false,
}: TotalSalaryDisplayProps) {
  // Bridge legacy single-deposit props when the parent hasn't switched yet.
  const deposits: SalaryDepositItem[] = depositsProp
    ?? (deposit > 0 ? [{ id: 'legacy', label: depositLabel, amount: deposit }] : []);

  const canEdit = isAdmin && !!onDepositsChange;
  const depositTotal = sumDeposits(deposits);
  const hasDeposit = depositTotal > 0;
  const transferAmount = total - depositTotal;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  useEffect(() => {
    if (editingLabelId && labelInputRef.current) labelInputRef.current.focus();
  }, [editingLabelId]);

  const toShort = (v: number) => (v <= 0 ? '' : Math.round(v / 1000).toString());
  const fmtDot = (n: number) => n.toLocaleString('vi-VN');
  const num = inputVal ? parseInt(inputVal, 10) : 0;
  const typedFormatted = num > 0 ? fmtDot(num) : '';
  const ghostFormatted = num > 0 ? '.000' : '000';

  const commitDeposits = (next: SalaryDepositItem[]) => {
    const cleaned = next
      .map(d => ({
        ...d,
        label: d.label.trim() || DEFAULT_DEPOSIT_LABEL,
        amount: Math.max(0, d.amount || 0),
      }))
      .filter(d => d.amount > 0);
    onDepositsChange?.(cleaned);
    // Keep legacy single-deposit callbacks in sync for older parents.
    const sum = sumDeposits(cleaned);
    onDepositChange?.(sum);
    onDepositLabelChange?.(cleaned[0]?.label || DEFAULT_DEPOSIT_LABEL);
  };

  const startEditAmount = (item: SalaryDepositItem) => {
    if (!canEdit) return;
    setEditingLabelId(null);
    setInputVal(toShort(item.amount));
    setEditingId(item.id);
  };

  const startEditLabel = (item: SalaryDepositItem) => {
    if (!canEdit) return;
    setEditingId(null);
    setLabelInput(item.label);
    setEditingLabelId(item.id);
  };

  const saveAmount = (id: string) => {
    const cleaned = inputVal.replace(/\D/g, '');
    const parsedShort = cleaned === '' ? 0 : parseInt(cleaned, 10);
    const val = parsedShort > 0 ? parsedShort * 1000 : 0;
    setEditingId(null);
    if (val <= 0) {
      commitDeposits(deposits.filter(d => d.id !== id));
      return;
    }
    commitDeposits(deposits.map(d => (d.id === id ? { ...d, amount: val } : d)));
  };

  const saveLabel = (id: string) => {
    const trimmed = labelInput.trim() || DEFAULT_DEPOSIT_LABEL;
    setEditingLabelId(null);
    const next = deposits.map(d => (d.id === id ? { ...d, label: trimmed } : d));
    // Keep zero-amount drafts while renaming (commitDeposits would strip them).
    if (next.some(d => d.amount <= 0)) {
      onDepositsChange?.(next);
      return;
    }
    commitDeposits(next);
  };

  const removeDeposit = (id: string) => {
    setEditingId(null);
    setEditingLabelId(null);
    commitDeposits(deposits.filter(d => d.id !== id));
  };

  const addDeposit = () => {
    if (!canEdit) return;
    const item = newDepositItem(DEFAULT_DEPOSIT_LABEL, 0);
    // Keep a draft row visible even at amount 0 while the admin types.
    onDepositsChange?.([...deposits, item]);
    setEditingLabelId(null);
    setInputVal('');
    setEditingId(item.id);
  };

  const isBusy = editingId !== null || editingLabelId !== null;

  return (
    <motion.div
      whileTap={!isBusy ? { scale: 0.98 } : undefined}
      onClick={!isBusy ? onTap : undefined}
      className="w-full glass-card p-5 text-center cursor-pointer space-y-2"
    >
      <div>
        <p className="text-xs text-muted-foreground mb-1">Tổng lương</p>
        <p
          key={total}
          className={`font-display font-bold text-2xl ${hasDeposit ? 'text-foreground' : 'text-gradient-gold'}`}
        >
          {formatVND(total)}
        </p>
      </div>

      <AnimatePresence initial={false}>
        {deposits.map(item => {
          const isEditingAmt = editingId === item.id;
          const isEditingLbl = editingLabelId === item.id;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-destructive/8 border border-destructive/15">
                {isEditingLbl ? (
                  <input
                    ref={labelInputRef}
                    value={labelInput}
                    onChange={e => setLabelInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveLabel(item.id);
                      if (e.key === 'Escape') setEditingLabelId(null);
                    }}
                    onBlur={() => saveLabel(item.id)}
                    className="min-w-0 flex-1 px-1.5 py-0.5 rounded bg-background border border-destructive/30 text-xs text-destructive font-medium outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    className={`min-w-0 flex-1 text-left text-xs text-destructive/80 font-medium truncate ${
                      canEdit ? 'hover:underline cursor-pointer' : 'cursor-default'
                    }`}
                    onClick={e => {
                      e.stopPropagation();
                      startEditLabel(item);
                    }}
                    title="Nhấn để đổi tên khoản trừ"
                  >
                    {item.label}
                  </button>
                )}

                {isEditingAmt ? (
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center rounded border border-destructive/30 bg-background relative overflow-hidden min-w-[100px]">
                      <input
                        ref={inputRef}
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={e => { if (e.key === 'Enter') saveAmount(item.id); }}
                        onBlur={() => saveAmount(item.id)}
                        className="absolute inset-0 opacity-0 text-[16px] w-full cursor-text"
                        inputMode="numeric"
                        autoFocus
                      />
                      <span className="text-sm font-bold text-destructive pointer-events-none px-2 py-0.5">
                        {typedFormatted}
                      </span>
                      <span className="text-sm font-bold text-muted-foreground/40 pointer-events-none pr-2">
                        {ghostFormatted}
                      </span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); removeDeposit(item.id); }}
                      className="text-[10px] text-muted-foreground hover:text-destructive px-1"
                    >
                      Xóa
                    </button>
                  </div>
                ) : (
                  <span
                    className={`text-sm font-bold text-destructive shrink-0 ${canEdit ? 'hover:underline' : ''}`}
                    onClick={e => { e.stopPropagation(); startEditAmount(item); }}
                  >
                    −{formatVND(item.amount)}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <AnimatePresence>
        {hasDeposit && !isBusy && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="text-[10px] text-muted-foreground mb-0.5">
              {isAdmin ? 'Sẽ chuyển khoản' : 'Sẽ nhận'}
            </p>
            <p key={transferAmount} className="font-display font-extrabold text-2xl text-gradient-gold">
              {formatVND(transferAmount)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {canEdit && editingId === null && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); addDeposit(); }}
          className="w-full mt-1 py-1.5 rounded-lg border border-dashed border-destructive/30 text-[12px] text-destructive/70 hover:bg-destructive/8 hover:border-destructive/50 transition-colors"
        >
          + Thêm khoản trừ
        </button>
      )}
    </motion.div>
  );
}
