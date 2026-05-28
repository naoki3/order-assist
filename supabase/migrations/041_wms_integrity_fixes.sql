-- ── Migration 041: WMS integrity fixes ───────────────────────────────────────

-- 1. Clean up shipments.status CHECK: remove dead/unimplemented statuses
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
  CHECK (status IN ('requested', 'allocated', 'shipped', 'cancelled'));

-- 2. Data-integrity CHECK constraints
ALTER TABLE lots ADD CONSTRAINT lots_quantity_nonneg
  CHECK (quantity >= 0) NOT VALID;

ALTER TABLE shipment_lines ADD CONSTRAINT sl_shipped_lte_qty
  CHECK (shipped_qty <= quantity) NOT VALID;

ALTER TABLE shipment_lines ADD CONSTRAINT sl_returned_lte_shipped
  CHECK (returned_qty <= COALESCE(shipped_qty, 0)) NOT VALID;

ALTER TABLE receipt_lines ADD CONSTRAINT rl_received_lte_expected
  CHECK (received_qty <= expected_qty) NOT VALID;

-- 3. Unique lot number per owner + product
CREATE UNIQUE INDEX IF NOT EXISTS idx_lots_user_product_lot
  ON lots(user_id, product_id, lot_number);

-- 4. Fix fn_allocate_shipment_line
--    - Add FOR UPDATE to inventory SELECT (race condition fix)
--    - Add FEFO pre-assigned lot validation
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

  -- 利用可能在庫チェック (FOR UPDATE でレース防止)
  SELECT current_stock - COALESCE(allocated_qty, 0) INTO v_avail
    FROM inventory WHERE product_id = v_line.product_id
    FOR UPDATE;

  IF COALESCE(v_avail, 0) < v_line.quantity THEN
    RETURN jsonb_build_object('error',
      format('利用可能在庫不足: 必要 %s 個、利用可能 %s 個',
             v_line.quantity, COALESCE(v_avail, 0)));
  END IF;

  -- FEFO ロット選択
  IF v_line.lot_id IS NOT NULL THEN
    -- 指定ロットを取得 (lot_id 事前指定を許可)
    SELECT id, lot_number, quantity, expiry_date,
           location_id, location_name, warehouse_id, warehouse_name
      INTO v_lot FROM lots
      WHERE id = v_line.lot_id AND product_id = v_line.product_id
      FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', '指定ロットが見つかりません');
    END IF;
    IF v_lot.quantity < v_line.quantity THEN
      RETURN jsonb_build_object('error',
        format('指定ロットの在庫不足: 必要 %s 個、在庫 %s 個', v_line.quantity, v_lot.quantity));
    END IF;

  ELSE
    -- 自動 FEFO 選択
    SELECT id, lot_number, quantity, expiry_date,
           location_id, location_name, warehouse_id, warehouse_name
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
  UPDATE shipments SET status = 'allocated'
    WHERE id = v_line.shipment_id AND status = 'requested';

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

