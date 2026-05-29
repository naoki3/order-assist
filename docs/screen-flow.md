# 画面遷移図 — order-assist WMS

## 1. 認証フロー

```mermaid
flowchart TD
    A([アクセス]) --> B{認証済み?}
    B -- No --> C[/login\nログイン画面/]
    B -- Yes --> D[/ \n発注推薦ボード/]
    C --> E{ログイン成功?}
    E -- No --> C
    E -- Yes --> D
    C --> F[/signup\nサインアップ/]
    F --> C
```

---

## 2. 全体ナビゲーション（サイドバー）

権限ロールによってセクションの表示・非表示が制御されます。

```mermaid
flowchart LR
    SIDEBAR["サイドバー（Sidebar）"]

    SIDEBAR --> HOME["/ 発注推薦"]
    SIDEBAR --> DASH["/dashboard ダッシュボード"]
    SIDEBAR --> INCOMING["入荷セクション"]
    SIDEBAR --> SHIPPING["出荷セクション"]
    SIDEBAR --> INVENTORY["在庫セクション"]
    SIDEBAR --> PRODUCTS["/products 商品マスタ"]
    SIDEBAR --> SALES["売上セクション"]
    SIDEBAR --> MASTER["マスタセクション"]
    SIDEBAR --> SETTINGS["設定セクション"]
```

---

## 3. 発注推薦（ホーム）

```mermaid
flowchart TD
    HOME["/ 発注推薦ボード\n(OrderBoard)"]
    HOME --> |商品カードをクリック| PRODUCT_DETAIL["/products/[id]\n商品詳細"]
    HOME --> |発注ボタン| CONFIRM_ORDER["発注確認ダイアログ"]
    CONFIRM_ORDER --> |確定| CREATE_RECEIPT["入荷予定を自動作成\n(placeOrder Server Action)"]
    CREATE_RECEIPT --> |成功| INCOMING_SCHEDULE["/incoming/schedule\n入荷予定一覧"]
    CONFIRM_ORDER --> |キャンセル| HOME
```

---

## 4. 入荷管理フロー

```mermaid
flowchart TD
    INCOMING_TOP["入荷管理"]

    INCOMING_TOP --> INC_SCHED["/incoming/schedule\n入荷予定一覧\n(IncomingScheduleList)"]
    INCOMING_TOP --> INC_CONF["/incoming\n入荷確認\n(IncomingConfirmList)"]
    INCOMING_TOP --> INC_HIST["/incoming/history\n入荷履歴\n(ReceivedHistoryList)"]

    INC_SCHED --> |新規追加| INC_FORM["IncomingScheduleForm\n（倉庫・仕入先・商品・数量・予定日）"]
    INC_SCHED --> |CSV取込| INC_CSV["IncomingCsvImport"]
    INC_SCHED --> |編集| INC_FORM
    INC_FORM --> |保存| INC_SCHED

    INC_CONF --> |入荷確認ボタン| RECEIVE_DIALOG["入荷確認ダイアログ\n（ロット番号・賞味期限・ロケーション入力）"]
    RECEIVE_DIALOG --> |確定| FN_RECEIVE["fn_receive_receipt_line\n（ロット作成 → 在庫加算）"]
    FN_RECEIVE --> |成功| INC_CONF
    RECEIVE_DIALOG --> |キャンセル| INC_CONF

    INC_CONF --> |入荷取消| FN_UNRECEIVE["fn_unreceive_receipt_line\n（ロット削除 → 在庫減算）"]
    FN_UNRECEIVE --> INC_CONF

    INC_HIST --> |伝票番号クリック| INC_HIST_DETAIL["入荷履歴詳細（明細表示）"]
```

---

## 5. 出荷管理フロー

