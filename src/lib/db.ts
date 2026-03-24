import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  balance: number;
  is_admin: number;
  created_at: string;
}

export interface MatchRow {
  id: string;
  external_id: number | null;
  home_team: string;
  away_team: string;
  league: string;
  kickoff: string;
  status: string;
  result: string | null;
  home_score: number | null;
  away_score: number | null;
  created_at: string;
}

export interface BetRow {
  id: string;
  user_id: string;
  match_id: string;
  selection: string;
  amount: number;
  placed_at: string;
  settled_at: string | null;
  payout: number | null;
  status: string;
}
