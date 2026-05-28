-- 050_shipment_line_unit_price.sql
-- Snapshot product price onto shipment_lines at confirm time so historical
-- revenue remains correct even when the product price is later updated.

ALTER TABLE shipment_lines
  ADD COLUMN IF NOT EXISTS unit_price numeric;

-- Re-create fn_confirm_shipment to capture unit_price when a line ships.
-- Identical to 046 except: unit_price = COALESCE(unit_price, product price subquery)
-- is added to the UPDATE shipment_lines SET block inside the loop.

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
          unit_price  = COALESCE(unit_price, (SELECT price FROM products WHERE id = v_line.product_id)),
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

GRANT EXECUTE ON FUNCTION fn_confirm_shipment(bigint, text, text, jsonb) TO authenticated, anon;
