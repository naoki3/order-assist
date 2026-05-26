-- Prevent duplicate status names per user
ALTER TABLE inventory_statuses
  ADD CONSTRAINT inventory_statuses_user_name_key UNIQUE (user_id, name);

-- Seed 5 default statuses for a given user
CREATE OR REPLACE FUNCTION seed_default_inventory_statuses(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO inventory_statuses (user_id, name, color)
  VALUES
    (p_user_id, '良品',     'green'),
    (p_user_id, '不良品',   'red'),
    (p_user_id, '検査中',   'amber'),
    (p_user_id, '返品',     'blue'),
    (p_user_id, '廃棄予定', 'purple')
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$;

-- Trigger: auto-seed on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_default_inventory_statuses(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill all existing users
SELECT seed_default_inventory_statuses(id) FROM auth.users;
