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
  const [redirecting, setRedirecting] = useState(false);

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

        // Determine where to redirect: check for current editable period
        const today = new Date().toISOString().split('T')[0];
        const { data: currentPeriods } = await withTimeout(
          supabase.from('working_periods')
            .select('*')
            .eq('is_archived', false)
            .lte('start_date', today)
            .gte('end_date', today)
            .limit(1),
          10000,
          'Working period lookup timed out.'
        );

        let currentPeriod = ((currentPeriods || []) as any[])[0];

        // Fallback: if no period covers today, grab the most recent one
        // (include archived periods — editing grace period may extend after period ends)
        if (!currentPeriod) {
          const { data: fallback } = await withTimeout(
            supabase.from('working_periods')
              .select('*')
              .order('end_date', { ascending: false })
              .limit(1),
            10000,
            'Fallback period lookup timed out.'
          );
          if (!isMounted) return;
          currentPeriod = ((fallback || []) as any[])[0];
        }

        // Check if the period is already published for this employee
        let shouldEdit = false;
        if (currentPeriod) {
          const { data: myRec } = await withTimeout(
            supabase.from('salary_records')
              .select('status')
              .eq('user_id', user.id)
              .eq('period_id', currentPeriod.id)
              .maybeSingle(),
            10000,
            'Salary record lookup timed out.'
          );
          if (!isMounted) return;
          // If no record exists or it's still draft, employee should edit
          shouldEdit = !myRec || (myRec as any)?.status === 'draft';
        }

        if (!isMounted) return;
        setRedirecting(true);

        if (shouldEdit) {
          // Ensure a draft salary_records row exists
          if (currentPeriod) {
            await supabase
              .from('salary_records')
              .upsert(
                {
                  user_id: user.id,
                  period_id: currentPeriod.id,
                  total_salary: 0,
                  status: 'draft',
                } as any,
                { onConflict: 'user_id,period_id', ignoreDuplicates: true }
              );
          }
          navigate('/salary/edit', { replace: true });
        } else {
          navigate('/salary', { replace: true });
        }
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

  if (loading || redirecting) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }

  return null;
}
