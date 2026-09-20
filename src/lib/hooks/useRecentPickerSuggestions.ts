"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "@/lib/api/orders";
import { fetchQuotations } from "@/lib/api/quotations";
import { fetchCustomers } from "@/lib/api/customers";
import { fetchProducts } from "@/lib/api/products";

const LIMIT = 10;

export type RecentClientPick = {
  id: number;
  name: string;
  dni?: string | null;
  phone_number?: string | null;
};

export type RecentProductPick = {
  id: number;
  name: string;
  code?: string | null;
  price: number;
};

function orderTime(value?: string | null): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Últimos / más usados clientes y productos a partir de órdenes y cotizaciones
 * recientes. Si no hay movimiento, completa con el listado activo (máx. 10).
 */
export function useRecentPickerSuggestions(enabled = true) {
  const ordersQuery = useQuery({
    queryKey: ["orders", "picker-recents"],
    queryFn: () => fetchOrders({ page_size: 40, ordering: "-date" }),
    enabled,
    staleTime: 60_000,
  });

  const quotationsQuery = useQuery({
    queryKey: ["quotations", "picker-recents"],
    queryFn: () => fetchQuotations({ page_size: 20, ordering: "-date" }),
    enabled,
    staleTime: 60_000,
  });

  const fallbackClientsQuery = useQuery({
    queryKey: ["customers", "picker-fallback"],
    queryFn: () => fetchCustomers({ status: "active", page_size: 10 }),
    enabled,
    staleTime: 60_000,
  });

  const fallbackProductsQuery = useQuery({
    queryKey: ["products", "picker-fallback"],
    queryFn: () =>
      fetchProducts({ is_for_sale: true, is_active: true, page_size: 10 }),
    enabled,
    staleTime: 60_000,
  });

  const recentClients = useMemo<RecentClientPick[]>(() => {
    const combined = [
      ...(quotationsQuery.data?.results ?? []),
      ...(ordersQuery.data?.results ?? []),
    ].sort((a, b) => orderTime(b.date) - orderTime(a.date));

    const seen = new Map<number, RecentClientPick>();
    for (const order of combined) {
      const c = order.client;
      if (!c?.id || seen.has(c.id)) continue;
      seen.set(c.id, {
        id: c.id,
        name: c.name ?? "Sin nombre",
        dni: c.dni ?? null,
        phone_number: c.phone_number ?? null,
      });
      if (seen.size >= LIMIT) break;
    }

    if (seen.size < LIMIT) {
      for (const c of fallbackClientsQuery.data?.results ?? []) {
        if (seen.has(c.id)) continue;
        seen.set(c.id, {
          id: c.id,
          name: c.name ?? "Sin nombre",
          dni: c.dni ?? null,
          phone_number: c.phone_number ?? null,
        });
        if (seen.size >= LIMIT) break;
      }
    }

    return Array.from(seen.values()).slice(0, LIMIT);
  }, [ordersQuery.data, quotationsQuery.data, fallbackClientsQuery.data]);

  const recentProducts = useMemo<RecentProductPick[]>(() => {
    const combined = [
      ...(quotationsQuery.data?.results ?? []),
      ...(ordersQuery.data?.results ?? []),
    ].sort((a, b) => orderTime(b.date) - orderTime(a.date));

    const tally = new Map<
      number,
      RecentProductPick & { count: number; lastSeen: number }
    >();

    combined.forEach((order, index) => {
      for (const line of order.products ?? []) {
        const id = line.product;
        if (!id) continue;
        const prev = tally.get(id);
        const lastSeen = combined.length - index;
        if (!prev) {
          tally.set(id, {
            id,
            name: line.product_name ?? `Producto #${id}`,
            price: Number(line.unit_price ?? 0) || 0,
            count: 1,
            lastSeen,
          });
        } else {
          prev.count += 1;
          prev.lastSeen = Math.max(prev.lastSeen, lastSeen);
        }
      }
    });

    const ranked = Array.from(tally.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastSeen - a.lastSeen;
    });

    const out: RecentProductPick[] = ranked.slice(0, LIMIT).map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      price: item.price,
    }));

    if (out.length < LIMIT) {
      const used = new Set(out.map((p) => p.id));
      for (const p of fallbackProductsQuery.data?.results ?? []) {
        if (used.has(p.id)) continue;
        out.push({
          id: p.id,
          name: p.name,
          code: p.code,
          price: Number.parseFloat(String(p.sale_price ?? p.price ?? "0")) || 0,
        });
        used.add(p.id);
        if (out.length >= LIMIT) break;
      }
    }

    return out;
  }, [ordersQuery.data, quotationsQuery.data, fallbackProductsQuery.data]);

  const isLoading =
    (ordersQuery.isLoading || quotationsQuery.isLoading) &&
    recentClients.length === 0 &&
    recentProducts.length === 0;

  return { recentClients, recentProducts, isLoading };
}
