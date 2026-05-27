-- ═══════════════════════════════════════════════════════════════════════════
-- 035_inventory_transactions.sql
-- 在庫変動履歴テーブル + 排他ロック付き在庫更新関数
--
-- 目的:
--   1. inventory_transactions: 全在庫変動の監査ログ
--   2. DB関数内での SELECT FOR UPDATE: 同時更新の競合を防ぐ
--   3. operation_id ユニーク制約: 二重処理の防止
-- ═══════════════════════════════════════════════════════════════════════════

-- ── テーブル ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id               bigserial PRIMARY KEY,
  product_id       bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  lot_id           bigint REFERENCES lots(id) ON DELETE SET NULL,
  transaction_type text NOT NULL
                   CHECK (transaction_type IN (
                     'incoming', 'cancel_incoming',
                     'outgoing', 'cancel_outgoing',
                     'cycle_count', 'adjustment',
                     'return'
                   )),
  quantity_delta   integer NOT NULL,
  quantity_after   integer,
  reference_id     bigint,
  reference_type   text,
  operation_id     text,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- operation_id は NULL 以外の場合だけ一意制約
CREATE UNIQUE INDEX IF NOT EXISTS inventory_transactions_op_id_idx
  ON inventory_transactions (operation_id)
  WHERE operation_id IS NOT NULL;

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_inventory_transactions" ON inventory_transactions FOR ALL
  USING  (product_id IN (SELECT id FROM products WHERE user_id = get_owner_id()))
  WITH CHECK (product_id IN (SELECT id FROM products WHERE user_id = get_owner_id()));

-- ── 出荷確認 ────────────────────────────────────────────────────────────────
-- 排他ロック → 在庫チェック → ロット引当 → 出荷確定 → ログ記録
-- already shipped なら冪等成功を返す

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
  -- outgoing_stock 行をロック
  SELECT id, product_id, quantity, lot_id, shipped_at
    INTO v_item
    FROM outgoing_stock WHERE id = p_outgoing_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷予定が見つかりません');
  END IF;

  -- 冪等性: 既に出荷済みなら成功を返す
  IF v_item.shipped_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- 在庫テーブルをロックしつつ数量チェック・減算 (atomic check-and-update)
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

  -- ロット在庫を減算
  IF v_item.lot_id IS NOT NULL THEN
    -- 指定ロット: ロック → チェック → 減算
    UPDATE lots
      SET quantity = quantity - v_item.quantity
      WHERE id = v_item.lot_id AND quantity >= v_item.quantity;

    IF NOT FOUND THEN
      -- inventory を元に戻す
      UPDATE inventory
        SET current_stock = current_stock + v_item.quantity,
            updated_at    = p_local_today::date
        WHERE product_id = v_item.product_id;
      RETURN jsonb_build_object('error', 'ロット在庫不足');
    END IF;

  ELSE
    -- FIFO: 賞味期限昇順 → ロット番号昇順 で引当
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

    -- outgoing_stock にロット情報を紐付け
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

-- ── 出荷一括確認 ────────────────────────────────────────────────────────────
-- fn_confirm_shipment を複数件ループ (同一トランザクション)

