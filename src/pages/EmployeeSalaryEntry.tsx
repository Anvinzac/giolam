import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Clock as ClockIcon } from 'lucide-react';
import { toast } from 'sonner';
import SalaryTableTypeA from '@/components/salary/SalaryTableTypeA';
import SalaryTableTypeB from '@/components/salary/SalaryTableTypeB';
import SalaryTableTypeC from '@/components/salary/SalaryTableTypeC';
import { useSpecialDayRates } from '@/hooks/useSpecialDayRates';
import { useEmployeeAllowances } from '@/hooks/useEmployeeAllowances';
import { useSalaryEntries } from '@/hooks/useSalaryEntries';
import { useSalaryRecord } from '@/hooks/useSalaryRecord';
import {
  computeTotalSalaryTypeA,
  computeTotalSalaryTypeB,
  computeTotalSalaryTypeC,
} from '@/lib/salaryCalculations';
import { generateDateRange } from '@/lib/salaryPaging';
import { EmployeeShiftType, EMPLOYEE_TYPE_LABELS, SalaryBreakdown } from '@/types/salary';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';

interface Profile {
  user_id: string;
  full_name: string;
  shift_type: EmployeeShiftType;
  base_salary: number;
  hourly_rate: number;
  default_clock_in: string | null;
}

interface Period {
  id: string;
  start_date: string;
  end_date: string;
  off_days: string[];
}

