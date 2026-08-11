"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Power, Loader2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCLP } from "@/lib/utils";
import {
  fetchProducts,
  createProduct,
  updateProduct,
  setProductActive,
  deleteProduct,
  type ProductPayload,
} from "@/lib/api/products";
import { ProductForm } from "@/components/products/product-form";
import type { YggdraProduct } from "@/lib/api/types";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<YggdraProduct | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["products", "manage", query],
    queryFn: () =>
      fetchProducts(query ? { name__icontains: query } : {}),
  });

  const products = page?.results ?? [];

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      setProductActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const onSubmit = async (payload: ProductPayload, id?: number) => {
    if (id) {
      await updateProduct(id, payload);
    } else {
      await createProduct(payload);
    }
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Productos</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona el catálogo de la sucursal
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre…"
            className="pl-9"
            aria-label="Buscar producto"
          />
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudo cargar el catálogo.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-center">Venta</th>
                  <th className="px-4 py-3 text-center">Activo</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.name}</p>
                          {p.code && (
                            <p className="text-xs text-muted-foreground">{p.code}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.category?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCLP(p.sale_price ?? p.price ?? "0")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={
                          p.is_for_sale
                            ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {p.is_for_sale ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          toggleActive.mutate({ id: p.id, isActive: !p.is_active })
                        }
                        aria-label={`${p.is_active ? "Desactivar" : "Activar"} ${p.name}`}
                        className={
                          p.is_active
                            ? "text-emerald-600 hover:text-emerald-700"
                            : "text-muted-foreground hover:text-danger"
                        }
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger"
                          onClick={() => remove.mutate(p.id)}
                        >
                          Eliminar
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

      {(creating || editing) && (
        <ProductForm
          product={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
