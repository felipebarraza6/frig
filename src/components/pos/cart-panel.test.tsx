import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PosProduct } from "@/lib/api/types";
import { useCartStore, type CartItem } from "@/lib/store/cart";
import { formatCLP } from "@/lib/utils";
import CartPanel from "./cart-panel";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const burger = {
  id: 1,
  name: "Smash Burger",
  price: 7900,
  quantity: 50,
  tracks_inventory: false,
} as unknown as PosProduct;

function cartLine(over: Partial<CartItem> = {}): CartItem {
  return {
    id: "line-1",
    product: burger,
    quantity: 2,
    modifiers: [{ modifierOptionId: 9, name: "Queso cheddar", groupName: "Extras", surcharge: 1000 }],
    discountPercentage: 0,
    ...over,
  };
}

function renderCart() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CartPanel />
    </QueryClientProvider>,
  );
}

const totalRow = () => screen.getByText("Total").parentElement as HTMLElement;

describe("CartPanel del POS", () => {
  beforeEach(() => {
    window.localStorage.setItem("frig.token", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ results: [] })),
    );
    useCartStore.setState({ items: [cartLine()], globalDiscountPercentage: 0 });
  });

  afterEach(() => {
    cleanup();
    useCartStore.setState({ items: [], globalDiscountPercentage: 0 });
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("muestra la línea con su extra y cobra el recargo en el total", () => {
    renderCart();
    expect(screen.getByText("Smash Burger")).toBeTruthy();
    expect(screen.getByText(/Extras: Queso cheddar/)).toBeTruthy();
    expect(within(totalRow()).getByText(formatCLP((7900 + 1000) * 2))).toBeTruthy();
  });

  it("al subir la cantidad el total se recalcula", () => {
    renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar cantidad" }));
    expect(useCartStore.getState().items[0]!.quantity).toBe(3);
    expect(within(totalRow()).getByText(formatCLP((7900 + 1000) * 3))).toBeTruthy();
  });

  it("quitar el producto deja el carrito vacío", () => {
    renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Quitar Smash Burger" }));
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
