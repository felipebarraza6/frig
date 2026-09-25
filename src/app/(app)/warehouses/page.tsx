"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  FileText,
  Plus,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PageBody, PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { WarehouseRoomCard } from "@/components/warehouses/warehouse-room-card";
import { WarehousePreviewPanel } from "@/components/warehouses/warehouse-preview-panel";
import {
  WarehouseFormModal,
  type WarehouseFormValues,
} from "@/components/warehouses/warehouse-form-modal";
import {
  fetchWarehouses,
  fetchWarehouseTypes,
  fetchWarehouseBranchSummary,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  exportWarehouses,
  type Warehouse,
  type WarehousesFilter,
} from "@/lib/api/warehouses";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { formatCLP, cn } from "@/lib/utils";
import { FALLBACK_WAREHOUSE_TYPES, numValue, WarehouseTypeIcon } from "@/lib/warehouses-ui";
import { useCurrentBranch } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";

function FilterChip({
  active,
  onClick,
  count,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-all",
        active
          ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
          : "border-border bg-card/60 text-muted-foreground hover:border-foreground/20 hover:text-foreground",
      )}
    >
      {icon}
      <span>{children}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
      {active && <Check className="h-3 w-3" />}
    </button>
  );
}

export default function WarehousesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const toast = useToast();
  const { download: downloadFile, isLoading: isExporting } = useDownloadFile();
  const [type, setType] = useState("");
  const [onlyDefault, setOnlyDefault] = useState(false);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Warehouse | null>(null);
  const [previewWarehouse, setPreviewWarehouse] = useState<Warehouse | null>(null);

  const branchId = branch?.branch_id ? Number(branch.branch_id) : undefined;

  const filter = useMemo<WarehousesFilter>(
    () => ({
      warehouse_type: type || undefined,
      is_default: onlyDefault || undefined,
      page_size: 100,
    }),
    [type, onlyDefault],
  );

  const { data: page, isPending, isLoading, error } = useQuery({
    queryKey: ["warehouses", "list", type, onlyDefault],
    queryFn: () => fetchWarehouses(filter),
  });
  const loadingList = isPending || isLoading;

  const typesQuery = useQuery({
    queryKey: ["warehouses", "types"],
    queryFn: fetchWarehouseTypes,
    staleTime: 60_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["warehouses", "summary", branchId],
    queryFn: async () => {
      try {
        return await fetchWarehouseBranchSummary(branchId!);
      } catch {
        return null;
      }
    },
    enabled: Boolean(branchId),
    retry: false,
    staleTime: 30_000,
  });

  const warehouses = useMemo(() => {
    const results = page?.results;
    return Array.isArray(results) ? results : [];
  }, [page]);
  const visible = useMemo(() => {
    const list = onlyAlerts
      ? warehouses.filter(
          (w) => numValue(w.low_stock_products) > 0 || numValue(w.out_of_stock_products) > 0,
        )
      : [...warehouses];
    list.sort(
      (a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name, "es"),
    );
    return list;
  }, [warehouses, onlyAlerts]);

  const peakQuantity = useMemo(
    () => Math.max(0, ...visible.map((w) => numValue(w.total_quantity))),
    [visible],
  );

  const typeOptions = typesQuery.data && typesQuery.data.length > 0
    ? typesQuery.data
    : [...FALLBACK_WAREHOUSE_TYPES];

  const kpis = useMemo(() => {
    const s = summaryQuery.data;
    if (s && Array.isArray(s.warehouses) && !type && !onlyDefault) {
      return {
        totalWarehouses: s.total_warehouses,
        totalProducts: s.total_products,
        totalCost: numValue(s.total_value),
        totalSale: numValue(s.total_sale_value),
        lowStock: s.warehouses.reduce((acc, m) => acc + numValue(m.low_stock_products), 0),
        outOfStock: s.warehouses.reduce((acc, m) => acc + numValue(m.out_of_stock_products), 0),
      };
    }
    return warehouses.reduce(
      (acc, w) => ({
        totalWarehouses: page?.count ?? warehouses.length,
        totalProducts: acc.totalProducts + numValue(w.total_products),
        totalCost: acc.totalCost + numValue(w.total_value),
        totalSale: acc.totalSale + numValue(w.total_sale_value),
        lowStock: acc.lowStock + numValue(w.low_stock_products),
        outOfStock: acc.outOfStock + numValue(w.out_of_stock_products),
      }),
      {
        totalWarehouses: page?.count ?? 0,
        totalProducts: 0,
        totalCost: 0,
        totalSale: 0,
        lowStock: 0,
        outOfStock: 0,
      },
    );
  }, [summaryQuery.data, warehouses, page?.count, type, onlyDefault]);

  const save = useMutation({
    mutationFn: async (values: WarehouseFormValues) => {
      const payload = {
        name: values.name.trim(),
        warehouse_type: (values.warehouse_type || "GENERAL") as Warehouse["warehouse_type"],
        description: values.description || null,
        location: values.location || null,
        capacity: values.capacity ? Number(values.capacity) : null,
        is_default: values.is_default,
        branch_id: Number(branch?.branch_id ?? 0),
      };
      if (editing) {
        await updateWarehouse(editing.id, payload);
      } else {
        await createWarehouse(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success(editing ? "Recinto actualizado" : "Recinto creado");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo guardar"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Recinto desactivado");
      setConfirmDelete(null);
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo eliminar"),
  });

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function handleExport(format: "excel" | "pdf") {
    downloadFile(() => exportWarehouses(filter, format), {
      filename: exportFilename("bodegas", format === "excel" ? "xlsx" : "pdf"),
    });
  }

  const hasAlerts = kpis.lowStock > 0 || kpis.outOfStock > 0;

  return (
    <PageShell>
      <PageHeader
        title="Bodegas"
        icon={<WarehouseIcon className="h-5 w-5" />}
        subtitle="Planta de recintos — entra a cada sala"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("excel")}
              disabled={isExporting}
              className="h-9 w-9 px-0 sm:w-auto sm:px-3"
              title="Exportar Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={isExporting}
              className="h-9 w-9 px-0 sm:w-auto sm:px-3"
              title="Exportar PDF"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              onClick={openCreate}
              className="h-9 w-9 px-0 sm:w-auto sm:px-3"
              title="Nuevo recinto"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo recinto</span>
            </Button>
          </div>
        }
      />

      <PageBody>
        <div className="glass space-y-3 rounded-2xl p-3 sm:p-4">
          {/* Stats con toggle de alertas integrado */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl leading-none font-semibold tabular-nums tracking-tight">
                {kpis.totalWarehouses}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                recinto{kpis.totalWarehouses === 1 ? "" : "s"}
              </span>
            </div>
            <span className="hidden h-8 w-px bg-border sm:block" />
            <p className="text-sm tabular-nums text-muted-foreground">
              {kpis.totalProducts} SKU · {formatCLP(kpis.totalCost)}
              <span className="mx-1.5 text-border">/</span>
              <span className="font-medium text-primary">{formatCLP(kpis.totalSale)}</span>
            </p>
            <button
              type="button"
              onClick={() => setOnlyAlerts((v) => !v)}
              aria-pressed={onlyAlerts}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-all sm:ml-auto",
                onlyAlerts
                  ? "border-warning/60 bg-warning/15 text-warning shadow-sm"
                  : hasAlerts
                    ? "border-warning/30 bg-warning/5 text-warning hover:bg-warning/10"
                    : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              {hasAlerts ? (
                <>
                  {kpis.lowStock > 0 ? `${kpis.lowStock} bajo` : null}
                  {kpis.lowStock > 0 && kpis.outOfStock > 0 ? " · " : null}
                  {kpis.outOfStock > 0 ? `${kpis.outOfStock} sin stock` : null}
                </>
              ) : (
                "Stock en rango"
              )}
              {onlyAlerts && <Check className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Filtros como chips con conteo */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 snap-x">
            <FilterChip
              active={!type && !onlyDefault && !onlyAlerts}
              onClick={() => {
                setType("");
                setOnlyDefault(false);
                setOnlyAlerts(false);
              }}
            >
              Todos
            </FilterChip>
            {typeOptions.map((t) => (
              <FilterChip
                key={t.value}
                active={type === t.value}
                onClick={() => setType((prev) => (prev === t.value ? "" : t.value))}
                count={warehouses.filter((w) => w.warehouse_type === t.value).length}
                icon={<WarehouseTypeIcon value={t.value} className="h-3.5 w-3.5" />}
              >
                {t.label}
              </FilterChip>
            ))}
            <span className="mx-1 w-px shrink-0 self-center bg-border" />
            <FilterChip
              active={onlyDefault}
              onClick={() => setOnlyDefault((v) => !v)}
              count={warehouses.filter((w) => w.is_default).length}
            >
              Principal
            </FilterChip>
            <FilterChip
              active={onlyAlerts}
              onClick={() => setOnlyAlerts((v) => !v)}
              count={warehouses.filter(
                (w) => numValue(w.low_stock_products) > 0 || numValue(w.out_of_stock_products) > 0,
              ).length}
            >
              Con alertas
            </FilterChip>
          </div>
        </div>

        {error ? (
          <EmptyState
            icon={AlertTriangle}
            title="No se pudieron cargar las bodegas"
            description={error instanceof Error ? error.message : "Revisa la conexión con el servidor."}
          />
        ) : loadingList ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[13rem] rounded-xl" />
            ))}
          </div>
        ) : warehouses.length === 0 ? (
          <EmptyState
            icon={WarehouseIcon}
            title="Esta sucursal aún no tiene recintos"
            description="El stock vive en bodegas. Crea la principal para que las ventas y ajustes tengan dónde descontar."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" />
                Crear recinto
              </Button>
            }
          />
        ) : (
          <>
            {visible.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="Ningún recinto coincide con el filtro"
                description="Prueba otro tipo o limpia las alertas."
              />
            ) : (
              <LazyMotion features={domAnimation}>
                <m.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.04 },
                    },
                  }}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                >
                  <AnimatePresence mode="popLayout">
                    {visible.map((w) => (
                      <m.div
                        key={w.id}
                        layout
                        variants={{
                          hidden: { opacity: 0, y: 16, scale: 0.98 },
                          visible: { opacity: 1, y: 0, scale: 1 },
                        }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                        transition={{ type: "spring", stiffness: 300, damping: 24 }}
                      >
                        <WarehouseRoomCard
                          warehouse={w}
                          peakQuantity={peakQuantity}
                          onEnter={() => {
                            const alert =
                              onlyAlerts && numValue(w.low_stock_products) > 0
                                ? "low"
                                : onlyAlerts && numValue(w.out_of_stock_products) > 0
                                  ? "out"
                                  : "";
                            router.push(
                              alert
                                ? `/warehouses/view?id=${w.id}&alert=${alert}`
                                : `/warehouses/view?id=${w.id}`,
                            );
                          }}
                          onEdit={() => {
                            setEditing(w);
                            setModalOpen(true);
                          }}
                          onDelete={() => setConfirmDelete(w)}
                          onPreview={() => setPreviewWarehouse(w)}
                        />
                      </m.div>
                    ))}
                  </AnimatePresence>
                </m.div>
              </LazyMotion>
            )}
          </>
        )}
      </PageBody>

      <WarehouseFormModal
        open={modalOpen}
        editing={editing}
        types={typeOptions}
        saving={save.isPending}
        error={save.error instanceof Error ? save.error.message : null}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={(values) => save.mutate(values)}
      />

      <AnimatedOverlay
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
        {confirmDelete && (
          <div className="w-full rounded-t-xl border-x border-t border-border bg-background p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Desactivar recinto?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se desactiva <span className="font-medium text-foreground">{confirmDelete.name}</span>.
              Si tiene productos con stock, el servidor lo bloquea.
            </p>
            {remove.isError ? (
              <p className="mt-2 text-sm text-danger">
                {remove.error instanceof Error ? remove.error.message : "No se pudo eliminar"}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => remove.mutate(confirmDelete.id)}
                isLoading={remove.isPending}
              >
                Desactivar
              </Button>
            </div>
          </div>
        )}
      </AnimatedOverlay>

      <WarehousePreviewPanel
        warehouse={previewWarehouse}
        open={Boolean(previewWarehouse)}
        onClose={() => setPreviewWarehouse(null)}
        onEnter={() => {
          if (!previewWarehouse) return;
          router.push(`/warehouses/view?id=${previewWarehouse.id}`);
          setPreviewWarehouse(null);
        }}
        onEdit={() => {
          if (!previewWarehouse) return;
          setEditing(previewWarehouse);
          setModalOpen(true);
          setPreviewWarehouse(null);
        }}
      />
    </PageShell>
  );
}
