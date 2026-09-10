"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Package, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { createInventoryMovement, fetchProductInventory } from "@/lib/api/inventory";
import { fetchProducts } from "@/lib/api/products";
import type { YggdraSchemas } from "@/lib/api/types";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

type InventoryMovementType = YggdraSchemas["InventoryHistoryRequest"]["movement_type"];

// Tipos manuales operativos para el cajero (mermas, daños, entradas…).
// ADJUSTMENT y CANCELLATION quedan excluidos: el backend los restringe a
// roles administrativos (OWNER/ADMIN_LOCAL/MANAGER).
const MOVEMENT_OPTIONS: { value: InventoryMovementType; label: string }[] = [
  { value: "LOSS", label: "Merma / pérdida" },
  { value: "DAMAGE", label: "Daño" },
  { value: "EXPIRY", label: "Vencimiento" },
  { value: "OUT", label: "Salida (uso interno)" },
  { value: "IN", label: "Entrada" },
  { value: "RETURN", label: "Devolución" },
];

// Productos que no llevan inventario propio (el stock de un RECIPE_BASED lo
// derivan sus ingredientes; los demás no tienen sentido en una bodega).
const NO_INVENTORY_TYPES = new Set(["RECIPE_BASED", "SERVICE", "CERTIFICATE", "IOT"]);

function formatStock(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function PosInventoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [movementType, setMovementType] = useState<InventoryMovementType>("LOSS");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  // Stock actual por producto (branch-scoped en backend).
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["pos-inventory"],
    queryFn: () => fetchProductInventory({ page_size: 500 }),
    enabled: open,
  });

  // Catálogo completo: aporta product_type (para filtrar los que no llevan
  // inventario propio) y measurement_unit (para mostrar la unidad del movimiento).
  const { data: productsPage } = useQuery({
    queryKey: ["products", "catalog"],
    queryFn: () => fetchProducts({ page_size: 500 }),
    enabled: open,
  });
  const productsById = useMemo(
    () => new Map((productsPage?.results ?? []).map((p) => [p.id, p])),
    [productsPage],
  );

  const listable = useMemo(
    () =>
      inventory.filter((p) => {
        const type = productsById.get(p.id)?.product_type;
        return !type || !NO_INVENTORY_TYPES.has(type);
      }),
    [inventory, productsById],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listable;
    return listable.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code ?? "").toLowerCase().includes(q) ||
        p.category_name?.toLowerCase().includes(q),
    );
  }, [listable, search]);

  const selected = inventory.find((p) => String(p.id) === productId) ?? null;
  const selectedUnit = selected ? (productsById.get(selected.id)?.measurement_unit ?? null) : null;
  const isOutType = movementType === "LOSS" || movementType === "DAMAGE" || movementType === "EXPIRY" || movementType === "OUT";

  const qty = Number(quantity);
  const qtyValid = quantity !== "" && Number.isFinite(qty) && qty > 0;
  const previewStock =
    selected && qtyValid
      ? Math.max(0, selected.stock_available + (isOutType ? -qty : qty))
      : null;

  const createMutation = useMutation({
    mutationFn: createInventoryMovement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setQuantity("");
      setNotes("");
      toast.success("Movimiento de inventario registrado");
    },
  });

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !qtyValid) return;
    createMutation.mutate({
      product: Number(productId),
      warehouse: null,
      movement_type: movementType,
      source_type: "MANUAL",
      quantity: qty,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Inventario"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-base font-semibold">Inventario</h3>
            <p className="text-xs text-muted-foreground">
              Toca un producto de la lista para registrar un movimiento
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código o categoría…"
              className="pl-9"
              aria-label="Buscar producto"
            />
          </div>

          {/* Stock actual: la lista ES el selector de producto */}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/60">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <Package className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {listable.length === 0
                    ? "No hay productos con inventario en esta sucursal."
                    : "Sin resultados para la búsqueda."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {filtered.map((p) => {
                  const isSelected = String(p.id) === productId;
                  // El catálogo (listado de productos) trae tracks_inventory;
                  // el type generado aún no lo declara en ProductList.
                  const noStockLimit =
                    (productsById.get(p.id) as { tracks_inventory?: boolean } | undefined)
                      ?.tracks_inventory === false;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setProductId(isSelected ? "" : String(p.id))}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                          isSelected ? "bg-primary/10" : "hover:bg-muted/60",
                        )}
                      >
                        <div className="min-w-0">
                          <p className={cn("truncate", isSelected && "font-semibold text-primary")}>{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[p.code, p.category_name].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                            !noStockLimit &&
                              p.minimum_stock != null &&
                              p.stock_available <= p.minimum_stock
                              ? "bg-amber-500/10 text-amber-700"
                              : "bg-muted text-foreground",
                          )}
                          title="Stock actual"
                        >
                          {noStockLimit
                            ? "Sin límite"
                            : formatStock(p.stock_available) +
                              (productsById.get(p.id)?.measurement_unit
                                ? ` ${productsById.get(p.id)!.measurement_unit}`
                                : "")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Movimiento manual sobre el producto seleccionado */}
          <form onSubmit={handleSubmit} className="shrink-0 rounded-xl border border-border/60 bg-muted/30 p-3">
            {selected ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Registrar movimiento
                  </p>
                  <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary">
                    <span className="truncate">{selected.name}</span>
                    {selectedUnit && <span className="shrink-0 text-primary/70">({selectedUnit})</span>}
                    <button
                      type="button"
                      onClick={() => setProductId("")}
                      aria-label="Quitar selección"
                      className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as InventoryMovementType)}
                    aria-label="Tipo de movimiento"
                  >
                    {MOVEMENT_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder={selectedUnit ? `Cantidad (${selectedUnit})` : "Cantidad"}
                      aria-label="Cantidad"
                      required
                      className={selectedUnit ? "pr-14" : undefined}
                    />
                    {selectedUnit && (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                        {selectedUnit}
                      </span>
                    )}
                  </div>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Motivo (opcional)"
                    aria-label="Motivo"
                    className="sm:col-span-2"
                  />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {isOutType ? (
                    <ArrowDownRight className="h-3.5 w-3.5 text-danger" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  Stock actual de <span className="font-medium text-foreground">{selected.name}</span>:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatStock(selected.stock_available)}
                    {selectedUnit ? ` ${selectedUnit}` : ""}
                  </span>
                  {previewStock !== null && (
                    <>
                      {" → quedará en "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatStock(previewStock)}
                        {selectedUnit ? ` ${selectedUnit}` : ""}
                      </span>
                    </>
                  )}
                </p>
                {createMutation.error instanceof Error && (
                  <p className="mt-2 text-xs text-rose-600">{createMutation.error.message}</p>
                )}
                <Button
                  type="submit"
                  size="sm"
                  variant={isOutType ? "default" : "outline"}
                  className="mt-2 w-full"
                  disabled={!qtyValid || createMutation.isPending}
                  isLoading={createMutation.isPending}
                >
                  Registrar movimiento
                </Button>
              </>
            ) : (
              <p className="py-1 text-center text-xs text-muted-foreground">
                Selecciona un producto de la lista para registrar un movimiento.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
