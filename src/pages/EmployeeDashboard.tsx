import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [shiftType, setShiftType] = useState<string>('');

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
          .select('shift_type')
          .eq('user_id', user.id)
          .single();
        if (isMounted && prof) {
          setShiftType((prof as any).shift_type || 'basic');
        }

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

  if (loading) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }

  navigate('/salary');
  return null;
}
