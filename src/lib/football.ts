const BASE_URL = 'https://api.football-data.org/v4';
const API_KEY = process.env.FOOTBALL_DATA_API_KEY ?? '';

// Competitions to fetch (free tier)
const COMPETITIONS = 'PL,CL,PD,BL1,SA,FL1';

interface FDMatch {
  id: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  competition: { name: string };
  utcDate: string;
  status: string;
  score: {
    fullTime: { home: number | null; away: number | null };
  };
}

interface FDResponse {
  matches: FDMatch[];
}

export interface FetchedMatch {
  externalId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: string;
  status: 'upcoming' | 'live' | 'finished';
  homeScore: number | null;
  awayScore: number | null;
}

function mapStatus(fdStatus: string): 'upcoming' | 'live' | 'finished' {
  if (['SCHEDULED', 'TIMED'].includes(fdStatus)) return 'upcoming';
  if (['LIVE', 'IN_PLAY', 'PAUSED'].includes(fdStatus)) return 'live';
  return 'finished';
}

export async function fetchUpcomingMatches(): Promise<FetchedMatch[]> {
  const url = `${BASE_URL}/matches?competitions=${COMPETITIONS}&status=SCHEDULED,TIMED`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Football-Data API error: ${res.status}`);
  const data: FDResponse = await res.json();
  return data.matches.map(mapMatch);
}

export async function fetchRecentMatches(): Promise<FetchedMatch[]> {
  // fetch matches from -3 days to +7 days
  const from = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const url = `${BASE_URL}/matches?competitions=${COMPETITIONS}&dateFrom=${from}&dateTo=${to}`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY },
  });
  if (!res.ok) throw new Error(`Football-Data API error: ${res.status}`);
  const data: FDResponse = await res.json();
  return data.matches.map(mapMatch);
}

function mapMatch(m: FDMatch): FetchedMatch {
  return {
    externalId: m.id,
    homeTeam: m.homeTeam.name,
    awayTeam: m.awayTeam.name,
    league: m.competition.name,
    kickoff: m.utcDate,
    status: mapStatus(m.status),
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
  };
}
