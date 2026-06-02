-- ═══════════════════════════════════════════════════════════════════════════
-- 037_receipts_shipments.sql
-- 入荷・出荷の伝票ヘッダー+明細への再設計
--
-- 設計思想:
--   入荷: receipts (ヘッダー) + receipt_lines (明細)
--   出荷: shipments (ヘッダー) + shipment_lines (明細)
--   上位連携 (ERP/EC) を意識した external_ref_no / source_system 管理
--
-- 移行戦略:
--   既存 incoming_stock / outgoing_stock を 1:1 でそのまま移行 (ID 保存)
--   receipt.id = receipt_line.id = 旧 incoming_stock.id
--   shipment.id = shipment_line.id = 旧 outgoing_stock.id
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 入荷伝票ヘッダー ────────────────────────────────────────────────────────

CREATE TABLE receipts (
  id               bigserial PRIMARY KEY,
  receipt_no       text NOT NULL,
  receipt_type     text NOT NULL DEFAULT 'planned'
                   CHECK (receipt_type IN ('planned','adhoc','return','transfer')),
  status           text NOT NULL DEFAULT 'expected'
                   CHECK (status IN ('expected','receiving','received','discrepancy','cancelled')),
  supplier_id      bigint REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name    text,
  warehouse_id     bigint REFERENCES warehouses(id) ON DELETE SET NULL,
  warehouse_name   text,
  external_ref_no  text,
  source_system    text NOT NULL DEFAULT 'manual'
                   CHECK (source_system IN ('manual','csv','api','order')),
  order_history_id bigint REFERENCES order_history(id) ON DELETE SET NULL,
  expected_date    date NOT NULL,
  received_at      timestamptz,
  note             text,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX receipts_receipt_no_user_idx ON receipts (receipt_no, user_id);
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_receipts" ON receipts FOR ALL
  USING  (user_id = get_owner_id())
  WITH CHECK (user_id = get_owner_id());

-- ── 入荷明細 ────────────────────────────────────────────────────────────────

CREATE TABLE receipt_lines (
  id             bigserial PRIMARY KEY,
  receipt_id     bigint NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  product_id     bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name   text NOT NULL,
  expected_qty   integer NOT NULL CHECK (expected_qty > 0),
  received_qty   integer,
  lot_number     text,
  expiry_date    date,
  location_id    bigint REFERENCES locations(id) ON DELETE SET NULL,
  location_name  text,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','received','discrepancy','cancelled')),
  note           text,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX receipt_lines_receipt_id_idx ON receipt_lines (receipt_id);
CREATE INDEX receipt_lines_product_id_idx ON receipt_lines (product_id);
ALTER TABLE receipt_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_receipt_lines" ON receipt_lines FOR ALL
  USING  (user_id = get_owner_id())
  WITH CHECK (user_id = get_owner_id());

-- ── 出荷伝票ヘッダー ────────────────────────────────────────────────────────

CREATE TABLE shipments (
  id               bigserial PRIMARY KEY,
  shipment_no      text NOT NULL,
  shipment_type    text NOT NULL DEFAULT 'normal'
                   CHECK (shipment_type IN ('normal','sample','internal_use','disposal','transfer','return_reship')),
  status           text NOT NULL DEFAULT 'requested'
                   CHECK (status IN ('requested','allocated','shortage','picking','picked','shipped','cancelled','on_hold')),
  destination_id   bigint REFERENCES delivery_destinations(id) ON DELETE SET NULL,
  destination_name text,
  carrier_id       bigint REFERENCES carriers(id) ON DELETE SET NULL,
  carrier_name     text,
  warehouse_id     bigint REFERENCES warehouses(id) ON DELETE SET NULL,
  warehouse_name   text,
  external_ref_no  text,
  source_system    text NOT NULL DEFAULT 'manual'
                   CHECK (source_system IN ('manual','csv','api','order')),
  scheduled_date   date NOT NULL,
  shipped_at       timestamptz,
  note             text,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX shipments_shipment_no_user_idx ON shipments (shipment_no, user_id);
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_shipments" ON shipments FOR ALL
  USING  (user_id = get_owner_id())
  WITH CHECK (user_id = get_owner_id());

-- ── 出荷明細 ────────────────────────────────────────────────────────────────

CREATE TABLE shipment_lines (
  id              bigserial PRIMARY KEY,
  shipment_id     bigint NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  product_id      bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name    text NOT NULL,
  quantity        integer NOT NULL CHECK (quantity > 0),
  lot_id          bigint REFERENCES lots(id) ON DELETE SET NULL,
  lot_number      text,
  expiry_date     date,
  location_id     bigint REFERENCES locations(id) ON DELETE SET NULL,
  location_name   text,
  warehouse_id    bigint REFERENCES warehouses(id) ON DELETE SET NULL,
  warehouse_name  text,
  allocated_at    timestamptz,
  shipped_qty     integer NOT NULL DEFAULT 0,
  returned_qty    integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested','allocated','shipped','cancelled')),
  note            text,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shipment_lines_shipment_id_idx ON shipment_lines (shipment_id);
CREATE INDEX shipment_lines_product_id_idx ON shipment_lines (product_id);
CREATE INDEX shipment_lines_lot_id_idx     ON shipment_lines (lot_id);
ALTER TABLE shipment_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_shipment_lines" ON shipment_lines FOR ALL
  USING  (user_id = get_owner_id())
  WITH CHECK (user_id = get_owner_id());

-- ── データ移行: incoming_stock → receipts + receipt_lines ────────────────────
-- カラムが存在するかを information_schema で確認してから動的 SQL で INSERT

DO $$
DECLARE
  v_sql text;
  c boolean;
  supplier_id_e    text := 'NULL::bigint';
  supplier_name_e  text := 'NULL::text';
  warehouse_id_e   text := 'NULL::bigint';
  warehouse_name_e text := 'NULL::text';
  order_history_e  text := 'NULL::bigint';
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incoming_stock' AND column_name='supplier_id')    INTO c; IF c THEN supplier_id_e    := 'supplier_id';    END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incoming_stock' AND column_name='supplier_name')  INTO c; IF c THEN supplier_name_e  := 'supplier_name';  END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incoming_stock' AND column_name='warehouse_id')   INTO c; IF c THEN warehouse_id_e   := 'warehouse_id';   END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incoming_stock' AND column_name='warehouse_name') INTO c; IF c THEN warehouse_name_e := 'warehouse_name'; END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incoming_stock' AND column_name='order_history_id') INTO c; IF c THEN order_history_e := 'order_history_id'; END IF;

  v_sql := format(
    $q$INSERT INTO receipts (
         id, receipt_no, receipt_type, status,
         supplier_id, supplier_name, warehouse_id, warehouse_name,
         source_system, order_history_id, expected_date, received_at,
         user_id, created_at)
       SELECT id,
              'RCV-' || lpad(id::text, 6, '0'),
              'planned',
              CASE WHEN received_at IS NOT NULL THEN 'received' ELSE 'expected' END,
              %s, %s, %s, %s,
              CASE WHEN %s IS NOT NULL THEN 'order' ELSE 'manual' END,
              %s,
              expected_date, received_at,
              COALESCE(user_id, (SELECT user_id FROM order_history WHERE id = %s)),
              now()
       FROM incoming_stock
       WHERE COALESCE(user_id, (SELECT user_id FROM order_history WHERE id = %s)) IS NOT NULL$q$,
    supplier_id_e, supplier_name_e, warehouse_id_e, warehouse_name_e,
    order_history_e, order_history_e, order_history_e, order_history_e
  );
  EXECUTE v_sql;
END $$;

SELECT setval('receipts_id_seq', COALESCE((SELECT MAX(id) FROM receipts), 0) + 1, false);

DO $$
DECLARE
  v_sql text;
  c boolean;
  lot_number_e    text := 'NULL::text';
  expiry_date_e   text := 'NULL::date';
  location_id_e   text := 'NULL::bigint';
  location_name_e text := 'NULL::text';
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incoming_stock' AND column_name='lot_number')    INTO c; IF c THEN lot_number_e    := 's.lot_number';    END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incoming_stock' AND column_name='expiry_date')   INTO c; IF c THEN expiry_date_e   := 's.expiry_date';   END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incoming_stock' AND column_name='location_id')   INTO c; IF c THEN location_id_e   := 's.location_id';   END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incoming_stock' AND column_name='location_name') INTO c; IF c THEN location_name_e := 's.location_name'; END IF;

  v_sql := format(
    $q$INSERT INTO receipt_lines (
         id, receipt_id, product_id, product_name,
         expected_qty, received_qty, lot_number, expiry_date,
         location_id, location_name, status, user_id, created_at)
       SELECT s.id, s.id,
              s.product_id, s.product_name,
              s.quantity,
              CASE WHEN s.received_at IS NOT NULL THEN s.quantity ELSE NULL END,
              %s, %s, %s, %s,
              CASE WHEN s.received_at IS NOT NULL THEN 'received' ELSE 'pending' END,
              r.user_id, now()
       FROM incoming_stock s
       JOIN receipts r ON r.id = s.id$q$,
    lot_number_e, expiry_date_e, location_id_e, location_name_e
  );
  EXECUTE v_sql;
