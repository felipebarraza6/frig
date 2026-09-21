"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Download,
  Layers,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { DeltaChip, ReportNav, previousWindow } from "@/components/reports/report-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCurrentBranch } from "@/lib/store/session";
import { fetchPayments, fetchPaymentMethods } from "@/lib/api/payments";
import { fetchOrders } from "@/lib/api/orders";
import { searchCustomers } from "@/lib/api/customers";
import { formatCLP, cn } from "@/lib/utils";

type Payment = {
  id: string;
  amount: number;
  net_amount: number;
  processing_fee_amount?: number;
  status?: string;
  payment_source: string;
  payment_direction?: "INCOME" | "EXPENSE";
  payment_method_name: string;
  order_number?: string;
  order?: string | null;
  payment_date: string;
  reference?: string | null;
};

type TabKey = "resumen" | "transacciones" | "cliente" | "metodo" | "origen";

// Entrada escalonada (convención de la app).
const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 24 } },
};


const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "transacciones", label: "Transacciones" },
  { key: "cliente", label: "Por cliente" },
  { key: "metodo", label: "Por método" },
  { key: "origen", label: "Por origen" },
];

const MAX_PAGES = 4;
const PAGE_SIZE = 500;

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

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Descarga CSV (BOM para Excel) con lo que está en pantalla. */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