-- 5. Fix fn_confirm_shipment
--    - Guard: all non-shipped/cancelled lines must be allocated (when no partial qtys)
--    - Support optional per-line ship qty (p_ship_qtys jsonb: {line_id: qty})
CREATE OR REPLACE FUNCTION fn_confirm_shipment(
  p_shipment_id  bigint,
  p_operation_id text,
  p_local_today  text,
  p_ship_qtys    jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ship        record;
  v_line        record;
  v_stock_after   integer;
  v_remaining     integer;
  v_take          integer;
  v_first_lot_id  bigint;
  v_first_lot_num text;
  v_lot_row       record;
  v_ship_qty      integer;
  v_all_shipped   boolean;
BEGIN
  SELECT id, status, shipped_at INTO v_ship
    FROM shipments WHERE id = p_shipment_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷伝票が見つかりません');
  END IF;
  IF v_ship.status = 'shipped' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- 未引当明細チェック (通常モード: p_ship_qtys なし)
  IF p_ship_qtys IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM shipment_lines
      WHERE shipment_id = p_shipment_id
        AND status NOT IN ('shipped', 'cancelled')
        AND allocated_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error',
        '未引当の明細があります。全明細を引当してから出荷確定してください');
    END IF;
  END IF;

  -- 引当済み明細を処理
  FOR v_line IN
    SELECT id, product_id, quantity, lot_id, lot_number, allocated_at, shipped_qty
      FROM shipment_lines
      WHERE shipment_id = p_shipment_id
        AND allocated_at IS NOT NULL
        AND status = 'allocated'
      FOR UPDATE
  LOOP
    -- 出荷数量の決定 (部分出荷指定がある場合はそちらを優先)
    IF p_ship_qtys IS NOT NULL AND (p_ship_qtys->>(v_line.id::text)) IS NOT NULL THEN
      v_ship_qty := (p_ship_qtys->>(v_line.id::text))::integer;
      IF v_ship_qty <= 0 OR v_ship_qty > (v_line.quantity - v_line.shipped_qty) THEN
        RETURN jsonb_build_object('error',
          format('出荷数量が不正です (明細ID: %s, 指定: %s, 残: %s)',
                 v_line.id, v_ship_qty, v_line.quantity - v_line.shipped_qty));
      END IF;
    ELSE
      v_ship_qty := v_line.quantity - v_line.shipped_qty;
    END IF;

    -- 在庫チェック・減算
    UPDATE inventory
      SET current_stock = current_stock - v_ship_qty,
          updated_at    = p_local_today::date
      WHERE product_id = v_line.product_id
        AND current_stock >= v_ship_qty
      RETURNING current_stock INTO v_stock_after;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error',
        format('在庫不足 (必要 %s 個)', v_ship_qty));
    END IF;

    -- 引当済み数量も減算
    UPDATE inventory
      SET allocated_qty = GREATEST(0, COALESCE(allocated_qty, 0) - v_ship_qty)
      WHERE product_id = v_line.product_id;

    -- ロット在庫を減算
    IF v_line.lot_id IS NOT NULL THEN
      UPDATE lots
        SET quantity = quantity - v_ship_qty
        WHERE id = v_line.lot_id AND quantity >= v_ship_qty;

      IF NOT FOUND THEN
        UPDATE inventory
          SET current_stock = current_stock + v_ship_qty,
              allocated_qty = COALESCE(allocated_qty, 0) + v_ship_qty,
              updated_at    = p_local_today::date
          WHERE product_id = v_line.product_id;
        RETURN jsonb_build_object('error', 'ロット在庫不足');
      END IF;

    ELSE
      -- FEFO で複数ロットから引当
      v_remaining     := v_ship_qty;
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

    -- 明細を更新 (部分出荷: 残があれば allocated のまま)
    UPDATE shipment_lines
      SET shipped_qty = v_line.shipped_qty + v_ship_qty,
          status      = CASE
            WHEN v_line.shipped_qty + v_ship_qty >= v_line.quantity THEN 'shipped'
            ELSE 'allocated'
          END
      WHERE id = v_line.id;

    -- ログ
    INSERT INTO inventory_transactions
      (product_id, lot_id, transaction_type, quantity_delta, quantity_after,
       reference_id, reference_type, operation_id)
    VALUES
      (v_line.product_id,
       COALESCE(v_line.lot_id, v_first_lot_id),
       'outgoing', -v_ship_qty, v_stock_after,
       v_line.id, 'shipment_lines', p_operation_id || '-' || v_line.id::text)
    ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  END LOOP;

  -- ヘッダーを出荷済みにマーク (全明細が shipped/cancelled のときのみ)
  SELECT NOT EXISTS (
    SELECT 1 FROM shipment_lines
    WHERE shipment_id = p_shipment_id
      AND status NOT IN ('shipped', 'cancelled')
  ) INTO v_all_shipped;

  IF v_all_shipped THEN
    UPDATE shipments
      SET status     = 'shipped',
          shipped_at = now()
      WHERE id = p_shipment_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 6. Fix fn_unreceive_receipt_line: correct header reset logic
--    - Reset to 'expected' only when no other lines are received
--    - Reset to 'receiving' when other lines are still received
CREATE OR REPLACE FUNCTION fn_unreceive_receipt_line(
  p_receipt_line_id bigint,
  p_operation_id    text,
  p_local_today     text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line       record;
  v_actual_qty integer;
BEGIN
  SELECT rl.id, rl.receipt_id, rl.product_id,
         rl.expected_qty, rl.received_qty, rl.status
    INTO v_line
    FROM receipt_lines rl WHERE rl.id = p_receipt_line_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '入荷明細が見つかりません');
  END IF;
  IF v_line.status != 'received' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_actual_qty := COALESCE(v_line.received_qty, v_line.expected_qty);

  -- ロット削除
  DELETE FROM lots WHERE receipt_line_id = p_receipt_line_id;

  -- 在庫を戻す
  UPDATE inventory
    SET current_stock = GREATEST(0, current_stock - v_actual_qty),
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

  -- ヘッダー更新: 他に received 明細がなければ expected、あれば receiving
  UPDATE receipts
    SET status      = CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM receipt_lines
            WHERE receipt_id = v_line.receipt_id
              AND id != p_receipt_line_id
              AND status = 'received'
          ) THEN 'expected'
          ELSE 'receiving'
        END,
        received_at = CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM receipt_lines
            WHERE receipt_id = v_line.receipt_id
              AND id != p_receipt_line_id
              AND status = 'received'
          ) THEN NULL
          ELSE received_at
        END
    WHERE id = v_line.receipt_id
      AND status != 'cancelled';

  -- ログ
  INSERT INTO inventory_transactions
    (product_id, transaction_type, quantity_delta,
     reference_id, reference_type, operation_id)
  VALUES
    (v_line.product_id, 'cancel_incoming', -v_actual_qty,
     p_receipt_line_id, 'receipt_lines', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. Fix fn_adjust_lot_quantity: explicit negative qty guard + correct reserved qty check
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
  IF p_new_qty < 0 THEN
    RETURN jsonb_build_object('error', '数量は0以上が必要です');
  END IF;

  SELECT id, product_id, quantity INTO v_lot
    FROM lots WHERE id = p_lot_id FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'ロットが見つかりません'); END IF;

  -- 出荷明細での引当数量チェック (未出荷の allocated 明細のみ)
  SELECT COALESCE(SUM(quantity - COALESCE(shipped_qty, 0)), 0) INTO v_reserved
    FROM shipment_lines
    WHERE lot_id = p_lot_id AND status = 'allocated';

  IF p_new_qty < v_reserved THEN
    RETURN jsonb_build_object('error',
      format('出荷予定で %s 個引当済みのため %s 個未満には設定できません',
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

GRANT EXECUTE ON FUNCTION fn_allocate_shipment_line  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_confirm_shipment        TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_unreceive_receipt_line  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_adjust_lot_quantity     TO authenticated, anon;
