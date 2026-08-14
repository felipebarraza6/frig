"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Package,
  Plus,
  ArrowRightLeft,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  fetchWarehouses,
  fetchWarehouse,
  fetchWarehouseProducts,
  addProductToWarehouse,
  updateWarehouseProductQuantity,
  transferStock,
} from "@/lib/api/warehouses";
import { fetchProducts } from "@/lib/api/products";
import type { YggdraSchemas } from "@/lib/api/types";

type WarehouseProduct = YggdraSchemas["WarehouseProduct"];

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const warehouseId = Number(params.id);
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<WarehouseProduct | null>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferProduct, setTransferProduct] = useState<WarehouseProduct | null>(null);
  const [transferQuantity, setTransferQuantity] = useState("");

  const { data: warehouse, isLoading: loadingWarehouse } = useQuery({
    queryKey: ["warehouses", warehouseId],
    queryFn: () => fetchWarehouse(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["warehouses", warehouseId, "products"],
    queryFn: () => fetchWarehouseProducts(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const { data: catalogPage } = useQuery({
    queryKey: ["products", "catalog"],
    queryFn: () => fetchProducts({}),
  });
  const catalog = catalogPage?.results ?? [];

  const { data: warehousesPage } = useQuery({
    queryKey: ["warehouses", "all"],
    queryFn: () => fetchWarehouses({}),
  });
  const targetWarehouses = (warehousesPage?.results ?? []).filter((w) => w.id !== warehouseId);

  const add = useMutation({
    mutationFn: () =>
      addProductToWarehouse({
        warehouse_id: warehouseId,
        product_id: Number(selectedProduct),
        initial_quantity: Number(initialQuantity),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      setAddOpen(false);
      setSelectedProduct("");
      setInitialQuantity("");
    },
  });

  const adjust = useMutation({
    mutationFn: () =>
      updateWarehouseProductQuantity(Number(adjustingProduct?.id), {
        initial_quantity: Number(newQuantity),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      setAdjustOpen(false);
      setAdjustingProduct(null);
      setNewQuantity("");
    },
  });

  const transfer = useMutation({
    mutationFn: () =>
      transferStock({
        source_warehouse: warehouseId,
        target_warehouse: Number(transferTarget),
        product: Number(transferProduct?.product),
        quantity: Number(transferQuantity),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      setTransferOpen(false);
      setTransferTarget("");
      setTransferProduct(null);
      setTransferQuantity("");
    },
  });

  if (loadingWarehouse) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="text-muted-foreground">Bodega no encontrada.</p>
        <Button className="mt-4" onClick={() => router.push("/warehouses")}>
          Volver a bodegas
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-6 py-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/warehouses")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{warehouse.name}</h1>
          <p className="text-xs text-muted-foreground">
            {warehouse.warehouse_type ?? "Bodega"} · {warehouse.location ?? "Sin ubicación"}
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Productos</p>
            <p className="text-xl font-semibold">{warehouse.total_products ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Cantidad total</p>
            <p className="text-xl font-semibold">{warehouse.total_quantity ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Stock bajo</p>
            <p className="text-xl font-semibold">{warehouse.low_stock_products ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Sin stock</p>
            <p className="text-xl font-semibold">{warehouse.out_of_stock_products ?? 0}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Productos en bodega</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
              Transferir
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Agregar producto
            </Button>
          </div>
        </div>

        {loadingProducts ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay productos en esta bodega.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Mínima</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((wp) => (
                  <tr key={wp.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{wp.product_name}</p>
                          <p className="text-xs text-muted-foreground">{wp.product_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{wp.current_quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{wp.minimum_quantity ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={
                          wp.stock_status === "OK"
                            ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700"
                        }
                      >
                        {wp.stock_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAdjustingProduct(wp);
                            setNewQuantity(String(wp.current_quantity));
                            setAdjustOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Ajustar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTransferProduct(wp);
                            setTransferOpen(true);
                          }}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          Mover
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && (
        <Modal title="Agregar producto a bodega" onClose={() => setAddOpen(false)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Producto</label>
              <Select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
              >
                <option value="">Selecciona un producto</option>
                {catalog.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Cantidad inicial</label>
              <Input
                type="number"
                min="0"
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
              />
            </div>
            {add.isError && (
              <p className="text-sm text-danger">
                {add.error instanceof Error ? add.error.message : "Error al agregar"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={add.isPending}>
                Cancelar
              </Button>
              <Button
                onClick={() => add.mutate()}
                disabled={add.isPending || !selectedProduct || !initialQuantity}
              >
                {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Agregar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {adjustOpen && adjustingProduct && (
        <Modal title="Ajustar cantidad" onClose={() => setAdjustOpen(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{adjustingProduct.product_name}</p>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Nueva cantidad</label>
              <Input
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
            </div>
            {adjust.isError && (
              <p className="text-sm text-danger">
                {adjust.error instanceof Error ? adjust.error.message : "Error al ajustar"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjust.isPending}>
                Cancelar
              </Button>
              <Button onClick={() => adjust.mutate()} disabled={adjust.isPending || !newQuantity}>
                {adjust.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {transferOpen && (
        <Modal title="Transferir stock" onClose={() => setTransferOpen(false)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Producto</label>
              <Select
                value={transferProduct?.id ?? ""}
                onChange={(e) => {
                  const wp = products.find((p) => String(p.id) === e.target.value) ?? null;
                  setTransferProduct(wp);
                }}
              >
                <option value="">Selecciona un producto</option>
                {products.map((wp) => (
                  <option key={wp.id} value={wp.id}>{wp.product_name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Bodega destino</label>
              <Select
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
              >
                <option value="">Selecciona bodega</option>
                {targetWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Cantidad</label>
              <Input
                type="number"
                min="0"
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(e.target.value)}
              />
            </div>
            {transfer.isError && (
              <p className="text-sm text-danger">
                {transfer.error instanceof Error ? transfer.error.message : "Error al transferir"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transfer.isPending}>
                Cancelar
              </Button>
              <Button
                onClick={() => transfer.mutate()}
                disabled={transfer.isPending || !transferProduct || !transferTarget || !transferQuantity}
              >
                {transfer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Transferir
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
