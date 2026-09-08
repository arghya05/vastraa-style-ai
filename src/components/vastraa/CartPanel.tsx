import { ShoppingBag } from "lucide-react";
import { resolveProductImage } from "@/lib/vastraa/catalogueImages";
import { formatPrice, type Cart } from "@/lib/vastraa/types";

export function CartPanel({ cart }: { cart: Cart }) {
  const currency = cart.currency ?? "INR";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Your bag</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {cart.item_count ?? 0} item{(cart.item_count ?? 0) === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-10 text-center">
            <ShoppingBag className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nothing here yet. Ask the stylist for something and add it from the chat.
            </p>
          </div>
        ) : (
          cart.items.map((item, i) => (
            <div key={`${item.product_id}-${i}`} className="flex gap-3">
              <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                <img
                  src={resolveProductImage(item)}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {Object.entries(item.option_values ?? {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Qty {item.quantity} · {formatPrice(item.price, currency)}
                </p>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {formatPrice(item.line_total ?? item.price * item.quantity, currency)}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Subtotal</span>
          <span className="font-display text-xl font-semibold text-foreground">
            {formatPrice(cart.subtotal ?? 0, currency)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Taxes and delivery calculated later.</p>
      </div>
    </div>
  );
}
