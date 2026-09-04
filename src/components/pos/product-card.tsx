"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, List } from "lucide-react";
import type { PosProduct, YggdraSchemas } from "@/lib/api/types";
import { formatCLP, cn } from "@/lib/utils";
import { useIsModuleEnabledFromConfig } from "@/lib/store/session";

interface ProductCardProps {
  product: PosProduct;
  recipe?: YggdraSchemas["Recipe"] | null;
  ingredients?: YggdraSchemas["RecipeIngredient"][];
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

function ProductTypeBadge({
  recipe,
  ingredients,
}: {
  recipe?: YggdraSchemas["Recipe"] | null;
  ingredients?: YggdraSchemas["RecipeIngredient"][];
}) {
  const names = (ingredients ?? [])
    .map((i) => i.ingredient_name)
    .filter(Boolean)
    .slice(0, 3);
  return (
    <span
      className="inline-flex max-w-full items-start gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
      title={recipe?.name || undefined}
    >
      <List className="mt-0.5 h-2.5 w-2.5 shrink-0" />
      <span className="min-w-0 break-words leading-tight">
        {names.length > 0 ? names.join(", ") : recipe?.name || "Sin receta"}
      </span>
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

function ProductCardRaw({ product, recipe, ingredients, onClick, onKeyDown }: ProductCardProps) {
  // Sin módulo Inventario no hay control de stock: se oculta el badge y
  // el producto nunca queda bloqueado por cantidad.
  const inventoryEnabled = useIsModuleEnabledFromConfig("inventory");
  const disabled = inventoryEnabled && (product.quantity ?? 0) === 0;
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
        "group flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card p-3 transition-all",
        "shadow-none hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/[0.02] hover:shadow-sm",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:hover:translate-y-0 aria-disabled:hover:border-border/60 aria-disabled:hover:shadow-none aria-disabled:hover:bg-card",
        disabled ? "border-border/40" : "border-border/50",
      )}
    >
      <ProductImage product={product} />

      <div
        className={cn(
          "flex flex-1 flex-col justify-center items-center gap-2.5 text-center",
          hasImage && "mt-3",
        )}
      >
        <div className="flex flex-col items-center gap-1.5">
          <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground sm:text-sm">
            {product.name}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {product.product_type === "RECIPE_BASED" && (
              <ProductTypeBadge recipe={recipe} ingredients={ingredients} />
            )}
            {inventoryEnabled && <StockBadge product={product} />}
          </div>
        </div>

        <p className="text-sm font-bold tabular-nums text-foreground sm:text-base">
          {formatCLP(product.price)}
        </p>
      </div>
    </motion.div>
  );
}

export const ProductCard = memo(ProductCardRaw);
