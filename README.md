# SoccerBet

A multi-user soccer betting app for friend groups. Uses a parimutuel system with 0% house edge — odds are determined entirely by how other users bet.

## Features

- Browse upcoming matches from major European leagues (Premier League, Champions League, La Liga, Bundesliga, Serie A, Ligue 1)
- Place, modify, and cancel bets before kickoff
- Real-time parimutuel odds that update as bets are placed
- Bet history with payout tracking
- Admin panel to sync match data and settle results

## Getting Started

### Prerequisites

- Node.js 18+
- A free API key from [football-data.org](https://www.football-data.org/)

### Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file:

```env
FOOTBALL_DATA_API_KEY=your_api_key_here
SESSION_SECRET=your-secret-string-here
```

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Default Admin Account

On first run, an admin account is created automatically:

| Username | Password  |
|----------|-----------|
| `admin`  | `admin123` |

**Change this password before deploying.**

## Usage

### For Users

1. Register an account — you start with ¥50,000 balance
2. Browse matches on the home screen
3. Click a match to place a bet on home win, draw, or away win
4. Odds shown are parimutuel: they reflect the current pool distribution
5. You can modify or cancel bets any time before kickoff
6. Winnings are credited automatically when an admin settles the match

### For Admins

1. Log in with the admin account
2. Go to `/admin`
3. Click **Sync Matches** to fetch upcoming matches from the API
4. After a match ends, click **Settle** and select the result
5. Payouts are calculated and credited to winners automatically

## How Parimutuel Betting Works

All bets on a match go into a shared pool. Winning bettors split that pool proportionally to their wager.

```
odds = totalPool / pool[selection]
payout = floor(amount × odds)
```

House edge is 0%, so the total payout equals the total pool. This is designed for casual use among friends.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | SQLite via better-sqlite3 |
| Auth | HMAC-signed session cookies |
| Match Data | football-data.org API v4 |

## Project Structure

```
src/
├── app/
│   ├── actions/        # Server actions (auth, betting, admin)
│   ├── admin/          # Admin dashboard page
│   ├── login/          # Login page
│   ├── register/       # Registration page
│   └── page.tsx        # Home page (matches + bet history)
├── components/         # React components
│   ├── MatchList.tsx
│   ├── MatchCard.tsx
│   ├── BetModal.tsx
│   ├── BetHistory.tsx
│   └── AdminPanel.tsx
└── lib/
    ├── db.ts           # SQLite schema and helpers
    ├── session.ts      # Cookie session management
    ├── parimutuel.ts   # Odds calculation
    └── football.ts     # Football-Data API client
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FOOTBALL_DATA_API_KEY` | Yes | API key from football-data.org |
| `SESSION_SECRET` | Yes (prod) | Secret for HMAC session signing |

## Deployment

This app uses a local SQLite file (`data.db`). For deployment, ensure:

1. The process has write access to the project root (for `data.db`)
2. `SESSION_SECRET` is set to a strong random value
3. `FOOTBALL_DATA_API_KEY` is configured

For Vercel or other ephemeral filesystems, replace `better-sqlite3` with a persistent database (e.g., Turso, PlanetScale).
