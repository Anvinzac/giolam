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
  // `inputVal` holds the SHORT form the admin typed (e.g. "50" = 50k
  // = 50,000 VND). The visible field always renders typed digits plus
  // a ghost ".000" hint so the multiplier convention is obvious
  // without the admin having to read it in a tooltip. Matches the
  // pattern used in SalaryAdmin's thousand-input editors.
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hasDeposit = deposit > 0;
  const transferAmount = total - deposit;

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  // Convert a stored VND amount (e.g. 50000) back to short form
  // (e.g. "50") so the editor can pre-fill with the same scale the
  // admin originally typed. Rounded so a stored 49,500 displays as
  // "50" — the editor is always in thousand-units, not raw VND.
  const toShort = (v: number) => v <= 0 ? '' : Math.round(v / 1000).toString();
  const fmtDot = (n: number) => n.toLocaleString('vi-VN');
  const num = inputVal ? parseInt(inputVal, 10) : 0;
  const typedFormatted = num > 0 ? fmtDot(num) : '';
  const ghostFormatted = num > 0 ? '.000' : '000';

  const startEdit = () => {
    if (!isAdmin || !onDepositChange) return;
    setInputVal(toShort(deposit));
    setEditing(true);
  };

  const saveDeposit = () => {
    const cleaned = inputVal.replace(/\D/g, '');
    const parsedShort = cleaned === '' ? 0 : parseInt(cleaned, 10);
    // ×1000 convention: typed "50" means 50,000 VND.
    const val = parsedShort > 0 ? parsedShort * 1000 : 0;
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
                  <div className="flex items-center rounded border border-destructive/30 bg-background relative overflow-hidden min-w-[100px]">
                    <input
                      ref={inputRef}
                      value={inputVal}
                      onChange={e => setInputVal(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={e => { if (e.key === 'Enter') saveDeposit(); }}
                      onBlur={saveDeposit}
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
