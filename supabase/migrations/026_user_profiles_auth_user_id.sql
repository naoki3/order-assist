-- Link user_profiles to a real Supabase auth account (set when admin creates login credentials)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users ON DELETE SET NULL;
