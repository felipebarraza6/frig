"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOrders, type OrdersFilter } from "@/lib/api/orders";
import { fetchCustomers, type CustomersFilter } from "@/lib/api/customers";
import { formatCLP } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Order = import("@/lib/api/types").YggdraSchemas["Order"];

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

function OrdersList({ orders, emptyMessage }: { orders: Order[]; emptyMessage: string }) {
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
      <div className="flex items-center justify-center py-8">
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-warning/30 bg-warning/10 py-4 text-sm text-warning">
        <AlertTriangle className="h-4 w-4" />
        No se pudo cargar el detalle.
      </div>
    );
  }

  return <OrdersList orders={data?.results ?? []} emptyMessage={emptyMessage} />;
}

export function IncomeMetricDetail({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const salesQuery = useQuery({
    queryKey: ["dashboard", "metric-income", "sales", startDate, endDate],
    queryFn: () =>
      fetchOrders({
        start_date: startDate,
        end_date: endDate,
        order_type: "SALE",
        status: "COMPLETED",
        page_size: 50,
      }),
    enabled: !!startDate && !!endDate,
  });

  const ordersQuery = useQuery({
    queryKey: ["dashboard", "metric-income", "orders", startDate, endDate],
    queryFn: () =>
      fetchOrders({
        start_date: startDate,
        end_date: endDate,
        order_type: "ORDER",
        status: "COMPLETED",
        page_size: 50,
      }),
    enabled: !!startDate && !!endDate,
  });

  const isLoading = salesQuery.isLoading || ordersQuery.isLoading;
  const error = salesQuery.error || ordersQuery.error;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-warning/30 bg-warning/10 py-4 text-sm text-warning">
        <AlertTriangle className="h-4 w-4" />
        No se pudo cargar el detalle.
      </div>
    );
  }

  const allOrders = [...(salesQuery.data?.results ?? []), ...(ordersQuery.data?.results ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <OrdersList
      orders={allOrders}
      emptyMessage="No hay ventas ni pedidos completados en el período seleccionado."
    />
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
      <div className="flex items-center justify-center py-8">
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-warning/30 bg-warning/10 py-4 text-sm text-warning">
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

const PRODUCTS_PREVIEW = 40;

export function ProductsMetricDetail({
  products,
  emptyMessage = "No hay productos en el catálogo.",
}: {
  products: import("@/lib/api/types").PosProduct[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const preview = products.slice(0, PRODUCTS_PREVIEW);
  const rest = products.length - preview.length;

  return (
    <div className="flex flex-col">
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        Listado rápido · {products.length} producto{products.length === 1 ? "" : "s"}
      </p>
      {preview.map((product) => (
        <div
          key={product.id}
          className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {product.categoryName ?? "Sin categoría"}
              {product.code ? ` · ${product.code}` : ""}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatCLP(product.price)}
          </span>
        </div>
      ))}
      {rest > 0 && (
        <p className="pt-2 text-xs text-muted-foreground">
          +{rest} más en el catálogo
        </p>
      )}
    </div>
  );
}
