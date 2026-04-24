# Order Assist

A daily order quantity calculator for small retail stores. Automatically recommends how many items to order based on the past 7 days of sales, current stock, lead time, and safety stock settings. Supports multiple users with per-user data isolation via Supabase Row Level Security.

## Features

- **Auto-calculated order quantities** — based on average daily demand × (lead time + safety stock days)
- **Incoming stock tracking** — orders are tracked as pending arrivals; marking as received automatically updates inventory
- **Sales input** — enter actual daily sales to keep demand data accurate
- **Product management** — add/edit products with lead time and safety stock settings
- **Order history** — view past orders
- **Multi-user support** — each user's data is isolated via Supabase RLS (`auth.uid()`)

## Pages

| Page | Description |
|------|-------------|
| `/` | Today's order recommendations — adjust quantities and place orders |
| `/incoming` | Pending arrivals — mark as received to update inventory |
| `/sales` | Enter actual daily sales for the past 7 days |
| `/products` | Add/edit products, update current stock |
| `/history` | Past order records |

## How Order Quantity is Calculated

```
avgDemand = total sales (last 7 days) / 7
requiredStock = ceil(avgDemand × (leadTimeDays + safetyStockDays))
orderQty = max(0, requiredStock - currentStock)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Testing | Vitest |
| CI | GitHub Actions |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local`:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Apply database migrations

Run each file in `supabase/migrations/` in order via the Supabase dashboard SQL editor:

```
001_initial.sql
002_rename_products_en.sql
004_supabase_auth_rls.sql
005_drop_users_table.sql
```

### 4. Create a user

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-user.mjs admin@example.com yourpassword
```

Or create a user directly from the Supabase dashboard: **Authentication → Users → Add user**.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Data

To seed demo products and sales for a user:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs admin@example.com
```

This inserts 5 products with 7 days of sales history and current inventory levels.

## Running Tests

```bash
npx vitest run
```

Unit tests cover the core order calculation logic in `src/lib/calculator-logic.ts`.

## CI

GitHub Actions runs lint, type-check, and tests on every push:

```bash
npm run lint
npx tsc --noEmit
npx vitest run
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Order recommendations
│   ├── actions/auth.ts       # Login / logout server actions
│   ├── incoming/             # Incoming stock management
│   ├── sales/                # Sales input
│   ├── products/             # Product management
│   └── history/              # Order history
├── components/
│   ├── OrderBoard.tsx        # Interactive order adjustment UI
│   ├── ProductCard.tsx       # Product edit + stock update
│   ├── SaleForm.tsx          # Daily sales entry form
│   ├── ReceiveForm.tsx       # Mark incoming stock as received
│   └── AddProductForm.tsx    # Add new product
└── lib/
    ├── supabase.ts           # Supabase SSR client factory
    ├── db.ts                 # TypeScript types
    ├── calculator.ts         # Fetches data and builds recommendations
    ├── calculator-logic.ts   # Pure calculation functions (testable)
    ├── calculator-logic.test.ts
    └── actions.ts            # Server actions (CRUD)
scripts/
├── create-user.mjs           # Create a Supabase Auth user
└── seed-demo.mjs             # Seed demo data for a user
supabase/migrations/          # SQL migration files
```
