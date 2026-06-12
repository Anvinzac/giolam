import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
  SalaryRecord,
  SalaryBreakdown,
  SalaryEntry,
  SpecialDayRate,
  EmployeeAllowance,
  EmployeeShiftType,
} from '@/types/salary';
import { formatVND } from './TotalSalaryDisplay';
import SalaryTableTypeA from './SalaryTableTypeA';
import SalaryTableTypeB from './SalaryTableTypeB';
import SalaryTableTypeC from './SalaryTableTypeC';
import {
  computeTotalSalaryTypeA,
  computeTotalSalaryTypeB,
  computeTotalSalaryTypeC,
  computeTotalSalaryTypeD,
  computeTotalSalaryTypeE,
  formatDateViet,
  calcDailyBase,
} from '@/lib/salaryCalculations';

interface EmployeeSalaryViewProps {
  userId: string;
}

interface PeriodInfo {
  id: string;
  start_date: string;
  end_date: string;
  off_days: string[];
}

interface ProfileInfo {
  shift_type: EmployeeShiftType;
  base_salary: number;
  hourly_rate: number;
  default_clock_in: string | null;
  default_clock_out: string | null;
}

interface Snapshot {
  salary_record_id: string;
  user_id: string;
  period_id: string;
  published_at: string;
  total_salary: number;
  breakdown: SalaryBreakdown | null;
  entries: SalaryEntry[];
  allowances: EmployeeAllowance[];
  rates: SpecialDayRate[];
  period_info: PeriodInfo | null;
  profile_info: ProfileInfo | null;
}

