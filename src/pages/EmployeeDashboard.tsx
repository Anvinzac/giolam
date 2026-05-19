import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Clock, LogOut, Settings, AlertTriangle } from 'lucide-react';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';
import { buildEmployeeTitle } from '@/lib/employeeGreeting';
import AnalogClock from '@/components/AnalogClock';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [todayShifts, setTodayShifts] = useState<any[]>([]);
  const [assignedIngredientsCount, setAssignedIngredientsCount] = useState(0);
  const [pendingStockReports, setPendingStockReports] = useState(0);

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

        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, department_id')
          .eq('user_id', user.id)
          .single();
        if (isMounted && prof) {
          setFullName((prof as any).full_name || '');
          if ((prof as any).department_id) {
            const { data: dept } = await supabase
              .from('departments')
              .select('name')
              .eq('id', (prof as any).department_id)
              .single();
            if (dept) setDepartment((dept as any).name);
          }
        }

        const today = new Date().toISOString().split('T')[0];
        const { data: shifts } = await supabase
          .from('shifts')
          .select('clock_in, clock_out, is_active')
          .eq('user_id', user.id)
          .eq('shift_date', today);
        if (isMounted && shifts) setTodayShifts(shifts);

        const { data: ingredients } = await supabase
          .from('employee_ingredients')
          .select('id')
          .eq('employee_id', user.id);
        if (isMounted) setAssignedIngredientsCount(ingredients?.length || 0);

        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const { data: reports } = await supabase
          .from('stock_reports')
          .select('id')
          .eq('reported_by', user.id)
          .gte('reported_at', startOfMonth)
          .is('resolved_at', null);
        if (isMounted) setPendingStockReports(reports?.length || 0);

        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const today = format(new Date(), "EEEE, 'ngày' d MMMM", { locale: vi });

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }

  const hasCheckedIn = todayShifts.some(s => s.clock_in);
  const hasCheckedOut = todayShifts.some(s => s.clock_out);

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{today}</p>
            <h1 className="font-display text-2xl font-bold text-gradient-gold">
              {fullName ? buildEmployeeTitle(fullName, 'Chào mừng') : 'Chào mừng'}
            </h1>
            {department && <p className="text-sm text-muted-foreground">{department}</p>}
          </div>
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
            onClick={handleLogout}
            aria-label="Đăng xuất"
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut size={18} />
          </motion.button>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-32 h-32">
            <AnalogClock />
          </div>
          <div className="glass-card p-4 space-y-2 flex-1">
            <h2 className="font-display text-lg font-semibold">Hôm nay</h2>
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-primary" />
              <span className="text-muted-foreground">
                {hasCheckedIn ? 'Đã chấm công vào' : 'Chưa chấm công vào'}
              </span>
              {hasCheckedIn && todayShifts.find(s => s.clock_in)?.clock_in && (
                <span className="font-medium">{todayShifts.find(s => s.clock_in)?.clock_in}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">
                {hasCheckedOut ? 'Đã chấm công ra' : 'Chưa chấm công ra'}
              </span>
              {hasCheckedOut && todayShifts.find(s => s.clock_out)?.clock_out && (
                <span className="font-medium">{todayShifts.find(s => s.clock_out)?.clock_out}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button
            onClick={() => navigate('/salary')}
            className="w-full glass-card p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Bảng lương</h3>
              <p className="text-sm text-muted-foreground">Xem thông tin lương của bạn</p>
            </div>
            <ArrowRight size={18} className="text-muted-foreground" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => navigate('/stock-alert')}
            className="w-full glass-card p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
          >
            <div className={`p-3 rounded-xl ${pendingStockReports > 0 ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'}`}>
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">
                Cảnh báo tồn kho
                {pendingStockReports > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-destructive text-destructive-foreground">
                    {pendingStockReports}
                  </span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                {assignedIngredientsCount > 0
                  ? `Quản lý ${assignedIngredientsCount} nguyên liệu được phân công`
                  : 'Báo cáo tồn kho nguyên liệu'}
              </p>
            </div>
            <ArrowRight size={18} className="text-muted-foreground" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
