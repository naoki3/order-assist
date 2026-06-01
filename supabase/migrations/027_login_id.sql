ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS login_id TEXT,
  ADD CONSTRAINT user_profiles_login_id_unique UNIQUE (login_id);
