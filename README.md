# Order Assist — WMS

[English](#english) | [日本語](#japanese)

---

<a name="english"></a>

## English

A **Warehouse Management System (WMS)** covering order recommendations, inbound/outbound logistics, inventory management, and sales analytics — optimized for food and consumable products.

### Features

#### Order & Inventory
- **Order recommendations** — calculates suggested order quantities from recent sales, lead time, and safety stock settings
- **Inventory management** — lot-level tracking with expiry dates, locations, and warehouse assignment
- **FEFO allocation** — automatically selects the nearest-expiry lot when allocating shipments
- **Cycle count** — draft → approval → apply workflow to reconcile inventory discrepancies
- **Stock adjustment / transfer / correction** — manual lot-level operations

#### Inbound (Receiving)
- **Receiving schedule** — two-tier voucher model (header + lines); CSV import supported
- **Receiving confirmation** — enter lot number, expiry date, and location to confirm; inventory updated automatically
- **Receiving history** — list and detail view of completed receipts

#### Outbound (Shipping)
- **Shipping schedule** — two-tier voucher model (header + lines); CSV import supported
- **Shipping confirmation** — FEFO allocation → confirm shipment; unit price snapshot recorded at confirmation
- **Shipping history** — completed shipments and return processing

#### Sales & Reports
- **Sales entry** — manual daily input or CSV import
- **Sales report** — period/product chart view with CSV export
- **Daily report** — inbound/outbound/sales summary by date
- **Dashboard** — inventory trend, sales trend charts, and stock alerts

#### Master Data
- Suppliers / Delivery destinations / Carriers / Warehouses / Locations / Inventory statuses
- Bulk CSV import supported

#### Users & Permissions
- **Multi-tenant** — tenant owner invites sub-users; full data isolation via Supabase RLS
- **Role-based access control** — admin / office / warehouse / viewer
- **Per-section permission settings** — configurable per role

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router) |
| Language | TypeScript 5 |
| UI | Tailwind CSS 4, Lucide Icons, Recharts |
| Backend | Supabase (PostgreSQL + PostgREST) |
| Auth | Supabase Auth (JWT + RLS) |
| Testing | Playwright (E2E), Vitest (Unit) |

### Pages

| URL | Description |
|-----|-------------|
| `/` | Order recommendation board |
| `/dashboard` | Dashboard |
| `/incoming` | Receiving confirmation |
| `/incoming/schedule` | Receiving schedule |
| `/incoming/history` | Receiving history |
| `/shipping/schedule` | Shipping schedule |
| `/shipping/confirm` | Shipping confirmation |
| `/shipping/history` | Shipping history |
| `/inventory` | Inventory list |
| `/inventory/[id]` | Inventory detail (per lot) |
| `/inventory/expiry` | Expiry date management |
| `/inventory/cycle-count` | Cycle count |
| `/inventory/adjust` | Stock adjustment |
| `/inventory/transfer` | Stock transfer |
| `/inventory/correction` | Discrepancy correction |
| `/products` | Product master |
| `/sales` | Sales entry |
| `/sales/import` | Sales CSV import |
| `/sales/report` | Sales report |
| `/report/daily` | Daily report |
| `/master/suppliers` | Supplier master |
| `/master/destinations` | Delivery destination master |
| `/master/carriers` | Carrier master |
| `/master/warehouses` | Warehouse master |
| `/master/locations` | Location master |
| `/master/inventory-statuses` | Inventory status master |
| `/master/users` | User management |
| `/settings` | General settings |
| `/settings/permissions` | Permission settings |

### Order Recommendation Algorithm

```
avgDemand     = total sales (last N days) / N
requiredStock = ceil(avgDemand × (leadTimeDays + safetyStockDays))
orderQty      = max(0, requiredStock - currentStock)
```

A 3-day moving average is compared to the overall average to detect trends and include them in the order reasoning.

### Setup

#### 1. Install dependencies

```bash
npm install
```

#### 2. Configure environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

#### 3. Apply database migrations

Run each file in `supabase/migrations/` in order via the Supabase SQL editor:

```
001_initial.sql  〜  050_shipment_line_unit_price.sql
```

