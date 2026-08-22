"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOrders, type OrdersFilter } from "@/lib/api/orders";
import { fetchCustomers, type CustomersFilter } from "@/lib/api/customers";
import { formatCLP } from "@/lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";

type Order = import("@/lib/api/types").YggdraSchemas["Order"];
type Client = import("@/lib/api/types").YggdraSchemas["Client"];

function getOrderDisplayId(order: Order): string {
  const raw = order as unknown as { order_number?: string };
  return raw.order_number ?? order.id.slice(0, 8);
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function orderProductsLabel(order: Order): string {
  const products = order.products ?? [];
  if (products.length === 0) return "Sin productos";
  const first = products[0];
  const rest = products.length - 1;
  const qty = first.quantity ?? 0;
  const label = `${qty} x ${first.product_name}`;
  return rest > 0 ? `${label} +${rest}` : label;
}

export function OrdersMetricDetail({
  filter,
  emptyMessage,
}: {
  filter: OrdersFilter;
  emptyMessage: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "metric-orders", filter],
    queryFn: () => fetchOrders({ ...filter, page_size: 50 }),
    enabled: !!filter.start_date && !!filter.end_date,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 py-4 text-sm text-amber-700">
        <AlertTriangle className="h-4 w-4" />
        No se pudo cargar el detalle.
      </div>
    );
  }

  const orders = data?.results ?? [];
  if (orders.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex flex-col gap-1 border-b border-border py-2.5 last:border-0"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="min-w-0 truncate font-medium">
              #{getOrderDisplayId(order)}
            </span>
            <span className="shrink-0 tabular-nums font-semibold">
              {formatCLP(Number(order.total_amount ?? 0))}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDateTime(order.date)}</span>
            <span className="truncate">
              {order.client?.name ?? "Sin cliente"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {orderProductsLabel(order)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CustomersMetricDetail({
  filter,
  emptyMessage,
}: {
  filter: CustomersFilter;
  emptyMessage: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "metric-customers", filter],
    queryFn: () => fetchCustomers({ ...filter }),
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 py-4 text-sm text-amber-700">
        <AlertTriangle className="h-4 w-4" />
        No se pudo cargar el detalle.
      </div>
    );
  }

  const clients = data?.results ?? [];
  if (clients.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col">
      {clients.map((client) => (
        <div
          key={client.id}
          className="flex flex-col gap-1 border-b border-border py-2.5 last:border-0"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="min-w-0 truncate font-medium">{client.name}</span>
            {client.dni && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {client.dni}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{client.phone_number ?? "Sin teléfono"}</span>
            <span>{shortDate(client.created)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
