"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Clock, Plus, ShoppingBag, User, X, Banknote } from "lucide-react";
import { fetchOrder } from "@/lib/api/orders";
import { useElapsedTime } from "@/lib/hooks/useElapsedTime";
import { formatCLP } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";

type TableItem = YggdraSchemas["Table"];
type Order = YggdraSchemas["Order"];

interface TableOrderDrawerProps {
  table: TableItem;
  isWaiter?: boolean;
  onClose: () => void;
}

export function TableOrderDrawer({ table, isWaiter, onClose }: TableOrderDrawerProps) {
  const router = useRouter();
  const orderId = table.current_order_id || null;

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId as string),
    enabled: Boolean(orderId),
    staleTime: 10_000,
  });

  const elapsed = useElapsedTime(order?.date ?? table.occupied_since, {
    enabled: Boolean(orderId),
  });

  const returnTo = encodeURIComponent("/tables/map");
  const addProductsHref = orderId
    ? `/pos/terminal?order_id=${orderId}${isWaiter ? "&view=waiter" : ""}&return_to=${returnTo}`
    : `/pos/terminal?table_id=${table.id}${isWaiter ? "&view=waiter" : ""}&return_to=${returnTo}`;

  function handleNavigate() {
    onClose();
    router.push(addProductsHref);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 sm:flex-row sm:justify-end"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex h-[80vh] w-full flex-col rounded-t-2xl bg-card shadow-xl sm:h-full sm:max-w-md sm:rounded-none"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Mesa {table.number}</h2>
            <p className="text-xs text-muted-foreground">
              {table.area ? `${table.area} · ` : ""}
              {table.capacity} puestos
              {orderId && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-amber-700">
                  <Clock className="h-3 w-3" /> {elapsed.text}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {order && (
              <span className="text-base font-bold tabular-nums text-emerald-700">
                {formatCLP(order.total_amount ?? 0)}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!orderId ? (
            <div className="grid h-full place-items-center">
              <p className="text-sm text-muted-foreground">
                Esta mesa no tiene una orden activa registrada.
              </p>
            </div>
          ) : isLoading ? (
            <div className="grid h-full place-items-center">
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          ) : error || !order ? (
            <div className="grid h-full place-items-center">
              <p className="text-sm text-muted-foreground">No se pudo cargar la orden.</p>
            </div>
          ) : (
            <OrderDetail order={order} />
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border/60 p-4">
          <button
            type="button"
            onClick={handleNavigate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {orderId ? "Agregar productos" : "Crear pedido"}
          </button>
          {!isWaiter && (
            <>
              {orderId && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/pos/terminal?order_id=${orderId}&return_to=${returnTo}`);
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition-colors hover:bg-emerald-600/90"
                >
                  <Banknote className="h-4 w-4" />
                  Cobrar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/sales?view=open");
                }}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border/60 bg-background text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Ver en Ventas
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function OrderDetail({ order }: { order: Order }) {
  const items = order.products ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            Orden #{order.id.slice(0, 8)}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.date).toLocaleString()}
          </p>
        </div>
        <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700">
          {order.payment_status === "PENDING" ? "Sin pagar" : order.payment_status}
        </span>
      </div>

      {order.client && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate text-sm">{order.client.name}</span>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-border/40">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">
                {item.quantity}× {item.product_name}
              </p>
              {item.notes && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.notes}</p>
              )}
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatCLP(item.final_price ?? item.total_price ?? 0)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-sm font-medium">Total</span>
        <span className="text-lg font-bold tabular-nums">
          {formatCLP(order.total_amount ?? 0)}
        </span>
      </div>
    </div>
  );
}
