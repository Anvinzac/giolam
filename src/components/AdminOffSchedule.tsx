import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, ChevronLeft, ChevronRight, UserX, Eye, Pencil } from 'lucide-react';
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
const SLOTS: OffShiftSlot[] = ['noon', 'evening'];

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(d.getDate() + n);
  return next;
}

function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

function offKey(dateStr: string, slot: OffShiftSlot): string {
  return `${dateStr}:${slot}`;
}

function moonShortLabel(date: Date): string {
  const moonLabel = getMoonLabel(date);
  if (moonLabel === 'Full Moon') return 'Rằm';
  if (moonLabel === 'New Moon') return 'Mùng 1';
  if (moonLabel?.startsWith('Chay')) return 'Chay';
  return moonLabel || '';
}

export default function AdminOffSchedule({ readOnly = false }: Props) {
  const today = useMemo(() => getVietnamToday(), []);
  const todayStr = formatLocalDate(today);
  const rangeStartMonday = useMemo(() => mondayOf(parseLocalDate(RANGE_START)), []);

  const [previewAsEmployee, setPreviewAsEmployee] = useState(false);
  const showEmployeeView = readOnly || previewAsEmployee;

  // —— shared data ——
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [offByKey, setOffByKey] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // —— admin editor state ——
  const [weekStart, setWeekStart] = useState(() => mondayOf(getVietnamToday()));
  const [selectedDate, setSelectedDate] = useState(() =>
    todayStr >= RANGE_START ? todayStr : RANGE_START,
  );
  const [selectedSlot, setSelectedSlot] = useState<OffShiftSlot>('noon');

  // —— employee view: weeks from range start through next week ——
  const employeeWeekStarts = useMemo(() => {
    const current = mondayOf(today);
    const end = addDays(current, 7);
    const weeks: Date[] = [];
    let m = new Date(rangeStartMonday);
    while (m <= end) {
      weeks.push(new Date(m));
      m = addDays(m, 7);
    }
    if (weeks.length < 2) {
      weeks.push(addDays(weeks[weeks.length - 1] || current, 7));
    }
    return weeks;
  }, [today, rangeStartMonday]);

  const adminWeekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const adminWeekLabel = useMemo(() => {
    const start = adminWeekDates[0];
    const end = adminWeekDates[6];
    return `${format(start, 'dd/MM')} – ${format(end, 'dd/MM')}`;
  }, [adminWeekDates]);

  const dataRangeStart = showEmployeeView
    ? formatLocalDate(employeeWeekStarts[0])
    : formatLocalDate(adminWeekDates[0]);
  const dataRangeEnd = showEmployeeView
    ? formatLocalDate(addDays(employeeWeekStarts[employeeWeekStarts.length - 1], 6))
    : formatLocalDate(adminWeekDates[6]);

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
          .gte('off_date', dataRangeStart)
          .lte('off_date', dataRangeEnd),
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
  }, [dataRangeStart, dataRangeEnd]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showEmployeeView) return;
    const inWeek = adminWeekDates.some(d => formatLocalDate(d) === selectedDate);
    if (inWeek) return;
    const firstInRange = adminWeekDates.find(d => formatLocalDate(d) >= RANGE_START);
    setSelectedDate(formatLocalDate(firstInRange || adminWeekDates[0]));
  }, [adminWeekDates, selectedDate, showEmployeeView]);

  const selectedKey = offKey(selectedDate, selectedSlot);
  const selectedOff = offByKey[selectedKey] || [];
  const selectedOffSet = useMemo(() => new Set(selectedOff), [selectedOff]);
  const canEdit = !readOnly && !previewAsEmployee && selectedDate >= RANGE_START;

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
      {!readOnly && (
        <div className="flex bg-muted rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => setPreviewAsEmployee(false)}
            className={`flex-1 py-1.5 text-[11px] font-medium rounded-[10px] transition-colors flex items-center justify-center gap-1.5 ${
              !previewAsEmployee ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Pencil size={12} />
            Chỉnh sửa
          </button>
          <button
            type="button"
            onClick={() => setPreviewAsEmployee(true)}
            className={`flex-1 py-1.5 text-[11px] font-medium rounded-[10px] transition-colors flex items-center justify-center gap-1.5 ${
              previewAsEmployee ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Eye size={12} />
            Xem như NV
          </button>
        </div>
      )}

      {showEmployeeView ? (
        <EmployeeOffTwoWeeks
          weekStarts={employeeWeekStarts}
          today={today}
          todayStr={todayStr}
          offByKey={offByKey}
          nameById={nameById}
        />
      ) : (
        <>
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
              Lịch nghỉ bếp {adminWeekLabel}
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
            Chọn ngày (từ 24/08) và ca, rồi chạm tên nhân viên nghỉ.
          </p>

          <div className="flex gap-2 items-stretch min-h-[420px]">
            <div className="w-[32%] shrink-0 space-y-1.5">
              {adminWeekDates.map(date => {
                const dateStr = formatLocalDate(date);
                const dayIndex = (date.getDay() + 6) % 7;
                const isWeekend = dayIndex >= 5;
                const beforeRange = dateStr < RANGE_START;
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const { noon, evening, total } = dayOffSummary(dateStr);
                const moonShort = moonShortLabel(date);

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
                        : 'Ngoài khoảng lịch'}
                    </p>
                  </div>
                  <UserX size={16} className="text-destructive/70 shrink-0" />
                </div>

                <div className="flex bg-muted rounded-lg p-0.5">
                  {SLOTS.map(slot => {
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
        </>
      )}
    </div>
  );
}

function weekTitle(monday: Date, currentMonday: Date): string {
  const t = monday.getTime();
  if (t === currentMonday.getTime()) return 'Tuần này';
  if (t === addDays(currentMonday, 7).getTime()) return 'Tuần sau';
  return 'Tuần trước';
}

function EmployeeDayCell({
  date,
  todayStr,
  offByKey,
  nameById,
}: {
  date: Date;
  todayStr: string;
  offByKey: Record<string, string[]>;
  nameById: Map<string, string>;
}) {
  const dateStr = formatLocalDate(date);
  const dayIndex = (date.getDay() + 6) % 7;
  const isWeekend = dayIndex >= 5;
  const beforeRange = dateStr < RANGE_START;
  const isToday = dateStr === todayStr;
  const moon = moonShortLabel(date);
  const notice = isToday ? 'Hôm nay' : moon;

  return (
    <div
      className={`h-full rounded-xl border px-2.5 py-2.5 flex flex-col ${
        beforeRange
          ? 'opacity-40 border-transparent bg-muted/30'
          : isToday
            ? 'border-primary/40 bg-primary/5'
            : 'border-border/50 bg-card'
      }`}
    >
      <div className="flex items-baseline justify-between gap-1 mb-1.5 min-w-0">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className={`text-sm font-bold shrink-0 ${isWeekend ? 'text-accent' : 'text-foreground'}`}>
            {DAY_NAMES[dayIndex]}
          </span>
          {notice ? (
            <span className="text-[10px] text-primary truncate">{notice}</span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {format(date, 'dd/MM')}
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border/60 flex-1">
        {SLOTS.map((slot) => {
          const ids = offByKey[offKey(dateStr, slot)] || [];
          return (
            <div
              key={slot}
              className="px-1.5 first:pl-0 last:pr-0 flex flex-col min-w-0"
            >
              <span className="text-[11px] font-semibold text-muted-foreground mb-1">
                {SLOT_LABEL[slot]}
              </span>
              {ids.length === 0 ? (
                <span className="text-xs text-muted-foreground/35">—</span>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {ids.map(id => {
                    const full = nameById.get(id) || '?';
                    const display = /^(chị|anh|cô)\s/i.test(full.trim())
                      ? full.trim()
                      : `Bạn ${full.trim()}`;
                    return (
                      <span
                        key={id}
                        className="text-xs leading-snug text-destructive font-medium"
                        title={full}
                      >
                        {display}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmployeeWeekHeader({
  monday,
  currentMonday,
}: {
  monday: Date;
  currentMonday: Date;
}) {
  return (
    <div className="h-full px-1 box-border flex">
      <div className="flex-1 px-3 py-2.5 rounded-xl bg-muted/60 min-w-0 flex items-center">
        <p className="text-sm font-semibold text-foreground truncate leading-none">
          {weekTitle(monday, currentMonday)}
        </p>
      </div>
    </div>
  );
}

function EmployeeOffTwoWeeks({
  weekStarts,
  today,
  todayStr,
  offByKey,
  nameById,
}: {
  weekStarts: Date[];
  today: Date;
  todayStr: string;
  offByKey: Record<string, string[]>;
  nameById: Map<string, string>;
}) {
  const currentMonday = useMemo(() => mondayOf(today), [today]);
  const maxStartIndex = Math.max(0, weekStarts.length - 2);

  const defaultStartIndex = useMemo(() => {
    const idx = weekStarts.findIndex(w => w.getTime() === currentMonday.getTime());
    if (idx < 0) return maxStartIndex;
    return Math.min(idx, maxStartIndex);
  }, [weekStarts, currentMonday, maxStartIndex]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [colWidth, setColWidth] = useState(0);
  const [startIndex, setStartIndex] = useState(defaultStartIndex);
  const didInitScroll = useRef(false);

  useEffect(() => {
    setStartIndex(defaultStartIndex);
    didInitScroll.current = false;
  }, [defaultStartIndex]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setColWidth(el.clientWidth / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || colWidth <= 0 || didInitScroll.current) return;
    el.scrollLeft = defaultStartIndex * colWidth;
    didInitScroll.current = true;
    setStartIndex(defaultStartIndex);
  }, [colWidth, defaultStartIndex]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || colWidth <= 0) return;
    const maxLeft = maxStartIndex * colWidth;
    if (el.scrollLeft > maxLeft) el.scrollLeft = maxLeft;
    const idx = Math.round(el.scrollLeft / colWidth);
    setStartIndex(Math.max(0, Math.min(maxStartIndex, idx)));
  };

  const scrollToIndex = (idx: number) => {
    const el = scrollerRef.current;
    if (!el || colWidth <= 0) return;
    const clamped = Math.max(0, Math.min(maxStartIndex, idx));
    el.scrollTo({ left: clamped * colWidth, behavior: 'smooth' });
  };

  const leftMonday = weekStarts[startIndex] || weekStarts[0];
  const rightMonday = weekStarts[Math.min(startIndex + 1, weekStarts.length - 1)] || leftMonday;
  const leftDates = getWeekDates(leftMonday);
  const rightDates = getWeekDates(rightMonday);
  const rangeLabel = `${format(leftDates[0], 'dd/MM')} – ${format(rightDates[6], 'dd/MM')}`;

  // Flatten weeks into CSS grid columns so row N (same weekday) shares height.
  const gridItems = useMemo(() => {
    const items: ReactNode[] = [];
    weekStarts.forEach((monday) => {
      const dates = getWeekDates(monday);
      const weekKey = formatLocalDate(monday);
      items.push(
        <div key={`${weekKey}-head`} className="snap-start px-1 pb-2">
          <EmployeeWeekHeader monday={monday} currentMonday={currentMonday} />
        </div>,
      );
      dates.forEach((date, dayIndex) => {
        items.push(
          <div key={`${weekKey}-d${dayIndex}`} className="px-1 pb-2 h-full">
            <EmployeeDayCell
              date={date}
              todayStr={todayStr}
              offByKey={offByKey}
              nameById={nameById}
            />
          </div>,
        );
      });
    });
    return items;
  }, [weekStarts, currentMonday, todayStr, offByKey, nameById]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 className="font-display font-semibold text-sm flex items-center gap-2 min-w-0">
          <Calendar size={16} className="text-primary shrink-0" />
          <span className="truncate">Lịch nghỉ bếp · {rangeLabel}</span>
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          {Array.from({ length: maxStartIndex + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Khung tuần ${i + 1}`}
              onClick={() => scrollToIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === startIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground px-0.5">
        Vuốt ngang từng cột tuần (từ 24/08) · mặc định tuần này + tuần sau.
      </p>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="overflow-x-auto overscroll-x-contain snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          className="grid"
          style={{
            gridTemplateRows: 'auto repeat(7, auto)',
            gridAutoFlow: 'column',
            gridAutoColumns: colWidth > 0 ? `${colWidth}px` : '50%',
            width: colWidth > 0 ? colWidth * weekStarts.length : `${weekStarts.length * 50}%`,
          }}
        >
          {gridItems}
        </div>
      </div>
    </div>
  );
}
