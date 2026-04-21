import { SalaryEntry } from '@/types/salary';
import ClockOutChipGrid from './ClockOutChipGrid';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { memo, useMemo } from 'react';

export interface SquircleCardProps {
  entry: SalaryEntry;
  rate: number;
  globalClockIn: string;
  dailyBase: number;
  hourlyRate: number;
  state: 'focus' | 'review';
  onClockOutSelect: (time: string) => void;
  onDayOff?: () => void;
  onCardTap?: () => void;
  isTransitioning: boolean;
}

function SquircleCard({
  entry,
  rate,
  globalClockIn,
  dailyBase,
  hourlyRate,
  state,
  onClockOutSelect,
  onDayOff,
  onCardTap,
  isTransitioning,
}: SquircleCardProps) {
  const isFocus = state === 'focus';
  const isReview = state === 'review';
  const prefersReducedMotion = useReducedMotion();

  // Format date display (memoized)
  const { day, weekday } = useMemo(() => {
    const date = new Date(entry.entry_date + 'T00:00:00');
    const day = date.getDate();
    const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const weekday = weekdays[date.getDay()];
    return { day, weekday };
  }, [entry.entry_date]);

  // Animation variants for card transitions — same size for both states;
  // focus differentiation is handled by the glow wrapper in ImmersiveInputTypeB.
  const cardVariants = useMemo(() => ({
    focus: {
      scale: 1,
      opacity: 1,
      y: 0,
      filter: 'saturate(1)',
      transition: {
        duration: prefersReducedMotion ? 0.01 : 0.45,
        ease: [0.4, 0.0, 0.2, 1],
      },
    },
    review: {
      scale: 1,
      opacity: 0.72,
      y: 0,
      filter: 'saturate(0.85)',
      transition: {
        duration: prefersReducedMotion ? 0.01 : 0.45,
        ease: [0.4, 0.0, 0.2, 1],
      },
    },
  }), [prefersReducedMotion]);

  // Calculate daily summary using Type B logic (memoized)
  const { allowanceAmount, hours, extraWage, totalWage } = useMemo(() => {
    const allowanceAmount = Math.round((dailyBase * rate) / 100 / 1000) * 1000;
    
    // Calculate hours: use total_hours if available, otherwise calculate from clock times
    const calculateHours = () => {
      if (entry.total_hours !== null && entry.total_hours !== undefined) {
        return entry.total_hours;
      }
      const clockIn = entry.clock_in || globalClockIn;
      const clockOut = entry.clock_out;
      if (!clockIn || !clockOut) return 0;
      
      const [h1, m1] = clockIn.split(':').map(Number);
      const [h2, m2] = clockOut.split(':').map(Number);
      const mins1 = h1 * 60 + m1;
      const mins2 = h2 * 60 + m2;
      const diff = mins2 - mins1;
      if (diff <= 0) return 0;
      return Math.round(diff / 30) * 0.5; // round to nearest 0.5h
    };
    
    const hours = calculateHours();
    const extraWage = Math.round((hours * hourlyRate) / 1000) * 1000;
    
    // For off-days, total is 0; otherwise sum all components
    const totalWage = entry.is_day_off ? 0 : dailyBase + allowanceAmount + extraWage;

    return { allowanceAmount, hours, extraWage, totalWage };
  }, [entry.total_hours, entry.clock_in, entry.clock_out, entry.is_day_off, globalClockIn, dailyBase, rate, hourlyRate]);

  const formatVND = (amount: number) => {
    return `${(amount / 1000).toFixed(0)}k`;
  };

  return (
    <motion.div
      className={`
        bg-card/60 backdrop-blur-xl border border-glass-border transition-all duration-300
        rounded-[24px] sm:rounded-[28px] h-full flex flex-col
        ${isTransitioning ? 'pointer-events-none' : ''}
      `}
      variants={cardVariants}
      animate={isFocus ? 'focus' : 'review'}
      initial={false}
      style={{ willChange: isTransitioning ? 'transform, opacity' : 'auto' }}
      role="article"
      aria-label={`${isFocus ? 'Ngày hiện tại' : 'Ngày trước đó'}: ${day} ${weekday}`}
    >
      {/* Header: Date and Weekday */}
      <div className="p-4 sm:p-6 pb-3 sm:pb-4">
        <div className="flex items-baseline gap-2 sm:gap-3">
          <time className="text-4xl sm:text-5xl font-bold" dateTime={entry.entry_date}>
            {day}
          </time>
          <span className="text-xl sm:text-2xl text-muted-foreground">{weekday}</span>
        </div>
      </div>

      {/* Main content area: Hours display (left 1/3) + Chip grid (right 2/3) */}
      <div className="flex-1 px-4 sm:px-6 pb-4 sm:pb-6 flex gap-3 sm:gap-4" role="region" aria-label="Chọn giờ ra">
        {/* Left side: Hours display */}
        <div className="w-1/3 flex flex-col justify-center items-center gap-2 sm:gap-3">
          <div className="text-center">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Giờ vào</div>
            <time className="text-lg sm:text-xl font-semibold" dateTime={`${entry.entry_date}T${globalClockIn}`}>
              {globalClockIn}
            </time>
          </div>
          <div className="text-center">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Giờ làm</div>
            <div className="text-2xl sm:text-3xl font-bold text-accent">
              {hours > 0 ? `${hours}h` : '_'}
            </div>
          </div>
        </div>

        {/* Right side: Clock-out chip grid (2/3 width) */}
        <div className="w-2/3">
          <ClockOutChipGrid
            baseTime={globalClockIn}
            selectedTime={entry.clock_out}
            onSelect={onClockOutSelect}
            onDayOff={onDayOff}
            disabled={isTransitioning}
            cardState={state}
          />
        </div>
      </div>

      {/* Summary footer */}
      <div 
        className={`px-4 sm:px-6 py-3 sm:py-4 border-t border-border/20 ${isReview && onCardTap ? 'cursor-pointer hover:bg-muted/20' : ''}`}
        role="region" 
        aria-label="Tóm tắt lương"
        onClick={isReview && onCardTap ? onCardTap : undefined}
      >
        {/* Special day notice - show if rate > 0 */}
        {rate > 0 && (
          <div className="mb-2 text-xs sm:text-sm text-accent font-medium">
            Ngày đặc biệt • Phụ cấp +{rate}%
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Memoize component to prevent unnecessary re-renders
export default memo(SquircleCard);
