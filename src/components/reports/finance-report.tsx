"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { DeltaChip, ReportNav, previousWindow } from "@/components/reports/report-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentBranch } from "@/lib/store/session";
import { useDownloadFile } from "@/lib/hooks/useDownloadFile";
import { fetchExpenses, fetchExpenseCategories, exportExpensesExcel } from "@/lib/api/expenses";
import { fetchRevenues, fetchRevenueCategories, exportRevenuesExcel } from "@/lib/api/revenues";
import { formatCLP, cn } from "@/lib/utils";

type Variant = "gastos" | "ingresos";

type FinanceRow = {
  id: string;
  name?: string;
  title?: string;
  description?: string | null;
  category_name?: string;
  supplier?: string | null;
  customer_name?: string | null;
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

type GroupDim = "categoria" | "estado" | "contraparte";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 24 } },
};

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


const CONFIG = {
  gastos: {
    titulo: "Informe de gastos",
    icono: TrendingDown,
    fetcher: (
      branchId: number | undefined,
      start: string,
      end: string,
      category: string,
      search: string,
      next?: string | null,
    ) => {
      void branchId;
      return fetchExpenses({
        startDate: start || undefined,
        endDate: end || undefined,
        category: category || undefined,
        search: search || undefined,
        next: next ?? undefined,
        page_size: 200,
      });
    },
    categoriesFetcher: fetchExpenseCategories,
    fechas: (r: FinanceRow) => [r.start_date ?? ""],
    monto: (r: FinanceRow) => num(r.amount),
    secundario: (r: FinanceRow) => num(r.total_paid),
    contraparte: (r: FinanceRow) => r.supplier ?? "Sin proveedor",
    nombre: (r: FinanceRow) => r.name ?? "—",
    etiquetaSecundario: "Pagado",
  },
  ingresos: {
    titulo: "Informe de ingresos",
    icono: TrendingUp,
    fetcher: (
      branchId: number | undefined,
      start: string,
      end: string,
      category: string,
      search: string,
      next?: string | null,
    ) => {
      void branchId;
      return fetchRevenues({
        startDate: start || undefined,
        endDate: end || undefined,
        category: category || undefined,
        search: search || undefined,
        next: next ?? undefined,
        page_size: 200,
      });
    },
    categoriesFetcher: fetchRevenueCategories,
    fechas: (r: FinanceRow) => [r.revenue_date ?? r.received_date ?? ""],
    monto: (r: FinanceRow) => num(r.amount),
    secundario: (r: FinanceRow) => num(r.total_paid),
    contraparte: (r: FinanceRow) => r.customer_name ?? "Sin cliente",
    nombre: (r: FinanceRow) => r.title ?? "—",
    etiquetaSecundario: "Recibido",
  },
} as const;