END $$;

SELECT setval('receipt_lines_id_seq', COALESCE((SELECT MAX(id) FROM receipt_lines), 0) + 1, false);

-- ── lots: incoming_stock_id → receipt_line_id ────────────────────────────────

ALTER TABLE lots ADD COLUMN IF NOT EXISTS receipt_line_id bigint;

UPDATE lots SET receipt_line_id = incoming_stock_id WHERE incoming_stock_id IS NOT NULL;

ALTER TABLE lots ADD CONSTRAINT lots_receipt_line_id_fkey
  FOREIGN KEY (receipt_line_id) REFERENCES receipt_lines(id) ON DELETE SET NULL;

-- ── incoming_stock の FK 制約・トリガーを整理してから DROP ──────────────────

ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_incoming_stock_id_fkey;
ALTER TABLE lots DROP COLUMN IF EXISTS incoming_stock_id;

DROP TABLE incoming_stock CASCADE;

-- ── データ移行: outgoing_stock → shipments + shipment_lines ─────────────────

DO $$
DECLARE
  v_sql text;
  c boolean;
  destination_id_e   text := 'NULL::bigint';
  destination_name_e text := 'NULL::text';
  carrier_id_e       text := 'NULL::bigint';
  carrier_name_e     text := 'NULL::text';
  warehouse_id_e     text := 'NULL::bigint';
  warehouse_name_e   text := 'NULL::text';
  note_e             text := 'NULL::text';
  allocated_at_e     text := 'NULL::timestamptz';
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='destination_id')   INTO c; IF c THEN destination_id_e   := 'destination_id';   END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='destination_name') INTO c; IF c THEN destination_name_e := 'destination_name'; END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='carrier_id')       INTO c; IF c THEN carrier_id_e       := 'carrier_id';       END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='carrier_name')     INTO c; IF c THEN carrier_name_e     := 'carrier_name';     END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='warehouse_id')     INTO c; IF c THEN warehouse_id_e     := 'warehouse_id';     END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='warehouse_name')   INTO c; IF c THEN warehouse_name_e   := 'warehouse_name';   END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='note')             INTO c; IF c THEN note_e             := 'note';             END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='allocated_at')     INTO c; IF c THEN allocated_at_e     := 'allocated_at';     END IF;

  v_sql := format(
    $q$INSERT INTO shipments (
         id, shipment_no, shipment_type, status,
         destination_id, destination_name, carrier_id, carrier_name,
         warehouse_id, warehouse_name,
         source_system, scheduled_date, shipped_at,
         note, user_id, created_at)
       SELECT id,
              'SHP-' || lpad(id::text, 6, '0'),
              'normal',
              CASE WHEN shipped_at IS NOT NULL THEN 'shipped'
                   WHEN %s IS NOT NULL THEN 'allocated'
                   ELSE 'requested' END,
              %s, %s, %s, %s, %s, %s,
              'manual',
              scheduled_date, shipped_at,
              %s, user_id, now()
       FROM outgoing_stock
       WHERE user_id IS NOT NULL$q$,
    allocated_at_e,
    destination_id_e, destination_name_e, carrier_id_e, carrier_name_e,
    warehouse_id_e, warehouse_name_e, note_e
  );
  EXECUTE v_sql;
