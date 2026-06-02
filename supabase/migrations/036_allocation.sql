-- ═══════════════════════════════════════════════════════════════════════════
-- 036_allocation.sql
-- 引当(在庫確保)機能
--
-- 出荷フロー:
--   引当確認 (fn_allocate_outgoing)   → allocated_qty 増加、lot_id 確定
--   出荷確定 (fn_confirm_shipment)    → current_stock + allocated_qty 減少
--   出荷取消 (fn_unship_outgoing)     → current_stock + allocated_qty 復元
--   引当解除 (fn_deallocate_outgoing) → allocated_qty 減少、lot_id クリア
-- ═══════════════════════════════════════════════════════════════════════════

-- ── テーブル変更 ────────────────────────────────────────────────────────────

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS allocated_qty integer NOT NULL DEFAULT 0;

ALTER TABLE outgoing_stock
  ADD COLUMN IF NOT EXISTS allocated_at timestamptz;

-- transaction_type に allocate / deallocate を追加
ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'incoming', 'cancel_incoming',
    'outgoing', 'cancel_outgoing',
    'cycle_count', 'adjustment',
    'return',
    'allocate', 'deallocate'
  ));

-- ── 引当削除トリガー ────────────────────────────────────────────────────────
-- 引当済みの出荷予定が削除されたとき allocated_qty を自動補正する

CREATE OR REPLACE FUNCTION fn_on_outgoing_stock_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.allocated_at IS NOT NULL AND OLD.shipped_at IS NULL THEN
    UPDATE inventory
      SET allocated_qty = GREATEST(0, COALESCE(allocated_qty, 0) - OLD.quantity)
      WHERE product_id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tg_outgoing_stock_before_delete ON outgoing_stock;
CREATE TRIGGER tg_outgoing_stock_before_delete
  BEFORE DELETE ON outgoing_stock
  FOR EACH ROW EXECUTE FUNCTION fn_on_outgoing_stock_delete();

-- ── fn_allocate_outgoing ────────────────────────────────────────────────────
-- FEFO でロットを選択し、allocated_qty を増加させる

