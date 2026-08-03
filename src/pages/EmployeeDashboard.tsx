import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Package, CalendarClock } from 'lucide-react';
import EmployeeSalaryView from '@/components/salary/EmployeeSalaryView';
import EmployeeShiftRegisterContent from '@/components/shift/EmployeeShiftRegisterContent';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [tab, setTab] = useState<'salary' | 'shifts'>('salary');

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
        setUserId(user.id);

        // Check if salary is editable — if so, redirect to /salary/edit
        const today = new Date().toISOString().split('T')[0];
        const { data: periods } = await supabase.from('working_periods')
          .select('id')
          .eq('is_archived', false)
          .lte('start_date', today)
          .gte('end_date', today)
          .limit(1);

        const currentPeriod = (periods || [])[0];
        if (currentPeriod) {
          const { data: rec } = await supabase.from('salary_records')
            .select('status')
            .eq('user_id', user.id)
            .eq('period_id', currentPeriod.id)
            .maybeSingle();

          if (!rec || rec.status === 'draft') {
            if (!isMounted) return;
            navigate('/salary/edit', { replace: true });
            return;
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        if (!isMounted) setBootError(error instanceof Error ? error.message : 'Unknown startup error.');
        setLoading(false);
      }
    };

    init();
    return () => { isMounted = false; };
  }, [navigate, retryKey]);

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(k => k + 1)} />;
  }
  if (!userId) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex bg-muted rounded-xl p-0.5">
            <button
              onClick={() => setTab('salary')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                tab === 'salary' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Package size={13} />
              Bảng lương
            </button>
            <button
              onClick={() => setTab('shifts')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                tab === 'shifts' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <CalendarClock size={13} />
              Đăng ký ca
            </button>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
            aria-label="Đăng xuất"
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut size={18} />
          </motion.button>
        </div>
      </header>

      {/* Both views always mounted — just toggle display */}
      <div className={tab !== 'salary' ? 'hidden' : ''}>
        <div className="px-4 pt-4">
          <EmployeeSalaryView userId={userId} />
        </div>
      </div>
      <div className={tab !== 'shifts' ? 'hidden' : ''}>
        <div className="px-4 pt-2">
          <EmployeeShiftRegisterContent userId={userId} />
        </div>
      </div>
    </div>
  );
}
