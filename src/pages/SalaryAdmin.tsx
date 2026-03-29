import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, LogOut, DollarSign, Users, Table2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import GlobalRateTable from '@/components/salary/GlobalRateTable';
import SalaryTableTypeA from '@/components/salary/SalaryTableTypeA';
import SalaryTableTypeB from '@/components/salary/SalaryTableTypeB';
import SalaryTableTypeC from '@/components/salary/SalaryTableTypeC';
import PublishButton from '@/components/salary/PublishButton';
import { useSpecialDayRates } from '@/hooks/useSpecialDayRates';
import { useEmployeeAllowances } from '@/hooks/useEmployeeAllowances';
import { useSalaryEntries } from '@/hooks/useSalaryEntries';
import { useSalaryRecord } from '@/hooks/useSalaryRecord';
import { calcDailyBase, computeTotalSalaryTypeA, computeTotalSalaryTypeB, computeTotalSalaryTypeC, formatVND } from '@/lib/salaryCalculations';
import { EmployeeShiftType, EMPLOYEE_TYPE_LABELS, SalaryBreakdown } from '@/types/salary';

interface Employee {
  user_id: string;
  full_name: string;
  shift_type: EmployeeShiftType;
  base_salary: number;
  hourly_rate: number;
  default_clock_in: string | null;
  department_id: string | null;
  department_name?: string;
}

interface Period {
  id: string;
  start_date: string;
  end_date: string;
  off_days: string[];
}

const EditableAmount = ({ 
  label, 
  value, 
  onChange, 
  isPreview, 
  suffix = '',
  className = ''
}: { 
  label?: string; 
  value: number; 
  onChange: (val: number) => void; 
  isPreview: boolean; 
  suffix?: string;
  className?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [inputStr, setInputStr] = useState(value.toString());

  useEffect(() => setInputStr(value.toString()), [value]);

  const save = () => {
    const parsed = parseInt(inputStr.replace(/\D/g, ''), 10);
    if (!isNaN(parsed) && parsed !== value) onChange(parsed);
    setEditing(false);
  };

  if (editing && !isPreview) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {label && <span className="text-[13px] text-muted-foreground mr-1">{label}</span>}
        <input 
          value={inputStr} 
          onChange={e => setInputStr(e.target.value.replace(/\D/g, ''))}
          className="w-24 px-2 py-1 rounded bg-background border border-border text-[14px] text-right"
          inputMode="numeric"
          autoFocus
        />
        <button onClick={save} className="text-[13px] px-2.5 py-1 rounded gradient-gold text-primary-foreground font-semibold">OK</button>
        <button onClick={() => setEditing(false)} className="text-[13px] text-muted-foreground ml-1 p-1">Hủy</button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
        {label && <span className="text-[11px] text-muted-foreground mb-0.5">{label}</span>}
        <button onClick={() => !isPreview && setEditing(true)} 
          className={`text-[15px] font-bold text-accent text-left ${!isPreview ? 'hover:underline' : 'cursor-default'}`}>
          {formatVND(value).replace(' đ', '')}{suffix}
        </button>
    </div>
  );
};