CREATE OR REPLACE FUNCTION fn_allocate_outgoing(
  p_outgoing_id  bigint,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item  record;
  v_lot   record;
  v_avail integer;
BEGIN
  SELECT id, product_id, quantity, lot_id, allocated_at, shipped_at
    INTO v_item
    FROM outgoing_stock WHERE id = p_outgoing_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷予定が見つかりません');
  END IF;
  IF v_item.shipped_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', '既に出荷確定済みです');
  END IF;
  -- 冪等性: 既に引当済みなら成功
  IF v_item.allocated_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- 利用可能在庫チェック (on_hand - allocated)
  SELECT current_stock - COALESCE(allocated_qty, 0) INTO v_avail
    FROM inventory WHERE product_id = v_item.product_id;

  IF COALESCE(v_avail, 0) < v_item.quantity THEN
    RETURN jsonb_build_object('error',
      format('利用可能在庫不足: 必要 %s 個、利用可能 %s 個',
             v_item.quantity, COALESCE(v_avail, 0)));
  END IF;

  -- FEFO でロット選択 (lot_id 指定済みなら優先)
  IF v_item.lot_id IS NOT NULL THEN
    SELECT id, lot_number, quantity, expiry_date, location_id, location_name, warehouse_id, warehouse_name
      INTO v_lot FROM lots
      WHERE id = v_item.lot_id AND product_id = v_item.product_id
      FOR UPDATE;
  ELSE
    SELECT id, lot_number, quantity, expiry_date, location_id, location_name, warehouse_id, warehouse_name
      INTO v_lot FROM lots
      WHERE product_id = v_item.product_id AND quantity >= v_item.quantity
      ORDER BY expiry_date ASC NULLS LAST, id ASC
      LIMIT 1
      FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error',
      format('利用可能なロットが見つかりません (必要数: %s 個)', v_item.quantity));
  END IF;

  -- outgoing_stock にロット情報を設定して引当確定
  UPDATE outgoing_stock
    SET lot_id         = v_lot.id,
        lot_number     = v_lot.lot_number,
        expiry_date    = v_lot.expiry_date,
        location_id    = COALESCE(location_id,    v_lot.location_id),
        location_name  = COALESCE(location_name,  v_lot.location_name),
        warehouse_id   = COALESCE(warehouse_id,   v_lot.warehouse_id),
        warehouse_name = COALESCE(warehouse_name, v_lot.warehouse_name),
        allocated_at   = now()
    WHERE id = p_outgoing_id;

  -- 引当済み数量を加算
  UPDATE inventory
    SET allocated_qty = COALESCE(allocated_qty, 0) + v_item.quantity
    WHERE product_id = v_item.product_id;

  -- 在庫変動ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta,
     reference_id, reference_type, operation_id)
  VALUES
    (v_item.product_id, v_lot.id, 'allocate', v_item.quantity,
     p_outgoing_id, 'outgoing_stock', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_allocate_bulk_outgoing ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_allocate_bulk_outgoing(
  p_outgoing_ids bigint[],
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id     bigint;
  v_res    jsonb;
  v_errors text[] := '{}';
BEGIN
  FOREACH v_id IN ARRAY p_outgoing_ids LOOP
    v_res := fn_allocate_outgoing(v_id, gen_random_uuid()::text, p_local_today);
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

-- ── fn_deallocate_outgoing ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_deallocate_outgoing(
  p_outgoing_id  bigint,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item record;
BEGIN
  SELECT id, product_id, quantity, lot_id, allocated_at, shipped_at
    INTO v_item
    FROM outgoing_stock WHERE id = p_outgoing_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷予定が見つかりません');
  END IF;
  IF v_item.shipped_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', '出荷確定済みは引当解除できません');
  END IF;
  -- 冪等性: 既に未引当なら成功
  IF v_item.allocated_at IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- 引当解除 (lot 情報をクリア)
  UPDATE outgoing_stock
    SET lot_id       = NULL,
        lot_number   = NULL,
        expiry_date  = NULL,
        allocated_at = NULL
    WHERE id = p_outgoing_id;

  -- 引当済み数量を減算
  UPDATE inventory
    SET allocated_qty = GREATEST(0, COALESCE(allocated_qty, 0) - v_item.quantity)
    WHERE product_id = v_item.product_id;

  -- 在庫変動ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta,
     reference_id, reference_type, operation_id)
  VALUES
    (v_item.product_id, v_item.lot_id, 'deallocate', -v_item.quantity,
     p_outgoing_id, 'outgoing_stock', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_confirm_shipment (更新) ───────────────────────────────────────────────
-- 引当済みの場合 allocated_qty も減算する

CREATE OR REPLACE FUNCTION fn_confirm_shipment(
  p_outgoing_id  bigint,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item          record;
  v_stock_after   integer;
  v_remaining     integer;
  v_take          integer;
  v_first_lot_id  bigint := NULL;
  v_first_lot_num text   := NULL;
  v_lot_row       record;
BEGIN
  SELECT id, product_id, quantity, lot_id, shipped_at, allocated_at
    INTO v_item
    FROM outgoing_stock WHERE id = p_outgoing_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷予定が見つかりません');
  END IF;

  -- 冪等性: 既に出荷済みなら成功
  IF v_item.shipped_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- 在庫チェック・減算 (atomic check-and-update)
  UPDATE inventory
    SET current_stock = current_stock - v_item.quantity,
        updated_at    = p_local_today::date
    WHERE product_id = v_item.product_id
      AND current_stock >= v_item.quantity
    RETURNING current_stock INTO v_stock_after;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error',
      format('在庫不足: 出荷予定 %s 個', v_item.quantity));
  END IF;

  -- 引当済みの場合、allocated_qty も減算
  IF v_item.allocated_at IS NOT NULL THEN
    UPDATE inventory
      SET allocated_qty = GREATEST(0, COALESCE(allocated_qty, 0) - v_item.quantity)
      WHERE product_id = v_item.product_id;
  END IF;

  -- ロット在庫を減算
  IF v_item.lot_id IS NOT NULL THEN
    UPDATE lots
      SET quantity = quantity - v_item.quantity
      WHERE id = v_item.lot_id AND quantity >= v_item.quantity;

    IF NOT FOUND THEN
      -- ロールバック: inventory を元に戻す
      UPDATE inventory
        SET current_stock = current_stock + v_item.quantity,
            updated_at    = p_local_today::date
        WHERE product_id = v_item.product_id;
      IF v_item.allocated_at IS NOT NULL THEN
        UPDATE inventory
          SET allocated_qty = COALESCE(allocated_qty, 0) + v_item.quantity
          WHERE product_id = v_item.product_id;
      END IF;
      RETURN jsonb_build_object('error', 'ロット在庫不足');
    END IF;

  ELSE
    -- FIFO: 賞味期限昇順 → ロット番号昇順
    v_remaining := v_item.quantity;
    FOR v_lot_row IN
      SELECT id, quantity, lot_number
        FROM lots
        WHERE product_id = v_item.product_id AND quantity > 0
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
      UPDATE outgoing_stock
        SET lot_id = v_first_lot_id, lot_number = v_first_lot_num
        WHERE id = p_outgoing_id;
    END IF;
  END IF;

  -- 出荷確定
  UPDATE outgoing_stock SET shipped_at = now() WHERE id = p_outgoing_id;

  -- 在庫変動ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta, quantity_after,
     reference_id, reference_type, operation_id)
  VALUES
    (v_item.product_id,
     COALESCE(v_item.lot_id, v_first_lot_id),
     'outgoing', -v_item.quantity, v_stock_after,
     p_outgoing_id, 'outgoing_stock', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_unship_outgoing (更新) ─────────────────────────────────────────────
-- 出荷取消後は引当済み状態に戻す (allocated_qty を復元)

CREATE OR REPLACE FUNCTION fn_unship_outgoing(
  p_outgoing_id  bigint,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item record;
BEGIN
  SELECT id, product_id, quantity, lot_id, shipped_at, allocated_at
    INTO v_item
    FROM outgoing_stock WHERE id = p_outgoing_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷済みレコードが見つかりません');
  END IF;

  -- 冪等性: 既に未出荷なら成功
  IF v_item.shipped_at IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- 在庫を戻す
  UPDATE inventory
    SET current_stock = current_stock + v_item.quantity,
        updated_at    = p_local_today::date
    WHERE product_id = v_item.product_id;

  -- 引当済みだった場合、allocated_qty を復元 (出荷確定タブに戻る)
  IF v_item.allocated_at IS NOT NULL THEN
    UPDATE inventory
      SET allocated_qty = COALESCE(allocated_qty, 0) + v_item.quantity
      WHERE product_id = v_item.product_id;
  END IF;

  -- ロット在庫を戻す
  IF v_item.lot_id IS NOT NULL THEN
    UPDATE lots SET quantity = quantity + v_item.quantity WHERE id = v_item.lot_id;
  END IF;

  -- shipped_at のみクリア (allocated_at は保持)
  UPDATE outgoing_stock SET shipped_at = NULL WHERE id = p_outgoing_id;

  -- 在庫変動ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta,
     reference_id, reference_type, operation_id)
  VALUES
    (v_item.product_id, v_item.lot_id, 'cancel_outgoing', v_item.quantity,
     p_outgoing_id, 'outgoing_stock', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 実行権限付与 ────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION fn_allocate_outgoing      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_allocate_bulk_outgoing TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_deallocate_outgoing    TO authenticated, anon;
