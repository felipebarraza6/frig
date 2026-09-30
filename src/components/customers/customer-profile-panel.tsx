"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Pencil,
  Phone,
  Power,
  Receipt,
  ShoppingBag,
  Tag,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-shell";
import { OrderPayModal } from "@/components/sales/order-pay-modal";
import { SupportCreateModal } from "@/components/support/support-create-modal";
import { CustomerCasesTab } from "@/components/customers/customer-cases-tab";
import { CustomerLevantamientosTab } from "@/components/customers/customer-levantamientos-block";
import { CustomerFollowUpsTab } from "@/components/customers/customer-follow-ups-tab";
import { CustomerAvatar } from "@/components/customers/customer-avatar";
import {
  fetchSupportTickets,
  isSupportTicketOpen,
} from "@/lib/api/support";
import {
  fetchCustomer,
  formatRut,
  getCustomerTags,
  updateCustomer,
} from "@/lib/api/customers";
import {
  fetchOrdersByClient,
  fetchPosClientOrders,
  type PosClientOrderRow,
} from "@/lib/api/orders";
import {
  cn,
  formatCLP,
  orderStatusLabel,
  orderTypeLabel,
  paymentStatusLabel,
} from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { statusBadge } from "@/lib/status-styles";
import type { YggdraSchemas } from "@/lib/api/types";

type Customer = YggdraSchemas["Client"] & { photo?: string | null };
type Order = YggdraSchemas["Order"];

function shortDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shortDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function whatsappHref(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}

function orderPaidAmount(order: Order): number {
  const raw = (order as { payments?: unknown }).payments;
  if (!Array.isArray(raw)) return 0;
  return raw.reduce((sum, p) => {
    if (!p || typeof p !== "object") return sum;
    const row = p as { amount?: number | string | null; status?: string | null };
    const status = (row.status ?? "").toUpperCase();
    if (status && status !== "COMPLETED") return sum;
    return sum + (Number(row.amount) || 0);
  }, 0);
}

