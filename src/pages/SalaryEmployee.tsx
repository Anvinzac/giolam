import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, LogOut, Package, CalendarClock } from 'lucide-react';
import EmployeeSalaryView from '@/components/salary/EmployeeSalaryView';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';

export default function SalaryEmployee() {
  const navigate = useNavigate();
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
    return () => { isMounted = false; };
  }, [navigate, retryKey]);

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/')}
            className="p-2 rounded-xl bg-muted text-muted-foreground"
          >
            <ArrowLeft size={18} />
          </motion.button>
          <h1 className="font-display text-xl font-bold text-gradient-gold flex-1 truncate">
            Bảng lương
          </h1>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/shift-register')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground transition-colors text-xs"
          >
            <CalendarClock size={14} />
            Đăng ký ca
          </motion.button>
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

      <div className="px-4">
        {userId && <EmployeeSalaryView userId={userId} />}
      </div>
    </div>
  );
}
