import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar, Clock, ChevronLeft, ChevronRight, Check, X, Trash2, Plus } from "lucide-react";
import { getWeekDates, getMoonLabel } from "@/lib/lunarUtils";
import { toast } from "sonner";

interface ShiftSlot {
  user_id: string;
  full_name: string;
  clock_in: string | null;
  clock_out: string | null;
}

interface DayShifts {
  morning: ShiftSlot[];
  afternoon: ShiftSlot[];
}

interface Props {
  periodId: string;
  periodStart: string;
  periodEnd: string;
}

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const SHORT_NAMES: Record<string, string> = {
  'Minh Vũ': 'M.Vũ',
  'Minh Anh': 'M.Anh',
  'Hữu Khang': 'H.Khang',
};

function shortName(full: string): string {
  return SHORT_NAMES[full] || full;
}
const SHIFT_DEFAULTS: Record<string, { clock_in: string; clock_out: string; label: string; color: string; bg: string; border: string }> = {
  morning: { clock_in: '08:00', clock_out: '15:00', label: 'Sáng', color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  afternoon: { clock_in: '15:00', clock_out: '22:00', label: 'Chiều', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
};

export default function AdminShiftRegister({ periodId, periodStart, periodEnd }: Props) {
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return monday;
  });
  const [dayShifts, setDayShifts] = useState<Record<string, DayShifts>>({});
  const [serviceEmployees, setServiceEmployees] = useState<{ user_id: string; full_name: string }[]>([]);
  const [activeEmployee, setActiveEmployee] = useState<string | null>(null);
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [pickerOpen, setPickerOpen] = useState<{ date: string; shift: string } | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [editSlot, setEditSlot] = useState<{ date: string; shift: string; userId: string } | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[start.getMonth()]} ${start.getDate()} – ${monthNames[end.getMonth()]} ${end.getDate()}`;
  }, [weekDates]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: profiles }, { data: departments }, { data: shifts }, { data: registrations }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, work_shift, shift_type, department_id'),
        supabase.from('departments').select('id, name'),
        supabase.from('shifts').select('*').eq('period_id', periodId),
        supabase.from('shift_registrations').select('user_id, status').eq('status', 'pending'),
      ]);

      // Count pending registrations per employee
      const pCounts: Record<string, number> = {};
      for (const r of (registrations || [])) {
        pCounts[r.user_id] = (pCounts[r.user_id] || 0) + 1;
      }
      setPendingCounts(pCounts);

      const receptionDept = (departments || []).find((d: any) => d.name === 'Reception');
      const receptionDeptId = receptionDept?.id || '';

      const serviceEmps = ((profiles || []) as any[])
        .filter(
          (p: any) =>
            p.department_id === receptionDeptId &&
            p.full_name !== 'N. Viên C' &&
            p.full_name !== 'N. Viên D'
        )
        .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''));

      setServiceEmployees(serviceEmps.map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name || 'Unknown',
      })));

      const shiftsByDate: Record<string, DayShifts> = {};
      for (const d of weekDates) {
        const dateStr = d.toISOString().split('T')[0];
        shiftsByDate[dateStr] = { morning: [], afternoon: [] };
      }

      const empMap = new Map<string, { full_name: string }>();
      for (const p of (profiles || []) as any[]) {
        empMap.set(p.user_id, {
          full_name: p.full_name || 'Unknown',
        });
      }

      for (const s of (shifts || []) as any[]) {
        const dateStr = s.shift_date;
        if (!shiftsByDate[dateStr]) continue;
        const emp = empMap.get(s.user_id);
        if (!emp) continue;
        const slot: ShiftSlot = {
          user_id: s.user_id,
          full_name: emp.full_name,
          clock_in: s.clock_in,
          clock_out: s.clock_out,
        };
        if (s.shift_slot === 'afternoon') {
          shiftsByDate[dateStr].afternoon.push(slot);
        } else {
          shiftsByDate[dateStr].morning.push(slot);
        }
      }

      setDayShifts(shiftsByDate);
      setLoading(false);
    };
    fetchData();
  }, [periodId, weekDates]);

  useEffect(() => {
    if (!pickerOpen) return;
    const currentSlots = dayShifts[pickerOpen.date]?.[pickerOpen.shift] || [];
    setSelectedEmployees(new Set(currentSlots.map(s => s.user_id)));
  }, [pickerOpen]);

  useEffect(() => {
    if (!editSlot) return;
    const slot = dayShifts[editSlot.date]?.[editSlot.shift]?.find(s => s.user_id === editSlot.userId);
    setEditClockIn(slot?.clock_in || SHIFT_DEFAULTS[editSlot.shift].clock_in);
    setEditClockOut(slot?.clock_out || SHIFT_DEFAULTS[editSlot.shift].clock_out);
  }, [editSlot]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        handleDone();
      }
    };
    if (pickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [pickerOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setEditSlot(null);
      }
    };
    if (editSlot) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editSlot]);

  const navigateWeek = (direction: number) => {
    setWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7 * direction);
      return next;
    });
  };

  const toggleEmployeeShift = useCallback((dateStr: string, shiftKey: string) => {
    if (!activeEmployee) return;

    const existingSlot = dayShifts[dateStr]?.[shiftKey]?.find(s => s.user_id === activeEmployee);
    const key = `${dateStr}|${shiftKey}`;
    const defaults = SHIFT_DEFAULTS[shiftKey];
    const emp = serviceEmployees.find(e => e.user_id === activeEmployee);

    // Optimistic local update — instant
    setDayShifts(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        [shiftKey]: existingSlot
          ? (prev[dateStr]?.[shiftKey] || []).filter(s => s.user_id !== activeEmployee)
          : [...(prev[dateStr]?.[shiftKey] || []), {
              user_id: activeEmployee,
              full_name: emp?.full_name || '',
              clock_in: defaults.clock_in,
              clock_out: defaults.clock_out,
            }],
      },
    }));

    // Fire-and-forget sync to server
    setPendingToggles(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    (async () => {
      if (existingSlot) {
        await supabase.from('shifts')
          .delete()
          .eq('period_id', periodId)
          .eq('user_id', activeEmployee)
          .eq('shift_date', dateStr)
          .eq('shift_slot', shiftKey);
        await supabase.from('shift_registrations')
          .delete()
          .eq('user_id', activeEmployee)
          .eq('shift_date', dateStr)
          .eq('shift_slot', shiftKey)
          .eq('status', 'assigned');
      } else {
        await supabase.from('shifts').upsert({
          period_id: periodId,
          user_id: activeEmployee,
          shift_date: dateStr,
          shift_slot: shiftKey,
          is_active: true,
          clock_in: defaults.clock_in,
          clock_out: defaults.clock_out,
          notice: null,
        } as any, { onConflict: 'user_id,shift_date,shift_slot' });
        await supabase.from('shift_registrations').upsert({
          user_id: activeEmployee,
          shift_date: dateStr,
          shift_slot: shiftKey,
          status: 'assigned',
          clock_in: defaults.clock_in,
          clock_out: defaults.clock_out,
        } as any, { onConflict: 'user_id,shift_date,shift_slot' });
      }

      setPendingToggles(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    })();
  }, [activeEmployee, dayShifts, periodId, serviceEmployees]);

  const handleDone = async () => {
    if (!pickerOpen) {
      setPickerOpen(null);
      return;
    }

    const defaults = SHIFT_DEFAULTS[pickerOpen.shift];
    const { data: { user } } = await supabase.auth.getUser();
    const currentSlots = dayShifts[pickerOpen.date]?.[pickerOpen.shift] || [];
    const previousIds = new Set(currentSlots.map(s => s.user_id));

    // Employees to add (newly selected) and to remove (deselected)
    const toAdd = [...selectedEmployees].filter(id => !previousIds.has(id));
    const toRemove = [...previousIds].filter(id => !selectedEmployees.has(id));

    let errors = 0;

    // Add new employees
    for (const userId of toAdd) {
      const emp = serviceEmployees.find(e => e.user_id === userId);
      if (!emp) continue;
      const { error } = await supabase.from('shifts').upsert({
        period_id: periodId,
        user_id: userId,
        shift_date: pickerOpen.date,
        shift_slot: pickerOpen.shift,
        is_active: true,
        clock_in: defaults.clock_in,
        clock_out: defaults.clock_out,
        notice: null,
        updated_by: user?.id,
      } as any, { onConflict: 'user_id,shift_date,shift_slot' });
      if (error) { errors++; continue; }
      await supabase.from('shift_registrations').upsert({
        user_id: userId,
        shift_date: pickerOpen.date,
        shift_slot: pickerOpen.shift,
        status: 'assigned',
        clock_in: defaults.clock_in,
        clock_out: defaults.clock_out,
      } as any, { onConflict: 'user_id,shift_date,shift_slot' });
    }

    // Remove deselected employees
    for (const userId of toRemove) {
      const { error } = await supabase.from('shifts')
        .delete()
        .eq('period_id', periodId)
        .eq('user_id', userId)
        .eq('shift_date', pickerOpen.date)
        .eq('shift_slot', pickerOpen.shift);
      if (error) { errors++; continue; }
      await supabase.from('shift_registrations')
        .delete()
        .eq('user_id', userId)
        .eq('shift_date', pickerOpen.date)
        .eq('shift_slot', pickerOpen.shift)
        .eq('status', 'assigned');
    }

    if (errors > 0) {
      toast.error(`Lỗi: ${errors} thao tác thất bại`);
    } else if (toAdd.length > 0 || toRemove.length > 0) {
      toast.success(`Đã cập nhật`);
    }

    // Update local state
    setDayShifts(prev => ({
      ...prev,
      [pickerOpen.date]: {
        ...prev[pickerOpen.date],
        [pickerOpen.shift]: serviceEmployees
          .filter(emp => selectedEmployees.has(emp.user_id))
          .map(emp => {
            const existing = currentSlots.find(s => s.user_id === emp.user_id);
            return {
              user_id: emp.user_id,
              full_name: emp.full_name,
              clock_in: existing?.clock_in || defaults.clock_in,
              clock_out: existing?.clock_out || defaults.clock_out,
            };
          }),
      },
    }));

    setPickerOpen(null);
  };

  const handleSaveEdit = async () => {
    if (!editSlot) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('shifts').upsert({
      period_id: periodId,
      user_id: editSlot.userId,
      shift_date: editSlot.date,
      shift_slot: editSlot.shift,
      is_active: true,
      clock_in: editClockIn || null,
      clock_out: editClockOut || null,
      notice: null,
      updated_by: user?.id,
    } as any, {
      onConflict: 'user_id,shift_date,shift_slot',
    });

    if (error) {
      toast.error(error.message);
      setEditSlot(null);
      return;
    }

    setDayShifts(prev => {
      const slots = prev[editSlot.date]?.[editSlot.shift] || [];
      return {
        ...prev,
        [editSlot.date]: {
          ...prev[editSlot.date],
          [editSlot.shift]: slots.map(s =>
            s.user_id === editSlot.userId
              ? { ...s, clock_in: editClockIn || null, clock_out: editClockOut || null }
              : s
          ),
        },
      };
    });

    toast.success("Đã cập nhật");
    setEditSlot(null);

    // Mirror to registrations
    await supabase.from('shift_registrations').upsert({
      user_id: editSlot.userId,
      shift_date: editSlot.date,
      shift_slot: editSlot.shift,
      status: 'assigned',
      clock_in: editClockIn || null,
      clock_out: editClockOut || null,
    } as any, { onConflict: 'user_id,shift_date,shift_slot' });
  };

  const handleDeleteSlot = async () => {
    if (!editSlot) return;

    const { error } = await supabase.from('shifts')
      .delete()
      .eq('period_id', periodId)
      .eq('user_id', editSlot.userId)
      .eq('shift_date', editSlot.date)
      .eq('shift_slot', editSlot.shift);

    if (error) {
      toast.error(error.message);
      return;
    }

    setDayShifts(prev => ({
      ...prev,
      [editSlot.date]: {
        ...prev[editSlot.date],
        [editSlot.shift]: (prev[editSlot.date]?.[editSlot.shift] || []).filter(s => s.user_id !== editSlot.userId),
      },
    }));

    toast.success("Đã xóa đăng ký");
    setEditSlot(null);

    await supabase.from('shift_registrations')
      .delete()
      .eq('user_id', editSlot.userId)
      .eq('shift_date', editSlot.date)
      .eq('shift_slot', editSlot.shift)
      .eq('status', 'assigned');
  };

  const handleRemoveSlot = async (date: string, shift: string, userId: string) => {
    const { error } = await supabase.from('shifts')
      .delete()
      .eq('period_id', periodId)
      .eq('user_id', userId)
      .eq('shift_date', date)
      .eq('shift_slot', shift);

    if (error) {
      toast.error(error.message);
      return;
    }

    setDayShifts(prev => {
      const current = prev[date]?.[shift] || [];
      return {
        ...prev,
        [date]: {
          ...prev[date],
          [shift]: current.filter(s => s.user_id !== userId),
        },
      };
    });

    toast.success("Đã xóa đăng ký");
    await supabase.from('shift_registrations')
      .delete()
      .eq('user_id', userId)
      .eq('shift_date', date)
      .eq('shift_slot', shift)
      .eq('status', 'assigned');
  };

  const toggleEmployee = (userId: string) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
  }

  const activeEmpName = activeEmployee
    ? serviceEmployees.find(e => e.user_id === activeEmployee)?.full_name
    : null;

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigateWeek(-1)} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={18} />
        </motion.button>
        <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          {weekLabel}
        </h2>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigateWeek(1)} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight size={18} />
        </motion.button>
      </div>

      {/* Employee chip bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {serviceEmployees.map(emp => {
          const isActive = activeEmployee === emp.user_id;
          const count = pendingCounts[emp.user_id] || 0;
          return (
            <motion.button
              key={emp.user_id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveEmployee(isActive ? null : emp.user_id)}
              className={`relative shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                isActive
                  ? 'gradient-gold text-primary-foreground border-transparent'
                  : 'bg-muted text-foreground border-border hover:bg-muted/80'
              }`}
            >
              {shortName(emp.full_name)}
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                  {count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Active employee indicator */}
      {activeEmployee && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Đang đăng ký cho</span>
          <span className="font-semibold text-foreground">{activeEmpName ? shortName(activeEmpName) : ''}</span>
          <button
            onClick={() => setActiveEmployee(null)}
            className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:text-foreground text-[10px]"
          >
            Hủy
          </button>
        </div>
      )}

      {/* Table */}
      <table className="table-fixed w-full text-xs border-collapse">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[42%]" />
          <col className="w-[42%]" />
        </colgroup>
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-card px-2 py-2 text-left font-semibold text-foreground border-b border-border">
              Ngày
            </th>
            <th className="px-2 py-2 text-center border-b border-border">
              <span className="inline-flex items-center gap-1.5 text-success">
                <Clock size={12} /> Sáng
              </span>
            </th>
            <th className="px-2 py-2 text-center border-b border-border">
              <span className="inline-flex items-center gap-1.5 text-accent">
                <Clock size={12} /> Chiều
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {weekDates.map((date, idx) => {
            const dateStr = date.toISOString().split('T')[0];
            const dayIndex = (date.getDay() + 6) % 7;
            const isWeekend = dayIndex >= 5;
            const moonLabel = getMoonLabel(date);
            const dayShiftsForDay = dayShifts[dateStr] || { morning: [], afternoon: [] };

            return (
              <tr key={dateStr} className="border-b border-border/30">
                <td className="sticky left-0 z-10 bg-card px-1 py-2 border-r border-border text-center">
                  <div className="flex flex-wrap items-baseline justify-center gap-x-1">
                    <span className={`text-base font-bold leading-none ${
                      isWeekend ? 'text-accent' : 'text-foreground'
                    }`}>{DAY_NAMES[dayIndex]}</span>
                    <span className="text-sm font-semibold text-foreground/50">{format(date, 'dd')}</span>
                  </div>
                  {moonLabel && (
                    <div className="text-[10px] text-primary font-medium mt-0.5 text-center">
                      {moonLabel === 'Full Moon' ? 'Rằm' :
                       moonLabel === 'New Moon' ? 'Mùng 1' :
                       moonLabel.startsWith('Chay') ? 'Ngày chay' :
                       moonLabel}
                    </div>
                  )}
                </td>

                <td className="px-2 py-2 border-r border-border/30">
                  <ShiftCell
                    dateStr={dateStr}
                    shiftKey="morning"
                    section={SHIFT_DEFAULTS.morning}
                    slots={dayShiftsForDay.morning}
                    activeEmployee={activeEmployee}
                    activeEmpName={activeEmpName}
                    onToggle={toggleEmployeeShift}
                    onPick={() => setPickerOpen({ date: dateStr, shift: 'morning' })}
                  />
                </td>

                <td className="px-2 py-2">
                  <ShiftCell
                    dateStr={dateStr}
                    shiftKey="afternoon"
                    section={SHIFT_DEFAULTS.afternoon}
                    slots={dayShiftsForDay.afternoon}
                    activeEmployee={activeEmployee}
                    activeEmpName={activeEmpName}
                    onToggle={toggleEmployeeShift}
                    onPick={() => setPickerOpen({ date: dateStr, shift: 'afternoon' })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Multi-select picker */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleDone}
          />
          <motion.div
            ref={pickerRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-sm">
                Chọn nhân viên — {SHIFT_DEFAULTS[pickerOpen.shift].label}
              </h3>
              <button
                onClick={() => setPickerOpen(null)}
                className="p-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
              {serviceEmployees.map(emp => {
                const isSelected = selectedEmployees.has(emp.user_id);
                return (
                  <button
                    key={emp.user_id}
                    type="button"
                    onClick={() => toggleEmployee(emp.user_id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between ${
                      isSelected
                        ? 'gradient-gold text-primary-foreground'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span className="font-medium truncate">{shortName(emp.full_name)}</span>
                    {isSelected && <Check size={16} />}
                  </button>
                );
              })}
              {serviceEmployees.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Không có nhân viên service
                </div>
              )}
            </div>

            <div className="border-t border-border px-4 py-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleDone}
                disabled={selectedEmployees.size === 0}
                className={`w-full py-2.5 rounded-xl font-display font-semibold text-sm transition-opacity ${
                  selectedEmployees.size === 0
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'gradient-gold text-primary-foreground'
                }`}
              >
                Done{selectedEmployees.size > 0 ? ` (${selectedEmployees.size})` : ''}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit popup */}
      {editSlot && (() => {
        const slot = dayShifts[editSlot.date]?.[editSlot.shift]?.find(s => s.user_id === editSlot.userId);
        const empName = slot?.full_name || serviceEmployees.find(e => e.user_id === editSlot.userId)?.full_name || '';
        const section = SHIFT_DEFAULTS[editSlot.shift];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setEditSlot(null)}
            />
            <motion.div
              ref={editRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-display font-semibold text-foreground text-sm truncate pr-2">
                  {empName} — {section.label}
                </h3>
                <button
                  onClick={() => setEditSlot(null)}
                  className="p-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="relative w-full h-[58px]">
                  <div className="absolute left-0 w-[38%]">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Giờ vào</label>
                    <input
                      type="time"
                      value={editClockIn}
                      onChange={e => setEditClockIn(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <span className="absolute left-[38%] right-[38%] text-center text-muted-foreground text-sm leading-[58px]">–</span>
                  <div className="absolute right-0 w-[38%]">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Giờ ra</label>
                    <input
                      type="time"
                      value={editClockOut}
                      onChange={e => setEditClockOut(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDeleteSlot}
                    className="px-4 py-2.5 rounded-xl bg-destructive/10 text-destructive font-display font-semibold text-sm flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    Xóa
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSaveEdit}
                    className="flex-1 py-2.5 rounded-xl gradient-gold text-primary-foreground font-display font-semibold text-sm"
                  >
                    Lưu
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
}

interface ShiftCellProps {
  dateStr: string;
  shiftKey: string;
  section: { clock_in: string; clock_out: string; label: string; color: string; bg: string; border: string };
  slots: ShiftSlot[];
  activeEmployee: string | null;
  activeEmpName: string | null;
  onToggle: (dateStr: string, shiftKey: string) => void;
  onPick: () => void;
}

function ShiftCell({ dateStr, shiftKey, section, slots, activeEmployee, activeEmpName, onToggle, onPick }: ShiftCellProps) {
  const handleClick = () => {
    if (activeEmployee) {
      onToggle(dateStr, shiftKey);
    } else {
      onPick();
    }
  };

  const activeOn = activeEmployee && slots.some(s => s.user_id === activeEmployee);
  const isEmpty = slots.length === 0 && !activeEmployee;

  // Blend: show all real chips + ghost chip for active employee if not already present
  const displaySlots = useMemo(() => {
    if (!activeEmployee) return slots;
    if (slots.some(s => s.user_id === activeEmployee)) return slots;
    return [...slots, { user_id: activeEmployee, full_name: activeEmpName || '', clock_in: null, clock_out: null, ghost: true } as any];
  }, [slots, activeEmployee, activeEmpName]);

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type="button"
      onClick={handleClick}
      className={`w-full rounded-xl border-2 transition-colors p-1.5 ${
        activeEmployee
          ? activeOn
            ? 'border-success/40 bg-success/5'
            : 'border-dashed border-border/30 hover:border-border/60'
          : !isEmpty
            ? 'border-border/30 hover:border-primary/40'
            : 'border-dashed border-border/30 hover:border-primary/40'
      }`}
    >
      {isEmpty ? (
        <div className="flex items-center justify-center gap-1 py-2 text-[10px] text-muted-foreground">
          <Plus size={12} />
          <span>Thêm người</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1 items-center">
          {displaySlots.map((slot: any) => {
            const isActiveChip = activeEmployee && slot.user_id === activeEmployee;
            return (
              <span
                key={slot.user_id + (slot.ghost ? '-g' : '')}
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  isActiveChip
                    ? slot.ghost
                      ? 'invisible'
                      : 'gradient-gold text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {shortName(slot.full_name)}
              </span>
            );
          })}
          {activeEmployee && (
            activeOn
              ? <Check size={12} className="text-success shrink-0 ml-auto" />
              : <Plus size={12} className="text-muted-foreground/30 shrink-0 ml-auto" />
          )}
        </div>
      )}
    </motion.button>
  );
}
