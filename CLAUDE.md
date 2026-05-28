@AGENTS.md

## Pull Requests

Always write pull request titles and bodies in English.

---

## WMS 設計思想

### 伝票モデル（Voucher Model）

入出荷はすべてヘッダー＋明細の2層構造で管理する。

| 方向 | ヘッダー | 明細 |
|------|----------|------|
| 入荷 | `receipts` | `receipt_lines` |
| 出荷 | `shipments` | `shipment_lines` |

ERP/EC との連携を意識して `external_ref_no` / `source_system` を持つ。
1伝票に複数商品・複数ロットが混在できる。

---

### ステータスフロー

**入荷**
```
expected → receiving → received
                     → discrepancy（数量不一致）
```

**出荷**
```
requested → allocated → shipped
```

ヘッダーと明細の両方にステータスがあり、明細単位で部分確定できる。
- `receipt_lines.status`: expected / received / discrepancy
- `shipment_lines.status`: requested / allocated / shipped / cancelled

---

### ロット管理

- すべての在庫はロット（`lots`）で管理する。ロット番号・賞味期限・ロケーション・倉庫を持つ。
- 引当は **FEFO**（First Expired First Out）で自動選択（`fn_allocate_shipment_line`）。
- ロットにはステータス（`inventory_statuses`）を付与できる（例：検品待ち、返品品）。

---

### 在庫モデル

```
inventory          … product単位の合計在庫（current_stock / allocated_qty）
lots               … ロット単位の残数・賞味期限・ロケーション
inventory_transactions … 全入出荷の監査ログ（transaction_type: incoming / outgoing / allocate / deallocate / …）
```

`current_stock` = 出荷可能な実在庫。`allocated_qty` = 引当済みで未出荷の数量。

---

### スナップショット原則

**伝票確定時に重要なマスタ値をスナップショットして明細に保存する。**
マスタを後から変更しても過去の実績が変わらないようにするため。

| カラム | いつ | 何を |
|--------|------|------|
| `shipment_lines.unit_price` | 出荷確定時（`fn_confirm_shipment`） | `products.price` |
| `shipment_lines.lot_status_name/color` | 引当時（`fn_allocate_shipment_line`） | `inventory_statuses` のステータス |
| `shipment_lines.lot_number / expiry_date / location_name / warehouse_name` | 引当時 | `lots` の値 |
| `receipt_lines` の `supplier_name` 等 | 入荷作成時 | マスタの表示名 |

売上集計は `shipment_lines.unit_price` → なければ `products.price` のフォールバック順で計算する。

---

### ビジネスロジックはDB関数に集約

在庫の増減・引当・整合性チェックは **SECURITY DEFINER の PLPGSQL 関数** に書く。
フロントエンドから直接 `UPDATE inventory` しない。

| 関数 | 役割 |
|------|------|
| `fn_receive_receipt_line` | 入荷明細1件を確定（在庫増） |
| `fn_allocate_shipment_line` | 出荷明細1件を引当（FEFO自動ロット選択） |
| `fn_confirm_shipment` | 出荷伝票全体を確定（在庫減・unit_price記録） |

棚卸し（cycle count）中は `fn_has_active_cycle_count` でロックチェックし、入出荷を拒否する。

---

### ユーザー・権限モデル

- `user_profiles.warehouse_id`：そのユーザーの**デフォルト倉庫**。**管理者がユーザーマスタ（`/master/users`）で設定**する。ユーザー自身の設定画面からは変更できない。
- 入荷予定・出荷予定の伝票作成フォームにはこの値を初期表示する。
- `user_profiles.role`：権限ロール（admin / staff 等）。

---

### Supabase / PostgREST のルール

**埋め込みリソースへのフィルタは使わない。**

```typescript
// NG — .gte('shipments.shipped_at', ...) は動作が不安定で空結果になることがある
supabase.from('shipment_lines')
  .select('..., shipments!inner(shipped_at)')
  .gte('shipments.shipped_at', fromTs)

// OK — フィルタしたいカラムのテーブルをルートにする
supabase.from('shipments')
  .select('shipped_at, shipment_lines!inner(...)')
  .gte('shipped_at', fromTs)
```

`!inner` は使ってよい（JOIN に相当し、マッチしない親行を除外する）。

---

### フロントエンド構成

- **Server Components** でデータ取得（`createClient()` → `supabase.from(...).select(...)`）
- **Client Components** はインタラクションのみ（フォーム・トグル・アニメーション）
- ミューテーションは **Server Actions**（`src/lib/actions.ts`）または PLPGSQL 関数の RPC 呼び出し
- 多言語：`getLang()` で `ja/en` を取得、`t('key', lang)` で表示文字列を引く
- タイムゾーン：`getTz()` → `toLocalDateStr(tz, date)` で日付文字列化

---

### 直近の対応履歴（参考）

| PR | 内容 |
|----|------|
| #152 | 入荷確認：ロケーション選択バグ修正、倉庫必須化、仕入先を倉庫の下に移動 |
| #153 | 出荷確認・履歴：ロットステータス・賞味期限・ロケーション表示、入荷済みバッジ |
| #154 | 出荷予定：倉庫フィールド追加（必須）、デフォルト倉庫を `user_profiles` から取得 |
| #155 | 売上ページ：クエリバグ修正（ルートテーブル変更） |
| #156 | 売上レポート：同クエリバグ修正＋Migration 050（unit_price スナップショット） |

**未適用マイグレーション（Supabase SQL エディタで要実行）**
- `049_shipment_line_lot_status.sql`
- `050_shipment_line_unit_price.sql`
