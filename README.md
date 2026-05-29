# Order Assist — WMS

在庫管理・入出荷・売上分析を一貫して提供する **倉庫管理システム（WMS）** です。  
発注推薦・ロット管理・FEFO 引当・棚卸しなど、食品・消耗品向けの在庫運用を全面サポートします。

## 機能一覧

### 発注・在庫
- **発注推薦** — 直近の売上から平均日販を算出し、リードタイム・安全在庫日数をもとに推薦発注数を表示
- **在庫管理** — ロット単位で在庫を管理。賞味期限・ロケーション・倉庫を記録
- **FEFO 引当** — 出荷時に賞味期限の近いロットから自動選択
- **棚卸し** — ドラフト→承認→適用のフローで在庫の差異を確定
- **在庫調整・移動・差異解消** — ロット単位の手動操作に対応

### 入荷
- **入荷予定** — 伝票ヘッダー＋明細の 2 層構造で管理。CSV インポート対応
- **入荷確認** — ロット番号・賞味期限・ロケーションを入力して確定。在庫に自動加算
- **入荷履歴** — 入荷済み伝票の一覧・詳細表示

### 出荷
- **出荷予定** — 伝票ヘッダー＋明細で管理。CSV インポート対応
- **出荷確認** — FEFO 引当→出荷確定。出荷時に単価スナップショットを記録
- **出荷履歴** — 出荷済み伝票・返品処理

### 売上・レポート
- **売上入力** — 日次売上を手動入力または CSV インポート
- **売上レポート** — 期間・商品別グラフ表示。CSV エクスポート対応
- **日次レポート** — 日付別の入出荷・売上サマリー
- **ダッシュボード** — 在庫推移・売上推移グラフ・在庫アラート

### マスタ管理
- 仕入先 / 配送先 / 運送業者 / 倉庫 / ロケーション / 在庫ステータス
- CSV 一括インポート対応

### ユーザー・権限
- **マルチテナント** — テナントオーナーがサブユーザーを招待。データを完全分離
- **ロールベースアクセス制御** — admin / office / warehouse / viewer の 4 ロール
- **セクション別権限設定** — ロールごとにアクセスできる画面を設定

---

## 技術スタック

| 区分 | 採用技術 |
|------|----------|
| フレームワーク | Next.js (App Router) |
| 言語 | TypeScript 5 |
| UI | Tailwind CSS 4、Lucide Icons、Recharts |
| バックエンド | Supabase (PostgreSQL + PostgREST) |
| 認証 | Supabase Auth (JWT + RLS) |
| テスト | Playwright (E2E)、Vitest (Unit) |

---

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` を作成します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 3. マイグレーション適用

`supabase/migrations/` 内のファイルを番号順に Supabase SQL エディタで実行します。

```
001_initial.sql  〜  050_shipment_line_unit_price.sql
```

### 4. ユーザー作成

Supabase ダッシュボードの **Authentication → Users → Add user** からユーザーを作成してください。

### 5. 開発サーバー起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます。

---

## 画面一覧

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

---

## 発注推薦アルゴリズム

```
avgDemand     = 直近 N 日間の合計売上 ÷ N
requiredStock = ceil(avgDemand × (leadTimeDays + safetyStockDays))
orderQty      = max(0, requiredStock - currentStock)
```

3 日移動平均との比較でトレンドを検出し、発注理由として表示します。

---

## プロジェクト構成

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

---

## テスト

```bash
# ユニットテスト
npx vitest run

# E2E テスト
npx playwright test
```

---

## ドキュメント

詳細な設計情報は `docs/` を参照してください。

- [システム設計書](docs/design.md) — アーキテクチャ・伝票モデル・DB 関数一覧
- [画面遷移図](docs/screen-flow.md) — 全フローの Mermaid 図
- [ER 図](docs/er-diagram.md) — テーブル定義・リレーション
