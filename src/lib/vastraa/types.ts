export type Product = {
  product_id: string;
  title: string;
  brand?: string;
  price: number;
  currency?: string;
  rating?: number;
  review_count?: number;
  image_url?: string;
  category?: string;
  labels?: string[];
  attributes?: Record<string, string>;
  in_stock?: boolean;
  short_description?: string;
  options?: Record<string, unknown>;
  option_values?: Record<string, string>;
  variant_of?: string;
};

export type PresentProductsPayload = {
  title?: string;
  layout?: "carousel" | "grid" | "list" | string;
  items: Array<{ product: Product; reason?: string }>;
};

export type ComparisonEntry = {
  product_id: string;
  pros?: string[];
  cons?: string[];
  best_for?: string;
  product: Product;
};

export type PresentComparisonPayload = {
  title?: string;
  dimensions?: string[];
  recommended_product_id?: string;
  entries: ComparisonEntry[];
  price_delta?: {
    amount: number;
    low_product_id: string;
    low_price: number;
    high_product_id: string;
    high_price: number;
  };
};

export type PlanStep = {
  label: string;
  detail?: string;
  products?: Product[];
};

export type PresentPlanPayload = {
  title: string;
  intro?: string;
  steps: PlanStep[];
};

export type CartItem = {
  product_id: string;
  title: string;
  price: number;
  quantity: number;
  image_url?: string;
  option_values?: Record<string, string>;
  variant_of?: string;
  line_total: number;
};

export type Cart = {
  items: CartItem[];
  item_count: number;
  subtotal: number;
  currency?: string;
};

export type SessionInfo = {
  session_id: string;
  user_id?: string;
  name?: string;
  tier?: string;
};

export type UiPart = { type: "ui"; component: string; payload: unknown };
export type TextPart = { type: "text"; text: string };
export type MessagePart = TextPart | UiPart;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  parts: MessagePart[];
};

export function formatPrice(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(
      amount,
    );
  } catch {
    return `₹${Math.round(amount)}`;
  }
}
