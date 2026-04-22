import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { SalaryEntry, SpecialDayRate, EmployeeAllowance, SalaryBreakdown } from '@/types/salary';
import SquircleCard from './SquircleCard';
import { toast } from 'sonner';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface ImmersiveInputTypeBProps {
  entries: SalaryEntry[];
  rates: SpecialDayRate[];
  allowances: EmployeeAllowance[];
  baseSalary: number;
  hourlyRate: number;
  globalClockIn: string;
  periodStart: string;
  periodEnd: string;
  offDays: string[];
  onEntryUpdate: (entryDate: string, sortOrder: number, updates: Partial<SalaryEntry>) => void;
  breakdown: SalaryBreakdown | null;
  currentUserId: string;
}

interface ImmersiveState {
  currentDayIndex: number;
  isTransitioning: boolean;
  editingPreviousDay: boolean;
  loadError: string | null;
}

export default function ImmersiveInputTypeB({
  entries,
  rates,
  allowances,
  baseSalary,
  hourlyRate,
  globalClockIn,
  periodStart,
  periodEnd,
  offDays,
  onEntryUpdate,
  breakdown,
  currentUserId,
}: ImmersiveInputTypeBProps) {
  const [state, setState] = useState<ImmersiveState>({
    currentDayIndex: 0,
    isTransitioning: false,
    editingPreviousDay: false,
    loadError: null,
  });

  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  
  // Debounce ref to prevent rapid double-taps (Task 15.3)
  const lastTapTime = useRef<number>(0);
  const DEBOUNCE_MS = 300;

  // Motion value for smooth scrolling
  const scrollY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastWheelTime = useRef(0);

  // Show all days (including off-days) sorted by sort_order
  const workingDays = useMemo(() => {
    return entries
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [entries]);

  // Check if all working days have been completed (Task 11.1)
  const isCompleted = useMemo(() => {
    if (workingDays.length === 0) return false;
    return state.currentDayIndex >= workingDays.length;
  }, [workingDays.length, state.currentDayIndex]);

  // Format total salary for display
  const formattedTotal = useMemo(() => {
    if (!breakdown) return '0';
    return new Intl.NumberFormat('vi-VN').format(breakdown.total);
  }, [breakdown]);

  // Spring used for the continuous upward slide — same for every card so the
  // stack moves as a single coherent sheet.
  const trackSpring = useMemo(
    () => ({
      type: 'spring' as const,
      stiffness: 260,
      damping: 32,
      mass: 0.95,
      restDelta: 0.001,
    }),
    [],
  );

  // Virtual scrolling: render cards from -2 to +1 relative to current (4 cards total)
  // This ensures smooth scrolling in both directions
  const visibleCardIndices = useMemo(() => {
    const indices: number[] = [];
    // Render: above-above (-2), above/review (-1), focus (0), below (+1)
    for (let i = Math.max(0, state.currentDayIndex - 2); i <= Math.min(workingDays.length - 1, state.currentDayIndex + 1); i++) {
      indices.push(i);
    }
    return indices;
  }, [state.currentDayIndex, workingDays.length]);

  // Handle wheel scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isDragging.current || state.isTransitioning) return;
      
      const now = Date.now();
      if (now - lastWheelTime.current < 100) return; // Throttle wheel events
      lastWheelTime.current = now;

      const delta = e.deltaY;
      if (Math.abs(delta) < 10) return; // Ignore tiny scrolls

      if (delta > 0 && state.currentDayIndex < workingDays.length - 1) {
        // Scroll down = next day
        setState(prev => ({ ...prev, currentDayIndex: prev.currentDayIndex + 1 }));
      } else if (delta < 0 && state.currentDayIndex > 0) {
        // Scroll up = previous day
        setState(prev => ({ ...prev, currentDayIndex: prev.currentDayIndex - 1 }));
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: true });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [state.currentDayIndex, state.isTransitioning, workingDays.length]);

  // Handle drag/swipe
  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    isDragging.current = false;
    if (state.isTransitioning) return;

    const threshold = 50; // pixels
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    if (Math.abs(offset) > threshold || Math.abs(velocity) > 500) {
      if (offset > 0 && state.currentDayIndex > 0) {
        // Swipe down = previous day
        setState(prev => ({ ...prev, currentDayIndex: prev.currentDayIndex - 1 }));
      } else if (offset < 0 && state.currentDayIndex < workingDays.length - 1) {
        // Swipe up = next day
        setState(prev => ({ ...prev, currentDayIndex: prev.currentDayIndex + 1 }));
      }
    }
    
    // Reset scroll position
    animate(scrollY, 0, { type: 'spring', stiffness: 300, damping: 30 });
  }, [state.currentDayIndex, state.isTransitioning, workingDays.length, scrollY]);

  // Advance to next day after successful clock-out selection
  const advanceToNextDay = useCallback(() => {
    setState(prev => ({
      currentDayIndex: Math.min(prev.currentDayIndex + 1, workingDays.length - 1),
      isTransitioning: false,
      editingPreviousDay: false,
      loadError: null,
    }));
  }, [workingDays.length]);

  const handleChipSelect = useCallback((time: string) => {
    // Debounce rapid taps (Task 15.3)
    const now = Date.now();
    if (now - lastTapTime.current < DEBOUNCE_MS) {
      return;
    }
    lastTapTime.current = now;

    if (state.isTransitioning) return;
    
    const currentEntry = workingDays[state.currentDayIndex];
    if (!currentEntry) return;

    // Set transitioning state to prevent additional input
    setState(prev => ({ ...prev, isTransitioning: true }));
    
    try {
      // Optimistic update: call onEntryUpdate immediately
      onEntryUpdate(currentEntry.entry_date, currentEntry.sort_order, {
        clock_out: time,
      });

      // Advance to next day after animation completes
      const animationDuration = prefersReducedMotion ? 10 : 500;
      setTimeout(() => {
        advanceToNextDay();
      }, animationDuration);
    } catch (error) {
      // Handle save error (Task 11.2)
      console.error('Failed to save clock-out time:', error);
      toast.error('Lỗi lưu giờ ra. Vui lòng thử lại.');
      setState(prev => ({ ...prev, isTransitioning: false }));
    }
  }, [state.isTransitioning, state.currentDayIndex, workingDays, onEntryUpdate, prefersReducedMotion, advanceToNextDay]);

  // Helper to get special rate for a given entry date
  const getSpecialRate = useCallback((entryDate: string): SpecialDayRate | null => {
    const matchingRate = rates.find(r => r.special_date === entryDate);
    return matchingRate || null;
  }, [rates]);

  // Handle day-off selection
  const handleDayOff = useCallback((entryIndex: number) => {
    // Debounce rapid taps
    const now = Date.now();
    if (now - lastTapTime.current < DEBOUNCE_MS) {
      return;
    }
    lastTapTime.current = now;

    if (state.isTransitioning) return;
    
    const currentEntry = workingDays[entryIndex];
    if (!currentEntry) return;

    // Set transitioning state to prevent additional input
    setState(prev => ({ ...prev, isTransitioning: true }));
    
    try {
      // Mark as day-off
      onEntryUpdate(currentEntry.entry_date, currentEntry.sort_order, {
        is_day_off: true,
        clock_out: null,
        total_hours: 0,
      });

      // Advance to next day after animation completes (only if focus card)
      if (entryIndex === state.currentDayIndex) {
        const animationDuration = prefersReducedMotion ? 10 : 500;
        setTimeout(() => {
          advanceToNextDay();
        }, animationDuration);
      } else {
        // Just reset transitioning for review card
        setTimeout(() => {
          setState(prev => ({ ...prev, isTransitioning: false }));
        }, 300);
      }
    } catch (error) {
      console.error('Failed to mark day-off:', error);
      toast.error('Lỗi đánh dấu nghỉ. Vui lòng thử lại.');
      setState(prev => ({ ...prev, isTransitioning: false }));
    }
  }, [state.isTransitioning, state.currentDayIndex, workingDays, onEntryUpdate, prefersReducedMotion, advanceToNextDay]);

  const handlePreviousDayEdit = useCallback(() => {
    if (state.currentDayIndex === 0) return;
    // Move the review card back to focus by going back one day
    setState(prev => ({ 
      ...prev, 
      currentDayIndex: prev.currentDayIndex - 1,
      editingPreviousDay: false 
    }));
  }, [state.currentDayIndex]);

  // Handle chip selection on review card - bring card back to focus first
  const handleReviewCardChipSelect = useCallback((time: string, entryIndex: number) => {
    // Debounce rapid taps (Task 15.3)
    const now = Date.now();
    if (now - lastTapTime.current < DEBOUNCE_MS) {
      return;
    }
    lastTapTime.current = now;

    if (state.isTransitioning) return;
    
    const entry = workingDays[entryIndex];
    if (!entry) return;

    // Set transitioning state to prevent additional input
    setState(prev => ({ ...prev, isTransitioning: true }));
    
    try {
      // Update the clock-out time immediately
      onEntryUpdate(entry.entry_date, entry.sort_order, {
        clock_out: time,
      });

      // Then bring the card back to focus by setting currentDayIndex
      setState(prev => ({ 
        ...prev, 
        currentDayIndex: entryIndex,
        isTransitioning: true 
      }));

      // Reset transitioning after slide animation
      const slideAnimationDuration = prefersReducedMotion ? 10 : 500;
      setTimeout(() => {
        setState(prev => ({ 
          ...prev, 
          isTransitioning: false
        }));
      }, slideAnimationDuration);
    } catch (error) {
      // Handle save error (Task 11.2)
      console.error('Failed to update clock-out time:', error);
      toast.error('Lỗi cập nhật giờ ra. Vui lòng thử lại.');
      setState(prev => ({ ...prev, isTransitioning: false }));
    }
  }, [state.isTransitioning, workingDays, onEntryUpdate, prefersReducedMotion]);

  // Error state UI (Task 11.2)
  if (state.loadError) {
    return (
      <div className="glass-card p-6 sm:p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="flex justify-center">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-destructive" />
        </div>
        <p className="text-sm sm:text-base text-destructive font-medium">Không thể tải dữ liệu chấm công</p>
        <p className="text-xs sm:text-sm text-muted-foreground">{state.loadError}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setState(prev => ({ ...prev, loadError: null }))}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm sm:text-base"
          >
            Thử lại
          </button>
          <button
            onClick={() => navigate('/salary')}
            className="px-4 py-2 rounded-xl bg-muted text-muted-foreground font-medium text-sm sm:text-base"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Empty working days (Task 11.3)
  if (workingDays.length === 0) {
    return (
      <div className="glass-card p-6 sm:p-8 text-center space-y-4 max-w-md mx-auto">
        <p className="text-sm sm:text-base text-muted-foreground">Không có ngày làm việc trong kỳ này</p>
        <button
          onClick={() => navigate('/salary')}
          className="px-4 py-2 rounded-xl bg-muted text-muted-foreground font-medium text-sm sm:text-base"
        >
          Quay lại
        </button>
      </div>
    );
  }

  // Completion screen (Task 11.1)
  if (isCompleted) {
    return (
      <div className="glass-card p-6 sm:p-8 text-center space-y-4 sm:space-y-6 max-w-md mx-auto">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="flex justify-center"
        >
          <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-green-500" />
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Hoàn thành!</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Bạn đã nhập xong tất cả {workingDays.length} ngày làm việc
          </p>
        </div>
        <div className="glass-card p-4 sm:p-6 space-y-2">
          <p className="text-xs sm:text-sm text-muted-foreground">Tổng lương dự kiến</p>
          <p className="text-2xl sm:text-3xl font-bold text-gradient-gold">
            {formattedTotal} ₫
          </p>
        </div>
        <button
          onClick={() => navigate('/salary')}
          className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium shadow-lg text-sm sm:text-base"
        >
          Xem chi tiết lương
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      ref={containerRef}
      className="relative h-[calc(100vh-160px)] min-h-[520px] sm:min-h-[620px] overflow-hidden pb-16 sm:pb-20"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragStart={() => { isDragging.current = true; }}
      onDragEnd={handleDragEnd}
      style={{ y: scrollY }}
    >
      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isCompleted
          ? `Hoàn thành! Đã nhập xong ${workingDays.length} ngày làm việc.`
          : `Đang nhập ngày ${state.currentDayIndex + 1} trong ${workingDays.length} ngày.`
        }
      </div>

      {/* Virtual scrolling: only render visible cards (4 max) */}
      {visibleCardIndices.map((i) => {
        const entry = workingDays[i];
        if (!entry) return null;

        const offset = i - state.currentDayIndex; // -2 = above-above, -1 = review, 0 = focus, +1 = below
        const isFocus = offset === 0;
        const isReview = offset === -1;

        return (
          <motion.div
            key={entry.id ?? `${entry.entry_date}-${entry.sort_order}`}
            className="absolute inset-x-0 bottom-16 sm:bottom-20 h-[44%] p-3 sm:p-4"
            initial={false}
            animate={{ y: `${offset * 100}%` }}
            transition={trackSpring}
            style={{ willChange: 'transform' }}
            // Hide far-away cards from assistive tech + pointer events
            // Keep review (-1) and focus (0) interactive
            aria-hidden={offset < -1 || offset > 0}
          >
            <div
              className="relative h-full w-full"
              style={{
                pointerEvents: offset === 0 || offset === -1 ? 'auto' : 'none',
              }}
            >
              {/* Gradient glow effect - embedded in card wrapper, opacity animates */}
              <motion.div 
                aria-hidden 
                className="pointer-events-none absolute -inset-1 z-0"
                initial={false}
                animate={{
                  opacity: isFocus ? 1 : 0,
                }}
                transition={{
                  duration: prefersReducedMotion ? 0.01 : 0.5,
                  ease: [0.4, 0.0, 0.2, 1],
                }}
              >
                <div
                  className="absolute -inset-1 rounded-[28px] sm:rounded-[32px]"
                  style={{
                    background:
                      'radial-gradient(120% 90% at 50% 100%, hsl(var(--primary) / 0.32) 0%, hsl(var(--accent) / 0.20) 38%, transparent 72%)',
                    filter: 'blur(14px)',
                  }}
                />
                <div
                  className="absolute inset-0 rounded-[26px] sm:rounded-[30px]"
                  style={{
                    boxShadow:
                      '0 0 0 1px hsl(var(--primary) / 0.42) inset, 0 18px 50px -18px hsl(var(--primary) / 0.55), 0 0 30px -6px hsl(var(--accent) / 0.32)',
                  }}
                />
              </motion.div>

              {/* Card content */}
              <div className="relative z-10 h-full w-full">
                <SquircleCard
                  entry={entry}
                  specialRate={getSpecialRate(entry.entry_date)}
                  globalClockIn={globalClockIn}
                  dailyBase={0}
                  hourlyRate={hourlyRate}
                  state={isFocus ? 'focus' : 'review'}
                  isGlobalOffDay={offDays.includes(entry.entry_date)}
                  onClockOutSelect={(time) => {
                    if (isFocus) {
                      handleChipSelect(time);
                    } else if (isReview) {
                      handleReviewCardChipSelect(time, i);
                    }
                  }}
                  onDayOff={() => handleDayOff(i)}
                  onCardTap={isReview ? handlePreviousDayEdit : undefined}
                  isTransitioning={state.isTransitioning}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
