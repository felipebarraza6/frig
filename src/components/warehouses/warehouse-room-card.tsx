"use client";

import { useMemo } from "react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { ArrowRight, Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { formatCLP, cn } from "@/lib/utils";
import {
  formatQty,
  numValue,
  warehouseAlertTone,
  warehouseOccupancy,
  warehouseRelativeFill,
  warehouseRoomTone,
  warehouseStatusSummary,
  warehouseTypeAccent,
  warehouseTypeLabel,
  warehouseTypeToneSolid,
  WarehouseTypeIcon,
} from "@/lib/warehouses-ui";
import type { Warehouse } from "@/lib/api/warehouses";

const CELLS = 15; // 5 columnas × 3 filas

function useFill(warehouse: Warehouse, peakQuantity: number) {
  const occupancy = warehouseOccupancy(warehouse.capacity, warehouse.total_quantity);
  const fill = occupancy != null ? occupancy / 100 : warehouseRelativeFill(warehouse.total_quantity, peakQuantity);
  const filledCells = Math.max(0, Math.min(CELLS, Math.round(fill * CELLS)));
  const empty = numValue(warehouse.total_products) <= 0 && numValue(warehouse.total_quantity) <= 0;
  const outOfStock = numValue(warehouse.out_of_stock_products);
  const lowStock = numValue(warehouse.low_stock_products);
  return { occupancy, filledCells, empty, outOfStock, lowStock };
}

export function WarehouseRoomCard({
  warehouse,
  peakQuantity,
  onEnter,
  onEdit,
  onDelete,
  onPreview,
}: {
  warehouse: Warehouse;
  peakQuantity: number;
  onEnter: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPreview?: () => void;
}) {
  const accent = warehouseTypeAccent(warehouse.warehouse_type);
  const tone = warehouseRoomTone(warehouse.warehouse_type);
  const status = warehouseStatusSummary(warehouse);
  const alertTone = warehouseAlertTone(warehouse);
  const typeTone = warehouseTypeToneSolid(warehouse.warehouse_type);

  const { occupancy, filledCells, empty, outOfStock, lowStock } = useFill(warehouse, peakQuantity);
  const hasAlerts = outOfStock > 0 || lowStock > 0;

  const cells = useMemo(() => {
    if (empty) return [];
    // Distribuimos alertas entre las últimas celdas llenas para que se noten.
    const alertCells = Math.min(filledCells, outOfStock + lowStock);
    const warningCells = Math.min(alertCells, lowStock);
    const dangerCells = alertCells - warningCells;
    return Array.from({ length: CELLS }).map((_, i) => {
      const on = i < filledCells;
      let state: "off" | "ok" | "warning" | "danger" = on ? "ok" : "off";
      if (on && i >= filledCells - alertCells) {
        if (dangerCells > 0 && i >= filledCells - dangerCells) state = "danger";
        else state = "warning";
      }
      return { on, state };
    });
  }, [empty, filledCells, outOfStock, lowStock]);

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        layout
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className={cn(
          "group relative flex h-[13rem] cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow",
          "hover:border-primary/40 hover:shadow-lg focus-within:border-primary/50 focus-within:shadow-md",
        )}
        onClick={onEnter}
        role="button"
        tabIndex={0}
        aria-label={`${warehouse.name}. ${warehouseTypeLabel(warehouse.warehouse_type)}. ${status}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEnter();
          }
        }}
      >
        {/* Fondo ambiental del recinto */}
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-b opacity-90", tone.wall)} />
        <div
          className="pointer-events-none absolute inset-x-3 top-10 bottom-14 opacity-[0.12]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0 12px, hsl(var(--border)) 12px 13px)",
          }}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-10 border-t border-foreground/5",
            tone.floor,
          )}
          style={{ clipPath: "polygon(6% 0, 94% 0, 100% 100%, 0 100%)" }}
        />

        {/* Header */}
        <div className="relative z-10 flex items-start gap-2 px-3 pt-2.5">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", accent)}>
            <WarehouseTypeIcon value={warehouse.warehouse_type} className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-sm font-semibold leading-tight text-foreground">{warehouse.name}</h2>
              {warehouse.is_default && (
                <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[9px] font-semibold text-primary-foreground">
                  Principal
                </span>
              )}
            </div>
            <p className="truncate text-[10px] text-muted-foreground">
              {warehouseTypeLabel(warehouse.warehouse_type)}
              {warehouse.location ? ` · ${warehouse.location}` : ""}
            </p>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <ActionsMenu
              ariaLabel={`Acciones de ${warehouse.name}`}
              size="icon"
              className="h-7 w-7"
              items={[
                { label: "Vista rápida", icon: Eye, onClick: () => onPreview?.() },
                { label: "Editar", icon: Pencil, onClick: onEdit },
                { label: "Eliminar", icon: Trash2, onClick: onDelete, danger: true },
              ]}
            />
          </div>
        </div>

        {/* Visualización del stock: ocupa el espacio entre header y footer para no pisar el texto */}
        <div className="pointer-events-none relative flex min-h-0 flex-1 items-end justify-center px-6">
          {empty ? (
            <m.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className={cn(
                "mb-1 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-foreground/15 bg-background/60",
                typeTone,
              )}
            >
              <WarehouseTypeIcon value={warehouse.warehouse_type} className="h-7 w-7 opacity-60" />
            </m.div>
          ) : (
            <div className="grid grid-cols-5 gap-1 pb-1">
              {cells.map((cell, i) => (
                <m.div
                  key={i}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{
                    delay: i * 0.02,
                    duration: 0.25,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={cn(
                    "h-5 w-5 rounded-sm border transition-colors",
                    cell.state === "off" && "border-dashed border-border/60 bg-background/40",
                    cell.state === "ok" && cn("border-foreground/10", tone.cargo),
                    cell.state === "warning" && "border-warning/30 bg-warning",
                    cell.state === "danger" && "border-danger/30 bg-danger",
                  )}
                  style={{ originY: 1 }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex shrink-0 items-end justify-between gap-2 px-3 pb-2.5">
          <div className="min-w-0">
            {empty ? (
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Listo para recibir stock</p>
                <p className="truncate text-[10px] text-muted-foreground">0 SKU · 0 unidades</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-sm font-semibold tabular-nums leading-tight text-foreground">
                  {formatQty(warehouse.total_products)}
                  <span className="ml-1 text-[10px] font-medium text-muted-foreground">SKU</span>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  {formatQty(warehouse.total_quantity)}
                  <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">u</span>
                </p>
                <p className="truncate text-[10px] tabular-nums text-muted-foreground">
                  {formatCLP(numValue(warehouse.total_value))}
                  <span className="mx-0.5">·</span>
                  <span className="text-primary">{formatCLP(numValue(warehouse.total_sale_value))}</span>
                  {hasAlerts ? (
                    <span className={cn("ml-1 inline-flex items-center gap-1 rounded-full px-1 py-px text-[9px] leading-none font-semibold", alertTone)}>
                      {outOfStock > 0 && `${outOfStock} sin`}
                      {outOfStock > 0 && lowStock > 0 && " · "}
                      {lowStock > 0 && `${lowStock} bajo`}
                    </span>
                  ) : occupancy != null ? (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success/10 px-1 py-px text-[9px] leading-none font-semibold text-success">
                      {Math.round(occupancy)}% ocupación
                    </span>
                  ) : null}
                </p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onPreview && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Vista rápida"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview();
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 px-2.5 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                onEnter();
              }}
            >
              Entrar
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </m.div>
    </LazyMotion>
  );
}
