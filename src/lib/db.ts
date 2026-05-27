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
  updated_at: string;
}

export interface OrderHistoryItem {
  id: number;
  created_at: string;
  items: unknown;
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
  destination_id: number | null;
  destination_name: string | null;
  carrier_id: number | null;
  carrier_name: string | null;
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
  supplier_id: number | null;
  supplier_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  location_id: number | null;
  location_name: string | null;
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
  location_id: number | null;
  location_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
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