END $$;

SELECT setval('shipments_id_seq', COALESCE((SELECT MAX(id) FROM shipments), 0) + 1, false);

DO $$
DECLARE
  v_sql text;
  c boolean;
  lot_id_e        text := 'NULL::bigint';
  lot_number_e    text := 'NULL::text';
  expiry_date_e   text := 'NULL::date';
  location_id_e   text := 'NULL::bigint';
  location_name_e text := 'NULL::text';
  warehouse_id_e  text := 'NULL::bigint';
  warehouse_name_e text := 'NULL::text';
  allocated_at_e  text := 'NULL::timestamptz';
  returned_qty_e  text := '0';
  note_e          text := 'NULL::text';
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='lot_id')        INTO c; IF c THEN lot_id_e        := 'o.lot_id';        END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='lot_number')    INTO c; IF c THEN lot_number_e    := 'o.lot_number';    END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='expiry_date')   INTO c; IF c THEN expiry_date_e   := 'o.expiry_date';   END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='location_id')   INTO c; IF c THEN location_id_e   := 'o.location_id';   END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='location_name') INTO c; IF c THEN location_name_e := 'o.location_name'; END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='warehouse_id')  INTO c; IF c THEN warehouse_id_e  := 'o.warehouse_id';  END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='warehouse_name') INTO c; IF c THEN warehouse_name_e := 'o.warehouse_name'; END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='allocated_at')  INTO c; IF c THEN allocated_at_e  := 'o.allocated_at';  END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='returned_qty')  INTO c; IF c THEN returned_qty_e  := 'COALESCE(o.returned_qty, 0)'; END IF;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outgoing_stock' AND column_name='note')          INTO c; IF c THEN note_e          := 'o.note';          END IF;

  v_sql := format(
    $q$INSERT INTO shipment_lines (
         id, shipment_id, product_id, product_name, quantity,
         lot_id, lot_number, expiry_date,
         location_id, location_name, warehouse_id, warehouse_name,
         allocated_at, shipped_qty, returned_qty, status,
         note, user_id, created_at)
       SELECT o.id, o.id,
              o.product_id, o.product_name, o.quantity,
              %s, %s, %s,
              %s, %s, %s, %s,
              %s,
              CASE WHEN o.shipped_at IS NOT NULL THEN o.quantity ELSE 0 END,
              %s,
              CASE WHEN o.shipped_at IS NOT NULL THEN 'shipped'
                   WHEN %s IS NOT NULL THEN 'allocated'
                   ELSE 'requested' END,
              %s,
              s.user_id, now()
       FROM outgoing_stock o
       JOIN shipments s ON s.id = o.id$q$,
    lot_id_e, lot_number_e, expiry_date_e,
    location_id_e, location_name_e, warehouse_id_e, warehouse_name_e,
    allocated_at_e, returned_qty_e, allocated_at_e, note_e
  );
  EXECUTE v_sql;
