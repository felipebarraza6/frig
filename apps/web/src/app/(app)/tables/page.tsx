"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Table,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  Trash2,
  Users,
  MapPin,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  Calendar,
  ArrowLeftRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchTables,
  createTable,
  updateTable,
  deleteTable,
  occupyTable,
  freeTable,
  reserveTable,
  cleanTable,
  assignWaiter,
  exportTables,
  type TableStatus,
  type TablesFilter,
} from "@/lib/api/tables";
import { fetchBranchUsers } from "@/lib/api/branches";
import { useCurrentBranch, useCanManageTables, useSessionStore } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import type { YggdraSchemas } from "@/lib/api/types";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { statusBadge } from "@/lib/status-styles";

type TableItem = YggdraSchemas["Table"];

const STATUS_OPTIONS: { value: TableStatus | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "FREE", label: "Libre" },
  { value: "OCCUPIED", label: "Ocupada" },
  { value: "RESERVED", label: "Reservada" },
  { value: "CLEANING", label: "Limpieza" },
  { value: "OUT_OF_SERVICE", label: "Fuera de servicio" },
];

function statusLabel(status?: TableStatus | null): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? (status ?? "—");
}

function statusColor(status?: TableStatus | null): string {
  return statusBadge(status);
}

export default function TablesPage() {
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const canManage = useCanManageTables();
  const toast = useToast();
  const { download: downloadFile, isLoading: isExporting } = useDownloadFile();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TableStatus | "">("");
  const [area, setArea] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>(({}));
  const [editing, setEditing] = useState<TableItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [transferringTable, setTransferringTable] = useState<TableItem | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const user = useSessionStore((s) => s.user);

  const filter = useMemo<TablesFilter>(
    () => ({
      search: search || undefined,
      status: status || undefined,
      area: area || undefined,
      ...pageUrl,
    }),
    [search, status, area, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["tables", "manage", filter],
    queryFn: () => fetchTables(filter),
  });

  const { data: branchUsers = [] } = useQuery({
    queryKey: ["branch-users", branch?.branch_id],
    queryFn: () => fetchBranchUsers(String(branch?.branch_id)),
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  const waiters = useMemo(
    () =>
      branchUsers.filter((u) => {
        const code = String(u.role_code ?? "");
        const name = String(u.role_name ?? "").toLowerCase();
        return code === "WAITER" || name.includes("mesero");
      }),
    [branchUsers],
  );

  const tables = page?.results ?? [];
  const totalTables = page?.count ?? 0;

  const areas = useMemo(() => {
    const tables = page?.results ?? [];
    const set = new Set<string>();
    tables.forEach((t) => {
      if (t.area) set.add(t.area);
    });
    return Array.from(set).sort();
  }, [page]);

  const refreshTables = () => {
    queryClient.invalidateQueries({ queryKey: ["tables"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["orders"], refetchType: "all" });
  };

  const create = useMutation({
    mutationFn: createTable,
    onSuccess: () => {
      refreshTables();
      setCreating(false);
      toast.success("Mesa creada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TableItem> }) =>
      updateTable(id, payload),
    onSuccess: () => {
      refreshTables();
      setEditing(null);
      toast.success("Mesa actualizada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: deleteTable,
    onSuccess: () => {
      refreshTables();
      toast.success("Mesa eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, action }: { id: number; action: TableStatus | "free" | "reserve" | "clean" }) => {
      if (action === "free") return freeTable(id);
      if (action === "reserve") return reserveTable(id);
      if (action === "clean") return cleanTable(id);
      return occupyTable(id, { action: "occupy" });
    },
    onSuccess: () => {
      refreshTables();
      toast.success("Estado actualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const transferWaiter = useMutation({
    mutationFn: ({ id, waiterId }: { id: number; waiterId: number | null }) =>
      assignWaiter(id, waiterId),
    onSuccess: () => {
      refreshTables();
      setTransferringTable(null);
      toast.success("Mesero asignado correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const number = String(formData.get("number") ?? "").trim();
    const capacity = Number(formData.get("capacity") || 4);
    const shape = String(formData.get("shape") ?? "ROUND").trim() as TableItem["shape"];
    const status = String(formData.get("status") ?? "").trim() as TableStatus | "";
    const area = String(formData.get("area") ?? "").trim() || null;
    const description = String(formData.get("description") ?? "").trim() || null;
    const x = formData.get("x_position") ? Number(formData.get("x_position")) : null;
    const y = formData.get("y_position") ? Number(formData.get("y_position")) : null;
    const assignedWaiterRaw = formData.get("assigned_waiter");
    const assigned_waiter = assignedWaiterRaw ? Number(assignedWaiterRaw) : null;

    if (!number) {
      toast.error("El número de mesa es obligatorio");
      return;
    }
    if (!branch) {
      toast.error("No hay sucursal seleccionada");
      return;
    }

    const payload = {
      number,
      branch: Number(branch.branch_id),
      capacity: capacity || 4,
      shape,
      area,
      description,
      assigned_waiter,
      x_position: x,
      y_position: y,
    };

    if (editing) {
      const updatePayload = status
        ? { ...payload, status }
        : payload;
      update.mutate({ id: editing.id, payload: updatePayload });
    } else {
      create.mutate(payload);
    }
  }

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function handleExport(format: "excel" | "pdf") {
    downloadFile(() => exportTables(filter, format), {
      filename: exportFilename("mesas", format === "excel" ? "xlsx" : "pdf"),
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Mesas</h1>
          <p className="text-xs text-muted-foreground">Gestión de mesas del local</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
            isLoading={isExporting}
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            title="Exportar Excel"
            aria-label="Exportar Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            isLoading={isExporting}
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            title="Exportar PDF"
            aria-label="Exportar PDF"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Link
            href="/tables/map"
            className="inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background px-0 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:w-auto sm:px-3"
            title="Mapa de mesas"
            aria-label="Mapa de mesas"
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Mapa</span>
          </Link>
          {canManage && (
            <Button
              onClick={() => setCreating(true)}
              className="h-9 w-9 px-0 sm:w-auto sm:px-3"
              title="Nueva mesa"
              aria-label="Nueva mesa"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva mesa</span>
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          {/* Desktop: todos los filtros en una fila */}
          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="Buscar por número…"
                className="pl-9"
                aria-label="Buscar mesa"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
              <Select
                id="filter-status"
                value={status}
                onChange={(e) => updateFilter(setStatus, e.target.value as TableStatus | "")}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-area" className="text-xs text-muted-foreground">Área</label>
              <Select
                id="filter-area"
                value={area}
                onChange={(e) => updateFilter(setArea, e.target.value)}
              >
                <option value="">Todas</option>
                {areas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Mobile/tablet: búsqueda principal + botón filtros */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => updateFilter(setSearch, e.target.value)}
                  placeholder="Buscar por número…"
                  className="pl-9"
                  aria-label="Buscar mesa"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3"
                onClick={() => setShowMobileFilters((v) => !v)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="ml-2">Filtros</span>
              </Button>
            </div>

            {/* Filtros adicionales colapsables */}
            <div className={`flex flex-col gap-3 ${showMobileFilters ? "" : "hidden"}`}>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-status-mobile" className="text-xs text-muted-foreground">Estado</label>
                <Select
                  id="filter-status-mobile"
                  value={status}
                  onChange={(e) => updateFilter(setStatus, e.target.value as TableStatus | "")}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-area-mobile" className="text-xs text-muted-foreground">Área</label>
                <Select
                  id="filter-area-mobile"
                  value={area}
                  onChange={(e) => updateFilter(setArea, e.target.value)}
                >
                  <option value="">Todas</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las mesas.</p>
        ) : isLoading ? (
          <>
            {/* Vista desktop */}
            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
              <div className="border-b border-border px-4 py-3">
                <Skeleton className="h-3 w-44" />
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="ml-auto h-4 w-16" />
                </div>
              ))}
            </div>
            {/* Vista móvil */}
            <div className="flex flex-col gap-3 md:hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          </>
        ) : tables.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Table className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No se encontraron mesas</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otros filtros o agrega una nueva mesa.
              </p>
              {canManage && (
                <Button className="mt-4" size="sm" onClick={() => setCreating(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Nueva mesa
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Vista desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Mesa</th>
                    <th className="px-4 py-3">Capacidad</th>
                    <th className="px-4 py-3">Área</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Mesero</th>
                    <th className="px-4 py-3">Tiempo</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((table) => {
                    const canAct = canManage || (user && table.assigned_waiter === user.id);
                    return (
                      <tr
                        key={table.id}
                        className={cn(
                          "border-b border-border last:border-0",
                          !table.is_active && "opacity-60"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
                              <Table className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">Mesa {table.number}</p>
                              <p className="text-xs text-muted-foreground">{table.area || "Sin área"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{table.capacity} personas</td>
                        <td className="px-4 py-3 text-muted-foreground">{table.area || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusColor(table.status))}>
                            {statusLabel(table.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {table.assigned_waiter_name ?? (table.assigned_waiter ? `Mesero #${table.assigned_waiter}` : "—")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {table.occupation_time ? `${table.occupation_time} min` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canAct ? (
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {canManage && table.status === "FREE" && (
                                <button
                                  onClick={() => changeStatus.mutate({ id: table.id, action: "reserve" })}
                                  disabled={changeStatus.isPending}
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/20"
                                >
                                  <Calendar className="h-3 w-3" />
                                  Reservar
                                </button>
                              )}
                              {canManage && table.status === "OCCUPIED" && (
                                <button
                                  onClick={() => changeStatus.mutate({ id: table.id, action: "free" })}
                                  disabled={changeStatus.isPending}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/20"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Liberar
                                </button>
                              )}
                              {canManage && (table.status === "RESERVED" || table.status === "CLEANING" || table.status === "OUT_OF_SERVICE") && (
                                <button
                                  onClick={() => changeStatus.mutate({ id: table.id, action: "free" })}
                                  disabled={changeStatus.isPending}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/20"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  Libre
                                </button>
                              )}
                              <button
                                onClick={() => setTransferringTable(table)}
                                disabled={transferWaiter.isPending}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-500/20"
                              >
                                <ArrowLeftRight className="h-3 w-3" />
                                Transferir
                              </button>
                              {canManage && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditing(table)}
                                    title="Editar"
                                    aria-label="Editar"
                                  >
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                    Editar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-danger hover:text-danger"
                                    onClick={() => remove.mutate(table.id)}
                                    title="Eliminar"
                                    aria-label="Eliminar"
                                  >
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                    Eliminar
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista móvil */}
            <div className="grid gap-3 md:hidden">
              {tables.map((table) => {
                const canAct = canManage || (user && table.assigned_waiter === user.id);
                return (
                  <div
                    key={table.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm",
                      !table.is_active && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                          <Table className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold">Mesa {table.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {table.area || "Sin área"}
                          </p>
                        </div>
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusColor(table.status))}>
                        {statusLabel(table.status)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1">
                        <Users className="h-3 w-3" />
                        {table.capacity} personas
                      </span>
                      {table.assigned_waiter ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-primary">
                          {table.assigned_waiter_name ?? `Mesero #${table.assigned_waiter}`}
                        </span>
                      ) : null}
                      {table.occupation_time ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1">
                          <Clock className="h-3 w-3" />
                          {table.occupation_time} min
                        </span>
                      ) : null}
                      {table.is_overdue ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          Vencida
                        </span>
                      ) : null}
                    </div>

                    {canAct && (
                      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        {canManage && table.status === "FREE" && (
                          <button
                            onClick={() => changeStatus.mutate({ id: table.id, action: "reserve" })}
                            disabled={changeStatus.isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                            title="Reservar"
                            aria-label="Reservar"
                          >
                            <Calendar className="h-4 w-4" />
                            <span className="sr-only">Reservar</span>
                          </button>
                        )}
                        {canManage && table.status === "OCCUPIED" && (
                          <button
                            onClick={() => changeStatus.mutate({ id: table.id, action: "free" })}
                            disabled={changeStatus.isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Liberar"
                            aria-label="Liberar"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="sr-only">Liberar</span>
                          </button>
                        )}
                        {canManage && (table.status === "RESERVED" || table.status === "CLEANING" || table.status === "OUT_OF_SERVICE") && (
                          <button
                            onClick={() => changeStatus.mutate({ id: table.id, action: "free" })}
                            disabled={changeStatus.isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Libre"
                            aria-label="Libre"
                          >
                            <Sparkles className="h-4 w-4" />
                            <span className="sr-only">Libre</span>
                          </button>
                        )}
                        <button
                          onClick={() => setTransferringTable(table)}
                          disabled={transferWaiter.isPending}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Transferir"
                          aria-label="Transferir"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                          <span className="sr-only">Transferir</span>
                        </button>
                        {canManage && (
                          <>
                            <button
                              onClick={() => setEditing(table)}
                              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                              title="Editar"
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </button>
                            <button
                              onClick={() => remove.mutate(table.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-danger"
                              title="Eliminar"
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Eliminar</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
              <p className="text-muted-foreground">
                {totalTables} mesa{totalTables === 1 ? "" : "s"} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  <span className="sm:hidden">Sig.</span>
                  <span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatedOverlay
        open={!!(creating || editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">{editing ? "Editar mesa" : "Nueva mesa"}</h2>
              <button
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="number" className="text-sm font-medium">Número *</label>
                    <Input id="number" name="number" defaultValue={editing?.number ?? ""} placeholder="Ej: 1" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="capacity" className="text-sm font-medium">Capacidad</label>
                    <Input
                      id="capacity"
                      name="capacity"
                      type="number"
                      min={1}
                      defaultValue={editing?.capacity ?? 4}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="shape" className="text-sm font-medium">Forma</label>
                    <Select id="shape" name="shape" defaultValue={editing?.shape ?? "ROUND"}>
                      <option value="ROUND">Redonda</option>
                      <option value="SQUARE">Cuadrada</option>
                      <option value="RECTANGLE">Rectangular</option>
                      <option value="OVAL">Ovalada</option>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="area" className="text-sm font-medium">Área</label>
                    <Input id="area" name="area" defaultValue={editing?.area ?? ""} placeholder="Ej: Terraza, Interior, VIP" />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="description" className="text-sm font-medium">Descripción</label>
                    <Input id="description" name="description" defaultValue={editing?.description ?? ""} />
                  </div>
                  {editing && (
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <label htmlFor="status" className="text-sm font-medium">Estado</label>
                      <Select id="status" name="status" defaultValue={editing.status ?? "FREE"}>
                        {STATUS_OPTIONS.filter((s) => s.value).map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="assigned_waiter" className="text-sm font-medium">Mesero asignado</label>
                    <Select
                      id="assigned_waiter"
                      name="assigned_waiter"
                      defaultValue={editing?.assigned_waiter ?? ""}
                    >
                      <option value="">Sin mesero asignado</option>
                      {waiters.map((w) => {
                        const userId = String(w.user);
                        const userName = String(w.user_name ?? "");
                        return (
                          <option key={userId} value={userId}>
                            {userName || `Usuario #${userId}`}
                          </option>
                        );
                      })}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="x_position" className="text-sm font-medium">Posición X</label>
                    <Input id="x_position" name="x_position" type="number" step="0.1" defaultValue={editing?.x_position ?? ""} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="y_position" className="text-sm font-medium">Posición Y</label>
                    <Input id="y_position" name="y_position" type="number" step="0.1" defaultValue={editing?.y_position ?? ""} />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreating(false);
                    setEditing(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={create.isPending || update.isPending}>
                  {editing ? "Guardar" : "Crear"}
                </Button>
              </div>
            </form>
          </div>
      </AnimatedOverlay>

      <AnimatedOverlay
        open={!!transferringTable}
        onClose={() => setTransferringTable(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card p-0 shadow-lg md:h-auto md:max-h-[90vh] md:max-w-sm md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Transferir mesa {transferringTable!.number}</h2>
              <button
                onClick={() => setTransferringTable(null)}
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const waiterId = String(formDataFromForm(form).get("transfer_waiter") ?? "");
                transferWaiter.mutate({
                  id: transferringTable!.id,
                  waiterId: waiterId ? Number(waiterId) : null,
                });
              }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-4 text-xs text-muted-foreground">
                  {transferringTable!.assigned_waiter
                    ? `Actual: ${transferringTable!.assigned_waiter_name ?? `Mesero #${transferringTable!.assigned_waiter}`}`
                    : "Sin mesero asignado"}
                </p>
                <div className="flex flex-col gap-2">
                  <label htmlFor="transfer_waiter" className="text-sm font-medium">Nuevo mesero</label>
                  <Select id="transfer_waiter" name="transfer_waiter" defaultValue="">
                    <option value="">Sin mesero asignado</option>
                    {waiters.map((w) => {
                      const userId = String(w.user);
                      const userName = String(w.user_name ?? "");
                      return (
                        <option key={userId} value={userId}>
                          {userName || `Usuario #${userId}`}
                        </option>
                      );
                    })}
                  </Select>
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransferringTable(null)}
                  disabled={transferWaiter.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={transferWaiter.isPending}>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
      </AnimatedOverlay>
    </div>
  );
}

function formDataFromForm(form: HTMLFormElement): FormData {
  return new FormData(form);
}
