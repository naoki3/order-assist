# Order Assist

![CI](https://github.com/naoki3/order-assist/actions/workflows/ci.yml/badge.svg)

A daily order quantity calculator for small retail stores. Automatically recommends how many items to order based on the past 7 days of sales, current stock, lead time, and safety stock settings.

## Features

- **Auto-calculated order quantities** — based on average daily demand × (lead time + safety stock days)
- **Incoming stock management** — orders are tracked as pending arrivals; marking them as received automatically updates inventory
- **Sales input** — enter actual daily sales to keep demand data accurate
- **Product management** — add/edit products with lead time and safety stock settings
- **Order history** — view past orders

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both values are found in your Supabase project under **Settings → API**.

### 3. Run database migrations

Apply the SQL files in `supabase/migrations/` to your Supabase project via the SQL editor or Supabase CLI.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Running Tests

```bash
npm test
```

Unit tests cover the core order calculation logic (`src/lib/calculator-logic.ts`).

## Pages

| Page | Description |
|------|-------------|
| `/` | Today's order recommendations — adjust quantities and place orders |
| `/incoming` | Pending arrivals — mark as received to add to inventory |
| `/sales` | Enter actual daily sales for the past 7 days |
| `/products` | Add/edit products, update current stock |
| `/history` | Past order records |

## How Order Quantity is Calculated

```
avgDemand     = total sales (last 7 days) / 7
requiredStock = ceil(avgDemand × (leadTimeDays + safetyStockDays))
orderQty      = max(0, requiredStock - currentStock)
```

A 3-day moving average is also computed to detect upward/downward trends and include them in the order reason.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Testing | Vitest |

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Order recommendations
│   ├── incoming/         # Incoming stock management
│   ├── sales/            # Sales input
│   ├── products/         # Product management
│   └── history/          # Order history
├── components/
│   ├── OrderBoard.tsx        # Interactive order adjustment UI
│   ├── ProductCard.tsx       # Product edit/delete/stock form
│   ├── AddProductForm.tsx    # Add new product form
│   ├── SaleForm.tsx          # Sales entry form
│   └── ReceiveForm.tsx       # Incoming stock receive form
└── lib/
    ├── db.ts                 # TypeScript type definitions
    ├── calculator.ts         # Order recommendation logic (DB layer)
    ├── calculator-logic.ts   # Pure calculation functions (testable)
    ├── calculator-logic.test.ts  # Unit tests
    ├── actions.ts            # Server actions
    └── supabase.ts           # Supabase client
supabase/
└── migrations/               # SQL migration files
```

## Branch Strategy

```
main   ← production
  └── dev ← staging / integration
        └── feature/* ← individual features
```

## Development Flow

See [docs/dev-flow.md](docs/dev-flow.md) for the GitHub Issue → Claude Code → PR automation workflow.
