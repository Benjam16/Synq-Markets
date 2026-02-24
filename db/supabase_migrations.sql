-- Supabase-specific migrations and enhancements
-- Run these AFTER the main schema.sql

-- ============================================
-- 1. Add Supabase User ID Column
-- ============================================
-- This links Supabase auth users to our users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_id 
ON users(supabase_user_id) 
WHERE supabase_user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.supabase_user_id IS 'Links to Supabase auth.users.id';

-- ============================================
-- 2. Function to Auto-Create User on Signup
-- ============================================
-- This automatically creates a user in our users table when someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (email, full_name, supabase_user_id, role)
  VALUES (
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.id,
    'trader'
  )
  ON CONFLICT (email) DO UPDATE
  SET supabase_user_id = COALESCE(users.supabase_user_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. Trigger to Call Function on Auth User Creation
-- ============================================
-- This triggers the function when a new user signs up in Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. (Optional) Row Level Security
-- ============================================
-- Uncomment these if you want to use Supabase client with RLS
-- For now, we use direct PostgreSQL connections, so RLS is optional

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE challenge_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE simulated_trades ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
-- CREATE POLICY "Users can view own data" ON users
--   FOR SELECT USING (auth.uid() = supabase_user_id);

-- CREATE POLICY "Users can view own subscriptions" ON challenge_subscriptions
--   FOR SELECT USING (
--     user_id IN (SELECT id FROM users WHERE supabase_user_id = auth.uid())
--   );

-- CREATE POLICY "Users can view own trades" ON simulated_trades
--   FOR SELECT USING (
--     user_id IN (SELECT id FROM users WHERE supabase_user_id = auth.uid())
--   );

-- ============================================
-- 5. Helper Function to Get User ID from Supabase UUID
-- ============================================
CREATE OR REPLACE FUNCTION get_user_id_from_supabase_uuid(supabase_uuid UUID)
RETURNS BIGINT AS $$
  SELECT id FROM users WHERE supabase_user_id = supabase_uuid LIMIT 1;
$$ LANGUAGE sql STABLE;

