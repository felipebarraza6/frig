"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { formatCLP } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { createQuotation } from "@/lib/api/quotations";
import { searchCustomers } from "@/lib/api/customers";
import { fetchProducts } from "@/lib/api/products";
import { useCurrentBranch } from "@/lib/store/session";
import type { YggdraSchemas } from "@/lib/api/types";

type Client = YggdraSchemas["Client"];

interface DraftItem {
  productId: number;
  name: string;
  unitPrice: string;
  quantity: number;
  max: number | null;
}

function priceOf(p: { sale_price?: unknown; price?: unknown }): string {
  const sale = Number.parseFloat(String(p.sale_price ?? "")) || 0;
  const base = sale > 0 ? sale : Number.parseFloat(String(p.price ?? "0")) || 0;
  return base.toFixed(2);
}

export function QuotationCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [clientSearch, setClientSearch] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [observation, setObservation] = useState("");

  const branch = useCurrentBranch();
  const branchId = branch?.branch_id !== undefined && branch?.branch_id !== null ? Number(branch.branch_id) : undefined;

  const [debouncedClient, setDebouncedClient] = useState(clientSearch);
  const [debouncedProduct, setDebouncedProduct] = useState(productSearch);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedClient(clientSearch), 300);
    return () => window.clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedProduct(productSearch), 300);
    return () => window.clearTimeout(t);
  }, [productSearch]);

  const customersQuery = useQuery({
    queryKey: ["quotation-create", "customers", debouncedClient, branchId],
    queryFn: () => searchCustomers(debouncedClient, branchId),
    enabled: open && debouncedClient.trim().length >= 2,
  });

  const productsQuery = useQuery({
    queryKey: ["quotation-create", "products", debouncedProduct, branchId],
    queryFn: () => fetchProducts({ search: debouncedProduct, is_for_sale: true, is_active: true, page_size: 10 }),
    enabled: open && debouncedProduct.trim().length >= 2,
  });

  const customerResults = (() => {
    const d = customersQuery.data as unknown;
    if (Array.isArray(d)) return d as Client[];
    if (d && typeof d === "object") {
      const paged = (d as { results?: Client[] }).results;
      if (Array.isArray(paged)) return paged;
      if ("id" in d) return [d as Client];
    }
    return [] as Client[];
  })();

  const productResults = (() => {
    const d = productsQuery.data;
    if (!d) return [];
    if (Array.isArray(d.results)) return d.results;
    return [];
  })();

  const create = useMutation({
    mutationFn: () =>
      createQuotation({
        items: items.map((i) => ({
          product: i.productId,
          quantity: i.quantity,
          unit_price: i.unitPrice,
        })),
        observation: observation.trim() || null,
        client_id: client ? Number(client.id) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      setClient(null);
      setItems([]);
      setObservation("");
      setClientSearch("");
      setProductSearch("");
      onClose();
      toast.success("Cotización creada");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo crear la cotización"),
  });

  function addProduct(p: { id: number; name: string; sale_price?: unknown; price?: unknown; quantity?: unknown }) {
    setItems((prev) => {
      const found = prev.find((i) => i.productId === p.id);
      if (found) {
        return prev.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { productId: p.id, name: p.name, unitPrice: priceOf(p), quantity: 1, max: null }];
    });
  }

  const total = items.reduce((acc, i) => acc + (Number.parseFloat(i.unitPrice) || 0) * i.quantity, 0);

  return (
    <AnimatedOverlay open={open} onClose={onClose} panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl sm:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Nueva cotización</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
          {client ? (
            <div className="mt-1 flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span className="font-medium">{client.name}</span>
              <button onClick={() => setClient(null)} className="text-xs text-muted-foreground hover:text-foreground">
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <Input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar cliente por nombre…"
                className="mt-1"
              />
              {customerResults.map((c) => (
                <button
                  key={String(c.id)}
                  onClick={() => setClient(c)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {c.name}
                </button>
              ))}
              {customersQuery.isLoading && debouncedClient.trim().length >= 2 && (
                <p className="mt-1 text-xs text-muted-foreground">Buscando clientes…</p>
              )}
              {customersQuery.isError && (
                <p className="mt-1 text-xs text-danger">No se pudo buscar clientes.</p>
              )}
              {!customersQuery.isLoading && !customersQuery.isError && debouncedClient.trim().length >= 2 && customerResults.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Sin clientes para esa búsqueda.</p>
              )}
            </>
          )}

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Productos</p>
          <Input
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="mt-1"
          />
          {!productsQuery.isLoading && !productsQuery.isError && debouncedProduct.trim().length >= 2 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {productResults.length === 0
                ? "Sin productos en tu sucursal para esa búsqueda."
                : `${productResults.length} resultado${productResults.length === 1 ? "" : "s"}`}
            </p>
          )}
          {productResults.map((p) => (
            <button
              key={p.id}
              onClick={() => addProduct(p)}
              className="mt-1 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="font-medium">{p.name}</span>
              <span className="tabular-nums text-muted-foreground">{formatCLP(priceOf(p))}</span>
            </button>
          ))}
          {productsQuery.isLoading && debouncedProduct.trim().length >= 2 && (
            <p className="mt-1 text-xs text-muted-foreground">Buscando productos…</p>
          )}
          {productsQuery.isError && (
            <p className="mt-1 text-xs text-danger">No se pudo buscar productos.</p>
          )}

          {items.length > 0 && (
            <div className="mt-3 flex flex-col divide-y divide-border rounded-xl border border-border">
              {items.map((i) => (
                <div key={i.productId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">x{i.quantity} · {formatCLP(i.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setItems((prev) => prev.map((x) => (x.productId === i.productId ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border"
                      aria-label="Quitar uno"
                    >
                      −
                    </button>
                    <button
                      onClick={() => setItems((prev) => prev.map((x) => (x.productId === i.productId ? { ...x, quantity: x.quantity + 1 } : x)))}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border"
                      aria-label="Agregar uno"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setItems((prev) => prev.filter((x) => x.productId !== i.productId))}
                      className="ml-1 text-xs text-danger"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observación</p>
          <Input
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Opcional"
            className="mt-1"
          />
          <p className="mt-3 text-right text-sm font-bold tabular-nums">Total {formatCLP(total)}</p>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || items.length === 0 || !client} isLoading={create.isPending}>
            Crear cotización
          </Button>
        </div>
        {!client && items.length > 0 && (
          <p className="px-4 pb-1 text-xs text-muted-foreground">Elige un cliente para crear la cotización.</p>
        )}
      </div>
    </AnimatedOverlay>
  );
}
