-- ── Migration 047: Return quality check ──────────────────────────────────────
-- Extends fn_return_shipment_line with optional status params.
-- If status differs from the original lot's status, a new lot is created at
-- the same location with the specified status rather than adding back to the
-- original lot. This allows returns to be quarantined as defective/inspection.
-- Also adds cycle count lock.

DROP FUNCTION IF EXISTS fn_return_shipment_line(bigint, integer, text, text);

CREATE OR REPLACE FUNCTION fn_return_shipment_line(
  p_line_id      bigint,
  p_return_qty   integer,
  p_operation_id text,
  p_local_today  text,
  p_status_id    bigint DEFAULT NULL,
  p_status_name  text   DEFAULT NULL,
  p_status_color text   DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line        record;
  v_lot         record;
  v_owner_id    uuid;
  v_max_return  integer;
  v_stock_after integer;
  v_new_lot_id  bigint;
BEGIN
  SELECT sl.id, sl.product_id, sl.quantity, sl.lot_id,
         sl.returned_qty, sl.shipped_qty,
         s.user_id AS owner_id
    INTO v_line
    FROM shipment_lines sl
    JOIN shipments s ON s.id = sl.shipment_id
    WHERE sl.id = p_line_id
    FOR UPDATE OF sl;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷明細が見つかりません');
  END IF;
  IF v_line.shipped_qty = 0 THEN
    RETURN jsonb_build_object('error', '出荷確定前は返品できません');
  END IF;

  v_owner_id   := v_line.owner_id;
  v_max_return := v_line.shipped_qty - COALESCE(v_line.returned_qty, 0);
  IF p_return_qty > v_max_return THEN
    RETURN jsonb_build_object('error',
      format('返品数量は %s 個以下にしてください', v_max_return));
  END IF;
  IF p_return_qty <= 0 THEN
    RETURN jsonb_build_object('error', '返品数量は1以上が必要です');
  END IF;

  -- 棚卸しロックチェック
  IF fn_has_active_cycle_count(v_owner_id, NULL) THEN
    RETURN jsonb_build_object('error', '棚卸し中は返品処理ができません。棚卸しを完了または破棄してから操作してください');
  END IF;

  UPDATE shipment_lines
    SET returned_qty = COALESCE(returned_qty, 0) + p_return_qty
    WHERE id = p_line_id;

  -- ステータス指定あり: 元ロットとは別のロットとして返品在庫を積む
  IF p_status_name IS NOT NULL AND v_line.lot_id IS NOT NULL THEN
    SELECT id, lot_number, product_id, product_name, expiry_date,
           location_id, location_name, warehouse_id, warehouse_name,
           status_name
      INTO v_lot FROM lots WHERE id = v_line.lot_id;

    -- ステータスが異なる場合は新規ロットを作成
    IF v_lot.status_name IS DISTINCT FROM p_status_name THEN
      INSERT INTO lots
        (lot_number, product_id, product_name, quantity, received_at, expiry_date,
         receipt_line_id, user_id, location_id, location_name, warehouse_id, warehouse_name,
         status_id, status_name, status_color)
      VALUES
        (v_lot.lot_number, v_lot.product_id, v_lot.product_name, p_return_qty,
         p_local_today::date, v_lot.expiry_date,
         NULL, v_owner_id,
         v_lot.location_id, v_lot.location_name, v_lot.warehouse_id, v_lot.warehouse_name,
         p_status_id, p_status_name, p_status_color)
      RETURNING id INTO v_new_lot_id;
    ELSE
      -- 同じステータスなら元ロットに戻す
      UPDATE lots SET quantity = quantity + p_return_qty WHERE id = v_line.lot_id;
    END IF;

  ELSIF v_line.lot_id IS NOT NULL THEN
    -- ステータス指定なし: 元ロットに戻す
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
    (v_line.product_id,
     COALESCE(v_new_lot_id, v_line.lot_id),
     'return', p_return_qty, v_stock_after,
     p_line_id, 'shipment_lines', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_return_shipment_line(bigint, integer, text, text, bigint, text, text) TO authenticated, anon;
