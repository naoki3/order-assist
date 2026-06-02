-- Add '引当中' to default inventory statuses
CREATE OR REPLACE FUNCTION seed_default_inventory_statuses(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO inventory_statuses (user_id, name, color)
  VALUES
    (p_user_id, '良品',     'green'),
    (p_user_id, '不良品',   'red'),
    (p_user_id, '検査中',   'amber'),
    (p_user_id, '返品',     'blue'),
    (p_user_id, '廃棄予定', 'purple'),
    (p_user_id, '引当中',   'orange')
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$;

-- Backfill existing users
SELECT seed_default_inventory_statuses(id) FROM auth.users;

-- Update fn_allocate_shipment_line to set lot status to '引当中'
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

  -- 引当中ステータスをロットに設定
  UPDATE lots
    SET status_id = (
      SELECT ist.id FROM inventory_statuses ist
      JOIN shipments sh ON sh.user_id = ist.user_id
      WHERE sh.id = v_line.shipment_id AND ist.name = '引当中'
      LIMIT 1
    ),
    status_name = '引当中'
    WHERE id = v_lot.id;

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

-- Update fn_deallocate_shipment_line to clear lot status when no remaining allocations
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

  -- このロットに他の引当がなければステータスをクリア
  IF NOT EXISTS (
    SELECT 1 FROM shipment_lines
    WHERE lot_id = v_line.lot_id AND status = 'allocated'
  ) THEN
    UPDATE lots SET status_id = NULL, status_name = NULL WHERE id = v_line.lot_id;
  END IF;

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
