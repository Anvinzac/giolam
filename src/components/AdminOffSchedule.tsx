import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, ChevronLeft, ChevronRight, UserX } from 'lucide-react';
import { getWeekDates, getMoonLabel, getVietnamToday } from '@/lib/lunarUtils';
import { formatLocalDate } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Employee {
  user_id: string;
  full_name: string;
  department_name?: string | null;
}

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const HIDDEN = new Set(['test_loaia', 'test_loaib', 'test_loaic', 'nv_overtime', 'nv_notice', 'nvienb', 'nhanvien_b', 'nhanvien_c']);

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() + diff);
  return monday;
}

export default function AdminOffSchedule() {
  const today = useMemo(() => getVietnamToday(), []);
  const todayStr = formatLocalDate(today);

  const [weekStart, setWeekStart] = useState(() => mondayOf(getVietnamToday()));
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [offByDate, setOffByDate] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    return `${format(start, 'dd/MM')} – ${format(end, 'dd/MM')}`;
  }, [weekDates]);

  const weekStartStr = formatLocalDate(weekDates[0]);
  const weekEndStr = formatLocalDate(weekDates[6]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: depts }, { data: adminRoles }, { data: offs }] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, username, full_name, department_id, include_in_shift_register')
          .order('full_name'),
        supabase.from('departments').select('id, name'),
        supabase.from('user_roles').select('user_id').eq('role', 'admin'),
        supabase
          .from('employee_off_days')
          .select('user_id, off_date')
          .gte('off_date', weekStartStr)
          .lte('off_date', weekEndStr),
      ]);

      const adminIds = new Set((adminRoles || []).map(r => r.user_id));
      const deptName = new Map((depts || []).map(d => [d.id, d.name]));
      const list = ((profiles || []) as any[])
        .filter(p => !adminIds.has(p.user_id))
        .filter(p => !HIDDEN.has((p.username || '').toLowerCase()))
        .filter(p => p.include_in_shift_register !== false)
        .map(p => ({
          user_id: p.user_id as string,
          full_name: (p.full_name || 'Unnamed') as string,
          department_name: p.department_id ? deptName.get(p.department_id) || null : null,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));

      setEmployees(list);

      const map: Record<string, string[]> = {};
      for (const row of (offs || []) as { user_id: string; off_date: string }[]) {
        if (!map[row.off_date]) map[row.off_date] = [];
        map[row.off_date].push(row.user_id);
      }
      setOffByDate(map);
    } catch (err) {
      console.error(err);
      toast.error('Không tải được lịch nghỉ');
    } finally {
      setLoading(false);
    }
  }, [weekStartStr, weekEndStr]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep selected date inside the visible week when navigating.
  useEffect(() => {
    const inWeek = weekDates.some(d => formatLocalDate(d) === selectedDate);
    if (inWeek) return;
    const firstSelectable = weekDates.find(d => formatLocalDate(d) >= todayStr);
    setSelectedDate(formatLocalDate(firstSelectable || weekDates[0]));
  }, [weekDates, selectedDate, todayStr]);

  const selectedOff = offByDate[selectedDate] || [];
  const selectedOffSet = useMemo(() => new Set(selectedOff), [selectedOff]);
  const canEditSelected = selectedDate >= todayStr;

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.user_id, e.full_name);
    return m;
  }, [employees]);

  const toggleOff = async (userId: string) => {
    if (!canEditSelected) {
      toast.info('Chỉ đánh dấu nghỉ từ hôm nay trở đi');
      return;
    }
    if (savingId) return;

    const isOff = selectedOffSet.has(userId);
    setSavingId(userId);
    setOffByDate(prev => {
      const current = prev[selectedDate] || [];
      const next = isOff ? current.filter(id => id !== userId) : [...current, userId];
      return { ...prev, [selectedDate]: next };
    });

    try {
      if (isOff) {
        const { error } = await supabase
          .from('employee_off_days')
          .delete()
          .eq('user_id', userId)
          .eq('off_date', selectedDate);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('employee_off_days').insert({
          user_id: userId,
          off_date: selectedDate,
          created_by: user?.id ?? null,
        } as any);
        if (error) throw error;
      }
    } catch (err: any) {
      // Revert optimistic update
      setOffByDate(prev => {
        const current = prev[selectedDate] || [];
        const next = isOff ? [...current, userId] : current.filter(id => id !== userId);
        return { ...prev, [selectedDate]: next };
      });
      toast.error(err?.message || 'Không lưu được');
    } finally {
      setSavingId(null);
    }
  };

  const navigateWeek = (dir: number) => {
    setWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7 * dir);
      // Don't allow navigating entirely before current week
      const currentMonday = mondayOf(today);
      if (next < currentMonday) return currentMonday;
      return next;
    });
  };

  if (loading && employees.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateWeek(-1)}
          className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground"
          aria-label="Tuần trước"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-display font-semibold text-sm flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          Lịch nghỉ {weekLabel}
        </h2>
        <button
          type="button"
          onClick={() => navigateWeek(1)}
          className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground"
          aria-label="Tuần sau"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground px-0.5">
        Chọn ngày (hôm nay trở đi), rồi chạm tên nhân viên nghỉ ngày đó.
      </p>

      <div className="flex gap-2 items-stretch min-h-[420px]">
        {/* Left: week days (~32%) */}
        <div className="w-[32%] shrink-0 space-y-1.5">
          {weekDates.map(date => {
            const dateStr = formatLocalDate(date);
            const dayIndex = (date.getDay() + 6) % 7;
            const isWeekend = dayIndex >= 5;
            const isPast = dateStr < todayStr;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const offIds = offByDate[dateStr] || [];
            const moonLabel = getMoonLabel(date);
            const moonShort =
              moonLabel === 'Full Moon' ? 'Rằm'
              : moonLabel === 'New Moon' ? 'Mùng 1'
              : moonLabel?.startsWith('Chay') ? 'Chay'
              : moonLabel;

            return (
              <button
                key={dateStr}
                type="button"
                disabled={isPast}
                onClick={() => !isPast && setSelectedDate(dateStr)}
                className={`w-full text-left rounded-xl px-2.5 py-2 border transition-all ${
                  isPast
                    ? 'opacity-40 cursor-not-allowed border-transparent bg-muted/30'
                    : isSelected
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border/50 bg-card hover:border-primary/30'
                }`}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className={`text-sm font-bold ${isWeekend ? 'text-accent' : 'text-foreground'}`}>
                    {DAY_NAMES[dayIndex]}
                  </span>
                  <span className="text-xs text-muted-foreground">{format(date, 'dd/MM')}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5 gap-1">
                  <span className="text-[10px] text-primary truncate">
                    {isToday ? 'Hôm nay' : (moonShort || '')}
                  </span>
                  {offIds.length > 0 && (
                    <span className="text-[10px] font-semibold text-destructive tabular-nums shrink-0">
                      {offIds.length} nghỉ
                    </span>
                  )}
                </div>
                {offIds.length > 0 && (
                  <div className="mt-1 text-[9px] text-muted-foreground leading-snug line-clamp-2">
                    {offIds.map(id => (nameById.get(id) || '?').split(' ').pop()).join(', ')}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: employee picker (~68%) */}
        <div className="flex-1 min-w-0 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                Nghỉ {DAY_NAMES[(new Date(selectedDate + 'T12:00:00').getDay() + 6) % 7]} {format(new Date(selectedDate + 'T12:00:00'), 'dd/MM')}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {canEditSelected
                  ? `${selectedOff.length} người đã chọn`
                  : 'Chỉ xem — ngày đã qua'}
              </p>
            </div>
            <UserX size={16} className="text-destructive/70 shrink-0" />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {employees.map(emp => {
              const isOff = selectedOffSet.has(emp.user_id);
              const busy = savingId === emp.user_id;
              return (
                <motion.button
                  key={emp.user_id}
                  type="button"
                  whileTap={canEditSelected ? { scale: 0.98 } : undefined}
                  disabled={!canEditSelected || busy}
                  onClick={() => toggleOff(emp.user_id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isOff
                      ? 'bg-destructive/12 border border-destructive/30 text-destructive'
                      : 'bg-muted/40 border border-transparent text-foreground hover:bg-muted/70'
                  } ${!canEditSelected ? 'opacity-60 cursor-default' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold truncate">{emp.full_name}</span>
                    {emp.department_name && (
                      <span className="block text-[10px] text-muted-foreground truncate">
                        {emp.department_name}
                      </span>
                    )}
                  </span>
                  <span className={`text-[10px] font-semibold shrink-0 ${isOff ? 'text-destructive' : 'text-muted-foreground/50'}`}>
                    {isOff ? 'Nghỉ' : 'Làm'}
                  </span>
                </motion.button>
              );
            })}
            {employees.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">Chưa có nhân viên</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
