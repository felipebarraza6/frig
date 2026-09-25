"use client";

import { createElement, useMemo, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LazyMotion, domAnimation, m } from "framer-motion";
import {
  ArrowRight,
  ArrowRightLeft,
  Box,
  Coins,
  Eye,
  MapPin,
  Package,
  Pencil,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { cn, formatCLP, stockStatusLabel } from "@/lib/utils";
import { statusBadge } from "@/lib/status-styles";
import {
  formatQty,
  groupWarehouseProductsByLocation,
  numValue,
  warehouseOccupancy,
  warehouseRoomTone,
  warehouseTypeAccent,
  warehouseTypeLabel,
  WarehouseTypeIcon,
} from "@/lib/warehouses-ui";
import { fetchWarehouseProducts, type Warehouse } from "@/lib/api/warehouses";

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  tone?: "muted" | "success" | "primary" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "primary"
        ? "text-primary"
        : tone === "warning"
          ? "text-warning"
          : tone === "danger"
            ? "text-danger"
            : "text-foreground";
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/60 p-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {createElement(Icon, { className: "h-4 w-4" })}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn("truncate text-sm font-semibold tabular-nums", toneClass)}>{value}</p>
      </div>
    </div>
  );
}

export function WarehousePreviewPanel({
  warehouse,
  open,
  onClose,
  onEnter,
  onEdit,
}: {
  warehouse: Warehouse | null;
  open: boolean;
  onClose: () => void;
  onEnter: () => void;
  onEdit?: () => void;
}) {
  const warehouseId = warehouse?.id ?? 0;

  const productsQuery = useQuery({
    queryKey: ["warehouses", warehouseId, "products-preview"],
    queryFn: () => fetchWarehouseProducts(warehouseId, { page_size: 20 }),
    enabled: open && Boolean(warehouseId),
    staleTime: 10_000,
  });

  const products = useMemo(() => productsQuery.data?.results ?? [], [productsQuery.data]);
  const zones = useMemo(() => groupWarehouseProductsByLocation(products), [products]);
  const topProducts = useMemo(
    () =>
      [...products]
        .sort((a, b) => numValue(b.current_quantity) - numValue(a.current_quantity))
        .slice(0, 10),
    [products],
  );

  const occupancy = warehouse ? warehouseOccupancy(warehouse.capacity, warehouse.total_quantity) : null;
  const lowStock = warehouse ? numValue(warehouse.low_stock_products) : 0;
  const outOfStock = warehouse ? numValue(warehouse.out_of_stock_products) : 0;

  const accent = warehouse ? warehouseTypeAccent(warehouse.warehouse_type) : "bg-muted text-foreground";
  const tone = warehouse ? warehouseRoomTone(warehouse.warehouse_type) : warehouseRoomTone("GENERAL");

  return (
    <AnimatedOverlay
      open={open}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-stretch md:justify-end md:p-0"
    >
      <LazyMotion features={domAnimation}>
        <m.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-2xl md:h-full md:max-w-md md:rounded-none md:border-y-0 md:border-l md:border-r-0"
        >
          {/* Header */}
          <div className="relative z-10 flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                accent,
              )}
            >
              <WarehouseTypeIcon value={warehouse?.warehouse_type} className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-semibold tracking-tight">{warehouse?.name ?? "Recinto"}</h2>
                {warehouse?.is_default && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Principal
                  </span>
                )}
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                {warehouse?.warehouse_type ? warehouseTypeLabel(warehouse.warehouse_type) : "Bodega"}
                {warehouse?.location ? (
                  <>
                    <MapPin className="ml-1 h-3 w-3" />
                    {warehouse.location}
                  </>
                ) : null}
                {occupancy != null ? (
                  <span className="ml-1">· {Math.round(occupancy)}% ocupación</span>
                ) : null}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* Visual miniatura del recinto */}
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border p-4",
                "bg-gradient-to-b",
                tone.wall,
              )}
            >
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 h-8 border-t border-foreground/5",
                  tone.floor,
                )}
                style={{ clipPath: "polygon(8% 0, 92% 0, 100% 100%, 0 100%)" }}
              />
              <div className="relative z-10 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="text-sm font-semibold">
                    {outOfStock > 0 ? (
                      <span className="text-danger">{outOfStock} productos sin stock</span>
                    ) : lowStock > 0 ? (
                      <span className="text-warning">{lowStock} productos con stock bajo</span>
                    ) : products.length === 0 ? (
                      "Sin productos registrados"
                    ) : (
                      <span className="text-success">Stock en rango</span>
                    )}
                  </p>
                </div>
                {occupancy != null && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Capacidad usada</p>
                    <p className="text-2xl font-semibold tabular-nums text-foreground">{Math.round(occupancy)}%</p>
                  </div>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-2">
              <MiniStat icon={Package} label="Productos" value={warehouse ? formatQty(warehouse.total_products) : "—"} />
              <MiniStat icon={Box} label="Unidades" value={warehouse ? formatQty(warehouse.total_quantity) : "—"} tone="muted" />
              <MiniStat
                icon={Coins}
                label="Valor costo"
                value={warehouse ? formatCLP(numValue(warehouse.total_value)) : "—"}
                tone="success"
              />
              <MiniStat
                icon={TrendingUp}
                label="Valor venta"
                value={warehouse ? formatCLP(numValue(warehouse.total_sale_value)) : "—"}
                tone="primary"
              />
            </div>

            {/* Mini mapa de zonas */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Planta por zonas</h3>
              {productsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-xl" />
                  ))}
                </div>
              ) : zones.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                  Aún no hay productos asignados a zonas.
                </p>
              ) : (
                <div className="space-y-2">
                  {zones.map((zone) => {
                    const totalQty = zone.items.reduce((acc, item) => acc + numValue(item.current_quantity), 0);
                    const maxQty = Math.max(...zone.items.map((item) => numValue(item.current_quantity)), 1);
                    return (
                      <div
                        key={zone.location ?? "__none"}
                        className="rounded-xl border border-border bg-card/60 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{zone.location ?? "General"}</p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {zone.items.length} ítem{zone.items.length === 1 ? "" : "s"} · {formatQty(totalQty)} u
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {zone.items.map((item) => {
                            const ratio = Math.min(1, numValue(item.current_quantity) / maxQty);
                            return (
                              <div
                                key={item.id}
                                className="relative flex h-7 min-w-[1.5rem] items-end justify-center rounded border border-border bg-background/60"
                                title={`${item.product_name}: ${formatQty(item.current_quantity)}`}
                              >
                                <div
                                  className={cn(
                                    "absolute bottom-0 left-0 right-0 rounded-b transition-all",
                                    (item.stock_status ?? "").toUpperCase() === "OUT_OF_STOCK"
                                      ? "bg-danger/70"
                                      : (item.stock_status ?? "").toUpperCase() === "LOW_STOCK" ||
                                          (item.stock_status ?? "").toUpperCase() === "NEEDS_REORDER"
                                        ? "bg-warning/70"
                                        : tone.cargo,
                                  )}
                                  style={{ height: `${Math.max(12, ratio * 100)}%` }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Top productos */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Productos principales
              </h3>
              {productsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : topProducts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                  No hay productos para mostrar.
                </p>
              ) : (
                <ul className="space-y-2">
                  {topProducts.map((wp) => (
                    <li
                      key={wp.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/15 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{wp.product_name}</p>
                        {wp.product_code ? (
                          <p className="text-[11px] text-muted-foreground">{wp.product_code}</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatQty(wp.current_quantity)}</p>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-1.5 py-px text-[9px] leading-none font-semibold",
                            statusBadge(wp.stock_status),
                          )}
                        >
                          {stockStatusLabel(wp.stock_status)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Footer actions */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row">
            {onEdit && (
              <Button variant="outline" className="w-full sm:flex-1" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}
            <Button variant="outline" className="w-full sm:flex-1" onClick={onEnter}>
              <ArrowRightLeft className="h-4 w-4" />
              Transferir
            </Button>
            <Button className="w-full sm:flex-[2]" onClick={onEnter}>
              <Eye className="h-4 w-4" />
              Entrar al recinto
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </m.div>
      </LazyMotion>
    </AnimatedOverlay>
  );
}
