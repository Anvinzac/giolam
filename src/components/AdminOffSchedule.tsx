import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, ChevronLeft, ChevronRight, UserX } from 'lucide-react';
import { getWeekDates, getMoonLabel, getVietnamToday } from '@/lib/lunarUtils';
import { formatLocalDate } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

export type OffShiftSlot = 'noon' | 'evening';

interface Employee {
  user_id: string;
  full_name: string;
}

interface Props {
  /** Kitchen employees view the board read-only; admin can toggle. */
  readOnly?: boolean;
}

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const KITCHEN_DEPT_ID = 'd0000000-0000-0000-0000-000000000001';
/** Earliest date shown / editable for Kitchen off schedule. */
const RANGE_START = '2026-08-24';
const HIDDEN = new Set([
  'test_loaia', 'test_loaib', 'test_loaic',
  'nv_basic', 'nv_overtime', 'nv_notice',
  'nhanvien_a', 'nhanvien_b', 'nhanvien_c',
  'nviena', 'nvienb', 'nvienc', 'nviend', 'cloan',
]);

const SLOT_LABEL: Record<OffShiftSlot, string> = {
  noon: 'Trưa',
  evening: 'Tối',
};

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

function offKey(dateStr: string, slot: OffShiftSlot): string {
  return `${dateStr}:${slot}`;
}