export default function EmployeeSalaryEntry() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId) || null;

  const { rates } = useSpecialDayRates(
    selectedPeriodId,
    selectedPeriod?.start_date,
    selectedPeriod?.end_date,
    selectedPeriod?.off_days || []
  );
  const { allowances, toggleAllowance, updateAllowance, addAllowance } = useEmployeeAllowances(
    userId,
    selectedPeriodId
  );
  const {
    entries,
    updateEntry,
    addDuplicateRow,
    addRowAtDate,
    moveEntryToDate,
    removeEntry,
  } = useSalaryEntries(userId, selectedPeriodId, {
    editorMode: 'employee',
    enableRealtime: true,
  });
  const { saveDraft, isPublished } = useSalaryRecord(userId, selectedPeriodId);

  const globalClockIn = useMemo(() => {
    const raw = profile?.default_clock_in || '17:00';
    return raw.length > 5 ? raw.slice(0, 5) : raw;
  }, [profile?.default_clock_in]);

  // Init: auth, profile, periods
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        setLoading(true);
        setBootError(null);

        const { data: { user } } = await withTimeout(
          supabase.auth.getUser(),
          10000,
          'Session check timed out.'
        );
        if (!mounted) return;
        if (!user) {
          setLoading(false);
          navigate('/login');
          return;
        }
        setUserId(user.id);

        // Profile
        const { data: prof, error: profErr } = await withTimeout(
          supabase.from('profiles')
            .select('user_id, full_name, shift_type, base_salary, hourly_rate, default_clock_in')
            .eq('user_id', user.id)
            .single(),
          10000,
          'Profile lookup timed out.'
        );
        if (!mounted) return;
        if (profErr || !prof) throw profErr || new Error('Profile not found');
        setProfile({
          user_id: (prof as any).user_id,
          full_name: (prof as any).full_name || 'Nhân viên',
          shift_type: ((prof as any).shift_type || 'basic') as EmployeeShiftType,
          base_salary: (prof as any).base_salary || 0,
          hourly_rate: (prof as any).hourly_rate || 25000,
          default_clock_in: (prof as any).default_clock_in || null,
        });

        // All periods
        const { data: pAll } = await withTimeout(
          supabase.from('working_periods')
            .select('*')
            .order('start_date', { ascending: false }),
          10000,
          'Working period lookup timed out.'
        );
        if (!mounted) return;
        const allPeriods = (pAll || []) as Period[];

        // Filter out periods where this employee already has a published salary_record
        const { data: myRecords } = await withTimeout(
          supabase.from('salary_records')
            .select('period_id, status')
            .eq('user_id', user.id),
          10000,
          'Salary record lookup timed out.'
        );
        if (!mounted) return;
        const publishedPeriodIds = new Set(
          (myRecords || [])
            .filter(r => (r as any).status === 'published')
            .map(r => (r as any).period_id)
        );
        const editablePeriods = allPeriods.filter(p => !publishedPeriodIds.has(p.id));
        setPeriods(editablePeriods);

        // Pick the one containing today, else earliest upcoming, else newest.
        const today = new Date().toISOString().split('T')[0];
        let chosen: Period | undefined = editablePeriods.find(
          p => p.start_date <= today && p.end_date >= today
        );
        if (!chosen) {
          chosen = editablePeriods
            .slice()
            .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
        }
        if (chosen) {
          setSelectedPeriodId(chosen.id);
          // Ensure a draft salary_records row exists so admin can see this
          // employee listed against the period.
          await supabase
            .from('salary_records')
            .upsert(
              {
                user_id: user.id,
                period_id: chosen.id,
                total_salary: 0,
                status: 'draft',
              } as any,
              { onConflict: 'user_id,period_id', ignoreDuplicates: true }
            );
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize employee salary entry page:', err);
        if (!mounted) return;
        setBootError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, [navigate, retryKey]);

  // Compute breakdown (for auto-saved draft)
  const breakdown = useMemo<SalaryBreakdown | null>(() => {
    if (!profile || entries.length === 0) return null;
    switch (profile.shift_type) {
      case 'basic':
        return computeTotalSalaryTypeA(entries, allowances, profile.base_salary, rates);
      case 'overtime':
        return computeTotalSalaryTypeB(
          entries, allowances, profile.base_salary,
          profile.hourly_rate, rates, globalClockIn
        );
      case 'notice_only':
        return computeTotalSalaryTypeC(entries, allowances, profile.hourly_rate, rates);
      default:
        return null;
    }
  }, [entries, allowances, profile, rates, globalClockIn]);

  useEffect(() => {
    if (breakdown && profile && !isPublished && selectedPeriodId) {
      saveDraft(breakdown.total, breakdown);
    }
  }, [breakdown, profile, isPublished, selectedPeriodId, saveDraft]);

  // Stub no-op handlers for admin-only actions
  const noop = useCallback(() => {
    toast.info('Chỉ quản trị viên có thể chỉnh mục này.');
  }, []);

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(k => k + 1)} />;
  }
  if (!profile || !userId) return null;

  // Empty state
  if (periods.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-8">
        <header className="px-6 pt-12 pb-4 flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/')}
            className="p-2 rounded-xl bg-muted text-muted-foreground"
          >
            <ArrowLeft size={20} />
          </motion.button>
          <h1 className="font-display text-xl font-bold text-gradient-gold">
            Chấm công của tôi
          </h1>
        </header>
        <div className="px-4">
          <div className="glass-card p-8 text-center space-y-2">
            <p className="text-muted-foreground text-sm">
              Kỳ lương hiện tại đã được công bố.
            </p>
            <button
              onClick={() => navigate('/salary')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium"
            >
              Xem bảng lương đã công bố
            </button>
          </div>
        </div>
      </div>
    );
  }

  const typeBadgeColor = (t: EmployeeShiftType) => {
    switch (t) {
      case 'basic': return 'bg-amber-500/20 text-amber-400';
      case 'overtime': return 'bg-cyan-500/20 text-cyan-400';
      case 'notice_only': return 'bg-purple-500/20 text-purple-400';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="px-6 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/')}
            className="p-2 rounded-xl bg-muted text-muted-foreground"
          >
            <ArrowLeft size={20} />
          </motion.button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-gradient-gold">
              Chấm công của tôi
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadgeColor(profile.shift_type)}`}>
                {EMPLOYEE_TYPE_LABELS[profile.shift_type]}
              </span>
              {profile.default_clock_in && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ClockIcon size={11} /> Giờ vào: {globalClockIn}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Period selector */}
        {periods.length > 1 && (
          <select
            value={selectedPeriodId || ''}
            onChange={e => setSelectedPeriodId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm text-foreground"
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {new Date(p.start_date).toLocaleDateString('vi-VN')} – {new Date(p.end_date).toLocaleDateString('vi-VN')}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="px-4 space-y-4">
        {selectedPeriod && profile.shift_type === 'basic' && (
          <SalaryTableTypeA
            entries={entries}
            rates={rates}
            allowances={allowances}
            baseSalary={profile.base_salary}
            onEntryUpdate={updateEntry}
            onAddRowAtDate={addRowAtDate}
            onAllowanceToggle={toggleAllowance}
            onAllowanceUpdate={updateAllowance}
            onAddAllowance={addAllowance}
            periodStart={selectedPeriod.start_date}
            periodEnd={selectedPeriod.end_date}
            breakdown={breakdown}
            editMode="employee"
            currentUserId={userId}
          />
        )}

        {selectedPeriod && profile.shift_type === 'overtime' && (
          <SalaryTableTypeB
            entries={entries}
            rates={rates}
            allowances={allowances}
            baseSalary={profile.base_salary}
            hourlyRate={profile.hourly_rate}
            globalClockIn={globalClockIn}
            onGlobalClockInChange={() => {}}
            periodStart={selectedPeriod.start_date}
            periodEnd={selectedPeriod.end_date}
            onEntryUpdate={updateEntry}
            onAddDuplicateRow={addDuplicateRow}
            onRemoveEntry={removeEntry}
            onAllowanceToggle={toggleAllowance}
            onAllowanceUpdate={updateAllowance}
            onAddAllowance={addAllowance}
            onHourlyRateChange={noop}
            breakdown={breakdown}
            editMode="employee"
            currentUserId={userId}
          />
        )}

        {selectedPeriod && profile.shift_type === 'notice_only' && (
          <SalaryTableTypeC
            entries={entries}
            rates={rates}
            allowances={allowances}
            offDays={selectedPeriod.off_days || []}
            hourlyRate={profile.hourly_rate}
            periodStart={selectedPeriod.start_date}
            periodEnd={selectedPeriod.end_date}
            customStartDate={null}
            customEndDate={null}
            onEntryUpdate={updateEntry}
            onEntryDateChange={moveEntryToDate}
            onAddRowAtDate={addRowAtDate}
            onAllowanceToggle={toggleAllowance}
            onAllowanceUpdate={updateAllowance}
            onAddAllowance={addAllowance}
            onHourlyRateChange={noop}
            onCustomDateChange={() => {}}
            onRemoveEntry={removeEntry}
            breakdown={breakdown}
            editMode="employee"
            currentUserId={userId}
          />
        )}
      </div>
    </div>
  );
}
