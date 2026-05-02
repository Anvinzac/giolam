import { useState, useEffect, useMemo } from 'react';
import { Calendar } from 'lucide-react';
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

export default function EmployeeSalaryView({ userId }: EmployeeSalaryViewProps) {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<SalaryRecord | null>(null);
  const [period, setPeriod] = useState<PeriodInfo | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [rates, setRates] = useState<SpecialDayRate[]>([]);
  const [allowances, setAllowances] = useState<EmployeeAllowance[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      // 1. Most recent published salary record
      const { data: recData } = await supabase
        .from('salary_records')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!recData) { setLoading(false); return; }
      const rec = recData as unknown as SalaryRecord;
      setRecord(rec);

      // 2. Period
      const { data: pData } = await supabase
        .from('working_periods')
        .select('*')
        .eq('id', rec.period_id)
        .single();
      const per = pData as PeriodInfo | null;
      setPeriod(per);

      // 3. Profile
      const { data: profData } = await supabase
        .from('profiles')
        .select('shift_type, base_salary, hourly_rate, default_clock_in, default_clock_out')
        .eq('user_id', userId)
        .single();
      const prof = profData as ProfileInfo | null;
      setProfile(prof);

      // 4. Entries for this period
      const { data: entData } = await supabase
        .from('salary_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('period_id', rec.period_id)
        .order('entry_date')
        .order('sort_order');
      setEntries((entData || []) as SalaryEntry[]);

      // 5. Special day rates
      if (per) {
        const { data: rData } = await supabase
          .from('special_day_rates')
          .select('*')
          .eq('period_id', rec.period_id);
        setRates((rData || []) as SpecialDayRate[]);
      }

      // 6. Allowances — fix gui_xe amount from actual working days
      const { data: aData } = await supabase
        .from('employee_allowances')
        .select('*')
        .eq('user_id', userId)
        .eq('period_id', rec.period_id);
      const loadedAllowances = (aData || []) as EmployeeAllowance[];
      const loadedEntries = (entData || []) as SalaryEntry[];
      const workingDays = loadedEntries.filter(
        e => !e.is_day_off && (e.clock_in || e.clock_out)
      ).length;
      setAllowances(loadedAllowances.map(a =>
        a.allowance_key === 'gui_xe' && a.is_enabled
          ? { ...a, amount: workingDays * 10000 }
          : a
      ));

      setLoading(false);
    };

    fetchAll();
  }, [userId]);

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

  return (
    <div className="space-y-3">
      {/* Period label + total */}
      <div className="glass-card p-4">
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
      </div>

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
