"use client";

import { create } from "zustand";
import type { PosProduct } from "@/lib/api/types";

export interface CartItemModifier {
  modifierOptionId: number;
  name: string;
  groupName: string;
  surcharge: number;
}

export interface CartItem {
  id: string;
  product: PosProduct;
  quantity: number;
  modifiers: CartItemModifier[];
  discountPercentage: number;
  notes?: string;
  /** ID del OrderProduct existente cuando se edita una orden. */
  orderProductId?: number;
}

interface AddItemOptions {
  quantity?: number;
  modifiers?: CartItemModifier[];
  discountPercentage?: number;
  notes?: string;
}

interface CartState {
  items: CartItem[];
  globalDiscountPercentage: number;
  addItem: (product: PosProduct, options?: AddItemOptions) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  setItemDiscount: (cartItemId: string, percentage: number) => void;
  setGlobalDiscount: (percentage: number) => void;
  setItemNotes: (cartItemId: string, notes: string) => void;
  setItems: (items: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void;
  clear: () => void;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function availableStock(product: PosProduct): number {
  return typeof product.quantity === "number" ? product.quantity : Infinity;
}

function modifiersMatch(a: CartItemModifier[], b: CartItemModifier[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x.modifierOptionId - y.modifierOptionId);
  const sortedB = [...b].sort((x, y) => x.modifierOptionId - y.modifierOptionId);
  return sortedA.every((m, i) => m.modifierOptionId === sortedB[i].modifierOptionId);
}

function clampQuantity(product: PosProduct, quantity: number): number {
  const max = availableStock(product);
  if (quantity <= 0) return 0;
  return Math.min(quantity, max);
}

export function cartItemSubtotal(item: CartItem): number {
  const modifiersTotal = item.modifiers.reduce((sum, m) => sum + Math.round(m.surcharge), 0);
  return Math.round(item.product.price + modifiersTotal) * item.quantity;
}

export function cartItemDiscount(item: CartItem): number {
  return Math.round(cartItemSubtotal(item) * (item.discountPercentage / 100));
}

export function cartItemTotal(item: CartItem): number {
  return cartItemSubtotal(item) - cartItemDiscount(item);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + cartItemSubtotal(i), 0);
}

export function cartDiscountTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + cartItemDiscount(i), 0);
}

export function cartTotal(items: CartItem[], globalDiscountPercentage = 0): number {
  const subtotal = cartSubtotal(items);
  const lineDiscounts = cartDiscountTotal(items);
  const afterLineDiscounts = subtotal - lineDiscounts;
  const globalDiscount = Math.round(afterLineDiscounts * (globalDiscountPercentage / 100));
  return Math.max(0, afterLineDiscounts - globalDiscount);
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  globalDiscountPercentage: 0,
  addItem: (product, options = {}) =>
    set((state) => {
      const { quantity = 1, modifiers = [], discountPercentage = 0, notes = "" } = options;
      const max = availableStock(product);
      if (max <= 0) return state;
      const existing = state.items.find(
        (i) => i.product.id === product.id && modifiersMatch(i.modifiers, modifiers),
      );
      if (existing) {
        const next = Math.min(existing.quantity + quantity, max);
        return {
          items: state.items.map((i) =>
            i.id === existing.id ? { ...i, quantity: next } : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            id: generateId(),
            product,
            quantity: Math.min(quantity, max),
            modifiers,
            discountPercentage,
            notes,
          },
        ],
      };
    }),
  removeItem: (cartItemId) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== cartItemId),
    })),
  updateQuantity: (cartItemId, quantity) =>
    set((state) => {
      const item = state.items.find((i) => i.id === cartItemId);
      if (!item) return state;
      const next = clampQuantity(item.product, quantity);
      return {
        items:
          next <= 0
            ? state.items.filter((i) => i.id !== cartItemId)
            : state.items.map((i) => (i.id === cartItemId ? { ...i, quantity: next } : i)),
      };
    }),
  setItemDiscount: (cartItemId, percentage) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === cartItemId ? { ...i, discountPercentage: Math.max(0, Math.min(100, percentage)) } : i,
      ),
    })),
  setGlobalDiscount: (percentage) =>
    set(() => ({
      globalDiscountPercentage: Math.max(0, Math.min(100, percentage)),
    })),
  setItemNotes: (cartItemId, notes) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === cartItemId ? { ...i, notes } : i)),
    })),
  setItems: (items) =>
    set((state) => ({
      items: typeof items === "function" ? items(state.items) : items,
    })),
  clear: () => set({ items: [], globalDiscountPercentage: 0 }),
}));
