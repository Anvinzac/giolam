import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LunarHeader from "@/components/LunarHeader";
import WeekView from "@/components/WeekView";
import { Check, LogOut, Shield, DollarSign, Edit3 } from "lucide-react";
import RegistrationResult from "@/components/RegistrationResult";
import { toast } from "sonner";
import AppBootState from "@/components/AppBootState";
import { withTimeout } from "@/lib/withTimeout";

interface ShiftData {
  shift_date: string;
  is_active: boolean;
  clock_in: string | null;
  clock_out: string | null;
  main_clock_in: string | null;
  main_clock_out: string | null;
  overtime_clock_in: string | null;
  overtime_clock_out: string | null;
  notice: string | null;
}

export default function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [period, setPeriod] = useState<any>(null);
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [saving, setSaving] = useState(false);
  const [useDefaultTime, setUseDefaultTime] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isCurrentPeriodPublished, setIsCurrentPeriodPublished] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateFromSession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!isMounted) return;

      if (!session) {
        setLoading(false);
        navigate("/login");
        return;
      }

      setUserId(session.user.id);

      // Fetch profile
      const { data: prof } = await withTimeout(
        supabase.from('profiles').select('*').eq('user_id', session.user.id).single(),
        10000,
        'Profile lookup timed out.',
      );
      if (!isMounted) return;
      if (prof?.must_change_password) {
        setLoading(false);
        navigate("/login");
        return;
      }
      setProfile(prof);
      setUserName(prof?.full_name || session.user.email || 'Employee');

      // Check admin
      const { data: roles } = await withTimeout(
        supabase.from('user_roles').select('role').eq('user_id', session.user.id),
        10000,
        'Role check timed out.',
      );
      if (!isMounted) return;
      const userIsAdmin = roles?.some(r => r.role === 'admin') ?? false;
      setIsAdmin(userIsAdmin);

      if (userIsAdmin) {
        setLoading(false);
        navigate("/admin/salary");
        return;
      }

      // Get current period
      const today = new Date().toISOString().split('T')[0];
      const { data: periods } = await withTimeout(
        supabase.from('working_periods').select('*').lte('start_date', today).gte('end_date', today),
        10000,
        'Working period lookup timed out.',
      );

      let currentPeriod = periods?.[0];
      if (!currentPeriod) {
        const { data: upcoming } = await withTimeout(
          supabase.from('working_periods').select('*').gte('start_date', today).order('start_date', { ascending: true }).limit(1),
          10000,
          'Upcoming period lookup timed out.',
        );
        currentPeriod = upcoming?.[0];
      }

      if (currentPeriod) {
        setPeriod(currentPeriod);

        // Determine whether this employee's salary for the current period has
        // already been published — drives whether the "Nhập giờ làm" entry
        // button is shown.
        const { data: salaryRec } = await withTimeout(
          supabase.from('salary_records')
            .select('status')
            .eq('user_id', session.user.id)
            .eq('period_id', currentPeriod.id)
            .maybeSingle(),
          10000,
          'Salary record lookup timed out.',
        );
        if (!isMounted) return;
        setIsCurrentPeriodPublished(
          (salaryRec as any)?.status === 'published'
        );
        const { data: shiftData } = await withTimeout(
          supabase.from('shifts').select('*').eq('user_id', session.user.id).eq('period_id', currentPeriod.id),
          10000,
          'Shift data lookup timed out.',
        );
        if (!isMounted) return;
        setShifts(shiftData?.map(s => ({
          shift_date: s.shift_date,
          is_active: s.is_active,
          clock_in: s.clock_in,
          clock_out: s.clock_out,
          main_clock_in: s.main_clock_in,
          main_clock_out: s.main_clock_out,
          overtime_clock_in: s.overtime_clock_in,
          overtime_clock_out: s.overtime_clock_out,
          notice: s.notice,
        })) || []);
      } else {
        setPeriod(null);
        setShifts([]);
      }

      setLoading(false);
    };

    const bootstrap = async () => {
      try {
        setLoading(true);
        setBootError(null);
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          10000,
          'Session check timed out.',
        );
        await hydrateFromSession(data.session);
      } catch (error) {
        console.error('Failed to initialize session:', error);
        if (isMounted) {
          setBootError(error instanceof Error ? error.message : 'Unknown startup error.');
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await hydrateFromSession(session);
    });

    bootstrap();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, retryKey]);

  const handleShiftUpdate = useCallback((date: string, updates: Partial<ShiftData>) => {
    setShifts(prev => {
      const existing = prev.find(s => s.shift_date === date);
      if (existing) {
        return prev.map(s => s.shift_date === date ? { ...s, ...updates } : s);
      }
      return [...prev, {
        shift_date: date,
        is_active: false,
        clock_in: null,
        clock_out: null,
        main_clock_in: null,
        main_clock_out: null,
        overtime_clock_in: null,
        overtime_clock_out: null,
        notice: null,
        ...updates,
      }];
    });
  }, []);

  const handleSave = async () => {
    if (!userId || !period) return;
    setSaving(true);
    try {
      const activeShifts = shifts.filter(s => s.is_active || s.notice);
      for (const shift of activeShifts) {
        await supabase.from('shifts').upsert({
          user_id: userId,
          period_id: period.id,
          shift_date: shift.shift_date,
          is_active: shift.is_active,
          clock_in: shift.clock_in,
          clock_out: shift.clock_out,
          main_clock_in: shift.main_clock_in,
          main_clock_out: shift.main_clock_out,
          overtime_clock_in: shift.overtime_clock_in,
          overtime_clock_out: shift.overtime_clock_out,
          notice: shift.notice,
        }, { onConflict: 'user_id,shift_date' });
      }
      toast.success("Shifts saved successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }

  const periodLabel = period
    ? `${new Date(period.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(period.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'No active period';

  return (
    <div className="min-h-screen bg-background pb-24">
      <LunarHeader
        userName={userName}
        periodLabel={periodLabel}
        defaultClockIn={profile?.default_clock_in || null}
        defaultClockOut={profile?.default_clock_out || null}
        useDefaultTime={useDefaultTime}
        onToggleDefault={() => setUseDefaultTime(!useDefaultTime)}
        onDefaultClockInChange={async (time) => {
          if (!userId) return;
          await supabase.from('profiles').update({ default_clock_in: time }).eq('user_id', userId);
          setProfile((p: any) => ({ ...p, default_clock_in: time }));
        }}
        onDefaultClockOutChange={async (time) => {
          if (!userId) return;
          await supabase.from('profiles').update({ default_clock_out: time }).eq('user_id', userId);
          setProfile((p: any) => ({ ...p, default_clock_out: time }));
        }}
      />

      <div className="px-4 space-y-4">
        {/* Admin link */}
        {isAdmin && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/admin/salary")}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-medium"
          >
            <Shield size={16} />
            Admin Dashboard
          </motion.button>
        )}

        {/* Salary link */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/salary")}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium"
        >
          <DollarSign size={16} />
          Bảng lương tháng này
        </motion.button>

        {/* Self-service time-entry link — only while the current period is
            still unpublished for this employee. */}
        {period && !isCurrentPeriodPublished && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/salary/edit')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium"
          >
            <Edit3 size={16} />
            Nhập giờ làm của tôi
          </motion.button>
        )}

        {period ? (
          <WeekView
            shifts={shifts}
            offDays={period.off_days || []}
            shiftType={profile?.shift_type || 'basic'}
            defaultClockIn={useDefaultTime ? profile?.default_clock_in : null}
            defaultClockOut={useDefaultTime ? profile?.default_clock_out : null}
            periodStart={period.start_date}
            periodEnd={period.end_date}
            onShiftUpdate={handleShiftUpdate}
            userId={userId!}
          />
        ) : (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">No working period is active.</p>
            <p className="text-xs text-muted-foreground mt-1">Please contact your admin.</p>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border">
        <div className="flex flex-col gap-2 max-w-sm mx-auto">
          {/* Registration Results */}
          {userId && <RegistrationResult userId={userId} />}

          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="p-3 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={20} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving || !period}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-display font-semibold gradient-gold text-primary-foreground disabled:opacity-50"
            >
              <Check size={18} />
              {saving ? "Đang lưu..." : "Xong"}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
