"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Bitcoin,
  CreditCard,
  FileCheck,
  FileText,
  Landmark,
  Layers,
  List,
  MoreHorizontal,
  LayoutDashboard,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { DeltaChip, previousWindow, ReportTabPanels } from "@/components/reports/report-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody } from "@/components/ui/modal";
import { useCurrentBranch } from "@/lib/store/session";
import { downloadPaymentVoucher, fetchPayments } from "@/lib/api/payments";
import { fetchOrder, fetchOrders } from "@/lib/api/orders";
import { fetchRevenue, fetchRevenues } from "@/lib/api/revenues";
import { formatCLP, cn, orderTypeLabel, paymentTypeLabel } from "@/lib/utils";

type Payment = {
  id: string;
  amount: number;
  net_amount: number;
  processing_fee_amount?: number;
  status?: string;
  payment_source: string;
  payment_source_display?: string;
  payment_direction?: "INCOME" | "EXPENSE";
  payment_method_name: string;
  payment_method_type?: string;
  order_number?: string;
  order?: string | null;
  payment_date: string;
  reference?: string | null;
  revenue_id?: string | null;
  expense_id?: string | null;
};

type TabKey = "resumen" | "transacciones";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 24 } },
};

const TABS: { key: TabKey; label: string; icon: typeof Wallet }[] = [
  { key: "resumen", label: "Resumen", icon: LayoutDashboard },
  { key: "transacciones", label: "Transacciones", icon: List },
];

/**
 * Orígenes de caja (payment_source).
 * ORDER se refina a Venta/Orden/Convenio vía cashOriginLabel + índice OV.
 */
const SOURCE_LABEL: Record<string, string> = {
  ORDER: "Ventas / Órdenes",
  EXPENSE: "Egresos",
  REVENUE: "Ingresos",
  REFUND: "Reembolsos",
  OTHER: "Otros",
};

/** Tope de páginas: 50 × 200 = 10.000 pagos. Si hay más, se avisa truncación. */
const MAX_PAGES = 50;
const PAGE_SIZE = 200;

type PaymentsFetchResult = {
  payments: Payment[];
  /** count del backend (si viene). */
  totalCount: number;
  truncated: boolean;
};

async function fetchAllCompletedPayments(
  start: string,
  end: string,
): Promise<PaymentsFetchResult> {
  const all: Payment[] = [];
  let next: string | null | undefined;
  let first = true;
  let totalCount = 0;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchPayments({
      payment_date__gte: start ? `${start}T00:00:00` : undefined,
      payment_date__lte: end ? `${end}T23:59:59` : undefined,
      status: "COMPLETED",
      page_size: PAGE_SIZE,
      next: first ? undefined : next,
      previous: undefined,
    });
    if (first && typeof data.count === "number") totalCount = data.count;
    all.push(...((data.results ?? []) as unknown as Payment[]));
    next = data.next;
    first = false;
    if (!next) break;
    if (page === MAX_PAGES - 1 && next) truncated = true;
  }

  if (!totalCount) totalCount = all.length;
  if (totalCount > all.length) truncated = true;

  return { payments: all, totalCount, truncated };
}

function fmtDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoInput(days: number): string {
  return fmtDateInput(new Date(Date.now() - days * 86_400_000));
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v)}`;
}

/**
 * Índice pago ↔ OV (cliente + tipo SALE/ORDER/AGREEMENT).
 * Record (no Map): structuralSharing de React Query vacía los Map.
 */
type ClientIndex = {
  byOrderId: Record<string, string>;
  byOrderNumber: Record<string, string>;
  orderTypeByOrderId: Record<string, string>;
  orderTypeByOrderNumber: Record<string, string>;
  /** UUID de OV → correlativo legible (B5-…). */
  orderNumberByOrderId: Record<string, string>;
  /** Órdenes del período (mismo origen que /reports/sales). */
  periodOrders: Array<{
    id: string;
    order_number: string | null;
    clientName: string;
    orderType: string;
    total: number;
    paymentStatus: string;
  }>;
};

function withHashCorrelative(raw: string): string {
  const t = raw.trim().replace(/^#/, "");
  return t ? `#${t}` : "";
}

function normOrderNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .trim()
    .replace(/^#/, "")
    .replace(/^ov[\s-]*/i, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function clientNameFromOrder(order: {
  client?: { name?: string | null } | null;
}): string {
  const name = order.client?.name?.trim();
  return name || "Sin cliente";
}

function orderTypeFromOrder(order: { order_type?: string | null }): string {
  return order.order_type ? String(order.order_type) : "";
}

function indexOrderMeta(
  index: {
    byOrderId: Record<string, string>;
    byOrderNumber: Record<string, string>;
    orderTypeByOrderId: Record<string, string>;
    orderTypeByOrderNumber: Record<string, string>;
    orderNumberByOrderId: Record<string, string>;
  },
  order: {
    id: string | number;
    order_number?: string | null;
    client?: { name?: string | null } | null;
    order_type?: string | null;
  },
) {
  const id = String(order.id);
  const name = clientNameFromOrder(order);
  const ot = orderTypeFromOrder(order);
  index.byOrderId[id] = name;
  if (ot) index.orderTypeByOrderId[id] = ot;
  const num = String(order.order_number ?? "").trim();
  if (num) index.orderNumberByOrderId[id] = num;
  const numKey = normOrderNumber(order.order_number);
  if (numKey) {
    index.byOrderNumber[numKey] = name;
    if (ot) index.orderTypeByOrderNumber[numKey] = ot;
  }
  if (order.order_number) {
    const raw = String(order.order_number).trim();
    index.byOrderNumber[raw] = name;
    if (ot) index.orderTypeByOrderNumber[raw] = ot;
  }
}

/** Ingreso ligado a una OV: tipo, cliente y correlativo. */
type RevenueLink = {
  hasOrder: boolean;
  orderType: string;
  clientName: string;
  orderId: string | null;
  orderNumber: string | null;
};

function linkFromRevenue(r: {
  id: string;
  order?: string | null;
  order_type?: string | null;
  order_client_name?: string | null;
  customer_name?: string | null;
  order_number?: string | null;
  order_tax_document_number?: string | null;
}): RevenueLink {
  const orderType = String(r.order_type ?? "").trim();
  const clientName = String(r.order_client_name ?? r.customer_name ?? "").trim();
  const orderId = r.order ? String(r.order) : null;
  const orderNumber =
    String(r.order_number ?? "").trim() ||
    String(r.order_tax_document_number ?? "").trim() ||
    null;
  return {
    hasOrder: Boolean(orderId) || Boolean(orderType),
    orderType,
    clientName,
    orderId,
    orderNumber,
  };
}

async function buildRevenueIndex(
  start: string,
  end: string,
  ids: string[],
): Promise<Record<string, RevenueLink>> {
  const map: Record<string, RevenueLink> = {};
  let next: string | null | undefined;
  let first = true;
  for (let page = 0; page < 20; page += 1) {
    const data = await fetchRevenues({
      startDate: start || undefined,
      endDate: end || undefined,
      page_size: 200,
      next: first ? undefined : next,
    });
    for (const r of data.results ?? []) map[r.id] = linkFromRevenue(r);
    next = data.next;
    first = false;
    if (!next) break;
  }

  const missing = ids.filter((id) => id && !map[id]).slice(0, 80);
  for (let i = 0; i < missing.length; i += 8) {
    const chunk = missing.slice(i, i + 8);
    await Promise.all(
      chunk.map(async (id) => {
        try {
          const r = await fetchRevenue(id);
          map[r.id] = linkFromRevenue(r);
        } catch {
          /* ignore */
        }
      }),
    );
  }

  /** Completar correlativo desde la OV cuando el ingreso no lo trae. */
  const needOrderIds = Array.from(
    new Set(
      Object.values(map)
        .filter((l) => l.orderId && !l.orderNumber)
        .map((l) => l.orderId as string),
    ),
  ).slice(0, 120);

  const orderNumberById: Record<string, string> = {};
  let oNext: string | null | undefined;
  let oFirst = true;
  for (let page = 0; page < 20 && needOrderIds.some((id) => !orderNumberById[id]); page += 1) {
    const data = await fetchOrders({
      start_date: start || undefined,
      end_date: end || undefined,
      page_size: 200,
      next: oFirst ? undefined : oNext,
    });
    for (const o of data.results ?? []) {
      const num = String(o.order_number ?? "").trim();
      if (num) orderNumberById[String(o.id)] = num;
    }
    oNext = data.next;
    oFirst = false;
    if (!oNext) break;
  }

  const stillMissing = needOrderIds.filter((id) => !orderNumberById[id]).slice(0, 80);
  for (let i = 0; i < stillMissing.length; i += 8) {
    const chunk = stillMissing.slice(i, i + 8);
    await Promise.all(
      chunk.map(async (id) => {
        try {
          const order = await fetchOrder(id);
          const num = String(order.order_number ?? "").trim();
          if (num) orderNumberById[id] = num;
        } catch {
          /* ignore */
        }
      }),
    );
  }

  for (const link of Object.values(map)) {
    if (link.orderId && !link.orderNumber && orderNumberById[link.orderId]) {
      link.orderNumber = orderNumberById[link.orderId];
    }
  }

  return map;
}

function revenueLink(
  p: Payment,
  revenues: Record<string, RevenueLink> | undefined,
): RevenueLink | undefined {
  if (!p.revenue_id || !revenues) return undefined;
  return revenues[p.revenue_id];
}
function isSalesLinkedPayment(p: Payment): boolean {
  if (p.payment_source === "ORDER") return true;
  if (p.order) return true;
  if (p.payment_direction === "EXPENSE") return false;
  return Boolean(p.order_number && String(p.order_number).trim());
}

async function buildPaymentClientIndex(
  payments: Payment[],
  start: string,
  end: string,
): Promise<ClientIndex> {
  const byOrderId: Record<string, string> = {};
  const byOrderNumber: Record<string, string> = {};
  const orderTypeByOrderId: Record<string, string> = {};
  const orderTypeByOrderNumber: Record<string, string> = {};
  const orderNumberByOrderId: Record<string, string> = {};
  const periodOrders: ClientIndex["periodOrders"] = [];
  const bag = {
    byOrderId,
    byOrderNumber,
    orderTypeByOrderId,
    orderTypeByOrderNumber,
    orderNumberByOrderId,
  };

  // 1) OV del período — mismo endpoint/filtros que el informe de ventas.
  let next: string | null | undefined;
  let first = true;
  for (let page = 0; page < 20; page += 1) {
    const data = await fetchOrders({
      start_date: start || undefined,
      end_date: end || undefined,
      page_size: 200,
      next: first ? undefined : next,
    });
    for (const o of data.results ?? []) {
      indexOrderMeta(bag, o);
      periodOrders.push({
        id: String(o.id),
        order_number: o.order_number ?? null,
        clientName: clientNameFromOrder(o),
        orderType: orderTypeFromOrder(o),
        total: num(o.total_amount),
        paymentStatus: String(o.payment_status ?? "").toUpperCase(),
      });
    }
    next = data.next;
    first = false;
    if (!next) break;
  }

  // 2) UUID de pagos de venta no cubiertos por el rango.
  const salesPayments = payments.filter(isSalesLinkedPayment);
  const missingIds = Array.from(
    new Set(
      salesPayments
        .map((p) => (p.order ? String(p.order) : ""))
        .filter((id) => id && !byOrderId[id]),
    ),
  ).slice(0, 200);

  for (let i = 0; i < missingIds.length; i += 8) {
    const chunk = missingIds.slice(i, i + 8);
    await Promise.all(
      chunk.map(async (id) => {
        try {
          const order = await fetchOrder(id);
          indexOrderMeta(bag, order);
        } catch {
          /* ignore */
        }
      }),
    );
  }

  // 3) order_number sin UUID.
  const missingNumbers = Array.from(
    new Set(
      salesPayments
        .map((p) => normOrderNumber(p.order_number))
        .filter((n) => n && !byOrderNumber[n]),
    ),
  ).slice(0, 100);

  for (const orderNumber of missingNumbers) {
    try {
      const data = await fetchOrders({ search: orderNumber, page_size: 15 });
      const match = (data.results ?? []).find(
        (o) =>
          normOrderNumber(o.order_number) === orderNumber ||
          String(o.order_number ?? "").trim() === orderNumber,
      );
      if (match) indexOrderMeta(bag, match);
    } catch {
      /* ignore */
    }
  }

  return {
    byOrderId,
    byOrderNumber,
    orderTypeByOrderId,
    orderTypeByOrderNumber,
    orderNumberByOrderId,
    periodOrders,
  };
}

/**
 * Correlativo legible (#B5-…) para venta / orden / ingreso ligado a OV.
 * Prioridad: order_number del pago → índice OV → ingreso asociado.
 */
function resolvePaymentCorrelative(
  p: Payment,
  index: ClientIndex | undefined,
  revenues?: Record<string, RevenueLink>,
): string | null {
  const fromPayment = String(p.order_number ?? "").trim();
  if (fromPayment) return withHashCorrelative(fromPayment);

  if (p.order && index?.orderNumberByOrderId[String(p.order)]) {
    return withHashCorrelative(index.orderNumberByOrderId[String(p.order)]);
  }

  const rev = revenueLink(p, revenues);
  if (rev?.orderNumber) return withHashCorrelative(rev.orderNumber);
  if (rev?.orderId && index?.orderNumberByOrderId[rev.orderId]) {
    return withHashCorrelative(index.orderNumberByOrderId[rev.orderId]);
  }

  return null;
}

function resolvePaymentClient(
  p: Payment,
  index: ClientIndex | undefined,
): string {
  if (!index) return "Sin atribuir";
  if (!isSalesLinkedPayment(p)) return "Sin atribuir";
  if (p.order) {
    const byId = index.byOrderId[String(p.order)];
    if (byId) return byId;
  }
  const rawNum = p.order_number ? String(p.order_number).trim() : "";
  if (rawNum && index.byOrderNumber[rawNum]) return index.byOrderNumber[rawNum];
  const norm = normOrderNumber(p.order_number);
  if (norm && index.byOrderNumber[norm]) return index.byOrderNumber[norm];
  return "Sin atribuir";
}

function resolvePaymentOrderType(
  p: Payment,
  index: ClientIndex | undefined,
): string | null {
  if (!index) return null;
  if (p.order) {
    const t = index.orderTypeByOrderId[String(p.order)];
    if (t) return t;
  }
  const rawNum = p.order_number ? String(p.order_number).trim() : "";
  if (rawNum && index.orderTypeByOrderNumber[rawNum]) return index.orderTypeByOrderNumber[rawNum];
  const norm = normOrderNumber(p.order_number);
  if (norm && index.orderTypeByOrderNumber[norm]) return index.orderTypeByOrderNumber[norm];
  return null;
}

/**
 * Origen real del pago.
 * Un pago REVENUE ligado a una OV cuenta como Venta / Orden / Convenio,
 * no como "Ingresos". "Ingreso" queda solo para ingresos sin orden.
 */
function cashOriginLabel(
  p: Payment,
  index: ClientIndex | undefined,
  revenues?: Record<string, RevenueLink>,
): string {
  const rev = revenueLink(p, revenues);
  if (rev?.hasOrder && rev.orderType) return orderTypeLabel(rev.orderType);

  if (p.payment_source === "ORDER" || (isSalesLinkedPayment(p) && p.payment_source !== "REVENUE" && p.payment_direction !== "EXPENSE")) {
    const ot = resolvePaymentOrderType(p, index);
    if (ot) return orderTypeLabel(ot);
    return p.payment_source_display?.trim() || SOURCE_LABEL.ORDER;
  }
  if (p.payment_source === "EXPENSE" || p.payment_direction === "EXPENSE") {
    return SOURCE_LABEL.EXPENSE;
  }
  if (p.payment_source === "REVENUE") return "Ingreso";
  if (p.payment_source === "REFUND") return SOURCE_LABEL.REFUND;
  if (p.payment_source === "OTHER") return SOURCE_LABEL.OTHER;
  return p.payment_source_display?.trim() || SOURCE_LABEL[p.payment_source] || p.payment_source;
}

/** Texto de la fila: deja explícito que el pago es un ingreso nacido de esa orden. */
function paymentOriginText(
  p: Payment,
  index: ClientIndex | undefined,
  revenues?: Record<string, RevenueLink>,
): string {
  const bucket = cashOriginLabel(p, index, revenues);
  if (p.payment_source === "REVENUE" && bucket !== "Ingreso") {
    return `Ingreso · ${bucket}`;
  }
  return bucket;
}

function resolveIncomeParty(
  p: Payment,
  index: ClientIndex | undefined,
  revenues?: Record<string, RevenueLink>,
): string {
  if (p.payment_direction === "EXPENSE" || p.payment_source === "EXPENSE") {
    return SOURCE_LABEL.EXPENSE;
  }
  const rev = revenueLink(p, revenues);
  if (p.payment_source === "REVENUE") {
    return rev?.clientName || "Sin cliente";
  }
  if (p.payment_source === "REFUND") return SOURCE_LABEL.REFUND;
  if (p.payment_source === "OTHER" && !isSalesLinkedPayment(p)) return SOURCE_LABEL.OTHER;
  return resolvePaymentClient(p, index);
}

function paymentMatchesIncomeParty(
  p: Payment,
  key: string,
  index: ClientIndex | undefined,
  orderIdsByClient: Map<string, Set<string>>,
  revenues?: Record<string, RevenueLink>,
): boolean {
  if (resolveIncomeParty(p, index, revenues) === key) return true;
  if (p.payment_source === "REVENUE" || p.payment_direction === "EXPENSE") return false;
  const keys = orderIdsByClient.get(key);
  if (!keys) return false;
  if (p.order && keys.has(String(p.order))) return true;
  const raw = p.order_number ? String(p.order_number).trim() : "";
  if (raw && keys.has(`raw:${raw}`)) return true;
  const n = normOrderNumber(p.order_number);
  if (n && keys.has(`num:${n}`)) return true;
  return false;
}

interface GroupRow {
  key: string;
  count: number;
  income: number;
  expense: number;
  net: number;
}

function buildGroups(
  payments: Payment[],
  dimension: (p: Payment) => string,
): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const p of payments) {
    const key = dimension(p) || "—";
    const g = map.get(key) ?? { key, count: 0, income: 0, expense: 0, net: 0 };
    g.count += 1;
    if (p.payment_direction === "EXPENSE") g.expense += num(p.amount);
    else g.income += num(p.amount);
    g.net = g.income - g.expense;
    map.set(key, g);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.income + b.expense - (a.income + a.expense),
  );
}

