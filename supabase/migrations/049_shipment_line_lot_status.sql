-- Migration 049: Snapshot lot status onto shipment_lines at allocation time
-- Adds lot_status_name / lot_status_color so the confirm and history screens
-- can display what quality status the lot had when it was allocated.

ALTER TABLE shipment_lines
  ADD COLUMN IF NOT EXISTS lot_status_name  text,
  ADD COLUMN IF NOT EXISTS lot_status_color text;

-- Re-create fn_allocate_shipment_line (based on 041) with status capture.
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

  -- FEFO ロット選択 (status_name / status_color も取得)
  IF v_line.lot_id IS NOT NULL THEN
    SELECT id, lot_number, quantity, expiry_date,
           location_id, location_name, warehouse_id, warehouse_name,
           status_name, status_color
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
    SELECT id, lot_number, quantity, expiry_date,
           location_id, location_name, warehouse_id, warehouse_name,
           status_name, status_color
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

  -- ロット情報 + 在庫状態スナップショットを設定して引当確定
  UPDATE shipment_lines
    SET lot_id           = v_lot.id,
        lot_number       = v_lot.lot_number,
        expiry_date      = v_lot.expiry_date,
        location_id      = COALESCE(location_id,   v_lot.location_id),
        location_name    = COALESCE(location_name, v_lot.location_name),
        warehouse_id     = COALESCE(warehouse_id,  v_lot.warehouse_id),
        warehouse_name   = COALESCE(warehouse_name,v_lot.warehouse_name),
        lot_status_name  = v_lot.status_name,
        lot_status_color = v_lot.status_color,
        allocated_at     = now(),
        status           = 'allocated'
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

GRANT EXECUTE ON FUNCTION fn_allocate_shipment_line(bigint, text, text) TO authenticated, anon;
