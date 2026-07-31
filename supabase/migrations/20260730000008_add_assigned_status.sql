DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'registration_status'::regtype AND enumlabel = 'assigned') THEN
    ALTER TYPE registration_status ADD VALUE 'assigned';
  END IF;
END $$;
