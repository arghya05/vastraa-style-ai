import { Crown, Minus, Plus } from "lucide-react";
import { ProductCard } from "./ProductCard";
import {
  formatPrice,
  type PresentComparisonPayload,
  type PresentProductsPayload,
  type UiPart,
} from "@/lib/vastraa/types";

type AddFn = (productId: string) => Promise<{ ok: boolean; error?: string }>;

export function UiBlock({ part, onAdd }: { part: UiPart; onAdd: AddFn }) {
  if (part.component === "products") {
    return <ProductsBlock payload={part.payload as PresentProductsPayload} onAdd={onAdd} />;
  }
  if (part.component === "comparison") {
    return <ComparisonBlock payload={part.payload as PresentComparisonPayload} onAdd={onAdd} />;
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {part.component}
      </p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
        {JSON.stringify(part.payload, null, 2)}
      </pre>
    </div>
  );
}

function ProductsBlock({ payload, onAdd }: { payload: PresentProductsPayload; onAdd: AddFn }) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) return null;
  const layout = payload.layout ?? "carousel";

  return (
    <section className="space-y-2">
      {payload.title && (
        <h3 className="text-sm font-semibold text-foreground">{payload.title}</h3>
      )}
      {layout === "grid" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {items.map((item, i) => (
            <ProductCard
              key={`${item.product?.product_id}-${i}`}
              product={item.product}
              reason={item.reason}
              onAdd={onAdd}
            />
          ))}
        </div>
      ) : layout === "list" ? (
        <div className="space-y-3">
          {items.map((item, i) => (
            <ProductCard
              key={`${item.product?.product_id}-${i}`}
              product={item.product}
              reason={item.reason}
              onAdd={onAdd}
              className="sm:max-w-md"
            />
          ))}
        </div>
      ) : (
        <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {items.map((item, i) => (
            <ProductCard
              key={`${item.product?.product_id}-${i}`}
              product={item.product}
              reason={item.reason}
              onAdd={onAdd}
              className="w-44 shrink-0 snap-start sm:w-48"
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ComparisonBlock({ payload, onAdd }: { payload: PresentComparisonPayload; onAdd: AddFn }) {
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  if (entries.length === 0) return null;

  return (
    <section className="space-y-2">
      {payload.title && <h3 className="text-sm font-semibold text-foreground">{payload.title}</h3>}
      {payload.dimensions?.length ? (
        <p className="text-xs text-muted-foreground">Compared on: {payload.dimensions.join(", ")}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((entry, i) => {
          const recommended = entry.product_id === payload.recommended_product_id;
          return (
            <div
              key={`${entry.product_id}-${i}`}
              className={`flex flex-col gap-3 rounded-2xl border p-3 ${
                recommended
                  ? "border-jewel bg-jewel/8 ring-2 ring-jewel/40"
                  : "border-border bg-card"
              }`}
            >
              {recommended && (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-jewel px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-jewel-foreground">
                  <Crown className="size-3" /> Recommended
                </span>
              )}
              {entry.product && (
                <ProductCard product={entry.product} onAdd={onAdd} className="border-0 shadow-none" />
              )}
              {entry.best_for && (
                <p className="text-xs font-medium text-foreground">Best for: {entry.best_for}</p>
              )}
              {entry.pros?.length ? (
                <ul className="space-y-1">
                  {entry.pros.map((pro, k) => (
                    <li key={k} className="flex gap-1.5 text-xs text-foreground">
                      <Plus className="mt-0.5 size-3 shrink-0 text-jewel" /> {pro}
                    </li>
                  ))}
                </ul>
              ) : null}
              {entry.cons?.length ? (
                <ul className="space-y-1">
                  {entry.cons.map((con, k) => (
                    <li key={k} className="flex gap-1.5 text-xs text-muted-foreground">
                      <Minus className="mt-0.5 size-3 shrink-0 text-destructive" /> {con}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      {payload.price_delta && (
        <p className="text-xs text-muted-foreground">
          Price gap: {formatPrice(payload.price_delta.amount)} between{" "}
          {payload.price_delta.low_product_id} ({formatPrice(payload.price_delta.low_price)}) and{" "}
          {payload.price_delta.high_product_id} ({formatPrice(payload.price_delta.high_price)}).
        </p>
      )}
    </section>
  );
}
