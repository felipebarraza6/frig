/**
 * Persistencia selectiva de TanStack Query en IndexedDB.
 * Pintar listados al reabrir la PWA sin cachear datos operativos críticos.
 */

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import { APP_BUILD } from "@/lib/pwa";

/** Prefijos de queryKey que sí se hidratan desde disco. */
const PERSIST_KEY_PREFIXES = [
  "products",
  "categories",
  "suppliers",
  "customers",
  "warehouses",
  "branch-modules",
  "module-catalog",
  "frontend-config",
  "discounts",
  "promotions",
  "payment-methods",
  "banks",
  "bank-accounts",
  "users",
  "branches",
  "organization",
  "menus",
  "modifiers",
  "combos",
  "nutrition",
  "recipe",
  "recent-picker",
  "category-options",
];

/** Prefijos que nunca deben persistir (frescura operativa). */
const BLOCK_KEY_PREFIXES = [
  "kitchen-tickets",
  "cash-register",
  "cash-session",
  "pos-",
  "orders",
  "sales-live",
  "tables-live",
  "realtime",
];

function keyHead(queryKey: readonly unknown[]): string {
  const head = queryKey[0];
  return typeof head === "string" ? head : "";
}

export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const head = keyHead(queryKey);
  if (!head) return false;
  if (BLOCK_KEY_PREFIXES.some((p) => head === p || head.startsWith(p))) return false;
  return PERSIST_KEY_PREFIXES.some((p) => head === p || head.startsWith(p));
}

const idbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const value = await get<string>(key);
    return value ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await del(key);
  },
};

export function createQueryPersister(storageKey: string) {
  return createAsyncStoragePersister({
    storage: idbStorage,
    key: storageKey,
    throttleTime: 1000,
  });
}

export function queryPersistStorageKey(userId?: string | number | null, branchId?: string | null): string {
  const u = userId != null && String(userId) !== "" ? String(userId) : "anon";
  const b = branchId != null && String(branchId) !== "" ? String(branchId) : "nobranch";
  return `frig.rq.${u}.${b}`;
}

export const QUERY_PERSIST_MAX_AGE = 24 * 60 * 60 * 1000; // 24h
export const QUERY_PERSIST_BUSTER = APP_BUILD;

/** Borra el blob persistido de RQ (llamar en logout). */
export async function clearQueryPersist(
  userId?: string | number | null,
  branchId?: string | null,
): Promise<void> {
  const key = queryPersistStorageKey(userId, branchId);
  await del(key);
}
