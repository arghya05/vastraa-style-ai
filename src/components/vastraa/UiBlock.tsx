import { Check, Crown, Loader2, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { ProductCard } from "./ProductCard";
import {
  formatPrice,
  type PresentComparisonPayload,
  type PresentPlanPayload,
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
  if (part.component === "plan") {
    return <PlanBlock payload={part.payload as PresentPlanPayload} onAdd={onAdd} />;
  }
  if (part.component === "suggestions") {
    return null;
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

  return (
    <section className="space-y-2">
      {payload.title && (
        <h3 className="text-sm font-semibold text-foreground">{payload.title}</h3>
      )}
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

function PlanBlock({ payload, onAdd }: { payload: PresentPlanPayload; onAdd: AddFn }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [note, setNote] = useState<string | null>(null);

  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  if (steps.length === 0) return null;

  const allProducts = steps.flatMap((s) => s.products ?? []);
  // A family (unresolved size/color) can't be added directly — same rule as a single card.
  const addable = allProducts.filter((p) => !p.options || Object.keys(p.options).length === 0);
  const total = allProducts.reduce((sum, p) => sum + (p.price ?? 0), 0);
  const currency = allProducts.find((p) => p.currency)?.currency;

  const addWholeLook = async () => {
    setState("busy");
    setNote(null);
    let failed = 0;
    for (const product of addable) {
      const res = await onAdd(product.product_id);
      if (!res.ok) failed += 1;
    }
    setState("done");
    const skipped = allProducts.length - addable.length;
    if (failed > 0 || skipped > 0) {
      const parts = [];
      if (failed > 0) parts.push(`${failed} couldn't be added`);
      if (skipped > 0) parts.push(`${skipped} still need a size/color picked`);
      setNote(parts.join(", ") + ".");
    }
    setTimeout(() => setState("idle"), 2500);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h3 className="font-display text-base font-semibold text-foreground">{payload.title}</h3>
        {payload.intro && <p className="mt-1 text-xs text-muted-foreground">{payload.intro}</p>}
      </div>

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="space-y-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">{step.label}</p>
              {step.detail && <p className="text-xs text-muted-foreground">{step.detail}</p>}
            </div>
            {step.products && step.products.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {step.products.map((product, j) => (
                  <ProductCard key={`${product.product_id}-${j}`} product={product} onAdd={onAdd} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {addable.length > 1 && (
        <div className="flex flex-col gap-2 rounded-xl bg-secondary px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold text-foreground">
            Total look: {formatPrice(total, currency)}
          </span>
          <button
            onClick={() => void addWholeLook()}
            disabled={state === "busy"}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state === "busy" && <Loader2 className="size-3.5 animate-spin" />}
            {state === "done" && <Check className="size-3.5" />}
            {state === "idle" && <ShoppingBag className="size-3.5" />}
            {state === "busy" ? "Adding…" : state === "done" ? "Added" : "Add the whole look"}
          </button>
        </div>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}
