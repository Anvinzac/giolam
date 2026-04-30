import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Clock as ClockIcon, LogOut, Sun, Moon, Settings } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import SalaryTableTypeA from '@/components/salary/SalaryTableTypeA';
import SalaryTableTypeB from '@/components/salary/SalaryTableTypeB';
import SalaryTableTypeC from '@/components/salary/SalaryTableTypeC';
import ImmersiveInputTypeB from '@/components/salary/ImmersiveInputTypeB';
import ViewToggle, { ViewMode } from '@/components/salary/ViewToggle';
import { useSpecialDayRates } from '@/hooks/useSpecialDayRates';
import { useEmployeeAllowances } from '@/hooks/useEmployeeAllowances';
import { useSalaryEntries } from '@/hooks/useSalaryEntries';
import { useSalaryRecord } from '@/hooks/useSalaryRecord';
import {
  computeTotalSalaryTypeA,
  computeTotalSalaryTypeB,
  computeTotalSalaryTypeC,
  computeTotalSalaryTypeD,
  formatDateViet,
} from '@/lib/salaryCalculations';
import { generateDateRange } from '@/lib/salaryPaging';
import { EmployeeShiftType, SalaryBreakdown } from '@/types/salary';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';
import { buildEmployeeTitle } from '@/lib/employeeGreeting';

interface Profile {
  user_id: string;
  full_name: string;
  shift_type: EmployeeShiftType;
  base_salary: number;
  hourly_rate: number;
  default_clock_in: string | null;
  default_clock_out: string | null;
}

interface Period {
  id: string;
  start_date: string;
  end_date: string;
  off_days: string[];
}

const isBlankEmployeeEntry = (entry: { is_day_off: boolean; clock_in: string | null; clock_out: string | null; total_hours: number | null; note: string | null; allowance_rate_override: number | null }) =>
  !entry.is_day_off &&
  !entry.clock_in &&
  !entry.clock_out &&
  entry.total_hours === null &&
  !entry.note &&
  entry.allowance_rate_override === null;