/** Barras horizontales de participación sobre el total del grupo. */
function ShareBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Gráfico de barras diarias (ingresos arriba / egresos abajo) sin librerías. */
function DailyBars({
  series,
}: {
  series: { day: string; income: number; expense: number }[];
}) {
  const max = Math.max(1, ...series.map((s) => Math.max(s.income, s.expense)));
  if (series.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sin movimientos en el período.
      </p>
    );
  }
  return (
    <div>
      <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ height: 160 }}>
        {series.map((s) => (
          <div
            key={s.day}
            className="flex min-w-[10px] flex-1 flex-col items-center justify-end gap-0.5"
            title={`${s.day} · Ingresos ${formatCLP(s.income)} · Egresos ${formatCLP(s.expense)}`}
          >
            <div className="flex w-full items-end justify-center gap-px" style={{ height: 130 }}>
              <motion.div
                className="w-1/2 origin-bottom rounded-t bg-primary/80"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                style={{ height: `${(s.income / max) * 100}%` }}
              />
              <motion.div
                className="w-1/2 origin-bottom rounded-t bg-danger/60"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
                style={{ height: `${(s.expense / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-primary/80" /> Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-danger/60" /> Egresos
        </span>
      </div>
    </div>
  );
}

export default function MoneyReportPage() {
  const branch = useCurrentBranch();

  // ── Filtros ──────────────────────────────────────────────────────────
  const [start, setStart] = useState(daysAgoInput(29));
  const [end, setEnd] = useState(fmtDateInput(new Date()));
  const [methodFilter, setMethodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"COMPLETED" | "ALL">("COMPLETED");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [debouncedClientQuery, setDebouncedClientQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("resumen");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientQuery(clientQuery), 250);
    return () => clearTimeout(t);
  }, [clientQuery]);

  const { data: methods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  const { data: clientResults = [] } = useQuery({
    queryKey: ["money-report", "clients", debouncedClientQuery, branch?.branch_id],
    queryFn: () =>
      searchCustomers(
        debouncedClientQuery,
        branch?.branch_id ? Number(branch.branch_id) : undefined,
      ),
    enabled: debouncedClientQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  // ── Pagos del período (varias páginas) ───────────────────────────────
  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: [
      "money-report", "payments", start, end, methodFilter,
      statusFilter, branch?.branch_id,
    ],
    queryFn: async () => {
      const all: Payment[] = [];
      let next: string | null | undefined = undefined;
      let first = true;
      for (let page = 0; page < MAX_PAGES; page++) {
        const data = await fetchPayments({
          payment_date__gte: start ? `${start}T00:00:00` : undefined,
          payment_date__lte: end ? `${end}T23:59:59` : undefined,
          payment_method: methodFilter || undefined,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          page_size: PAGE_SIZE,
          next: first ? undefined : next,
          previous: undefined,
        });
        all.push(...(data.results ?? []) as unknown as Payment[]);
        next = data.next;
        first = false;
        if (!next) break;
      }
      return all;
    },
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  // ── Órdenes del período: para atribuir pagos a clientes ─────────────
  const { data: orderClients } = useQuery({
    queryKey: ["money-report", "order-clients", start, end, branch?.branch_id],
    queryFn: async () => {
      const map = new Map<string, string>();
      let next: string | null | undefined = undefined;
      let first = true;
      for (let page = 0; page < 3; page++) {
        const data = await fetchOrders({
          start_date: start || undefined,
          end_date: end || undefined,
          page_size: 200,
          next: first ? undefined : next,
        });
        for (const o of data.results ?? []) {
          map.set(String(o.id), (o.client as { name?: string } | null)?.name ?? "Sin cliente");
        }
        next = data.next;
        first = false;
        if (!next) break;
      }
      return map;
    },
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  // ── Filtrado por cliente + enriquecimiento ──────────────────────────
  const rows = useMemo(() => {
    let list = payments ?? [];
    if (clientId) {
      const allowed = new Set<string>();
      for (const [orderId, name] of orderClients ?? []) {
        if (clientId && name === clientName) allowed.add(orderId);
      }
      list = list.filter(
        (p) => p.order && allowed.has(String(p.order)),
      );
    }
    return list;
  }, [payments, clientId, clientName, orderClients]);

  // ── KPIs ─────────────────────────────────────────────────────────────
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

  // Período anterior (misma duración, inmediatamente previo): base PoP.
  const prevWindow = useMemo(() => previousWindow(start, end), [start, end]);
  const { data: prevPayments } = useQuery({
    queryKey: ["money-report", "payments-prev", prevWindow.start, prevWindow.end, methodFilter, statusFilter, branch?.branch_id],
    queryFn: async () => {
      const all: (typeof rows)[number][] = [];
      let next: string | null | undefined = undefined;
      let first = true;
      for (let page = 0; page < 2; page++) {
        const data = await fetchPayments({
          payment_date__gte: prevWindow.start ? prevWindow.start + "T00:00:00" : undefined,
          payment_date__lte: prevWindow.end ? prevWindow.end + "T23:59:59" : undefined,
          payment_method: methodFilter || undefined,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          page_size: PAGE_SIZE,
          next: first ? undefined : next,
        });
        all.push(...((data.results ?? []) as (typeof rows)[number][]));
        next = data.next;
        first = false;
        if (!next) break;
      }
      return all;
    },
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  const prevKpis = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const p of prevPayments ?? []) {
      if (p.payment_direction === "EXPENSE") expense += num(p.amount);
      else income += num(p.amount);
    }
    return { income, expense, net: income - expense, count: (prevPayments ?? []).length };
  }, [prevPayments]);

  // Base comparable: hay datos del período anterior.
  const hasBase = prevKpis.count > 0;

  // ── Serie diaria ─────────────────────────────────────────────────────
  const daily = useMemo(() => {
    const map = new Map<string, { day: string; income: number; expense: number }>();
    for (const p of rows) {
      const d = dayKey(p.payment_date);
      const g = map.get(d) ?? { day: d, income: 0, expense: 0 };
      if (p.payment_direction === "EXPENSE") g.expense += num(p.amount);
      else g.income += num(p.amount);
      map.set(d, g);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [rows]);

  const byClient = useMemo(
    () => buildGroups(rows, (p) => orderClients?.get(String(p.order)) ?? "Sin atribuir"),
    [rows, orderClients],
  );
  const byMethod = useMemo(() => buildGroups(rows, (p) => p.payment_method_name), [rows]);
  const bySource = useMemo(
    () => buildGroups(rows, (p) => {
      const labels: Record<string, string> = {
        ORDER: "Ventas", EXPENSE: "Gastos", REVENUE: "Ingresos manuales",
        REFUND: "Reembolsos", OTHER: "Otros",
      };
      return labels[p.payment_source] ?? p.payment_source;
    }),
    [rows],
  );

  const clientSuggestions = useMemo(() => {
    const seen = new Set<string>();
    return (clientResults as { id: number; name?: string }[]).filter((c) => {
      if (!c.name || seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });
  }, [clientResults]);

  function exportCsv() {
    if (tab === "transacciones") {
      downloadCsv(
        `movimientos_${start}_${end}.csv`,
        ["Fecha", "Método", "Origen", "Orden", "Referencia", "Monto", "Neto", "Dirección"],
        rows.map((p) => [
          new Date(p.payment_date).toLocaleString("es-CL"),
          p.payment_method_name,
          p.payment_source,
          p.order_number ?? "",
          p.reference ?? "",
          num(p.amount),
          num(p.net_amount),
          p.payment_direction === "EXPENSE" ? "Egreso" : "Ingreso",
        ]),
      );
      return;
    }
    const groups =
      tab === "cliente" ? byClient : tab === "metodo" ? byMethod : tab === "origen" ? bySource : null;
    if (groups) {
      downloadCsv(
        `dinero_por_${tab}_${start}_${end}.csv`,
        [tab === "cliente" ? "Cliente" : tab === "metodo" ? "Método" : "Origen", "Pagos", "Ingresos", "Egresos", "Neto"],
        groups.map((g) => [g.key, g.count, g.income, g.expense, g.net]),
      );
    }
  }

  const loading = loadingPayments;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col p-4 pt-6 sm:px-6 sm:pt-6">
      <PageHeader
        title="Informe de dinero"
        subtitle="Converge pagos, clientes y métodos en un solo informe. Filtra, agrupa y exporta."
        icon={<Wallet className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-5">
        <ReportNav active="/reports/dinero" />
        {/* Filtros */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="mr-start" className="text-xs text-muted-foreground">Desde</label>
              <Input
                id="mr-start" type="date" value={start}
                onChange={(e) => setStart(e.target.value)} className="h-9 w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="mr-end" className="text-xs text-muted-foreground">Hasta</label>
              <Input
                id="mr-end" type="date" value={end}
                onChange={(e) => setEnd(e.target.value)} className="h-9 w-[150px]"
              />
            </div>
            <div className="flex gap-1 pb-0.5">
              {[
                { label: "30 días", s: daysAgoInput(29) },
                { label: "90 días", s: daysAgoInput(89) },
                { label: "Este año", s: `${new Date().getFullYear()}-01-01` },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setStart(p.s); setEnd(fmtDateInput(new Date())); }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    start === p.s && end === fmtDateInput(new Date())
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap items-end gap-2">
              <div className="w-[220px]">
                <SearchableSelect
                  options={clientSuggestions.map((c) => ({
                    value: String(c.id),
                    label: c.name ?? "Sin nombre",
                  }))}
                  value={clientId}
                  onChange={(value) => {
                    const c = clientSuggestions.find((x) => String(x.id) === value);
                    setClientId(value);
                    setClientName(c?.name ?? "");
                  }}
                  onQueryChange={setClientQuery}
                  minChars={2}
                  selectedOption={clientId ? { value: clientId, label: clientName } : null}
                  placeholder="Filtrar cliente…"
                  searchPlaceholder="Nombre del cliente…"
                  emptyMessage="Sin clientes"
                />
              </div>
              <Select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="h-9 w-[170px]"
                aria-label="Filtrar por método de pago"
              >
                <option value="">Todos los métodos</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "COMPLETED" | "ALL")}
                className="h-9 w-[150px]"
                aria-label="Filtrar por estado"
              >
                <option value="COMPLETED">Solo completados</option>
                <option value="ALL">Todos los estados</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Secciones del informe" className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : tab === "resumen" ? (
          <div className="flex flex-col gap-4">
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 divide-x divide-y lg:divide-y-0 divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-4">
              <motion.div variants={item}>
                <KpiCard icon={TrendingUp} label="Ingresos" value={formatCLP(kpis.income)} tone="success" delta={hasBase ? <DeltaChip curr={kpis.income} prev={prevKpis.income} /> : undefined} />
              </motion.div>
              <motion.div variants={item}>
                <KpiCard icon={TrendingDown} label="Egresos" value={formatCLP(kpis.expense)} tone="danger" delta={hasBase ? <DeltaChip curr={kpis.expense} prev={prevKpis.expense} goodWhenUp={false} /> : undefined} />
              </motion.div>
              <motion.div variants={item}>
                <KpiCard icon={Wallet} label="Neto" value={formatCLP(kpis.net)} delta={hasBase ? <DeltaChip curr={kpis.net} prev={prevKpis.net} /> : undefined} />
              </motion.div>
              <motion.div variants={item}>
                <KpiCard icon={Layers} label="Pagos" value={String(kpis.count)} hint={`Comisiones ${formatCLP(kpis.fees)}`} delta={hasBase ? <DeltaChip curr={kpis.count} prev={prevKpis.count} /> : undefined} />
              </motion.div>
            </motion.div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                </span>
                <h3 className="text-sm font-semibold">Evolución diaria</h3>
                <span className="ml-auto text-[11px] text-muted-foreground">{daily.length} día(s) con movimientos</span>
              </div>
              <DailyBars series={daily} />
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="grid min-w-0 divide-y lg:grid-cols-2 lg:divide-y-0 lg:divide-x divide-border">
                <GroupPanel title="Top clientes" icon={Users} rows={byClient.slice(0, 6)} full />
                <GroupPanel title="Por método de pago" icon={Wallet} rows={byMethod.slice(0, 6)} full />
              </div>
            </div>
          </div>
        ) : tab === "transacciones" ? (
          <PaymentsTable rows={rows} />
        ) : (
          <GroupPanel
            title={
              tab === "cliente" ? "Convergido por cliente"
              : tab === "metodo" ? "Convergido por método de pago"
              : "Convergido por origen"
            }
            icon={tab === "cliente" ? Users : Layers}
            rows={
              tab === "cliente" ? byClient : tab === "metodo" ? byMethod : bySource
            }
            full
          />
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, tone, hint, delta,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone?: "success" | "danger";
  hint?: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-2 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
            <Icon className={cn(
              "h-3 w-3 text-primary",
              tone === "success" && "text-success",
              tone === "danger" && "text-danger",
            )} />
          </span>
          {label}
        </span>
        {delta}
      </div>
      <span className={cn(
        "text-2xl font-semibold tabular-nums tracking-tight",
        tone === "success" && "text-success",
        tone === "danger" && "text-danger",
      )}>
        {value}
      </span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function GroupPanel({
  title, icon: Icon, rows, full,
}: {
  title: string;
  icon: typeof Users;
  rows: GroupRow[];
  full?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.income + r.expense));
  return (
    <section className={cn("min-w-0 bg-card", full ? "" : "rounded-2xl border border-border shadow-sm")}>
      <div className={cn("flex items-center gap-2", full ? "px-4 pt-4 pb-3" : "mb-3")}>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} grupo(s)</span>
      </div>
      {rows.length === 0 ? (
        <p className={cn("text-sm text-muted-foreground", full ? "px-4 pb-4" : "")}>
          Sin datos en el período.
        </p>
      ) : (
        <div className={cn("overflow-hidden", full ? "" : "")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Detalle</th>
                <th className="px-3 py-2 text-center">Pagos</th>
                <th className="px-3 py-2 text-right">Ingresos</th>
                <th className="px-3 py-2 text-right">Egresos</th>
                <th className="px-4 py-2 text-right">Neto</th>
                <th className="w-28 px-3 py-2">Participación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((g) => (
                <tr key={g.key} className="transition-colors hover:bg-muted/30">
                  <td className="max-w-[220px] truncate px-4 py-2.5 font-medium">{g.key}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{g.count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-success">{formatCLP(g.income)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-danger">{formatCLP(g.expense)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCLP(g.net)}</td>
                  <td className="px-3 py-2.5">
                    <ShareBar value={g.income + g.expense} max={max} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PaymentsTable({ rows }: { rows: Payment[] }) {
  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border py-14 text-center">
        <div>
          <ArrowUpRight className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Sin movimientos con estos filtros</p>
          <p className="text-xs text-muted-foreground">Ajusta fechas, método o cliente.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-background shadow-sm">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Fecha</th>
            <th className="px-3 py-3">Método</th>
            <th className="px-3 py-3">Origen</th>
            <th className="px-3 py-3">Orden</th>
            <th className="px-3 py-3">Referencia</th>
            <th className="px-3 py-3 text-center">Dir.</th>
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-right">Neto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-2.5 text-muted-foreground">
                {new Date(p.payment_date).toLocaleString("es-CL", {
                  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                })}
              </td>
              <td className="px-3 py-2.5">{p.payment_method_name}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{p.payment_source}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{p.order_number || "—"}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{p.reference || "—"}</td>
              <td className="px-3 py-2.5 text-center">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    p.payment_direction === "EXPENSE"
                      ? "bg-danger/10 text-danger"
                      : "bg-success/10 text-success",
                  )}
                >
                  {p.payment_direction === "EXPENSE"
                    ? <ArrowDownLeft className="h-2.5 w-2.5" />
                    : <ArrowUpRight className="h-2.5 w-2.5" />}
                  {p.payment_direction === "EXPENSE" ? "Egreso" : "Ingreso"}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCLP(num(p.amount))}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatCLP(num(p.net_amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
