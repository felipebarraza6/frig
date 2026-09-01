"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Utensils, Package } from "lucide-react";
import type { PosProduct } from "@/lib/api/types";
import { useBranchProductTypes } from "@/lib/hooks/useBranchProductTypes";
import { formatCLP, cn } from "@/lib/utils";

interface ProductCardProps {
  product: PosProduct;
  onClick: (product: PosProduct) => void;
  onKeyDown?: (e: React.KeyboardEvent, product: PosProduct) => void;
}

function stockStatus(product: PosProduct): {
  text: string;
  shortText: string;
  variant: "ok" | "low" | "empty";
} {
  const qty = product.quantity ?? 0;
  const min = product.minimum_stock ?? 0;
  const unit = product.measurement_unit ? ` ${product.measurement_unit}` : "";
  if (qty === 0) return { text: `Sin stock${unit}`, shortText: "Sin stock", variant: "empty" };
  if (min > 0 && qty <= min) return { text: `${qty}${unit} rest.`, shortText: `${qty}${unit}`, variant: "low" };
  return { text: `${qty}${unit} disp.`, shortText: `${qty}${unit}`, variant: "ok" };
}

function ProductTypeBadge({ product }: { product: PosProduct }) {
  const { labelFor: productTypeLabel } = useBranchProductTypes();
  const isRecipe = product.product_type === "RECIPE_BASED";
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      {isRecipe ? <Utensils className="h-2.5 w-2.5" /> : <Package className="h-2.5 w-2.5" />}
      {productTypeLabel(product.product_type)}
    </span>
  );
}

function StockBadge({ product }: { product: PosProduct }) {
  const status = stockStatus(product);
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-0.5 rounded-md px-1.5 text-[10px] font-medium",
        status.variant === "ok" && "bg-emerald-500/10 text-emerald-700",
        status.variant === "low" && "bg-amber-500/10 text-amber-700",
        status.variant === "empty" && "bg-red-500/10 text-red-700",
      )}
    >
      {status.variant !== "ok" && <AlertTriangle className="h-2.5 w-2.5" />}
      {status.text}
    </span>
  );
}

function ProductImage({ product }: { product: PosProduct }) {
  if (!product.image) return null;
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  );
}

function ProductCardRaw({ product, onClick, onKeyDown }: ProductCardProps) {
  const disabled = (product.quantity ?? 0) === 0;
  const hasImage = Boolean(product.image);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && onClick(product)}
      onKeyDown={(e) => onKeyDown?.(e, product)}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      className={cn(
        "group flex cursor-pointer overflow-hidden rounded-2xl border bg-card p-2 shadow-sm transition-all",
        hasImage ? "flex-col" : "flex-row items-center gap-3",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:hover:translate-y-0 aria-disabled:hover:border-border/60 aria-disabled:hover:shadow-sm",
        disabled ? "border-border/50" : "border-border/70",
      )}
    >
      <ProductImage product={product} />

      <div className={cn("flex flex-1 flex-col justify-between gap-2", hasImage && "mt-2")}>
        <div className="flex flex-col gap-1">
          <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground sm:text-sm">
            {product.name}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <ProductTypeBadge product={product} />
            <StockBadge product={product} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold tabular-nums text-foreground sm:text-base">
            {formatCLP(product.price)}
          </p>
          {product.measurement_unit && (
            <span className="text-[10px] font-medium text-muted-foreground">
              / {product.measurement_unit}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const ProductCard = memo(ProductCardRaw);
