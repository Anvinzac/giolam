import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Package, CalendarClock, ChevronRight, UserX } from 'lucide-react';
import EmployeeSalaryView from '@/components/salary/EmployeeSalaryView';
import EmployeeShiftRegisterContent from '@/components/shift/EmployeeShiftRegisterContent';
import AdminOffSchedule from '@/components/AdminOffSchedule';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';

const KITCHEN_DEPT_ID = 'd0000000-0000-0000-0000-000000000001';
const RECEPTION_DEPT_ID = 'd0000000-0000-0000-0000-000000000002';

type SecondaryTab = 'shifts' | 'off';

function tabFromPath(path: string): 'salary' | SecondaryTab {
  if (path === '/shift-register') return 'shifts';
  if (path === '/off-schedule') return 'off';
  return 'salary';
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [tab, setTab] = useState<'salary' | SecondaryTab>(() => tabFromPath(location.pathname));
  const redirected = useRef(false);

  const isKitchen = deptId === KITCHEN_DEPT_ID;
  const isReception = deptId === RECEPTION_DEPT_ID;

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

        const { data: prof } = await withTimeout(
          supabase.from('profiles').select('department_id').eq('user_id', user.id).single(),
          10000,
          'Profile lookup timed out.',
        );
        if (!isMounted) return;
        setDeptId((prof as any)?.department_id || null);

        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        if (isMounted) setBootError(error instanceof Error ? error.message : 'Unknown startup error.');
        setLoading(false);
      }
    };

    init();
    return () => { isMounted = false; };
  }, [navigate, retryKey]);

  // Route Kitchen ↔ Reception to the right secondary tab when landing on the wrong path.
  useEffect(() => {
    if (loading || !deptId || redirected.current) return;
    const pathTab = tabFromPath(location.pathname);
    if (isKitchen && pathTab === 'shifts') {
      redirected.current = true;
      setTab('off');
      navigate('/off-schedule', { replace: true });
    } else if (isReception && pathTab === 'off') {
      redirected.current = true;
      setTab('shifts');
      navigate('/shift-register', { replace: true });
    }
  }, [loading, deptId, isKitchen, isReception, location.pathname, navigate]);

  useEffect(() => {
    setTab(tabFromPath(location.pathname));
  }, [location.pathname]);

  const switchTab = (newTab: 'salary' | SecondaryTab) => {
    setTab(newTab);
    if (newTab === 'salary') navigate('/salary', { replace: true });
    else if (newTab === 'off') navigate('/off-schedule', { replace: true });
    else navigate('/shift-register', { replace: true });
  };

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(k => k + 1)} />;
  }
  if (!userId) return null;

  const secondary: SecondaryTab = isKitchen ? 'off' : 'shifts';
  const hasSecondary = isKitchen || isReception;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex bg-muted rounded-xl p-0.5">
            <button
              onClick={() => switchTab('salary')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                tab === 'salary' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Package size={13} />
              Bảng lương
            </button>
            {hasSecondary && (
              <button
                onClick={() => switchTab(secondary)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  tab === secondary ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {isKitchen ? <UserX size={13} /> : <CalendarClock size={13} />}
                {isKitchen ? 'Lịch nghỉ' : 'Đăng ký ca'}
              </button>
            )}
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

      {hasSecondary ? (
        <div className="overflow-x-hidden">
          <motion.div
            className="flex w-[200%]"
            animate={{ x: tab === 'salary' ? '0%' : '-50%' }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="w-1/2 flex-shrink-0 px-4 pt-4">
              <EmployeeSalaryView userId={userId} />
            </div>
            <div className="w-1/2 flex-shrink-0 px-4 pt-2">
              {isKitchen ? (
                <AdminOffSchedule readOnly />
              ) : (
                <EmployeeShiftRegisterContent userId={userId} />
              )}
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="px-4 pt-4">
          <EmployeeSalaryView userId={userId} />
        </div>
      )}

      <div className="px-4 mt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => navigate('/stock-alert')}
          className="w-full glass-card border border-emerald-500/20 bg-emerald-500/5 rounded-2xl px-4 py-3.5 flex items-center gap-3"
        >
          <Package size={20} className="text-emerald-500" />
          <span className="flex-1 text-left">
            <span className="text-[13px] font-semibold">Kiểm kho</span>
            <span className="text-[11px] text-muted-foreground block">Báo cáo nguyên liệu tồn kho</span>
          </span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