export function FinanceReportView({ variant }: { variant: Variant }) {
  const cfg = CONFIG[variant];
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : undefined;

  const [start, setStart] = useState(daysAgoInput(89));
  const [end, setEnd] = useState(fmtDateInput(new Date()));
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupDim, setGroupDim] = useState<GroupDim>("categoria");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: categories = [] } = useQuery({
    queryKey: ["finance-report", variant, "categories", branchId],
    queryFn: async (): Promise<{ id: string | number; name: string }[]> => {
      const list =
        variant === "gastos" ? await fetchExpenseCategories() : await fetchRevenueCategories();
      return list.map((c) => ({ id: c.id, name: c.name }));
    },
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });

  const { download: downloadExport, isLoading: exporting } = useDownloadFile();
  function exportExcel() {
    const filter =
      variant === "gastos"
        ? { startDate: start || undefined, endDate: end || undefined, category: category || undefined, search: debouncedSearch || undefined }
        : { startDate: start || undefined, endDate: end || undefined, category: category || undefined, search: debouncedSearch || undefined };
    const excel = variant === "gastos" ? exportExpensesExcel : exportRevenuesExcel;
    downloadExport(() => excel(filter as never), {
      filename: `informe_${variant}_${start}_${end}`,
      extension: "xlsx",
    });
  }

  const prevWindow = previousWindow(start, end);

  const { data: page, isLoading } = useQuery({
    queryKey: ["finance-report", variant, branchId, start, end, category, debouncedSearch],
    queryFn: async () => {
      const all: FinanceRow[] = [];
      let next: string | null | undefined = undefined;
      for (let page = 0; page < 3; page++) {
        const data: { results?: FinanceRow[]; next?: string | null } = await cfg.fetcher(
          branchId,
          start,
          end,
          category,
          debouncedSearch,
          page === 0 ? undefined : next,
        );
        const rows = (data.results ?? []) as FinanceRow[];
        all.push(...rows);
        next = data.next;
        if (!next) break;
      }
      return all;
    },
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });

  // Período anterior (misma duración): base de los deltas PoP.
  const { data: prevPage } = useQuery({
    queryKey: ["finance-report", variant, "prev", prevWindow.start, prevWindow.end, category, debouncedSearch],
    queryFn: async () => {
      const data = await cfg.fetcher(branchId, prevWindow.start, prevWindow.end, category, debouncedSearch);
      return ((data as { results?: FinanceRow[] }).results ?? []) as FinanceRow[];
    },
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });

  const rows = useMemo(() => page ?? [], [page]);
  const prevRows = useMemo(() => prevPage ?? [], [prevPage]);

  const kpis = useMemo(() => {
    let total = 0;
    let secundario = 0;
    for (const r of rows) {
      total += cfg.monto(r);
      secundario += cfg.secundario(r);
    }
    return {
      total,
      secundario,
      count: rows.length,
      promedio: rows.length > 0 ? total / rows.length : 0,
    };
  }, [rows, cfg]);

  const prevKpis = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const r of prevRows) {
      total += cfg.monto(r);
      count += 1;
    }
    return { total, count };
  }, [prevRows, cfg]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; count: number; total: number; secundario: number }>();
    for (const r of rows) {
      const key =
        groupDim === "categoria"
          ? r.category_name ?? "Sin categoría"
          : groupDim === "estado"
            ? r.status_display ?? r.status ?? "—"
            : cfg.contraparte(r);
      const g = map.get(key) ?? { key, count: 0, total: 0, secundario: 0 };
      g.count += 1;
      g.total += cfg.monto(r);
      g.secundario += cfg.secundario(r);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows, groupDim, cfg]);


  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <PageHeader
        title={cfg.titulo}
        subtitle="Analiza el detalle por categoría, contraparte y período. Todo exportable."
        icon={<cfg.icono className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={isLoading || exporting}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar Excel
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <ReportNav active={variant === "gastos" ? "/reports/gastos" : "/reports/ingresos"} />
        {/* Filtros */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Desde</label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-[150px]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Hasta</label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-[150px]" />
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
              <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-[180px]" aria-label="Filtrar por categoría">
                <option value="">Todas las categorías</option>
                {(categories as { id: string | number; name: string }[]).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="h-9 w-[170px]"
                aria-label="Buscar"
              />
            </div>
          </div>
        </div>

        {/* KPIs */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 divide-x divide-y lg:divide-y-0 divide-border overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-4">
            <motion.div variants={item} className="p-5">
              <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <cfg.icono className="h-3.5 w-3.5" /> Total
              </span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <span className="block text-2xl font-semibold tabular-nums tracking-tight">{formatCLP(kpis.total)}</span>
                <DeltaChip curr={kpis.total} prev={prevKpis.total} />
              </span>
            </motion.div>
            <motion.div variants={item} className="p-5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{cfg.etiquetaSecundario}</span>
              <span className="mt-1 block text-2xl font-semibold tabular-nums tracking-tight">{formatCLP(kpis.secundario)}</span>
            </motion.div>
            <motion.div variants={item} className="p-5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Registros</span>
              <span className="mt-1 block text-2xl font-semibold tabular-nums tracking-tight">{kpis.count}</span>
            </motion.div>
            <motion.div variants={item} className="p-5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Promedio</span>
              <span className="mt-1 block text-2xl font-semibold tabular-nums tracking-tight">{formatCLP(kpis.promedio)}</span>
            </motion.div>
          </motion.div>
        )}

        {/* Barras por categoría */}
        {!isLoading && groups.length > 0 && (
          <motion.div variants={container} initial="hidden" animate="show" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold">Distribución por {groupDim === "categoria" ? "categoría" : groupDim === "estado" ? "estado" : cfg === CONFIG.gastos ? "proveedor" : "cliente"}</h3>
            <div className="flex flex-col gap-2.5">
              {groups.slice(0, 10).map((g) => {
                const max = Math.max(...groups.map((x) => x.total), 1);
                return (
                  <div key={g.key} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-xs font-medium">{g.key}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className={cn("h-full rounded-full", variant === "gastos" ? "bg-danger/70" : "bg-success/70")}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((g.total / max) * 100)}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums">{formatCLP(g.total)}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Agrupación + tabla */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Agrupar por:</span>
          {([
            { key: "categoria", label: "Categoría" },
            { key: "contraparte", label: variant === "gastos" ? "Proveedor" : "Cliente" },
            { key: "estado", label: "Estado" },
          ] as const).map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setGroupDim(d.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                groupDim === d.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-background shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Detalle</th>
                <th className="px-3 py-3 text-center">Registros</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">{cfg.etiquetaSecundario}</th>
                <th className="w-28 px-4 py-3">Participación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Sin registros con estos filtros.
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr key={g.key} className="transition-colors hover:bg-muted/30">
                    <td className="max-w-[240px] truncate px-4 py-2.5 font-medium">{g.key}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{g.count}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatCLP(g.total)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCLP(g.secundario)}</td>
                    <td className="px-4 py-2.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${Math.round((g.total / Math.max(...groups.map((x) => x.total), 1)) * 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detalle de registros */}
        <div className="overflow-x-auto rounded-2xl border border-border bg-background shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-3 py-3">Categoría</th>
                <th className="px-3 py-3">{variant === "gastos" ? "Proveedor" : "Cliente"}</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Sin registros con estos filtros.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-muted/30">
                    <td className="max-w-[240px] truncate px-4 py-2.5 font-medium">{cfg.nombre(r)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.category_name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{cfg.contraparte(r)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.status_display ?? r.status ?? "—"}</td>
                    <td className={cn(
                      "px-4 py-2.5 text-right font-semibold tabular-nums",
                      variant === "gastos" ? "text-danger" : "text-success",
                    )}>
                      {formatCLP(cfg.monto(r))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
