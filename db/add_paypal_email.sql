-- Add PayPal email column to users table for client portal
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS paypal_email TEXT;

-- Add comment for documentation
COMMENT ON COLUMN users.paypal_email IS 'PayPal email for payouts';