#### 4. Create a user

Go to **Supabase Dashboard → Authentication → Users → Add user**.

#### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running Tests

```bash
# Unit tests
npx vitest run

# E2E tests
npx playwright test
```

### Project Structure

```
src/
├── app/                    # Next.js App Router (pages)
│   ├── page.tsx           # Order recommendation board
│   ├── layout.tsx         # Root layout, auth, permission check
│   ├── dashboard/
│   ├── incoming/          # Inbound management
│   ├── shipping/          # Outbound management
│   ├── inventory/         # Inventory management
│   ├── products/          # Product master
│   ├── sales/             # Sales
│   ├── report/            # Daily report
│   ├── master/            # Master data
│   ├── settings/          # Settings & permissions
│   └── api/               # API routes (CSV export etc.)
├── components/            # React client components
└── lib/
    ├── db.ts              # TypeScript type definitions
    ├── actions.ts         # Server Actions (mutations)
    ├── calculator.ts      # Order recommendation logic
    ├── permissions.ts     # Permission constants
    ├── i18n.ts            # Translation (ja/en)
    └── supabase.ts        # Supabase client
supabase/
└── migrations/            # SQL migrations (001–050)
docs/
├── design.md              # System design document
├── screen-flow.md         # Screen transition diagrams
└── er-diagram.md          # ER diagrams
```

### Documentation

- [System Design](docs/design.md) — architecture, voucher model, DB function reference
- [Screen Flow](docs/screen-flow.md) — Mermaid diagrams for all major flows
- [ER Diagram](docs/er-diagram.md) — table definitions and relationships

---

<a name="japanese"></a>

## 日本語

在庫管理・入出荷・売上分析を一貫して提供する **倉庫管理システム（WMS）** です。  
発注推薦・ロット管理・FEFO 引当・棚卸しなど、食品・消耗品向けの在庫運用を全面サポートします。

### 機能一覧

#### 発注・在庫
- **発注推薦** — 直近の売上から平均日販を算出し、リードタイム・安全在庫日数をもとに推薦発注数を表示
- **在庫管理** — ロット単位で在庫を管理。賞味期限・ロケーション・倉庫を記録
- **FEFO 引当** — 出荷時に賞味期限の近いロットから自動選択
- **棚卸し** — ドラフト→承認→適用のフローで在庫の差異を確定
- **在庫調整・移動・差異解消** — ロット単位の手動操作に対応

#### 入荷
- **入荷予定** — 伝票ヘッダー＋明細の 2 層構造で管理。CSV インポート対応
- **入荷確認** — ロット番号・賞味期限・ロケーションを入力して確定。在庫に自動加算
- **入荷履歴** — 入荷済み伝票の一覧・詳細表示

#### 出荷
- **出荷予定** — 伝票ヘッダー＋明細で管理。CSV インポート対応
- **出荷確認** — FEFO 引当→出荷確定。出荷時に単価スナップショットを記録
- **出荷履歴** — 出荷済み伝票・返品処理

#### 売上・レポート
- **売上入力** — 日次売上を手動入力または CSV インポート
- **売上レポート** — 期間・商品別グラフ表示。CSV エクスポート対応
- **日次レポート** — 日付別の入出荷・売上サマリー
- **ダッシュボード** — 在庫推移・売上推移グラフ・在庫アラート

#### マスタ管理
- 仕入先 / 配送先 / 運送業者 / 倉庫 / ロケーション / 在庫ステータス
- CSV 一括インポート対応

#### ユーザー・権限
- **マルチテナント** — テナントオーナーがサブユーザーを招待。データを完全分離
- **ロールベースアクセス制御** — admin / office / warehouse / viewer の 4 ロール
- **セクション別権限設定** — ロールごとにアクセスできる画面を設定

### 技術スタック

| 区分 | 採用技術 |
|------|----------|
| フレームワーク | Next.js (App Router) |
| 言語 | TypeScript 5 |
| UI | Tailwind CSS 4、Lucide Icons、Recharts |
| バックエンド | Supabase (PostgreSQL + PostgREST) |
| 認証 | Supabase Auth (JWT + RLS) |
| テスト | Playwright (E2E)、Vitest (Unit) |

