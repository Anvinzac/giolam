
-- Enable pg_cron and pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily cleanup at midnight
SELECT cron.schedule(
  'expire-pending-registrations',
  '0 0 * * *',
  $$SELECT public.expire_past_pending_registrations();$$
);
