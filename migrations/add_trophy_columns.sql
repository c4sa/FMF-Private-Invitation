-- Migration: Add trophy_given and complete_company_name columns to users table
-- Date: 2024

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS trophy_given BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS complete_company_name TEXT;

-- Add comment to columns for documentation
COMMENT ON COLUMN users.trophy_given IS 'Indicates if the user has been awarded a trophy by an admin';
COMMENT ON COLUMN users.complete_company_name IS 'Complete company name provided by the user after receiving a trophy';