export default function EmployeeSalaryView({ userId }: EmployeeSalaryViewProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<SalaryRecord | null>(null);
  const [period, setPeriod] = useState<PeriodInfo | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [rates, setRates] = useState<SpecialDayRate[]>([]);
  const [allowances, setAllowances] = useState<EmployeeAllowance[]>([]);
  // All published snapshots for this employee, newest first, plus which
  // one is on screen — lets them browse past payslips, not just the latest.
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Hydrate the visible record/period/profile/etc. from one snapshot.
  const applySnapshot = useCallback((snap: Snapshot) => {
    setRecord({
      id: snap.salary_record_id,
      user_id: snap.user_id,
      period_id: snap.period_id,
      total_salary: snap.total_salary,
      salary_breakdown: snap.breakdown,
      status: 'published',
      published_at: snap.published_at,
    } as unknown as SalaryRecord);
    setPeriod(snap.period_info);
    setProfile(snap.profile_info);
    setEntries(snap.entries || []);
    setRates(snap.rates || []);
    const frozenAllowances = snap.allowances || [];
    const workingDays = (snap.entries || []).filter(
      e => !e.is_day_off && (e.clock_in || e.clock_out)
    ).length;
    setAllowances(frozenAllowances.map(a =>
      a.allowance_key === 'gui_xe' && a.is_enabled
        ? { ...a, amount: workingDays * 10000 }
        : a
    ));
  }, []);

  const selectPeriod = useCallback((id: string) => {
    const snap = snapshots.find(s => s.salary_record_id === id);
    if (snap) { setSelectedId(id); applySnapshot(snap); }
  }, [snapshots, applySnapshot]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      // Fetch every frozen snapshot (newest first) up front so we can
      // decide whether there's any published history to show.
      const { data: snapData } = await supabase
        .from('salary_published_snapshots')
        .select('*')
        .eq('user_id', userId)
        .order('published_at', { ascending: false });
      const list = (snapData || []) as unknown as Snapshot[];

      // Check for current editable period.
      const today = new Date().toISOString().split('T')[0];
      const { data: currentPeriods } = await supabase
        .from('working_periods')
        .select('*')
        .eq('is_archived', false)
        .lte('start_date', today)
        .gte('end_date', today)
        .limit(1);

      let currentPeriod = ((currentPeriods || []) as PeriodInfo[])[0];

      // Fallback: if no period covers today, grab the most recent one
      // (include archived periods — editing grace period may extend after period ends)
      if (!currentPeriod) {
        const { data: fallback } = await supabase
          .from('working_periods')
          .select('*')
          .order('end_date', { ascending: false })
          .limit(1);
        currentPeriod = ((fallback || []) as PeriodInfo[])[0];
      }

      // Only bounce to the editor when there is genuinely nothing to show
      // here — i.e. no published payslip exists yet AND the current period
      // is still editable. If the employee has any published history, this
      // page shows it (with the period picker) instead of redirecting, so
      // past payslips stay reachable during an open period.
      if (currentPeriod && list.length === 0) {
        const { data: myRec } = await supabase
          .from('salary_records')
          .select('status')
          .eq('user_id', userId)
          .eq('period_id', currentPeriod.id)
          .maybeSingle();

        if (!myRec || (myRec as any)?.status === 'draft') {
          setLoading(false);
          navigate('/salary/edit', { replace: true });
          return;
        }
      }

      if (list.length === 0) {
        setLoading(false);
        // No snapshot and no editable period — show empty state
        return;
      }

      // Newest snapshot on screen by default; the picker switches between
      // the frozen historical payslips. Admin edits after publish never
      // leak through — these snapshots are immutable.
      setSnapshots(list);
      setSelectedId(list[0].salary_record_id);
      applySnapshot(list[0]);
      setLoading(false);
    };

    fetchAll();
  }, [userId, navigate, applySnapshot]);

  const globalClockIn = useMemo(() => {
    const raw = profile?.default_clock_in || '17:00';
    return raw.length > 5 ? raw.slice(0, 5) : raw;
  }, [profile?.default_clock_in]);

  const globalClockOut = useMemo(() => {
    const raw = profile?.default_clock_out || '17:30';
    return raw.length > 5 ? raw.slice(0, 5) : raw;
  }, [profile?.default_clock_out]);

  const breakdown = useMemo<SalaryBreakdown | null>(() => {
    if (!profile || entries.length === 0) return record?.salary_breakdown as SalaryBreakdown | null;
    switch (profile.shift_type) {
      case 'basic':
        return computeTotalSalaryTypeA(entries, allowances, profile.base_salary, profile.hourly_rate, rates);
      case 'daily':
        return computeTotalSalaryTypeE(entries, allowances, profile.base_salary, profile.hourly_rate, rates, period?.end_date);
      case 'overtime':
        return computeTotalSalaryTypeB(
          entries,
          allowances,
          profile.base_salary,
          profile.hourly_rate,
          rates,
          globalClockIn,
          period?.off_days || []
        );
      case 'notice_only':
        return computeTotalSalaryTypeC(entries, allowances, profile.hourly_rate, rates);
      case 'lunar_rate':
        return computeTotalSalaryTypeD(entries, allowances, 27000, 35000, rates);
      default:
        return null;
    }
  }, [entries, allowances, profile, rates, globalClockIn, record]);

  const noop = () => {};

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
  }

  if (!record || !period || !profile) {
    return (
      <div className="glass-card p-8 text-center space-y-2">
        <Calendar className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground text-sm">Chưa có bảng lương nào</p>
        <p className="text-muted-foreground text-xs">Bảng lương sẽ hiển thị sau khi quản lý công bố.</p>
      </div>
    );
  }

  // Compact "dd/MM" for the history chips.
  const chipRange = (s: Snapshot) => {
    const p = s.period_info;
    if (!p) return '—';
    const dm = (iso: string) => {
      const [, m, d] = iso.split('-');
      return `${d}/${m}`;
    };
    return `${dm(p.start_date)}–${dm(p.end_date)}`;
  };

  return (
    <div className="space-y-3">
      {/* Period history picker — only when there's more than one payslip */}
      {snapshots.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-1 text-muted-foreground">
            <History size={12} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Kỳ lương</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            {snapshots.map(s => {
              const active = s.salary_record_id === selectedId;
              return (
                <button
                  key={s.salary_record_id}
                  type="button"
                  onClick={() => selectPeriod(s.salary_record_id)}
                  className={`relative shrink-0 rounded-xl px-3 py-2 text-left transition-colors ${
                    active
                      ? 'gradient-gold text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="block text-[12px] font-semibold leading-tight whitespace-nowrap">
                    {chipRange(s)}
                  </span>
                  <span className={`block text-[11px] leading-tight whitespace-nowrap ${active ? 'opacity-90' : 'opacity-70'}`}>
                    {formatVND(s.total_salary).replace(' đ', '')}đ
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Period label + total */}
      <motion.div
        key={selectedId || 'period'}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="glass-card p-4"
      >
        <p className="text-xs text-muted-foreground">
          {formatDateViet(period.start_date)} – {formatDateViet(period.end_date)}
        </p>
        <p className="font-display font-bold text-xl text-foreground mt-1">
          {formatVND(record.total_salary)}
        </p>
        {record.published_at && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Công bố: {new Date(record.published_at).toLocaleDateString('vi-VN')}
          </p>
        )}

        {(() => {
          const showBase = profile.shift_type === 'basic' || profile.shift_type === 'daily' || profile.shift_type === 'overtime';
          const showHourly = profile.shift_type !== 'daily';
          const cells: { label: string; value: string; color: string }[] = [];
          if (showBase) {
            cells.push({ label: 'Lương cơ bản', value: `${formatVND(profile.base_salary).replace(' đ', '')}đ`, color: 'text-primary' });
            cells.push({ label: 'Lương ngày', value: `${formatVND(calcDailyBase(profile.base_salary)).replace(' đ', '')}đ`, color: 'text-lunar-gold-glow' });
          }
          if (showHourly && profile.hourly_rate > 0) {
            cells.push({ label: 'Lương giờ', value: `${formatVND(profile.hourly_rate).replace(' đ', '')}đ/giờ`, color: 'text-accent' });
          }
          if (cells.length === 0) return null;
          return (
            <div className={`mt-3 grid gap-x-3 ${cells.length === 3 ? 'grid-cols-3' : cells.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {cells.map((c, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[11px] text-muted-foreground">{c.label}</span>
                  <span className={`text-[15px] font-bold ${c.color}`}>{c.value}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </motion.div>

      {/* Full salary table in preview mode */}
      {(profile.shift_type === 'basic' || profile.shift_type === 'daily') && (
        <SalaryTableTypeA
          entries={entries}
          rates={rates}
          allowances={allowances}
          baseSalary={profile.base_salary}
          hourlyRate={profile.hourly_rate}
          onEntryUpdate={noop}
          onAddRowAtDate={noop}
          onAllowanceToggle={noop}
          onAllowanceUpdate={noop}
          periodStart={period.start_date}
          periodEnd={period.end_date}
          breakdown={breakdown}
          editMode="preview"
          shiftType={profile.shift_type === 'daily' ? 'daily' : 'basic'}
          coveragePeriodEnd={period.end_date}
        />
      )}

      {profile.shift_type === 'overtime' && (
        <SalaryTableTypeB
          entries={entries}
          rates={rates}
          allowances={allowances}
          baseSalary={profile.base_salary}
          hourlyRate={profile.hourly_rate}
          globalClockIn={globalClockIn}
          onGlobalClockInChange={noop}
          periodStart={period.start_date}
          periodEnd={period.end_date}
          onEntryUpdate={noop}
          onAddDuplicateRow={noop}
          onRemoveEntry={noop}
          onAllowanceToggle={noop}
          onAllowanceUpdate={noop}
          onHourlyRateChange={noop}
          breakdown={breakdown}
          editMode="preview"
          offDays={period.off_days || []}
        />
      )}

      {(profile.shift_type === 'notice_only' || profile.shift_type === 'lunar_rate') && (
        <SalaryTableTypeC
          entries={entries}
          rates={rates}
          allowances={allowances}
          offDays={period.off_days || []}
          hourlyRate={profile.hourly_rate}
          periodStart={period.start_date}
          periodEnd={period.end_date}
          customStartDate={null}
          customEndDate={null}
          defaultClockIn={globalClockIn}
          defaultClockOut={globalClockOut}
          onEntryUpdate={noop}
          onEntryDateChange={noop}
          onAddRowAtDate={noop}
          onAllowanceToggle={noop}
          onAllowanceUpdate={noop}
          onHourlyRateChange={noop}
          onCustomDateChange={noop}
          breakdown={breakdown}
          editMode="preview"
          shiftType={profile.shift_type}
        />
      )}
    </div>
  );
}
