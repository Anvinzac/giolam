import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy } from 'lucide-react';
import { AllowanceKey, SalaryBreakdown } from '@/types/salary';
import { formatVND } from './TotalSalaryDisplay';
import { toast } from 'sonner';

interface SalaryBreakdownPopupProps {
  isOpen: boolean;
  onClose: () => void;
  breakdown: SalaryBreakdown | null;
  visibleAllowanceKeys?: AllowanceKey[] | null;
}

export default function SalaryBreakdownPopup({ isOpen, onClose, breakdown, visibleAllowanceKeys }: SalaryBreakdownPopupProps) {
  if (!breakdown) return null;

  const visibleAllowances = breakdown.allowances
    .filter(a => a.enabled)
    .filter(a => !visibleAllowanceKeys || visibleAllowanceKeys.includes(a.key));

  const handleCopy = () => {
    const lines = [
      `Tổng lương ngày: ${formatVND(breakdown.total_daily_wages)}`,
      `Phụ cấp đặc biệt: ${formatVND(breakdown.total_allowances_from_rates)}`,
    ];
    if (breakdown.total_deductions > 0) {
      lines.push(`Khấu trừ nghỉ: -${formatVND(breakdown.total_deductions)}`);
    }
    for (const a of visibleAllowances) {
      lines.push(`${a.label}: ${formatVND(a.amount)}`);
    }
    lines.push(`---`);
    lines.push(`TỔNG CỘNG: ${formatVND(breakdown.total)}`);

    navigator.clipboard.writeText(lines.join('\n'));
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
            <div className="glass-card p-5 max-w-sm mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-foreground">Chi tiết lương</h3>
                <button onClick={onClose} className="p-1 rounded-lg bg-muted text-muted-foreground">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <Row label="Tổng lương ngày" amount={breakdown.total_daily_wages} />
                <Row label="Phụ cấp đặc biệt" amount={breakdown.total_allowances_from_rates} />
                {breakdown.total_deductions > 0 && (
                  <Row label="Khấu trừ nghỉ" amount={-breakdown.total_deductions} negative />
                )}

                {visibleAllowances.map(a => (
                  <Row key={a.key} label={a.label} amount={a.amount} />
                ))}

                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-display font-bold text-foreground">TỔNG CỘNG</span>
                    <span className="font-display font-bold text-lg text-gradient-gold">
                      {formatVND(breakdown.total)}
                    </span>
                  </div>
                </div>
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

function Row({ label, amount, negative }: { label: string; amount: number; negative?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={negative ? 'text-destructive' : 'text-foreground'}>
        {formatVND(amount)}
      </span>
    </div>
  );
}
