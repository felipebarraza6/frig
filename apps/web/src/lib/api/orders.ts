import { apiFetch, ApiError } from "@/lib/api/client";
import type { YggdraSchemas } from "@/lib/api/types";
import type { CartItem } from "@/lib/store/cart";

type YggdraOrder = YggdraSchemas["Order"];

export interface OrderItemInput {
  product: number;
  quantity: number;
  unit_price: string;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  observation?: string | null;
}

/**
 * Crear una orden de venta (SALE) con sus líneas en un solo POST.
 * El backend asigna branch/owner automáticamente desde el request
 * (X-Branch-ID + token). La fecha se envía en hora local ISO.
 */
export async function createOrder(input: CreateOrderInput): Promise<YggdraOrder> {
  const data = await apiFetch<YggdraOrder>("/sales/orders/", {
    method: "POST",
    body: {
      order_type: "SALE",
      date: new Date().toISOString(),
      observation: input.observation ?? null,
      items: input.items,
    },
  });
  return data;
}

/** Convertir el carrito de la UI al payload de items de la API. */
export function cartToOrderItems(items: CartItem[]): OrderItemInput[] {
  return items.map((i) => ({
    product: i.product.id,
    quantity: i.quantity,
    unit_price: i.product.price.toFixed(2),
  }));
}

export { ApiError };
