import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { getWeekDates } from "@/lib/lunarUtils";
import DayCard from "./DayCard";

interface ShiftData {
  shift_date: string;
  is_active: boolean;
  clock_in: string | null;
  clock_out: string | null;
  main_clock_in: string | null;
  main_clock_out: string | null;
  overtime_clock_in: string | null;
  overtime_clock_out: string | null;
  notice: string | null;
}

interface WeekViewProps {
  shifts: ShiftData[];
  offDays: string[];
  shiftType: 'basic' | 'overtime' | 'notice_only';
  defaultClockIn: string | null;
  defaultClockOut: string | null;
  periodStart: string;
  periodEnd: string;
  onShiftUpdate: (date: string, updates: Partial<ShiftData>) => void;
}

export default function WeekView({
  shifts, offDays, shiftType, defaultClockIn, defaultClockOut,
  periodStart, periodEnd, onShiftUpdate
}: WeekViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return monday;
  });
  const [showOvertime, setShowOvertime] = useState(false);

  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart]);

  const navigateWeek = (direction: number) => {
    setCurrentWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7 * direction);
      return next;
    });
  };

  const getShiftForDate = useCallback((date: Date): ShiftData | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.find(s => s.shift_date === dateStr);
  }, [shifts]);

  const isOffDay = useCallback((date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return offDays.includes(dateStr);
  }, [offDays]);

  const isInPeriod = useCallback((date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return dateStr >= periodStart && dateStr <= periodEnd;
  }, [periodStart, periodEnd]);

  const handleToggle = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const existing = getShiftForDate(date);
    const newActive = !existing?.is_active;
    onShiftUpdate(dateStr, {
      is_active: newActive,
      clock_in: newActive && defaultClockIn ? defaultClockIn : existing?.clock_in || null,
      clock_out: newActive && defaultClockOut ? defaultClockOut : existing?.clock_out || null,
    });
  };

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[start.getMonth()]} ${start.getDate()} – ${monthNames[end.getMonth()]} ${end.getDate()}`;
  }, [weekDates]);

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between px-2">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigateWeek(-1)} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={18} />
        </motion.button>
        <h2 className="font-display font-semibold text-foreground">{weekLabel}</h2>
        <div className="flex gap-2">
          {shiftType === 'overtime' && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowOvertime(!showOvertime)}
              className={`p-2 rounded-xl transition-colors ${showOvertime ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              <Settings2 size={18} />
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigateWeek(1)} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight size={18} />
          </motion.button>
        </div>
      </div>

      {/* Day cards */}
      <div className="space-y-2">
        {weekDates.map((date, i) => {
          const shift = getShiftForDate(date);
          const off = isOffDay(date) || !isInPeriod(date);
          const dateStr = date.toISOString().split('T')[0];

          return (
            <motion.div
              key={dateStr}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <DayCard
                date={date}
                isActive={shift?.is_active ?? false}
                isOffDay={off}
                clockIn={shift?.clock_in ?? null}
                clockOut={shift?.clock_out ?? null}
                mainClockIn={shift?.main_clock_in ?? null}
                mainClockOut={shift?.main_clock_out ?? null}
                notice={shift?.notice ?? ''}
                shiftType={shiftType}
                defaultClockIn={defaultClockIn}
                defaultClockOut={defaultClockOut}
                showOvertimeColumn={showOvertime}
                onToggle={() => handleToggle(date)}
                onClockInChange={(t) => onShiftUpdate(dateStr, { clock_in: t })}
                onClockOutChange={(t) => onShiftUpdate(dateStr, { clock_out: t })}
                onMainClockInChange={(t) => onShiftUpdate(dateStr, { main_clock_in: t })}
                onMainClockOutChange={(t) => onShiftUpdate(dateStr, { main_clock_out: t })}
                onNoticeChange={(n) => onShiftUpdate(dateStr, { notice: n })}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
