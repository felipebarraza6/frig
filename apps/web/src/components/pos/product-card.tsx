"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { PosProduct } from "@/lib/api/types";
import { useBranchProductTypes } from "@/lib/hooks/useBranchProductTypes";
import { formatCLP } from "@/lib/utils";

interface ProductCardProps {
  product: PosProduct;
  onClick: (product: PosProduct) => void;
  onKeyDown?: (e: React.KeyboardEvent, product: PosProduct) => void;
}

function stockStatus(product: PosProduct): { text: string; variant: "ok" | "low" | "empty" } {
  const qty = product.quantity ?? 0;
  const min = product.minimum_stock ?? 0;
  if (qty === 0) return { text: "Sin stock", variant: "empty" };
  if (min > 0 && qty <= min) return { text: `Quedan ${qty}`, variant: "low" };
  return { text: `${qty} disp.`, variant: "ok" };
}

function StockBadge({ product }: { product: PosProduct }) {
  const status = stockStatus(product);
  if (status.variant === "ok") {
    return (
      <span className="inline-flex h-5 items-center rounded bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-700">
        {status.text}
      </span>
    );
  }
  if (status.variant === "empty") {
    return (
      <span className="inline-flex h-5 items-center gap-0.5 rounded bg-red-500/10 px-1.5 text-[10px] font-medium text-red-700">
        <AlertTriangle className="h-3 w-3" />
        {status.text}
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 items-center gap-0.5 rounded bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-700">
      <AlertTriangle className="h-3 w-3" />
      {status.text}
    </span>
  );
}

function ProductCardRaw({ product, onClick, onKeyDown }: ProductCardProps) {
  const { labelFor: productTypeLabel } = useBranchProductTypes();
  const disabled = (product.quantity ?? 0) === 0;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && onClick(product)}
      onKeyDown={(e) => onKeyDown?.(e, product)}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      className="group flex h-[110px] cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-border/60 bg-muted/20 p-2.5 transition-all hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:border-border/60 aria-disabled:hover:bg-muted/20 aria-disabled:hover:shadow-none sm:h-[132px] sm:p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium leading-snug sm:text-[15px]">{product.name}</p>
      </div>

      <div className="mt-1.5 flex flex-col gap-1.5 sm:mt-2 sm:gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            {productTypeLabel(product.product_type)}
          </span>
          <StockBadge product={product} />
        </div>
        <p className="self-end text-base font-bold tabular-nums leading-none text-foreground sm:text-lg">
          {formatCLP(product.price)}
        </p>
      </div>
    </motion.div>
  );
}

export const ProductCard = memo(ProductCardRaw);