export default function AdminOffSchedule({ readOnly = false }: Props) {
  const today = useMemo(() => getVietnamToday(), []);
  const todayStr = formatLocalDate(today);
  const rangeStartMonday = useMemo(() => mondayOf(parseLocalDate(RANGE_START)), []);

  const [weekStart, setWeekStart] = useState(() => mondayOf(getVietnamToday()));
  const [selectedDate, setSelectedDate] = useState(() =>
    todayStr >= RANGE_START ? todayStr : RANGE_START,
  );
  const [selectedSlot, setSelectedSlot] = useState<OffShiftSlot>('noon');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [offByKey, setOffByKey] = useState<Record<string, string[]>>({});
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
      const [{ data: profiles }, { data: adminRoles }, { data: offs }] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, username, full_name, department_id')
          .eq('department_id', KITCHEN_DEPT_ID)
          .order('full_name'),
        supabase.from('user_roles').select('user_id').eq('role', 'admin'),
        supabase
          .from('employee_off_days')
          .select('user_id, off_date, shift_slot')
          .gte('off_date', weekStartStr)
          .lte('off_date', weekEndStr),
      ]);

      const adminIds = new Set((adminRoles || []).map(r => r.user_id));
      const list = ((profiles || []) as any[])
        .filter(p => !adminIds.has(p.user_id))
        .filter(p => !HIDDEN.has((p.username || '').toLowerCase()))
        .map(p => ({
          user_id: p.user_id as string,
          full_name: (p.full_name || 'Unnamed') as string,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));

      setEmployees(list);

      const map: Record<string, string[]> = {};
      for (const row of (offs || []) as { user_id: string; off_date: string; shift_slot: string }[]) {
        const slot = (row.shift_slot === 'evening' ? 'evening' : 'noon') as OffShiftSlot;
        const key = offKey(row.off_date, slot);
        if (!map[key]) map[key] = [];
        map[key].push(row.user_id);
      }
      setOffByKey(map);
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
    const firstInRange = weekDates.find(d => formatLocalDate(d) >= RANGE_START);
    setSelectedDate(formatLocalDate(firstInRange || weekDates[0]));
  }, [weekDates, selectedDate]);

  const selectedKey = offKey(selectedDate, selectedSlot);
  const selectedOff = offByKey[selectedKey] || [];
  const selectedOffSet = useMemo(() => new Set(selectedOff), [selectedOff]);
  const inRange = selectedDate >= RANGE_START;
  const canEdit = !readOnly && inRange;

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.user_id, e.full_name);
    return m;
  }, [employees]);

  const dayOffSummary = (dateStr: string) => {
    const noon = offByKey[offKey(dateStr, 'noon')] || [];
    const evening = offByKey[offKey(dateStr, 'evening')] || [];
    return { noon, evening, total: noon.length + evening.length };
  };

  const toggleOff = async (userId: string) => {
    if (!canEdit) return;
    if (savingId) return;

    const isOff = selectedOffSet.has(userId);
    setSavingId(userId);
    setOffByKey(prev => {
      const current = prev[selectedKey] || [];
      const next = isOff ? current.filter(id => id !== userId) : [...current, userId];
      return { ...prev, [selectedKey]: next };
    });

    try {
      if (isOff) {
        const { error } = await supabase
          .from('employee_off_days')
          .delete()
          .eq('user_id', userId)
          .eq('off_date', selectedDate)
          .eq('shift_slot', selectedSlot);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('employee_off_days').insert({
          user_id: userId,
          off_date: selectedDate,
          shift_slot: selectedSlot,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setOffByKey(prev => {
        const current = prev[selectedKey] || [];
        const next = isOff ? [...current, userId] : current.filter(id => id !== userId);
        return { ...prev, [selectedKey]: next };
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
      if (next < rangeStartMonday) return rangeStartMonday;
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
          disabled={weekStart.getTime() <= rangeStartMonday.getTime()}
          className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Tuần trước"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-display font-semibold text-sm flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          Lịch nghỉ bếp {weekLabel}
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
        {readOnly
          ? 'Xem ai nghỉ ca Trưa / Tối (từ 24/08).'
          : 'Chọn ngày (từ 24/08) và ca, rồi chạm tên nhân viên nghỉ.'}
      </p>

      <div className="flex gap-2 items-stretch min-h-[420px]">
        <div className="w-[32%] shrink-0 space-y-1.5">
          {weekDates.map(date => {
            const dateStr = formatLocalDate(date);
            const dayIndex = (date.getDay() + 6) % 7;
            const isWeekend = dayIndex >= 5;
            const beforeRange = dateStr < RANGE_START;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const { noon, evening, total } = dayOffSummary(dateStr);
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
                disabled={beforeRange}
                onClick={() => !beforeRange && setSelectedDate(dateStr)}
                className={`w-full text-left rounded-xl px-2.5 py-2 border transition-all ${
                  beforeRange
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
                  {total > 0 && (
                    <span className="text-[10px] font-semibold text-destructive tabular-nums shrink-0">
                      {total} nghỉ
                    </span>
                  )}
                </div>
                {(noon.length > 0 || evening.length > 0) && (
                  <div className="mt-1 space-y-0.5 text-[9px] text-muted-foreground leading-snug">
                    {noon.length > 0 && (
                      <div className="line-clamp-1">
                        <span className="text-foreground/70">Trưa:</span>{' '}
                        {noon.map(id => (nameById.get(id) || '?').split(' ').pop()).join(', ')}
                      </div>
                    )}
                    {evening.length > 0 && (
                      <div className="line-clamp-1">
                        <span className="text-foreground/70">Tối:</span>{' '}
                        {evening.map(id => (nameById.get(id) || '?').split(' ').pop()).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border/60 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  Nghỉ {DAY_NAMES[(parseLocalDate(selectedDate).getDay() + 6) % 7]}{' '}
                  {format(parseLocalDate(selectedDate), 'dd/MM')}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {canEdit
                    ? `${selectedOff.length} người · ca ${SLOT_LABEL[selectedSlot]}`
                    : readOnly
                      ? `Ca ${SLOT_LABEL[selectedSlot]} · chỉ xem`
                      : 'Ngoài khoảng lịch'}
                </p>
              </div>
              <UserX size={16} className="text-destructive/70 shrink-0" />
            </div>

            <div className="flex bg-muted rounded-lg p-0.5">
              {(['noon', 'evening'] as OffShiftSlot[]).map(slot => {
                const count = (offByKey[offKey(selectedDate, slot)] || []).length;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                      selectedSlot === slot
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {SLOT_LABEL[slot]}
                    {count > 0 ? ` (${count})` : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {employees.map(emp => {
              const isOff = selectedOffSet.has(emp.user_id);
              const busy = savingId === emp.user_id;
              return (
                <motion.button
                  key={emp.user_id}
                  type="button"
                  whileTap={canEdit ? { scale: 0.98 } : undefined}
                  disabled={!canEdit || busy}
                  onClick={() => toggleOff(emp.user_id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isOff
                      ? 'bg-destructive/12 border border-destructive/30 text-destructive'
                      : 'bg-muted/40 border border-transparent text-foreground hover:bg-muted/70'
                  } ${!canEdit ? 'opacity-70 cursor-default' : ''}`}
                >
                  <span className="block text-sm font-semibold truncate">{emp.full_name}</span>
                  <span className={`text-[10px] font-semibold shrink-0 ${isOff ? 'text-destructive' : 'text-muted-foreground/50'}`}>
                    {isOff ? 'Nghỉ' : 'Làm'}
                  </span>
                </motion.button>
              );
            })}
            {employees.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">Chưa có nhân viên bếp</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