export default function SalaryAdmin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<'rates' | 'employees'>('employees');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [globalClockIn, setGlobalClockIn] = useState<string>('17:00');

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId) || null;

  // Hooks for selected employee
  const { rates, updateRate, addRate, removeRate } = useSpecialDayRates(
    selectedPeriodId,
    selectedPeriod?.start_date,
    selectedPeriod?.end_date
  );
  const { allowances, toggleAllowance, updateAllowance } = useEmployeeAllowances(
    selectedEmployee?.user_id || null,
    selectedPeriodId
  );
  const { entries, updateEntry, addDuplicateRow, removeEntry, isSaving } = useSalaryEntries(
    selectedEmployee?.user_id || null,
    selectedPeriodId
  );
  const { record, saveDraft, publish, isPublished } = useSalaryRecord(
    selectedEmployee?.user_id || null,
    selectedPeriodId
  );

  // Sync global clock-in
  useEffect(() => {
    if (selectedEmployee) {
      setGlobalClockIn(selectedEmployee.default_clock_in || '17:00');
    }
  }, [selectedEmployee]);

  // Compute breakdown
  const breakdown = useMemo<SalaryBreakdown | null>(() => {
    if (!selectedEmployee || entries.length === 0) return null;
    switch (selectedEmployee.shift_type) {
      case 'basic':
        return computeTotalSalaryTypeA(entries, allowances, selectedEmployee.base_salary, rates);
      case 'overtime':
        return computeTotalSalaryTypeB(entries, allowances, selectedEmployee.base_salary, selectedEmployee.hourly_rate, rates, globalClockIn);
      case 'notice_only':
        return computeTotalSalaryTypeC(entries, allowances, selectedEmployee.hourly_rate, rates);
      default:
        return null;
    }
  }, [entries, allowances, selectedEmployee, rates, globalClockIn]);

  // Auto-save draft when breakdown changes
  useEffect(() => {
    if (breakdown && selectedEmployee && !isPublished) {
      saveDraft(breakdown.total, breakdown);
    }
  }, [breakdown, selectedEmployee, isPublished]);

  // Init
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      if (!roles?.some(r => r.role === 'admin')) { navigate('/'); return; }
      setIsAdmin(true);

      // Fetch periods
      const { data: p } = await supabase.from('working_periods').select('*').order('start_date', { ascending: false });
      const periodsData = (p || []) as Period[];
      setPeriods(periodsData);
      if (periodsData.length > 0) setSelectedPeriodId(periodsData[0].id);

      // Fetch employees with departments
      const res: any = await supabase.from('profiles').select('user_id, full_name, shift_type, base_salary, hourly_rate, department_id, default_clock_in');
      const profiles = res.data || [];
      const { data: depts } = await supabase.from('departments').select('id, name');
      const deptMap = new Map(depts?.map(d => [d.id, d.name]) || []);

      // Filter out admins
      const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      const adminIds = new Set(adminRoles?.map(r => r.user_id) || []);

      const emps: Employee[] = profiles
        .filter((p: any) => !adminIds.has(p.user_id))
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name || 'Nhân viên',
          shift_type: (p.shift_type || 'basic') as EmployeeShiftType,
          base_salary: (p as any).base_salary || 0,
          hourly_rate: (p as any).hourly_rate || 25000,
          default_clock_in: (p as any).default_clock_in || null,
          department_id: p.department_id || null,
          department_name: p.department_id ? deptMap.get(p.department_id) : undefined,
        }));

      setEmployees(emps);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handlePublish = useCallback(async () => {
    if (!breakdown || !selectedEmployee) return;
    await publish(breakdown.total, breakdown);
    toast.success(`Đã công bố lương cho ${selectedEmployee.full_name}`);
  }, [breakdown, selectedEmployee, publish]);

  const handleBaseSalaryChange = useCallback(async (salary: number) => {
    if (!selectedEmployee) return;
    await supabase.from('profiles').update({ base_salary: salary } as any).eq('user_id', selectedEmployee.user_id);
    setSelectedEmployee(prev => prev ? { ...prev, base_salary: salary } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { ...e, base_salary: salary } : e
    ));
  }, [selectedEmployee]);

  const handleHourlyRateChange = useCallback(async (rate: number) => {
    if (!selectedEmployee) return;
    await supabase.from('profiles').update({ hourly_rate: rate } as any).eq('user_id', selectedEmployee.user_id);
    setSelectedEmployee(prev => prev ? { ...prev, hourly_rate: rate } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { ...e, hourly_rate: rate } : e
    ));
  }, [selectedEmployee]);

  const handleGlobalClockInChange = useCallback(async (time: string) => {
    if (!selectedEmployee) return;
    setGlobalClockIn(time);
    await supabase.from('profiles').update({ default_clock_in: time } as any).eq('user_id', selectedEmployee.user_id);
    setSelectedEmployee(prev => prev ? { ...prev, default_clock_in: time } : null);
    setEmployees(prev => prev.map(e =>
      e.user_id === selectedEmployee.user_id ? { ...e, default_clock_in: time } : e
    ));
  }, [selectedEmployee]);

  const typeBadgeColor = (t: EmployeeShiftType) => {
    switch (t) {
      case 'basic': return 'bg-amber-500/20 text-amber-400';
      case 'overtime': return 'bg-cyan-500/20 text-cyan-400';
      case 'notice_only': return 'bg-purple-500/20 text-purple-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
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
                  {selectedEmployee ? selectedEmployee.full_name : 'Quản lý lương'}
                </h1>
                {selectedEmployee && !isPreviewMode && (
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mt-1 ${typeBadgeColor(selectedEmployee.shift_type)}`}>
                    {EMPLOYEE_TYPE_LABELS[selectedEmployee.shift_type]}
                  </span>
                )}
              </div>
              
              {/* Hourly Rate right side inline with name */}
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
          
          {/* Base salary & daily wage row */}
          {selectedEmployee && selectedEmployee.shift_type !== 'notice_only' && (
            <div className="flex items-end justify-between pl-[44px] pr-2 mt-2">
               <EditableAmount 
                  label="Lương cơ bản"
                  value={selectedEmployee.base_salary} 
                  onChange={handleBaseSalaryChange} 
                  isPreview={isPreviewMode} 
               />
               <div className="flex flex-col items-end">
                 <span className="text-[11px] text-muted-foreground mb-0.5">Lương ngày</span>
                 <span className="text-[15px] font-bold text-emerald-400">
                    {formatVND(calcDailyBase(selectedEmployee.base_salary)).replace(' đ', '')}đ
                 </span>
               </div>
            </div>
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
                {new Date(p.start_date).toLocaleDateString('vi-VN')} – {new Date(p.end_date).toLocaleDateString('vi-VN')}
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

        {/* Employee list */}
        {!selectedEmployee && tab === 'employees' && (
          <div className="space-y-2">
            {employees.map(emp => (
              <motion.button
                key={emp.user_id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedEmployee(emp)}
                className="w-full glass-card p-3 flex items-center justify-between text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{emp.full_name}</p>
                  {emp.department_name && (
                    <p className="text-[10px] text-muted-foreground">{emp.department_name}</p>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadgeColor(emp.shift_type)}`}>
                  {EMPLOYEE_TYPE_LABELS[emp.shift_type]}
                </span>
              </motion.button>
            ))}
            {employees.length === 0 && (
              <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                Chưa có nhân viên
              </div>
            )}
          </div>
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
                onEntryUpdate={updateEntry}
                onAllowanceToggle={toggleAllowance}
                onAllowanceUpdate={updateAllowance}
                breakdown={breakdown}
                isPreview={isPreviewMode}
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
                onHourlyRateChange={handleHourlyRateChange}
                breakdown={breakdown}
                isPreview={isPreviewMode}
              />
            )}

            {selectedEmployee.shift_type === 'notice_only' && (
              <SalaryTableTypeC
                entries={entries}
                rates={rates}
                allowances={allowances}
                hourlyRate={selectedEmployee.hourly_rate}
                periodStart={selectedPeriod.start_date}
                periodEnd={selectedPeriod.end_date}
                customStartDate={null}
                customEndDate={null}
                onEntryUpdate={updateEntry}
                onAllowanceToggle={toggleAllowance}
                onAllowanceUpdate={updateAllowance}
                onHourlyRateChange={handleHourlyRateChange}
                onCustomDateChange={() => {}} // TODO: store custom dates
                breakdown={breakdown}
              />
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isPreviewMode ? 'bg-primary/20 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {isPreviewMode ? 'Đóng xem trước' : 'Xem trước bản NV'}
              </button>
              <div className="flex-1">
                <PublishButton
                  isPublished={isPublished}
                  isSaving={isSaving}
                  onPublish={handlePublish}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
