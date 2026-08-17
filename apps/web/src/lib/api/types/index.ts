import type { components } from "./yggdra";

export type YggdraSchemas = components["schemas"];
export type YggdraProduct = YggdraSchemas["ProductList"];
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
  minimum_stock?: number;
}

export function toPosProduct(p: YggdraProduct): PosProduct {
  const cat = p.category && typeof p.category === "object" ? p.category : null;
  const rawPrice = parseFloat(p.sale_price ?? p.price ?? "0") || 0;
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
    quantity: p.quantity,
    minimum_stock: p.minimum_stock,
  };
}