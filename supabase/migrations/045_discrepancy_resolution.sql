-- ── Migration 045: Discrepancy resolution ────────────────────────────────────
-- Adds resolution column to receipt_lines and fn_resolve_receipt_discrepancy.
-- resolution = 'written_off': accept the shortage, mark line as received.
-- resolution = 'reordered': note that a follow-up receipt will be created,
--   line stays 'discrepancy' but header is updated when all lines are resolved.

ALTER TABLE receipt_lines
  ADD COLUMN IF NOT EXISTS resolution text
  CHECK (resolution IN ('written_off', 'reordered'));

CREATE OR REPLACE FUNCTION fn_resolve_receipt_discrepancy(
  p_receipt_line_id bigint,
  p_resolution      text,
  p_owner_id        uuid,
  p_operation_id    text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line record;
BEGIN
  SELECT rl.id, rl.receipt_id, rl.status, rl.expected_qty, rl.received_qty
    INTO v_line
    FROM receipt_lines rl
    JOIN receipts r ON r.id = rl.receipt_id
    WHERE rl.id = p_receipt_line_id AND r.user_id = p_owner_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '入荷明細が見つかりません');
  END IF;

  IF v_line.status != 'discrepancy' THEN
    RETURN jsonb_build_object('error', '差異ステータスの明細のみ解決できます');
  END IF;

  IF p_resolution NOT IN ('written_off', 'reordered') THEN
    RETURN jsonb_build_object('error', '不正な解決方法です');
  END IF;

  UPDATE receipt_lines
    SET resolution = p_resolution,
        status     = CASE WHEN p_resolution = 'written_off' THEN 'received' ELSE status END
    WHERE id = p_receipt_line_id;

  -- Update receipt header when all discrepancy lines are resolved
  UPDATE receipts
    SET status = CASE
          WHEN EXISTS (
            SELECT 1 FROM receipt_lines
            WHERE receipt_id = v_line.receipt_id
              AND status = 'discrepancy'
              AND resolution IS NULL
          ) THEN 'discrepancy'
          ELSE 'received'
        END
    WHERE id = v_line.receipt_id
      AND NOT EXISTS (
        SELECT 1 FROM receipt_lines
        WHERE receipt_id = v_line.receipt_id
          AND status NOT IN ('received', 'discrepancy', 'cancelled')
      );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_resolve_receipt_discrepancy(bigint, text, uuid, text) TO authenticated, anon;