END $$;

SELECT setval('shipment_lines_id_seq', COALESCE((SELECT MAX(id) FROM shipment_lines), 0) + 1, false);

-- ── 旧トリガー削除・outgoing_stock DROP ─────────────────────────────────────

DROP TRIGGER  IF EXISTS tg_outgoing_stock_before_delete ON outgoing_stock;
DROP FUNCTION IF EXISTS fn_on_outgoing_stock_delete();
DROP TABLE outgoing_stock CASCADE;

-- ── 引当削除トリガー (shipment_lines 版) ────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_on_shipment_line_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.allocated_at IS NOT NULL AND OLD.shipped_qty = 0 THEN
    UPDATE inventory
      SET allocated_qty = GREATEST(0, COALESCE(allocated_qty, 0) - OLD.quantity)
      WHERE product_id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER tg_shipment_line_before_delete
  BEFORE DELETE ON shipment_lines
  FOR EACH ROW EXECUTE FUNCTION fn_on_shipment_line_delete();

-- ── fn_receive_receipt_line ──────────────────────────────────────────────────
-- 入荷明細を受入確定: ロット作成 → 在庫加算 → 明細ステータス更新

DROP FUNCTION IF EXISTS fn_receive_incoming(bigint, text, date, bigint, text, bigint, text, text, uuid, text);

