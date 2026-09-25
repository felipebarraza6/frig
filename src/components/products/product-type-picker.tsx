"use client";

import { useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PRODUCT_TYPE_DESCRIPTIONS } from "@/components/products/product-type-help";

export interface ProductTypeOption {
  value: string;
  label: string;
}

const TYPE_TINT: Record<string, { chip: string; icon: string; ring: string; soft: string }> = {
  DIRECT_SALE: {
    chip: "bg-primary/15 text-primary",
    icon: "bg-primary/20 text-primary",
    ring: "ring-primary/35",
    soft: "from-primary/20 via-primary/5 to-transparent",
  },
  RECIPE_BASED: {
    chip: "bg-warning/15 text-warning",
    icon: "bg-warning/20 text-warning",
    ring: "ring-warning/35",
    soft: "from-warning/20 via-warning/5 to-transparent",
  },
  RAW_MATERIAL: {
    chip: "bg-success/15 text-success",
    icon: "bg-success/20 text-success",
    ring: "ring-success/35",
    soft: "from-success/20 via-success/5 to-transparent",
  },
};

interface ProductTypePickerProps {
  value: string;
  options: ProductTypeOption[];
  onChange: (value: string) => void;
  id?: string;
}

/** Selector de tipo como pills/glass con color; flechas ←/→ con foco. */
export function ProductTypePicker({ value, options, onChange, id }: ProductTypePickerProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const values = options.map((o) => o.value);
  const selectedMeta = value ? PRODUCT_TYPE_DESCRIPTIONS[value] : null;
  const selectedTint = TYPE_TINT[value] ?? TYPE_TINT.DIRECT_SALE;

  function move(delta: number) {
    if (values.length === 0) return;
    const idx = Math.max(0, values.indexOf(value));
    const next = values[(idx + delta + values.length) % values.length];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={groupRef}
        id={id}
        role="radiogroup"
        aria-label="Tipo de producto"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        {options.map((opt) => {
          const meta = PRODUCT_TYPE_DESCRIPTIONS[opt.value];
          const Icon = meta?.icon;
          const selected = opt.value === value;
          const tint = TYPE_TINT[opt.value] ?? TYPE_TINT.DIRECT_SALE;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onChange(opt.value);
                }
              }}
              className={cn(
                "relative overflow-hidden rounded-2xl px-3 py-2.5 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                selected
                  ? cn("ring-1 shadow-sm", tint.ring, "bg-gradient-to-br", tint.soft)
                  : "bg-muted/25 hover:bg-muted/45 ring-1 ring-transparent hover:ring-border/60",
              )}
            >
              {selected && (
                <m.span
                  layoutId="product-type-glow"
                  className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_var(--glass-highlight)]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative flex items-start gap-2.5">
                {Icon ? (
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
                      selected ? tint.icon : "bg-background/50 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                ) : null}
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-semibold leading-tight transition-colors duration-200",
                      selected && opt.value === "DIRECT_SALE" && "text-primary",
                      selected && opt.value === "RECIPE_BASED" && "text-warning",
                      selected && opt.value === "RAW_MATERIAL" && "text-success",
                    )}
                  >
                    {meta?.title ?? opt.label}
                  </span>
                  {meta?.description ? (
                    <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {meta.description}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {selectedMeta?.examples ? (
          <m.p
            key={value}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "rounded-xl px-2.5 py-1.5 text-[11px] leading-snug",
              "bg-gradient-to-r shadow-[inset_0_1px_0_var(--glass-highlight)]",
              selectedTint.soft,
              selectedTint.chip,
            )}
          >
            {selectedMeta.examples}
          </m.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
