-- Add date column if it was somehow missed or dropped
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthdays' AND column_name = 'date') THEN
        ALTER TABLE public.birthdays ADD COLUMN date date NOT NULL DEFAULT CURRENT_DATE;
    END IF;
END $$;
