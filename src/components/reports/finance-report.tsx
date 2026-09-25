"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  FileText,
  Percent,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { pctChange, previousWindow, ReportTabPanels } from "@/components/reports/report-kit";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentBranch } from "@/lib/store/session";
import { useDownloadFile } from "@/lib/hooks/useDownloadFile";
import { daysAgoInput, fmtDateInput } from "@/lib/date-range";
import { downloadExpenseVoucher, fetchExpenses } from "@/lib/api/expenses";
import { downloadRevenueVoucher, fetchRevenues } from "@/lib/api/revenues";
import { fetchOrder, fetchOrders } from "@/lib/api/orders";
import { formatCLP, cn, orderTypeLabel } from "@/lib/utils";

type Variant = "gastos" | "ingresos";
type TabKey = "resumen" | "detalle" | "grupo";
type GroupDim = "categoria" | "estado" | "contraparte";

type FinanceRow = {
  id: string;
  name?: string;
  title?: string;
  description?: string | null;
  category_name?: string;
  category?: string | number;
  supplier?: string | null;
  customer_name?: string | null;
  /** Cliente de la OV cuando el ingreso nace de una venta u orden. */
  order_client_name?: string | null;
  order?: string | null;
  order_number?: string | null;
  order_type?: string | null;
  order_type_display?: string | null;
  order_tax_document_number?: string | null;
  invoice_number?: string | null;
  reference?: string | null;
  amount?: number | string;
  total_paid?: number | string;
  pending_amount?: number | string;
  status?: string;
  status_display?: string;
  start_date?: string;
  received_date?: string | null;
  revenue_date?: string;
  frequency_display?: string;
  [key: string]: unknown;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "detalle", label: "Detalle" },
  { key: "grupo", label: "Por grupo" },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 24 } },
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pendingOf(r: FinanceRow): number {
  const pending = num(r.pending_amount);
  if (pending > 0) return pending;
  return Math.max(num(r.amount) - num(r.total_paid), 0);
}

function withHash(raw: string): string {
  const t = raw.trim();
  if (!t) return "#—";
  return t.startsWith("#") ? t : `#${t}`;
}

/** Quita el prefijo "Venta/Orden/Convenio" del título auto-generado. */
function stripOrderTypePrefix(title: string): string {
  return title
    .replace(/^(venta|orden|convenio)\s*[:·\-–]?\s*/i, "")
    .replace(/^#\s*/, "")
    .trim();
}

/**
 * Ingresos ligados a OV: correlativo de orden/boleta (#…) + tipo.
 * El listado de revenues NO trae order_number; hay que resolverlo desde /sales/orders.
 * Si no hay correlativo aún, no inventamos UUID (queda "—" hasta resolver).
 */
function revenueIdentity(r: FinanceRow): { correlative: string; kind: string | null; subtitle: string | null } {
  const orderType = String(r.order_type ?? "").trim();
  const hasOrder = Boolean(r.order) || Boolean(orderType);
  const kind = hasOrder
    ? orderTypeLabel(orderType) !== "—"
      ? orderTypeLabel(orderType)
      : r.order_type_display?.trim() || "Orden"
    : null;

  if (hasOrder) {
    const fromTitle = stripOrderTypePrefix(r.title ?? "");
    const looksLikeNumber =
      Boolean(fromTitle) && (/[0-9]/.test(fromTitle) || /^[A-Z0-9._/-]+$/i.test(fromTitle));
    const raw =
      String(r.order_number ?? "").trim() ||
      String(r.order_tax_document_number ?? "").trim() ||
      (looksLikeNumber ? fromTitle : "") ||
      String(r.invoice_number ?? "").trim() ||
      String(r.reference ?? "").trim();
    const correlative = raw ? withHash(raw) : withHash("—");
    const client =
      r.order_client_name?.trim() ||
      r.customer_name?.trim() ||
      (!looksLikeNumber && fromTitle ? fromTitle : null) ||
      null;
    return { correlative, kind, subtitle: client };
  }

  const correlative = withHash(
    String(r.invoice_number ?? "").trim() ||
      String(r.reference ?? "").trim() ||
      r.id.slice(0, 8).toUpperCase(),
  );
  const title = (r.title ?? "").trim();
  const subtitle = title && title !== correlative.replace(/^#/, "") ? title : null;
  return { correlative, kind: null, subtitle };
}

/** Índice order UUID → order_number (correlativo legible). Record por structuralSharing. */
async function buildOrderNumberIndex(
  start: string,
  end: string,
  orderIds: string[],
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

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
      const num = String(o.order_number ?? "").trim();
      if (num) map[String(o.id)] = num;
    }
    next = data.next;
    first = false;
    if (!next) break;
  }

  const missing = Array.from(new Set(orderIds.filter((id) => id && !map[id]))).slice(0, 120);
  for (let i = 0; i < missing.length; i += 8) {
    const chunk = missing.slice(i, i + 8);
    await Promise.all(
      chunk.map(async (id) => {
        try {
          const order = await fetchOrder(id);
          const num = String(order.order_number ?? "").trim();
          if (num) map[id] = num;
        } catch {
          /* ignore */
        }
      }),
    );
  }

  return map;
}

