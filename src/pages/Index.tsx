import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";
import AppBootState from "@/components/AppBootState";
import { withTimeout } from "@/lib/withTimeout";

export default function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [noPeriod, setNoPeriod] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateFromSession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!isMounted) return;

      if (!session) {
        setLoading(false);
        navigate("/login");
        return;
      }

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

      // Check admin
      const { data: roles } = await withTimeout(
        supabase.from('user_roles').select('role').eq('user_id', session.user.id),
        10000,
        'Role check timed out.',
      );
      if (!isMounted) return;
      const userIsAdmin = roles?.some(r => r.role === 'admin') ?? false;

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

      // Fallback: most recent period (employees can still edit after end_date)
      if (!currentPeriod) {
        const { data: recent } = await withTimeout(
          supabase.from('working_periods').select('*').order('end_date', { ascending: false }).limit(1),
          10000,
          'Recent period lookup timed out.',
        );
        currentPeriod = recent?.[0];
      }

      if (currentPeriod) {
        // Employees should use the same 10-day paged salary tables as admin.
        // The old weekly shift view writes to a different table and is no
        // longer the employee input surface.
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
        setLoading(false);
        navigate((salaryRec as any)?.status === 'published' ? "/salary" : "/salary/edit", { replace: true });
      } else {
        setNoPeriod(true);
        setLoading(false);
      }
    };

    const bootstrap = async () => {
      try {
        setLoading(true);
        setBootError(null);
        setNoPeriod(false);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      {noPeriod && (
        <div className="glass-card p-8 text-center space-y-4">
          <div>
            <p className="text-muted-foreground">No working period is active.</p>
            <p className="text-xs text-muted-foreground mt-1">Please contact your admin.</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={18} />
            Đăng xuất
          </motion.button>
        </div>
      )}
    </div>
  );
}
