import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy } from 'lucide-react';
import { AllowanceKey, SalaryBreakdown, SalaryEntry } from '@/types/salary';
import { formatVND } from './TotalSalaryDisplay';
import { toast } from 'sonner';

interface SalaryBreakdownPopupProps {
  isOpen: boolean;
  onClose: () => void;
  breakdown: SalaryBreakdown | null;
  visibleAllowanceKeys?: AllowanceKey[] | null;
  isPublished?: boolean;
  /** Per-row daily totals for the detailed expression */
  dailyTotals?: number[];
}

export default function SalaryBreakdownPopup({
  isOpen, onClose, breakdown, visibleAllowanceKeys, isPublished, dailyTotals,
}: SalaryBreakdownPopupProps) {
  if (!breakdown) return null;

  const visibleAllowances = breakdown.allowances
    .filter(a => a.enabled)
    .filter(a => isPublished || !visibleAllowanceKeys || visibleAllowanceKeys.includes(a.key));

  const toK = (n: number) => Math.round(n / 1000);

  // Build expression: every non-zero daily wage + each allowance
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

  const handleCopy = () => {
    navigator.clipboard.writeText(expression);
    toast.success('Đã sao chép!');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                <h3 className="font-display font-semibold text-foreground">= {formatVND(breakdown.total)}</h3>
                <button onClick={onClose} className="p-1 rounded-lg bg-muted text-muted-foreground">
                  <X size={16} />
                </button>
              </div>

              <div
                onClick={handleCopy}
                className="rounded-xl bg-muted/60 border border-border/40 px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground break-all active:bg-muted transition-colors cursor-pointer max-h-[40vh] overflow-y-auto"
              >
                {expression}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-gold text-primary-foreground font-display font-semibold text-sm"
              >
                <Copy size={14} />
                Sao chép
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
