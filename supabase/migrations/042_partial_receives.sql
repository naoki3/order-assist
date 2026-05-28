-- ── Migration 042: Partial receives ─────────────────────────────────────────
-- Adds p_received_qty parameter to fn_receive_receipt_line.
-- When received_qty < expected_qty: receipt_line status = 'discrepancy'.
-- Receipt header becomes 'discrepancy' when at least one line is discrepancy
-- and no lines are still pending.

DROP FUNCTION IF EXISTS fn_receive_receipt_line(bigint, text, date, bigint, text, bigint, text, text, uuid, text);
DROP FUNCTION IF EXISTS fn_receive_receipt_line(bigint, text, date, bigint, text, bigint, text, text, uuid, text, bigint, text, text);

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

GRANT EXECUTE ON FUNCTION fn_receive_receipt_line(bigint, text, date, bigint, text, bigint, text, text, uuid, text, bigint, text, text, integer) TO authenticated, anon;
