import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, LogOut, DollarSign, Users, Table2, ChevronLeft, Sun, Moon, Upload } from 'lucide-react';
import { toast } from 'sonner';
import GlobalRateTable from '@/components/salary/GlobalRateTable';
import SalaryTableTypeA from '@/components/salary/SalaryTableTypeA';
import SalaryTableTypeB from '@/components/salary/SalaryTableTypeB';
import SalaryTableTypeC from '@/components/salary/SalaryTableTypeC';
import PublishButton from '@/components/salary/PublishButton';
import PendingReviewBadge from '@/components/salary/PendingReviewBadge';
import { useSpecialDayRates } from '@/hooks/useSpecialDayRates';
import { useEmployeeAllowances } from '@/hooks/useEmployeeAllowances';
import { useSalaryEntries } from '@/hooks/useSalaryEntries';
import { useSalaryRecord } from '@/hooks/useSalaryRecord';
import { calcDailyBase, calcHoursFromTimes, computeTotalSalaryTypeA, computeTotalSalaryTypeB, computeTotalSalaryTypeC, computeTotalSalaryTypeD, formatVND, formatDateViet } from '@/lib/salaryCalculations';
import { generateDateRange } from '@/lib/salaryPaging';
import { EmployeeShiftType, EMPLOYEE_TYPE_LABELS, SalaryBreakdown } from '@/types/salary';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';
import AnalogClock from '@/components/AnalogClock';
import CSVImportModal, { ParsedRow } from '@/components/salary/CSVImportModal';

interface Employee {
  user_id: string;
  full_name: string;
  username?: string | null;
  shift_type: EmployeeShiftType;
  base_salary: number;
  hourly_rate: number;
  default_clock_in: string | null;
  default_clock_out: string | null;
  department_id: string | null;
  department_name?: string;
}

interface Period {
  id: string;
  start_date: string;
  end_date: string;
  off_days: string[];
}

const TEMP_HIDDEN_TEST_USERNAMES = new Set(['test_loaia', 'test_loaib', 'test_loaic']);

// Department-based employee pages component
interface DepartmentEmployeePagesProps {
  employees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
  typeBadgeColor: (t: EmployeeShiftType) => string;
  pendingCounts?: Map<string, number>;
}

