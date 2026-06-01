-- ── Migration 044: Cycle count approval workflow ──────────────────────────────

CREATE TABLE IF NOT EXISTS cycle_count_sessions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid   NOT NULL,
  status        text   NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'pending_approval', 'applied', 'discarded')),
  warehouse_id   bigint REFERENCES warehouses(id),
  warehouse_name text,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  applied_at    timestamptz
);

CREATE TABLE IF NOT EXISTS cycle_count_lines (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  bigint  NOT NULL REFERENCES cycle_count_sessions(id) ON DELETE CASCADE,
  lot_id      bigint  NOT NULL REFERENCES lots(id),
  system_qty  integer NOT NULL,
  actual_qty  integer NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE cycle_count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_count_lines     ENABLE ROW LEVEL SECURITY;

CREATE POLICY cycle_count_sessions_rls ON cycle_count_sessions
  USING (user_id = get_owner_id())
  WITH CHECK (user_id = get_owner_id());

CREATE POLICY cycle_count_lines_rls ON cycle_count_lines
  USING (
    EXISTS (
      SELECT 1 FROM cycle_count_sessions
      WHERE id = session_id AND user_id = get_owner_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cycle_count_sessions
      WHERE id = session_id AND user_id = get_owner_id()
    )
  );

-- ── fn_save_cycle_count_draft ─────────────────────────────────────────────────
-- Creates or replaces a draft session with the provided entries.
-- p_entries: [{lot_id, actual_qty, system_qty}]
-- p_session_id: pass existing id to overwrite, NULL to create new
-- Returns: {ok: true, session_id: <id>}

CREATE OR REPLACE FUNCTION fn_save_cycle_count_draft(
  p_entries    jsonb,
  p_session_id bigint,
  p_owner_id   uuid,
  p_warehouse_id   bigint DEFAULT NULL,
  p_warehouse_name text   DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session_id bigint;
  v_entry      record;
BEGIN
  IF p_session_id IS NOT NULL THEN
    -- Update existing draft
    SELECT id INTO v_session_id
      FROM cycle_count_sessions
      WHERE id = p_session_id AND user_id = p_owner_id AND status = 'draft';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', '棚卸しドラフトが見つかりません');
    END IF;

    DELETE FROM cycle_count_lines WHERE session_id = v_session_id;

    UPDATE cycle_count_sessions
      SET updated_at    = now(),
          warehouse_id   = p_warehouse_id,
          warehouse_name = p_warehouse_name
      WHERE id = v_session_id;
  ELSE
    -- Create new session
    INSERT INTO cycle_count_sessions (user_id, warehouse_id, warehouse_name)
    VALUES (p_owner_id, p_warehouse_id, p_warehouse_name)
    RETURNING id INTO v_session_id;
  END IF;

  -- Insert lines
  FOR v_entry IN
    SELECT (value->>'lot_id')::bigint    AS lot_id,
           (value->>'actual_qty')::integer AS actual_qty,
           (value->>'system_qty')::integer AS system_qty
    FROM jsonb_array_elements(p_entries)
  LOOP
    INSERT INTO cycle_count_lines (session_id, lot_id, system_qty, actual_qty)
    VALUES (v_session_id, v_entry.lot_id, v_entry.system_qty, v_entry.actual_qty);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'session_id', v_session_id);
END;
$$;

-- ── fn_apply_cycle_count_session ─────────────────────────────────────────────
-- Applies all adjustments in the session and marks it 'applied'.

CREATE OR REPLACE FUNCTION fn_apply_cycle_count_session(
  p_session_id   bigint,
  p_owner_id     uuid,
  p_operation_id text,
  p_local_today  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line        record;
  v_lot         record;
  v_delta       integer;
  v_product_ids bigint[] := '{}';
  v_pid         bigint;
  v_total_stock integer;
BEGIN
  -- Verify session belongs to owner and is in draft state
  IF NOT EXISTS (
    SELECT 1 FROM cycle_count_sessions
    WHERE id = p_session_id AND user_id = p_owner_id AND status = 'draft'
  ) THEN
    RETURN jsonb_build_object('error', '棚卸しドラフトが見つかりません (適用済みまたは存在しない)');
  END IF;

  -- Apply each adjustment
  FOR v_line IN
    SELECT lot_id, actual_qty
    FROM cycle_count_lines WHERE session_id = p_session_id
  LOOP
    SELECT id, product_id, quantity INTO v_lot
      FROM lots WHERE id = v_line.lot_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_delta := v_line.actual_qty - v_lot.quantity;
    IF v_delta = 0 THEN CONTINUE; END IF;

    IF v_line.actual_qty < 0 THEN CONTINUE; END IF;

    UPDATE lots SET quantity = v_line.actual_qty WHERE id = v_lot.id;

    v_product_ids := array_append(v_product_ids, v_lot.product_id);

    INSERT INTO inventory_transactions
      (product_id, lot_id, transaction_type, quantity_delta,
       reference_type, operation_id)
    VALUES
      (v_lot.product_id, v_lot.id, 'cycle_count', v_delta,
       'cycle_count', p_operation_id || '-' || v_lot.id::text)
    ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;
  END LOOP;

  -- Recalculate inventory for affected products
  FOREACH v_pid IN ARRAY (SELECT ARRAY(SELECT DISTINCT unnest(v_product_ids))) LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_total_stock
      FROM lots WHERE product_id = v_pid;

    UPDATE inventory
      SET current_stock = v_total_stock,
          updated_at    = p_local_today::date
      WHERE product_id = v_pid;
  END LOOP;

  -- Mark session as applied
  UPDATE cycle_count_sessions
    SET status = 'applied', applied_at = now()
    WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_discard_cycle_count_session ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_discard_cycle_count_session(
  p_session_id bigint,
  p_owner_id   uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE cycle_count_sessions
    SET status = 'discarded'
    WHERE id = p_session_id AND user_id = p_owner_id AND status = 'draft';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '棚卸しドラフトが見つかりません');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Also add non-negative check to fn_save_cycle_count (existing function)
CREATE OR REPLACE FUNCTION fn_save_cycle_count(
  p_entries      jsonb,
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
  FOR v_entry IN
    SELECT (value->>'lot_id')::bigint    AS lot_id,
           (value->>'actual_qty')::integer AS actual_qty
    FROM jsonb_array_elements(p_entries)
  LOOP
    IF v_entry.actual_qty < 0 THEN CONTINUE; END IF;

    SELECT id, product_id, quantity INTO v_lot
      FROM lots WHERE id = v_entry.lot_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_delta := v_entry.actual_qty - v_lot.quantity;
    IF v_delta = 0 THEN CONTINUE; END IF;

    UPDATE lots SET quantity = v_entry.actual_qty WHERE id = v_lot.id;

    v_product_ids := array_append(v_product_ids, v_lot.product_id);

    INSERT INTO inventory_transactions
      (product_id, lot_id, transaction_type, quantity_delta,
       reference_type, operation_id)
    VALUES
      (v_lot.product_id, v_lot.id, 'cycle_count', v_delta,
       'cycle_count', p_operation_id || '-' || v_lot.id::text)
    ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING;
  END LOOP;

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

GRANT EXECUTE ON FUNCTION fn_save_cycle_count_draft        TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_apply_cycle_count_session     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_discard_cycle_count_session   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_save_cycle_count              TO authenticated, anon;