export function CustomerProfilePanel({
  customerId,
  invoicesEnabled,
  onClose,
  onEdit,
  initialTab,
}: {
  customerId: number;
  invoicesEnabled: boolean;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  initialTab?: string | null;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [payTarget, setPayTarget] = useState<PosClientOrderRow | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [section, setSection] = useState("compras");

  const customerQuery = useQuery({
    queryKey: ["customers", "detail", customerId],
    queryFn: () => fetchCustomer(customerId),
  });

  const ordersQuery = useQuery({
    queryKey: ["customers", "orders", customerId],
    queryFn: () => fetchOrdersByClient(customerId, { page_size: 30 }),
  });

  const pendingQuery = useQuery({
    queryKey: ["customers", "pos-pending", customerId],
    queryFn: () => fetchPosClientOrders(customerId),
  });

  const casesQuery = useQuery({
    queryKey: ["support-tickets", "client", customerId],
    queryFn: () => fetchSupportTickets({ client: customerId, page_size: 50 }),
    staleTime: 30_000,
  });

  // Sección inicial derivada del deep-link ?tab= (ajuste durante render, sin effect).
  const [tabCtx, setTabCtx] = useState(`${customerId}|${initialTab ?? ""}`);
  const tabCtxNow = `${customerId}|${initialTab ?? ""}`;
  if (tabCtx !== tabCtxNow) {
    setTabCtx(tabCtxNow);
    const tab = initialTab ?? "";
    if (tab === "cases" || tab === "casos") setSection("casos");
    else if (tab === "follow-ups" || tab === "seguimientos") setSection("seguimientos");
    else if (tab === "fields" || tab === "levantamientos" || (tab && tab !== "compras")) {
      setSection("levantamientos");
    } else {
      setSection("compras");
    }
  }

  const openCasesCount = (casesQuery.data ?? []).filter((t) =>
    isSupportTicketOpen(t.status),
  ).length;

  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) => updateCustomer(customerId, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: () =>
      toast.error("No se pudo cambiar el estado del cliente"),
  });

  const customer = customerQuery.data;
  const orders = useMemo(() => ordersQuery.data?.results ?? [], [ordersQuery.data?.results]);
  const pending = pendingQuery.data;
  const tags = customer ? getCustomerTags(customer as Customer & { tags?: string[] }) : [];

  const kpis = useMemo(() => {
    const count = ordersQuery.data?.count ?? orders.length;
    const totalHistorical = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const pendingAmount = pending?.summary.total_pending_amount ?? 0;
    const pendingCount = pending?.summary.pending_orders_count ?? 0;
    const lastAt = orders[0]?.created ?? orders[0]?.date ?? null;
    return { count, totalHistorical, pendingAmount, pendingCount, lastAt };
  }, [orders, ordersQuery.data?.count, pending]);

  const wa = whatsappHref(customer?.phone_number);

  if (customerQuery.isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (customerQuery.error || !customer) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <UserCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">No se pudo cargar el cliente</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const dataRows: Array<{ label: string; value: string }> = [
    { label: "Código", value: customer.client_code || "—" },
    ...(invoicesEnabled
      ? [{ label: "RUT", value: customer.dni ? formatRut(customer.dni) : "—" }]
      : []),
    { label: "Teléfono", value: customer.phone_number || "—" },
    { label: "Email", value: customer.email || "—" },
    { label: "Giro", value: customer.commercial_business || "—" },
    { label: "Dirección", value: customer.address || "—" },
    {
      label: "Receptor",
      value:
        (customer as { receiver_type?: string | null }).receiver_type === "EMPRESA"
          ? "Empresa"
          : "Persona",
    },
  ];
  if (invoicesEnabled) {
    dataRows.push({
      label: "Documento",
      value:
        (customer as { default_document_type?: string | null }).default_document_type === "FACTURA"
          ? "Factura"
          : "Boleta",
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        icon={
          <button
            type="button"
            onClick={onClose}
            aria-label="Volver al listado"
            className="text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        }
        title={customer.name}
        badge={
          <button
            type="button"
            onClick={() => toggleActive.mutate(!customer.is_active)}
            disabled={toggleActive.isPending}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              customer.is_active
                ? "bg-success/10 text-success hover:bg-success/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            <Power className="h-3 w-3" />
            {customer.is_active ? "Activo" : "Inactivo"}
          </button>
        }
        subtitle={
          customer.created
            ? `Cliente desde ${shortDate(customer.created)}`
            : "Ficha del cliente"
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => onEdit(customer)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <Phone className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            ) : null}
            {kpis.pendingCount > 0 ? (
              <Button
                size="sm"
                onClick={() => {
                  const first = pending?.orders?.[0];
                  if (first) setPayTarget(first);
                }}
              >
                <Banknote className="h-3.5 w-3.5" />
                Cobrar
              </Button>
            ) : null}
          </>
        }
      />

      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            variant="compact"
            label="Pedidos"
            value={String(kpis.count)}
            icon={ShoppingBag}
            tone="primary"
          />
          <StatCard
            variant="compact"
            label="Histórico"
            value={formatCLP(kpis.totalHistorical)}
            icon={Receipt}
            tone="muted"
          />
          <StatCard
            variant="compact"
            label="Por cobrar"
            value={formatCLP(kpis.pendingAmount)}
            sub={kpis.pendingCount > 0 ? `${kpis.pendingCount} pendientes` : "Al día"}
            icon={Banknote}
            tone={kpis.pendingAmount > 0 ? "warning" : "muted"}
          />
          <StatCard
            variant="compact"
            label="Última visita"
            value={kpis.lastAt ? shortDate(kpis.lastAt) : "—"}
            icon={CalendarDays}
            tone="muted"
          />
        </div>
        <div className="mt-3 flex items-start gap-3">
          <CustomerAvatar
            name={customer.name ?? ""}
            photo={(customer as Record<string, unknown>).photo as string | undefined}
            className="h-16 w-16 rounded-2xl text-lg"
          />
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
          {dataRows.map((row) => {
            const isRut = row.label === "RUT";
            const wide = row.label === "Email" || row.label === "Dirección";
            return (
              <div
                key={row.label}
                className={cn(
                  "min-w-0 rounded-xl border border-border bg-card px-3 py-2",
                  wide && "col-span-2",
                )}
              >
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd
                  className={cn(
                    "mt-0.5 text-sm font-medium",
                    isRut
                      ? "whitespace-nowrap font-mono text-xs tabular-nums"
                      : "truncate",
                  )}
                >
                  {row.value}
                </dd>
              </div>
            );
          })}
          </dl>
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
              >
                <Tag className="h-3 w-3" />
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 sm:px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ProfileTabButton active={section === "compras"} onClick={() => setSection("compras")}>
          Compras
        </ProfileTabButton>
        <ProfileTabButton
          active={section === "seguimientos"}
          onClick={() => setSection("seguimientos")}
        >
          Seguimientos
        </ProfileTabButton>
        <ProfileTabButton
          active={section === "levantamientos"}
          onClick={() => setSection("levantamientos")}
        >
          Levantamientos
        </ProfileTabButton>
        <ProfileTabButton active={section === "casos"} onClick={() => setSection("casos")}>
          Casos
          {openCasesCount > 0 ? (
            <span className="ml-1.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
              {openCasesCount}
            </span>
          ) : null}
        </ProfileTabButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageBody>
          {section === "compras" && (
            <section className="flex min-w-0 flex-col gap-4">
              {(pending?.orders.length ?? 0) > 0 && (
                <PendingTab
                  loading={pendingQuery.isLoading}
                  orders={pending?.orders ?? []}
                  summary={pending?.summary}
                  onPay={setPayTarget}
                />
              )}
              <div>
                <h2 className="mb-3 text-sm font-semibold">Compras</h2>
                <ActivityTab
                  loading={ordersQuery.isLoading}
                  orders={orders}
                  empty={!ordersQuery.isLoading && orders.length === 0}
                  onPayPending={(order) => {
                    const match = (pending?.orders ?? []).find((p) => p.id === order.id);
                    if (match) {
                      setPayTarget(match);
                      return;
                    }
                    if (order.payment_status === "PENDING" || order.payment_status === "PARTIAL") {
                      setPayTarget({
                        id: order.id,
                        total_amount: Number(order.total_amount) || 0,
                        paid_amount: orderPaidAmount(order),
                        remaining_amount: Math.max(
                          0,
                          (Number(order.total_amount) || 0) - orderPaidAmount(order),
                        ),
                        status: order.status ?? "PENDING",
                        payment_status: order.payment_status ?? "PENDING",
                        date: order.created || order.date || "",
                        order_kind: orderTypeLabel(order.order_type),
                      });
                    }
                  }}
                />
              </div>
            </section>
          )}

          {section === "seguimientos" && (
            <CustomerFollowUpsTab
              clientId={customerId}
              clientName={customer.name ?? "Cliente"}
              suggestDebtCall={kpis.pendingAmount > 0}
            />
          )}

          {section === "levantamientos" && (
            <CustomerLevantamientosTab
              customerId={customerId}
              customerName={customer.name ?? "Cliente"}
              customerPhone={customer.phone_number}
            />
          )}

          {section === "casos" && (
            <CustomerCasesTab
              customerId={customerId}
              onCreateClaim={() => setClaimOpen(true)}
            />
          )}
        </PageBody>
      </div>

      {payTarget && (
        <OrderPayModal
          open={Boolean(payTarget)}
          onClose={() => {
            setPayTarget(null);
            queryClient.invalidateQueries({ queryKey: ["customers", "pos-pending", customerId] });
            queryClient.invalidateQueries({ queryKey: ["customers", "orders", customerId] });
          }}
          orderId={payTarget.id}
          orderLabel={payTarget.order_kind || "Pedido"}
          total={Number(payTarget.total_amount) || 0}
          paid={Number(payTarget.paid_amount) || 0}
        />
      )}

      <SupportCreateModal
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        initialKind="claim"
        initialClientId={customerId}
        initialClientName={customer.name}
        onCreated={() => {
          queryClient.invalidateQueries({
            queryKey: ["support-tickets", "client", customerId],
          });
        }}
      />
    </div>
  );
}


function ProfileTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative shrink-0 px-3 pb-2.5 pt-2 text-sm font-medium transition-colors",
        active
          ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ActivityTab({
  loading,
  orders,
  empty,
  onPayPending,
}: {
  loading: boolean;
  orders: Order[];
  empty: boolean;
  onPayPending: (order: Order) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border px-4 py-10 text-center">
        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Sin compras registradas</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Cuando este cliente tenga ventas u órdenes asociadas, aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3">Pedido</th>
            <th className="px-3 py-3">Fecha</th>
            <th className="px-3 py-3">Estado</th>
            <th className="px-3 py-3">Pago</th>
            <th className="px-3 py-3 text-right">Total</th>
            <th className="w-24 px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const canPay =
              order.payment_status === "PENDING" || order.payment_status === "PARTIAL";
            return (
              <tr key={order.id} className="border-b border-border last:border-0">
                <td className="px-3 py-3">
                  <p className="font-medium">{order.order_number || order.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{orderTypeLabel(order.order_type)}</p>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {shortDateTime(order.created || order.date)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      statusBadge(order.status),
                    )}
                  >
                    {orderStatusLabel(order.status)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      statusBadge(order.payment_status),
                    )}
                  >
                    {paymentStatusLabel(order.payment_status)}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {formatCLP(order.total_amount ?? 0)}
                </td>
                <td className="px-2 py-3 text-right">
                  {canPay ? (
                    <Button size="sm" variant="outline" className="h-7" onClick={() => onPayPending(order)}>
                      Cobrar
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PendingTab({
  loading,
  orders,
  summary,
  onPay,
}: {
  loading: boolean;
  orders: PosClientOrderRow[];
  summary?: { total_pending_amount: number; pending_orders_count: number };
  onPay: (order: PosClientOrderRow) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border px-4 py-10 text-center">
        <Banknote className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Sin montos por cobrar</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Este cliente no tiene órdenes pendientes o parciales.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {summary && (
        <div className="glass rounded-2xl p-3">
          <p className="text-xs text-muted-foreground">Total por cobrar</p>
          <p className="text-lg font-semibold tabular-nums text-warning">
            {formatCLP(summary.total_pending_amount)}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary.pending_orders_count} orden
            {summary.pending_orders_count === 1 ? "" : "es"}
          </p>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {orders.map((order) => (
          <li
            key={order.id}
            className="glass flex flex-col gap-2 rounded-2xl p-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {order.order_kind || "Pedido"} · {shortDateTime(order.date)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCLP(order.total_amount)} · pagado {formatCLP(order.paid_amount)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    statusBadge(order.payment_status),
                  )}
                >
                  {paymentStatusLabel(order.payment_status)}
                </span>
                {(order.products ?? []).slice(0, 2).map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {p.quantity}× {p.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
              <p className="text-sm font-semibold tabular-nums text-warning">
                {formatCLP(order.remaining_amount)}
              </p>
              <Button size="sm" onClick={() => onPay(order)}>
                Cobrar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
