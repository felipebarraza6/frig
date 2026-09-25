"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCurrentBranch } from "@/lib/store/session";
import { fetchOrders } from "@/lib/api/orders";
import { searchCustomers } from "@/lib/api/customers";
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

const MAX_PAGES = 3;
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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint }: {
  icon: typeof Receipt; label: string; value: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-background p-4 shadow-sm">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function GroupPanel({ title, icon: Icon, rows, full }: {
  title: string; icon: typeof Users; rows: GroupRow[]; full?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="rounded-2xl border border-border bg-background shadow-sm">
      <div className={cn("flex items-center gap-2", full ? "px-4 pt-4 pb-3" : "p-4 pb-3")}>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} grupo(s)</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">Sin datos en el período.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2">Detalle</th>
              <th className="px-3 py-2 text-center">Órdenes</th>
              <th className="px-3 py-2 text-right">Ventas</th>
              <th className="px-3 py-2 text-right">Margen</th>
              <th className="w-24 px-4 py-2">Participación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((g) => (
              <tr key={g.key} className="transition-colors hover:bg-muted/30">
                <td className="max-w-[200px] truncate px-4 py-2.5 font-medium">{g.key}</td>
                <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{g.count}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatCLP(g.total)}</td>
                <td className={cn(
                  "px-3 py-2.5 text-right tabular-nums",
                  g.margin >= 0 ? "text-success" : "text-danger",
                )}>
                  {formatCLP(g.margin)}
                </td>
                <td className="px-4 py-2.5"><ShareBar value={g.total} max={max} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function SalesReportPage() {
  const branch = useCurrentBranch();

  const [start, setStart] = useState(daysAgoInput(29));
  const [end, setEnd] = useState(fmtDateInput(new Date()));
  const [typeFilter, setTypeFilter] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [debouncedClientQuery, setDebouncedClientQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("resumen");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientQuery(clientQuery), 250);
    return () => clearTimeout(t);
  }, [clientQuery]);

  const { data: clientResults = [] } = useQuery({
    queryKey: ["sales-report", "clients", debouncedClientQuery, branch?.branch_id],
    queryFn: () =>
      searchCustomers(
        debouncedClientQuery,
        branch?.branch_id ? Number(branch.branch_id) : undefined,
      ),
    enabled: debouncedClientQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["sales-report", "orders", start, end, typeFilter, branch?.branch_id],
    queryFn: async () => {
      const all: OrderRow[] = [];
      let next: string | null | undefined = undefined;
      let first = true;
      for (let page = 0; page < MAX_PAGES; page++) {
        const data = await fetchOrders({
          start_date: start || undefined,
          end_date: end || undefined,
          order_type: typeFilter || undefined,
          page_size: PAGE_SIZE,
          next: first ? undefined : next,
        });
        all.push(...(data.results ?? []) as unknown as OrderRow[]);
        next = data.next;
        first = false;
        if (!next) break;
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

  const clientSuggestions = useMemo(() => {
    const seen = new Set<string>();
    return (clientResults as { id: number; name?: string }[]).filter((c) => {
      if (!c.name || seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });
  }, [clientResults]);

  function exportCsv() {
    if (tab === "ordenes") {
      downloadCsv(
        `ventas_${start}_${end}.csv`,
        ["Fecha", "N°", "Tipo", "Estado", "Cliente", "Total", "Costo"],
        rows.map((o) => [
          new Date(o.date).toLocaleDateString("es-CL"),
          o.order_number ?? o.id,
          orderTypeLabel(o.order_type),
          orderStatusLabel(o.status),
          o.client?.name ?? "Sin cliente",
          num(o.total_amount),
          num(o.total_cost),
        ]),
      );
      return;
    }
    const groups = tab === "cliente" ? byClient : tab === "tipo" ? byType : null;
    if (groups) {
      downloadCsv(
        `ventas_por_${tab}_${start}_${end}.csv`,
        ["Detalle", "Órdenes", "Ventas", "Costo", "Margen"],
        groups.map((g) => [g.key, g.count, g.total, g.cost, g.margin]),
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
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

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Filtros */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="sv-start" className="text-xs text-muted-foreground">Desde</label>
              <Input id="sv-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-[150px]" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="sv-end" className="text-xs text-muted-foreground">Hasta</label>
              <Input id="sv-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-[150px]" />
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
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 w-[160px]"
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

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : tab === "resumen" ? (
          <div className="flex flex-col gap-4">
            <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <motion.div variants={item}><KpiCard icon={TrendingUp} label="Ventas" value={formatCLP(kpis.total)} /></motion.div>
              <motion.div variants={item}><KpiCard icon={Receipt} label="Órdenes" value={String(kpis.count)} hint={`Ticket promedio ${formatCLP(kpis.ticket)}`} /></motion.div>
              <motion.div variants={item}><KpiCard icon={Layers} label="Margen" value={formatCLP(kpis.margin)} hint={`${kpis.marginPct}% del total`} /></motion.div>
              <motion.div variants={item}><KpiCard icon={Users} label="Clientes" value={String(byClient.length)} /></motion.div>
            </motion.div>
            <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Ventas por día</h3>
              </div>
              {daily.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sin ventas en el período.
                </p>
              ) : (
                <div>
                  <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ height: 150 }}>
                    {daily.map((s) => {
                      const max = Math.max(...daily.map((x) => x.total), 1);
                      return (
                        <div
                          key={s.day}
                          className="flex min-w-[10px] flex-1 flex-col items-center justify-end"
                          title={`${s.day} · ${formatCLP(s.total)}`}
                        >
                          <motion.div
                            className="w-full origin-bottom rounded-t bg-primary/80"
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ duration: 0.45, ease: "easeOut" }}
                            style={{ height: `${(s.total / max) * 120}px` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <GroupPanel title="Top clientes" icon={Users} rows={byClient.slice(0, 6)} />
              <GroupPanel title="Por tipo" icon={Layers} rows={byType} />
            </div>
          </div>
        ) : tab === "ordenes" ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-background shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-3 py-3">N°</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      Sin ventas con estos filtros.
                    </td>
                  </tr>
                ) : (
                  rows.map((o) => {
                    const margin = num(o.total_amount) - num(o.total_cost);
                    return (
                      <tr key={o.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {new Date(o.date).toLocaleDateString("es-CL")}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{o.order_number || "—"}</td>
                        <td className="px-3 py-2.5">{orderTypeLabel(o.order_type)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{orderStatusLabel(o.status)}</td>
                        <td className="max-w-[160px] truncate px-3 py-2.5">{o.client?.name ?? "Sin cliente"}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCLP(num(o.total_amount))}</td>
                        <td className={cn(
                          "px-4 py-2.5 text-right tabular-nums",
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
        ) : (
          <GroupPanel
            title={tab === "cliente" ? "Ventas por cliente" : "Ventas por tipo"}
            icon={tab === "cliente" ? Users : Layers}
            rows={tab === "cliente" ? byClient : byType}
            full
          />
        )}
      </div>
    </div>
  );
}
