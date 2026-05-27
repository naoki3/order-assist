export interface Product {
  id: number;
  name: string;
  lead_time_days: number;
  safety_stock_days: number;
  price: number | null;
  shelf_life_days: number | null;
  expiry_type: string | null;
  pieces_per_ball: number | null;
  balls_per_case: number | null;
  cases_per_pallet: number | null;
  incoming_fee_per_piece: number | null;
  storage_fee_per_piece: number | null;
  outgoing_fee_per_piece: number | null;
  default_warehouse_id: number | null;
  default_warehouse_name: string | null;
}

export interface Sale {
  id: number;
  product_id: number;
  date: string;
  quantity: number;
}

export interface Inventory {
  product_id: number;
  current_stock: number;
  allocated_qty: number;
  updated_at: string;
}

export interface OrderHistoryItem {
  id: number;
  created_at: string;
  items: unknown;
}

// ─── 入荷 ────────────────────────────────────────────────────────────────────

export interface Receipt {
  id: number;
  receipt_no: string;
  receipt_type: string;
  status: string;
  supplier_id: number | null;
  supplier_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  external_ref_no: string | null;
  source_system: string;
  order_history_id: number | null;
  expected_date: string;
  received_at: string | null;
  note: string | null;
  user_id: string;
  created_at: string;
}

export interface ReceiptLine {
  id: number;
  receipt_id: number;
  product_id: number;
  product_name: string;
  expected_qty: number;
  received_qty: number | null;
  lot_number: string | null;
  expiry_date: string | null;
  location_id: number | null;
  location_name: string | null;
  status: string;
  note: string | null;
  user_id: string;
  created_at: string;
}

/** Receipt with its lines embedded (for page-level queries). */
export type ReceiptWithLines = Receipt & { receipt_lines: ReceiptLine[] };

/** Flat view merging receipt header + one line — mirrors the old IncomingStock shape. */
export type IncomingStock = ReceiptLine & {
  // header fields
  receipt_no: string;
  receipt_type: string;
  receipt_status: string;
  supplier_id: number | null;
  supplier_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  order_history_id: number | null;
  expected_date: string;
  quantity: number;       // alias for expected_qty
  received_at: string | null;
};

// ─── 出荷 ────────────────────────────────────────────────────────────────────

export interface Shipment {
  id: number;
  shipment_no: string;
  shipment_type: string;
  status: string;
  destination_id: number | null;
  destination_name: string | null;
  carrier_id: number | null;
  carrier_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  external_ref_no: string | null;
  source_system: string;
  scheduled_date: string;
  shipped_at: string | null;
  note: string | null;
  user_id: string;
  created_at: string;
}

export interface ShipmentLine {
  id: number;
  shipment_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  lot_id: number | null;
  lot_number: string | null;
  expiry_date: string | null;
  location_id: number | null;
  location_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  allocated_at: string | null;
  shipped_qty: number;
  returned_qty: number;
  status: string;
  note: string | null;
  user_id: string;
  created_at: string;
}

/** Shipment with its lines embedded (for page-level queries). */
export type ShipmentWithLines = Shipment & { shipment_lines: ShipmentLine[] };

/** Flat view merging shipment header + one line — mirrors the old OutgoingStock shape. */
export type OutgoingStock = ShipmentLine & {
  // header fields
  shipment_no: string;
  shipment_type: string;
  shipment_status: string;
  destination_id: number | null;
  destination_name: string | null;
  carrier_id: number | null;
  carrier_name: string | null;
  scheduled_date: string;
  shipped_at: string | null;
};

export interface Lot {
  id: number;
  lot_number: string;
  product_id: number;
  product_name: string;
  quantity: number;
  received_at: string;
  expiry_date: string | null;
  receipt_line_id: number | null;
  location_id: number | null;
  location_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  status_id: number | null;
  status_name: string | null;
  status_color: string | null;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
}

export interface DeliveryDestination {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
}

export interface Carrier {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  note: string | null;
}

export interface InventoryStatus {
  id: number;
  name: string;
  color: string;
  note: string | null;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  note: string | null;
  role: string;
  worker_code: string | null;
  warehouse_id: number | null;
  is_active: boolean;
  last_login_at: string | null;
  login_id: string | null;
  auth_user_id: string | null;
}