CREATE OR REPLACE FUNCTION fn_receive_receipt_line(
  p_receipt_line_id bigint,
  p_lot_number      text,
  p_expiry_date     date,
  p_location_id     bigint,
  p_location_name   text,
  p_warehouse_id    bigint,
  p_warehouse_name  text,
  p_local_today     text,
  p_owner_id        uuid,
  p_operation_id    text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line        record;
  v_lot_id      bigint;
  v_stock_after integer;
BEGIN
  SELECT rl.id, rl.receipt_id, rl.product_id, rl.product_name,
         rl.expected_qty, rl.received_qty, rl.status
    INTO v_line
    FROM receipt_lines rl WHERE rl.id = p_receipt_line_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '入荷明細が見つかりません');
  END IF;
  IF v_line.status = 'received' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- ロット作成
  INSERT INTO lots
    (lot_number, product_id, product_name, quantity, received_at, expiry_date,
     receipt_line_id, user_id, location_id, location_name, warehouse_id, warehouse_name)
  VALUES
    (p_lot_number, v_line.product_id, v_line.product_name, v_line.expected_qty,
     p_local_today::date, p_expiry_date, p_receipt_line_id, p_owner_id,
     p_location_id, p_location_name, p_warehouse_id, p_warehouse_name)
  RETURNING id INTO v_lot_id;

  -- 在庫加算
  INSERT INTO inventory (product_id, current_stock, updated_at)
    VALUES (v_line.product_id, v_line.expected_qty, p_local_today::date)
    ON CONFLICT (product_id) DO UPDATE
      SET current_stock = inventory.current_stock + EXCLUDED.current_stock,
          updated_at    = EXCLUDED.updated_at
    RETURNING current_stock INTO v_stock_after;

  -- 明細を受入済みにマーク
  UPDATE receipt_lines
    SET received_qty  = v_line.expected_qty,
        lot_number    = p_lot_number,
        expiry_date   = p_expiry_date,
        location_id   = p_location_id,
        location_name = p_location_name,
        status        = 'received'
    WHERE id = p_receipt_line_id;

  -- 全明細が received になったらヘッダーも received に
  UPDATE receipts r
    SET status      = 'received',
        received_at = now()
    WHERE r.id = v_line.receipt_id
      AND NOT EXISTS (
        SELECT 1 FROM receipt_lines
        WHERE receipt_id = v_line.receipt_id AND status != 'received'
      );

  -- ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta, quantity_after,
     reference_id, reference_type, operation_id)
  VALUES
    (v_line.product_id, v_lot_id, 'incoming', v_line.expected_qty, v_stock_after,
     p_receipt_line_id, 'receipt_lines', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_unreceive_receipt_line ────────────────────────────────────────────────

DROP FUNCTION IF EXISTS fn_unreceive_incoming(bigint, text, text);

CREATE OR REPLACE FUNCTION fn_unreceive_receipt_line(
  p_receipt_line_id bigint,
  p_operation_id    text,
  p_local_today     text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line record;
BEGIN
  SELECT rl.id, rl.receipt_id, rl.product_id, rl.expected_qty, rl.status
    INTO v_line
    FROM receipt_lines rl WHERE rl.id = p_receipt_line_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '入荷明細が見つかりません');
  END IF;
  IF v_line.status != 'received' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- ロット削除
  DELETE FROM lots WHERE receipt_line_id = p_receipt_line_id;

  -- 在庫を戻す
  UPDATE inventory
    SET current_stock = GREATEST(0, current_stock - v_line.expected_qty),
        updated_at    = p_local_today::date
    WHERE product_id = v_line.product_id;

  -- 明細をリセット
  UPDATE receipt_lines
    SET received_qty  = NULL,
        lot_number    = NULL,
        expiry_date   = NULL,
        location_id   = NULL,
        location_name = NULL,
        status        = 'pending'
    WHERE id = p_receipt_line_id;

  -- ヘッダーを expected に戻す
  UPDATE receipts
    SET status      = 'expected',
        received_at = NULL
    WHERE id = v_line.receipt_id
      AND received_at IS NOT NULL;

  -- ログ
  INSERT INTO inventory_transactions
    (product_id, transaction_type, quantity_delta,
     reference_id, reference_type, operation_id)
  VALUES
    (v_line.product_id, 'cancel_incoming', -v_line.expected_qty,
     p_receipt_line_id, 'receipt_lines', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_allocate_shipment_line ────────────────────────────────────────────────
-- FEFO でロットを選択し allocated_qty を増加させる

DROP FUNCTION IF EXISTS fn_allocate_outgoing(bigint, text, text);

CREATE OR REPLACE FUNCTION fn_allocate_shipment_line(
  p_line_id      bigint,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line  record;
  v_lot   record;
  v_avail integer;
BEGIN
  SELECT sl.id, sl.shipment_id, sl.product_id, sl.quantity,
         sl.lot_id, sl.allocated_at, sl.shipped_qty
    INTO v_line
    FROM shipment_lines sl WHERE sl.id = p_line_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷明細が見つかりません');
  END IF;
  IF v_line.shipped_qty > 0 THEN
    RETURN jsonb_build_object('error', '既に出荷確定済みです');
  END IF;
  IF v_line.allocated_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- 利用可能在庫チェック
  SELECT current_stock - COALESCE(allocated_qty, 0) INTO v_avail
    FROM inventory WHERE product_id = v_line.product_id;

  IF COALESCE(v_avail, 0) < v_line.quantity THEN
    RETURN jsonb_build_object('error',
      format('利用可能在庫不足: 必要 %s 個、利用可能 %s 個',
             v_line.quantity, COALESCE(v_avail, 0)));
  END IF;

  -- FEFO ロット選択
  IF v_line.lot_id IS NOT NULL THEN
    SELECT id, lot_number, quantity, expiry_date, location_id, location_name, warehouse_id, warehouse_name
      INTO v_lot FROM lots
      WHERE id = v_line.lot_id AND product_id = v_line.product_id
      FOR UPDATE;
  ELSE
    SELECT id, lot_number, quantity, expiry_date, location_id, location_name, warehouse_id, warehouse_name
      INTO v_lot FROM lots
      WHERE product_id = v_line.product_id AND quantity >= v_line.quantity
      ORDER BY expiry_date ASC NULLS LAST, id ASC
      LIMIT 1
      FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error',
      format('利用可能なロットが見つかりません (必要数: %s 個)', v_line.quantity));
  END IF;

  -- ロット情報を設定して引当確定
  UPDATE shipment_lines
    SET lot_id         = v_lot.id,
        lot_number     = v_lot.lot_number,
        expiry_date    = v_lot.expiry_date,
        location_id    = COALESCE(location_id,   v_lot.location_id),
        location_name  = COALESCE(location_name, v_lot.location_name),
        warehouse_id   = COALESCE(warehouse_id,  v_lot.warehouse_id),
        warehouse_name = COALESCE(warehouse_name,v_lot.warehouse_name),
        allocated_at   = now(),
        status         = 'allocated'
    WHERE id = p_line_id;

  -- ヘッダーステータス更新
  UPDATE shipments SET status = 'allocated' WHERE id = v_line.shipment_id AND status = 'requested';

  -- 引当済み数量を加算
  UPDATE inventory
    SET allocated_qty = COALESCE(allocated_qty, 0) + v_line.quantity
    WHERE product_id = v_line.product_id;

  -- ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta,
     reference_id, reference_type, operation_id)
  VALUES
    (v_line.product_id, v_lot.id, 'allocate', v_line.quantity,
     p_line_id, 'shipment_lines', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_allocate_bulk_shipment_lines ─────────────────────────────────────────

DROP FUNCTION IF EXISTS fn_allocate_bulk_outgoing(bigint[], text);

CREATE OR REPLACE FUNCTION fn_allocate_bulk_shipment_lines(
  p_line_ids    bigint[],
  p_local_today text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id     bigint;
  v_res    jsonb;
  v_errors text[] := '{}';
BEGIN
  FOREACH v_id IN ARRAY p_line_ids LOOP
    v_res := fn_allocate_shipment_line(v_id, gen_random_uuid()::text, p_local_today);
    IF v_res->>'error' IS NOT NULL THEN
      v_errors := array_append(v_errors, format('[%s] %s', v_id, v_res->>'error'));
    END IF;
  END LOOP;

  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object('error', array_to_string(v_errors, ' / '));
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_deallocate_shipment_line ──────────────────────────────────────────────

DROP FUNCTION IF EXISTS fn_deallocate_outgoing(bigint, text, text);

CREATE OR REPLACE FUNCTION fn_deallocate_shipment_line(
  p_line_id      bigint,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line record;
BEGIN
  SELECT sl.id, sl.shipment_id, sl.product_id, sl.quantity,
         sl.lot_id, sl.allocated_at, sl.shipped_qty
    INTO v_line
    FROM shipment_lines sl WHERE sl.id = p_line_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷明細が見つかりません');
  END IF;
  IF v_line.shipped_qty > 0 THEN
    RETURN jsonb_build_object('error', '出荷確定済みは引当解除できません');
  END IF;
  IF v_line.allocated_at IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- 引当解除
  UPDATE shipment_lines
    SET lot_id       = NULL,
        lot_number   = NULL,
        expiry_date  = NULL,
        allocated_at = NULL,
        status       = 'requested'
    WHERE id = p_line_id;

  -- ヘッダーを requested に戻す (全明細が未引当なら)
  UPDATE shipments SET status = 'requested'
    WHERE id = v_line.shipment_id
      AND NOT EXISTS (
        SELECT 1 FROM shipment_lines
        WHERE shipment_id = v_line.shipment_id AND status = 'allocated'
      );

  -- 引当済み数量を減算
  UPDATE inventory
    SET allocated_qty = GREATEST(0, COALESCE(allocated_qty, 0) - v_line.quantity)
    WHERE product_id = v_line.product_id;

  -- ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta,
     reference_id, reference_type, operation_id)
  VALUES
    (v_line.product_id, v_line.lot_id, 'deallocate', -v_line.quantity,
     p_line_id, 'shipment_lines', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_confirm_shipment (更新) ───────────────────────────────────────────────
-- 出荷ヘッダー単位で確定: 引当済み全明細の在庫を引き落とす

DROP FUNCTION IF EXISTS fn_confirm_shipment(bigint, text, text);

CREATE OR REPLACE FUNCTION fn_confirm_shipment(
  p_shipment_id  bigint,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ship  record;
  v_line  record;
  v_stock_after   integer;
  v_remaining     integer;
  v_take          integer;
  v_first_lot_id  bigint;
  v_first_lot_num text;
  v_lot_row       record;
BEGIN
  SELECT id, status, shipped_at INTO v_ship
    FROM shipments WHERE id = p_shipment_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷伝票が見つかりません');
  END IF;
  IF v_ship.shipped_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- 引当済み明細を処理
  FOR v_line IN
    SELECT id, product_id, quantity, lot_id, lot_number, allocated_at, shipped_qty
      FROM shipment_lines
      WHERE shipment_id = p_shipment_id
        AND allocated_at IS NOT NULL
        AND shipped_qty = 0
        AND status = 'allocated'
      FOR UPDATE
  LOOP
    -- 在庫チェック・減算
    UPDATE inventory
      SET current_stock = current_stock - v_line.quantity,
          updated_at    = p_local_today::date
      WHERE product_id = v_line.product_id
        AND current_stock >= v_line.quantity
      RETURNING current_stock INTO v_stock_after;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error',
        format('在庫不足: %s (必要 %s 個)', v_line.product_id, v_line.quantity));
    END IF;

    -- 引当済みの場合 allocated_qty も減算
    UPDATE inventory
      SET allocated_qty = GREATEST(0, COALESCE(allocated_qty, 0) - v_line.quantity)
      WHERE product_id = v_line.product_id;

    -- ロット在庫を減算
    IF v_line.lot_id IS NOT NULL THEN
      UPDATE lots
        SET quantity = quantity - v_line.quantity
        WHERE id = v_line.lot_id AND quantity >= v_line.quantity;

      IF NOT FOUND THEN
        -- ロールバック
        UPDATE inventory
          SET current_stock = current_stock + v_line.quantity,
              allocated_qty = COALESCE(allocated_qty, 0) + v_line.quantity,
              updated_at    = p_local_today::date
          WHERE product_id = v_line.product_id;
        RETURN jsonb_build_object('error', 'ロット在庫不足');
      END IF;

    ELSE
      -- FEFO で複数ロットから引当
      v_remaining := v_line.quantity;
      v_first_lot_id  := NULL;
      v_first_lot_num := NULL;
      FOR v_lot_row IN
        SELECT id, quantity, lot_number FROM lots
          WHERE product_id = v_line.product_id AND quantity > 0
          ORDER BY expiry_date ASC NULLS LAST, lot_number ASC
          FOR UPDATE
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_lot_row.quantity, v_remaining);
        UPDATE lots SET quantity = quantity - v_take WHERE id = v_lot_row.id;
        v_remaining := v_remaining - v_take;
        IF v_first_lot_id IS NULL THEN
          v_first_lot_id  := v_lot_row.id;
          v_first_lot_num := v_lot_row.lot_number;
        END IF;
      END LOOP;

      IF v_first_lot_id IS NOT NULL THEN
        UPDATE shipment_lines
          SET lot_id = v_first_lot_id, lot_number = v_first_lot_num
          WHERE id = v_line.id;
      END IF;
    END IF;

    -- 明細を出荷済みにマーク
    UPDATE shipment_lines
      SET shipped_qty = v_line.quantity,
          status      = 'shipped'
      WHERE id = v_line.id;

    -- ログ
    INSERT INTO inventory_transactions
      (product_id, lot_id, transaction_type, quantity_delta, quantity_after,
       reference_id, reference_type, operation_id)
    VALUES
      (v_line.product_id,
       COALESCE(v_line.lot_id, v_first_lot_id),
       'outgoing', -v_line.quantity, v_stock_after,
       v_line.id, 'shipment_lines', p_operation_id || '-' || v_line.id::text)
    ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  END LOOP;

  -- ヘッダーを出荷済みにマーク
  UPDATE shipments
    SET status     = 'shipped',
        shipped_at = now()
    WHERE id = p_shipment_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_confirm_bulk_shipment (更新) ─────────────────────────────────────────

DROP FUNCTION IF EXISTS fn_confirm_bulk_shipment(bigint[], text);

CREATE OR REPLACE FUNCTION fn_confirm_bulk_shipment(
  p_shipment_ids bigint[],
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id     bigint;
  v_res    jsonb;
  v_errors text[] := '{}';
BEGIN
  FOREACH v_id IN ARRAY p_shipment_ids LOOP
    v_res := fn_confirm_shipment(v_id, gen_random_uuid()::text, p_local_today);
    IF v_res->>'error' IS NOT NULL THEN
      v_errors := array_append(v_errors, format('[%s] %s', v_id, v_res->>'error'));
    END IF;
  END LOOP;

  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object('error', array_to_string(v_errors, ' / '));
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_unship_shipment ───────────────────────────────────────────────────────
-- 出荷取消: 在庫・ロット復元、引当済み状態に戻す

DROP FUNCTION IF EXISTS fn_unship_outgoing(bigint, text, text);

CREATE OR REPLACE FUNCTION fn_unship_shipment(
  p_shipment_id  bigint,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ship record;
  v_line record;
BEGIN
  SELECT id, status, shipped_at INTO v_ship
    FROM shipments WHERE id = p_shipment_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷伝票が見つかりません');
  END IF;
  IF v_ship.shipped_at IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  FOR v_line IN
    SELECT id, product_id, quantity, lot_id, allocated_at, shipped_qty
      FROM shipment_lines
      WHERE shipment_id = p_shipment_id AND shipped_qty > 0
      FOR UPDATE
  LOOP
    -- 在庫を戻す
    UPDATE inventory
      SET current_stock = current_stock + v_line.shipped_qty,
          updated_at    = p_local_today::date
      WHERE product_id = v_line.product_id;

    -- 引当済みだった場合 allocated_qty を復元
    IF v_line.allocated_at IS NOT NULL THEN
      UPDATE inventory
        SET allocated_qty = COALESCE(allocated_qty, 0) + v_line.shipped_qty
        WHERE product_id = v_line.product_id;
    END IF;

    -- ロット在庫を戻す
    IF v_line.lot_id IS NOT NULL THEN
      UPDATE lots SET quantity = quantity + v_line.shipped_qty WHERE id = v_line.lot_id;
    END IF;

    -- 明細を引当済み状態に戻す
    UPDATE shipment_lines
      SET shipped_qty = 0,
          status      = CASE WHEN allocated_at IS NOT NULL THEN 'allocated' ELSE 'requested' END
      WHERE id = v_line.id;

    -- ログ
    INSERT INTO inventory_transactions
      (product_id, lot_id, transaction_type, quantity_delta,
       reference_id, reference_type, operation_id)
    VALUES
      (v_line.product_id, v_line.lot_id, 'cancel_outgoing', v_line.shipped_qty,
       v_line.id, 'shipment_lines', p_operation_id || '-' || v_line.id::text)
    ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  END LOOP;

  -- ヘッダーを引当済み状態に戻す
  UPDATE shipments
    SET status     = 'allocated',
        shipped_at = NULL
    WHERE id = p_shipment_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_return_shipment_line ──────────────────────────────────────────────────

DROP FUNCTION IF EXISTS fn_return_outgoing(bigint, integer, text, text);

CREATE OR REPLACE FUNCTION fn_return_shipment_line(
  p_line_id      bigint,
  p_return_qty   integer,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line        record;
  v_max_return  integer;
  v_stock_after integer;
BEGIN
  SELECT sl.id, sl.product_id, sl.quantity, sl.lot_id,
         sl.returned_qty, sl.shipped_qty
    INTO v_line
    FROM shipment_lines sl WHERE sl.id = p_line_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷明細が見つかりません');
  END IF;
  IF v_line.shipped_qty = 0 THEN
    RETURN jsonb_build_object('error', '出荷確定前は返品できません');
  END IF;

  v_max_return := v_line.shipped_qty - COALESCE(v_line.returned_qty, 0);
  IF p_return_qty > v_max_return THEN
    RETURN jsonb_build_object('error',
      format('返品数量は %s 個以下にしてください', v_max_return));
  END IF;
  IF p_return_qty <= 0 THEN
    RETURN jsonb_build_object('error', '返品数量は1以上が必要です');
  END IF;

  UPDATE shipment_lines
    SET returned_qty = COALESCE(returned_qty, 0) + p_return_qty
    WHERE id = p_line_id;

  IF v_line.lot_id IS NOT NULL THEN
    UPDATE lots SET quantity = quantity + p_return_qty WHERE id = v_line.lot_id;
  END IF;

  UPDATE inventory
    SET current_stock = current_stock + p_return_qty,
        updated_at    = p_local_today::date
    WHERE product_id = v_line.product_id
    RETURNING current_stock INTO v_stock_after;

  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta, quantity_after,
     reference_id, reference_type, operation_id)
  VALUES
    (v_line.product_id, v_line.lot_id, 'return', p_return_qty, v_stock_after,
     p_line_id, 'shipment_lines', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_adjust_lot_quantity (更新: shipment_lines 参照) ──────────────────────

CREATE OR REPLACE FUNCTION fn_adjust_lot_quantity(
  p_lot_id       bigint,
  p_new_qty      integer,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lot         record;
  v_reserved    integer;
  v_delta       integer;
  v_total_stock integer;
BEGIN
  SELECT id, product_id, quantity INTO v_lot
    FROM lots WHERE id = p_lot_id FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'ロットが見つかりません'); END IF;

  -- 出荷明細での引当数量チェック
  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
    FROM shipment_lines WHERE lot_id = p_lot_id AND shipped_qty = 0 AND status != 'cancelled';

  IF p_new_qty < v_reserved THEN
    RETURN jsonb_build_object('error',
      format('出荷予定で %s 個確保済みのため %s 個未満には設定できません',
             v_reserved, v_reserved));
  END IF;

  v_delta := p_new_qty - v_lot.quantity;
  UPDATE lots SET quantity = p_new_qty WHERE id = p_lot_id;

  SELECT COALESCE(SUM(quantity), 0) INTO v_total_stock
    FROM lots WHERE product_id = v_lot.product_id;

  UPDATE inventory
    SET current_stock = v_total_stock,
        updated_at    = p_local_today::date
    WHERE product_id = v_lot.product_id;

  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta, quantity_after, operation_id)
  VALUES
    (v_lot.product_id, p_lot_id, 'adjustment', v_delta, v_total_stock, p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 実行権限付与 ────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION fn_receive_receipt_line       TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_unreceive_receipt_line     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_allocate_shipment_line     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_allocate_bulk_shipment_lines TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_deallocate_shipment_line   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_confirm_shipment           TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_confirm_bulk_shipment      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_unship_shipment            TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_return_shipment_line       TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_adjust_lot_quantity        TO authenticated, anon;
