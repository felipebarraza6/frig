"use client";

import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Thermometer,
  AlertCircle,
  Gauge,
  Warehouse,
  Package,
  LayoutDashboard,
  List,
} from "lucide-react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import {
  ReportKpi,
  ReportDateFilters,
  ReportTabPanels,
  GroupPanel,
  previousWindow,
  DeltaChip,
} from "@/components/reports/report-kit";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getCurrentMonthRange } from "@/lib/date-range";
import { useCurrentBranch, useCanManageInventory } from "@/lib/store/session";
import { CrmDenied } from "@/components/customers/crm-denied";
import {
  fetchEquipmentProfiles,
  fetchEquipmentMeasurements,
  MEASUREMENT_TYPE_LABELS,
  EQUIPMENT_STATUS_LABELS,
} from "@/lib/api/equipment";
import { fetchWarehouseMetrics } from "@/lib/api/warehouses";

type TabKey = "resumen" | "bodegas";

const TABS: { key: TabKey; label: string; icon: typeof Gauge }[] = [
  { key: "resumen", label: "Resumen", icon: LayoutDashboard },
  { key: "bodegas", label: "Por bodega", icon: Warehouse },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 24 } },
};

function inRange(iso: string, start: string, end: string): boolean {
  const d = iso.slice(0, 10);
  return (!start || d >= start) && (!end || d <= end);
}

