import { motion } from 'framer-motion';

export function formatVND(amount: number): string {
  if (amount === 0) return '0 đ';
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNeg ? '-' : ''}${formatted} đ`;
}

interface TotalSalaryDisplayProps {
  total: number;
  onTap: () => void;
}

export default function TotalSalaryDisplay({ total, onTap }: TotalSalaryDisplayProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className="w-full glass-card p-5 text-center cursor-pointer"
    >
      <p className="text-xs text-muted-foreground mb-1">Tổng lương</p>
      <p className="font-display font-bold text-2xl text-gradient-gold">
        {formatVND(total)}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1">Nhấn để xem chi tiết</p>
    </motion.button>
  );
}
