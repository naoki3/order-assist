export type Lang = 'ja' | 'en';

export const translations = {
  ja: {
    // Nav
    'nav.dashboard': 'ダッシュボード',
    'nav.incomingStock': '入荷確認',
    'nav.inventoryGroup': '在庫',
    'nav.inventory': '在庫',
    'nav.inventoryAdjust': '在庫調整',
    'nav.ordersGroup': '発注',
    'nav.orderReview': '発注確認',
    'nav.orderHistory': '発注履歴',
    'nav.salesGroup': '売上',
    'nav.salesReport': '売上レポート',
    'nav.salesEntry': '売上入力',
    'nav.products': '商品',
    'nav.logout': 'ログアウト',

    // OrderBoard
    'order.placed': '発注完了！',
    'order.reviewInHistory': '詳細は発注履歴で確認できます',
    'order.back': '戻る',
    'order.stockoutRisk': '在庫切れリスク',
    'order.overstock': '過剰在庫',
    'order.stockLabel': '在庫',
    'order.requiredLabel': '必要',
    'order.estimatedValue': '発注金額合計：',
    'order.processing': '処理中...',
    'order.noProducts': '発注する商品がありません',
    'order.placeOrder': (n: number) => `発注する（${n}件）`,

    // Home
    'home.title': '今日の発注確認',
    'home.subtitle': '過去7日間の売上から自動計算。数量を調整して発注してください。',
    'home.noProducts': '商品が登録されていません',
    'home.addProducts': '商品ページから追加してください',

    // Dashboard
    'dashboard.title': 'ダッシュボード',
    'dashboard.noProducts': '商品がまだ登録されていません',
    'dashboard.snapshot': '本日のサマリー',
    'dashboard.stockoutRisk': '在庫切れリスク',
    'dashboard.overstock': '過剰在庫',
    'dashboard.products': '商品数',
    'dashboard.total': '合計',
    'dashboard.orderValue': '発注金額',
    'dashboard.todayEstimate': '本日の見積もり',
    'dashboard.stockStatus': '在庫状況',
    'dashboard.units': '個',
    'dashboard.sufficient': '十分',
    'dashboard.low': '少ない',
    'dashboard.critical': '危険',
    'dashboard.daysRemaining': (days: string, lead: number) => `在庫残り ${days} 日分 — リードタイム ${lead} 日`,
    'dashboard.overstockDays': (days: string, rec: number) => `在庫 ${days} 日分 — 推奨 ${rec} 日`,

    // Inventory
    'inventory.title': '在庫',
    'inventory.adjustTitle': '在庫調整',
    'inventory.noProducts': '商品が登録されていません',
    'inventory.units': '個',

    // Products
    'products.title': '商品',
    'products.noProducts': '商品がまだありません。下から追加してください。',
    'products.namePlaceholder': '商品名',
    'products.save': '保存',
    'products.leadTime': 'リードタイム',
    'products.safetyStock': '安全在庫',
    'products.days': '日',
    'products.unitPrice': '単価',
    'products.optional': '任意',
    'products.currentStock': '現在在庫：',
    'products.units': '個',
    'products.update': '更新',
    'products.delete': '削除',
    'products.addTitle': '商品を追加',
    'products.addButton': '商品を追加する',

    // Sales
    'sales.title': '売上入力',
    'sales.importCsv': 'CSVインポート',
    'sales.exportCsv': 'CSVエクスポート',
    'sales.subtitle': '過去7日間の実売数を入力してください',
    'sales.noProducts': '商品が登録されていません',
    'sales.units': '個',
    'sales.total': '合計',
    'sales.saving': '保存中...',
    'sales.save': '保存',
    'sales.report': '売上レポート',

    // Sales Import
    'import.back': '← 売上入力に戻る',
    'import.title': '売上CSVインポート',
    'import.subtitle': 'CSVファイルをアップロードして売上データを一括登録できます。同じ商品・日付のデータは上書きされます。',
    'import.csvTitle': '売上CSVインポート',
    'import.formatLabel': '形式：',
    'import.formatSuffix': '（ヘッダー行は任意）',
    'import.formatTitle': 'CSVフォーマット',
    'import.hint1': 'ヘッダー行は任意',
    'import.hint2': '日付形式：YYYY-MM-DD',
    'import.hint3': '商品名は完全一致（大文字小文字不問）',
    'import.hint4': '不明な商品はスキップして報告されます',
    'import.importing': 'インポート中...',
    'import.import': 'インポート',
    'import.imported': (n: number) => `${n}件インポートしました`,
    'import.skipped': (n: number) => `${n}件スキップ`,

    // Incoming
    'incoming.title': '入荷管理',
    'incoming.subtitle': '入荷確認すると自動的に在庫に反映されます',
    'incoming.awaiting': '入荷待ち',
    'incoming.noAwaiting': '入荷待ちの商品はありません',
    'incoming.quantity': (n: number, date: string) => `${n} 個 · 入荷予定 ${date}`,
    'incoming.received': '入荷済み（直近20件）',
    'incoming.receivedQty': (n: number, date: string) => `${n} 個 · 入荷日 ${date}`,
    'incoming.receivedLabel': '入荷済み',
    'incoming.markReceived': '入荷確認',

    // History
    'history.title': '発注履歴',
    'history.noHistory': '発注履歴がありません',
    'history.units': '個',

    // Login
    'login.subtitle': 'Inventory & Order Management',
    'login.email': 'Email',
    'login.password': 'パスワード',
    'login.showPassword': 'パスワードを表示',
    'login.hidePassword': 'パスワードを非表示',
    'login.signingIn': 'サインイン中...',
    'login.signIn': 'サインイン',
    'login.noAccount': 'アカウントをお持ちでない方は',
    'login.signup': '新規登録',
  },

  en: {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.incomingStock': 'Incoming',
    'nav.inventoryGroup': 'Inventory',
    'nav.inventory': 'Stock View',
    'nav.inventoryAdjust': 'Adjust Stock',
    'nav.ordersGroup': 'Orders',
    'nav.orderReview': 'Order Review',
    'nav.orderHistory': 'Order History',
    'nav.salesGroup': 'Sales',
    'nav.salesReport': 'Sales Report',
    'nav.salesEntry': 'Sales Entry',
    'nav.products': 'Products',
    'nav.logout': 'Logout',

    // OrderBoard
    'order.placed': 'Order placed!',
    'order.reviewInHistory': 'You can review the details in Order History',
    'order.back': 'Back',
    'order.stockoutRisk': 'Stockout risk',
    'order.overstock': 'Overstock',
    'order.stockLabel': 'Stock',
    'order.requiredLabel': 'Required',
    'order.estimatedValue': 'Estimated order value: ',
    'order.processing': 'Processing...',
    'order.noProducts': 'No products to order',
    'order.placeOrder': (n: number) => `Place order (${n} item${n === 1 ? '' : 's'})`,

    // Home
    'home.title': "Today's Order Review",
    'home.subtitle': 'Auto-calculated from the past 7 days of sales. Adjust quantities and place your order.',
    'home.noProducts': 'No products registered',
    'home.addProducts': 'Add products from the Products page',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.noProducts': 'No products registered yet',
    'dashboard.snapshot': "Today's snapshot",
    'dashboard.stockoutRisk': 'Stockout Risk',
    'dashboard.overstock': 'Overstock',
    'dashboard.products': 'Products',
    'dashboard.total': 'total',
    'dashboard.orderValue': 'Order Value',
    'dashboard.todayEstimate': "today's estimate",
    'dashboard.stockStatus': 'Stock Status',
    'dashboard.units': 'units',
    'dashboard.sufficient': 'Sufficient',
    'dashboard.low': 'Low',
    'dashboard.critical': 'Critical',
    'dashboard.daysRemaining': (days: string, lead: number) => `${days} days of stock remaining — lead time is ${lead} days`,
    'dashboard.overstockDays': (days: string, rec: number) => `${days} days of stock — recommended ${rec} days`,

    // Inventory
    'inventory.title': 'Inventory',
    'inventory.adjustTitle': 'Adjust Stock',
    'inventory.noProducts': 'No products registered',
    'inventory.units': 'units',

    // Products
    'products.title': 'Products',
    'products.noProducts': 'No products yet. Add one below.',
    'products.namePlaceholder': 'Product name',
    'products.save': 'Save',
    'products.leadTime': 'Lead time',
    'products.safetyStock': 'Safety stock',
    'products.days': 'days',
    'products.unitPrice': 'Unit price',
    'products.optional': 'Optional',
    'products.currentStock': 'Current stock:',
    'products.units': 'units',
    'products.update': 'Update',
    'products.delete': 'Delete',
    'products.addTitle': 'Add New Product',
    'products.addButton': 'Add Product',

    // Sales
    'sales.title': 'Sales Entry',
    'sales.importCsv': 'Import CSV',
    'sales.exportCsv': 'Export CSV',
    'sales.subtitle': 'Enter actual sales for the past 7 days',
    'sales.noProducts': 'No products registered',
    'sales.units': 'units',
    'sales.total': 'Total',
    'sales.saving': 'Saving...',
    'sales.save': 'Save',
    'sales.report': 'Sales Report',

    // Sales Import
    'import.back': '← Back to Sales Entry',
    'import.title': 'Import Sales CSV',
    'import.subtitle': 'Upload a CSV file to bulk-import sales data. Existing entries for the same product/date will be overwritten.',
    'import.csvTitle': 'Import Sales CSV',
    'import.formatLabel': 'Format: ',
    'import.formatSuffix': ' (header row optional)',
    'import.formatTitle': 'Expected CSV format',
    'import.hint1': 'Header row is optional',
    'import.hint2': 'Date format: YYYY-MM-DD',
    'import.hint3': 'Product name must match exactly (case-insensitive)',
    'import.hint4': 'Unknown products are skipped and reported',
    'import.importing': 'Importing...',
    'import.import': 'Import',
    'import.imported': (n: number) => `Imported ${n} row${n !== 1 ? 's' : ''}`,
    'import.skipped': (n: number) => `${n} row${n !== 1 ? 's' : ''} skipped`,

    // Incoming
    'incoming.title': 'Incoming Stock',
    'incoming.subtitle': 'Marking as received automatically adds to inventory',
    'incoming.awaiting': 'Awaiting Delivery',
    'incoming.noAwaiting': 'No items awaiting delivery',
    'incoming.quantity': (n: number, date: string) => `${n} units · Expected ${date}`,
    'incoming.received': 'Received (Last 20)',
    'incoming.receivedQty': (n: number, date: string) => `${n} units · Received ${date}`,
    'incoming.receivedLabel': 'Received',
    'incoming.markReceived': 'Mark Received',

    // History
    'history.title': 'Order History',
    'history.noHistory': 'No order history',
    'history.units': 'units',

    // Login
    'login.subtitle': 'Inventory & Order Management',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.showPassword': 'Show password',
    'login.hidePassword': 'Hide password',
    'login.signingIn': 'Signing in...',
    'login.signIn': 'Sign in',
    'login.noAccount': "Don't have an account?",
    'login.signup': 'Sign up',
  },
} as const;

export type TranslationKey = keyof typeof translations.ja;

export function t(key: TranslationKey, lang: Lang): string {
  const val = (translations[lang] as Record<string, unknown>)[key];
  if (typeof val === 'string') return val;
  return key;
}

export function getLangFromCookie(cookieHeader: string | null): Lang {
  if (!cookieHeader) return 'ja';
  const match = cookieHeader.match(/(?:^|;\s*)lang=([^;]+)/);
  return match?.[1] === 'en' ? 'en' : 'ja';
}
