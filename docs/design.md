# システム設計書 — order-assist WMS

## 1. システム概要

order-assist は食品・消耗品などの在庫管理を行う **WMS（倉庫管理システム）** です。  
発注推薦・入荷管理・出荷管理・在庫管理・売上分析を一貫して提供します。

### 技術スタック

| 区分 | 採用技術 |
|------|----------|
| フロントエンド | Next.js (App Router)、React 19、TypeScript 5 |
| バックエンド | Supabase（PostgreSQL + PostgREST） |
| UI | Tailwind CSS 4、Lucide Icons、Recharts |
| 認証 | Supabase Auth（JWT） |
| テスト | Playwright (E2E)、Vitest (Unit) |

---

## 2. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│  ブラウザ                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Next.js App Router (Vercel)                             │   │
│  │  ├── Server Components  … データ取得・初期レンダリング   │   │
│  │  ├── Client Components  … インタラクション（フォーム等）  │   │
│  │  └── Server Actions     … ミューテーション (actions.ts)  │   │
│  └────────────────────────────┬────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTPS / PostgREST / RPC
┌───────────────────────────────▼─────────────────────────────────┐
│  Supabase                                                         │
│  ├── Auth  … JWT 発行・セッション管理                             │
│  ├── PostgREST  … テーブル CRUD (RLS 適用)                       │
│  ├── PLPGSQL 関数  … ビジネスロジック (SECURITY DEFINER)         │
│  └── PostgreSQL  … データ永続化                                   │
└─────────────────────────────────────────────────────────────────┘
```

### フロントエンド設計原則

- **Server Components** でデータ取得（`createClient()` → `.select(...)`）
- **Client Components** はインタラクションのみ（フォーム・トグル・アニメーション）
- ミューテーションは **Server Actions**（`src/lib/actions.ts`）または PLPGSQL 関数の RPC
- 多言語：`getLang()` で `ja/en` を取得、`t('key', lang)` で表示文字列を引く
- タイムゾーン：`getTz()` → `toLocalDateStr(tz, date)` で日付文字列化

---

## 3. マルチテナント構成

```
auth.users
  ├── テナントオーナー（管理者アカウント）
  │     └── 全データの owner_id として機能
  └── サブユーザー（tenant_members に登録）
        └── get_owner_id() が オーナーの UUID を返す
              → オーナーのデータをすべて参照・操作可能
```

- `tenant_members` テーブルでオーナーとサブユーザーを紐付け
- すべての RLS ポリシーは `get_owner_id()` 関数を使用
- `user_profiles.role` でサブユーザーの権限ロールを制御

### ロール定義

| ロール | 概要 |
|--------|------|
| admin | 全機能へのアクセス権限 |
| office | 発注・出荷管理・売上・マスタ管理 |
| warehouse | 入荷・出荷確認・在庫操作 |
| viewer | 閲覧専用 |

権限はセクション単位で `role_permissions` テーブルに設定可能。

---

## 4. 伝票モデル（Voucher Model）

入出荷はすべてヘッダー＋明細の 2 層構造で管理します。

```
receipts（入荷ヘッダー）          shipments（出荷ヘッダー）
  │  receipt_no                      │  shipment_no
  │  status                          │  status
  │  supplier_id                     │  destination_id
  │  warehouse_id                    │  carrier_id
  │  expected_date                   │  warehouse_id
  │  source_system                   │  scheduled_date
  │  external_ref_no                 │  source_system
  │                                  │  external_ref_no
  └──< receipt_lines（入荷明細）    └──< shipment_lines（出荷明細）
         product_id                         product_id
         expected_qty                       quantity
         received_qty                       lot_id
         lot_number                         shipped_qty
         expiry_date                        returned_qty
         location_id                        unit_price（スナップショット）
         status                             status
