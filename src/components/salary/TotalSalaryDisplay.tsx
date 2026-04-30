import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function formatVND(amount: number): string {
  if (amount === 0) return '0 đ';
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNeg ? '-' : ''}${formatted} đ`;
}

interface TotalSalaryDisplayProps {
  total: number;
  deposit?: number;
  onTap: () => void;
  onDepositChange?: (amount: number) => void;
  isAdmin?: boolean;
}

export default function TotalSalaryDisplay({
  total,
  deposit = 0,
  onTap,
  onDepositChange,
  isAdmin = false,
}: TotalSalaryDisplayProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hasDeposit = deposit > 0;
  const transferAmount = total - deposit;

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const startEdit = () => {
    if (!isAdmin || !onDepositChange) return;
    setInputVal(deposit > 0 ? deposit.toString() : '');
    setEditing(true);
  };

  const saveDeposit = () => {
    const val = parseInt(inputVal.replace(/\D/g, '')) || 0;
    onDepositChange?.(val);
    setEditing(false);
  };

  const clearDeposit = () => {
    onDepositChange?.(0);
    setEditing(false);
  };

  return (
    <motion.div
      whileTap={!editing ? { scale: 0.98 } : undefined}
      onClick={!editing ? onTap : undefined}
      className="w-full glass-card p-5 text-center cursor-pointer space-y-2"
    >
      {/* Total salary
       *
       * `key={total}` forces React to remount the <p> when the amount
       * changes. WebKit/Blink leaves ghost strokes from the previous
       * glyphs when `background-clip: text` + `-webkit-text-fill-color:
       * transparent` text is updated in place — the gradient repaints
       * but the underlying glyph mask doesn't clear cleanly, producing
       * the broken-digit artifacts seen on Tổng lương after a recompute.
       * A fresh mount sidesteps the buggy in-place repaint path. */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Tổng lương</p>
        <p
          key={total}
          className={`font-display font-bold text-2xl ${hasDeposit ? 'text-foreground' : 'text-gradient-gold'}`}
        >
          {formatVND(total)}
        </p>
      </div>

      {/* Deposit row */}
      <AnimatePresence>
        {(hasDeposit || editing) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-destructive/8 border border-destructive/15">
              <span className="text-xs text-destructive/80 font-medium">Tạm ứng</span>
              {editing ? (
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="numeric"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveDeposit(); }}
                    onBlur={saveDeposit}
                    className="w-[100px] px-2 py-0.5 rounded bg-background border border-destructive/30 text-right text-sm font-bold text-destructive outline-none"
                    placeholder="0"
                  />
                  {deposit > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); clearDeposit(); }}
                      className="text-[10px] text-muted-foreground hover:text-destructive px-1"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              ) : (
                <span
                  className={`text-sm font-bold text-destructive ${isAdmin ? 'hover:underline' : ''}`}
                  onClick={e => { e.stopPropagation(); startEdit(); }}
                >
                  −{formatVND(deposit)}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer amount — only when deposit exists */}
      <AnimatePresence>
        {hasDeposit && !editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="text-[10px] text-muted-foreground mb-0.5">Sẽ chuyển khoản</p>
            <p key={transferAmount} className="font-display font-extrabold text-2xl text-gradient-gold">
              {formatVND(transferAmount)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin: add deposit button when none exists */}
      {isAdmin && !hasDeposit && !editing && onDepositChange && (
        <button
          onClick={e => { e.stopPropagation(); startEdit(); }}
          className="text-[10px] text-muted-foreground hover:text-destructive/70 transition-colors"
        >
          + Tạm ứng
        </button>
      )}

      <p className="text-[10px] text-muted-foreground">Nhấn để xem chi tiết</p>
    </motion.div>
  );
}
