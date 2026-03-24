# Order Assist

A daily order quantity calculator for small retail stores. Automatically recommends how many items to order based on the past 7 days of sales, current stock, lead time, and safety stock settings.

## Features

- **Auto-calculated order quantities** — based on average daily demand × (lead time + safety stock days)
- **Incoming stock management** — orders are tracked as pending arrivals; marking them as received automatically updates inventory
- **Sales input** — enter actual daily sales to keep demand data accurate
- **Product management** — add/edit products with lead time and safety stock settings
- **Order history** — view past orders

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Sample data (5 products) is seeded automatically on first run.

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
avgDemand = total sales (last 7 days) / 7
requiredStock = ceil(avgDemand × (leadTimeDays + safetyStockDays))
orderQty = max(0, requiredStock - currentStock)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | SQLite via better-sqlite3 |

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
│   └── OrderBoard.tsx    # Interactive order adjustment UI
└── lib/
    ├── db.ts             # SQLite schema and types
    ├── calculator.ts     # Order quantity logic
    └── actions.ts        # Server actions
```

## Development Flow

See [docs/dev-flow.md](docs/dev-flow.md) for the GitHub Issue → Claude Code → PR automation workflow.