### 画面一覧

| URL | 画面 |
|-----|------|
| `/` | 発注推薦ボード |
| `/dashboard` | ダッシュボード |
| `/incoming` | 入荷確認 |
| `/incoming/schedule` | 入荷予定 |
| `/incoming/history` | 入荷履歴 |
| `/shipping/schedule` | 出荷予定 |
| `/shipping/confirm` | 出荷確認 |
| `/shipping/history` | 出荷履歴 |
| `/inventory` | 在庫一覧 |
| `/inventory/[id]` | 在庫詳細（ロット別） |
| `/inventory/expiry` | 賞味期限管理 |
| `/inventory/cycle-count` | 棚卸し |
| `/inventory/adjust` | 在庫調整 |
| `/inventory/transfer` | 在庫移動 |
| `/inventory/correction` | 差異解消 |
| `/products` | 商品マスタ |
| `/sales` | 売上入力 |
| `/sales/import` | 売上 CSV インポート |
| `/sales/report` | 売上レポート |
| `/report/daily` | 日次レポート |
| `/master/suppliers` | 仕入先マスタ |
| `/master/destinations` | 配送先マスタ |
| `/master/carriers` | 運送業者マスタ |
| `/master/warehouses` | 倉庫マスタ |
| `/master/locations` | ロケーションマスタ |
| `/master/inventory-statuses` | 在庫ステータスマスタ |
| `/master/users` | ユーザー管理 |
| `/settings` | 一般設定 |
| `/settings/permissions` | 権限設定 |

### 発注推薦アルゴリズム

```
avgDemand     = 直近 N 日間の合計売上 ÷ N
requiredStock = ceil(avgDemand × (leadTimeDays + safetyStockDays))
orderQty      = max(0, requiredStock - currentStock)
```

3 日移動平均との比較でトレンドを検出し、発注理由として表示します。

### セットアップ

#### 1. 依存関係インストール

```bash
npm install
```

#### 2. 環境変数の設定

`.env.local` を作成します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

#### 3. マイグレーション適用

`supabase/migrations/` 内のファイルを番号順に Supabase SQL エディタで実行します。

```
001_initial.sql  〜  050_shipment_line_unit_price.sql
```

#### 4. ユーザー作成

Supabase ダッシュボードの **Authentication → Users → Add user** からユーザーを作成してください。

#### 5. 開発サーバー起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます。

### テスト

```bash
# ユニットテスト
npx vitest run

# E2E テスト
npx playwright test
```

### プロジェクト構成

```
src/
├── app/                    # Next.js App Router（ページ）
│   ├── page.tsx           # 発注推薦ボード
│   ├── layout.tsx         # 共通レイアウト・認証・権限チェック
│   ├── dashboard/
│   ├── incoming/          # 入荷管理
│   ├── shipping/          # 出荷管理
│   ├── inventory/         # 在庫管理
│   ├── products/          # 商品マスタ
│   ├── sales/             # 売上
│   ├── report/            # 日次レポート
│   ├── master/            # マスタ管理
│   ├── settings/          # 設定・権限
│   └── api/               # API ルート（CSV エクスポート等）
├── components/            # React クライアントコンポーネント
└── lib/
    ├── db.ts              # TypeScript 型定義
    ├── actions.ts         # Server Actions（ミューテーション）
    ├── calculator.ts      # 発注推薦計算
    ├── permissions.ts     # 権限定数
    ├── i18n.ts            # 翻訳関数（ja/en）
    └── supabase.ts        # Supabase クライアント
supabase/
└── migrations/            # SQL マイグレーション（001〜050）
docs/
├── design.md              # システム設計書
├── screen-flow.md         # 画面遷移図
└── er-diagram.md          # ER 図
```

### ドキュメント

- [システム設計書](docs/design.md) — アーキテクチャ・伝票モデル・DB 関数一覧
- [画面遷移図](docs/screen-flow.md) — 全フローの Mermaid 図
- [ER 図](docs/er-diagram.md) — テーブル定義・リレーション