```

ERP / EC との連携は `external_ref_no` / `source_system` で管理。  
1 伝票に複数商品・複数ロットが混在できます。

---

## 5. ステータスフロー

### 入荷ステータス

```
receipts（ヘッダー）:
  expected ──→ receiving ──→ received
                           └→ discrepancy（数量不一致）
                           └→ cancelled

receipt_lines（明細）:
  pending ──→ received
           └→ discrepancy
           └→ cancelled
```

### 出荷ステータス

```
shipments（ヘッダー）:
  requested ──→ allocated ──→ picking ──→ picked ──→ shipped
           └→ shortage                              └→ on_hold
                                                    └→ cancelled

shipment_lines（明細）:
  requested ──→ allocated ──→ shipped
           └→ cancelled
```

---

## 6. ロット管理と在庫モデル

```
inventory（商品単位の集計）
  product_id  PRIMARY KEY
  current_stock   出荷可能な実在庫
  allocated_qty   引当済みで未出荷の数量

lots（ロット単位の明細）
  id, lot_number
  product_id
  quantity         このロットの残数
  expiry_date      賞味期限（FEFO 引当の基準）
  location_id      ロケーション
  warehouse_id     倉庫
  status_id        ロットステータス（検品待ち・返品品 など）
  receipt_line_id  入荷明細との紐付け

inventory_transactions（全在庫変動の監査ログ）
  transaction_type: incoming / cancel_incoming /
                    outgoing / cancel_outgoing /
                    allocate / deallocate /
                    cycle_count / adjustment / return
  operation_id  ユニーク制約（二重処理防止）
