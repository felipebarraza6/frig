"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Warehouse,
  X,
  FileSpreadsheet,
  FileText,
  Package,
  Boxes,
  TrendingUp,
  AlertTriangle,
  Layers,
  Coins,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  exportWarehouses,
  type WarehousesFilter,
} from "@/lib/api/warehouses";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { formatCLP, cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";

type Warehouse = YggdraSchemas["Warehouse"];

const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  GENERAL: "General",
  TOOLS: "Herramientas",
  RAW_MATERIAL: "Materias primas",
  WASTE: "Residuos",
  CUSTOM: "Personalizada",
};

const WAREHOUSE_TYPES_UI = [
  { value: "GENERAL", label: "General" },
  { value: "RAW_MATERIAL", label: "Materias primas" },
  { value: "CUSTOM", label: "Personalizada" },
];

function typeLabel(value?: string | null): string {
  if (!value) return "—";
  return WAREHOUSE_TYPE_LABELS[value] ?? value;
}

function typeIcon(value?: string | null) {
  switch (value) {
    case "RAW_MATERIAL":
      return Boxes;
    case "GENERAL":
      return Warehouse;
    default:
      return Layers;
  }
}

function typeAccent(value?: string | null): string {
  switch (value) {
    case "RAW_MATERIAL":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    case "GENERAL":
      return "bg-primary/10 text-primary border-primary/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function numValue(v: string | null | undefined): number {
  return parseFloat(v || "0") || 0;
}

export default function WarehousesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { download: downloadFile, isLoading: isExporting } = useDownloadFile();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({
    name: "",
    warehouse_type: "GENERAL" as string,
    description: "",
    location: "",
    capacity: "",
    is_default: false,
  });

  const filter = useMemo<WarehousesFilter>(
    () => ({
      search: search || undefined,
      warehouse_type: type || undefined,
      ...pageUrl,
    }),
    [search, type, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["warehouses", "manage", filter],
    queryFn: () => fetchWarehouses(filter),
  });

  const warehouses = page?.results ?? [];
  const totalWarehouses = page?.count ?? 0;

  const summary = useMemo(() => {
    const num = (v: string | null | undefined) => parseFloat(v || "0") || 0;
    return (page?.results ?? []).reduce(
      (acc, w) => ({
        totalProducts: acc.totalProducts + num(w.total_products),
        totalQuantity: acc.totalQuantity + num(w.total_quantity),
        totalCost: acc.totalCost + num(w.total_value),
        totalSale: acc.totalSale + num(w.total_sale_value),
        lowStock: acc.lowStock + num(w.low_stock_products),
        outOfStock: acc.outOfStock + num(w.out_of_stock_products),
      }),
      {
        totalProducts: 0,
        totalQuantity: 0,
        totalCost: 0,
        totalSale: 0,
        lowStock: 0,
        outOfStock: 0,
      },
    );
  }, [page?.results]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        warehouse_type: (form.warehouse_type || "GENERAL") as "GENERAL" | "TOOLS" | "RAW_MATERIAL" | "WASTE" | "CUSTOM",
        description: form.description || null,
        location: form.location || null,
        capacity: form.capacity || null,
        is_default: form.is_default,
        branch_id: 0, // el backend resuelve la sucursal desde X-Branch-ID
      };
      if (editing) {
        await updateWarehouse(editing.id, payload);
      } else {
        await createWarehouse(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      setConfirmDelete(null);
    },
  });

  function openModal(warehouse?: Warehouse) {
    setEditing(warehouse ?? null);
    if (warehouse) {
      setForm({
        name: warehouse.name,
        warehouse_type: warehouse.warehouse_type ?? "GENERAL",
        description: warehouse.description ?? "",
        location: warehouse.location ?? "",
        capacity: warehouse.capacity ?? "",
        is_default: warehouse.is_default ?? false,
      });
    } else {
      setForm({
        name: "",
        warehouse_type: "GENERAL",
        description: "",
        location: "",
        capacity: "",
        is_default: false,
      });
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleExport(format: "excel" | "pdf") {
    downloadFile(() => exportWarehouses(filter, format), {
      filename: exportFilename("bodegas", format === "excel" ? "xlsx" : "pdf"),
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Bodegas</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona las bodegas de la sucursal
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
            disabled={isExporting}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button onClick={() => openModal()}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva bodega</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageUrl({});
              }}
              placeholder="Buscar por nombre…"
              className="pl-9"
            />
          </div>
          <div className="flex w-full flex-col gap-1 sm:w-auto">
            <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
            <Select
              id="filter-type"
              className="w-full sm:w-auto"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPageUrl({});
              }}
            >
              <option value="">Todos</option>
              {WAREHOUSE_TYPES_UI.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las bodegas.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Resumen global */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Warehouse className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bodegas</p>
                    <p className="text-lg font-semibold tabular-nums">{totalWarehouses}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Productos</p>
                    <p className="text-lg font-semibold tabular-nums">{summary.totalProducts}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Coins className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor costo</p>
                    <p className="text-lg font-semibold tabular-nums">{formatCLP(summary.totalCost)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                    <TrendingUp className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor venta</p>
                    <p className="text-lg font-semibold tabular-nums">{formatCLP(summary.totalSale)}</p>
                  </div>
                </div>
              </div>
            </div>

            {(summary.lowStock > 0 || summary.outOfStock > 0) && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <p className="text-sm font-medium text-amber-800">Alertas de stock</p>
                  </div>
                  {summary.lowStock > 0 && (
                    <span className="text-sm text-amber-700">
                      {summary.lowStock} producto{summary.lowStock === 1 ? "" : "s"} con stock bajo
                    </span>
                  )}
                  {summary.outOfStock > 0 && (
                    <span className="text-sm text-amber-700">
                      {summary.outOfStock} producto{summary.outOfStock === 1 ? "" : "s"} sin stock
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Cards de bodegas */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {warehouses.map((w) => {
                const Icon = typeIcon(w.warehouse_type);
                const accent = typeAccent(w.warehouse_type);
                const totalProducts = numValue(w.total_products);
                const totalQuantity = numValue(w.total_quantity);
                const totalCost = numValue(w.total_value);
                const totalSale = numValue(w.total_sale_value);
                const lowStock = numValue(w.low_stock_products);
                const outOfStock = numValue(w.out_of_stock_products);
                const hasAlerts = lowStock > 0 || outOfStock > 0;

                return (
                  <div
                    key={w.id}
                    onClick={() => router.push(`/warehouses/${w.id}`)}
                    className={cn(
                      "group cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm transition sm:p-5",
                      "hover:border-primary hover:shadow-md",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-xl border",
                            accent,
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold leading-tight">{w.name}</p>
                          <p className="text-xs text-muted-foreground">{typeLabel(w.warehouse_type)}</p>
                        </div>
                      </div>
                      {w.is_default && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          Principal
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Productos</p>
                        <p className="text-base font-semibold tabular-nums">{totalProducts}</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Unidades</p>
                        <p className="text-base font-semibold tabular-nums">{totalQuantity}</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Costo</p>
                        <p className="text-base font-semibold tabular-nums text-emerald-700">
                          {formatCLP(totalCost)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Venta</p>
                        <p className="text-base font-semibold tabular-nums text-primary">
                          {formatCLP(totalSale)}
                        </p>
                      </div>
                    </div>

                    {hasAlerts && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <p className="text-xs text-amber-700">
                          {lowStock > 0 && `${lowStock} bajo stock`}
                          {lowStock > 0 && outOfStock > 0 && " · "}
                          {outOfStock > 0 && `${outOfStock} sin stock`}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start gap-2 text-danger hover:text-danger sm:justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(w);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sm:hidden">Eliminar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2 sm:justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(w);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sm:hidden">Editar</span>
                      </Button>
                      <Button
                        size="sm"
                        className="justify-between gap-2 sm:justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/warehouses/${w.id}`);
                        }}
                      >
                        <span>Entrar</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-muted-foreground">
                {totalWarehouses} bodega{totalWarehouses === 1 ? "" : "s"} en total
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {editing ? "Editar bodega" : "Nueva bodega"}
              </h2>
              <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="warehouse-name" className="text-sm font-medium">Nombre</label>
                <Input
                  id="warehouse-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="warehouse-type" className="text-sm font-medium">Tipo</label>
                  <Select
                    id="warehouse-type"
                    value={form.warehouse_type}
                    onChange={(e) => setForm({ ...form, warehouse_type: e.target.value })}
                  >
                    {WAREHOUSE_TYPES_UI.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="warehouse-capacity" className="text-sm font-medium">Capacidad</label>
                  <Input
                    id="warehouse-capacity"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="warehouse-location" className="text-sm font-medium">Ubicación</label>
                <Input
                  id="warehouse-location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="warehouse-description" className="text-sm font-medium">Descripción</label>
                <Input
                  id="warehouse-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                Bodega principal
              </label>
              {save.isError && (
                <p className="text-sm text-danger">
                  {save.error instanceof Error ? save.error.message : "Error al guardar"}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeModal} disabled={save.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="text-base font-semibold">¿Eliminar bodega?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se desactivará <span className="font-medium text-foreground">{confirmDelete.name}</span>.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => remove.mutate(confirmDelete.id)}
                disabled={remove.isPending}
              >
                {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
