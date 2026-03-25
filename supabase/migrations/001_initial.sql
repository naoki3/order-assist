-- Schema

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  lead_time_days INTEGER NOT NULL DEFAULT 2,
  safety_stock_days INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE sales (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  UNIQUE(product_id, date)
);

CREATE TABLE inventory (
  product_id BIGINT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  current_stock INTEGER NOT NULL DEFAULT 0,
  updated_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE order_history (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  items TEXT NOT NULL
);

CREATE TABLE incoming_stock (
  id BIGSERIAL PRIMARY KEY,
  order_history_id BIGINT NOT NULL REFERENCES order_history(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  expected_date DATE NOT NULL,
  received_at TIMESTAMPTZ
);

-- Disable RLS (using anon key from server side)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE incoming_stock DISABLE ROW LEVEL SECURITY;

-- Seed data (5 sample products with 14 days of sales history)

INSERT INTO products (name, lead_time_days, safety_stock_days) VALUES
  ('Milk 1L', 1, 1),
  ('Bread', 1, 1),
  ('Eggs (10 pack)', 2, 1),
  ('Yogurt', 2, 1),
  ('Orange Juice', 3, 2);

INSERT INTO inventory (product_id, current_stock, updated_at) VALUES
  (1, 18, CURRENT_DATE),
  (2,  5, CURRENT_DATE),
  (3, 30, CURRENT_DATE),
  (4,  8, CURRENT_DATE),
  (5, 12, CURRENT_DATE);

-- Sales: 14 days ending the day before 2026-03-24 (i.e. 2026-03-10 to 2026-03-23)
INSERT INTO sales (product_id, date, quantity) VALUES
  (1, '2026-03-10', 14), (1, '2026-03-11', 16), (1, '2026-03-12', 15),
  (1, '2026-03-13', 13), (1, '2026-03-14', 17), (1, '2026-03-15', 14),
  (1, '2026-03-16', 15), (1, '2026-03-17', 16), (1, '2026-03-18', 18),
  (1, '2026-03-19', 14), (1, '2026-03-20', 15), (1, '2026-03-21', 16),
  (1, '2026-03-22', 14), (1, '2026-03-23', 15),

  (2, '2026-03-10', 22), (2, '2026-03-11', 20), (2, '2026-03-12', 19),
  (2, '2026-03-13', 21), (2, '2026-03-14', 23), (2, '2026-03-15', 20),
  (2, '2026-03-16', 22), (2, '2026-03-17', 24), (2, '2026-03-18', 25),
  (2, '2026-03-19', 23), (2, '2026-03-20', 22), (2, '2026-03-21', 24),
  (2, '2026-03-22', 25), (2, '2026-03-23', 23),

  (3, '2026-03-10', 10), (3, '2026-03-11',  9), (3, '2026-03-12', 11),
  (3, '2026-03-13', 10), (3, '2026-03-14', 12), (3, '2026-03-15', 10),
  (3, '2026-03-16',  9), (3, '2026-03-17', 11), (3, '2026-03-18', 10),
  (3, '2026-03-19',  9), (3, '2026-03-20', 10), (3, '2026-03-21', 11),
  (3, '2026-03-22', 10), (3, '2026-03-23',  9),

  (4, '2026-03-10',  6), (4, '2026-03-11',  7), (4, '2026-03-12',  6),
  (4, '2026-03-13',  7), (4, '2026-03-14',  8), (4, '2026-03-15',  8),
  (4, '2026-03-16',  9), (4, '2026-03-17',  9), (4, '2026-03-18', 10),
  (4, '2026-03-19', 10), (4, '2026-03-20', 11), (4, '2026-03-21', 11),
  (4, '2026-03-22', 12), (4, '2026-03-23', 12),

  (5, '2026-03-10',  5), (5, '2026-03-11',  4), (5, '2026-03-12',  5),
  (5, '2026-03-13',  5), (5, '2026-03-14',  4), (5, '2026-03-15',  6),
  (5, '2026-03-16',  5), (5, '2026-03-17',  5), (5, '2026-03-18',  4),
  (5, '2026-03-19',  5), (5, '2026-03-20',  5), (5, '2026-03-21',  4),
  (5, '2026-03-22',  5), (5, '2026-03-23',  5);