CREATE OR REPLACE FUNCTION fn_confirm_bulk_shipment(
  p_outgoing_ids bigint[],
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id     bigint;
  v_res    jsonb;
  v_errors text[] := '{}';
BEGIN
  FOREACH v_id IN ARRAY p_outgoing_ids LOOP
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

-- ── 出荷取り消し ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_unship_outgoing(
  p_outgoing_id  bigint,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item record;
BEGIN
  SELECT id, product_id, quantity, lot_id, shipped_at
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

  -- ロット在庫を戻す
  IF v_item.lot_id IS NOT NULL THEN
    UPDATE lots SET quantity = quantity + v_item.quantity WHERE id = v_item.lot_id;
  END IF;

  -- 出荷フラグを解除
  UPDATE outgoing_stock SET shipped_at = NULL WHERE id = p_outgoing_id;

  -- ログ
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

-- ── 入荷確認 ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_receive_incoming(
  p_incoming_id    bigint,
  p_lot_number     text,
  p_expiry_date    date,
  p_location_id    bigint,
  p_location_name  text,
  p_warehouse_id   bigint,
  p_warehouse_name text,
  p_local_today    text,
  p_owner_id       uuid,
  p_operation_id   text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item        record;
  v_lot_id      bigint;
  v_stock_after integer;
BEGIN
  SELECT id, product_id, product_name, quantity, received_at
    INTO v_item
    FROM incoming_stock WHERE id = p_incoming_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '入荷予定が見つかりません');
  END IF;

  -- 冪等性: 既に入荷済みなら成功
  IF v_item.received_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- ロット作成
  INSERT INTO lots
    (lot_number, product_id, product_name, quantity, received_at, expiry_date,
     incoming_stock_id, user_id, location_id, location_name, warehouse_id, warehouse_name)
  VALUES
    (p_lot_number, v_item.product_id, v_item.product_name, v_item.quantity,
     p_local_today::date, p_expiry_date, p_incoming_id, p_owner_id,
     p_location_id, p_location_name, p_warehouse_id, p_warehouse_name)
  RETURNING id INTO v_lot_id;

  -- 在庫を加算 (product_id PRIMARY KEY なので upsert)
  INSERT INTO inventory (product_id, current_stock, updated_at)
    VALUES (v_item.product_id, v_item.quantity, p_local_today::date)
    ON CONFLICT (product_id) DO UPDATE
      SET current_stock = inventory.current_stock + EXCLUDED.current_stock,
          updated_at    = EXCLUDED.updated_at
    RETURNING current_stock INTO v_stock_after;

  -- incoming_stock を入荷済みとしてマーク
  UPDATE incoming_stock
    SET received_at   = now(),
        lot_number    = p_lot_number,
        expiry_date   = p_expiry_date,
        location_id   = p_location_id,
        location_name = p_location_name
    WHERE id = p_incoming_id;

  -- ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta, quantity_after,
     reference_id, reference_type, operation_id)
  VALUES
    (v_item.product_id, v_lot_id, 'incoming', v_item.quantity, v_stock_after,
     p_incoming_id, 'incoming_stock', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 入荷取り消し ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_unreceive_incoming(
  p_incoming_id  bigint,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item record;
BEGIN
  SELECT id, product_id, quantity, received_at
    INTO v_item
    FROM incoming_stock WHERE id = p_incoming_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '入荷済みレコードが見つかりません');
  END IF;

  -- 冪等性: 既に未入荷なら成功
  IF v_item.received_at IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- ロット削除
  DELETE FROM lots WHERE incoming_stock_id = p_incoming_id;

  -- 在庫を戻す
  UPDATE inventory
    SET current_stock = GREATEST(0, current_stock - v_item.quantity),
        updated_at    = p_local_today::date
    WHERE product_id = v_item.product_id;

  -- 入荷フラグをクリア
  UPDATE incoming_stock SET received_at = NULL WHERE id = p_incoming_id;

  -- ログ
  INSERT INTO inventory_transactions
    (product_id, transaction_type, quantity_delta,
     reference_id, reference_type, operation_id)
  VALUES
    (v_item.product_id, 'cancel_incoming', -v_item.quantity,
     p_incoming_id, 'incoming_stock', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 返品 ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_return_outgoing(
  p_outgoing_id  bigint,
  p_return_qty   integer,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item        record;
  v_max_return  integer;
  v_stock_after integer;
BEGIN
  SELECT id, product_id, quantity, lot_id, returned_qty, shipped_at
    INTO v_item
    FROM outgoing_stock WHERE id = p_outgoing_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷済みレコードが見つかりません');
  END IF;
  IF v_item.shipped_at IS NULL THEN
    RETURN jsonb_build_object('error', '出荷確定前は返品できません');
  END IF;

  v_max_return := v_item.quantity - COALESCE(v_item.returned_qty, 0);
  IF p_return_qty > v_max_return THEN
    RETURN jsonb_build_object('error',
      format('返品数量は %s 個以下にしてください', v_max_return));
  END IF;
  IF p_return_qty <= 0 THEN
    RETURN jsonb_build_object('error', '返品数量は1以上が必要です');
  END IF;

  -- 返品数量を加算
  UPDATE outgoing_stock
    SET returned_qty = COALESCE(returned_qty, 0) + p_return_qty
    WHERE id = p_outgoing_id;

  -- ロット在庫を戻す
  IF v_item.lot_id IS NOT NULL THEN
    UPDATE lots SET quantity = quantity + p_return_qty WHERE id = v_item.lot_id;
  END IF;

  -- 在庫を戻す
  UPDATE inventory
    SET current_stock = current_stock + p_return_qty,
        updated_at    = p_local_today::date
    WHERE product_id = v_item.product_id
    RETURNING current_stock INTO v_stock_after;

  -- ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta, quantity_after,
     reference_id, reference_type, operation_id)
  VALUES
    (v_item.product_id, v_item.lot_id, 'return', p_return_qty, v_stock_after,
     p_outgoing_id, 'outgoing_stock', p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 棚卸し ─────────────────────────────────────────────────────────────────
-- 全ロットをロックして一括更新し、在庫を再集計して確定

CREATE OR REPLACE FUNCTION fn_save_cycle_count(
  p_entries      jsonb,  -- [{lot_id: number, actual_qty: number}]
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entry       record;
  v_lot         record;
  v_delta       integer;
  v_product_ids bigint[] := '{}';
  v_pid         bigint;
  v_total_stock integer;
BEGIN
  -- 第1パス: 各ロットをロック・更新
  FOR v_entry IN
    SELECT (value->>'lot_id')::bigint    AS lot_id,
           (value->>'actual_qty')::integer AS actual_qty
    FROM jsonb_array_elements(p_entries)
  LOOP
    SELECT id, product_id, quantity INTO v_lot
      FROM lots WHERE id = v_entry.lot_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_delta := v_entry.actual_qty - v_lot.quantity;
    IF v_delta = 0 THEN CONTINUE; END IF;

    UPDATE lots SET quantity = v_entry.actual_qty WHERE id = v_lot.id;

    v_product_ids := array_append(v_product_ids, v_lot.product_id);

    -- 差異ログ (lot ごとに独立した operation_id を生成)
    INSERT INTO inventory_transactions
      (product_id, lot_id, transaction_type, quantity_delta,
       reference_type, operation_id)
    VALUES
      (v_lot.product_id, v_lot.id, 'cycle_count', v_delta,
       'cycle_count', p_operation_id || '-' || v_lot.id::text)
    ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;
  END LOOP;

  -- 第2パス: 影響商品の在庫をロット合計から再計算
  FOREACH v_pid IN ARRAY (SELECT ARRAY(SELECT DISTINCT unnest(v_product_ids))) LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_total_stock
      FROM lots WHERE product_id = v_pid;

    UPDATE inventory
      SET current_stock = v_total_stock,
          updated_at    = p_local_today::date
      WHERE product_id = v_pid;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── ロット数量調整 (管理者操作) ────────────────────────────────────────────

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

  -- 出荷予定での引当数量チェック
  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
    FROM outgoing_stock WHERE lot_id = p_lot_id AND shipped_at IS NULL;

  IF p_new_qty < v_reserved THEN
    RETURN jsonb_build_object('error',
      format('出荷予定で %s 個確保済みのため %s 個未満には設定できません',
             v_reserved, v_reserved));
  END IF;

  v_delta := p_new_qty - v_lot.quantity;
  UPDATE lots SET quantity = p_new_qty WHERE id = p_lot_id;

  -- 在庫をロット合計から再計算
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_stock
    FROM lots WHERE product_id = v_lot.product_id;

  UPDATE inventory
    SET current_stock = v_total_stock,
        updated_at    = p_local_today::date
    WHERE product_id = v_lot.product_id;

  -- ログ
  INSERT INTO inventory_transactions
    (product_id, lot_id, transaction_type, quantity_delta, quantity_after, operation_id)
  VALUES
    (v_lot.product_id, p_lot_id, 'adjustment', v_delta, v_total_stock, p_operation_id)
  ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 実行権限付与 ────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION fn_confirm_shipment      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_confirm_bulk_shipment TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_unship_outgoing       TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_receive_incoming      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_unreceive_incoming    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_return_outgoing       TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_save_cycle_count      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_adjust_lot_quantity   TO authenticated, anon;