```

### FEFO 引当アルゴリズム

`fn_allocate_shipment_line` 内で `expiry_date ASC NULLS LAST, id ASC` 順でロットを選択。  
賞味期限の近いロットから優先的に出荷します。

---

## 7. ビジネスロジック関数（SECURITY DEFINER）

在庫の増減・引当・整合性チェックはすべて DB 関数に集約します。  
フロントエンドから直接 `UPDATE inventory` しません。

| 関数名 | 役割 |
|--------|------|
| `fn_receive_receipt_line` | 入荷明細 1 件を確定（ロット作成 → 在庫増） |
| `fn_unreceive_receipt_line` | 入荷取消（ロット削除 → 在庫減） |
| `fn_allocate_shipment_line` | 出荷明細 1 件を引当（FEFO ロット選択） |
| `fn_deallocate_shipment_line` | 引当解除 |
| `fn_confirm_shipment` | 出荷伝票全体を確定（在庫減 · unit_price 記録） |
| `fn_unship_shipment` | 出荷取消（在庫・ロット復元） |
| `fn_return_shipment_line` | 返品処理（在庫復元） |
| `fn_adjust_lot_quantity` | ロット数量手動調整 |
| `fn_save_cycle_count` | 棚卸し確定（ロット一括更新 → 在庫再集計） |
| `get_owner_id` | マルチテナント用オーナー UUID 取得 |
| `fn_has_active_cycle_count` | 棚卸し中のロックチェック |

---

## 8. スナップショット原則

伝票確定時に重要なマスタ値をスナップショットして明細に保存します。  
マスタを後から変更しても過去の実績が変わりません。

| カラム | 取得タイミング | 元データ |
|--------|--------------|---------|
| `shipment_lines.unit_price` | 出荷確定時（`fn_confirm_shipment`） | `products.price` |
| `shipment_lines.lot_status_name/color` | 引当時（`fn_allocate_shipment_line`） | `inventory_statuses` |
| `shipment_lines.lot_number / expiry_date / location_name / warehouse_name` | 引当時 | `lots` の値 |
| `receipt_lines.supplier_name` 等 | 入荷作成時 | マスタの表示名 |

売上集計は `shipment_lines.unit_price` → なければ `products.price` のフォールバック順で計算します。

---

## 9. 発注推薦アルゴリズム

`src/lib/calculator.ts` / `calculator-logic.ts` で実装。

```
1. 直近 N 日間の sales データから平均日販を計算
2. リードタイム × 平均日販 = 調達期間中の必要数
3. 安全在庫日数 × 平均日販 = バッファ
4. 推薦発注数 = 調達期間中の必要数 + バッファ - 現在在庫
5. 推薦入荷予定日 = 今日 + リードタイム日数
```

---

## 10. ディレクトリ構成

```
src/
├── app/                    # Next.js App Router（ページ）
│   ├── page.tsx           # 発注推薦ボード
│   ├── layout.tsx         # 共通レイアウト・認証・権限チェック
│   ├── dashboard/         # ダッシュボード
│   ├── incoming/          # 入荷管理
│   │   ├── page.tsx       # 入荷確認
│   │   ├── schedule/      # 入荷予定
│   │   └── history/       # 入荷履歴
│   ├── shipping/          # 出荷管理
│   │   ├── schedule/      # 出荷予定
│   │   ├── confirm/       # 出荷確認
│   │   └── history/       # 出荷履歴
│   ├── inventory/         # 在庫管理
│   │   ├── page.tsx       # 在庫一覧
│   │   ├── [id]/          # 商品別在庫詳細
│   │   ├── expiry/        # 賞味期限管理
│   │   ├── cycle-count/   # 棚卸し
│   │   ├── adjust/        # 在庫調整
│   │   ├── transfer/      # 在庫移動
│   │   └── correction/    # 差異解消
│   ├── products/          # 商品マスタ
│   ├── sales/             # 売上
│   │   ├── page.tsx       # 売上入力
│   │   ├── import/        # CSV インポート
│   │   └── report/        # 売上レポート
│   ├── report/daily/      # 日次レポート
│   ├── master/            # マスタ管理
│   │   ├── suppliers/     # 仕入先
│   │   ├── destinations/  # 配送先
│   │   ├── carriers/      # 運送業者
│   │   ├── warehouses/    # 倉庫
│   │   ├── locations/     # ロケーション
│   │   ├── inventory-statuses/ # 在庫ステータス
│   │   └── users/         # ユーザー管理
│   ├── settings/          # 設定
│   │   ├── page.tsx       # 一般設定
│   │   └── permissions/   # 権限設定
│   └── api/               # API ルート
│       └── export-sales/  # 売上 CSV エクスポート
├── components/            # React コンポーネント（43 件）
├── lib/
│   ├── db.ts              # TypeScript 型定義
│   ├── actions.ts         # Server Actions（ミューテーション）
│   ├── calculator.ts      # 発注推薦計算
│   ├── permissions.ts     # 権限定数
│   ├── i18n.ts            # 翻訳関数
│   └── supabase.ts        # Supabase クライアント
├── hooks/                 # React カスタムフック
supabase/
└── migrations/            # SQL マイグレーション（50 件）
```

---

## 11. CSV インポート対応

| 種別 | Server Action |
|------|--------------|
| 売上 | `importSalesCsv()` |
| 入荷予定 | `importIncomingCsv()` |
| 出荷予定 | `importOutgoingCsv()` |
| 商品マスタ | `importProductsCsv()` |
| 各種マスタ | `importMastersCsv()` |

---

## 12. 棚卸し（Cycle Count）フロー

```
1. cycle_count_sessions を draft で作成
2. 各ロットの実数をスキャン → cycle_count_lines に保存
3. 承認待ち (pending_approval) に変更
4. 管理者が承認 → fn_save_cycle_count でロット数量を一括更新
5. applied に変更・入出荷をロック解除
```

棚卸し中（draft / pending_approval）は `fn_has_active_cycle_count` で入出荷を拒否。

---

## 13. 未適用マイグレーション（要実行）

以下のマイグレーションは Supabase SQL エディタで手動実行が必要です。

- `049_shipment_line_lot_status.sql`
- `050_shipment_line_unit_price.sql`