export default function EmployeeSalaryEntry() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  
  // View mode state with sessionStorage persistence (Task 10.2)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = sessionStorage.getItem('typeB_viewMode');
    return (stored === 'immersive' || stored === 'table') ? stored : 'immersive';
  });

  // Persist view mode to sessionStorage when it changes
  useEffect(() => {
    sessionStorage.setItem('typeB_viewMode', viewMode);
  }, [viewMode]);

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId) || null;

  const { rates } = useSpecialDayRates(
    selectedPeriodId,
    selectedPeriod?.start_date,
    selectedPeriod?.end_date,
    selectedPeriod?.off_days || []
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
    seedAllDays: profile?.shift_type === 'basic',
    employeeReviewMode: profile?.shift_type === 'overtime' ? 'auto' : 'pending',
  });
  
  // Calculate working days count for gui_xe
  const workingDaysCount = useMemo(() => {
    return entries.filter(e => !e.is_day_off && (e.clock_in || e.clock_out)).length;
  }, [entries]);
  
  const { allowances, loading: allowancesLoading, toggleAllowance, updateAllowance, addAllowance } = useEmployeeAllowances(
    userId,
    selectedPeriodId,
    workingDaysCount
  );
  const { saveDraft, isPublished } = useSalaryRecord(userId, selectedPeriodId);

  const globalClockIn = useMemo(() => {
    const raw = profile?.default_clock_in || '17:00';
    return raw.length > 5 ? raw.slice(0, 5) : raw;
  }, [profile?.default_clock_in]);

  const globalClockOut = useMemo(() => {
    const raw = profile?.default_clock_out || '17:30';
    return raw.length > 5 ? raw.slice(0, 5) : raw;
  }, [profile?.default_clock_out]);

  const employeeVisibleEntries = useMemo(
    () => entries.filter(entry => !isBlankEmployeeEntry(entry)),
    [entries]
  );

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
            .select('user_id, full_name, shift_type, base_salary, hourly_rate, default_clock_in, default_clock_out')
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
          default_clock_out: (prof as any).default_clock_out || null,
        });

        // Find the period containing today. If none exists, fall back to the
        // most recent period so employees can still register work even if the
        // period dates don't perfectly cover today.
        const today = new Date().toISOString().split('T')[0];
        const { data: pAll } = await withTimeout(
          supabase.from('working_periods')
            .select('*')
            .lte('start_date', today)
            .gte('end_date', today)
            .limit(1),
          10000,
          'Working period lookup timed out.'
        );
        if (!mounted) return;
        let activePeriod = ((pAll || []) as Period[])[0];

        // Fallback: if no period covers today, grab the most recent one
        if (!activePeriod) {
          const { data: fallback } = await withTimeout(
            supabase.from('working_periods')
              .select('*')
              .order('end_date', { ascending: false })
              .limit(1),
            10000,
            'Fallback period lookup timed out.'
          );
          if (!mounted) return;
          activePeriod = ((fallback || []) as Period[])[0];
        }

        // If the active period is already published for this employee, there's
        // nothing editable.
        let chosen: Period | undefined = activePeriod;
        if (chosen) {
          const { data: myRec } = await withTimeout(
            supabase.from('salary_records')
              .select('status')
              .eq('user_id', user.id)
              .eq('period_id', chosen.id)
              .maybeSingle(),
            10000,
            'Salary record lookup timed out.'
          );
          if (!mounted) return;
          if ((myRec as any)?.status === 'published') {
            chosen = undefined;
          }
        }
        setPeriods(chosen ? [chosen] : []);

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
    if (!profile || employeeVisibleEntries.length === 0) return null;
    switch (profile.shift_type) {
      case 'basic':
      case 'daily':
        return computeTotalSalaryTypeA(employeeVisibleEntries, allowances, profile.base_salary, profile.hourly_rate, rates);
      case 'overtime':
        return computeTotalSalaryTypeB(
          employeeVisibleEntries, allowances, profile.base_salary,
          profile.hourly_rate, rates, globalClockIn
        );
      case 'notice_only':
        return computeTotalSalaryTypeC(employeeVisibleEntries, allowances, profile.hourly_rate, rates);
      case 'lunar_rate':
        return computeTotalSalaryTypeD(employeeVisibleEntries, allowances, 27000, 35000, rates);
      default:
        return null;
    }
  }, [employeeVisibleEntries, allowances, profile, rates, globalClockIn]);

  useEffect(() => {
    // Same race-guard as SalaryAdmin: don't snapshot the breakdown until
    // async allowance load finishes, otherwise the stored record persists
    // with allowances:[] and total_salary:0.
    if (!breakdown || !profile || isPublished || !selectedPeriodId) return;
    if (allowancesLoading) return;
    saveDraft(breakdown.total, breakdown);
  }, [breakdown, profile, isPublished, selectedPeriodId, allowancesLoading, saveDraft]);

  // Stub no-op handlers for admin-only actions
  const noop = useCallback(() => {
    toast.info('Chỉ quản trị viên có thể chỉnh mục này.');
  }, []);

  const handleDefaultClockInChange = useCallback(async (time: string) => {
    if (!profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({ default_clock_in: time } as any)
      .eq('user_id', profile.user_id);
    if (error) {
      console.error('Failed to update default_clock_in:', error);
      toast.error(error.message || 'Lỗi lưu giờ vào mặc định');
      return;
    }
    setProfile(prev => prev ? { ...prev, default_clock_in: time } : prev);
  }, [profile]);

  const handleDefaultClockOutChange = useCallback(async (time: string) => {
    if (!profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({ default_clock_out: time } as any)
      .eq('user_id', profile.user_id);
    if (error) {
      console.error('Failed to update default_clock_out:', error);
      toast.error(error.message || 'Lỗi lưu giờ ra mặc định');
      return;
    }
    setProfile(prev => prev ? { ...prev, default_clock_out: time } : prev);
  }, [profile]);

  const { isLight, toggle: toggleTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

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
          <h1 className="font-display text-xl font-bold text-gradient-gold flex-1 truncate">
            {buildEmployeeTitle(profile.full_name)}
          </h1>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/settings')}
            aria-label="Cài đặt"
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings size={18} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            aria-label={isLight ? 'Chuyển nền tối' : 'Chuyển nền sáng'}
            className={`p-2 rounded-xl transition-colors ${
              isLight ? 'bg-orange-500/20 text-orange-600' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {isLight ? <Sun size={18} /> : <Moon size={18} />}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleLogout}
            aria-label="Đăng xuất"
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut size={18} />
          </motion.button>
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

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="px-6 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold text-gradient-gold flex items-center gap-2">
              {buildEmployeeTitle(profile.full_name)}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate('/settings')}
                aria-label="Cài đặt"
                className="p-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                <Settings size={16} />
              </motion.button>
            </h1>
            {(profile.shift_type === 'notice_only' || profile.shift_type === 'lunar_rate') && selectedPeriod && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground">
                  {formatDateViet(selectedPeriod.start_date)} - {formatDateViet(selectedPeriod.end_date)}
                </span>
              </div>
            )}
            {profile.shift_type !== 'notice_only' && profile.shift_type !== 'lunar_rate' && profile.default_clock_in && (
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ClockIcon size={11} /> Giờ vào: {globalClockIn}
                </span>
              </div>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            aria-label={isLight ? 'Chuyển nền tối' : 'Chuyển nền sáng'}
            className={`p-2 rounded-xl transition-colors ${
              isLight ? 'bg-orange-500/20 text-orange-600' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {isLight ? <Sun size={18} /> : <Moon size={18} />}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleLogout}
            aria-label="Đăng xuất"
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut size={18} />
          </motion.button>
        </div>
        
        {/* ViewToggle for Type B employees */}
        {profile.shift_type === 'overtime' && (
          <div className="mt-2 flex justify-center">
            <ViewToggle currentView={viewMode} onToggle={setViewMode} />
          </div>
        )}
      </header>

      <div className="px-4 space-y-4">
        {selectedPeriod && (profile.shift_type === 'basic' || profile.shift_type === 'daily') && (
          <SalaryTableTypeA
            entries={employeeVisibleEntries}
            rates={rates}
            allowances={allowances}
            baseSalary={profile.base_salary}
            hourlyRate={profile.hourly_rate}
            onEntryUpdate={updateEntry}
            onAddRowAtDate={addRowAtDate}
            onAllowanceToggle={toggleAllowance}
            onAllowanceUpdate={updateAllowance}
            onAddAllowance={addAllowance}
            periodStart={selectedPeriod.start_date}
            periodEnd={selectedPeriod.end_date}
            breakdown={breakdown}
            editMode={isPublished ? 'preview' : 'employee'}
            currentUserId={userId}
          />
        )}

        {selectedPeriod && profile.shift_type === 'overtime' && (
          <>
            {viewMode === 'table' ? (
              <SalaryTableTypeB
                entries={employeeVisibleEntries}
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
                editMode={isPublished ? 'preview' : 'employee'}
                currentUserId={userId}
              />
            ) : (
              <ImmersiveInputTypeB
                entries={entries}
                rates={rates}
                allowances={allowances}
                baseSalary={profile.base_salary}
                hourlyRate={profile.hourly_rate}
                globalClockIn={globalClockIn}
                periodStart={selectedPeriod.start_date}
                periodEnd={selectedPeriod.end_date}
                offDays={selectedPeriod.off_days || []}
                onEntryUpdate={updateEntry}
                breakdown={breakdown}
                currentUserId={userId}
              />
            )}
          </>
        )}

        {selectedPeriod && (profile.shift_type === 'notice_only' || profile.shift_type === 'lunar_rate') && (
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
            defaultClockIn={globalClockIn}
            defaultClockOut={globalClockOut}
            onDefaultClockInChange={handleDefaultClockInChange}
            onDefaultClockOutChange={handleDefaultClockOutChange}
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
            editMode={isPublished ? 'preview' : 'employee'}
            currentUserId={userId}
            shiftType={profile.shift_type}
          />
        )}
      </div>
    </div>
  );
}
