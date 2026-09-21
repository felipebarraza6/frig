"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Download,
  Layers,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { ReportKpi, previousWindow } from "@/components/reports/report-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCurrentBranch } from "@/lib/store/session";
import { exportOrdersFile, fetchOrders } from "@/lib/api/orders";
import { formatCLP, cn, orderStatusLabel, orderTypeLabel } from "@/lib/utils";

type OrderRow = {
  id: string;
  order_number?: string;
  order_type: string;
  status: string;
  date: string;
  total_amount?: number | string;
  total_cost?: number | string;
  client?: { name?: string } | null;
};

type TabKey = "resumen" | "ordenes" | "cliente" | "tipo";

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
  { key: "ordenes", label: "Órdenes" },
  { key: "cliente", label: "Por cliente" },
  { key: "tipo", label: "Por tipo" },
];

const MAX_PAGES = 20;
const PAGE_SIZE = 200;

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
  return `$${v}`;
}


interface GroupRow {
  key: string;
  count: number;
  total: number;
  cost: number;
  margin: number;
}

function buildGroups(orders: OrderRow[], dimension: (o: OrderRow) => string): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const o of orders) {
    const key = dimension(o) || "—";
    const g = map.get(key) ?? { key, count: 0, total: 0, cost: 0, margin: 0 };
    g.count += 1;
    const total = num(o.total_amount);
    const cost = num(o.total_cost);
    g.total += total;
    g.cost += cost;
    g.margin = g.total - g.cost;
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function ShareBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <div className="h-1.5 min-w-4 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-[10px] font-medium tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: "bg-success/10 text-success",
  PENDING: "bg-warning/10 text-warning",
  IN_PROGRESS: "bg-primary/10 text-primary",
  CANCELLED: "bg-danger/10 text-danger",
  RETURNED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-muted text-muted-foreground",
  DRAFT: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_BADGE[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {orderStatusLabel(status)}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
        <Receipt className="h-4.5 w-4.5 text-muted-foreground" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}


/** Delta PoP estandarizado para los informes. */
function KpiDelta({ curr, prev, goodWhenUp = true }: { curr: number; prev: number; goodWhenUp?: boolean }) {
  const pct = prev > 0 ? ((curr - prev) / prev) * 100 : null;
  if (pct === null) {
    return <span className="text-[11px] text-muted-foreground">sin base</span>;
  }
  const up = pct >= 0;
  const good = goodWhenUp ? up : !up;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        good ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
      )}
      title={`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs período anterior`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function GroupPanel({ title, icon: Icon, rows, full }: {
  title: string; icon: typeof Users; rows: GroupRow[]; full?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  const totalAll = rows.reduce((acc, r) => acc + r.total, 0);
  return (
    <section className="min-w-0">
      <div className={cn("flex items-center gap-2.5", full ? "px-4 pt-4 pb-3 sm:px-5" : "p-4 pb-3")}>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{rows.length} grupo(s)</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState message="Sin datos en el período." />
      ) : (
        <>
          {/* Tabla en escritorio */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-y border-border/60 bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium sm:px-5">Detalle</th>
                  <th className="px-3 py-2 text-center font-medium">Órdenes</th>
                  <th className="px-3 py-2 text-right font-medium">Ventas</th>
                  <th className="px-3 py-2 text-right font-medium">Margen</th>
                  <th className="w-32 px-4 py-2 font-medium sm:px-5">Participación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((g) => (
                  <tr key={g.key} className="transition-colors hover:bg-muted/30">
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-medium sm:px-5">{g.key}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{g.count}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatCLP(g.total)}</td>
                    <td className={cn(
                      "px-3 py-2.5 text-right tabular-nums",
                      g.margin >= 0 ? "text-success" : "text-danger",
                    )}>
                      {formatCLP(g.margin)}
                    </td>
                    <td className="px-4 py-2.5 sm:px-5">
                      <ShareBar value={g.total} max={max} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/60 bg-muted/20 text-[13px] font-semibold">
                  <td className="px-4 py-2.5 sm:px-5">Total</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {rows.reduce((a, r) => a + r.count, 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCLP(totalAll)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatCLP(rows.reduce((a, r) => a + r.margin, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Tarjetas en móvil */}
          <div className="divide-y divide-border/60 border-t border-border/60 md:hidden">
            {rows.map((g) => (
              <div key={g.key} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{g.key}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{formatCLP(g.total)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{g.count} orden(es)</span>
                  <span className={cn("font-medium tabular-nums", g.margin >= 0 ? "text-success" : "text-danger")}>
                    Margen {formatCLP(g.margin)}
                  </span>
                </div>
                <ShareBar value={g.total} max={max} />
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 bg-muted/20 px-4 py-2.5 text-[13px] font-semibold">
              <span>Total · {rows.reduce((a, r) => a + r.count, 0)} orden(es)</span>
              <span className="tabular-nums">{formatCLP(totalAll)}</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function SalesReportPage() {
  const branch = useCurrentBranch();

  const [start, setStart] = useState(daysAgoInput(29));
  const [end, setEnd] = useState(fmtDateInput(new Date()));
  const [typeFilter, setTypeFilter] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [tab, setTab] = useState<TabKey>("resumen");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["sales-report", "orders", start, end, typeFilter, branch?.branch_id],
    queryFn: async () => {
      const all: OrderRow[] = [];
      let next: string | null | undefined = undefined;
      for (let page = 0; page < MAX_PAGES && (page === 0 || next); page++) {
        const data = await fetchOrders({
          start_date: start || undefined,
          end_date: end || undefined,
          order_type: typeFilter || undefined,
          page_size: PAGE_SIZE,
          next: page === 0 ? undefined : next,
        });
        all.push(...(data.results ?? []) as unknown as OrderRow[]);
        next = data.next;
      }
      return all;
    },
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    let list = orders ?? [];
    if (clientId) {
      list = list.filter((o) => (o.client?.name ?? "") === clientName);
    }
    return list;
  }, [orders, clientId, clientName]);

  // Período anterior de igual duración: base de la comparación PoP.
  const prevWindow = useMemo(() => previousWindow(start, end), [start, end]);
  const { data: prevOrders } = useQuery({
    queryKey: ["sales-report", "orders-prev", prevWindow, typeFilter, branch?.branch_id],
    queryFn: async () => {
      const all: OrderRow[] = [];
      let next: string | null | undefined = undefined;
      for (let page = 0; page < MAX_PAGES && (page === 0 || next); page++) {
        const data = await fetchOrders({
          start_date: prevWindow.start || undefined,
          end_date: prevWindow.end || undefined,
          order_type: typeFilter || undefined,
          page_size: PAGE_SIZE,
          next: page === 0 ? undefined : next,
        });
        all.push(...(data.results ?? []) as unknown as OrderRow[]);
        next = data.next;
      }
      return { results: all };
    },
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  // fetchOrders devuelve el objeto paginado: extraer el array de resultados.
  const prevRows = useMemo(() => prevOrders?.results ?? [], [prevOrders]);

  const prevKpis = useMemo(() => {
    let total = 0;
    let cost = 0;
    const clients = new Set<string>();
    for (const o of prevRows) {
      total += num(o.total_amount);
      cost += num(o.total_cost);
      const c = (o.client as { name?: string } | null)?.name;
      if (c) clients.add(c);
    }
    return { total, margin: total - cost, count: prevRows.length, clients: clients.size };
  }, [prevRows]);

  const kpis = useMemo(() => {
    let total = 0;
    let cost = 0;
    for (const o of rows) {
      total += num(o.total_amount);
      cost += num(o.total_cost);
    }
    const margin = total - cost;
    return {
      total,
      margin,
      count: rows.length,
      ticket: rows.length > 0 ? total / rows.length : 0,
      marginPct: total > 0 ? Math.round((margin / total) * 100) : 0,
    };
  }, [rows]);

  // Vuelta de comparación por KPI (solo si hay datos del período anterior).
  const hasBase = prevKpis.count > 0 || prevRows.length > 0;

  const daily = useMemo(() => {
    const map = new Map<string, { day: string; total: number }>();
    for (const o of rows) {
      const d = (o.date || "").slice(0, 10);
      if (!d) continue;
      const g = map.get(d) ?? { day: d, total: 0 };
      g.total += num(o.total_amount);
      map.set(d, g);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [rows]);

  const byClient = useMemo(
    () => buildGroups(rows, (o) => o.client?.name ?? "Sin cliente"),
    [rows],
  );
  const byType = useMemo(
    () => buildGroups(rows, (o) => orderTypeLabel(o.order_type)),
    [rows],
  );

  // Clientes con ventas en el período cargado: evita el límite del buscador
  // y asegura que se pueda filtrar por cualquiera que tenga órdenes visibles.
  const clientOptions = useMemo(() => {
    const names = new Set<string>();
    for (const o of orders ?? []) {
      const name = o.client?.name?.trim();
      if (name) names.add(name);
    }
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [orders]);

  function exportCsv() {
    // Export nativo de la API: el backend genera el XLSX con los filtros activos.
    const hasOrders = rows.length > 0;
    if (!hasOrders) return;
    exportOrdersFile({
      start_date: start || undefined,
      end_date: end || undefined,
      order_type: typeFilter === "all" ? undefined : typeFilter,
    }).then((result) => {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ventas_${start}_${end}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col p-4 pt-6 sm:px-6 sm:pt-6">
      <PageHeader
        title="Informe de ventas"
        subtitle="Analiza y navega las ventas del período: por cliente, tipo y día."
        icon={<TrendingUp className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4">
        {/* Barra de control única: navegación + tabs + fechas + filtros en una sola fila */}
        <div className="rounded-2xl border border-border bg-background p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div role="tablist" aria-label="Secciones del informe" className="flex flex-wrap gap-1 rounded-xl bg-muted/40 p-1">
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
            <div className="ml-auto flex flex-wrap items-end gap-2 sm:gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="sv-start" className="text-xs text-muted-foreground">Desde</label>
                <Input id="sv-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-[130px] sm:w-[140px]" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="sv-end" className="text-xs text-muted-foreground">Hasta</label>
                <Input id="sv-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-[130px] sm:w-[140px]" />
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
              <div className="w-full sm:w-[220px]">
                <SearchableSelect
                  options={clientOptions}
                  value={clientId}
                  onChange={(value) => {
                    setClientId(value);
                    setClientName(value);
                  }}
                  selectedOption={clientId ? { value: clientId, label: clientName } : null}
                  placeholder="Filtrar cliente…"
                  searchPlaceholder="Buscar cliente…"
                  emptyMessage="Sin clientes en el período"
                />
              </div>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 w-full sm:w-[160px]"
                aria-label="Filtrar por tipo"
              >
                <option value="">Todos los tipos</option>
                <option value="SALE">Ventas directas</option>
                <option value="ORDER">Pedidos</option>
                <option value="AGREEMENT">Convenios</option>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : tab === "resumen" ? (
          <div className="flex flex-col gap-4">
            <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <motion.div variants={item}>
                <ReportKpi icon={TrendingUp} label="Ventas" value={formatCLP(kpis.total)} tone="emerald" delta={hasBase ? <KpiDelta curr={kpis.total} prev={prevKpis.total} goodWhenUp /> : undefined} />
              </motion.div>
              <motion.div variants={item}>
                <ReportKpi icon={Receipt} label="Órdenes" value={String(kpis.count)} tone="blue" hint={`Ticket promedio ${formatCLP(kpis.ticket)}`} delta={hasBase ? <KpiDelta curr={kpis.count} prev={prevKpis.count} goodWhenUp /> : undefined} />
              </motion.div>
              <motion.div variants={item}>
                <ReportKpi icon={Layers} label="Margen" value={formatCLP(kpis.margin)} tone="amber" delta={hasBase ? <KpiDelta curr={kpis.margin} prev={prevKpis.margin} goodWhenUp /> : undefined} />
              </motion.div>
              <motion.div variants={item}>
                <ReportKpi icon={Users} label="Clientes" value={String(byClient.length)} tone="rose" delta={hasBase ? <KpiDelta curr={byClient.length} prev={prevKpis.clients} goodWhenUp /> : undefined} />
              </motion.div>
            </motion.div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                </span>
                <h3 className="text-sm font-semibold">Ventas por día</h3>
                <span className="ml-auto text-[11px] text-muted-foreground">{daily.length} día(s) con ventas</span>
              </div>
              {daily.length === 0 ? (
                <EmptyState message="Sin ventas en el período." />
              ) : (
                <div className="flex h-[190px] items-end gap-1 overflow-x-auto pb-1 sm:gap-1.5">
                  {daily.map((s) => {
                    const max = Math.max(...daily.map((x) => x.total), 1);
                    return (
                      <div
                        key={s.day}
                        className="group flex h-full min-w-[16px] flex-1 flex-col items-center justify-end gap-1"
                        title={`${s.day} · ${formatCLP(s.total)}`}
                      >
                        <span className="text-[9px] font-semibold tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                          {fmtCompact(s.total)}
                        </span>
                        <motion.div
                          className="w-full max-w-[26px] origin-bottom rounded-t-md bg-gradient-to-t from-primary/35 to-primary transition-colors group-hover:to-primary/80"
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.45, ease: "easeOut" }}
                          style={{ height: `${Math.max(4, (s.total / max) * 140)}px` }}
                        />
                        <span className="text-[9px] tabular-nums text-muted-foreground">
                          {s.day.slice(8)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="grid min-w-0 divide-y xl:grid-cols-2 xl:divide-y-0 xl:divide-x divide-border">
                <GroupPanel title="Top clientes" icon={Users} rows={byClient.slice(0, 6)} full />
                <GroupPanel title="Por tipo" icon={Layers} rows={byType} full />
              </div>
            </div>
          </div>
        ) : tab === "ordenes" ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3.5 sm:px-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Receipt className="h-3.5 w-3.5 text-primary" />
              </span>
              <h3 className="text-sm font-semibold">Órdenes</h3>
              <span className="ml-auto text-[11px] text-muted-foreground">{rows.length} orden(es)</span>
            </div>
            {/* Tabla en escritorio */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium sm:px-5">Fecha</th>
                    <th className="px-3 py-2.5 font-medium">N°</th>
                    <th className="px-3 py-2.5 font-medium">Tipo</th>
                    <th className="px-3 py-2.5 font-medium">Estado</th>
                    <th className="px-3 py-2.5 font-medium">Cliente</th>
                    <th className="px-3 py-2.5 text-right font-medium">Total</th>
                    <th className="px-4 py-2.5 text-right font-medium sm:px-5">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState message="Sin ventas con estos filtros." />
                      </td>
                    </tr>
                  ) : (
                    rows.map((o) => {
                      const margin = num(o.total_amount) - num(o.total_cost);
                      return (
                        <tr key={o.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-2.5 text-muted-foreground sm:px-5">
                            {new Date(o.date).toLocaleDateString("es-CL")}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{o.order_number || "—"}</td>
                          <td className="px-3 py-2.5">{orderTypeLabel(o.order_type)}</td>
                          <td className="px-3 py-2.5"><StatusBadge status={o.status} /></td>
                          <td className="max-w-[160px] truncate px-3 py-2.5">{o.client?.name ?? "Sin cliente"}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatCLP(num(o.total_amount))}</td>
                          <td className={cn(
                            "px-4 py-2.5 text-right tabular-nums sm:px-5",
                            margin >= 0 ? "text-success" : "text-danger",
                          )}>
                            {formatCLP(margin)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Tarjetas en móvil */}
            <div className="divide-y divide-border/60 md:hidden">
              {rows.length === 0 ? (
                <EmptyState message="Sin ventas con estos filtros." />
              ) : (
                rows.map((o) => {
                  const margin = num(o.total_amount) - num(o.total_cost);
                  return (
                    <div key={o.id} className="flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold tabular-nums">{formatCLP(num(o.total_amount))}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          {o.order_number ? `${o.order_number} · ` : ""}{orderTypeLabel(o.order_type)}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {new Date(o.date).toLocaleDateString("es-CL")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-foreground/80">{o.client?.name ?? "Sin cliente"}</span>
                        <span className={cn("shrink-0 font-medium tabular-nums", margin >= 0 ? "text-success" : "text-danger")}>
                          Margen {formatCLP(margin)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <GroupPanel
              title={tab === "cliente" ? "Ventas por cliente" : "Ventas por tipo"}
              icon={tab === "cliente" ? Users : Layers}
              rows={tab === "cliente" ? byClient : byType}
              full
            />
          </div>
        )}
      </div>
    </div>
  );
}
