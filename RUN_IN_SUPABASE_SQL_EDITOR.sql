-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- This fixes missing salary entry dates for Type B and Type C employees
-- Go to: https://supabase.com/dashboard/project/nnvfcvpoldufojsxcfzo/sql/new
-- Paste this entire script and click "Run"
-- ============================================================================

DO $$
DECLARE
  period_rec RECORD;
  profile_rec RECORD;
  date_rec RECORD;
  existing_count INTEGER;
  inserted_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting to fix missing salary dates...';
  
  -- Loop through all periods
  FOR period_rec IN 
    SELECT id, start_date, end_date 
    FROM public.working_periods 
    ORDER BY start_date DESC
  LOOP
    RAISE NOTICE 'Processing period: % to %', period_rec.start_date, period_rec.end_date;
    
    -- Loop through Type B (overtime) and Type C (notice_only) employees
    FOR profile_rec IN 
      SELECT p.user_id, p.shift_type, pr.full_name
      FROM public.profiles p
      LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
      WHERE p.shift_type IN ('overtime', 'notice_only')
    LOOP
      -- Generate all dates in the period
      FOR date_rec IN 
        SELECT generate_series(
          period_rec.start_date::date,
          period_rec.end_date::date,
          '1 day'::interval
        )::date AS entry_date
      LOOP
        -- Check if entry exists for this user, period, and date
        SELECT COUNT(*) INTO existing_count
        FROM public.salary_entries
        WHERE user_id = profile_rec.user_id
          AND period_id = period_rec.id
          AND entry_date = date_rec.entry_date;
        
        -- If no entry exists, create one with sort_order 0
        IF existing_count = 0 THEN
          INSERT INTO public.salary_entries (
            user_id,
            period_id,
            entry_date,
            sort_order,
            is_day_off,
            off_percent,
            note,
            clock_in,
            clock_out,
            total_hours,
            allowance_rate_override,
            base_daily_wage,
            allowance_amount,
            extra_wage,
            total_daily_wage
          ) VALUES (
            profile_rec.user_id,
            period_rec.id,
            date_rec.entry_date,
            0,
            false,
            0,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            0,
            0,
            0,
            0
          );
          
          inserted_count := inserted_count + 1;
          
          IF inserted_count <= 10 THEN
            RAISE NOTICE 'Added entry for % (%) on %', 
              COALESCE(profile_rec.full_name, 'Unknown'), 
              profile_rec.shift_type, 
              date_rec.entry_date;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '✓ Migration complete! Inserted % missing salary entries.', inserted_count;
END $$;
