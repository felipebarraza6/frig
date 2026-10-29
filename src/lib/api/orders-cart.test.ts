import { describe, expect, it } from "vitest";
import {
  cartToEditOrderItems,
  cartToOrderItems,
  orderProductsToCartItems,
} from "@/lib/api/orders";
import { cartTotal, type CartItem } from "@/lib/store/cart";
import type { YggdraSchemas } from "@/lib/api/types";

type OrderProduct = YggdraSchemas["OrderProduct"];

function cartItem(overrides: Partial<CartItem> & { productId?: number } = {}): CartItem {
  const { productId = 11, ...rest } = overrides;
  return {
    id: "c1",
    product: { id: productId, name: "Burger", code: "B1", price: 5000 },
    quantity: 1,
    modifiers: [],
    discountPercentage: 0,
    ...rest,
  };
}

function orderProduct(partial: Record<string, unknown>): OrderProduct {
  return {
    id: 1,
    product: 10,
    product_name: "Item",
    product_code: "X",
    quantity: 1,
    unit_price: 0,
    discount_percentage: 0,
    notes: null,
    modifiers: [],
    modifiers_total: "0",
    total_price: 0,
    total_cost: 0,
    discount_amount: 0,
    final_price: "0",
    user: null,
    added_at: "",
    modified_at: "",
    created: "",
    modified: "",
    has_discount: "",
    quantity_difference: "",
    is_partial_delivery: "",
    is_fully_delivered: "",
    ...partial,
  } as unknown as OrderProduct;
}

describe("cartToEditOrderItems", () => {
  it("envía unit_price base y modifiers por ítem", () => {
    const items = [
      cartItem({
        orderProductId: 99,
        product: { id: 11, name: "Burger", code: "B1", price: 11400 },
        quantity: 1,
        discountPercentage: 0,
        notes: "sin cebolla",
        modifiers: [
          {
            modifierOptionId: 3,
            name: "Extra queso",
            groupName: "Extras",
            surcharge: 500,
          },
        ],
      }),
    ];

    const payload = cartToEditOrderItems(items, [55]);

    expect(payload).toEqual([
      {
        id: 99,
        product: 11,
        quantity: 1,
        unit_price: "11400.00",
        discount_percentage: 0,
        notes: "sin cebolla",
        is_active: true,
        modifiers: [{ modifier_option: 3, notes: null }],
      },
      { id: 55, is_active: false },
    ]);
  });

  it("cartToOrderItems sigue pudiendo enviar surcharge_applied en create", () => {
    const items = [
      cartItem({
        product: { id: 11, name: "Burger", code: "B1", price: 11400 },
        modifiers: [
          {
            modifierOptionId: 3,
            name: "Extra queso",
            groupName: "Extras",
            surcharge: 500,
          },
        ],
      }),
    ];
    const row = cartToOrderItems(items)[0]!;
    expect(row.unit_price).toBe("11400.00");
    expect(row.modifiers).toEqual([
      { modifier_option: 3, surcharge_applied: "500.00", notes: null },
    ]);
  });
});

describe("orderProductsToCartItems", () => {
  it("base = unit_price - modifiers_total; extras desde modifiers (sin doble conteo)", () => {
    // unit_price INCLUYE extras: 11900 = 11400 base + 500 extra
    const op = orderProduct({
      id: 42,
      product: 11,
      product_name: "Burger",
      product_code: "B1",
      quantity: 1,
      unit_price: 11900,
      modifiers: [
        {
          id: 1,
          order_product: 42,
          modifier_option: 3,
          modifier_option_name: "Extra queso",
          modifier_group_name: "Extras",
          modifier_option_detail: "",
          surcharge_applied: 500,
          notes: null,
          created: "",
          modified: "",
        },
      ],
      modifiers_total: "500.00",
      total_price: 11900,
      final_price: "11900.00",
    });

    const [item] = orderProductsToCartItems([op]);
    expect(item!.product.price).toBe(11400);
    expect(item!.modifiers).toEqual([
      {
        modifierOptionId: 3,
        name: "Extra queso",
        groupName: "Extras",
        surcharge: 500,
      },
    ]);
    expect(cartTotal([item!])).toBe(11900);
  });

  it("op unit_price 11900 con modifier 500 → carrito base 11400 + extra 500 = 11900", () => {
    const op = orderProduct({
      unit_price: 11900,
      modifiers_total: "500",
      quantity: 1,
      modifiers: [
        {
          id: 1,
          order_product: 1,
          modifier_option: 3,
          modifier_option_name: "Extra",
          modifier_group_name: "Extras",
          modifier_option_detail: "",
          surcharge_applied: 500,
          notes: null,
          created: "",
          modified: "",
        },
      ],
    });
    const items = orderProductsToCartItems([op]);
    expect(items[0]!.product.price).toBe(11400);
    expect(items[0]!.modifiers[0]!.surcharge).toBe(500);
    expect(cartTotal(items)).toBe(11900);
  });

  it("el total del carrito coincide con order.total_amount", () => {
    // unit_price con extras: 2300; modifiers_total por unidad: 300 → base 2000
    const products = [
      orderProduct({
        id: 1,
        product: 10,
        product_name: "Café",
        product_code: "C1",
        quantity: 1,
        unit_price: 2300,
        modifiers: [
          {
            id: 9,
            order_product: 1,
            modifier_option: 7,
            modifier_option_name: "Leche avena",
            modifier_group_name: "Leche",
            modifier_option_detail: "",
            surcharge_applied: 300,
            notes: null,
            created: "",
            modified: "",
          },
        ],
        modifiers_total: "300.00",
        total_price: 2300,
        final_price: "2300.00",
      }),
    ];

    const items = orderProductsToCartItems(products);
    expect(cartTotal(items)).toBe(2300);
  });

  it("qty > 1: modifiers_total es recargo por unidad", () => {
    // base 5000 + extra 500 = unit_price 5500; qty 2 → total 11000
    const op = orderProduct({
      quantity: 2,
      unit_price: 5500,
      modifiers_total: "500",
      modifiers: [
        {
          id: 1,
          order_product: 1,
          modifier_option: 3,
          modifier_option_name: "Extra queso",
          modifier_group_name: "Extras",
          modifier_option_detail: "",
          surcharge_applied: 500,
          notes: null,
          created: "",
          modified: "",
        },
      ],
    });
    const items = orderProductsToCartItems([op]);
    expect(items[0]!.product.price).toBe(5000);
    expect(cartTotal(items)).toBe(11000);
  });
});
