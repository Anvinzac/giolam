import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LunarHeader from "@/components/LunarHeader";
import WeekView from "@/components/WeekView";
import { Check, LogOut, Shield } from "lucide-react";
import { toast } from "sonner";

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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        navigate("/login");
        return;
      }
      setUserId(session.user.id);

      // Fetch profile
      const { data: prof } = await supabase.from('profiles').select('*').eq('user_id', session.user.id).single();
      setProfile(prof);
      setUserName(prof?.full_name || session.user.email || 'Employee');

      // Check admin
      const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).single();
      setIsAdmin(role?.role === 'admin');

      // Get current period
      const today = new Date().toISOString().split('T')[0];
      const { data: periods } = await supabase.from('working_periods').select('*').lte('start_date', today).gte('end_date', today);
      
      let currentPeriod = periods?.[0];
      if (!currentPeriod) {
        // Try upcoming period
        const { data: upcoming } = await supabase.from('working_periods').select('*').gte('start_date', today).order('start_date', { ascending: true }).limit(1);
        currentPeriod = upcoming?.[0];
      }
      
      if (currentPeriod) {
        setPeriod(currentPeriod);
        const { data: shiftData } = await supabase.from('shifts').select('*').eq('user_id', session.user.id).eq('period_id', currentPeriod.id);
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
      }

      setLoading(false);
    });

    supabase.auth.getSession();
    return () => subscription.unsubscribe();
  }, [navigate]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
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
            onClick={() => navigate("/admin")}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-medium"
          >
            <Shield size={16} />
            Admin Dashboard
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
        <div className="flex gap-2 max-w-sm mx-auto">
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
  );
}