export default function EquipmentReportPage() {
  const branch = useCurrentBranch();
  const canManage = useCanManageInventory();
  const branchId = Number(branch?.branch_id ?? 0);
  const month = getCurrentMonthRange();
  const [start, setStart] = useState(month.start);
  const [end, setEnd] = useState(month.end);
  const [tab, setTab] = useState<TabKey>("resumen");
  const prev = previousWindow(start, end);

  const { data: profilesData, isLoading } = useQuery({
    queryKey: ["equipment-profiles", branchId],
    queryFn: fetchEquipmentProfiles,
  });
  const profiles = profilesData ?? [];

  const { data: measurementsData } = useQuery({
    queryKey: ["equipment-measurements", "report", branchId],
    queryFn: () => fetchEquipmentMeasurements(),
  });
  const measurements = measurementsData ?? [];

  const warehouseIds = useMemo(
    () =>
      Array.from(
        new Set(
          profiles
            .map((p) => p.warehouse)
            .filter((id): id is number => typeof id === "number" && id > 0),
        ),
      ),
    [profiles],
  );

  const metricsQueries = useQueries({
    queries: warehouseIds.map((id) => ({
      queryKey: ["warehouse-metrics", id],
      queryFn: () => fetchWarehouseMetrics(id),
      staleTime: 60_000,
    })),
  });

  const metricsByWh = useMemo(() => {
    const map = new Map<number, { products: number; qty: number }>();
    warehouseIds.forEach((id, i) => {
      const m = metricsQueries[i]?.data;
      if (m) {
        map.set(id, {
          products: m.total_products ?? 0,
          qty: Number(m.total_quantity ?? 0),
        });
      }
    });
    return map;
  }, [warehouseIds, metricsQueries]);

  const periodMs = useMemo(
    () => measurements.filter((m) => inRange(m.measurement_date, start, end)),
    [measurements, start, end],
  );
  const prevMs = useMemo(
    () => measurements.filter((m) => inRange(m.measurement_date, prev.start, prev.end)),
    [measurements, prev.start, prev.end],
  );
  const offNow = periodMs.filter((m) => m.is_normal === false).length;
  const offPrev = prevMs.filter((m) => m.is_normal === false).length;
  const skuCovered = warehouseIds.reduce(
    (s, id) => s + (metricsByWh.get(id)?.products ?? 0),
    0,
  );
  const qtyCovered = warehouseIds.reduce(
    (s, id) => s + (metricsByWh.get(id)?.qty ?? 0),
    0,
  );

  const rows = useMemo(() => {
    return profiles.map((p) => {
      const ofProduct = periodMs.filter((m) => m.product === p.product);
      const last = ofProduct[0];
      const off = ofProduct.filter((m) => m.is_normal === false).length;
      const stock =
        typeof p.warehouse === "number" ? metricsByWh.get(p.warehouse) : undefined;
      return {
        profile: p,
        last,
        count: ofProduct.length,
        off,
        sku: stock?.products ?? 0,
        qty: stock?.qty ?? 0,
      };
    });
  }, [profiles, periodMs, metricsByWh]);

  const bodegaGroups = useMemo(() => {
    const map = new Map<string, { count: number; total: number; secondary: number }>();
    for (const r of rows) {
      const key = r.profile.warehouse_name?.trim() || "Sin bodega";
      const cur = map.get(key) ?? { count: 0, total: 0, secondary: 0 };
      cur.count += 1;
      cur.total += r.sku;
      cur.secondary += r.off;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, count: v.count, total: v.total, secondary: v.secondary }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  if (!canManage) {
    return (
      <CrmDenied title="Rendimiento de equipos" icon={<Thermometer className="h-5 w-5" />} />
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full min-w-0 max-w-7xl flex-col">
      <PageHeader
        title="Rendimiento de equipos"
        icon={<Thermometer className="h-5 w-5" />}
        subtitle="Cuántas máquinas, lecturas y SKU cubre cada bodega"
        actions={
          <Link
            href="/equipment"
            className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            Equipos
          </Link>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <ReportDateFilters start={start} end={end} onChange={({ start: s, end: e }) => { setStart(s); setEnd(e); }} idPrefix="eq" />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : profiles.length === 0 ? (
          <EmptyState
            icon={Thermometer}
            title="Sin equipos"
            description="Asocia una máquina a una bodega y registra lecturas."
            action={
              <Link href="/equipment" className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground">
                Ir a equipos
              </Link>
            }
          />
        ) : (
          <ReportTabPanels activeKey={tab}>
            {tab === "resumen" && (
              <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-5">
                <motion.div variants={item} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <ReportKpi icon={Gauge} label="Equipos" value={String(profiles.length)} tone="blue" hint="Máquinas en la sucursal" />
                  <ReportKpi
                    icon={Thermometer}
                    label="Lecturas"
                    value={String(periodMs.length)}
                    tone="slate"
                    hint="En el período"
                    delta={<DeltaChip curr={periodMs.length} prev={prevMs.length} />}
                  />
                  <ReportKpi
                    icon={AlertCircle}
                    label="Fuera de rango"
                    value={String(offNow)}
                    tone={offNow ? "rose" : "emerald"}
                    hint="Lecturas fuera del min/max"
                    delta={<DeltaChip curr={offNow} prev={offPrev} goodWhenUp={false} />}
                  />
                  <ReportKpi
                    icon={Package}
                    label="SKU cubiertos"
                    value={String(skuCovered)}
                    tone="emerald"
                    hint={`${qtyCovered.toLocaleString("es-CL")} uds. en bodegas asociadas`}
                  />
                </motion.div>

                <motion.div variants={item} className="overflow-x-auto rounded-2xl glass">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Equipo</th>
                        <th className="px-3 py-3">Bodega</th>
                        <th className="px-3 py-3 text-right">SKU</th>
                        <th className="px-3 py-3 text-right">Cantidad</th>
                        <th className="px-3 py-3">Última lectura</th>
                        <th className="px-3 py-3 text-right">Valor</th>
                        <th className="px-3 py-3 text-right">Lecturas</th>
                        <th className="px-3 py-3">Rango</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ profile, last, count, off, sku, qty }) => (
                        <tr key={profile.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-medium">{profile.product_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {EQUIPMENT_STATUS_LABELS[profile.equipment_status] ?? profile.status_display}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{profile.warehouse_name ?? "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{profile.warehouse ? sku : "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{profile.warehouse ? qty.toLocaleString("es-CL") : "—"}</td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {last ? MEASUREMENT_TYPE_LABELS[last.measurement_type] ?? last.measurement_type : "—"}
                          </td>
                          <td className={cn("px-3 py-3 text-right tabular-nums", last && !last.is_normal && "font-medium text-danger")}>
                            {last ? `${last.value} ${last.unit}` : "—"}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{count}</td>
                          <td className="px-3 py-3">
                            {!last ? <span className="text-muted-foreground">Sin dato</span>
                              : last.is_normal ? <span className="text-success">En rango</span>
                              : <span className="text-danger">Fuera ({off})</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              </motion.div>
            )}
            {tab === "bodegas" && (
              <GroupPanel
                title="Equipos y SKU por bodega"
                icon={Warehouse}
                rows={bodegaGroups}
                columns={{ count: "Equipos", total: "SKU", secondary: "Fuera de rango" }}
                emptyMessage="Ningún equipo tiene bodega asociada."
              />
            )}
          </ReportTabPanels>
        )}
      </div>
    </div>
  );
}
