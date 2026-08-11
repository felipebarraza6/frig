"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchCategories, type YggdraCategory } from "@/lib/api/categories";
import type { ProductPayload } from "@/lib/api/products";
import type { YggdraProduct } from "@/lib/api/types";

const PRODUCT_TYPES = [
  { value: "DIRECT_SALE", label: "Venta directa" },
  { value: "RECIPE_BASED", label: "Compuesto (receta)" },
  { value: "SERVICE", label: "Servicio" },
  { value: "RAW_MATERIAL", label: "Materia prima" },
  { value: "IOT", label: "Equipo IoT" },
  { value: "EQUIPMENT", label: "Equipo/Maquinaria" },
] as const;

interface ProductFormProps {
  product?: YggdraProduct;
  onClose: () => void;
  onSubmit: (payload: ProductPayload, id?: number) => Promise<void>;
}

export function ProductForm({ product, onClose, onSubmit }: ProductFormProps) {
  const [categories, setCategories] = useState<YggdraCategory[]>([]);
  const [name, setName] = useState(product?.name ?? "");
  const [code, setCode] = useState(product?.code ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.sale_price ?? product?.price ?? "");
  const [costPrice, setCostPrice] = useState(product?.cost_price ?? "");
  const [stock, setStock] = useState(product?.quantity ? String(product.quantity) : "");
  const [category, setCategory] = useState<string>(product?.category?.id ? String(product.category.id) : "");
  const [productType, setProductType] = useState<string>(
    product?.product_type ?? "DIRECT_SALE",
  );
  const [isForSale, setIsForSale] = useState(product?.is_for_sale ?? true);
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload: ProductPayload = {
        name,
        code: code || null,
        description: description || null,
        price: price || undefined,
        sale_price: price || undefined,
        cost_price: costPrice || undefined,
        quantity: stock ? Number(stock) : undefined,
        category: category ? Number(category) : null,
        product_type: productType as ProductPayload["product_type"],
        is_for_sale: isForSale,
        is_active: isActive,
      };
      await onSubmit(payload, product?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el producto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {product ? "Editar producto" : "Nuevo producto"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="product-name" className="text-sm font-medium">Nombre</label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ej: Cono artesanal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="product-code" className="text-sm font-medium">Código</label>
              <Input
                id="product-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-price" className="text-sm font-medium">Precio de venta</label>
              <Input
                id="product-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="product-cost" className="text-sm font-medium">Costo</label>
              <Input
                id="product-cost"
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-stock" className="text-sm font-medium">Cantidad inicial</label>
              <Input
                id="product-stock"
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="product-category" className="text-sm font-medium">Categoría</label>
            <select
                id="product-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="product-type" className="text-sm font-medium">Tipo</label>
              <select
                id="product-type"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-description" className="text-sm font-medium">Descripción</label>
              <Input
                id="product-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isForSale}
                onChange={(e) => setIsForSale(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Disponible para venta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Activo
            </label>
          </div>

          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {product ? "Guardar cambios" : "Crear producto"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
