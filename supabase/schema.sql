-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 50000,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  external_id INTEGER UNIQUE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT NOT NULL,
  kickoff TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  result TEXT,
  home_score INTEGER,
  away_score INTEGER,
  created_at TEXT NOT NULL
);

-- Bets table
CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  match_id TEXT NOT NULL REFERENCES matches(id),
  selection TEXT NOT NULL,
  amount INTEGER NOT NULL,
  placed_at TEXT NOT NULL,
  settled_at TEXT,
  payout INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Atomic settle function (called via supabase.rpc)
CREATE OR REPLACE FUNCTION settle_match(p_match_id TEXT, p_result TEXT)
RETURNS void AS $$
DECLARE
  v_total_pool BIGINT;
  v_win_pool BIGINT;
  v_settled_at TEXT;
  bet RECORD;
  v_payout BIGINT;
BEGIN
  v_settled_at := NOW()::TEXT;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool
  FROM bets WHERE match_id = p_match_id AND status = 'pending';

  SELECT COALESCE(SUM(amount), 0) INTO v_win_pool
  FROM bets WHERE match_id = p_match_id AND status = 'pending' AND selection = p_result;

  FOR bet IN SELECT * FROM bets WHERE match_id = p_match_id AND status = 'pending' LOOP
    IF bet.selection = p_result AND v_win_pool > 0 THEN
      v_payout := FLOOR(bet.amount::NUMERIC * v_total_pool / v_win_pool);
      UPDATE bets SET status = 'won', payout = v_payout, settled_at = v_settled_at WHERE id = bet.id;
      UPDATE users SET balance = balance + v_payout WHERE id = bet.user_id;
    ELSE
      UPDATE bets SET status = 'lost', payout = 0, settled_at = v_settled_at WHERE id = bet.id;
    END IF;
  END LOOP;

  UPDATE matches SET status = 'settled', result = p_result WHERE id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
