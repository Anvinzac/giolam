import { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Settings2, CalendarPlus, CalendarOff, Check, X, Clock, Pencil } from "lucide-react";
import { getWeekDates } from "@/lib/lunarUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DayCard from "./DayCard";
import AnalogClock from "./AnalogClock";

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
  userId: string;
  onShiftUpdate: (date: string, updates: Partial<ShiftData>) => void;
}

interface RegistrationDay {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  registered: boolean;
}

interface ExistingReg {
  shift_date: string;
  status: string;
  clock_in: string | null;
  clock_out: string | null;
  admin_clock_in: string | null;
  admin_clock_out: string | null;
  admin_note: string | null;
}

const STATUS_ICON: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  pending: { icon: <Clock size={12} />, label: 'Chờ duyệt', color: 'text-warning bg-warning/10 border-warning/30' },
  approved: { icon: <Check size={12} />, label: 'Đã duyệt', color: 'text-success bg-success/10 border-success/30' },
  rejected: { icon: <X size={12} />, label: 'Từ chối', color: 'text-destructive bg-destructive/10 border-destructive/30' },
  modified: { icon: <Pencil size={12} />, label: 'Đã sửa', color: 'text-accent bg-accent/10 border-accent/30' },
};

export default function WeekView({
  shifts, offDays, shiftType, defaultClockIn, defaultClockOut,
  periodStart, periodEnd, userId, onShiftUpdate
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

  // Registration mode state
  const [regDays, setRegDays] = useState<RegistrationDay[]>([]);
  const [regEditing, setRegEditing] = useState<{ dateStr: string; field: 'clockIn' | 'clockOut' } | null>(null);
  const [submittingReg, setSubmittingReg] = useState(false);
  const [existingRegs, setExistingRegs] = useState<ExistingReg[]>([]);

  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart]);

  // Determine if this is next week (registration mode)
  const isNextWeek = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diff);
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    const weekStartStr = currentWeekStart.toISOString().split('T')[0];
    const nextMondayStr = nextMonday.toISOString().split('T')[0];
    return weekStartStr === nextMondayStr;
  }, [currentWeekStart]);

  // Fetch existing registrations for next week
  useEffect(() => {
    if (!isNextWeek || !userId) {
      setExistingRegs([]);
      return;
    }
    const dates = weekDates.map(d => d.toISOString().split('T')[0]);
    supabase.from('shift_registrations')
      .select('shift_date,status,clock_in,clock_out,admin_clock_in,admin_clock_out,admin_note')
      .eq('user_id', userId)
      .in('shift_date', dates)
      .then(({ data }) => {
        setExistingRegs((data as ExistingReg[]) || []);
      });
  }, [isNextWeek, userId, weekDates]);

  const navigateWeek = (direction: number) => {
    setCurrentWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7 * direction);
      return next;
    });
    setRegDays([]);
    setRegEditing(null);
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
    if (newActive) {
      onShiftUpdate(dateStr, {
        is_active: true,
        clock_in: defaultClockIn || null,
        clock_out: defaultClockOut || null,
      });
    } else {
      onShiftUpdate(dateStr, { is_active: false });
    }
  };

  // Registration helpers
  const toggleRegDay = (dateStr: string) => {
    setRegDays(prev => {
      const existing = prev.find(r => r.date === dateStr);
      if (existing) {
        return prev.filter(r => r.date !== dateStr);
      }
      // Auto-fill default times if available
      const autoClockIn = defaultClockIn || null;
      const autoClockOut = defaultClockOut || null;
      return [...prev, { date: dateStr, clockIn: autoClockIn, clockOut: autoClockOut, registered: false }];
    });
  };

  const toggleRegOffDay = (dateStr: string) => {
    // Register as off day: clock_in and clock_out are null, just mark it
    setRegDays(prev => {
      const existing = prev.find(r => r.date === dateStr);
      if (existing) {
        return prev.filter(r => r.date !== dateStr);
      }
      return [...prev, { date: dateStr, clockIn: null, clockOut: null, registered: false }];
    });
  };

  const handleRegTimeSelect = (time: string) => {
    if (!regEditing) return;
    setRegDays(prev => prev.map(r => {
      if (r.date !== regEditing.dateStr) return r;
      if (regEditing.field === 'clockIn') {
        return { ...r, clockIn: time };
      }
      return { ...r, clockOut: time };
    }));

    // Chain: clockIn → clockOut
    if (regEditing.field === 'clockIn') {
      setRegEditing({ dateStr: regEditing.dateStr, field: 'clockOut' });
    } else {
      setRegEditing(null);
    }
  };

  const submitRegistrations = async () => {
    const valid = regDays.filter(r => (r.clockIn && r.clockOut) || (!r.clockIn && !r.clockOut));
    if (valid.length === 0) {
      toast.error("Chọn ngày trước khi đăng ký");
      return;
    }

    setSubmittingReg(true);
    try {
      // Batch upsert all at once instead of one-by-one
      const rows = valid.map(reg => ({
        user_id: userId,
        shift_date: reg.date,
        clock_in: reg.clockIn,
        clock_out: reg.clockOut,
        status: 'pending' as const,
      }));

      const { error } = await supabase.from('shift_registrations').upsert(
        rows as any,
        { onConflict: 'user_id,shift_date' }
      );

      if (error) throw error;

      toast.success(`Đã đăng ký ${valid.length} ngày`);
      setRegDays([]);
      // Refresh existing regs
      const dates = weekDates.map(d => d.toISOString().split('T')[0]);
      const { data } = await supabase.from('shift_registrations')
        .select('shift_date,status,clock_in,clock_out,admin_clock_in,admin_clock_out,admin_note')
        .eq('user_id', userId)
        .in('shift_date', dates);
      setExistingRegs((data as ExistingReg[]) || []);
    } catch (e: any) {
      toast.error(e.message || "Lỗi đăng ký");
    }
    setSubmittingReg(false);
  };

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[start.getMonth()]} ${start.getDate()} – ${monthNames[end.getMonth()]} ${end.getDate()}`;
  }, [weekDates]);

  const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between px-2">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigateWeek(-1)} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={18} />
        </motion.button>
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold text-foreground">{weekLabel}</h2>
          {isNextWeek && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/20 text-accent border border-accent/30">
              Đăng ký ca
            </span>
          )}
        </div>
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

      {/* Day cards or Registration mode */}
      <div className="space-y-2">
        {weekDates.map((date, i) => {
          const shift = getShiftForDate(date);
          const dateStr = date.toISOString().split('T')[0];
          const dayIndex = (date.getDay() + 6) % 7;

          if (isNextWeek) {
            // Registration mode — only off days are disabled, NOT period range
            const off = isOffDay(date);
            const regDay = regDays.find(r => r.date === dateStr);
            const isWeekend = dayIndex >= 5;
            const existingReg = existingRegs.find(r => r.shift_date === dateStr);
            const statusInfo = existingReg ? STATUS_ICON[existingReg.status] : null;

            if (off) {
              return (
                <motion.div key={dateStr} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="flex items-stretch rounded-xl bg-off-day/50 opacity-60 overflow-hidden min-h-[40px]">
                    <div className="flex flex-col items-center justify-center w-16 py-1 border-r border-border">
                      <span className="text-xs font-medium text-off-day-foreground">{DAYS[dayIndex]}</span>
                      <span className="text-[10px] text-off-day-foreground">{date.getDate()}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-xs text-off-day-foreground">Nghỉ</div>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div key={dateStr} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className={`flex items-stretch rounded-xl overflow-hidden min-h-[44px] ${
                  regDay ? 'bg-accent/10 border-2 border-accent/40' : isWeekend ? 'bg-saturday/10 border border-saturday/20' : 'bg-card/60 border border-glass-border'
                }`}>
                  {/* Day toggle */}
                  <button
                    onClick={() => toggleRegDay(dateStr)}
                    className={`w-16 flex flex-col items-center justify-center py-1 border-r border-border transition-all ${
                      regDay ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="text-sm font-bold leading-none">{DAYS[dayIndex]}</span>
                    <span className="text-xs opacity-80">{date.getDate()}</span>
                  </button>

                  {regDay ? (
                    regDay.clockIn || regDay.clockOut ? (
                      <div className="flex-1 flex items-center">
                        <button
                          onClick={() => setRegEditing({ dateStr, field: 'clockIn' })}
                          className="flex-1 flex items-center justify-center border-r border-border text-sm font-semibold text-success hover:bg-success/5 h-full"
                        >
                          {regDay.clockIn?.slice(0, 5) || '--:--'}
                        </button>
                        <button
                          onClick={() => setRegEditing({ dateStr, field: 'clockOut' })}
                          className="flex-1 flex items-center justify-center text-sm font-semibold text-accent hover:bg-accent/5 h-full"
                        >
                          {regDay.clockOut?.slice(0, 5) || '--:--'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                        <CalendarOff size={14} className="mr-1" />
                        Đăng ký nghỉ
                      </div>
                    )
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      {statusInfo ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusInfo.color}`}>
                          {statusInfo.icon}
                          {statusInfo.label}
                          {existingReg && existingReg.clock_in && (
                            <span className="ml-1 opacity-70">
                              {existingReg.clock_in.slice(0, 5)}–{existingReg.clock_out?.slice(0, 5)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Chạm để đăng ký</span>
                      )}
                    </div>
                  )}

                  {/* Off day registration button */}
                  {!regDay && (
                    <button
                      onClick={() => toggleRegOffDay(dateStr)}
                      className="w-10 flex items-center justify-center border-l border-border text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                      title="Đăng ký nghỉ"
                    >
                      <CalendarOff size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          }

          // Normal shift mode
          const off = isOffDay(date) || !isInPeriod(date);
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

      {/* Registration submit button */}
      {isNextWeek && regDays.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }}
          onClick={submitRegistrations}
          disabled={submittingReg}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-semibold bg-accent text-accent-foreground disabled:opacity-50"
        >
          <CalendarPlus size={18} />
          {submittingReg ? 'Đang gửi...' : `Đăng ký ${regDays.length} ngày`}
        </motion.button>
      )}

      {/* Registration clock modal */}
      {regEditing && (
        <AnalogClock
          key={`${regEditing.dateStr}-${regEditing.field}`}
          onTimeSelect={handleRegTimeSelect}
          onClose={() => setRegEditing(null)}
          label={regEditing.field === 'clockIn' ? 'Giờ vào' : 'Giờ ra'}
        />
      )}
    </div>
  );
}
