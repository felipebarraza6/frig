"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, X } from "lucide-react";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCLP, stockStatusLabel } from "@/lib/utils";
import { statusBadge } from "@/lib/status-styles";
import { isNonNegativeNumber } from "@/lib/validation";
import { fillBarClass, formatQty, numValue, stockFillRatio } from "@/lib/warehouses-ui";
import {
  transferStock,
  updateWarehouseProduct,
  updateWarehouseProductQuantity,
  type Warehouse,
  type WarehouseProduct,
} from "@/lib/api/warehouses";
import { fetchInventoryMovements } from "@/lib/api/inventory";
import { useToast } from "@/lib/store/toast";

function formatDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WarehouseInspector({
  open,
  wp,
  warehouseId,
  targets,
  onClose,
}: {
  open: boolean;
  wp: WarehouseProduct | null;
  warehouseId: number;
  targets: Warehouse[];
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [reorder, setReorder] = useState("");
  const [location, setLocation] = useState("");
  const [active, setActive] = useState(true);
  const [preferred, setPreferred] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferQty, setTransferQty] = useState("");

  useEffect(() => {
    if (!wp) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync intencional al montar/cambiar deps (código 3D/KDS recuperado)
    setQuantity(String(wp.current_quantity ?? 0));
    setMinimum(wp.minimum_quantity == null ? "" : String(wp.minimum_quantity));
    setMaximum(wp.maximum_quantity == null ? "" : String(wp.maximum_quantity));
    setReorder(wp.reorder_point == null ? "" : String(wp.reorder_point));
    setLocation(wp.location_in_warehouse ?? "");
    setActive(wp.is_active ?? true);
    setPreferred(wp.is_preferred_location ?? false);
    setTransferTarget("");
    setTransferQty("");
  }, [wp]);

  const movements = useQuery({
    queryKey: ["inventory-history", { warehouse: warehouseId, product: wp?.product }],
    queryFn: () =>
      fetchInventoryMovements({
        warehouse: warehouseId,
        product: wp?.product ?? undefined,
        page_size: 20,
        ordering: "-created",
      }),
    enabled: open && Boolean(wp?.product),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!wp) throw new Error("Sin producto");
      const qty = Number(quantity);
      if (!isNonNegativeNumber(qty)) throw new Error("La cantidad no puede ser negativa.");
      const configPayload = {
        minimum_quantity: minimum === "" ? undefined : Number(minimum),
        maximum_quantity: maximum === "" ? null : Number(maximum),
        reorder_point: reorder === "" ? undefined : Number(reorder),
        location_in_warehouse: location.trim() || null,
        is_active: active,
        is_preferred_location: preferred,
      };
      await updateWarehouseProduct(Number(wp.id), configPayload);
      if (qty !== numValue(wp.current_quantity)) {
        await updateWarehouseProductQuantity(Number(wp.id), {
          quantity: qty,
          notes: "Ajuste desde ficha de bodega",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-history"] });
      toast.success("Stock actualizado");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo guardar"),
  });

  const transfer = useMutation({
    mutationFn: () =>
      transferStock({
        source_warehouse_id: warehouseId,
        target_warehouse_id: Number(transferTarget),
        products: [
          {
            product_id: Number(wp?.product),
            quantity: Number(transferQty),
          },
        ],
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-history"] });
      toast.success(res.message || "Transferencia lista");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo transferir"),
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save.mutate();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, save]);

  if (!wp) return null;

  const status = wp.stock_status ?? "";
  const ratio = stockFillRatio({ ...wp, current_quantity: numValue(quantity) || wp.current_quantity });

  return (
    <AnimatedOverlay
      open={open}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-stretch md:justify-end md:p-0"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:h-full md:max-w-lg md:rounded-none md:border-y-0 md:border-l md:border-r-0">
        <div className="glass-strong flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{wp.product_name}</h2>
            <p className="text-xs text-muted-foreground">
              {wp.product_measurement_unit}
              {wp.product_code ? ` · ${wp.product_code}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Stock actual</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {formatQty(quantity || wp.current_quantity)}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  statusBadge(status),
                )}
              >
                {stockStatusLabel(status)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", fillBarClass(status))}
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs tabular-nums text-muted-foreground">
              Costo {formatCLP(numValue(wp.total_value))}
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Cantidades</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad" htmlFor="insp-qty" required>
                <Input
                  id="insp-qty"
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
              <Field label="Mínima" htmlFor="insp-min">
                <Input
                  id="insp-min"
                  type="number"
                  min="0"
                  value={minimum}
                  onChange={(e) => setMinimum(e.target.value)}
                />
              </Field>
              <Field label="Máxima" htmlFor="insp-max">
                <Input
                  id="insp-max"
                  type="number"
                  min="0"
                  value={maximum}
                  onChange={(e) => setMaximum(e.target.value)}
                />
              </Field>
              <Field label="Reorden" htmlFor="insp-reorder">
                <Input
                  id="insp-reorder"
                  type="number"
                  min="0"
                  value={reorder}
                  onChange={(e) => setReorder(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Ubicación en el recinto" htmlFor="insp-loc" hint="Estante, pasillo, cámara…">
              <Input
                id="insp-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Estante A"
              />
            </Field>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Activo en esta bodega</span>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Ubicación preferida</span>
                <Switch checked={preferred} onCheckedChange={setPreferred} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Actividad</h3>
              <Link
                href="/inventory"
                className="text-xs font-medium text-primary hover:underline"
              >
                Libro de inventario
              </Link>
            </div>
            {movements.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : (movements.data?.results ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Aún no hay movimientos en este recinto.</p>
            ) : (
              <ol className="space-y-2">
                {(movements.data?.results ?? []).map((mv) => (
                  <li
                    key={mv.id}
                    className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">
                        {mv.movement_type_display} · {mv.source_type_display}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          numValue(mv.quantity) < 0 ? "text-danger" : "text-success",
                        )}
                      >
                        {numValue(mv.quantity) > 0 ? "+" : ""}
                        {formatQty(mv.quantity)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatQty(mv.previous_quantity)} → {formatQty(mv.current_quantity)}
                      {" · "}
                      {formatDateTime(mv.created)}
                      {mv.user_name ? ` · ${mv.user_name}` : ""}
                    </p>
                    {mv.notes ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{mv.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {targets.length > 0 ? (
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ArrowRightLeft className="h-4 w-4" />
                Mover a otro recinto
              </h3>
              <Field label="Destino" htmlFor="insp-target">
                <Select
                  id="insp-target"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                >
                  <option value="">Selecciona bodega</option>
                  {targets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cantidad" htmlFor="insp-tqty">
                <Input
                  id="insp-tqty"
                  type="number"
                  min="0"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                />
              </Field>
              <Button
                variant="outline"
                className="w-full"
                disabled={
                  transfer.isPending ||
                  !transferTarget ||
                  !wp.product ||
                  !(Number(transferQty) > 0)
                }
                isLoading={transfer.isPending}
                onClick={() => transfer.mutate()}
              >
                Transferir
              </Button>
            </section>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
          <p className="mr-auto hidden self-center text-[11px] text-muted-foreground sm:block">
            Ctrl+S guarda
          </p>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cerrar
          </Button>
          <Button
            onClick={() => save.mutate()}
            isLoading={save.isPending}
            disabled={!isNonNegativeNumber(Number(quantity))}
          >
            Guardar
          </Button>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
