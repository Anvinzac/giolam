import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import { AllowanceKey, SalaryBreakdown, SalaryEntry } from '@/types/salary';
import { formatVND } from './TotalSalaryDisplay';

interface SalaryBreakdownPopupProps {
  isOpen: boolean;
  onClose: () => void;
  breakdown: SalaryBreakdown | null;
  visibleAllowanceKeys?: AllowanceKey[] | null;
  isPublished?: boolean;
  dailyTotals?: number[];
}

export default function SalaryBreakdownPopup({
  isOpen, onClose, breakdown, visibleAllowanceKeys, isPublished, dailyTotals,
}: SalaryBreakdownPopupProps) {
  const [copied, setCopied] = useState(false);

  if (!breakdown) return null;

  const visibleAllowances = breakdown.allowances
    .filter(a => a.enabled)
    .filter(a => isPublished || !visibleAllowanceKeys || visibleAllowanceKeys.includes(a.key));

  const toK = (n: number) => Math.round(n / 1000);

  const parts: number[] = [];
  if (dailyTotals && dailyTotals.length > 0) {
    for (const d of dailyTotals) {
      if (d !== 0) parts.push(toK(d));
    }
  } else if (breakdown.total_daily_wages !== 0) {
    parts.push(toK(breakdown.total_daily_wages));
  }
  for (const a of visibleAllowances)
    if (a.amount !== 0) parts.push(toK(a.amount));
  if (breakdown.total_deductions > 0) parts.push(-toK(breakdown.total_deductions));

  const expression = parts
    .map((v, i) => i === 0 ? `${v}` : v < 0 ? `${v}` : `+${v}`)
    .join('');

  // Build deposit part separately for red styling
  const depositK = breakdown.deposit ? toK(breakdown.deposit) : 0;

  // Full expression for clipboard (plain text)
  const fullExpression = depositK > 0
    ? `${expression}-${depositK}`
    : expression;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullExpression);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = fullExpression;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
  };

  const handleVerify = () => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(fullExpression)}`, '_blank');
  };

  const handleClose = () => {
    setCopied(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4"
          >
            <div className="glass-card p-5 max-w-sm mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-foreground">= {formatVND(breakdown.total)}</h3>
                  {depositK > 0 && (
                    <p className="font-display font-extrabold text-sm text-gradient-gold mt-0.5">
                      Chuyển khoản: {formatVND(breakdown.total - (breakdown.deposit || 0))}
                    </p>
                  )}
                </div>
                <button onClick={handleClose} className="p-1 rounded-lg bg-muted text-muted-foreground">
                  <X size={16} />
                </button>
              </div>

              <div
                onClick={handleCopy}
                className="rounded-xl bg-muted/60 border border-border/40 px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground break-all active:bg-muted transition-colors cursor-pointer max-h-[40vh] overflow-y-auto"
              >
                {expression}{depositK > 0 && <span className="text-destructive font-bold">-{depositK}</span>}
              </div>

              <AnimatePresence mode="wait">
                {!copied ? (
                  <motion.button
                    key="copy"
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCopy}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-gold text-primary-foreground font-display font-semibold text-sm"
                  >
                    <Copy size={14} />
                    Sao chép
                  </motion.button>
                ) : (
                  <motion.div
                    key="verify"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-center gap-2 py-1.5 text-emerald-400 text-sm font-semibold">
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                      >
                        <Check size={18} strokeWidth={3} />
                      </motion.div>
                      Đã sao chép
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleVerify}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent font-display font-semibold text-sm"
                    >
                      <ExternalLink size={14} />
                      Kiểm tra
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
