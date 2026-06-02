-- User profiles (manual entry, independent of auth.users)
CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own user profiles" ON user_profiles
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
