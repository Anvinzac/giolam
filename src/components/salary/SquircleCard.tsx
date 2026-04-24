import { SalaryEntry, SpecialDayRate } from '@/types/salary';
import ClockOutChipGrid from './ClockOutChipGrid';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { memo, useMemo } from 'react';

export interface SquircleCardProps {
  entry: SalaryEntry;
  specialRate: SpecialDayRate | null;
  globalClockIn: string;
  dailyBase: number;
  hourlyRate: number;
  state: 'focus' | 'review';
  isGlobalOffDay: boolean;
  onClockOutSelect: (time: string) => void;
  onDayOff?: () => void;
  onCardTap?: () => void;
  isTransitioning: boolean;
}

function SquircleCard({
  entry,
  specialRate,
  globalClockIn,
  dailyBase,
  hourlyRate,
  state,
  isGlobalOffDay,
  onClockOutSelect,
  onDayOff,
  onCardTap,
  isTransitioning,
}: SquircleCardProps) {
  const isFocus = state === 'focus';
  const isReview = state === 'review';
  const prefersReducedMotion = useReducedMotion();

  // Only gray out global off-days (restaurant closed)
  // Individual no-work days (no clock-in/out) are shown normally
  const isDisabled = isGlobalOffDay;
  const hasNoClockIn = !entry.clock_in && !globalClockIn;

  // Format clock-in time without seconds
  const formatTime = (time: string | null): string => {
    if (!time) return '';
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`; // HH:MM only
  };

  // Format date display (memoized)
  const { day, weekday } = useMemo(() => {
    const date = new Date(entry.entry_date + 'T00:00:00');
    const day = date.getDate().toString().padStart(2, '0'); // Add leading zero
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
    const rate = specialRate?.rate_percent ?? 0;
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
  }, [entry.total_hours, entry.clock_in, entry.clock_out, entry.is_day_off, globalClockIn, dailyBase, specialRate, hourlyRate]);

  const formatVND = (amount: number) => {
    return `${(amount / 1000).toFixed(0)}k`;
  };

  return (
    <motion.div
      className={`
        bg-card/60 backdrop-blur-xl border border-glass-border
        rounded-[24px] sm:rounded-[28px] h-full flex flex-col
        ${isTransitioning ? 'pointer-events-none' : ''}
        ${isDisabled ? 'opacity-50 grayscale' : ''}
      `}
      variants={cardVariants}
      animate={isFocus ? 'focus' : 'review'}
      initial={false}
      style={{ willChange: isTransitioning ? 'transform, opacity' : 'auto' }}
      role="article"
      aria-label={`${isFocus ? 'Ngày hiện tại' : 'Ngày trước đó'}: ${day} ${weekday}${isGlobalOffDay ? ' - Nghỉ' : ''}`}
    >
      {/* Header: Date and Weekday */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2 sm:pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2 sm:gap-3">
            <time className="text-4xl sm:text-5xl font-bold" dateTime={entry.entry_date}>
              {day}
            </time>
            <span className="text-xl sm:text-2xl text-muted-foreground">{weekday}</span>
            {isGlobalOffDay && (
              <span className="text-sm sm:text-base text-destructive font-medium">Nghỉ</span>
            )}
          </div>
          {specialRate && !isDisabled && (
            <div className="text-xs sm:text-sm text-accent font-medium text-right">
              {specialRate.description_vi}
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      {isDisabled ? (
        <div className="flex-1 px-4 sm:px-6 pb-4 sm:pb-5 flex items-center justify-center">
          <p className="text-sm sm:text-base text-muted-foreground">Ngày nghỉ</p>
        </div>
      ) : (
        <div
          className={`flex-1 px-4 sm:px-6 pb-4 sm:pb-5 flex gap-3 sm:gap-4 ${isReview && onCardTap ? 'cursor-pointer' : ''}`}
          role="region"
          aria-label="Chọn giờ ra"
          onClick={isReview && onCardTap && !isDisabled ? onCardTap : undefined}
        >
          {/* Left: clock-in + hours worked */}
          <div className="w-1/3 flex flex-col justify-center items-center gap-3 shrink-0">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-0.5">Giờ vào</div>
              <time className="text-base sm:text-lg font-semibold">
                {formatTime(entry.clock_in || globalClockIn)}
              </time>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-0.5">Giờ làm</div>
              <div className="text-xl sm:text-2xl font-bold text-accent">
                {hours > 0 ? `${hours}h` : '_'}
              </div>
            </div>
          </div>

          {/* Right: chip grid — natural height, no overflow clipping */}
          <div className="w-2/3">
            <ClockOutChipGrid
              baseTime={formatTime(entry.clock_in || globalClockIn)}
              selectedTime={entry.clock_out}
              onSelect={onClockOutSelect}
              onDayOff={onDayOff}
              disabled={isTransitioning}
              cardState={state}
              isOffDay={entry.is_day_off}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Memoize component to prevent unnecessary re-renders
export default memo(SquircleCard);