function revenuePrimaryLabel(r: FinanceRow): string {
  const { correlative, kind } = revenueIdentity(r);
  return kind ? `${correlative} · ${kind}` : correlative;
}

function RevenueNameCell({ r }: { r: FinanceRow }) {
  const { correlative, kind, subtitle } = revenueIdentity(r);
  return (
    <div className="min-w-0">
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="truncate font-mono text-[13px] font-semibold tracking-tight">{correlative}</span>
        {kind ? (
          <span
            className={cn(
              "inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              kind === "Venta"
                ? "bg-primary/12 text-primary"
                : kind === "Orden"
                  ? "bg-warning/15 text-warning"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {kind}
          </span>
        ) : null}
      </p>
      {subtitle ? (
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Delta compacto: no rompe la línea del KPI. */
function CompactDelta({
  curr,
  prev,
  goodWhenUp = true,
}: {
  curr: number;
  prev: number;
  goodWhenUp?: boolean;
}) {
  const pct = pctChange(curr, prev);
  if (pct === null || !Number.isFinite(pct) || prev <= 0) {
    return <span className="text-[10px] tabular-nums text-muted-foreground/70">vs ant. —</span>;
  }
  if (pct === 0) {
    return <span className="text-[10px] tabular-nums text-muted-foreground/70">vs ant. 0%</span>;
  }
  const up = pct > 0;
  const good = goodWhenUp ? up : !up;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
        good ? "text-success" : "text-danger",
      )}
      title={`${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs período anterior`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(pct).toFixed(1)}%
      <span className="font-normal text-muted-foreground/70"> vs ant.</span>
    </span>
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
    <div className={cn("flex flex-col gap-2.5 rounded-2xl p-4 sm:p-5", t.surface)}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", t.chip)}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-foreground">{label}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <p className={cn("font-display text-2xl font-semibold tabular-nums tracking-tight", t.value)}>
          {value}
        </p>
        {delta ? <div className="min-h-[1rem]">{delta}</div> : null}
      </div>
    </div>
  );
}

const CONFIG = {
  gastos: {
    titulo: "Informe de gastos",
    subtitle: "Proyectado vs pagado: lo comprometido y lo que ya salió de caja.",
    icono: TrendingDown,
    goodWhenUp: false as boolean,
    totalTone: "danger" as const,
    paidTone: "warning" as const,
    pendingTone: "primary" as const,
    fetcher: (
      _branchId: number | undefined,
      start: string,
      end: string,
      category: string,
      search: string,
      next?: string | null,
    ) =>
      fetchExpenses({
        startDate: start || undefined,
        endDate: end || undefined,
        category: category || undefined,
        search: search || undefined,
        next: next ?? undefined,
        page_size: 200,
      }),
    monto: (r: FinanceRow) => num(r.amount),
    pagado: (r: FinanceRow) => num(r.total_paid),
    pendiente: (r: FinanceRow) => pendingOf(r),
    contraparte: (r: FinanceRow) => r.supplier ?? "Sin proveedor",
    contraparteLabel: "Proveedor",
    nombre: (r: FinanceRow) => r.name ?? "—",
    labelTotal: "Total",
    hintTotal: "Suma del período",
    labelPaid: "Pagado",
    hintPaid: "Ya liquidado / salió de caja",
    labelPending: "Proyectado",
    hintPending: "Aún esperado / sin pagar",
    labelPct: "% pagado",
    searchPlaceholder: "Buscar gasto, proveedor…",
    voucherLabel: "Comprobante de gasto",
    voucherFilePrefix: "comprobante_gasto",
  },
  ingresos: {
    titulo: "Informe de ingresos",
    subtitle: "Proyectado vs pagado: lo esperado y lo que ya entró.",
    icono: TrendingUp,
    goodWhenUp: true as boolean,
    totalTone: "success" as const,
    paidTone: "primary" as const,
    pendingTone: "warning" as const,
    fetcher: (
      _branchId: number | undefined,
      start: string,
      end: string,
      category: string,
      search: string,
      next?: string | null,
    ) =>
      fetchRevenues({
        startDate: start || undefined,
        endDate: end || undefined,
        category: category || undefined,
        search: search || undefined,
        next: next ?? undefined,
        page_size: 200,
      }),
    monto: (r: FinanceRow) => num(r.amount),
    pagado: (r: FinanceRow) => num(r.total_paid),
    pendiente: (r: FinanceRow) => pendingOf(r),
    contraparte: (r: FinanceRow) =>
      r.customer_name?.trim() || r.order_client_name?.trim() || "Sin cliente",
    contraparteLabel: "Cliente",
    nombre: (r: FinanceRow) => revenuePrimaryLabel(r),
    labelTotal: "Total",
    hintTotal: "Suma del período",
    labelPaid: "Pagado",
    hintPaid: "Ya recibido / entró a caja",
    labelPending: "Proyectado",
    hintPending: "Aún esperado / sin cobrar",
    labelPct: "% pagado",
    searchPlaceholder: "Buscar ingreso, cliente…",
    voucherLabel: "Comprobante de ingreso",
    voucherFilePrefix: "comprobante_ingreso",
  },
} as const;

function payStatus(r: FinanceRow, variant: Variant): { label: string; className: string } {
  const paid = num(r.total_paid);
  const pending = pendingOf(r);
  const st = (r.status ?? "").toUpperCase();
  if (st === "CANCELLED" || st === "REFUNDED") {
    return {
      label: r.status_display ?? st,
      className: "bg-danger/10 text-danger",
    };
  }
  if (pending <= 0 && paid > 0) {
    return {
      label: "Pagado",
      className: "bg-success/10 text-success",
    };
  }
  if (paid > 0 && pending > 0) {
    return { label: "Parcial", className: "bg-warning/10 text-warning" };
  }
  return {
    label: "Proyectado",
    className: "bg-muted text-muted-foreground",
  };
}

export function FinanceReportView({ variant }: { variant: Variant }) {
  const cfg = CONFIG[variant];
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : undefined;

  const [start, setStart] = useState(daysAgoInput(29));
  const [end, setEnd] = useState(fmtDateInput(new Date()));
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupDim, setGroupDim] = useState<GroupDim>("categoria");
  const [tab, setTab] = useState<TabKey>("resumen");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [detailSide, setDetailSide] = useState<"paid" | "pending" | null>(null);

  const { download: downloadFile } = useDownloadFile();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const prevWindow = useMemo(() => previousWindow(start, end), [start, end]);

  const { data: page, isLoading } = useQuery({
    queryKey: ["finance-report", variant, branchId, start, end, debouncedSearch],
    queryFn: async () => {
      const all: FinanceRow[] = [];
      let next: string | null | undefined = undefined;
      for (let pageIdx = 0; pageIdx < 5; pageIdx++) {
        const data: { results?: FinanceRow[]; next?: string | null } = await cfg.fetcher(
          branchId,
          start,
          end,
          "",
          debouncedSearch,
          pageIdx === 0 ? undefined : next,
        );
        all.push(...((data.results ?? []) as FinanceRow[]));
        next = data.next;
        if (!next) break;
      }
      return all;
    },
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });

  const { data: prevPage } = useQuery({
    queryKey: [
      "finance-report",
      variant,
      "prev",
      prevWindow.start,
      prevWindow.end,
      debouncedSearch,
    ],
    queryFn: async () => {
      const all: FinanceRow[] = [];
      let next: string | null | undefined = undefined;
      for (let pageIdx = 0; pageIdx < 5; pageIdx++) {
        const data: { results?: FinanceRow[]; next?: string | null } = await cfg.fetcher(
          branchId,
          prevWindow.start,
          prevWindow.end,
          "",
          debouncedSearch,
          pageIdx === 0 ? undefined : next,
        );
        all.push(...((data.results ?? []) as FinanceRow[]));
        next = data.next;
        if (!next) break;
      }
      return all;
    },
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });

  const rowsRaw = useMemo(() => page ?? [], [page]);
  const prevRows = useMemo(() => prevPage ?? [], [prevPage]);

  const linkedOrderIds = useMemo(() => {
    if (variant !== "ingresos") return "";
    return Array.from(
      new Set(
        rowsRaw
          .map((r) => (r.order ? String(r.order) : ""))
          .filter(Boolean),
      ),
    )
      .sort()
      .join(",");
  }, [variant, rowsRaw]);

  const { data: orderNumberById = {} } = useQuery({
    queryKey: ["finance-report", "order-numbers", branchId, start, end, linkedOrderIds],
    queryFn: () =>
      buildOrderNumberIndex(
        start,
        end,
        linkedOrderIds ? linkedOrderIds.split(",") : [],
      ),
    enabled: Boolean(branchId) && variant === "ingresos" && linkedOrderIds.length > 0,
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    if (variant !== "ingresos") return rowsRaw;
    return rowsRaw.map((r) => {
      if (!r.order) return r;
      if (String(r.order_number ?? "").trim()) return r;
      const resolved = orderNumberById[String(r.order)];
      return resolved ? { ...r, order_number: resolved } : r;
    });
  }, [variant, rowsRaw, orderNumberById]);

  const kpis = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;
    for (const r of rows) {
      total += cfg.monto(r);
      paid += cfg.pagado(r);
      pending += cfg.pendiente(r);
    }
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total, paid, pending, count: rows.length, pct };
  }, [rows, cfg]);

  const prevKpis = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;
    for (const r of prevRows) {
      total += cfg.monto(r);
      paid += cfg.pagado(r);
      pending += cfg.pendiente(r);
    }
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total, paid, pending, count: prevRows.length, pct };
  }, [prevRows, cfg]);

  const hasBase = prevKpis.count > 0;

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; count: number; total: number; paid: number; pending: number }
    >();
    for (const r of rows) {
      const key =
        groupDim === "categoria"
          ? (r.category_name ?? "Sin categoría")
          : groupDim === "estado"
            ? payStatus(r, variant).label
            : cfg.contraparte(r);
      const g = map.get(key) ?? { key, count: 0, total: 0, paid: 0, pending: 0 };
      g.count += 1;
      g.total += cfg.monto(r);
      g.paid += cfg.pagado(r);
      g.pending += cfg.pendiente(r);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows, groupDim, cfg, variant]);

  /** Resumen siempre por tipo/categoría (sin filtros de tags). */
  const categoryGroups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; count: number; total: number; paid: number; pending: number }
    >();
    for (const r of rows) {
      const key = r.category_name ?? "Sin categoría";
      const g = map.get(key) ?? { key, count: 0, total: 0, paid: 0, pending: 0 };
      g.count += 1;
      g.total += cfg.monto(r);
      g.paid += cfg.pagado(r);
      g.pending += cfg.pendiente(r);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows, cfg]);

  function rowGroupKey(r: FinanceRow): string {
    if (groupDim === "categoria") return r.category_name ?? "Sin categoría";
    if (groupDim === "estado") return payStatus(r, variant).label;
    return cfg.contraparte(r);
  }

  const detailRows = useMemo(() => {
    let list = rows;
    if (detailKey) {
      list = list.filter((r) => rowGroupKey(r) === detailKey);
    }
    if (detailSide === "paid") {
      list = list.filter((r) => cfg.pagado(r) > 0);
    } else if (detailSide === "pending") {
      list = list.filter((r) => cfg.pendiente(r) > 0);
    }
    return [...list].sort((a, b) => cfg.monto(b) - cfg.monto(a));
    // rowGroupKey/cfg stable via groupDim/variant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, detailKey, detailSide, groupDim, cfg, variant]);

  const detailGroup = detailKey
    ? categoryGroups.find((g) => g.key === detailKey) ?? groups.find((g) => g.key === detailKey)
    : null;

  function openGroupDetail(key: string) {
    setDetailSide(null);
    setDetailKey(key);
  }

  function openSideDetail(side: "paid" | "pending") {
    setDetailKey(null);
    setDetailSide(side);
  }

  function closeDetail() {
    setDetailKey(null);
    setDetailSide(null);
  }

  async function handleDownloadA4(id: string) {
    setDownloading(id);
    try {
      const filename = `${cfg.voucherFilePrefix}_${id.slice(0, 8)}_a4.pdf`;
      if (variant === "gastos") {
        await downloadFile(() => downloadExpenseVoucher(id), { filename });
      } else {
        await downloadFile(() => downloadRevenueVoucher(id, "a4"), { filename });
      }
    } finally {
      setDownloading(null);
    }
  }

  function openCategoryDetail(key: string) {
    setGroupDim("categoria");
    setDetailSide(null);
    setDetailKey(key);
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <PageHeader
        title={cfg.titulo}
        subtitle={cfg.subtitle}
        icon={<cfg.icono className="h-5 w-5" />}
        className="sticky top-0 z-20 glass-strong border-b"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Secciones del informe"
              className="glass-chip inline-flex rounded-xl p-1"
            >
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    tab === t.key
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="glass-chip inline-flex items-center gap-1 rounded-xl p-1">
              <input
                id={`fr-${variant}-start`}
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
                id={`fr-${variant}-end`}
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

      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={cfg.searchPlaceholder}
            aria-label="Buscar"
            className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/50"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <ReportTabPanels activeKey={tab} className="flex flex-col gap-5">
            {tab === "resumen" ? (
              <>
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <motion.div variants={item}>
                    <KpiTile
                      icon={cfg.icono}
                      label={cfg.labelTotal}
                      value={formatCLP(kpis.total)}
                      hint={cfg.hintTotal}
                      tone={cfg.totalTone}
                      delta={
                        hasBase ? (
                          <CompactDelta
                            curr={kpis.total}
                            prev={prevKpis.total}
                            goodWhenUp={cfg.goodWhenUp}
                          />
                        ) : undefined
                      }
                    />
                  </motion.div>
                  <motion.div variants={item}>
                    <KpiTile
                      icon={Wallet}
                      label={cfg.labelPaid}
                      value={formatCLP(kpis.paid)}
                      hint={cfg.hintPaid}
                      tone={cfg.paidTone}
                      delta={
                        hasBase ? (
                          <CompactDelta
                            curr={kpis.paid}
                            prev={prevKpis.paid}
                            goodWhenUp={cfg.goodWhenUp}
                          />
                        ) : undefined
                      }
                    />
                  </motion.div>
                  <motion.div variants={item}>
                    <KpiTile
                      icon={Clock}
                      label={cfg.labelPending}
                      value={formatCLP(kpis.pending)}
                      hint={cfg.hintPending}
                      tone={cfg.pendingTone}
                      delta={
                        hasBase ? (
                          <CompactDelta
                            curr={kpis.pending}
                            prev={prevKpis.pending}
                            goodWhenUp={false}
                          />
                        ) : undefined
                      }
                    />
                  </motion.div>
                  <motion.div variants={item}>
                    <KpiTile
                      icon={Percent}
                      label={cfg.labelPct}
                      value={`${kpis.pct}%`}
                      hint={`${kpis.count} registro${kpis.count === 1 ? "" : "s"} · ${formatCLP(kpis.paid)} de ${formatCLP(kpis.total)}`}
                      tone="warning"
                      delta={
                        hasBase ? (
                          <CompactDelta
                            curr={kpis.pct}
                            prev={prevKpis.pct}
                            goodWhenUp={cfg.goodWhenUp}
                          />
                        ) : undefined
                      }
                    />
                  </motion.div>
                </motion.div>

                {/* Barra visual pagado vs proyectado — hover + clic abre detalle */}
                {kpis.total > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="group/mix flex h-3.5 w-full overflow-hidden rounded-full bg-muted transition-[height] hover:h-4">
                      <button
                        type="button"
                        disabled={kpis.paid <= 0}
                        title={`${cfg.labelPaid}: ${formatCLP(kpis.paid)}`}
                        aria-label={`${cfg.labelPaid}: ${formatCLP(kpis.paid)}. Abrir detalle.`}
                        onClick={() => openSideDetail("paid")}
                        className={cn(
                          "relative h-full transition-[width,filter] disabled:cursor-default",
                          variant === "gastos" ? "bg-warning/80" : "bg-primary/80",
                          kpis.paid > 0 && "cursor-pointer hover:brightness-110",
                        )}
                        style={{ width: `${Math.min(100, kpis.pct)}%` }}
                      />
                      <button
                        type="button"
                        disabled={kpis.pending <= 0}
                        title={`${cfg.labelPending}: ${formatCLP(kpis.pending)}`}
                        aria-label={`${cfg.labelPending}: ${formatCLP(kpis.pending)}. Abrir detalle.`}
                        onClick={() => openSideDetail("pending")}
                        className={cn(
                          "relative h-full transition-[width,filter] disabled:cursor-default",
                          variant === "gastos" ? "bg-danger/35" : "bg-success/25",
                          kpis.pending > 0 && "cursor-pointer hover:brightness-110",
                        )}
                        style={{ width: `${Math.max(0, 100 - kpis.pct)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <button
                        type="button"
                        disabled={kpis.paid <= 0}
                        onClick={() => openSideDetail("paid")}
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground disabled:cursor-default"
                      >
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            variant === "gastos" ? "bg-warning" : "bg-primary",
                          )}
                        />
                        {cfg.labelPaid} {formatCLP(kpis.paid)}
                      </button>
                      <button
                        type="button"
                        disabled={kpis.pending <= 0}
                        onClick={() => openSideDetail("pending")}
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground disabled:cursor-default"
                      >
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            variant === "gastos" ? "bg-danger/50" : "bg-success/40",
                          )}
                        />
                        {cfg.labelPending} {formatCLP(kpis.pending)}
                      </button>
                      <span className="ml-auto text-[10px]">Clic en barra o leyenda → detalle</span>
                    </div>
                  </div>
                )}

                {categoryGroups.length > 0 && (
                  <CategoryBreakdown
                    groups={categoryGroups}
                    variant={variant}
                    labelPaid={cfg.labelPaid}
                    labelPending={cfg.labelPending}
                    selectedKey={detailKey}
                    onSelect={openCategoryDetail}
                  />
                )}
              </>
            ) : tab === "detalle" ? (
              <DetailTable
                rows={rows}
                variant={variant}
                cfg={cfg}
                downloading={downloading}
                onDownload={handleDownloadA4}
              />
            ) : (
              <section className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Agrupar por</span>
                  {(
                    [
                      { key: "categoria", label: "Categoría" },
                      { key: "contraparte", label: cfg.contraparteLabel },
                      { key: "estado", label: "Estado" },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setGroupDim(d.key)}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                        groupDim === d.key
                          ? "bg-primary text-white"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Click en una fila para ver el detalle de registros
                  </p>
                  <table className="w-full min-w-[720px] text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 pr-3 font-medium">Detalle</th>
                        <th className="px-3 pb-2 text-center font-medium">Regs.</th>
                        <th className="px-3 pb-2 text-right font-medium">{cfg.labelTotal}</th>
                        <th className="px-3 pb-2 text-right font-medium">{cfg.labelPaid}</th>
                        <th className="px-3 pb-2 text-right font-medium">{cfg.labelPending}</th>
                        <th className="w-28 pb-2 pl-3 font-medium">Mix</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {groups.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-muted-foreground">
                            Sin registros con estos filtros.
                          </td>
                        </tr>
                      ) : (
                        groups.map((g) => {
                          const paidPct = g.total > 0 ? Math.round((g.paid / g.total) * 100) : 0;
                          const active = detailKey === g.key;
                          return (
                            <tr
                              key={g.key}
                              role="button"
                              tabIndex={0}
                              onClick={() => openGroupDetail(g.key)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openGroupDetail(g.key);
                                }
                              }}
                              className={cn(
                                "cursor-pointer transition-colors",
                                active
                                  ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/25"
                                  : "hover:bg-muted/30",
                              )}
                            >
                              <td className="max-w-[220px] truncate py-2.5 pr-3 font-medium">
                                {g.key}
                              </td>
                              <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                                {g.count}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                                {formatCLP(g.total)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-success">
                                {formatCLP(g.paid)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-warning">
                                {formatCLP(g.pending)}
                              </td>
                              <td className="py-2.5 pl-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary/70"
                                      style={{ width: `${paidPct}%` }}
                                    />
                                  </div>
                                  <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
                                    {paidPct}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </ReportTabPanels>
        )}
      </div>

      <GroupDetailModal
        open={Boolean(detailKey || detailSide)}
        onClose={closeDetail}
        title={
          detailKey
            ? detailKey
            : detailSide === "paid"
              ? cfg.labelPaid
              : detailSide === "pending"
                ? cfg.labelPending
                : "Detalle"
        }
        description={
          detailKey && detailGroup
            ? `${formatCLP(detailGroup.total)} ${cfg.labelTotal.toLowerCase()} · ${formatCLP(detailGroup.paid)} ${cfg.labelPaid.toLowerCase()} · ${detailRows.length} registro${detailRows.length === 1 ? "" : "s"}`
            : detailSide
              ? `${detailRows.length} registro${detailRows.length === 1 ? "" : "s"} · ${formatCLP(detailRows.reduce((s, r) => s + (detailSide === "paid" ? cfg.pagado(r) : cfg.pendiente(r)), 0))}`
              : undefined
        }
        rows={detailRows}
        variant={variant}
        cfg={cfg}
        downloading={downloading}
        onDownload={handleDownloadA4}
      />
    </div>
  );
}

function CategoryBreakdown({
  groups,
  variant,
  labelPaid,
  labelPending,
  selectedKey,
  onSelect,
}: {
  groups: { key: string; count: number; total: number; paid: number; pending: number }[];
  variant: Variant;
  labelPaid: string;
  labelPending: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const max = Math.max(...groups.map((g) => g.total), 1);
  const paidTone = variant === "gastos" ? "bg-warning" : "bg-primary";
  const pendingTone = variant === "gastos" ? "bg-danger/40" : "bg-success/35";
  const [tip, setTip] = useState<{
    key: string;
    x: number;
    y: number;
    total: number;
    paid: number;
    pending: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!tip) return;
    const clear = () => setTip(null);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
    };
  }, [tip]);

  function showTip(
    el: HTMLElement,
    g: { key: string; total: number; paid: number; pending: number },
  ) {
    const rect = el.getBoundingClientRect();
    const width = 280;
    const x = Math.min(
      Math.max(rect.left + rect.width / 2, width / 2 + 8),
      window.innerWidth - width / 2 - 8,
    );
    setTip({
      key: g.key,
      x,
      y: rect.top,
      total: g.total,
      paid: g.paid,
      pending: g.pending,
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-foreground/25" />
          Total
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-sm", paidTone)} />
          {labelPaid}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-sm", pendingTone)} />
          {labelPending}
        </span>
        <span className="ml-auto tabular-nums">pasa el mouse · clic = detalle</span>
      </div>

      <div
        className="overflow-x-auto rounded-xl border border-border/50 bg-muted/10"
        role="list"
        aria-label="Desglose por tipo. Clic para abrir detalle."
      >
        <div className="hidden min-w-[640px] grid-cols-[minmax(8rem,1.4fr)_minmax(0,1.2fr)_5.5rem_5.5rem_5.5rem] gap-2 px-3 pb-1 pt-2.5 text-[10px] uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Tipo</span>
          <span>Mix</span>
          <span className="text-right">Total</span>
          <span className="text-right">{labelPaid}</span>
          <span className="text-right">{labelPending}</span>
        </div>

        <ul className="min-w-[640px] divide-y divide-border/40">
          {groups.map((g, i) => {
            const barPct = Math.round((g.total / max) * 100);
            const paidShare = g.total > 0 ? (g.paid / g.total) * 100 : 0;
            const pendingShare = g.total > 0 ? (g.pending / g.total) * 100 : 0;
            const active = selectedKey === g.key;

            return (
              <li key={g.key} className="relative">
                <button
                  type="button"
                  role="listitem"
                  onClick={() => onSelect(g.key)}
                  onMouseEnter={(e) => showTip(e.currentTarget, g)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={(e) => showTip(e.currentTarget, g)}
                  onBlur={() => setTip(null)}
                  aria-label={`${g.key}: total ${formatCLP(g.total)}, ${labelPaid.toLowerCase()} ${formatCLP(g.paid)}, ${labelPending.toLowerCase()} ${formatCLP(g.pending)}. Abrir detalle.`}
                  className={cn(
                    "grid w-full grid-cols-[minmax(8rem,1.4fr)_minmax(0,1.2fr)_5.5rem_5.5rem_5.5rem] items-center gap-2 px-3 py-2.5 text-left transition-colors",
                    active
                      ? "bg-primary/[0.1] ring-1 ring-inset ring-primary/30"
                      : "hover:bg-background/80",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium leading-tight">{g.key}</p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {g.count} registro{g.count === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <div
                      className={cn(
                        "flex h-3 w-full overflow-hidden rounded-full bg-background/80 ring-1 ring-inset transition-[height,box-shadow] hover:h-3.5 hover:ring-primary/30 sm:h-3.5 sm:hover:h-4",
                        active ? "ring-primary/40" : "ring-border/40",
                        tip?.key === g.key && "h-3.5 ring-primary/30 sm:h-4",
                      )}
                    >
                      <motion.div
                        className="flex h-full overflow-hidden"
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ duration: 0.45, ease: "easeOut", delay: i * 0.03 }}
                      >
                        {paidShare > 0 && (
                          <div
                            className={cn("h-full", paidTone)}
                            style={{ width: `${paidShare}%` }}
                          />
                        )}
                        {pendingShare > 0 && (
                          <div
                            className={cn("h-full", pendingTone)}
                            style={{ width: `${pendingShare}%` }}
                          />
                        )}
                      </motion.div>
                    </div>
                  </div>

                  <span className="text-right text-[12px] font-semibold tabular-nums">
                    {formatCLP(g.total)}
                  </span>
                  <span className="text-right text-[12px] tabular-nums text-success">
                    {formatCLP(g.paid)}
                  </span>
                  <span className="text-right text-[12px] tabular-nums text-warning">
                    {formatCLP(g.pending)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {mounted &&
        tip &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] shadow-lg"
            style={{ left: tip.x, top: tip.y }}
          >
            <p className="font-medium text-foreground">{tip.key}</p>
            <p className="mt-0.5 flex gap-2 tabular-nums text-muted-foreground">
              <span>Total {formatCLP(tip.total)}</span>
              <span className="text-success">
                {labelPaid} {formatCLP(tip.paid)}
              </span>
              <span className="text-warning">
                {labelPending} {formatCLP(tip.pending)}
              </span>
            </p>
          </div>,
          document.body,
        )}
    </section>
  );
}

function GroupDetailModal({
  open,
  onClose,
  title,
  description,
  rows,
  variant,
  cfg,
  downloading,
  onDownload,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  rows: FinanceRow[];
  variant: Variant;
  cfg: (typeof CONFIG)[Variant];
  downloading: string | null;
  onDownload: (id: string) => Promise<void>;
}) {
  return (
    <Modal open={open} onClose={onClose} size="md" title={title} description={description}>
      <ModalBody className="pt-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin registros en este grupo.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => {
              const st = payStatus(r, variant);
              const busy = downloading === r.id;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    {variant === "ingresos" ? (
                      <RevenueNameCell r={r} />
                    ) : (
                      <p className="truncate text-[13px] font-medium">{cfg.nombre(r)}</p>
                    )}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          st.className,
                        )}
                      >
                        {st.label}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">{formatCLP(cfg.monto(r))}</span>
                      <span className="text-border">·</span>
                      <span className="tabular-nums text-success">{formatCLP(cfg.pagado(r))}</span>
                      {cfg.pendiente(r) > 0 && (
                        <>
                          <span className="text-border">·</span>
                          <span className="tabular-nums text-warning">
                            {formatCLP(cfg.pendiente(r))}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1 px-2 text-xs border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={() => onDownload(r.id)}
                    isLoading={busy}
                    title={cfg.voucherLabel}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    A4
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </ModalBody>
    </Modal>
  );
}

function DetailTable({
  rows,
  variant,
  cfg,
  downloading,
  onDownload,
}: {
  rows: FinanceRow[];
  variant: Variant;
  cfg: (typeof CONFIG)[Variant];
  downloading: string | null;
  onDownload: (id: string) => Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Sin registros con estos filtros.
      </p>
    );
  }

  return (
    <section>
      <p className="mb-3 text-xs text-muted-foreground">
        {rows.length} registro{rows.length === 1 ? "" : "s"} · {cfg.labelTotal.toLowerCase()} /{" "}
        {cfg.labelPaid.toLowerCase()} / {cfg.labelPending.toLowerCase()} · {cfg.voucherLabel}
      </p>

      <div className="hidden md:block">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Nombre</th>
              <th className="px-3 pb-2 font-medium">Categoría</th>
              <th className="px-3 pb-2 font-medium">{cfg.contraparteLabel}</th>
              <th className="px-3 pb-2 font-medium">Estado</th>
              <th className="px-3 pb-2 text-right font-medium">{cfg.labelTotal}</th>
              <th className="px-3 pb-2 text-right font-medium">{cfg.labelPaid}</th>
              <th className="px-3 pb-2 text-right font-medium">{cfg.labelPending}</th>
              <th className="pb-2 pl-3 text-right font-medium">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((r) => {
              const st = payStatus(r, variant);
              return (
                <tr key={r.id} className="transition-colors hover:bg-muted/20">
                  <td className="max-w-[220px] py-2.5 pr-3">
                    {variant === "ingresos" ? (
                      <RevenueNameCell r={r} />
                    ) : (
                      <span className="truncate font-medium">{cfg.nombre(r)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {variant === "ingresos" && (r.order || r.order_type)
                      ? orderTypeLabel(String(r.order_type ?? "")) !== "—"
                        ? orderTypeLabel(String(r.order_type ?? ""))
                        : r.order_type_display || "—"
                      : (r.category_name ?? "—")}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{cfg.contraparte(r)}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        st.className,
                      )}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {formatCLP(cfg.monto(r))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-success">
                    {formatCLP(cfg.pagado(r))}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-warning">
                    {formatCLP(cfg.pendiente(r))}
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-1.5 text-[10px] border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                        onClick={() => onDownload(r.id)}
                        isLoading={downloading === r.id}
                        title={cfg.voucherLabel}
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
        {rows.map((r) => {
          const st = payStatus(r, variant);
          return (
            <div key={r.id} className="flex flex-col gap-2 py-3 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                {variant === "ingresos" ? (
                  <RevenueNameCell r={r} />
                ) : (
                  <span className="truncate text-sm font-medium">{cfg.nombre(r)}</span>
                )}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    st.className,
                  )}
                >
                  {st.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {variant === "ingresos" && (r.order || r.order_type)
                  ? orderTypeLabel(String(r.order_type ?? "")) !== "—"
                    ? orderTypeLabel(String(r.order_type ?? ""))
                    : r.order_type_display || "—"
                  : (r.category_name ?? "—")}{" "}
                · {cfg.contraparte(r)}
              </p>
              <div className="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                <div>
                  <p className="text-muted-foreground">{cfg.labelTotal}</p>
                  <p className="font-semibold">{formatCLP(cfg.monto(r))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{cfg.labelPaid}</p>
                  <p className="font-semibold text-success">{formatCLP(cfg.pagado(r))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{cfg.labelPending}</p>
                  <p className="font-semibold text-warning">{formatCLP(cfg.pendiente(r))}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2 text-xs border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={() => onDownload(r.id)}
                  isLoading={downloading === r.id}
                  title={cfg.voucherLabel}
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