```mermaid
flowchart TD
    SHIPPING_TOP["出荷管理"]

    SHIPPING_TOP --> SHP_SCHED["/shipping/schedule\n出荷予定一覧\n(OutgoingScheduleList)"]
    SHIPPING_TOP --> SHP_CONF["/shipping/confirm\n出荷確認\n(ShippingConfirmClient)"]
    SHIPPING_TOP --> SHP_HIST["/shipping/history\n出荷履歴\n(ShippedHistoryList)"]

    SHP_SCHED --> |新規追加| SHP_FORM["OutgoingScheduleForm\n（倉庫・配送先・運送業者・商品・数量・予定日）"]
    SHP_SCHED --> |CSV取込| SHP_CSV["OutgoingCsvImport"]
    SHP_SCHED --> |編集| SHP_FORM
    SHP_FORM --> |保存| SHP_SCHED

    SHP_CONF --> |引当ボタン| FN_ALLOC["fn_allocate_shipment_line\n（FEFO ロット選択 → allocated_qty 加算）"]
    FN_ALLOC --> |成功| SHP_CONF
    FN_ALLOC --> |在庫不足| ERR["エラー表示"]

    SHP_CONF --> |引当解除| FN_DEALLOC["fn_deallocate_shipment_line"]
    FN_DEALLOC --> SHP_CONF

    SHP_CONF --> |出荷確定| FN_CONFIRM["fn_confirm_shipment\n（在庫減算 · unit_price スナップショット）"]
    FN_CONFIRM --> |成功| SHP_CONF

    SHP_HIST --> |伝票番号クリック| SHP_HIST_DETAIL["出荷履歴詳細（明細・ロット情報表示）"]
    SHP_HIST --> |返品ボタン| FN_RETURN["fn_return_shipment_line\n（在庫復元）"]
    FN_RETURN --> SHP_HIST
```

---

## 6. 在庫管理フロー

```mermaid
flowchart TD
    INV_TOP["在庫管理"]

    INV_TOP --> INV_LIST["/inventory\n在庫一覧\n(InventoryListClient)"]
    INV_TOP --> INV_EXPIRY["/inventory/expiry\n賞味期限管理"]
    INV_TOP --> INV_CC["/inventory/cycle-count\n棚卸し\n(CycleCountClient)"]
    INV_TOP --> INV_ADJ["/inventory/adjust\n在庫調整\n(StockAdjustForm)"]
    INV_TOP --> INV_TRF["/inventory/transfer\n在庫移動\n(StockTransferForm)"]
    INV_TOP --> INV_CORR["/inventory/correction\n差異解消\n(LotCorrectionForm)"]

    INV_LIST --> |商品をクリック| INV_DETAIL["/inventory/[id]\n商品別在庫詳細\n(InventoryDetailClient)"]
    INV_DETAIL --> |ロット調整| LOT_ADJ["LotAdjustForm\n(fn_adjust_lot_quantity)"]
    INV_DETAIL --> |引当一覧| LOT_ALLOC["LotAllocationList"]

    INV_CC --> |カウント開始| CC_SESSION["棚卸しセッション作成\n(cycle_count_sessions)"]
    CC_SESSION --> |実数入力| CC_LINES["cycle_count_lines に記録"]
    CC_LINES --> |承認申請| CC_PENDING["pending_approval"]
    CC_PENDING --> |管理者承認| FN_CC["fn_save_cycle_count\n（ロット一括更新 → 在庫再集計）"]
    FN_CC --> |完了| CC_APPLIED["applied"]

    INV_ADJ --> |調整保存| FN_ADJ["fn_adjust_lot_quantity\n(updateStock Server Action)"]

    INV_EXPIRY --> |期限切れロット表示| INV_DETAIL
```

---

## 7. 商品マスタ管理

```mermaid
flowchart TD
    PROD_LIST["/products\n商品一覧\n(ProductListClient)"]
    PROD_LIST --> |新規追加| PROD_FORM["AddProductForm\n（名称・リードタイム・安全在庫日数・価格・棚番等）"]
    PROD_LIST --> |CSV取込| PROD_CSV["ProductCsvImport"]
    PROD_LIST --> |商品クリック| PROD_DETAIL["/products/[id]\n商品詳細"]
    PROD_FORM --> |保存 (addProduct)| PROD_LIST
    PROD_DETAIL --> |編集| PROD_EDIT_FORM["updateProduct Server Action"]
    PROD_DETAIL --> |削除| PROD_DELETE["deleteProduct Server Action"]
    PROD_DELETE --> PROD_LIST
```

---

## 8. 売上管理フロー

```mermaid
flowchart TD
    SALES_TOP["売上管理"]

    SALES_TOP --> SALES_ENTRY["/sales\n売上入力\n(SaleForm)"]
    SALES_TOP --> SALES_IMPORT["/sales/import\nCSV インポート\n(CsvImportForm)"]
    SALES_TOP --> SALES_REPORT["/sales/report\n売上レポート\n(SalesReportCharts)"]
    SALES_TOP --> DAILY_REPORT["/report/daily\n日次レポート\n(DailyReportClient)"]

    SALES_ENTRY --> |保存 (upsertProductSales)| SALES_ENTRY
    SALES_IMPORT --> |CSV アップロード (importSalesCsv)| SALES_ENTRY

    SALES_REPORT --> |期間・商品フィルタ| SALES_REPORT
    DAILY_REPORT --> |日付選択| DAILY_REPORT

    SALES_REPORT --> |CSV エクスポート| EXPORT_API["/api/export-sales"]
```

