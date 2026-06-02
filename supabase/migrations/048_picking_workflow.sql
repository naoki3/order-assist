-- ── Migration 048: Picking workflow ──────────────────────────────────────────
-- Implements the picking/picked/on_hold statuses that existed in the schema
-- but had no corresponding functions.
-- Flow: requested → allocated → picking → picked → shipped
--       any → on_hold → (previous status restored on release)

-- Restore picking/picked/on_hold to shipments status CHECK
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
  CHECK (status IN (
    'requested', 'allocated', 'picking', 'picked', 'shipped', 'cancelled', 'on_hold'
  ));

-- Store the status that was active before going on_hold so we can restore it
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS on_hold_reason    text,
  ADD COLUMN IF NOT EXISTS pre_hold_status   text;

-- ── fn_start_picking ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_start_picking(
  p_shipment_id bigint,
  p_owner_id    uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ship record;
BEGIN
  SELECT id, status INTO v_ship
    FROM shipments
    WHERE id = p_shipment_id AND user_id = p_owner_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷伝票が見つかりません');
  END IF;
  IF v_ship.status != 'allocated' THEN
    RETURN jsonb_build_object('error',
      format('引当済み状態の伝票のみピッキング開始できます (現在: %s)', v_ship.status));
  END IF;

  UPDATE shipments SET status = 'picking' WHERE id = p_shipment_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_complete_picking ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_complete_picking(
  p_shipment_id bigint,
  p_owner_id    uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ship record;
BEGIN
  SELECT id, status INTO v_ship
    FROM shipments
    WHERE id = p_shipment_id AND user_id = p_owner_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷伝票が見つかりません');
  END IF;
  IF v_ship.status != 'picking' THEN
    RETURN jsonb_build_object('error',
      format('ピッキング中の伝票のみ完了できます (現在: %s)', v_ship.status));
  END IF;

  UPDATE shipments SET status = 'picked' WHERE id = p_shipment_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_put_shipment_on_hold ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_put_shipment_on_hold(
  p_shipment_id bigint,
  p_owner_id    uuid,
  p_reason      text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ship record;
BEGIN
  SELECT id, status INTO v_ship
    FROM shipments
    WHERE id = p_shipment_id AND user_id = p_owner_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷伝票が見つかりません');
  END IF;
  IF v_ship.status IN ('shipped', 'cancelled', 'on_hold') THEN
    RETURN jsonb_build_object('error',
      format('この状態では保留にできません (現在: %s)', v_ship.status));
  END IF;

  UPDATE shipments
    SET status          = 'on_hold',
        pre_hold_status = v_ship.status,
        on_hold_reason  = p_reason
    WHERE id = p_shipment_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── fn_release_shipment_hold ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_release_shipment_hold(
  p_shipment_id bigint,
  p_owner_id    uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ship record;
BEGIN
  SELECT id, status, pre_hold_status INTO v_ship
    FROM shipments
    WHERE id = p_shipment_id AND user_id = p_owner_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '出荷伝票が見つかりません');
  END IF;
  IF v_ship.status != 'on_hold' THEN
    RETURN jsonb_build_object('error', '保留中の伝票のみ解除できます');
  END IF;

  UPDATE shipments
    SET status          = COALESCE(v_ship.pre_hold_status, 'allocated'),
        pre_hold_status = NULL,
        on_hold_reason  = NULL
    WHERE id = p_shipment_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- fn_confirm_shipment: also accept 'picking' and 'picked' statuses
-- (re-create to handle on_hold check is already in 046; here we only need
--  to ensure the status filter in fn_confirm_shipment processes 'picking'/'picked' too)
-- The 046 version already guards on_hold. No further change needed since
-- fn_confirm_shipment processes lines by allocated_at IS NOT NULL AND status = 'allocated'.
-- After picking starts, line statuses stay 'allocated' — only the header changes.

GRANT EXECUTE ON FUNCTION fn_start_picking(bigint, uuid)         TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_complete_picking(bigint, uuid)      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_put_shipment_on_hold(bigint, uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_release_shipment_hold(bigint, uuid) TO authenticated, anon;
