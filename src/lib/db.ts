export interface Product {
  id: number;
  name: string;
  lead_time_days: number;
  safety_stock_days: number;
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
  items: string; // JSON
}

export interface IncomingStock {
  id: number;
  order_history_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  expected_date: string;
  received_at: string | null;
}