---

## 9. マスタ管理

```mermaid
flowchart TD
    MASTER_TOP["マスタ管理"]

    MASTER_TOP --> MST_SUP["/master/suppliers\n仕入先\n(MasterList)"]
    MASTER_TOP --> MST_DEST["/master/destinations\n配送先\n(MasterList)"]
    MASTER_TOP --> MST_CAR["/master/carriers\n運送業者\n(MasterList)"]
    MASTER_TOP --> MST_WH["/master/warehouses\n倉庫\n(MasterList)"]
    MASTER_TOP --> MST_LOC["/master/locations\nロケーション\n(MasterList)"]
    MASTER_TOP --> MST_IS["/master/inventory-statuses\n在庫ステータス\n(MasterList)"]
    MASTER_TOP --> MST_USR["/master/users\nユーザー管理\n(UserAccountManager)"]

    MST_USR --> |新規ユーザー招待| USR_FORM["ユーザー作成\n（ロール・倉庫割り当て）"]
    MST_USR --> |ロール変更| USR_EDIT["user_profiles 更新"]
    MST_USR --> |有効・無効切替| USR_TOGGLE["is_active 更新"]

    MST_CSV["MasterCsvImport"] --> MST_SUP
    MST_CSV --> MST_DEST
    MST_CSV --> MST_CAR
```

---

## 10. 設定フロー

```mermaid
flowchart TD
    SETTINGS["/settings\n設定（SettingsForm）"]
    SETTINGS --> |言語・タイムゾーン・通貨| SETTINGS
    SETTINGS --> PERMS["/settings/permissions\n権限設定\n(RolePermissionsEditor)"]
    PERMS --> |ロール別セクション権限を保存| ROLE_PERM_TABLE["role_permissions テーブル更新"]
```

---

## 11. ダッシュボード

```mermaid
flowchart TD
    DASH["/dashboard\nダッシュボード\n(DashboardCharts)"]
    DASH --> |在庫推移グラフ| DASH
    DASH --> |売上推移グラフ| DASH
    DASH --> |アラート（在庫切れ・期限切れ）| INV_LIST["/inventory"]
    DASH --> |在庫不足商品クリック| HOME["/ 発注推薦"]
```

---

## 12. 主要画面一覧

| URL | 画面名 | 主なコンポーネント |
|-----|--------|------------------|
| `/` | 発注推薦ボード | OrderBoard, ProductCard |
| `/dashboard` | ダッシュボード | DashboardCharts |
| `/incoming` | 入荷確認 | IncomingConfirmList |
| `/incoming/schedule` | 入荷予定 | IncomingScheduleList, IncomingScheduleForm |
| `/incoming/history` | 入荷履歴 | ReceivedHistoryList |
| `/shipping/schedule` | 出荷予定 | OutgoingScheduleList, OutgoingScheduleForm |
| `/shipping/confirm` | 出荷確認 | ShippingConfirmClient |
| `/shipping/history` | 出荷履歴 | ShippedHistoryList |
| `/inventory` | 在庫一覧 | InventoryListClient |
| `/inventory/[id]` | 在庫詳細 | InventoryDetailClient, LotAdjustForm |
| `/inventory/expiry` | 賞味期限管理 | — |
| `/inventory/cycle-count` | 棚卸し | CycleCountClient |
| `/inventory/adjust` | 在庫調整 | StockAdjustForm |
| `/inventory/transfer` | 在庫移動 | StockTransferForm |
| `/inventory/correction` | 差異解消 | LotCorrectionForm |
| `/products` | 商品一覧 | ProductListClient, AddProductForm |
| `/products/[id]` | 商品詳細 | — |
| `/sales` | 売上入力 | SaleForm |
| `/sales/import` | CSV インポート | CsvImportForm |
| `/sales/report` | 売上レポート | SalesReportCharts |
| `/report/daily` | 日次レポート | DailyReportClient |
| `/master/suppliers` | 仕入先マスタ | MasterList |
| `/master/destinations` | 配送先マスタ | MasterList |
| `/master/carriers` | 運送業者マスタ | MasterList |
| `/master/warehouses` | 倉庫マスタ | MasterList |
| `/master/locations` | ロケーションマスタ | MasterList |
| `/master/inventory-statuses` | 在庫ステータスマスタ | MasterList |
| `/master/users` | ユーザー管理 | UserAccountManager |
| `/settings` | 一般設定 | SettingsForm |
| `/settings/permissions` | 権限設定 | RolePermissionsEditor |
| `/login` | ログイン | — |
| `/signup` | サインアップ | — |