function DepartmentEmployeePages({ employees, onSelectEmployee, typeBadgeColor, pendingCounts }: DepartmentEmployeePagesProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);

  const departments = useMemo(() => {
    const kitchen = employees.filter(e =>
      e.department_name?.toLowerCase().includes('kitchen') ||
      e.department_name?.toLowerCase().includes('bếp') ||
      e.department_id === 'd0000000-0000-0000-0000-000000000001'
    );
    const service = employees.filter(e =>
      e.department_name?.toLowerCase().includes('service') ||
      e.department_name?.toLowerCase().includes('phục vụ') ||
      e.department_name?.toLowerCase().includes('reception') ||
      e.department_id === 'd0000000-0000-0000-0000-000000000002'
    );
    const other = employees.filter(e => !kitchen.includes(e) && !service.includes(e));

    return [
      { name: 'Kitchen', label: 'Bếp', employees: kitchen },
      { name: 'Service', label: 'Phục vụ', employees: service },
      { name: 'Other', label: 'Khác', employees: other },
    ].filter(dept => dept.employees.length > 0);
  }, [employees]);

  const goTo = (idx: number) => setCurrentPage(Math.max(0, Math.min(departments.length - 1, idx)));

  if (departments.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground text-sm">
        Chưa có nhân viên
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Department tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {departments.map((dept, idx) => (
          <button
            key={dept.name}
            onClick={() => goTo(idx)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              currentPage === idx
                ? 'gradient-gold text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {dept.label} ({dept.employees.length})
          </button>
        ))}
      </div>

      {/* Swipeable employee list */}
      <div
        className="overflow-hidden"
        onTouchStart={e => setDragStartX(e.touches[0].clientX)}
        onTouchEnd={e => {
          const delta = dragStartX - e.changedTouches[0].clientX;
          if (Math.abs(delta) > 50) goTo(currentPage + (delta > 0 ? 1 : -1));
        }}
      >
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, x: currentPage === 0 ? 0 : 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="space-y-2"
        >
          {departments[currentPage].employees.map(emp => (
            <motion.button
              key={emp.user_id}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectEmployee(emp)}
              className="w-full glass-card p-3 flex items-center justify-between text-left"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{emp.full_name}</p>
                  <PendingReviewBadge count={pendingCounts?.get(emp.user_id) || 0} variant="dot" />
                </div>
                {emp.department_name && (
                  <p className="text-[10px] text-muted-foreground">{emp.department_name}</p>
                )}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadgeColor(emp.shift_type)}`}>
                {EMPLOYEE_TYPE_LABELS[emp.shift_type]}
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Indicator dots */}
      {departments.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-1">
          {departments.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentPage === idx ? 'bg-primary w-6' : 'bg-muted-foreground/30 w-2'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const EditableAmount = ({
  label,
  value,
  onChange,
  isPreview,
  suffix = '',
  className = '',
}: {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  isPreview: boolean;
  suffix?: string;
  className?: string;
}) => {
  const [editing, setEditing] = useState(false);
  // Always produce a clean integer (no decimal) so save() never strips a dot mid-number.
  // Values stored without the ×1000 convention (e.g. 4350 instead of 4_350_000) round
  // to the nearest thousand-unit so the editor stays consistent.
  const toShort = (v: number) => v === 0 ? '' : Math.round(v / 1000).toString();
  const [rawInput, setRawInput] = useState(() => toShort(value));

  useEffect(() => {
    setRawInput(toShort(value));
  }, [value]);

  const fmtDot = (n: number) => n.toLocaleString('vi-VN');
  const num = rawInput ? parseInt(rawInput, 10) : 0;
  const typedFormatted = num > 0 ? fmtDot(num) : '';
  const ghostFormatted = num > 0 ? '.000' : '000';

  const save = () => {
    const cleaned = rawInput.replace(/\D/g, '');
    let parsed = cleaned === '' ? 0 : parseInt(cleaned, 10);
    if (parsed > 0) parsed = parsed * 1000;
    if (!isNaN(parsed) && parsed !== value) onChange(parsed);
    setEditing(false);
  };

  // Always render as flex-col to preserve the grid cell shape when editing
  return (
    <div className={`flex flex-col ${className}`}>
      {label && <span className="text-[11px] text-muted-foreground mb-0.5">{label}</span>}
      {editing && !isPreview ? (
        <>
          <div className="flex items-center rounded border border-primary/60 bg-background relative overflow-hidden">
            <input
              value={rawInput}
              onChange={e => setRawInput(e.target.value.replace(/\D/g, ''))}
              className="absolute inset-0 opacity-0 text-[16px] w-full"
              inputMode="numeric"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && save()}
            />
            <span className="text-[15px] font-bold text-foreground pointer-events-none px-2 py-0.5">{typedFormatted}</span>
            <span className="text-[15px] font-bold text-muted-foreground/40 pointer-events-none">{ghostFormatted}</span>
          </div>
          <div className="flex gap-1.5 mt-1.5">
            <button onClick={save} className="flex-1 text-[12px] py-1 rounded gradient-gold text-primary-foreground font-semibold">OK</button>
            <button onClick={() => setEditing(false)} className="text-[12px] py-1 px-2 rounded bg-muted text-muted-foreground">Hủy</button>
          </div>
        </>
      ) : (
        <button
          onClick={() => !isPreview && setEditing(true)}
          className={`text-[15px] font-bold text-accent text-left ${!isPreview ? 'hover:underline' : 'cursor-default'}`}
        >
          {formatVND(value).replace(' đ', '')}{suffix}
        </button>
      )}
    </div>
  );
};

export default function SalaryAdmin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<'rates' | 'employees'>('employees');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const { isLight, toggle: toggleTheme } = useTheme();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [globalClockIn, setGlobalClockIn] = useState<string>('17:00');
  const [pickingGlobalClockIn, setPickingGlobalClockIn] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showShiftTypePicker, setShowShiftTypePicker] = useState(false);
  const [salaryColumnsAvailable, setSalaryColumnsAvailable] = useState(true);
  const [adminUid, setAdminUid] = useState<string | null>(null);
  const [pendingCounts, setPendingCounts] = useState<Map<string, number>>(new Map());

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId) || null;

  // Hooks for selected employee
  const { rates, updateRate, addRate, removeRate } = useSpecialDayRates(
    selectedPeriodId,
    selectedPeriod?.start_date,
    selectedPeriod?.end_date,
    selectedPeriod?.off_days || []
  );
  const { allowances, toggleAllowance, updateAllowance, addAllowance } = useEmployeeAllowances(
    selectedEmployee?.user_id || null,
    selectedPeriodId
  );
  const { entries, updateEntry, addDuplicateRow, addRowAtDate, moveEntryToDate, removeEntry, acceptEntry, isSaving } = useSalaryEntries(
    selectedEmployee?.user_id || null,
    selectedPeriodId,
    { editorMode: 'admin', enableRealtime: true }
  );
  const { record, saveDraft, publish, isPublished } = useSalaryRecord(
    selectedEmployee?.user_id || null,
    selectedPeriodId
  );

  // Fetch pending-review counts per employee for the selected period.
  const refreshPendingCounts = useCallback(async () => {
    if (!selectedPeriodId) { setPendingCounts(new Map()); return; }
    const { data, error } = await supabase
      .from('salary_entries')
      .select('user_id')
      .eq('period_id', selectedPeriodId)
      .eq('is_admin_reviewed', false);
    if (error) { console.error('Pending count fetch failed:', error); return; }
    const map = new Map<string, number>();
    for (const row of (data || []) as { user_id: string }[]) {
      map.set(row.user_id, (map.get(row.user_id) || 0) + 1);
    }
    setPendingCounts(map);
  }, [selectedPeriodId]);

  useEffect(() => { refreshPendingCounts(); }, [refreshPendingCounts]);

  // Realtime: when any salary_entries row in this period changes, refresh counts.
  useEffect(() => {
    if (!selectedPeriodId) return;
    const channel = supabase
      .channel(`pending-counts:${selectedPeriodId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'salary_entries',
          filter: `period_id=eq.${selectedPeriodId}`,
        },
        () => { refreshPendingCounts(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedPeriodId, refreshPendingCounts]);

  // Sync global clock-in
  useEffect(() => {
    if (selectedEmployee) {
      const raw = selectedEmployee.default_clock_in || '17:00';
      // Strip seconds if present (HH:MM:SS -> HH:MM)
      const time = raw.length > 5 ? raw.slice(0, 5) : raw;
      setGlobalClockIn(time);
    }
  }, [selectedEmployee]);

  // Compute breakdown
  const breakdown = useMemo<SalaryBreakdown | null>(() => {
    if (!selectedEmployee || entries.length === 0) return null;
    switch (selectedEmployee.shift_type) {
      case 'basic':
        return computeTotalSalaryTypeA(entries, allowances, selectedEmployee.base_salary, selectedEmployee.hourly_rate, rates);
      case 'overtime':
        return computeTotalSalaryTypeB(entries, allowances, selectedEmployee.base_salary, selectedEmployee.hourly_rate, rates, globalClockIn);
      case 'notice_only':
        return computeTotalSalaryTypeC(entries, allowances, selectedEmployee.hourly_rate, rates);
      case 'lunar_rate':
        return computeTotalSalaryTypeD(entries, allowances, 27000, 35000, rates);
      default:
        return null;
    }
  }, [entries, allowances, selectedEmployee, rates, globalClockIn]);

  // Auto-seed entries when employee has none
  const seedingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedEmployee || !selectedPeriodId || !selectedPeriod) return;
    if (entries.length > 0) return;
    // Prevent duplicate seeding for same employee+period
    const seedKey = `${selectedEmployee.user_id}|${selectedPeriodId}`;
    if (seedingRef.current === seedKey) return;

    if (selectedEmployee.shift_type === 'basic') {
      // Type A: seed from special day rates, skip off-days (not applicable)
      if (rates.length === 0) return;
      seedingRef.current = seedKey;
      for (const r of rates) {
        if (r.day_type === 'public_holiday') continue;
        addRowAtDate(r.special_date);
      }
    } else if (selectedEmployee.shift_type === 'overtime') {
      // Type B: seed all days in period
      seedingRef.current = seedKey;
      const allDates = generateDateRange(selectedPeriod.start_date, selectedPeriod.end_date);
      for (const dateStr of allDates) {
        addRowAtDate(dateStr);
      }
    }
  }, [selectedEmployee, selectedPeriodId, selectedPeriod, entries.length, rates]);

  // Auto-save draft when breakdown changes
  useEffect(() => {
    if (breakdown && selectedEmployee && !isPublished) {
      saveDraft(breakdown.total, breakdown);
    }
  }, [breakdown, selectedEmployee, isPublished]);

  // Init
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setLoading(true);
        setBootError(null);
        const { data: { user } } = await withTimeout(
          supabase.auth.getUser(),
          10000,
          'Session check timed out.',
        );
        if (!isMounted) return;
        if (!user) {
          setLoading(false);
          navigate('/login');
          return;
        }

        const { data: roles } = await withTimeout(
          supabase.from('user_roles').select('role').eq('user_id', user.id),
          10000,
          'Role check timed out.',
        );
        if (!isMounted) return;
        if (!roles?.some(r => r.role === 'admin')) {
          setLoading(false);
          navigate('/');
          return;
        }
        setIsAdmin(true);
        setAdminUid(user.id);

        const { data: p } = await withTimeout(
          supabase.from('working_periods').select('*').order('start_date', { ascending: false }),
          10000,
          'Working period lookup timed out.',
        );
        if (!isMounted) return;
        const periodsData = (p || []) as Period[];
        setPeriods(periodsData);
        if (periodsData.length > 0) setSelectedPeriodId(periodsData[0].id);

        const [deptsRes, adminRolesRes] = await Promise.all([
          withTimeout(
            supabase.from('departments').select('id, name'),
            10000,
            'Department lookup timed out.',
          ),
          withTimeout(
            supabase.from('user_roles').select('user_id').eq('role', 'admin'),
            10000,
            'Admin role lookup timed out.',
          ),
        ]);

        // Some environments may not have salary columns on `profiles` yet. If the
        // select errors, retry with a minimal column set so the employee list
        // still loads instead of going empty.
        let profilesRes: any = await withTimeout(
          supabase.from('profiles').select('user_id, username, full_name, shift_type, base_salary, hourly_rate, department_id, default_clock_in, default_clock_out'),
          10000,
          'Profile lookup timed out.',
        );
        if (profilesRes?.error) {
          console.warn('Profile lookup (with salary columns) failed, retrying:', profilesRes.error);
          setSalaryColumnsAvailable(false);
          profilesRes = await withTimeout(
            supabase.from('profiles').select('user_id, username, full_name, shift_type, department_id, default_clock_in, default_clock_out'),
            10000,
            'Profile lookup timed out.',
          );
        } else {
          setSalaryColumnsAvailable(true);
        }
        if (!isMounted) return;

        const profiles = (profilesRes as any).data || [];
        const depts = deptsRes.data || [];
        const deptMap = new Map(depts.map(d => [d.id, d.name]));
        const adminIds = new Set((adminRolesRes.data || []).map(r => r.user_id));

        const emps: Employee[] = profiles
          .filter((p: any) => !TEMP_HIDDEN_TEST_USERNAMES.has((p.username || '').toLowerCase()))
          .filter((p: any) => !adminIds.has(p.user_id))
          .map((p: any) => ({
            user_id: p.user_id,
            username: p.username || null,
            full_name: p.full_name || 'Nhân viên',
            shift_type: (p.shift_type || 'basic') as EmployeeShiftType,
            base_salary: (p as any).base_salary || 0,
            hourly_rate: (p as any).hourly_rate || 25000,
            default_clock_in: (p as any).default_clock_in || null,
            default_clock_out: (p as any).default_clock_out || null,
            department_id: p.department_id || null,
            department_name: p.department_id ? deptMap.get(p.department_id) : undefined,
          }));

        setEmployees(emps);
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize salary admin page:', error);
        if (!isMounted) return;
        setBootError(error instanceof Error ? error.message : 'Unknown startup error.');
        setLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [navigate, retryKey]);

  const handlePublish = useCallback(async () => {
    if (!breakdown || !selectedEmployee) return;
    await publish(breakdown.total, breakdown);
    toast.success(`Đã công bố lương cho ${selectedEmployee.full_name}`);
  }, [breakdown, selectedEmployee, publish]);

  const handleNameChange = useCallback(async (name: string) => {
    if (!selectedEmployee || !name.trim()) return;
    await supabase.from('profiles').update({ full_name: name.trim() } as any).eq('user_id', selectedEmployee.user_id);
    setSelectedEmployee(prev => prev ? { ...prev, full_name: name.trim() } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { ...e, full_name: name.trim() } : e
    ));
  }, [selectedEmployee]);

  const handleBaseSalaryChange = useCallback(async (salary: number) => {
    if (!selectedEmployee) return;
    if (!salaryColumnsAvailable) {
      toast.error("DB chưa có cột base_salary. Hãy chạy migration/SQL để thêm cột trước.");
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ base_salary: salary } as any)
      .eq('user_id', selectedEmployee.user_id);
    if (error) {
      console.error('Failed to update base_salary:', error);
      toast.error(error.message || 'Lỗi lưu lương cơ bản');
      return;
    }
    setSelectedEmployee(prev => prev ? { ...prev, base_salary: salary } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { ...e, base_salary: salary } : e
    ));
  }, [selectedEmployee, salaryColumnsAvailable]);

  const handleHourlyRateChange = useCallback(async (rate: number) => {
    if (!selectedEmployee) return;
    if (!salaryColumnsAvailable) {
      toast.error("DB chưa có cột hourly_rate. Hãy chạy migration/SQL để thêm cột trước.");
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ hourly_rate: rate } as any)
      .eq('user_id', selectedEmployee.user_id);
    if (error) {
      console.error('Failed to update hourly_rate:', error);
      toast.error(error.message || 'Lỗi lưu lương giờ');
      return;
    }
    setSelectedEmployee(prev => prev ? { ...prev, hourly_rate: rate } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { ...e, hourly_rate: rate } : e
    ));
  }, [selectedEmployee, salaryColumnsAvailable]);

  const handleGlobalClockInChange = useCallback(async (time: string) => {
    if (!selectedEmployee) return;
    setGlobalClockIn(time);
    await supabase.from('profiles').update({ default_clock_in: time } as any).eq('user_id', selectedEmployee.user_id);
    setSelectedEmployee(prev => prev ? { ...prev, default_clock_in: time } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { ...e, default_clock_in: time } : e
    ));
    // Update clock_in for all non-off entries that use the default
    for (const e of entries) {
      if (!e.is_day_off) {
        const newHours = calcHoursFromTimes(time, e.clock_out);
        updateEntry(e.entry_date, e.sort_order, {
          clock_in: time,
          total_hours: newHours,
        });
      }
    }
  }, [selectedEmployee, entries, updateEntry]);

  const handleTypeCDefaultClockInChange = useCallback(async (time: string) => {
    if (!selectedEmployee) return;
    const { error } = await supabase
      .from('profiles')
      .update({ default_clock_in: time } as any)
      .eq('user_id', selectedEmployee.user_id);
    if (error) {
      console.error('Failed to update default_clock_in:', error);
      toast.error(error.message || 'Lỗi lưu giờ vào mặc định');
      return;
    }
    setSelectedEmployee(prev => prev ? { ...prev, default_clock_in: time } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { ...e, default_clock_in: time } : e
    ));
  }, [selectedEmployee]);

  const handleTypeCDefaultClockOutChange = useCallback(async (time: string) => {
    if (!selectedEmployee) return;
    const { error } = await supabase
      .from('profiles')
      .update({ default_clock_out: time } as any)
      .eq('user_id', selectedEmployee.user_id);
    if (error) {
      console.error('Failed to update default_clock_out:', error);
      toast.error(error.message || 'Lỗi lưu giờ ra mặc định');
      return;
    }
    setSelectedEmployee(prev => prev ? { ...prev, default_clock_out: time } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { ...e, default_clock_out: time } : e
    ));
  }, [selectedEmployee]);

  const handleCSVImport = useCallback(async (rows: ParsedRow[]) => {
    if (!selectedEmployee || !selectedPeriodId) return;
    for (const row of rows) {
      await new Promise<void>(resolve => {
        updateEntry(row.entry_date, row.sort_order, {
          is_day_off: row.is_day_off,
          off_percent: row.off_percent,
          note: row.note,
          clock_in: row.clock_in,
          clock_out: row.clock_out,
          total_hours: row.total_hours,
          allowance_rate_override: row.allowance_rate_override,
        });
        resolve();
      });
    }
    toast.success(`Đã nhập ${rows.length} dòng từ CSV`);
  }, [selectedEmployee, selectedPeriodId, updateEntry]);

  const handleShiftTypeChange = useCallback(async (newType: EmployeeShiftType) => {
    if (!selectedEmployee || !selectedPeriodId) return;
    
    // Update database
    await supabase.from('profiles').update({ shift_type: newType } as any).eq('user_id', selectedEmployee.user_id);
    
    // Update local state
    setSelectedEmployee(prev => prev ? { ...prev, shift_type: newType } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { ...e, shift_type: newType } : e
    ));
    
    // Clear all salary entries for this employee in this period
    const { error } = await supabase
      .from('salary_entries')
      .delete()
      .eq('user_id', selectedEmployee.user_id)
      .eq('period_id', selectedPeriodId);
    
    if (error) {
      console.error('Error clearing salary entries:', error);
      toast.error('Lỗi khi xóa dữ liệu lương cũ');
    } else {
      toast.success(`Đã đổi loại sang ${EMPLOYEE_TYPE_LABELS[newType]} và xóa dữ liệu lương cũ`);
      // Force re-render by updating retry key
      setRetryKey(k => k + 1);
    }
    
    setShowShiftTypePicker(false);
  }, [selectedEmployee, selectedPeriodId]);

  const handleWorkShiftChange = useCallback(async (newShift: 'morning' | 'evening') => {
    if (!selectedEmployee) return;
    
    // Set default clock times based on shift
    const clockIn = newShift === 'morning' ? '08:00' : '15:00';
    const clockOut = newShift === 'morning' ? '15:00' : '22:00';
    
    // Update database
    await supabase.from('profiles').update({ 
      work_shift: newShift,
      default_clock_in: clockIn,
      default_clock_out: clockOut
    } as any).eq('user_id', selectedEmployee.user_id);
    
    // Update local state
    setSelectedEmployee(prev => prev ? { 
      ...prev, 
      work_shift: newShift,
      default_clock_in: clockIn,
      default_clock_out: clockOut
    } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { 
        ...e, 
        work_shift: newShift,
        default_clock_in: clockIn,
        default_clock_out: clockOut
      } : e
    ));
    
    toast.success(`Đã đổi ca làm việc sang ${newShift === 'morning' ? 'Ca sáng (8:00-15:00)' : 'Ca chiều (15:00-22:00)'}`);
  }, [selectedEmployee]);

  const typeBadgeColor = (t: EmployeeShiftType) => {
    switch (t) {
      case 'basic': return 'bg-amber-500/20 text-amber-400';
      case 'overtime': return 'bg-cyan-500/20 text-cyan-400';
      case 'notice_only': return 'bg-purple-500/20 text-purple-400';
    }
  };

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="px-6 pt-12 pb-4">
        <div className="flex flex-col mb-4">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => selectedEmployee ? setSelectedEmployee(null) : navigate('/admin')}
              className="p-2 rounded-xl bg-muted text-muted-foreground">
              {selectedEmployee ? <ChevronLeft size={20} /> : <ArrowLeft size={20} />}
            </motion.button>
            <div className="flex-1 flex justify-between items-center">
              <div>
                <h1 className="font-display text-xl font-bold text-gradient-gold flex items-center gap-2">
                  {!selectedEmployee && <DollarSign size={20} />}
                  {selectedEmployee ? (
                    editingName && !isPreviewMode ? (
                      <div className="relative flex-1 max-w-[250px]">
                        <input
                          value={nameInput}
                          onChange={ev => setNameInput(ev.target.value)}
                          onBlur={() => { handleNameChange(nameInput); setEditingName(false); }}
                          onKeyDown={ev => { if (ev.key === 'Enter') { handleNameChange(nameInput); setEditingName(false); } if (ev.key === 'Escape') setEditingName(false); }}
                          className="w-full px-2 py-0.5 pr-7 rounded bg-background border border-border text-xl font-bold text-foreground"
                          autoFocus
                        />
                        {nameInput && (
                          <button
                            onMouseDown={e => { e.preventDefault(); setNameInput(''); }}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground p-0.5 text-sm"
                            tabIndex={-1}
                          >✕</button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => { if (!isPreviewMode) { setNameInput(selectedEmployee.full_name); setEditingName(true); } }}
                        className={`text-left ${!isPreviewMode ? 'hover:underline' : 'cursor-default'}`}
                      >
                        {selectedEmployee.full_name}
                      </button>
                    )
                  ) : 'Quản lý lương'}
                </h1>
                {selectedEmployee && !isPreviewMode && (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => setShowShiftTypePicker(true)}
                      className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium transition-all hover:ring-2 hover:ring-primary/50 ${typeBadgeColor(selectedEmployee.shift_type)}`}
                    >
                      {EMPLOYEE_TYPE_LABELS[selectedEmployee.shift_type]}
                    </button>
                    {(selectedEmployee.shift_type === 'notice_only' || selectedEmployee.shift_type === 'lunar_rate') && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleWorkShiftChange('morning')}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                            selectedEmployee.work_shift === 'morning'
                              ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/50'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          Ca sáng
                        </button>
                        <button
                          onClick={() => handleWorkShiftChange('evening')}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                            selectedEmployee.work_shift === 'evening'
                              ? 'bg-accent/20 text-accent ring-1 ring-accent/50'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          Ca chiều
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Hourly rate inline with name (Type B / C only) */}
              {selectedEmployee && selectedEmployee.shift_type !== 'basic' && (
                <EditableAmount
                  value={selectedEmployee.hourly_rate}
                  onChange={handleHourlyRateChange}
                  isPreview={isPreviewMode}
                  suffix="đ/giờ"
                  className="items-end"
                />
              )}
            </div>
            {!selectedEmployee && (
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
                className="p-2 rounded-xl bg-muted text-muted-foreground ml-2">
                <LogOut size={20} />
              </motion.button>
            )}
          </div>
          
          {/* Salary summary row */}
          {selectedEmployee && selectedEmployee.shift_type !== 'notice_only' && (
            <div className="mt-2 pl-[44px] pr-2">
              <div className="grid grid-cols-3 items-start gap-x-4">
               <EditableAmount
                  label="Lương cơ bản"
                  value={selectedEmployee.base_salary}
                  onChange={handleBaseSalaryChange}
                  isPreview={isPreviewMode}
               />
               <div className="flex flex-col items-center">
                 <span className="text-[11px] text-muted-foreground mb-0.5">Lương ngày</span>
                 <span className="text-[15px] font-bold text-emerald-400">
                    {formatVND(calcDailyBase(selectedEmployee.base_salary)).replace(' đ', '')}đ
                 </span>
               </div>
               {selectedEmployee.shift_type === 'overtime' ? (
                 <div className="flex flex-col items-end">
                   <span className="text-[11px] text-muted-foreground mb-0.5">Giờ vào</span>
                   <button
                     onClick={() => !isPreviewMode && setPickingGlobalClockIn(true)}
                     className={`text-[15px] font-bold text-accent ${
                       isPreviewMode ? 'cursor-default' : 'hover:opacity-70 transition-opacity'
                     }`}
                   >
                     {globalClockIn}
                   </button>
                 </div>
               ) : selectedEmployee.shift_type === 'basic' ? (
                 <EditableAmount
                   label="Lương giờ"
                   value={selectedEmployee.hourly_rate}
                   onChange={handleHourlyRateChange}
                   isPreview={isPreviewMode}
                   suffix="đ/giờ"
                   className="items-end"
                 />
               ) : (
                 <div />
               )}
              </div>
            </div>
          )}

      {pickingGlobalClockIn && (
        <AnalogClock
          label="Giờ vào"
          onTimeSelect={(time) => {
            handleGlobalClockInChange(time);
            setPickingGlobalClockIn(false);
          }}
          onClose={() => setPickingGlobalClockIn(false)}
        />
      )}
        </div>

        {/* Period selector */}
        {!selectedEmployee && (
          <select
            value={selectedPeriodId || ''}
            onChange={e => setSelectedPeriodId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm text-foreground mb-3"
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {formatDateViet(p.start_date)} – {formatDateViet(p.end_date)}
              </option>
            ))}
          </select>
        )}

        {/* Tabs */}
        {!selectedEmployee && (
          <div className="flex gap-2">
            {[
              { key: 'employees' as const, label: 'Nhân viên', icon: Users },
              { key: 'rates' as const, label: 'Bảng phụ cấp', icon: Table2 },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  tab === key ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                <Icon size={16} />{label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="px-4 space-y-4">
        {/* Rate table tab */}
        {!selectedEmployee && tab === 'rates' && selectedPeriodId && (
          <GlobalRateTable
            rates={rates}
            onUpdate={updateRate}
            onAdd={addRate}
            onRemove={removeRate}
            periodId={selectedPeriodId}
          />
        )}

        {/* Employee list - Department-based swipeable pages */}
        {!selectedEmployee && tab === 'employees' && (
          <DepartmentEmployeePages
            employees={employees}
            onSelectEmployee={setSelectedEmployee}
            typeBadgeColor={typeBadgeColor}
            pendingCounts={pendingCounts}
          />
        )}

        {/* Selected employee salary table */}
        {selectedEmployee && selectedPeriod && (
          <>
            {selectedEmployee.shift_type === 'basic' && (
              <SalaryTableTypeA
                entries={entries}
                rates={rates}
                allowances={allowances}
                baseSalary={selectedEmployee.base_salary}
                hourlyRate={selectedEmployee.hourly_rate}
                onEntryUpdate={updateEntry}
                onAddRowAtDate={addRowAtDate}
                onRemoveEntry={removeEntry}
                onAllowanceToggle={toggleAllowance}
                onAllowanceUpdate={updateAllowance}
                onAddAllowance={addAllowance}
                onHourlyRateChange={handleHourlyRateChange}
                periodStart={selectedPeriod.start_date}
                periodEnd={selectedPeriod.end_date}
                breakdown={breakdown}
                isPreview={isPreviewMode}
                editMode={isPreviewMode ? 'preview' : 'admin'}
                onAcceptEntry={acceptEntry}
                currentUserId={adminUid}
              />
            )}

            {selectedEmployee.shift_type === 'overtime' && (
              <SalaryTableTypeB
                entries={entries}
                rates={rates}
                allowances={allowances}
                baseSalary={selectedEmployee.base_salary}
                hourlyRate={selectedEmployee.hourly_rate}
                globalClockIn={globalClockIn}
                onGlobalClockInChange={handleGlobalClockInChange}
                periodStart={selectedPeriod.start_date}
                periodEnd={selectedPeriod.end_date}
                onEntryUpdate={updateEntry}
                onAddDuplicateRow={addDuplicateRow}
                onRemoveEntry={removeEntry}
                onAllowanceToggle={toggleAllowance}
                onAllowanceUpdate={updateAllowance}
                onAddAllowance={addAllowance}
                onHourlyRateChange={handleHourlyRateChange}
                breakdown={breakdown}
                isPreview={isPreviewMode}
                editMode={isPreviewMode ? 'preview' : 'admin'}
                onAcceptEntry={acceptEntry}
                currentUserId={adminUid}
              />
            )}

            {(selectedEmployee.shift_type === 'notice_only' || selectedEmployee.shift_type === 'lunar_rate') && (
              <SalaryTableTypeC
                entries={entries}
                rates={rates}
                allowances={allowances}
                offDays={selectedPeriod.off_days || []}
                hourlyRate={selectedEmployee.hourly_rate}
                periodStart={selectedPeriod.start_date}
                periodEnd={selectedPeriod.end_date}
                customStartDate={null}
                customEndDate={null}
                defaultClockIn={selectedEmployee.default_clock_in}
                defaultClockOut={selectedEmployee.default_clock_out}
                onDefaultClockInChange={handleTypeCDefaultClockInChange}
                onDefaultClockOutChange={handleTypeCDefaultClockOutChange}
                onEntryUpdate={updateEntry}
                onEntryDateChange={moveEntryToDate}
                onAddRowAtDate={addRowAtDate}
                onAllowanceToggle={toggleAllowance}
                onAllowanceUpdate={updateAllowance}
                onAddAllowance={addAllowance}
                onHourlyRateChange={handleHourlyRateChange}
                onCustomDateChange={() => {}} // TODO: store custom dates
                breakdown={breakdown}
                isPreview={isPreviewMode}
                editMode={isPreviewMode ? 'preview' : 'admin'}
                onAcceptEntry={acceptEntry}
                currentUserId={adminUid}
                shiftType={selectedEmployee.shift_type}
              />
            )}

            <div className="mt-4 space-y-2">
              {/* CSV Import */}
              {!isPreviewMode && (
                <button
                  onClick={() => setShowCSVImport(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted/60 border border-border/50 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                >
                  <Upload size={15} />
                  Nhập từ CSV
                </button>
              )}
              <div className="flex gap-2 items-stretch">
                <button
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isPreviewMode ? 'bg-primary/20 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {isPreviewMode ? 'Đóng xem trước' : 'Xem trước bản NV'}
                </button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleTheme}
                  className={`px-3 rounded-xl ${isLight ? 'bg-orange-500/20 text-orange-600' : 'bg-muted text-muted-foreground'}`}
                  aria-label={isLight ? 'Chuyển nền tối' : 'Chuyển nền sáng'}
                >
                  {isLight ? <Sun size={20} /> : <Moon size={20} />}
                </motion.button>
                <div className="flex-1">
                  <PublishButton
                    isPublished={isPublished}
                    isSaving={isSaving}
                    onPublish={handlePublish}
                  />
                </div>
              </div>
            </div>

            {/* CSV Import Modal */}
            {showCSVImport && selectedPeriod && (
              <CSVImportModal
                shiftType={selectedEmployee.shift_type}
                periodStart={selectedPeriod.start_date}
                periodEnd={selectedPeriod.end_date}
                onImport={handleCSVImport}
                onClose={() => setShowCSVImport(false)}
              />
            )}

            {/* Shift Type Picker Modal */}
            {showShiftTypePicker && selectedEmployee && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowShiftTypePicker(false)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card p-6 max-w-sm w-full"
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-lg font-bold text-foreground mb-4">Chọn loại nhân viên</h3>
                  <div className="space-y-2">
                    {(['basic', 'overtime', 'notice_only', 'lunar_rate'] as EmployeeShiftType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => handleShiftTypeChange(type)}
                        className={`w-full p-3 rounded-xl text-left transition-all ${
                          selectedEmployee.shift_type === type
                            ? 'gradient-gold text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80 text-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{EMPLOYEE_TYPE_LABELS[type]}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadgeColor(type)}`}>
                            {type}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowShiftTypePicker(false)}
                    className="w-full mt-4 py-2 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 text-sm font-medium"
                  >
                    Hủy
                  </button>
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    ⚠️ Đổi loại sẽ xóa toàn bộ dữ liệu lương hiện tại
                  </p>
                </motion.div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
