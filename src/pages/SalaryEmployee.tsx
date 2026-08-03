import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Package, CalendarClock } from 'lucide-react';
import EmployeeSalaryView from '@/components/salary/EmployeeSalaryView';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';

export default function SalaryEmployee() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

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

        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize salary employee page:', error);
        if (!isMounted) return;
        setBootError(error instanceof Error ? error.message : 'Unknown startup error.');
        setLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [navigate, retryKey]);

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with tab bar */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 flex bg-muted rounded-xl p-0.5">
            <button
              onClick={() => navigate('/salary')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                location.pathname === '/salary' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Package size={13} />
              Bảng lương
            </button>
            <button
              onClick={() => navigate('/shift-register')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                location.pathname === '/shift-register' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
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

      <div className="px-4 pt-4">
        {userId && <EmployeeSalaryView userId={userId} />}
      </div>
    </div>
  );
}
