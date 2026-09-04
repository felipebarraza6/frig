"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ShoppingBag, X, Eye, Ban, Plus, FileDown, ClipboardList, Receipt, FileText, SlidersHorizontal, Zap, CalendarDays, Wallet, Clock, UtensilsCrossed, Store, Package, MoreHorizontal, LayoutGrid, List, HandHelping, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import {
  fetchOrders,
  cancelOrder,
  deliverOrder,
  downloadOrderThermalPdf,
  downloadOrderTicketPdf,
  downloadOrderA4Pdf,
  generateOrdersExcel,
  createOrder,
  fetchInstallments,
  createInstallments,
  type OrdersFilter,
  type InstallmentInput,
  type PaymentInstallment,
} from "@/lib/api/orders";
import { fetchTables } from "@/lib/api/tables";
import { searchCustomers, createCustomer } from "@/lib/api/customers";
import { formatCLP, cn } from "@/lib/utils";
import {
  useIsCashier,
  useSessionStore,
  useCurrentBranchRole,
  useCurrentBranch,
  canCancelOrder,
  useCanViewTables,
  useIsModuleEnabledFromConfig,
} from "@/lib/store/session";

import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { useToast } from "@/lib/store/toast";
import type { YggdraSchemas } from "@/lib/api/types";
import { AnimatePresence, motion } from "framer-motion";

type PaymentBrief = {
  id: string;
  amount: string;
  status?: string;
  status_display?: string;
  payment_method_name?: string;
  payment_date?: string;
  reference?: string | null;
  notes?: string | null;
};
type OrderProduct = YggdraSchemas["OrderProduct"] & {
  id: string;
  product_name?: string | null;
  quantity?: number;
  actual_quantity?: number;
};
type Order = YggdraSchemas["Order"] & {
  order_number?: string | null;
  delivery_status?: string | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
  installments?: PaymentInstallment[];
  payments?: PaymentBrief[];
  products?: OrderProduct[];
};
type TableItem = YggdraSchemas["Table"];
type ClientOption = { id: number; name: string; email?: string | null };

function useClientSearchParam(key: string): string | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(key);
  }, [key]);
}

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendiente" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "PAID", label: "Pagada" },
  { value: "REFUNDED", label: "Reembolsada" },
];

const ORDER_TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "SALE", label: "Venta" },
  { value: "ORDER", label: "Orden" },
];

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthStartStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

function monthEndStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(lastDay)}`;
}

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

function orderTypeLabel(value?: string | null): string {
  return ORDER_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

type QuickFilter = "ALL" | "PENDING" | "OPEN_ACCOUNTS" | "POR_DELIVER" | "DELIVERED" | "PAID" | "CANCELLED";

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Por pagar" },
  { value: "OPEN_ACCOUNTS", label: "Cuentas abiertas" },
  { value: "POR_DELIVER", label: "Por entregar" },
  { value: "DELIVERED", label: "Entregados" },
  { value: "PAID", label: "Cobradas" },
  { value: "CANCELLED", label: "Anuladas" },
];

const STAT_TONES = {
  primary: "from-primary/15 to-primary/5 text-primary",
  amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
  blue: "from-primary/15 to-primary/5 text-primary",
  emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: keyof typeof STAT_TONES;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-left shadow-sm transition-colors",
        onClick && "hover:border-primary/50 hover:bg-muted/30",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
          STAT_TONES[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-xl font-bold tabular-nums">{value}</p>
      </div>
    </button>
  );
}

function getDisplayStatus(order: Order): { label: string; tone: "emerald" | "blue" | "amber" | "danger" | "purple" } {
  const activeInstallments = order.installments?.filter((i) => i.status !== "CANCELLED") ?? [];
  const hasInstallments = activeInstallments.length > 0;
  const allPaid = hasInstallments && activeInstallments.every((i) => i.status === "PAID");

  if (order.status === "CANCELLED") return { label: "Cancelada", tone: "danger" };
  if (hasInstallments && !allPaid) return { label: "En cuotas", tone: "purple" };
  if (order.payment_status === "PAID" && order.delivery_status === "DELIVERED")
    return { label: "Completada", tone: "emerald" };
  if (order.payment_status === "PAID") return { label: "Por entregar", tone: "blue" };
  if (order.delivery_status === "DELIVERED") return { label: "Por cobrar", tone: "blue" };
  return { label: statusLabel(order.status), tone: "amber" };
}

function StatusBadge({ order }: { order: Order }) {
  const { label, tone } = getDisplayStatus(order);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
        tone === "emerald"
          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20"
          : tone === "blue"
            ? "bg-primary/10 text-primary ring-primary/20"
            : tone === "purple"
              ? "bg-primary/10 text-primary ring-primary/20"
              : tone === "danger"
                ? "bg-danger/10 text-danger ring-danger/20"
                : "bg-amber-500/10 text-amber-700 ring-amber-500/20",
      )}
    >
      {label}
    </span>
  );
}

function orderTypeMeta(order: Order) {
  if (order.order_type === "ORDER") {
    return {
      label: "Orden",
      icon: ClipboardList,
      bg: "bg-primary/10 text-primary",
    };
  }
  return {
    label: "Venta",
    icon: order.delivery_status === "DELIVERED" ? HandHelping : Store,
    bg: "bg-primary/10 text-primary",
  };
}

type OrderCardProps = {
  order: Order;
  index: number;
  showTables: boolean;
  tableById: Map<number, TableItem>;
  canCancel: boolean;
  isDownloading: boolean;
  deliverPending: boolean;
  cancelPending: boolean;
  onView: (order: Order) => void;
  onTicket: (order: Order) => void;
  onDeliver: (order: Order) => void;
  onInstallments: (order: Order) => void;
  onThermal: (order: Order) => void;
  onA4: (order: Order) => void;
  onCancel: (order: Order) => void;
};

function ActionMenuItem({
  icon: Icon,
  label,
  tone,
  onClick,
  disabled,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone?: "blue" | "amber" | "purple" | "danger" | "default";
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const toneClasses = {
    default: "text-foreground",
    blue: "text-primary",
    amber: "text-amber-600",
    purple: "text-primary",
    danger: "text-danger",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 sm:px-3 sm:py-2 sm:text-xs",
        toneClasses[tone ?? "default"],
        className,
      )}
    >
      <Icon className="h-5 w-5 shrink-0 sm:h-3.5 sm:w-3.5" />
      <span>{label}</span>
    </button>
  );
}

function OrderListRow({
  order,
  canCancel,
  isDownloading,
  deliverPending,
  cancelPending,
  onView,
  onTicket,
  onDeliver,
  onInstallments,
  onThermal,
  onA4,
  onCancel,
}: Omit<OrderCardProps, "index" | "showTables" | "tableById">) {
  const branch = useCurrentBranch();
  const shortDate = new Date(order.date).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeMeta = orderTypeMeta(order);
  const TypeIcon = typeMeta.icon;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/30 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", typeMeta.bg)}>
          <TypeIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold tabular-nums">
              {order.order_number ?? order.id.slice(0, 8)}
            </p>
            <StatusBadge order={order} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {typeMeta.label} · {shortDate}
            {order.client?.name ? ` · ${order.client.name}` : " · Sin cliente"}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 text-primary" />
            {order.delivery_address
              ? `Delivery · ${order.delivery_address}`
              : `Retiro en tienda · ${branch?.address ?? "Pickup"}`}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <p className="shrink-0 text-base font-extrabold tabular-nums">
          {formatCLP(order.total_amount ?? "0")}
        </p>
        <div className="flex items-center gap-2">
          {order.order_type === "ORDER" && (order.installments?.length ?? 0) > 0 && order.payment_status !== "PAID" && order.status !== "CANCELLED" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-primary/30 text-primary hover:bg-primary/5"
              onClick={() => onInstallments(order)}
            >
              <CalendarDays className="mr-1 h-3.5 w-3.5" />
              Gestionar cuotas
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="h-8" onClick={() => onView(order)}>
            <Eye className="mr-1 h-3.5 w-3.5" />
            Ver
          </Button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Más acciones"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
                >
                  <div className="flex flex-col py-1">
                    <ActionMenuItem
                      icon={ClipboardList}
                      label="Orden de elaboración"
                      onClick={() => {
                        onTicket(order);
                        setMenuOpen(false);
                      }}
                    />
                    {order.delivery_status !== "DELIVERED" && order.status !== "CANCELLED" && (
                      <ActionMenuItem
                        icon={Zap}
                        label="Marcar entregada"
                        tone="blue"
                        onClick={() => {
                          onDeliver(order);
                          setMenuOpen(false);
                        }}
                        disabled={deliverPending}
                      />
                    )}
                    {order.order_type === "ORDER" && order.status !== "CANCELLED" && order.payment_status !== "PAID" && (
                      <ActionMenuItem
                        icon={CalendarDays}
                        label="Gestionar cuotas"
                        tone="purple"
                        onClick={() => {
                          onInstallments(order);
                          setMenuOpen(false);
                        }}
                      />
                    )}
                    {order.payment_status === "PAID" && (
                      <>
                        <ActionMenuItem
                          icon={Receipt}
                          label="Boleta 80 mm"
                          onClick={() => {
                            onThermal(order);
                            setMenuOpen(false);
                          }}
                          disabled={isDownloading}
                        />
                        <ActionMenuItem
                          icon={FileText}
                          label="Boleta A4"
                          onClick={() => {
                            onA4(order);
                            setMenuOpen(false);
                          }}
                          disabled={isDownloading}
                        />
                      </>
                    )}
                    {order.status !== "CANCELLED" && canCancel && (
                      <>
                        <div className="my-1 h-px bg-border" />
                        <ActionMenuItem
                          icon={Ban}
                          label="Anular"
                          tone="danger"
                          onClick={() => {
                            onCancel(order);
                            setMenuOpen(false);
                          }}
                          disabled={cancelPending}
                        />
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  index,
  showTables,
  tableById,
  canCancel,
  isDownloading,
  deliverPending,
  cancelPending,
  onView,
  onTicket,
  onDeliver,
  onInstallments,
  onThermal,
  onA4,
  onCancel,
}: OrderCardProps) {
  const branch = useCurrentBranch();
  const shortDate = new Date(order.date).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeMeta = orderTypeMeta(order);
  const TypeIcon = typeMeta.icon;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.03, duration: 0.25 }}
      className="group flex flex-col rounded-2xl border border-border bg-muted/30 p-4 shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-lg hover:shadow-primary/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors group-hover:opacity-90",
              typeMeta.bg,
            )}
          >
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">
              {order.order_number ?? order.id.slice(0, 8)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {typeMeta.label} · {shortDate}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-lg font-extrabold tabular-nums tracking-tight">
          {formatCLP(order.total_amount ?? "0")}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge order={order} />
        {showTables && order.table && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-inset ring-primary/20">
            <UtensilsCrossed className="h-3 w-3" />
            Mesa {tableById.get(order.table)?.number ?? order.table}
          </span>
        )}
      </div>

      <p className="mt-3 truncate text-xs text-muted-foreground">
        {order.client?.name ?? "Sin cliente"}
      </p>
      <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0 text-primary" />
        {order.delivery_address
          ? `Delivery · ${order.delivery_address}`
          : `Retiro en tienda · ${branch?.address ?? "Pickup"}`}
      </p>

      {order.order_type === "ORDER" && order.installments && order.installments.length > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/40 px-2 py-1.5 text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Cuotas
          </span>
          <span className="font-semibold tabular-nums">
            {order.installments.filter((i) => i.status === "PAID").length}/
            {order.installments.length} pagadas
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-1 items-end justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-1 items-center gap-2">
          {order.order_type === "ORDER" && (order.installments?.length ?? 0) > 0 && order.payment_status !== "PAID" && order.status !== "CANCELLED" ? (
            <button
              type="button"
              onClick={() => onInstallments(order)}
              className="inline-flex h-11 min-h-[44px] items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary/10 sm:h-9"
            >
              <CalendarDays className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              Gestionar cuotas
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onView(order)}
            className="inline-flex h-11 min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted sm:h-9"
          >
            <Eye className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            Ver
          </button>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Más acciones"
            aria-expanded={menuOpen}
            className="flex h-11 min-h-[44px] w-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
          >
            <MoreHorizontal className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>

          {/* Dropdown desktop */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full right-0 z-20 mb-2 hidden w-48 overflow-hidden rounded-xl border border-border bg-card shadow-lg sm:block"
              >
                <div className="flex flex-col py-1">
                  <ActionMenuItem
                    icon={ClipboardList}
                    label="Orden de elaboración"
                    onClick={() => {
                      onTicket(order);
                      setMenuOpen(false);
                    }}
                  />
                  {order.delivery_status !== "DELIVERED" && order.status !== "CANCELLED" && (
                    <ActionMenuItem
                      icon={Zap}
                      label="Marcar entregada"
                      tone="blue"
                      onClick={() => {
                        onDeliver(order);
                        setMenuOpen(false);
                      }}
                      disabled={deliverPending}
                    />
                  )}
                  {order.order_type === "ORDER" && order.status !== "CANCELLED" && order.payment_status !== "PAID" && (
                    <ActionMenuItem
                      icon={CalendarDays}
                      label="Gestionar cuotas"
                      tone="purple"
                      onClick={() => {
                        onInstallments(order);
                        setMenuOpen(false);
                      }}
                    />
                  )}
                  {order.payment_status === "PAID" && (
                    <>
                      <ActionMenuItem
                        icon={Receipt}
                        label="Boleta 80 mm"
                        onClick={() => {
                          onThermal(order);
                          setMenuOpen(false);
                        }}
                        disabled={isDownloading}
                      />
                      <ActionMenuItem
                        icon={FileText}
                        label="Boleta A4"
                        onClick={() => {
                          onA4(order);
                          setMenuOpen(false);
                        }}
                        disabled={isDownloading}
                      />
                    </>
                  )}
                  {order.status !== "CANCELLED" && canCancel && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <ActionMenuItem
                        icon={Ban}
                        label="Anular"
                        tone="danger"
                        onClick={() => {
                          onCancel(order);
                          setMenuOpen(false);
                        }}
                        disabled={cancelPending}
                      />
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Drawer móvil de acciones */}
      <AnimatePresence>
        {menuOpen && (
          <div
            className="fixed inset-0 z-50 flex sm:hidden"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMenuOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative mt-auto flex w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Acciones</h3>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Cerrar"
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex max-h-[70vh] flex-col overflow-y-auto py-2">
                <ActionMenuItem
                  icon={ClipboardList}
                  label="Orden de elaboración"
                  onClick={() => {
                    onTicket(order);
                    setMenuOpen(false);
                  }}
                />
                {order.delivery_status !== "DELIVERED" && order.status !== "CANCELLED" && (
                  <ActionMenuItem
                    icon={Zap}
                    label="Marcar entregada"
                    tone="blue"
                    onClick={() => {
                      onDeliver(order);
                      setMenuOpen(false);
                    }}
                    disabled={deliverPending}
                  />
                )}
                {order.order_type === "ORDER" && order.status !== "CANCELLED" && order.payment_status !== "PAID" && (
                  <ActionMenuItem
                    icon={CalendarDays}
                    label="Gestionar cuotas"
                    tone="purple"
                    onClick={() => {
                      onInstallments(order);
                      setMenuOpen(false);
                    }}
                  />
                )}
                {order.payment_status === "PAID" && (
                  <>
                    <ActionMenuItem
                      icon={Receipt}
                      label="Boleta 80 mm"
                      onClick={() => {
                        onThermal(order);
                        setMenuOpen(false);
                      }}
                      disabled={isDownloading}
                    />
                    <ActionMenuItem
                      icon={FileText}
                      label="Boleta A4"
                      onClick={() => {
                        onA4(order);
                        setMenuOpen(false);
                      }}
                      disabled={isDownloading}
                    />
                  </>
                )}
                {order.status !== "CANCELLED" && canCancel && (
                  <>
                    <div className="my-1 h-px bg-border" />
                    <ActionMenuItem
                      icon={Ban}
                      label="Anular"
                      tone="danger"
                      onClick={() => {
                        onCancel(order);
                        setMenuOpen(false);
                      }}
                      disabled={cancelPending}
                    />
                  </>
                )}
              </div>
              <div className="border-t border-border p-4">
                <Button variant="outline" className="w-full" onClick={() => setMenuOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SalesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const branch = useCurrentBranch();
  const theme = useSessionStore((s) => s.theme);
  const isCashier = useIsCashier();
  const user = useSessionStore((s) => s.user);
  const currentRole = useCurrentBranchRole();
  const canCancel = (ownerId?: string | number) => canCancelOrder(user, currentRole, ownerId);
  const canViewTables = useCanViewTables();
  const tablesEnabled = useIsModuleEnabledFromConfig("tables");
  const showTables = canViewTables && tablesEnabled;
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const openView = useClientSearchParam("view") === "open";

  // Persistencia de vista y filtros en localStorage
  const [viewMode, setViewMode] = useState<"cards" | "list">(() => {
    if (typeof window === "undefined") return "cards";
    return (window.localStorage.getItem("frig.sales.viewMode") as "cards" | "list") || "cards";
  });
  const [search, setSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("frig.sales.search") || "";
  });
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [status, setStatus] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("frig.sales.status") || "";
  });
  const [paymentStatus, setPaymentStatus] = useState(() => {
    if (typeof window === "undefined") return openView ? "PENDING" : "";
    return window.localStorage.getItem("frig.sales.paymentStatus") || (openView ? "PENDING" : "");
  });
  const [orderType, setOrderType] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("frig.sales.orderType") || "";
  });
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(() => {
    if (typeof window === "undefined") return "ALL";
    return (window.localStorage.getItem("frig.sales.quickFilter") as QuickFilter) || "ALL";
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    if (typeof window === "undefined") return monthStartStr();
    return window.localStorage.getItem("frig.sales.startDate") || monthStartStr();
  });
  const [endDate, setEndDate] = useState(() => {
    if (typeof window === "undefined") return monthEndStr();
    return window.localStorage.getItem("frig.sales.endDate") || monthEndStr();
  });
  const [clientFilterId, setClientFilterId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("frig.sales.clientFilterId") || "";
  });
  const [clientFilterName, setClientFilterName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("frig.sales.clientFilterName") || "";
  });
  const [clientFilterQuery, setClientFilterQuery] = useState(clientFilterName);
  const [clientFilterDebounced, setClientFilterDebounced] = useState(clientFilterName);
  const [clientFilterOpen, setClientFilterOpen] = useState(false);
  const [pendingDeliveryType, setPendingDeliveryType] = useState<"ALL" | "SALE" | "ORDER">("ALL");
  const [pendingDeliveryPayment, setPendingDeliveryPayment] = useState<"ALL" | "PENDING" | "PARTIAL" | "PAID">("ALL");
  const [statDetail, setStatDetail] = useState<"totalAmount" | "pendingPayment" | "pendingDelivery" | "deliveredCount" | null>(null);
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});

  // Persistir en localStorage
  useEffect(() => {
    window.localStorage.setItem("frig.sales.viewMode", viewMode);
  }, [viewMode]);
  useEffect(() => {
    window.localStorage.setItem("frig.sales.search", search);
  }, [search]);
  useEffect(() => {
    window.localStorage.setItem("frig.sales.status", status);
  }, [status]);
  useEffect(() => {
    window.localStorage.setItem("frig.sales.paymentStatus", paymentStatus);
  }, [paymentStatus]);
  useEffect(() => {
    window.localStorage.setItem("frig.sales.orderType", orderType);
  }, [orderType]);
  useEffect(() => {
    window.localStorage.setItem("frig.sales.quickFilter", quickFilter);
  }, [quickFilter]);
  useEffect(() => {
    window.localStorage.setItem("frig.sales.startDate", startDate);
  }, [startDate]);
  useEffect(() => {
    window.localStorage.setItem("frig.sales.endDate", endDate);
  }, [endDate]);
  useEffect(() => {
    window.localStorage.setItem("frig.sales.clientFilterId", clientFilterId);
  }, [clientFilterId]);
  useEffect(() => {
    window.localStorage.setItem("frig.sales.clientFilterName", clientFilterName);
  }, [clientFilterName]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const timer = setTimeout(() => setClientFilterDebounced(clientFilterQuery), 300);
    return () => clearTimeout(timer);
  }, [clientFilterQuery]);

  const { data: clientFilterResultsQuery, isLoading: searchingClientFilter } = useQuery({
    queryKey: ["customers", "search", clientFilterDebounced, branch?.branch_id],
    queryFn: () =>
      searchCustomers(clientFilterDebounced, branch?.branch_id ? Number(branch.branch_id) : undefined),
    enabled: clientFilterDebounced.trim().length >= 1,
    staleTime: 30_000,
  });

  const clientFilterResults = useMemo<ClientOption[]>(() => {
    const items = (clientFilterResultsQuery ?? []) as ClientOption[];
    if (clientFilterId && clientFilterName && !items.some((c) => String(c.id) === clientFilterId)) {
      return [{ id: Number(clientFilterId), name: clientFilterName }, ...items];
    }
    return items;
  }, [clientFilterResultsQuery, clientFilterId, clientFilterName]);

  const [detail, setDetail] = useState<Order | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [posModal, setPosModal] = useState<{
    open: boolean;
    orderType: "SALE" | "ORDER" | null;
    isAccount?: boolean;
  }>({
    open: false,
    orderType: null,
  });

  // Modal rápido para crear cuenta (ORDER) con cliente/mesa.
  const [accountModal, setAccountModal] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [debouncedClientQuery, setDebouncedClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [showClientResults, setShowClientResults] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createClientName, setCreateClientName] = useState("");
  const [showCreateClient, setShowCreateClient] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedClientQuery(clientQuery), 300);
    return () => clearTimeout(timer);
  }, [clientQuery]);

  const { data: clientResultsQuery, isLoading: searchingCustomers } = useQuery({
    queryKey: ["customers", "search", debouncedClientQuery, branch?.branch_id],
    queryFn: () => searchCustomers(debouncedClientQuery, branch?.branch_id ? Number(branch.branch_id) : undefined),
    enabled: debouncedClientQuery.trim().length >= 1,
    staleTime: 30_000,
  });

  const clientResults = useMemo<ClientOption[]>(() => {
    const items = (clientResultsQuery ?? []) as ClientOption[];
    if (selectedClient && !items.some((c) => c.id === selectedClient.id)) {
      return [selectedClient, ...items];
    }
    return items;
  }, [clientResultsQuery, selectedClient]);

  // Refrescar lista de órdenes al cerrar el modal rápido de POS.
  useEffect(() => {
    if (!posModal.open) {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  }, [posModal.open, queryClient]);

  // Modales de acciones por orden
  const [delivering, setDelivering] = useState<Order | null>(null);
  const [deliverQuantities, setDeliverQuantities] = useState<Record<string, number>>({});

  function openDelivering(order: Order) {
    const initial: Record<string, number> = {};
    (order.products ?? []).forEach((p) => {
      initial[p.id] = p.quantity ?? 0;
    });
    setDeliverQuantities(initial);
    setDelivering(order);
  }

  function closeDelivering() {
    setDelivering(null);
    setDeliverQuantities({});
  }
  const [installmentOrder, setInstallmentOrder] = useState<Order | null>(null);

  // Formulario de nueva cuota
  const [newInstAmount, setNewInstAmount] = useState("");
  const [newInstDueDate, setNewInstDueDate] = useState("");
  const [newInstNotes, setNewInstNotes] = useState("");

  // Generador automático de cuotas
  const [installmentCount, setInstallmentCount] = useState("2");
  const [installmentStartDate, setInstallmentStartDate] = useState("");
  const [installmentFrequency, setInstallmentFrequency] = useState<"MONTHLY" | "WEEKLY" | "BIWEEKLY">("MONTHLY");

  const filter = useMemo<OrdersFilter>(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      payment_status: paymentStatus || undefined,
      order_type: orderType || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      client__in: clientFilterId || undefined,
      ...pageUrl,
    }),
    [debouncedSearch, status, paymentStatus, orderType, startDate, endDate, clientFilterId, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["orders", filter],
    queryFn: () => fetchOrders(filter),
  });

  const { data: tablesPage } = useQuery({
    queryKey: ["tables", "sales"],
    queryFn: () => fetchTables({ is_active: true, page_size: 200 }),
    enabled: showTables,
    staleTime: 60_000,
  });

  const tableById = useMemo(() => {
    const tables = tablesPage?.results ?? [];
    const map = new Map<number, TableItem>();
    tables.forEach((t) => map.set(t.id, t));
    return map;
  }, [tablesPage]);

  const orders = useMemo(() => {
    const items = (page?.results ?? []) as Order[];
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return items;
    return items.filter((order) => {
      const number = (order.order_number ?? order.id).toLowerCase();
      return number.includes(term);
    });
  }, [page?.results, debouncedSearch]) as Order[];
  const totalOrders = page?.count ?? 0;
  const activeFilterCount = [status, paymentStatus, orderType, startDate, endDate, clientFilterId].filter(Boolean).length;

  // Filtro rápido por chips (aplicado en cliente sobre la página cargada).
  const visibleOrders = useMemo(() => {
    if (quickFilter === "PENDING")
      return orders.filter(
        (o) => o.status !== "CANCELLED" && (o.payment_status === "PENDING" || o.payment_status === "PARTIAL"),
      );
    if (quickFilter === "OPEN_ACCOUNTS")
      return orders.filter((o) => o.order_type === "SALE" && o.status === "PENDING");
    if (quickFilter === "POR_DELIVER") {
      let pending = orders.filter((o) => o.status !== "CANCELLED" && o.delivery_status !== "DELIVERED");
      if (pendingDeliveryType !== "ALL") {
        pending = pending.filter((o) => o.order_type === pendingDeliveryType);
      }
      if (pendingDeliveryPayment !== "ALL") {
        pending = pending.filter((o) => o.payment_status === pendingDeliveryPayment);
      }
      return pending;
    }
    if (quickFilter === "DELIVERED") return orders.filter((o) => o.delivery_status === "DELIVERED");
    if (quickFilter === "PAID") return orders.filter((o) => o.payment_status === "PAID");
    if (quickFilter === "CANCELLED") return orders.filter((o) => o.status === "CANCELLED");
    return orders;
  }, [orders, quickFilter, pendingDeliveryType, pendingDeliveryPayment]);

  // Stats rápidas calculadas sobre las órdenes cargadas, respetando el rango de fechas seleccionado.
  const stats = useMemo(() => {
    let totalAmount = 0;
    let pendingPayment = 0;
    let pendingDelivery = 0;
    let deliveredCount = 0;
    const start = startDate ? new Date(startDate + "T00:00:00") : null;
    const end = endDate ? new Date(endDate + "T23:59:59") : null;
    for (const o of orders) {
      if (o.status === "CANCELLED") continue;
      const orderDate = o.date ? new Date(o.date) : null;
      const inRange =
        !orderDate ||
        (!start || orderDate >= start) && (!end || orderDate <= end);
      if (inRange) {
        totalAmount += Number(o.total_amount ?? 0) || 0;
      }
      if (o.payment_status === "PENDING" || o.payment_status === "PARTIAL") pendingPayment += 1;
      // Por entregar = ya pagada pero aún no entregada.
      if (o.payment_status === "PAID" && o.delivery_status !== "DELIVERED") pendingDelivery += 1;
      if (o.delivery_status === "DELIVERED") deliveredCount += 1;
    }
    return { totalAmount, pendingPayment, pendingDelivery, deliveredCount };
  }, [orders, startDate, endDate]);

  const statDetailOrders = useMemo(() => {
    if (!statDetail) return [];
    const start = startDate ? new Date(startDate + "T00:00:00") : null;
    const end = endDate ? new Date(endDate + "T23:59:59") : null;
    return orders.filter((o) => {
      if (o.status === "CANCELLED") return false;
      if (statDetail === "totalAmount") {
        const orderDate = o.date ? new Date(o.date) : null;
        return !orderDate || ((!start || orderDate >= start) && (!end || orderDate <= end));
      }
      if (statDetail === "pendingPayment") return o.payment_status === "PENDING" || o.payment_status === "PARTIAL";
      if (statDetail === "pendingDelivery") return o.payment_status === "PAID" && o.delivery_status !== "DELIVERED";
      if (statDetail === "deliveredCount") return o.delivery_status === "DELIVERED";
      return false;
    });
  }, [orders, statDetail, startDate, endDate]);

  const cancel = useMutation({
    mutationFn: (id: string) => cancelOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "all" });
    },
  });

  const deliver = useMutation({
    mutationFn: ({ id, items }: { id: string; items?: { order_product_id: string; actual_quantity: number }[] }) =>
      deliverOrder(id, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "all" });
      closeDelivering();
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo registrar la entrega");
    },
  });

  const installmentsQuery = useQuery({
    queryKey: ["orders", installmentOrder?.id, "installments"],
    queryFn: () => fetchInstallments(installmentOrder!.id),
    enabled: !!installmentOrder,
  });

  const createInstallment = useMutation({
    mutationFn: ({
      orderId,
      installments,
    }: {
      orderId: string;
      installments: InstallmentInput[];
    }) => createInstallments(orderId, installments),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orders", installmentOrder?.id, "installments"],
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setNewInstAmount("");
      setNewInstDueDate("");
      setNewInstNotes("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudieron generar las cuotas");
    },
  });

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function updateDateRange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
    setPageUrl({});
  }

  async function handleExportExcel() {
    // Exportar todos los resultados filtrados (no solo la página actual)
    // generando el Excel en el navegador con estados traducidos al español.
    const exportFilter: OrdersFilter = { ...filter };
    delete exportFilter.next;
    delete exportFilter.previous;
    exportFilter.page_size = 10000;

    await downloadFile(
      async () => {
        const data = await fetchOrders(exportFilter);
        const blob = await generateOrdersExcel(
          data.results,
          theme?.primary_color ?? "#2f6b3c",
        );
        return { blob, filename: exportFilename("ordenes", "xlsx") };
      },
      {
        filename: exportFilename("ordenes", "xlsx"),
        extension: "xlsx",
      },
    );
  }

  async function handleDownloadThermalPdf(order: Order) {
    await downloadFile(() => downloadOrderThermalPdf(order.id), {
      filename: `boleta_${order.order_number ?? order.id.slice(0, 8)}.pdf`,
    });
  }

  async function handleDownloadA4Pdf(order: Order) {
    await downloadFile(() => downloadOrderA4Pdf(order.id), {
      filename: `boleta_${order.order_number ?? order.id.slice(0, 8)}_a4.pdf`,
    });
  }

  async function handleDownloadTicketPdf(order: Order) {
    await downloadFile(() => downloadOrderTicketPdf(order.id), {
      filename: `comanda_${order.order_number ?? order.id.slice(0, 8)}.pdf`,
    });
  }

  async function handleCreateAccount() {
    if (creatingAccount) return;
    setAccountError(null);
    let clientId = selectedClient?.id ?? null;
    if (!clientId && createClientName.trim()) {
      try {
        const newClient = await createCustomer({ name: createClientName.trim() });
        clientId = newClient.id;
      } catch (err) {
        setAccountError(err instanceof Error ? err.message : "No se pudo crear el cliente.");
        return;
      }
    }
    if (!clientId) {
      setAccountError("Debes seleccionar o crear un cliente para abrir una cuenta.");
      return;
    }
    setCreatingAccount(true);
    try {
      const tableId = selectedTableId ? Number(selectedTableId) : null;
      const order = await createOrder({
        items: [],
        order_type: "SALE",
        client_id: clientId,
        table_id: tableId,
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setAccountModal(false);
      resetAccountForm();
      // Abrir POS embebido con la nueva cuenta abierta (SALE pending) para agregar productos.
      setPosModal({ open: true, orderType: "SALE", isAccount: true });
      // Navegar el iframe a la orden. Como el modal usa state, actualizamos src vía query param.
      // Usamos un pequeño timeout para asegurar que el iframe exista.
      setTimeout(() => {
        const iframe = document.querySelector<HTMLIFrameElement>("iframe[title='Nueva cuenta']");
        if (iframe) {
          iframe.src = `/pos/terminal?order_id=${order.id}&open_account=1`;
        }
      }, 150);
    } catch {
      // ignore - error handled by api client
    } finally {
      setCreatingAccount(false);
    }
  }

  function resetAccountForm() {
    setClientQuery("");
    setDebouncedClientQuery("");
    setSelectedClient(null);
    setShowClientResults(false);
    setSelectedTableId("");
    setCreateClientName("");
    setShowCreateClient(false);
    setAccountError(null);
  }

  function openInstallments(order: Order) {
    setInstallmentOrder(order);
    setNewInstAmount("");
    setNewInstDueDate("");
    setNewInstNotes("");
    setInstallmentCount("2");
    setInstallmentStartDate(todayStr());
    setInstallmentFrequency("MONTHLY");
  }

  function closeInstallments() {
    setInstallmentOrder(null);
    setNewInstAmount("");
    setNewInstDueDate("");
    setNewInstNotes("");
    setInstallmentCount("2");
    setInstallmentStartDate("");
    setInstallmentFrequency("MONTHLY");
  }

  async function handleDeliverSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!delivering) return;
    try {
      const activeProducts = (delivering.products ?? []).filter((p) => (p.quantity ?? 0) > 0);
      const hasCustomQuantities = activeProducts.some((p) => {
        const current = p.actual_quantity ?? 0;
        const target = deliverQuantities[p.id] ?? p.quantity ?? 0;
        return target !== current && target < (p.quantity ?? 0);
      });
      const items = hasCustomQuantities
        ? activeProducts.map((p) => ({
            order_product_id: String(p.id),
            actual_quantity: Math.min(
              deliverQuantities[p.id] ?? p.quantity ?? 0,
              p.quantity ?? 0,
            ),
          }))
        : undefined;
      await deliver.mutateAsync({ id: delivering.id, items });
    } catch {
      // error handled by api client
    }
  }

  async function handleGenerateInstallments(e: React.FormEvent) {
    e.preventDefault();
    if (!installmentOrder) return;
    const count = Math.max(1, parseInt(installmentCount, 10) || 0);
    if (count < 1) return;
    const total = Number(installmentOrder.total_amount ?? 0);
    if (total <= 0) return;
    const baseAmount = Math.floor(total / count);
    const remainder = Math.round(total - baseAmount * count);
    const start = installmentStartDate ? new Date(installmentStartDate + "T00:00:00") : new Date();
    const installments: InstallmentInput[] = [];
    for (let i = 0; i < count; i++) {
      const due = new Date(start);
      if (installmentFrequency === "MONTHLY") {
        due.setMonth(due.getMonth() + i);
      } else if (installmentFrequency === "BIWEEKLY") {
        due.setDate(due.getDate() + i * 14);
      } else {
        due.setDate(due.getDate() + i * 7);
      }
      const amount = baseAmount + (i === count - 1 ? remainder : 0);
      installments.push({
        amount: Number(amount).toFixed(2),
        due_date: due.toISOString().slice(0, 10),
        notes: i === 0 ? "Generada automáticamente" : null,
      });
    }
    try {
      await createInstallment.mutateAsync({
        orderId: installmentOrder.id,
        installments,
      });
    } catch {
      // error handled by api client
    }
  }

  async function handleCreateInstallmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!installmentOrder || !newInstAmount) return;
    try {
      const installment: InstallmentInput = {
        amount: Number(newInstAmount).toFixed(2),
        due_date: newInstDueDate || null,
        notes: newInstNotes || null,
      };
      await createInstallment.mutateAsync({
        orderId: installmentOrder.id,
        installments: [installment],
      });
    } catch {
      // error handled by api client
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setPosModal({ open: true, orderType: "SALE" })} className="shadow-sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Nueva venta
              </Button>
              <Button variant="outline" onClick={() => setPosModal({ open: true, orderType: "ORDER" })}>
                <ClipboardList className="mr-1.5 h-4 w-4" />
                Nueva orden
              </Button>
              <Button variant="outline" onClick={() => setAccountModal(true)}>
                <Wallet className="mr-1.5 h-4 w-4" />
                Nueva cuenta
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={handleExportExcel} isLoading={isDownloading}>
              <FileDown className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Exportar Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Wallet} label="Total" value={formatCLP(stats.totalAmount)} tone="primary" onClick={() => setStatDetail("totalAmount")} />
            <StatCard icon={Clock} label="Pendientes de cobro" value={String(stats.pendingPayment)} tone="amber" onClick={() => setStatDetail("pendingPayment")} />
            <StatCard icon={Package} label="Por entregar" value={String(stats.pendingDelivery)} tone="blue" onClick={() => setStatDetail("pendingDelivery")} />
            <StatCard icon={ShoppingBag} label="Entregadas" value={String(stats.deliveredCount)} tone="emerald" onClick={() => setStatDetail("deliveredCount")} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Filtros en una línea */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="filter-search"
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Buscar por N° orden o venta…"
              className="h-10 rounded-xl pl-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 px-3 sm:hidden"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 sm:inline-flex"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              aria-label="Vista tarjetas"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                viewMode === "cards" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="Vista lista"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                viewMode === "list" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filtros rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.value}
              type="button"
              onClick={() => setQuickFilter(qf.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                quickFilter === qf.value
                  ? "bg-primary text-white"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* Filtros específicos para entregas pendientes */}
        {quickFilter === "POR_DELIVER" && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/30 p-2 shadow-sm">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
              {([
                { key: "ALL", label: "Todos" },
                { key: "SALE", label: "Venta" },
                { key: "ORDER", label: "Orden" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPendingDeliveryType(opt.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    pendingDeliveryType === opt.key
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
              {([
                { key: "ALL", label: "Todos" },
                { key: "PENDING", label: "Pendiente" },
                { key: "PARTIAL", label: "Parcial" },
                { key: "PAID", label: "Pagada" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPendingDeliveryPayment(opt.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    pendingDeliveryPayment === opt.key
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtros avanzados (desktop, colapsables) */}
        {advancedOpen && (
            <div className="hidden grid-cols-2 gap-3 rounded-2xl border border-border bg-muted/30 p-3 shadow-sm sm:grid md:grid-cols-3 lg:grid-cols-6">
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
                <Select id="filter-status" value={status} onChange={(e) => updateFilter(setStatus, e.target.value)} className="h-10 text-sm sm:h-9">
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-payment" className="text-xs text-muted-foreground">Pago</label>
                <Select id="filter-payment" value={paymentStatus} onChange={(e) => updateFilter(setPaymentStatus, e.target.value)} className="h-10 text-sm sm:h-9">
                  {PAYMENT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
                <Select id="filter-type" value={orderType} onChange={(e) => updateFilter(setOrderType, e.target.value)} className="h-10 text-sm sm:h-9">
                  {ORDER_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-client" className="text-xs text-muted-foreground">Cliente</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="filter-client"
                    value={clientFilterQuery}
                    onChange={(e) => {
                      setClientFilterQuery(e.target.value);
                      if (clientFilterId) {
                        setClientFilterId("");
                        setClientFilterName("");
                      }
                      setClientFilterOpen(true);
                    }}
                    onFocus={() => setClientFilterOpen(true)}
                    placeholder="Buscar cliente…"
                    className="h-10 pl-8 text-sm sm:h-9"
                  />
                  {clientFilterId && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientFilterId("");
                        setClientFilterName("");
                        setClientFilterQuery("");
                        setClientFilterOpen(false);
                        setPageUrl({});
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                      aria-label="Limpiar cliente"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {clientFilterOpen && clientFilterQuery.trim().length === 0 && !clientFilterId && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                      Escribe para buscar clientes…
                    </div>
                  )}
                  {clientFilterOpen && clientFilterDebounced.trim().length > 0 && searchingClientFilter && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                      Buscando…
                    </div>
                  )}
                  {clientFilterOpen && clientFilterDebounced.trim().length > 0 && !searchingClientFilter && clientFilterResults.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-background shadow-md">
                      {clientFilterResults.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setClientFilterId(String(client.id));
                            setClientFilterName(client.name ?? "");
                            setClientFilterQuery(client.name ?? "");
                            setClientFilterOpen(false);
                            setPageUrl({});
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          {client.name}
                          {client.email && <span className="ml-2 text-xs text-muted-foreground">{client.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {clientFilterOpen && clientFilterDebounced.trim().length > 0 && !searchingClientFilter && clientFilterResults.length === 0 && !clientFilterId && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                      Sin resultados
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-start" className="text-xs text-muted-foreground">Desde</label>
                <Input
                  id="filter-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => updateDateRange(e.target.value, endDate)}
                  disabled={isCashier}
                  className="h-10 text-xs sm:h-9"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-end" className="text-xs text-muted-foreground">Hasta</label>
                <Input
                  id="filter-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => updateDateRange(startDate, e.target.value)}
                  disabled={isCashier}
                  className="h-10 text-xs sm:h-9"
                />
              </div>
            </div>
          )}

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las órdenes.</p>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-muted/30 shadow-sm" />
            ))}
          </div>
        ) : (
          <>
            {/* Grid unificado de tarjetas */}
            {visibleOrders.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
                <div>
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold">No hay órdenes para mostrar</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ajusta los filtros o crea una nueva venta.
                  </p>
                </div>
              </div>
            ) : viewMode === "cards" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleOrders.map((order, index) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    index={index}
                    showTables={showTables}
                    tableById={tableById}
                    canCancel={canCancel(order.owner)}
                    isDownloading={isDownloading}
                    deliverPending={deliver.isPending}
                    cancelPending={cancel.isPending}
                    onView={setDetail}
                    onTicket={handleDownloadTicketPdf}
                    onDeliver={openDelivering}
                    onInstallments={openInstallments}
                    onThermal={handleDownloadThermalPdf}
                    onA4={handleDownloadA4Pdf}
                    onCancel={(o) => cancel.mutate(o.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleOrders.map((order) => (
                  <OrderListRow
                    key={order.id}
                    order={order}
                    canCancel={canCancel(order.owner)}
                    isDownloading={isDownloading}
                    deliverPending={deliver.isPending}
                    cancelPending={cancel.isPending}
                    onView={setDetail}
                    onTicket={handleDownloadTicketPdf}
                    onDeliver={openDelivering}
                    onInstallments={openInstallments}
                    onThermal={handleDownloadThermalPdf}
                    onA4={handleDownloadA4Pdf}
                    onCancel={(o) => cancel.mutate(o.id)}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {totalOrders} orden{totalOrders === 1 ? "" : "es"} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-border">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {orderTypeLabel(detail.order_type)}
                </p>
                <h2 className="mt-0.5 text-xl font-bold tabular-nums tracking-tight">
                  {detail.order_number ?? detail.id.slice(0, 8)}
                </h2>
              </div>
              <button
                onClick={() => setDetail(null)}
                aria-label="Cerrar"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Badges de estado */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge order={detail} />
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                  detail.delivery_status === "DELIVERED"
                    ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20"
                    : detail.delivery_status === "PARTIAL"
                      ? "bg-amber-500/10 text-amber-700 ring-amber-500/20"
                      : "bg-primary/10 text-primary ring-primary/20",
                )}>
                  {detail.delivery_status === "DELIVERED"
                    ? "Entregado"
                    : detail.delivery_status === "PARTIAL"
                      ? "Entrega parcial"
                      : "Por entregar"}
                </span>
              </div>

              {/* Info rápida */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cliente</p>
                  <p className="mt-1 truncate text-sm font-semibold">{detail.client?.name ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fecha</p>
                  <p className="mt-1 text-sm font-semibold">
                    {new Date(detail.date).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                  </p>
                </div>
                {showTables && detail.table && (
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Mesa</p>
                    <p className="mt-1 text-sm font-semibold">Mesa {tableById.get(detail.table)?.number ?? detail.table}</p>
                  </div>
                )}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-primary/80">Total</p>
                  <p className="mt-1 text-lg font-extrabold tabular-nums tracking-tight">
                    {formatCLP(detail.total_amount ?? "0")}
                  </p>
                </div>
              </div>

              {/* Productos */}
              {detail.products && detail.products.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Productos</p>
                  <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
                    {detail.products.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.product_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            x{p.quantity ?? 0} · {formatCLP(p.unit_price ?? 0)} c/u
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums">
                          {formatCLP(p.total_price ?? 0)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pagos */}
              {detail.payments && detail.payments.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagos registrados</p>
                  <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
                    {detail.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{payment.payment_method_name ?? "Pago"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {payment.status_display ?? payment.status}
                            {payment.reference ? ` · ${payment.reference}` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums">
                          {formatCLP(parseFloat(payment.amount ?? "0"))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cuotas (solo órdenes) */}
              {detail.order_type === "ORDER" && detail.installments && detail.installments.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cuotas de pago</p>
                  <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
                    {detail.installments.map((inst) => (
                      <div key={inst.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            Cuota {inst.due_date ? `· vence ${inst.due_date}` : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {inst.status === "PAID" ? "Pagada" : inst.status === "OVERDUE" ? "Vencida" : "Pendiente"}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "shrink-0 font-semibold tabular-nums",
                            inst.status === "PAID" ? "text-emerald-600" : "text-amber-600",
                          )}
                        >
                          {formatCLP(parseFloat(inst.paid_amount ?? "0"))} / {formatCLP(parseFloat(inst.amount ?? "0"))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Datos de entrega (solo pedidos) */}
              {detail.order_type === "ORDER" && (detail.delivery_address || detail.delivery_date) && (
                <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Entrega</p>
                  {detail.delivery_address && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">Dirección:</span> {detail.delivery_address}
                    </p>
                  )}
                  {detail.delivery_date && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">Fecha:</span>{" "}
                      {new Date(detail.delivery_date).toLocaleString("es-CL", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </p>
                  )}
                </div>
              )}

              {/* Observación */}
              {detail.observation && (
                <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Observación</p>
                  <p className="mt-1 text-sm">{detail.observation}</p>
                </div>
              )}
            </div>

            {/* Footer con acciones */}
            <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-background p-4">
              <div className="grid grid-cols-2 gap-2">
                {detail.status !== "CANCELLED" && (
                  <>
                    {detail.order_type === "ORDER" && (detail.installments?.length ?? 0) > 0 && detail.payment_status !== "PAID" ? (
                      <Button
                        variant="outline"
                        className="h-10 border-primary/30 text-primary hover:bg-primary/5"
                        onClick={() => {
                          openInstallments(detail);
                          setDetail(null);
                        }}
                      >
                        <CalendarDays className="mr-1.5 h-4 w-4" />
                        Gestionar cuotas
                      </Button>
                    ) : null}
                    {detail.delivery_status !== "DELIVERED" && (
                      <Button
                        variant="outline"
                        className="h-10 border-primary/30 text-primary hover:bg-primary/5"
                        onClick={() => {
                          openDelivering(detail);
                          setDetail(null);
                        }}
                      >
                        <Zap className="mr-1.5 h-4 w-4" />
                        Entregar
                      </Button>
                    )}
                    {detail.order_type === "ORDER" && detail.payment_status !== "PAID" && (
                      <Button
                        variant="outline"
                        className="h-10 border-primary/30 text-primary hover:bg-primary/5"
                        onClick={() => {
                          openInstallments(detail);
                          setDetail(null);
                        }}
                      >
                        <CalendarDays className="mr-1.5 h-4 w-4" />
                        Gestionar cuotas
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() => handleDownloadTicketPdf(detail)}
                  disabled={isDownloading}
                >
                  <ClipboardList className="mr-1.5 h-4 w-4" />
                  Orden elaboración
                </Button>
                {detail.payment_status === "PAID" && (
                  <>
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => handleDownloadThermalPdf(detail)}
                      disabled={isDownloading}
                    >
                      <Receipt className="mr-1.5 h-4 w-4" />
                      Boleta 80 mm
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => handleDownloadA4Pdf(detail)}
                      disabled={isDownloading}
                    >
                      <FileText className="mr-1.5 h-4 w-4" />
                      Boleta A4
                    </Button>
                  </>
                )}
                {detail.status !== "CANCELLED" && canCancel(detail.owner) && (
                  <Button
                    variant="outline"
                    className="h-10 border-danger/30 text-danger hover:bg-danger/5"
                    onClick={() => {
                      cancel.mutate(detail.id);
                      setDetail(null);
                    }}
                    disabled={cancel.isPending}
                  >
                    <Ban className="mr-1.5 h-4 w-4" />
                    Anular
                  </Button>
                )}
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setDetail(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {delivering && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDelivering();
          }}
        >
          <div className="flex h-[92dvh] w-full flex-col overflow-y-auto rounded-t-xl border-x border-t border-border bg-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-sm sm:rounded-xl sm:border">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Confirmar entrega</h2>
                <p className="text-xs text-muted-foreground">
                  {orderTypeLabel(delivering.order_type)} · {delivering.order_number ?? delivering.id.slice(0, 8)}
                </p>
              </div>
              <button onClick={() => closeDelivering()} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {(delivering.products ?? []).filter((p) => (p.quantity ?? 0) > 0).length > 0 ? (
              <form onSubmit={handleDeliverSubmit} className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Ajusta la cantidad entregada de cada producto. Lo que aún no se entrega quedará pendiente en la cuenta.
                </p>
                <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
                  {(delivering.products ?? [])
                    .filter((p) => (p.quantity ?? 0) > 0)
                    .map((p) => {
                      const current = p.actual_quantity ?? 0;
                      const target = deliverQuantities[p.id] ?? p.quantity ?? 0;
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.product_name ?? "Producto"}</p>
                            <p className="text-xs text-muted-foreground">
                              Solicitado: {p.quantity} {current > 0 ? `· Entregado: ${current}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setDeliverQuantities((prev) => ({
                                  ...prev,
                                  [p.id]: Math.max(current, (prev[p.id] ?? p.quantity ?? 0) - 1),
                                }))
                              }
                              disabled={(deliverQuantities[p.id] ?? p.quantity ?? 0) <= current}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={current}
                              max={p.quantity}
                              value={target}
                              onChange={(e) => {
                                const val = Math.min(
                                  p.quantity ?? 0,
                                  Math.max(current, Number(e.target.value) || 0),
                                );
                                setDeliverQuantities((prev) => ({ ...prev, [p.id]: val }));
                              }}
                              className="h-8 w-14 rounded-lg border border-border bg-background px-2 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setDeliverQuantities((prev) => ({
                                  ...prev,
                                  [p.id]: Math.min(p.quantity ?? 0, (prev[p.id] ?? p.quantity ?? 0) + 1),
                                }))
                              }
                              disabled={(deliverQuantities[p.id] ?? p.quantity ?? 0) >= (p.quantity ?? 0)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => closeDelivering()} disabled={deliver.isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" isLoading={deliver.isPending}>
                    Confirmar entrega
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleDeliverSubmit} className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  ¿Marcar {orderTypeLabel(delivering.order_type).toLowerCase()} <strong>{delivering.order_number ?? delivering.id.slice(0, 8)}</strong> como entregada?
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => closeDelivering()} disabled={deliver.isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" isLoading={deliver.isPending}>
                    Confirmar entrega
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {installmentOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeInstallments();
          }}
        >
          <div className="flex h-[92dvh] w-full flex-col overflow-y-auto rounded-t-xl border-x border-t border-border bg-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl sm:border">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Cuotas {orderTypeLabel(installmentOrder.order_type).toLowerCase()} {installmentOrder.order_number ?? installmentOrder.id.slice(0, 8)}
              </h2>
              <button onClick={closeInstallments} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total de la orden</span>
                <span className="font-semibold tabular-nums">{formatCLP(installmentOrder.total_amount ?? "0")}</span>
              </div>
            </div>

            {(installmentsQuery.data?.length ?? 0) === 0 && !installmentsQuery.isLoading && (
              <form onSubmit={handleGenerateInstallments} className="mb-6 flex flex-col gap-3 rounded-lg border border-border p-3">
                <h3 className="text-sm font-medium">Generar cuotas</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Cantidad</label>
                    <Input
                      type="number"
                      min={1}
                      max={36}
                      step="1"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                      placeholder="2"
                      className="h-9 text-sm tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Primera fecha</label>
                    <Input
                      type="date"
                      value={installmentStartDate}
                      onChange={(e) => setInstallmentStartDate(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Frecuencia</label>
                    <Select
                      value={installmentFrequency}
                      onChange={(e) => setInstallmentFrequency(e.target.value as "MONTHLY" | "WEEKLY" | "BIWEEKLY")}
                      className="h-9 text-xs"
                    >
                      <option value="MONTHLY">Mensual</option>
                      <option value="BIWEEKLY">Quincenal</option>
                      <option value="WEEKLY">Semanal</option>
                    </Select>
                  </div>
                </div>
                {installmentOrder && parseInt(installmentCount, 10) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Se generarán <strong>{installmentCount}</strong> cuotas de aprox{" "}
                    <strong>
                      {formatCLP(
                        Math.floor(
                          Number(installmentOrder.total_amount ?? 0) /
                            parseInt(installmentCount, 10)
                        ).toString()
                      )}
                    </strong>{" "}
                    cada{" "}
                    {installmentFrequency === "MONTHLY"
                      ? "mes"
                      : installmentFrequency === "BIWEEKLY"
                        ? "2 semanas"
                        : "semana"}
                    .
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={createInstallment.isPending}
                    disabled={
                      !installmentStartDate ||
                      parseInt(installmentCount, 10) < 1
                    }
                  >
                    Generar cuotas
                  </Button>
                </div>
              </form>
            )}

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Cuotas registradas</h3>
              {installmentsQuery.isLoading ? (
                <div className="py-4">
                  <TableSkeleton rows={3} columns={4} />
                </div>
              ) : (installmentsQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No hay cuotas registradas.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {installmentsQuery.data?.map((inst) => {
                    return (
                      <div key={inst.id} className="rounded-lg border border-border p-3">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium tabular-nums">{formatCLP(inst.amount)}</span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                inst.status === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : inst.status === "OVERDUE"
                                    ? "bg-danger/10 text-danger"
                                    : "bg-amber-500/10 text-amber-700",
                              )}
                            >
                              {inst.status === "PAID" ? "Pagada" : inst.status === "OVERDUE" ? "Vencida" : "Pendiente"}
                            </span>
                          </div>
                          {inst.due_date && (
                            <span className="text-xs text-muted-foreground">
                              Vence {new Date(inst.due_date).toLocaleDateString("es-CL")}
                            </span>
                          )}
                        </div>
                        {inst.notes && <p className="mb-2 text-xs text-muted-foreground">{inst.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {(installmentsQuery.data?.length ?? 0) > 0 && (
                <form onSubmit={handleCreateInstallmentSubmit} className="mt-4 flex flex-col gap-3 rounded-lg border border-border p-3">
                  <h3 className="text-sm font-medium">Agregar cuota extra</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Monto</label>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={newInstAmount}
                        onChange={(e) => setNewInstAmount(e.target.value)}
                        placeholder="0"
                        className="h-9 text-sm tabular-nums"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Vencimiento</label>
                      <Input
                        type="date"
                        value={newInstDueDate}
                        onChange={(e) => setNewInstDueDate(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Notas</label>
                    <Input
                      value={newInstNotes}
                      onChange={(e) => setNewInstNotes(e.target.value)}
                      placeholder="Notas de la cuota"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" isLoading={createInstallment.isPending} disabled={!newInstAmount}>
                      Agregar cuota
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal rápido para crear cuenta abierta (SALE pending) con cliente/mesa */}
      <AnimatePresence>
        {accountModal && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setAccountModal(false);
                resetAccountForm();
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ duration: 0.2 }}
              className="flex h-[92dvh] w-full flex-col overflow-y-auto rounded-t-xl border-x border-t border-border bg-card p-5 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-xl sm:border"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Nueva cuenta</h2>
                  <p className="text-xs text-muted-foreground">
                    Crea una cuenta abierta para el cliente. Luego podrás agregar productos y cobrar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAccountModal(false);
                    resetAccountForm();
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="account-client" className="text-xs font-medium text-muted-foreground">
                    Cliente <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="account-client"
                      value={clientQuery}
                      onChange={(e) => {
                        setClientQuery(e.target.value);
                        setSelectedClient(null);
                        setShowClientResults(true);
                      }}
                      onFocus={() => setShowClientResults(true)}
                      placeholder="Buscar cliente..."
                      className="h-9 pl-8 text-sm"
                    />
                    {showClientResults && debouncedClientQuery.trim().length === 0 && !selectedClient && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                        Escribe para buscar clientes…
                      </div>
                    )}
                    {showClientResults && debouncedClientQuery.trim().length > 0 && searchingCustomers && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                        Buscando…
                      </div>
                    )}
                    {showClientResults && debouncedClientQuery.trim().length > 0 && !searchingCustomers && clientResults.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-background shadow-md">
                        {clientResults.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setSelectedClient(client);
                              setClientQuery(client.name ?? "");
                              setShowClientResults(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            {client.name}
                            {client.email && <span className="ml-2 text-xs text-muted-foreground">{client.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {showClientResults && debouncedClientQuery.trim().length > 0 && !searchingCustomers && clientResults.length === 0 && !selectedClient && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                        Sin resultados
                      </div>
                    )}
                  </div>
                  {!showCreateClient ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateClient(true)}
                      className="self-start text-xs text-primary hover:underline"
                    >
                      + Crear cliente rápido
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        value={createClientName}
                        onChange={(e) => setCreateClientName(e.target.value)}
                        placeholder="Nombre del nuevo cliente"
                        className="h-8 flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateClient(false);
                          setCreateClientName("");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {showTables && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="account-table" className="text-xs font-medium text-muted-foreground">
                      Mesa (opcional)
                    </label>
                    <Select
                      id="account-table"
                      value={selectedTableId}
                      onChange={(e) => setSelectedTableId(e.target.value)}
                      className="h-9 text-sm"
                    >
                      <option value="">Sin mesa</option>
                      {(tablesPage?.results ?? []).map((table) => (
                        <option key={table.id} value={String(table.id)}>
                          Mesa {table.number}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                {accountError && (
                  <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{accountError}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAccountModal(false);
                      resetAccountForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateAccount}
                    isLoading={creatingAccount}
                    disabled={!selectedClient && !createClientName.trim()}
                  >
                    Crear cuenta
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal rápido de POS para crear venta/pedido sin salir de la página */}
      <AnimatePresence>
        {posModal.open && posModal.orderType && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setPosModal({ open: false, orderType: null })}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-background shadow-2xl sm:h-[90vh] sm:max-h-[900px] sm:max-w-6xl sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <h2 className="text-sm font-semibold">
                  {posModal.orderType === "ORDER"
                    ? "Nueva orden"
                    : posModal.isAccount
                      ? "Nueva cuenta"
                      : "Nueva venta"}
                </h2>
                <button
                  type="button"
                  onClick={() => setPosModal({ open: false, orderType: null })}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <iframe
                src={`/pos/terminal?order_type=${posModal.orderType}${posModal.isAccount ? "&open_account=1" : ""}`}
                className="flex-1 border-0"
                title={
                  posModal.orderType === "ORDER"
                    ? "Nueva orden"
                    : posModal.isAccount
                      ? "Nueva cuenta"
                      : "Nueva venta"
                }
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Drawer de filtros avanzados en móvil */}
      {filtersOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 sm:hidden"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFiltersOpen(false);
          }}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2 }}
            className="flex h-full w-full max-w-sm flex-col bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Filtros</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4 overflow-y-auto p-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="mobile-filter-status" className="text-xs text-muted-foreground">Estado</label>
                <Select id="mobile-filter-status" value={status} onChange={(e) => updateFilter(setStatus, e.target.value)} className="h-10 text-sm">
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="mobile-filter-payment" className="text-xs text-muted-foreground">Pago</label>
                <Select id="mobile-filter-payment" value={paymentStatus} onChange={(e) => updateFilter(setPaymentStatus, e.target.value)} className="h-10 text-sm">
                  {PAYMENT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="mobile-filter-type" className="text-xs text-muted-foreground">Tipo</label>
                <Select id="mobile-filter-type" value={orderType} onChange={(e) => updateFilter(setOrderType, e.target.value)} className="h-10 text-sm">
                  {ORDER_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="mobile-filter-client" className="text-xs text-muted-foreground">Cliente</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="mobile-filter-client"
                    value={clientFilterQuery}
                    onChange={(e) => {
                      setClientFilterQuery(e.target.value);
                      if (clientFilterId) {
                        setClientFilterId("");
                        setClientFilterName("");
                      }
                      setClientFilterOpen(true);
                    }}
                    onFocus={() => setClientFilterOpen(true)}
                    placeholder="Buscar cliente…"
                    className="h-10 pl-8 text-sm"
                  />
                  {clientFilterId && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientFilterId("");
                        setClientFilterName("");
                        setClientFilterQuery("");
                        setClientFilterOpen(false);
                        setPageUrl({});
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                      aria-label="Limpiar cliente"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {clientFilterOpen && clientFilterQuery.trim().length === 0 && !clientFilterId && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                      Escribe para buscar clientes…
                    </div>
                  )}
                  {clientFilterOpen && clientFilterDebounced.trim().length > 0 && searchingClientFilter && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                      Buscando…
                    </div>
                  )}
                  {clientFilterOpen && clientFilterDebounced.trim().length > 0 && !searchingClientFilter && clientFilterResults.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-background shadow-md">
                      {clientFilterResults.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setClientFilterId(String(client.id));
                            setClientFilterName(client.name ?? "");
                            setClientFilterQuery(client.name ?? "");
                            setClientFilterOpen(false);
                            setPageUrl({});
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          {client.name}
                          {client.email && <span className="ml-2 text-xs text-muted-foreground">{client.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {clientFilterOpen && clientFilterDebounced.trim().length > 0 && !searchingClientFilter && clientFilterResults.length === 0 && !clientFilterId && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                      Sin resultados
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="mobile-filter-start" className="text-xs text-muted-foreground">Desde</label>
                  <Input
                    id="mobile-filter-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => updateDateRange(e.target.value, endDate)}
                    disabled={isCashier}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="mobile-filter-end" className="text-xs text-muted-foreground">Hasta</label>
                  <Input
                    id="mobile-filter-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => updateDateRange(startDate, e.target.value)}
                    disabled={isCashier}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStatus("");
                    setPaymentStatus("");
                    setOrderType("");
                    setClientFilterId("");
                    setClientFilterName("");
                    setClientFilterQuery("");
                    setClientFilterOpen(false);
                    setStartDate(monthStartStr());
                    setEndDate(monthEndStr());
                    setPageUrl({});
                  }}
                >
                  Limpiar
                </Button>
                <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Drawer de detalle de stats */}
      {statDetail && (
        <div
          className="fixed inset-0 z-[60] flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setStatDetail(null);
          }}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2 }}
            className="flex h-full w-full max-w-lg flex-col bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">
                  {statDetail === "totalAmount" && `Total (${startDate && endDate ? `${startDate} al ${endDate}` : "todo"})`}
                  {statDetail === "pendingPayment" && "Pendientes de cobro"}
                  {statDetail === "pendingDelivery" && "Por entregar"}
                  {statDetail === "deliveredCount" && "Entregadas"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {statDetailOrders.length} orden{statDetailOrders.length === 1 ? "" : "es"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatDetail(null)}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
              {statDetailOrders.length === 0 ? (
                <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
                  <div>
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                      <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold">No hay órdenes para mostrar</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {statDetailOrders.map((order) => (
                    <OrderListRow
                      key={order.id}
                      order={order}
                      canCancel={canCancel(order.owner)}
                      isDownloading={isDownloading}
                      deliverPending={deliver.isPending}
                      cancelPending={cancel.isPending}
                      onView={setDetail}
                      onTicket={handleDownloadTicketPdf}
                      onDeliver={openDelivering}
                      onInstallments={openInstallments}
                      onThermal={handleDownloadThermalPdf}
                      onA4={handleDownloadA4Pdf}
                      onCancel={(o) => cancel.mutate(o.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
