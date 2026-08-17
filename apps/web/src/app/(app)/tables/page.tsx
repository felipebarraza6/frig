"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Loader2,
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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

type TableItem = YggdraSchemas["Table"];

const STATUS_OPTIONS: { value: TableStatus | ""; label: string; color: string }[] = [
  { value: "", label: "Todos", color: "bg-muted text-muted-foreground" },
  { value: "FREE", label: "Libre", color: "bg-emerald-500/10 text-emerald-700" },
  { value: "OCCUPIED", label: "Ocupada", color: "bg-rose-500/10 text-rose-700" },
  { value: "RESERVED", label: "Reservada", color: "bg-amber-500/10 text-amber-700" },
  { value: "CLEANING", label: "Limpieza", color: "bg-blue-500/10 text-blue-700" },
  { value: "OUT_OF_SERVICE", label: "Fuera de servicio", color: "bg-slate-500/10 text-slate-700" },
];

function statusLabel(status?: TableStatus | null): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? (status ?? "—");
}

function statusColor(status?: TableStatus | null): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color ?? "bg-muted text-muted-foreground";
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
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [editing, setEditing] = useState<TableItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [transferringTable, setTransferringTable] = useState<TableItem | null>(null);
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
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Mesas</h1>
          <p className="text-xs text-muted-foreground">Gestión de mesas del local</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
            disabled={isExporting}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Nueva mesa
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-end gap-3">
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
          <Link
            href="/tables/map"
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <MapPin className="h-4 w-4" />
            Mapa de mesas
          </Link>
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las mesas.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tables.map((table) => (
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

                  {(canManage || (user && table.assigned_waiter === user.id)) && (
                    <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      {canManage && (
                        <>
                          {table.status === "FREE" && (
                            <button
                              onClick={() => changeStatus.mutate({ id: table.id, action: "reserve" })}
                              disabled={changeStatus.isPending}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/20"
                            >
                              Reservar
                            </button>
                          )}
                          {table.status === "OCCUPIED" && (
                            <button
                              onClick={() => changeStatus.mutate({ id: table.id, action: "free" })}
                              disabled={changeStatus.isPending}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/20"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Liberar
                            </button>
                          )}
                          {(table.status === "RESERVED" || table.status === "CLEANING" || table.status === "OUT_OF_SERVICE") && (
                            <button
                              onClick={() => changeStatus.mutate({ id: table.id, action: "free" })}
                              disabled={changeStatus.isPending}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/20"
                            >
                              <Sparkles className="h-3 w-3" />
                              Libre
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => setTransferringTable(table)}
                        disabled={transferWaiter.isPending}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-500/20"
                      >
                        Transferir
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => setEditing(table)}
                            className="ml-auto inline-flex items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => remove.mutate(table.id)}
                            className="inline-flex items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-danger"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {tables.length === 0 && (
              <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">No hay mesas registradas.</p>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
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

      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
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
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="number" className="text-xs text-muted-foreground">Número *</label>
                  <Input id="number" name="number" defaultValue={editing?.number ?? ""} placeholder="Ej: 1" />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="capacity" className="text-xs text-muted-foreground">Capacidad</label>
                  <Input
                    id="capacity"
                    name="capacity"
                    type="number"
                    min={1}
                    defaultValue={editing?.capacity ?? 4}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="shape" className="text-xs text-muted-foreground">Forma</label>
                  <Select id="shape" name="shape" defaultValue={editing?.shape ?? "ROUND"}>
                    <option value="ROUND">Redonda</option>
                    <option value="SQUARE">Cuadrada</option>
                    <option value="RECTANGLE">Rectangular</option>
                    <option value="OVAL">Ovalada</option>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="area" className="text-xs text-muted-foreground">Área</label>
                <Input id="area" name="area" defaultValue={editing?.area ?? ""} placeholder="Ej: Terraza, Interior, VIP" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="description" className="text-xs text-muted-foreground">Descripción</label>
                <Input id="description" name="description" defaultValue={editing?.description ?? ""} />
              </div>
              {editing && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="status" className="text-xs text-muted-foreground">Estado</label>
                  <Select id="status" name="status" defaultValue={editing.status ?? "FREE"}>
                    {STATUS_OPTIONS.filter((s) => s.value).map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label htmlFor="assigned_waiter" className="text-xs text-muted-foreground">Mesero asignado</label>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="x_position" className="text-xs text-muted-foreground">Posición X</label>
                  <Input id="x_position" name="x_position" type="number" step="0.1" defaultValue={editing?.x_position ?? ""} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="y_position" className="text-xs text-muted-foreground">Posición Y</label>
                  <Input id="y_position" name="y_position" type="number" step="0.1" defaultValue={editing?.y_position ?? ""} />
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
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
                <Button type="submit" disabled={create.isPending || update.isPending}>
                  {create.isPending || update.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {editing ? "Guardar" : "Crear"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transferringTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4">
              <h2 className="text-base font-semibold">Transferir mesa {transferringTable.number}</h2>
              <p className="text-xs text-muted-foreground">
                {transferringTable.assigned_waiter
                  ? `Actual: ${transferringTable.assigned_waiter_name ?? `Mesero #${transferringTable.assigned_waiter}`}`
                  : "Sin mesero asignado"}
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const waiterId = String(formDataFromForm(form).get("transfer_waiter") ?? "");
                transferWaiter.mutate({
                  id: transferringTable.id,
                  waiterId: waiterId ? Number(waiterId) : null,
                });
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="transfer_waiter" className="text-xs text-muted-foreground">Nuevo mesero</label>
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
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransferringTable(null)}
                  disabled={transferWaiter.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={transferWaiter.isPending}>
                  {transferWaiter.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formDataFromForm(form: HTMLFormElement): FormData {
  return new FormData(form);
}
