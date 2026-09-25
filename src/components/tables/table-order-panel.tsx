"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Clock, Plus, ShoppingBag, User, X, Banknote } from "lucide-react";
import { fetchOrder } from "@/lib/api/orders";
import { useElapsedTime } from "@/lib/hooks/useElapsedTime";
import { cn, formatCLP } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";

type TableItem = YggdraSchemas["Table"];
type Order = YggdraSchemas["Order"];

interface TableOrderPanelProps {
  table: TableItem;
  isWaiter?: boolean;
  onClose: () => void;
  className?: string;
}

/** Panel de pedido dentro del mapa 3D (glass), sin drawer a pantalla completa. */
export function TableOrderPanel({
  table,
  isWaiter,
  onClose,
  className,
}: TableOrderPanelProps) {
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

  return (
    <aside
      className={cn(
        "flex w-[min(100%,20rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl",
        className,
      )}
      role="dialog"
      aria-label={`Mesa ${table.number}`}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/20 px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Mesa {table.number}</h2>
          <p className="text-[11px] text-muted-foreground">
            {table.area ? `${table.area} · ` : ""}
            {table.capacity} puestos
            {orderId && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-warning">
                <Clock className="h-3 w-3" /> {elapsed.text}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {order && (
            <span className="text-sm font-bold tabular-nums text-success">
              {formatCLP(order.total_amount ?? 0)}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/40 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!orderId ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin orden activa. Crea un pedido para esta mesa.
          </p>
        ) : isLoading ? (
          <div className="grid place-items-center py-10">
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        ) : error || !order ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No se pudo cargar la orden.
          </p>
        ) : (
          <OrderDetail order={order} />
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-white/20 p-3">
        <button
          type="button"
          onClick={() => {
            onClose();
            router.push(addProductsHref);
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {orderId ? "Agregar productos" : "Crear pedido"}
        </button>
        {!isWaiter && orderId && (
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/pos/terminal?order_id=${orderId}&return_to=${returnTo}`);
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-success text-sm font-semibold text-white transition-colors hover:bg-success/90"
          >
            <Banknote className="h-4 w-4" />
            Cobrar
          </button>
        )}
        {!isWaiter && (
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/sales?view=open");
            }}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg text-xs font-medium text-foreground/80 transition-colors hover:bg-white/40"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Ver en Ventas
          </button>
        )}
      </div>
    </aside>
  );
}

function OrderDetail({ order }: { order: Order }) {
  const items = order.products ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">Orden #{order.id.slice(0, 8)}</p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(order.date).toLocaleString()}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
          {order.payment_status === "PENDING" ? "Sin pagar" : order.payment_status}
        </span>
      </div>

      {order.client && (
        <div className="flex items-center gap-2 rounded-lg bg-white/40 px-2.5 py-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate text-xs">{order.client.name}</span>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-border/30">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium leading-tight">
                {item.quantity}× {item.product_name}
              </p>
              {item.notes && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">{item.notes}</p>
              )}
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums">
              {formatCLP(item.final_price ?? item.total_price ?? 0)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-border/40 pt-2">
        <span className="text-xs font-medium">Total</span>
        <span className="text-base font-bold tabular-nums">
          {formatCLP(order.total_amount ?? 0)}
        </span>
      </div>
    </div>
  );
}
