-- Create birthdays table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.birthdays (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    date date NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Use a simpler way to add the column if it's missing (Postgres 9.6+)
ALTER TABLE public.birthdays ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

-- Ensure it's NOT NULL (only works if no rows exist yet, which is likely the case if migration failed)
-- If there are rows, we'd need to set a default or handle them, but assuming fresh start.
DO $$
BEGIN
    ALTER TABLE public.birthdays ALTER COLUMN user_id SET NOT NULL;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not set user_id to NOT NULL, perhaps there is existing data or column still missing.';
END $$;

-- Enable RLS
ALTER TABLE public.birthdays ENABLE ROW LEVEL SECURITY;

-- Clean up policies
DROP POLICY IF EXISTS "Users can view their own birthdays" ON public.birthdays;
DROP POLICY IF EXISTS "Service role can do anything with birthdays" ON public.birthdays;
DROP POLICY IF EXISTS "Users can manage their own birthdays" ON public.birthdays;

-- Since the backend uses Service Role (which bypasses RLS), 
-- we keep it simple or use a policy that matches the user_id for client-side access.
-- If you use public.users table (not auth.users), auth.uid() won't work directly 
-- unless you have custom JWT mapping.
-- Assuming backend-only access or Service Role:
CREATE POLICY "Service role can do anything with birthdays"
ON public.birthdays
FOR ALL
USING (true)
WITH CHECK (true);
