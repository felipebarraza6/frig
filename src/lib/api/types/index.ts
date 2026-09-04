import type { components } from "./yggdra";

export type YggdraSchemas = components["schemas"];
// ProductList se genera sin stock_available, pero el backend lo anota
// en el listado de productos para exponer el stock efectivo (incluido
// el de bowls calculado desde recetas).
export type YggdraProduct = YggdraSchemas["ProductList"] & {
  stock_available?: number | null;
};
export type YggdraCategory = YggdraSchemas["CategoryProduct"];
export type YggdraPaginatedProduct = YggdraSchemas["PaginatedProductListList"];
export type YggdraPaginatedCategory = YggdraSchemas["PaginatedCategoryProductList"];

export interface PosProduct {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  price: number;
  product_type?: string;
  categoryId?: number | null;
  categoryName?: string | null;
  is_for_sale?: boolean;
  is_active?: boolean;
  quantity?: number;
  stock_available?: number | null;
  minimum_stock?: number;
  measurement_unit?: string | null;
  image?: string | null;
}

export function toPosProduct(p: YggdraProduct): PosProduct {
  const cat = p.category && typeof p.category === "object" ? p.category : null;
  const rawPrice = parseFloat(String(p.sale_price ?? p.price ?? "0")) || 0;
  // stock_available viene anotado desde el endpoint de listado; puede no estar
  // presente en otros endpoints o en versiones anteriores del schema.
  const rawStockAvailable = (p as { stock_available?: number | null }).stock_available;
  const effectiveQuantity =
    rawStockAvailable !== undefined && rawStockAvailable !== null
      ? rawStockAvailable
      : p.quantity;
  const withImage = p as { primary_image?: string | null; images?: Array<{ image?: string | null; is_primary?: boolean }> };
  let imageUrl = withImage.primary_image;
  if (!imageUrl && Array.isArray(withImage.images)) {
    const primary = withImage.images.find((img) => img.is_primary)?.image;
    imageUrl = primary ?? withImage.images[0]?.image;
  }

  return {
    id: p.id,
    name: p.name,
    code: p.code,
    description: p.description,
    price: Math.round(rawPrice),
    product_type: p.product_type?.toUpperCase(),
    categoryId: cat?.id ?? null,
    categoryName: cat?.name ?? null,
    is_for_sale: p.is_for_sale,
    is_active: p.is_active,
    quantity: effectiveQuantity,
    stock_available: rawStockAvailable,
    minimum_stock: p.minimum_stock,
    measurement_unit: p.measurement_unit,
    image: imageUrl,
  };
}