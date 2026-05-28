-- ── Migration 046: Cycle count lock ──────────────────────────────────────────
-- Adds fn_has_active_cycle_count helper and injects lock checks into
-- fn_receive_receipt_line and fn_confirm_shipment.
-- When a draft cycle_count_session exists for the owner's warehouse,
-- inventory-moving operations return an error instead of proceeding.

CREATE OR REPLACE FUNCTION fn_has_active_cycle_count(
  p_owner_id     uuid,
  p_warehouse_id bigint DEFAULT NULL
) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM cycle_count_sessions
    WHERE user_id = p_owner_id
      AND status = 'draft'
      AND (
        p_warehouse_id IS NULL
        OR warehouse_id IS NULL
        OR warehouse_id = p_warehouse_id
      )
  )
$$;

-- ── fn_receive_receipt_line (re-create with cycle count lock) ─────────────────
-- Identical to 042 except for the cycle count check block after early-exit guards.

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
  p_operation_id    text,
  p_status_id       bigint  DEFAULT NULL,
  p_status_name     text    DEFAULT NULL,
  p_status_color    text    DEFAULT NULL,
  p_received_qty    integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line         record;
  v_lot_id       bigint;
  v_stock_after  integer;
  v_status_id    bigint;
  v_status_name  text;
  v_status_color text;
  v_actual_qty   integer;
  v_line_status  text;
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

  -- 棚卸しロックチェック
  IF fn_has_active_cycle_count(p_owner_id, p_warehouse_id) THEN
    RETURN jsonb_build_object('error', '棚卸し中は入荷処理ができません。棚卸しを完了または破棄してから操作してください');
  END IF;

  -- 実入荷数量の決定
  v_actual_qty := COALESCE(p_received_qty, v_line.expected_qty);
  IF v_actual_qty <= 0 THEN
    RETURN jsonb_build_object('error', '入荷数量は1以上が必要です');
  END IF;
  IF v_actual_qty > v_line.expected_qty THEN
    RETURN jsonb_build_object('error',
      format('入荷数量が予定数量を超えています (予定: %s 個)', v_line.expected_qty));
  END IF;

  -- 明細ステータス決定
  v_line_status := CASE WHEN v_actual_qty < v_line.expected_qty THEN 'discrepancy' ELSE 'received' END;

  -- ステータス解決: 指定なければ良品をデフォルトに
  IF p_status_name IS NOT NULL THEN
    v_status_id    := p_status_id;
    v_status_name  := p_status_name;
    v_status_color := p_status_color;
  ELSE
    SELECT id, name, color INTO v_status_id, v_status_name, v_status_color
      FROM inventory_statuses
      WHERE user_id = p_owner_id AND name = '良品'
      LIMIT 1;
  END IF;

  -- ロット作成
  INSERT INTO lots
    (lot_number, product_id, product_name, quantity, received_at, expiry_date,
     receipt_line_id, user_id, location_id, location_name, warehouse_id, warehouse_name,
     status_id, status_name, status_color)
  VALUES
    (p_lot_number, v_line.product_id, v_line.product_name, v_actual_qty,
     p_local_today::date, p_expiry_date, p_receipt_line_id, p_owner_id,
     p_location_id, p_location_name, p_warehouse_id, p_warehouse_name,
     v_status_id, v_status_name, v_status_color)
  RETURNING id INTO v_lot_id;

  -- 在庫加算
  INSERT INTO inventory (product_id, current_stock, updated_at)
    VALUES (v_line.product_id, v_actual_qty, p_local_today::date)
    ON CONFLICT (product_id) DO UPDATE
      SET current_stock = inventory.current_stock + EXCLUDED.current_stock,
          updated_at    = EXCLUDED.updated_at
    RETURNING current_stock INTO v_stock_after;

  -- 明細を受入済みにマーク
  UPDATE receipt_lines
    SET received_qty  = v_actual_qty,
        lot_number    = p_lot_number,
        expiry_date   = p_expiry_date,
        location_id   = p_location_id,
        location_name = p_location_name,
        status        = v_line_status
    WHERE id = p_receipt_line_id;

  -- ヘッダー更新: 全明細が received/discrepancy になったら確定
  UPDATE receipts r
    SET status      = CASE
          WHEN EXISTS (
            SELECT 1 FROM receipt_lines
            WHERE receipt_id = v_line.receipt_id AND status = 'discrepancy'
          ) THEN 'discrepancy'
          ELSE 'received'
        END,
        received_at = now()
    WHERE r.id = v_line.receipt_id
      AND NOT EXISTS (
        SELECT 1 FROM receipt_lines
        WHERE receipt_id = v_line.receipt_id
          AND status NOT IN ('received', 'discrepancy')
      );

  -- ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta, quantity_after,
     reference_id, reference_type, operation_id)
  VALUES
    (v_line.product_id, v_lot_id, 'incoming', v_actual_qty, v_stock_after,
     p_receipt_line_id, 'receipt_lines', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_confirm_shipment (re-create with cycle count lock) ─────────────────────
-- Identical to 041 except: select user_id from shipments and add cycle count check.

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
  v_line_key      text;
BEGIN
  SELECT id, status, shipped_at, user_id INTO v_ship
    FROM shipments WHERE id = p_shipment_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷伝票が見つかりません');
  END IF;
  IF v_ship.status = 'shipped' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  IF v_ship.status = 'on_hold' THEN
    RETURN jsonb_build_object('error', '保留中の出荷伝票は確定できません。保留を解除してください');
  END IF;

  -- 棚卸しロックチェック
  IF fn_has_active_cycle_count(v_ship.user_id, NULL) THEN
    RETURN jsonb_build_object('error', '棚卸し中は出荷確定できません。棚卸しを完了または破棄してから操作してください');
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
    v_line_key := v_line.id::text;
    IF p_ship_qtys IS NOT NULL AND p_ship_qtys->>v_line_key IS NOT NULL THEN
      v_ship_qty := (p_ship_qtys->>v_line_key)::integer;
      IF v_ship_qty <= 0 OR v_ship_qty > (v_line.quantity - v_line.shipped_qty) THEN
        RETURN jsonb_build_object('error',
          format('出荷数量が不正です (明細ID: %s, 指定: %s, 残: %s)',
                 v_line.id, v_ship_qty, v_line.quantity - v_line.shipped_qty));
      END IF;
    ELSE
      v_ship_qty := v_line.quantity - v_line.shipped_qty;
    END IF;

    UPDATE inventory
      SET current_stock = current_stock - v_ship_qty,
          updated_at    = p_local_today::date
      WHERE product_id = v_line.product_id
        AND current_stock >= v_ship_qty
      RETURNING current_stock INTO v_stock_after;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', format('在庫不足 (必要 %s 個)', v_ship_qty));
    END IF;

    UPDATE inventory
      SET allocated_qty = GREATEST(0, COALESCE(allocated_qty, 0) - v_ship_qty)
      WHERE product_id = v_line.product_id;

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

    UPDATE shipment_lines
      SET shipped_qty = v_line.shipped_qty + v_ship_qty,
          status      = CASE
            WHEN v_line.shipped_qty + v_ship_qty >= v_line.quantity THEN 'shipped'
            ELSE 'allocated'
          END
      WHERE id = v_line.id;

    INSERT INTO inventory_transactions
      (product_id, lot_id, transaction_type, quantity_delta, quantity_after,
       reference_id, reference_type, operation_id)
    VALUES
      (v_line.product_id,
       COALESCE(v_line.lot_id, v_first_lot_id),
       'outgoing', -v_ship_qty, v_stock_after,
       v_line.id, 'shipment_lines', p_operation_id || '-' || v_line_key)
    ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  END LOOP;

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

GRANT EXECUTE ON FUNCTION fn_has_active_cycle_count(uuid, bigint)                 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_receive_receipt_line(bigint, text, date, bigint, text, bigint, text, text, uuid, text, bigint, text, text, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_confirm_shipment(bigint, text, text, jsonb)           TO authenticated, anon;