const KPI_TONE: Record<
  "success" | "danger" | "warning" | "primary",
  { surface: string; chip: string; value: string }
> = {
  success: {
    surface: "glass border-l-[3px] border-l-success/45",
    chip: "bg-success/15 text-success",
    value: "text-success",
  },
  primary: {
    surface: "glass border-l-[3px] border-l-primary/45",
    chip: "bg-primary/15 text-primary",
    value: "text-primary",
  },
  warning: {
    surface: "glass border-l-[3px] border-l-warning/45",
    chip: "bg-warning/15 text-warning",
    value: "text-warning",
  },
  danger: {
    surface: "glass border-l-[3px] border-l-danger/45",
    chip: "bg-danger/15 text-danger",
    value: "text-danger",
  },
};

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  delta,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: typeof Wallet;
  tone: keyof typeof KPI_TONE;
  delta?: ReactNode;
}) {
  const t = KPI_TONE[tone];
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl p-4 transition-colors sm:p-5", t.surface)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", t.chip)}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">{label}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>
          </div>
        </div>
        {delta}
      </div>
      <p className={cn("font-display text-2xl font-semibold tabular-nums tracking-tight", t.value)}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
        <Wallet className="h-4.5 w-4.5 text-muted-foreground" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ClientMoneyList({
  rows,
  onSelect,
  selectedKey,
}: {
  rows: GroupRow[];
  onSelect: (key: string) => void;
  selectedKey?: string | null;
}) {
  const list = rows.slice(0, 8);
  if (list.length === 0) return <EmptyState message="Sin clientes en el período." />;

  return (
    <ul className="flex flex-col">
      {list.map((g, i) => {
        const active = selectedKey === g.key;
        const initials = g.key
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("");
        return (
          <li key={g.key}>
            <button
              type="button"
              onClick={() => onSelect(g.key)}
              className={cn(
                "group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-2 text-left",
                "origin-center transition-[transform,colors,box-shadow] duration-150 ease-out will-change-transform",
                "hover:scale-[1.02] hover:bg-muted/60 hover:shadow-sm",
                "active:scale-[0.97]",
                active ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/25" : null,
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold transition-transform duration-150 group-hover:scale-110",
                  i === 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {initials || "·"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium leading-tight">{g.key}</p>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {g.count} pago{g.count === 1 ? "" : "s"}
                </p>
              </div>
              <p className="shrink-0 font-display text-[13px] font-semibold tabular-nums">
                {fmtCompact(g.net)}
              </p>
            </button>
          </li>
        );
      })}
      {rows.length > list.length ? (
        <li className="px-1.5 pt-1 text-[11px] text-muted-foreground">
          +{rows.length - list.length} más
        </li>
      ) : null}
    </ul>
  );
}

const METHOD_ICON: Record<string, typeof Wallet> = {
  CASH: Banknote,
  BANK_TRANSFER: Landmark,
  CHECK: FileCheck,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: Wallet,
  DIGITAL_WALLET: Smartphone,
  CRYPTO: Bitcoin,
  OTHER: MoreHorizontal,
};

function methodDisplayName(name: string, type?: string): string {
  const raw = name.trim();
  const coded = !raw || raw === "Sin método" || /^[A-Z0-9_]+$/.test(raw);
  if (coded) {
    const labeled = paymentTypeLabel(type || raw);
    if (labeled && labeled !== "—" && labeled !== raw) return labeled;
  }
  return raw || "Sin método";
}

function originBarTone(label: string): { bar: string; chip: string } {
  if (label === "Egresos" || label === "Gastos") return { bar: "bg-danger/70", chip: "bg-danger/12 text-danger" };
  if (label === "Venta" || label === "Orden" || label === "Convenio" || label.startsWith("Ventas")) {
    return { bar: "bg-primary", chip: "bg-primary/12 text-primary" };
  }
  if (label === "Ingreso" || label === "Ingresos") {
    return { bar: "bg-success", chip: "bg-success/12 text-success" };
  }
  if (label === "Reembolsos") return { bar: "bg-warning", chip: "bg-warning/15 text-warning" };
  return { bar: "bg-muted-foreground/50", chip: "bg-muted text-muted-foreground" };
}

function OriginChart({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: GroupRow[];
  selectedKey?: string | null;
  onSelect: (key: string) => void;
}) {
  const list = rows.slice(0, 8);
  const max = Math.max(1, ...list.map((r) => r.income + r.expense));
  const totalAll = rows.reduce((acc, r) => acc + r.income + r.expense, 0);

  if (list.length === 0) return <EmptyState message="Sin pagos en el período." />;

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-muted/25 to-background p-3 sm:p-4">
      <ul className="flex flex-col gap-3">
        {list.map((g, i) => {
          const volume = g.income + g.expense;
          const share = totalAll > 0 ? Math.round((volume / totalAll) * 100) : 0;
          const pct = Math.round((volume / max) * 100);
          const active = selectedKey === g.key;
          const tone = originBarTone(g.key);
          return (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => onSelect(g.key)}
                className={cn(
                  "group flex w-full flex-col gap-1.5 rounded-xl px-2 py-2 text-left transition-colors",
                  active ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/25" : "hover:bg-background/80",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        tone.chip,
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="truncate text-[13px] font-semibold tracking-tight">{g.key}</p>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-2">
                    <span className="font-display text-sm font-semibold tabular-nums">
                      {fmtCompact(volume)}
                    </span>
                    <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
                      {share}%
                    </span>
                  </div>
                </div>
                <div className="h-3.5 w-full overflow-hidden rounded-full bg-muted/80 ring-1 ring-inset ring-border/40">
                  <motion.div
                    className={cn("h-full rounded-full", tone.bar)}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(6, pct)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.04 }}
                  />
                </div>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {g.count} pago{g.count === 1 ? "" : "s"}
                  {g.income > 0 ? ` · recibido ${fmtCompact(g.income)}` : ""}
                  {g.expense > 0 ? ` · pagado ${fmtCompact(g.expense)}` : ""}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MethodGallery({
  rows,
  payments,
  onSelect,
  selectedKey,
}: {
  rows: GroupRow[];
  payments: Payment[];
  onSelect: (key: string) => void;
  selectedKey?: string | null;
}) {
  const list = rows.slice(0, 6);
  if (list.length === 0) return <EmptyState message="Sin métodos en el período." />;

  return (
    <ul className="flex flex-col gap-1">
      {list.map((g) => {
        const sample = payments.find((p) => (p.payment_method_name || "Sin método") === g.key);
        const type =
          sample?.payment_method_type || (/^[A-Z0-9_]+$/.test(g.key) ? g.key : "OTHER");
        const Icon = METHOD_ICON[type] ?? MoreHorizontal;
        const label = methodDisplayName(g.key, type);
        const volume = g.income + g.expense;
        const active = selectedKey === g.key;
        const dir =
          g.income > 0 && g.expense > 0
            ? "entra y sale"
            : g.expense > 0
              ? "pagado"
              : "recibido";
        return (
          <li key={g.key}>
            <button
              type="button"
              onClick={() => onSelect(g.key)}
              title={label}
              className={cn(
                "group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-2 text-left",
                "origin-center transition-[transform,colors,box-shadow] duration-150 ease-out will-change-transform",
                "hover:scale-[1.02] hover:bg-muted/60 hover:shadow-sm",
                "active:scale-[0.97]",
                active ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/25" : null,
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-transform duration-150 group-hover:scale-110">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium leading-tight">{label}</p>
                <p className="text-[10px] text-muted-foreground">{dir}</p>
              </div>
              <p className="shrink-0 text-[12px] font-semibold tabular-nums">{fmtCompact(volume)}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PaymentDetailModal({
  open,
  onClose,
  title,
  payments,
  clientIndex,
  revenues,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  payments: Payment[];
  clientIndex?: ClientIndex;
  revenues?: Record<string, RevenueLink>;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const total = payments.reduce((s, p) => s + num(p.amount), 0);

  async function handleDownloadA4(id: string) {
    setDownloading(id);
    try {
      const blob = await downloadPaymentVoucher(id, "a4");
      if (!(blob instanceof Blob)) throw new Error("Respuesta no es un archivo válido");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprobante_${id}_a4.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={title}
      description={`${formatCLP(total)} · ${payments.length} pago${payments.length === 1 ? "" : "s"}`}
    >
      <ModalBody className="pt-2">
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pagos en este grupo.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {payments.map((p) => {
              const isExpense = p.payment_direction === "EXPENSE";
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {p.payment_method_name || "Sin método"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {paymentOriginText(p, clientIndex, revenues)}
                      {(() => {
                        const corr = resolvePaymentCorrelative(p, clientIndex, revenues);
                        return corr ? ` · ${corr}` : "";
                      })()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-sm font-semibold tabular-nums",
                        isExpense ? "text-danger" : "text-success",
                      )}
                    >
                      {isExpense ? "−" : "+"}
                      {formatCLP(num(p.amount))}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handleDownloadA4(p.id)}
                      isLoading={downloading === p.id}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      A4
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ModalBody>
    </Modal>
  );
}

export default function MoneyReportPage() {
  const branch = useCurrentBranch();

  const [start, setStart] = useState(daysAgoInput(29));
  const [end, setEnd] = useState(fmtDateInput(new Date()));
  const [tab, setTab] = useState<TabKey>("resumen");
  const [detail, setDetail] = useState<{ kind: "client" | "method" | "source"; key: string } | null>(null);

  const { data: paymentsBundle, isLoading: loadingPayments } = useQuery({
    queryKey: ["money-report", "payments", start, end, branch?.branch_id],
    queryFn: () => fetchAllCompletedPayments(start, end),
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  const allPayments = paymentsBundle?.payments ?? [];
  const paymentsTruncated = Boolean(paymentsBundle?.truncated);
  const paymentsTotalCount = paymentsBundle?.totalCount ?? allPayments.length;

  const paymentsFingerprint = useMemo(
    () => allPayments.map((p) => `${p.id}:${p.order ?? ""}:${p.order_number ?? ""}`).join("|"),
    [allPayments],
  );

  const { data: clientIndex, isLoading: loadingIndex } = useQuery({
    queryKey: ["money-report", "client-index", start, end, branch?.branch_id, paymentsFingerprint],
    queryFn: () => buildPaymentClientIndex(allPayments, start, end),
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  const revenueIds = useMemo(
    () =>
      Array.from(
        new Set(allPayments.map((p) => p.revenue_id).filter((id): id is string => Boolean(id))),
      ),
    [allPayments],
  );

  const { data: revenueIndex, isLoading: loadingRevenues } = useQuery({
    queryKey: ["money-report", "revenue-index", start, end, branch?.branch_id, revenueIds.join(",")],
    queryFn: () => buildRevenueIndex(start, end, revenueIds),
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  const orderIdsByClient = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const o of clientIndex?.periodOrders ?? []) {
      const set = map.get(o.clientName) ?? new Set<string>();
      set.add(o.id);
      const numKey = normOrderNumber(o.order_number);
      if (numKey) set.add(`num:${numKey}`);
      if (o.order_number) set.add(`raw:${String(o.order_number).trim()}`);
      map.set(o.clientName, set);
    }
    return map;
  }, [clientIndex]);

  const rows = allPayments;

  const kpis = useMemo(() => {
    let income = 0;
    let expense = 0;
    let fees = 0;
    for (const p of rows) {
      if (p.payment_direction === "EXPENSE") expense += num(p.amount);
      else income += num(p.amount);
      fees += num(p.processing_fee_amount);
    }
    return { income, expense, net: income - expense, fees, count: rows.length };
  }, [rows]);

  const prevWindow = useMemo(() => previousWindow(start, end), [start, end]);
  const { data: prevBundle } = useQuery({
    queryKey: ["money-report", "payments-prev", prevWindow.start, prevWindow.end, branch?.branch_id],
    queryFn: () => fetchAllCompletedPayments(prevWindow.start, prevWindow.end),
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  const prevKpis = useMemo(() => {
    let income = 0;
    let expense = 0;
    const list = prevBundle?.payments ?? [];
    for (const p of list) {
      if (p.payment_direction === "EXPENSE") expense += num(p.amount);
      else income += num(p.amount);
    }
    return { income, expense, net: income - expense, count: list.length };
  }, [prevBundle]);

  const hasBase = prevKpis.count > 0;

  const byClient = useMemo(() => {
    const incomeOnly = rows.filter((p) => p.payment_direction !== "EXPENSE");
    return buildGroups(incomeOnly, (p) => resolveIncomeParty(p, clientIndex, revenueIndex));
  }, [rows, clientIndex, revenueIndex]);

  const byMethod = useMemo(
    () => buildGroups(rows, (p) => p.payment_method_name || "Sin método"),
    [rows],
  );
  const bySource = useMemo(
    () => buildGroups(rows, (p) => cashOriginLabel(p, clientIndex, revenueIndex)),
    [rows, clientIndex, revenueIndex],
  );

  const detailPayments = useMemo(() => {
    if (!detail) return [];
    const list =
      detail.kind === "method"
        ? rows.filter((p) => (p.payment_method_name || "Sin método") === detail.key)
        : detail.kind === "source"
          ? rows.filter((p) => cashOriginLabel(p, clientIndex, revenueIndex) === detail.key)
          : rows.filter((p) =>
              paymentMatchesIncomeParty(
                p,
                detail.key,
                clientIndex,
                orderIdsByClient,
                revenueIndex,
              ),
            );
    return [...list].sort((a, b) => num(b.amount) - num(a.amount));
  }, [detail, rows, clientIndex, orderIdsByClient, revenueIndex]);

  const loading = loadingPayments || loadingIndex || loadingRevenues;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <PageHeader
        title="Informe de dinero"
        subtitle="Pagos del período: lo recibido y lo pagado. Clic para ver el detalle."
        icon={<Wallet className="h-5 w-5" />}
        className="sticky top-0 z-20 glass-strong border-b"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Secciones del informe"
              className="glass-chip inline-flex items-center gap-0.5 rounded-xl p-1"
            >
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                      active
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="glass-chip inline-flex items-center gap-1 rounded-xl p-1">
              <input
                id="mr-start"
                type="date"
                value={start}
                max={end}
                onChange={(e) => {
                  const next = e.target.value;
                  setStart(next);
                  if (end < next) setEnd(next);
                }}
                className="rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus:bg-muted"
              />
              <span className="text-xs text-muted-foreground">-</span>
              <input
                id="mr-end"
                type="date"
                value={end}
                min={start}
                onChange={(e) => {
                  const next = e.target.value;
                  setEnd(next);
                  if (start > next) setStart(next);
                }}
                className="rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus:bg-muted"
              />
            </div>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {paymentsTruncated && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                Se muestran {allPayments.length.toLocaleString("es-CL")} de{" "}
                {paymentsTotalCount.toLocaleString("es-CL")} pagos. Acota el rango de fechas para verlos todos.
              </div>
            )}

            <ReportTabPanels activeKey={tab}>
              {tab === "resumen" ? (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <motion.div
                      variants={container}
                      initial="hidden"
                      animate="show"
                      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    >
                      <motion.div variants={item}>
                        <KpiTile
                          icon={TrendingUp}
                          label="Ingresos"
                          value={formatCLP(kpis.income)}
                          hint="Pagos recibidos"
                          tone="success"
                          delta={
                            hasBase ? (
                              <DeltaChip curr={kpis.income} prev={prevKpis.income} goodWhenUp />
                            ) : undefined
                          }
                        />
                      </motion.div>
                      <motion.div variants={item}>
                        <KpiTile
                          icon={TrendingDown}
                          label="Egresos"
                          value={formatCLP(kpis.expense)}
                          hint="Pagos realizados"
                          tone="danger"
                          delta={
                            hasBase ? (
                              <DeltaChip
                                curr={kpis.expense}
                                prev={prevKpis.expense}
                                goodWhenUp={false}
                              />
                            ) : undefined
                          }
                        />
                      </motion.div>
                      <motion.div variants={item}>
                        <KpiTile
                          icon={Wallet}
                          label="Neto"
                          value={formatCLP(kpis.net)}
                          hint="Recibido menos pagado"
                          tone={kpis.net >= 0 ? "primary" : "warning"}
                          delta={
                            hasBase ? (
                              <DeltaChip curr={kpis.net} prev={prevKpis.net} goodWhenUp />
                            ) : undefined
                          }
                        />
                      </motion.div>
                      <motion.div variants={item}>
                        <KpiTile
                          icon={Layers}
                          label="Pagos"
                          value={String(kpis.count)}
                          hint={
                            kpis.fees > 0
                              ? `Comisiones ${formatCLP(kpis.fees)}`
                              : "En el período"
                          }
                          tone="warning"
                          delta={
                            hasBase ? (
                              <DeltaChip curr={kpis.count} prev={prevKpis.count} goodWhenUp />
                            ) : undefined
                          }
                        />
                      </motion.div>
                    </motion.div>
                  </div>

                  <div className="grid items-start gap-6 lg:grid-cols-[minmax(13rem,0.9fr)_minmax(0,1.45fr)_minmax(13rem,0.9fr)]">
                    <section className="min-w-0 order-2 lg:order-1">
                      <ClientMoneyList
                        rows={byClient}
                        selectedKey={detail?.kind === "client" ? detail.key : null}
                        onSelect={(key) => setDetail({ kind: "client", key })}
                      />
                    </section>

                    <section className="min-w-0 order-1 lg:order-2">
                      <OriginChart
                        rows={bySource}
                        selectedKey={detail?.kind === "source" ? detail.key : null}
                        onSelect={(key) => setDetail({ kind: "source", key })}
                      />
                    </section>

                    <section className="min-w-0 order-3">
                      <MethodGallery
                        rows={byMethod}
                        payments={rows}
                        selectedKey={detail?.kind === "method" ? detail.key : null}
                        onSelect={(key) => setDetail({ kind: "method", key })}
                      />
                    </section>
                  </div>
                </div>
              ) : (
                <PaymentsTable rows={rows} clientIndex={clientIndex} revenues={revenueIndex} />
              )}
            </ReportTabPanels>
          </>
        )}
        <PaymentDetailModal
          open={Boolean(detail)}
          onClose={() => setDetail(null)}
          title={detail?.key ?? "Pagos"}
          payments={detailPayments}
          clientIndex={clientIndex}
          revenues={revenueIndex}
        />
      </div>
    </div>
  );
}

function PaymentsTable({
  rows,
  clientIndex,
  revenues,
}: {
  rows: Payment[];
  clientIndex?: ClientIndex;
  revenues?: Record<string, RevenueLink>;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownloadA4(id: string) {
    setDownloading(id);
    try {
      const blob = await downloadPaymentVoucher(id, "a4");
      if (!(blob instanceof Blob)) throw new Error("Respuesta no es un archivo válido");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprobante_${id}_a4.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  if (rows.length === 0) {
    return <EmptyState message="Sin movimientos con estos filtros." />;
  }

  return (
    <section>
      <p className="mb-3 text-xs text-muted-foreground">
        {rows.length} movimiento{rows.length === 1 ? "" : "s"} en el período · PDF A4 en cada fila
      </p>

      <div className="hidden md:block">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Fecha</th>
              <th className="px-3 pb-2 font-medium">Método</th>
              <th className="px-3 pb-2 font-medium">Origen</th>
              <th className="px-3 pb-2 font-medium">Orden</th>
              <th className="px-3 pb-2 text-center font-medium">Dir.</th>
              <th className="px-3 pb-2 text-right font-medium">Monto</th>
              <th className="px-3 pb-2 text-right font-medium">Neto</th>
              <th className="pb-2 pl-3 text-right font-medium">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((p) => {
              const isExpense = p.payment_direction === "EXPENSE";
              return (
                <tr key={p.id} className="transition-colors hover:bg-muted/20">
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {new Date(p.payment_date).toLocaleString("es-CL", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2.5">{p.payment_method_name || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {paymentOriginText(p, clientIndex, revenues)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">
                    {resolvePaymentCorrelative(p, clientIndex, revenues) || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        isExpense ? "bg-danger/10 text-danger" : "bg-success/10 text-success",
                      )}
                    >
                      {isExpense ? (
                        <ArrowDownLeft className="h-2.5 w-2.5" />
                      ) : (
                        <ArrowUpRight className="h-2.5 w-2.5" />
                      )}
                      {isExpense ? "Egreso" : "Ingreso"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {formatCLP(num(p.amount))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatCLP(num(p.net_amount))}
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-1.5 text-[10px] border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                        onClick={() => handleDownloadA4(p.id)}
                        isLoading={downloading === p.id}
                        title="Comprobante A4"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        A4
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border/50 md:hidden">
        {rows.map((p) => {
          const isExpense = p.payment_direction === "EXPENSE";
          return (
            <div key={p.id} className="flex flex-col gap-2 py-3 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold tabular-nums">{formatCLP(num(p.amount))}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    isExpense ? "bg-danger/10 text-danger" : "bg-success/10 text-success",
                  )}
                >
                  {isExpense ? "Egreso" : "Ingreso"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {p.payment_method_name}
                  {(() => {
                    const corr = resolvePaymentCorrelative(p, clientIndex, revenues);
                    return corr ? ` · ${corr}` : "";
                  })()}
                </span>
                <span className="shrink-0 tabular-nums">
                  {new Date(p.payment_date).toLocaleDateString("es-CL")}
                </span>
              </div>
              <div className="flex justify-end pt-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2 text-xs border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={() => handleDownloadA4(p.id)}
                  isLoading={downloading === p.id}
                >
                  <FileText className="h-3.5 w-3.5" />
                  A4
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
