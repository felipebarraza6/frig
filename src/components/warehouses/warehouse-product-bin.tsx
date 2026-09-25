"use client";

import { Star } from "lucide-react";
import { cn, formatCLP, stockStatusLabel } from "@/lib/utils";
import { statusBadge } from "@/lib/status-styles";
import { fillBarClass, formatQty, numValue, stockFillRatio } from "@/lib/warehouses-ui";
import type { WarehouseProduct } from "@/lib/api/warehouses";

export function WarehouseProductBin({
  wp,
  onOpen,
}: {
  wp: WarehouseProduct;
  onOpen: () => void;
}) {
  const ratio = stockFillRatio(wp);
  const status = wp.stock_status ?? "";
  const saleLine =
    "total_sale_value" in wp && wp.total_sale_value != null
      ? numValue(wp.total_sale_value as string | number)
      : null;
  const salePrice =
    "product_sale_price" in wp && (wp as { product_sale_price?: number }).product_sale_price != null
      ? numValue((wp as { product_sale_price?: number }).product_sale_price)
      : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass flex flex-col gap-3 rounded-2xl p-3.5 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium leading-tight">{wp.product_name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {wp.product_measurement_unit}
            {wp.product_code ? ` · ${wp.product_code}` : ""}
            {wp.product_category ? ` · ${wp.product_category}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            statusBadge(status),
          )}
        >
          {stockStatusLabel(status)}
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xl font-semibold tabular-nums tracking-tight">
            {formatQty(wp.current_quantity)}
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              {wp.product_measurement_unit}
            </span>
          </p>
          {wp.is_preferred_location ? (
            <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-label="Ubicación preferida" />
          ) : null}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-[width]", fillBarClass(status))}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
          Mín {wp.minimum_quantity ?? "—"} · Máx {wp.maximum_quantity ?? "—"} · Reorden{" "}
          {wp.reorder_point ?? "—"}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="tabular-nums text-success">{formatCLP(numValue(wp.total_value))}</span>
        {saleLine != null ? (
          <span className="tabular-nums text-primary">{formatCLP(saleLine)}</span>
        ) : salePrice != null ? (
          <span className="tabular-nums text-primary">
            {formatCLP(salePrice * numValue(wp.current_quantity))}
          </span>
        ) : null}
      </div>
    </button>
  );
}
