import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'orders.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Global singleton to survive HMR in dev
const globalForDb = global as unknown as { db?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.db) {
    globalForDb.db = new Database(DB_PATH);
    globalForDb.db.pragma('journal_mode = WAL');
    initSchema(globalForDb.db);
  }
  return globalForDb.db;
}

export interface Product {
  id: number;
  name: string;
  lead_time_days: number;
  safety_stock_days: number;
}

export interface Sale {
  id: number;
  product_id: number;
  date: string;
  quantity: number;
}

export interface Inventory {
  product_id: number;
  current_stock: number;
  updated_at: string;
}

export interface OrderHistoryItem {
  id: number;
  created_at: string;
  items: string; // JSON
}

export interface IncomingStock {
  id: number;
  order_history_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  expected_date: string;
  received_at: string | null;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lead_time_days INTEGER NOT NULL DEFAULT 2,
      safety_stock_days INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      UNIQUE(product_id, date)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      current_stock INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS order_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      items TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incoming_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_history_id INTEGER NOT NULL REFERENCES order_history(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      expected_date TEXT NOT NULL,
      received_at TEXT
    );
  `);

  // Seed sample data if empty
  const count = db.prepare('SELECT COUNT(*) as n FROM products').get() as { n: number };
  if (count.n === 0) {
    seedSampleData(db);
  }
}

function seedSampleData(db: Database.Database) {
  const insertProduct = db.prepare(
    'INSERT INTO products (name, lead_time_days, safety_stock_days) VALUES (?, ?, ?)'
  );
  const insertSale = db.prepare(
    'INSERT OR IGNORE INTO sales (product_id, date, quantity) VALUES (?, ?, ?)'
  );
  const insertInventory = db.prepare(
    "INSERT INTO inventory (product_id, current_stock, updated_at) VALUES (?, ?, date('now'))"
  );

  const products = [
    { name: '牛乳 1L', lead_time_days: 1, safety_stock_days: 1, stock: 18, dailySales: [14, 16, 15, 13, 17, 14, 15, 16, 18, 14, 15, 16, 14, 15] },
    { name: '食パン', lead_time_days: 1, safety_stock_days: 1, stock: 5, dailySales: [22, 20, 19, 21, 23, 20, 22, 24, 25, 23, 22, 24, 25, 23] },
    { name: 'たまご (10個)', lead_time_days: 2, safety_stock_days: 1, stock: 30, dailySales: [10, 9, 11, 10, 12, 10, 9, 11, 10, 9, 10, 11, 10, 9] },
    { name: 'ヨーグルト', lead_time_days: 2, safety_stock_days: 1, stock: 8, dailySales: [6, 7, 6, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12] },
    { name: 'オレンジジュース', lead_time_days: 3, safety_stock_days: 2, stock: 12, dailySales: [5, 4, 5, 5, 4, 6, 5, 5, 4, 5, 5, 4, 5, 5] },
  ];

  // Today is 2026-03-24, yesterday is 2026-03-23
  // Generate dates for last 14 days ending yesterday
  const today = new Date('2026-03-24');
  const dates: string[] = [];
  for (let i = 14; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  for (const p of products) {
    const result = insertProduct.run(p.name, p.lead_time_days, p.safety_stock_days);
    const productId = result.lastInsertRowid as number;
    insertInventory.run(productId, p.stock);
    for (let i = 0; i < dates.length; i++) {
      insertSale.run(productId, dates[i], p.dailySales[i]);
    }
  }
}
