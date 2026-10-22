"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { fetchOrders } from "@/lib/api/orders";
import { formatCLP } from "@/lib/utils";
import { pickStaleOrders, yesterdayLocal } from "@/lib/stale-orders";

/**
 * Aviso en POS: cuentas que siguen abiertas (PENDING) de días anteriores.
 * Igual que el aviso de cajas antiguas: muestra cada una con su acceso
 * para cobrarla o anularla desde la terminal.
 */
export function StaleOrdersBanner() {
  const { data } = useQuery({
    queryKey: ["pos", "stale-pending-orders"],
    queryFn: () =>
      fetchOrders({ status: "PENDING", end_date: yesterdayLocal(), ordering: "date", page_size: 50 }),
    staleTime: 60_000,
  });
  const orders = pickStaleOrders(data?.results ?? []);
  if (orders.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" />
        Tienes {orders.length} {orders.length === 1 ? "cuenta abierta" : "cuentas abiertas"} de días anteriores
      </div>
      <p className="mb-3 text-sm">Cóbralas o anúlalas para que no queden pendientes en caja ni en mesas.</p>
      <ul className="space-y-1 text-sm">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {o.order_number ?? String(o.id).slice(0, 8)} ·{" "}
              {o.date ? new Date(o.date).toLocaleDateString("es-CL") : ""} ·{" "}
              {formatCLP(Number(o.total_amount ?? 0))}
            </span>
            <Link
              className="font-medium underline"
              href={`/pos/terminal?order_id=${o.id}&return_to=${encodeURIComponent("/pos")}`}
            >
              Abrir
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
