import { Check, Loader2, ShoppingBag, Star } from "lucide-react";
import { useState } from "react";
import { resolveProductImage } from "@/lib/vastraa/catalogueImages";
import { formatPrice, type Product } from "@/lib/vastraa/types";

type Props = {
  product: Product;
  reason?: string | undefined;
  onAdd: (productId: string) => Promise<{ ok: boolean; error?: string }>;
  className?: string;
};

export function ProductCard({ product, reason, onAdd, className = "" }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const isFamily = !!product.options && Object.keys(product.options).length > 0;

  const handleAdd = async () => {
    setState("busy");
    setError(null);
    const res = await onAdd(product.product_id);
    if (res.ok) {
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } else {
      setState("idle");
      setError(res.error ?? "Could not add item.");
    }
  };

  const variant = Object.entries(product.option_values ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

  const imageSrc = resolveProductImage(product);
  const details = Object.entries(product.attributes ?? {})
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v}`);


  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-secondary">
        <img
          src={imageSrc}
          alt={`${product.title}${product.category ? ` — Vastraa ${product.category}` : ""}`}
          loading="lazy"
          width={832}
          height={1040}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
        />
        {product.labels?.[0] && (
          <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-foreground">
            {product.labels[0]}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          {product.brand && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
              {product.brand}
            </p>
          )}
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {product.title}
          </h4>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg font-semibold text-foreground">
            {formatPrice(product.price, product.currency)}
          </span>
          {typeof product.rating === "number" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="size-3 fill-gold text-gold" />
              {product.rating.toFixed(1)}
              {product.review_count ? ` (${product.review_count})` : ""}
            </span>
          )}
        </div>
        {product.short_description && (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {product.short_description}
          </p>
        )}
        {details.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {details.map((d) => (
              <li
                key={d}
                className="rounded-full bg-secondary px-2 py-0.5 text-[10px] capitalize text-secondary-foreground"
              >
                {d}
              </li>
            ))}
          </ul>
        )}
        {variant && <p className="text-xs text-muted-foreground">{variant}</p>}
        {reason && <p className="line-clamp-3 text-xs italic text-jewel">{reason}</p>}

        <div className="mt-auto pt-2">
          {isFamily ? (
            <p className="text-xs text-muted-foreground">Ask for a size to add this one.</p>
          ) : (
            <button
              onClick={handleAdd}
              disabled={state !== "idle" || product.in_stock === false}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {state === "busy" && <Loader2 className="size-3.5 animate-spin" />}
              {state === "done" && <Check className="size-3.5" />}
              {state === "idle" && <ShoppingBag className="size-3.5" />}
              {product.in_stock === false
                ? "Out of stock"
                : state === "done"
                  ? "Added"
                  : "Add to cart"}
            </button>
          )}
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
