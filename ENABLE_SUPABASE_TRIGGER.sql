-- Enable the on_auth_user_created trigger
-- This will automatically create users in the users table when they sign up

ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- Verify it's enabled (should show tgenabled = 1)
SELECT 
  tgname as trigger_name,
  CASE tgenabled
    WHEN 0 THEN 'DISABLED'
    WHEN 1 THEN 'ENABLED'
    WHEN 2 THEN 'REPLICA'
    WHEN 3 THEN 'ALWAYS'
  END as status,
  tgenabled
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
