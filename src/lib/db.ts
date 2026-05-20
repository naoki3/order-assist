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
  updated_at: string;
}

export interface OrderHistoryItem {
  id: number;
  created_at: string;
  items: unknown; // JSON string or parsed array (depends on DB column type)
}

export interface OutgoingStock {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  scheduled_date: string;
  note: string | null;
  shipped_at: string | null;
  lot_id: number | null;
  lot_number: string | null;
  expiry_date: string | null;
}

export interface IncomingStock {
  id: number;
  order_history_id: number | null;
  product_id: number;
  product_name: string;
  quantity: number;
  expected_date: string;
  received_at: string | null;
  expiry_date: string | null;
  lot_number: string | null;
}

export interface Lot {
  id: number;
  lot_number: string;
  product_id: number;
  product_name: string;
  quantity: number;
  received_at: string;
  expiry_date: string | null;
  incoming_stock_id: number | null;
}

export interface Lot {
  id: number;
  lot_number: string;
  product_id: number;
  product_name: string;
  quantity: number;
  received_at: string;
  expiry_date: string | null;
  incoming_stock_id: number | null;
}
