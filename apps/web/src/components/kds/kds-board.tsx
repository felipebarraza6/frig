"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChefHat,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Settings2,
  Trash2,
  Utensils,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  cancelKitchenTicket,
  deliverKitchenTicket,
  fetchKitchenTickets,
  readyKitchenTicket,
  startKitchenTicket,
  type KitchenTicket,
} from "@/lib/api/kitchen";
import {
  createKitchenStation,
  deleteKitchenStation,
  fetchKitchenStations,
  updateKitchenStation,
  type KitchenStation,
} from "@/lib/api/kitchen-stations";
import { useCategoryOptions } from "@/lib/hooks/useCategoryOptions";
import { useCurrentBranch } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

const COLUMNS: {
  key: KitchenTicket["status"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { key: "PENDING", label: "Pendientes", icon: Clock, color: "bg-amber-500" },
  { key: "PREPARING", label: "En preparación", icon: ChefHat, color: "bg-blue-500" },
  { key: "READY", label: "Listos", icon: Utensils, color: "bg-emerald-500" },
];

function visibleItems(items: KitchenTicket["items"], stationId: number | null) {
  if (!stationId) return items;
  return items.filter((item) => item.station === stationId);
}

interface KdsBoardProps {
  /** Si se pasa, el KDS se fija a una estación (modo pantalla física). */
  fixedStationId?: number | null;
  /** Título opcional para la cabecera. */
  title?: string;
  /** Clases adicionales para el contenedor principal. */
  className?: string;
  /** Modo monitor: solo lectura, sin botones de acción. */
  mode?: "operate" | "monitor";
}

export function KdsBoard({
  fixedStationId,
  title,
  className,
  mode = "operate",
}: KdsBoardProps) {
  const isMonitor = mode === "monitor";
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFixed = fixedStationId !== undefined && fixedStationId !== null;

  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const selectedStationId = useMemo(() => {
    if (isFixed) return fixedStationId;
    const raw = searchParams.get("station_id");
    return raw ? Number(raw) : null;
  }, [isFixed, fixedStationId, searchParams]);

  const updateStationParam = (id: number | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("station_id", String(id));
    else params.delete("station_id");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const branchId = branch?.id ? Number(branch.id) : null;

  const { data: stations = [] } = useQuery({
    queryKey: ["kitchen-stations"],
    queryFn: fetchKitchenStations,
    enabled: !!branchId,
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["kitchen-tickets", selectedStationId],
    queryFn: () => fetchKitchenTickets(undefined, selectedStationId),
    refetchInterval: 10_000,
    enabled: !!branch,
  });

  const toast = useToast();

  const invalidateTickets = () =>
    queryClient.invalidateQueries({ queryKey: ["kitchen-tickets"] });

  const mutationOptions = {
    onSuccess: invalidateTickets,
    onError: (error: Error) => {
      toast.error(error.message || "Error al actualizar la comanda");
    },
  };
  const startMutation = useMutation({
    mutationFn: startKitchenTicket,
    ...mutationOptions,
  });
  const readyMutation = useMutation({
    mutationFn: readyKitchenTicket,
    ...mutationOptions,
  });
  const deliverMutation = useMutation({
    mutationFn: deliverKitchenTicket,
    ...mutationOptions,
  });
  const cancelMutation = useMutation({
    mutationFn: cancelKitchenTicket,
    ...mutationOptions,
  });

  const selectedStation = useMemo(
    () => stations.find((s) => s.id === selectedStationId) || null,
    [stations, selectedStationId]
  );

  if (isLoading) {
    return (
      <div className={cn("flex min-h-full flex-col gap-4 p-6", className)}>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-full sm:w-64" />
        </header>
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, col) => (
            <div
              key={col}
              className="flex min-h-0 flex-col rounded-xl border border-border bg-card"
            >
              <div className="flex items-center gap-2 px-4 py-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-6 rounded-full" />
              </div>
              <div className="flex flex-col gap-3 p-3">
                {Array.from({ length: col === 0 ? 3 : 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-background p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <div className="mb-3 flex flex-col gap-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-full flex-col gap-4 p-6", className)}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {title || (isFixed ? selectedStation?.name || "Estación" : "Cocina")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isMonitor
              ? branch?.business_name || "Sin sucursal seleccionada"
              : `${branch ? `Sucursal: ${branch.business_name}` : "Sin sucursal seleccionada"}${selectedStation ? ` · Estación: ${selectedStation.name}` : " · Todas las estaciones"}`}
          </p>
        </div>
        {!isMonitor && (
          <div className="flex flex-wrap items-center gap-2">
            {isFixed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/kds")}
              >
                <LayoutDashboard className="mr-1 h-4 w-4" />
                Dashboard central
              </Button>
            ) : (
              <>
                <Select
                  value={selectedStationId ?? ""}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : null;
                    updateStationParam(value);
                  }}
                  className="w-full sm:w-64"
                >
                  <option value="">Todas las estaciones</option>
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsConfigOpen(true)}
                  title="Configurar estaciones"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </header>

      {!isFixed && stations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stations.map((station) => (
            <Button
              key={station.id}
              variant={selectedStationId === station.id ? "default" : "outline"}
              size="sm"
              onClick={() => router.push(`/kds/station/${station.id}`)}
            >
              {station.name}
            </Button>
          ))}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const Icon = col.icon;
          const columnTickets = tickets
            .filter((t) => t.status === col.key)
            .filter((t) => visibleItems(t.items, selectedStationId).length > 0);
          return (
            <div
              key={col.key}
              className="flex min-h-0 flex-col rounded-xl border border-border bg-card"
            >
              <div
                className={cn(
                  "flex items-center gap-2 rounded-t-xl px-4 py-3 text-white",
                  col.color
                )}
              >
                <Icon className="h-4 w-4" />
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
                  {columnTickets.length}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
                {columnTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <ClipboardList className="h-8 w-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-muted-foreground">Sin comandas</p>
                    <p className="text-xs text-muted-foreground/80">
                      Esperando nuevas órdenes
                    </p>
                  </div>
                ) : (
                  columnTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      selectedStationId={selectedStationId}
                      isMonitor={isMonitor}
                      startMutation={startMutation}
                      readyMutation={readyMutation}
                      deliverMutation={deliverMutation}
                      cancelMutation={cancelMutation}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isConfigOpen && (
        <StationsModal
          branchId={branchId}
          stations={stations}
          onClose={() => setIsConfigOpen(false)}
        />
      )}
    </div>
  );
}

function TicketCard({
  ticket,
  selectedStationId,
  isMonitor,
  startMutation,
  readyMutation,
  deliverMutation,
  cancelMutation,
}: {
  ticket: KitchenTicket;
  selectedStationId: number | null;
  isMonitor?: boolean;
  startMutation: ReturnType<typeof useMutation<KitchenTicket, Error, number>>;
  readyMutation: ReturnType<typeof useMutation<KitchenTicket, Error, number>>;
  deliverMutation: ReturnType<typeof useMutation<KitchenTicket, Error, number>>;
  cancelMutation: ReturnType<typeof useMutation<KitchenTicket, Error, number>>;
}) {
  const items = visibleItems(ticket.items, selectedStationId);
  const isPending =
    startMutation.isPending ||
    readyMutation.isPending ||
    deliverMutation.isPending ||
    cancelMutation.isPending;

  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Orden #{ticket.order.slice(0, 8)}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {new Date(ticket.created).toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {ticket.notes && (
        <p className="mb-2 text-xs text-amber-700">{ticket.notes}</p>
      )}

      <ul className="mb-3 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between text-sm">
            <div className="flex flex-col">
              <span className="font-medium">{item.product_name}</span>
              {item.station_name && (
                <span className="text-[10px] text-muted-foreground">
                  {item.station_name}
                </span>
              )}
            </div>
            <span className="tabular-nums text-muted-foreground">
              x{parseFloat(item.quantity || "0")}
            </span>
          </li>
        ))}
      </ul>

      {!isMonitor && (
        <div className="flex flex-wrap gap-2">
          {ticket.status === "PENDING" && (
            <Button
              size="sm"
              onClick={() => startMutation.mutate(ticket.id)}
              disabled={isPending}
              isLoading={startMutation.isPending}
            >
              Preparar
            </Button>
          )}
          {ticket.status === "PREPARING" && (
            <Button
              size="sm"
              onClick={() => readyMutation.mutate(ticket.id)}
              disabled={isPending}
              isLoading={readyMutation.isPending}
            >
              Listo
            </Button>
          )}
          {ticket.status === "READY" && (
            <Button
              size="sm"
              onClick={() => deliverMutation.mutate(ticket.id)}
              disabled={isPending}
              isLoading={deliverMutation.isPending}
            >
              Entregar
            </Button>
          )}
          {ticket.status !== "DELIVERED" && ticket.status !== "CANCELLED" && (
            <Button
              size="sm"
              variant="outline"
              className="text-danger hover:bg-danger/10"
              onClick={() => cancelMutation.mutate(ticket.id)}
              disabled={isPending}
              isLoading={cancelMutation.isPending}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function StationsModal({
  branchId,
  stations,
  onClose,
}: {
  branchId: number | null;
  stations: KitchenStation[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  const { options: categoryOptions = [] } = useCategoryOptions();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["kitchen-stations"] });
  };

  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createKitchenStation,
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof updateKitchenStation>[1];
    }) => updateKitchenStation(id, payload),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteKitchenStation,
    onSuccess: () => {
      invalidate();
      toast.success("Estación eliminada");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al eliminar estación");
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSelectedCategories([]);
    setFormError(null);
  };

  const startEdit = (station: KitchenStation) => {
    setEditingId(station.id);
    setName(station.name);
    setSelectedCategories(station.categories.map((c) => c.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !branchId) return;

    const payload = {
      name: name.trim(),
      category_ids: selectedCategories,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar la estación");
    }
  };

  const toggleCategory = (id: number) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      className="bg-black/50"
      panelClassName="flex items-end justify-center sm:items-center sm:p-4"
    >
      <div className="flex h-[85vh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Estaciones de cocina</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <form onSubmit={handleSubmit} className="mb-6 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Nombre</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Cocina caliente, Barra, Pastelería"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Categorías asignadas</label>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      selectedCategories.includes(category.id)
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    {category.name}
                  </button>
                ))}
                {categoryOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay categorías disponibles.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!name.trim() || createMutation.isPending || updateMutation.isPending} isLoading={createMutation.isPending || updateMutation.isPending}>
                {editingId ? (
                  "Guardar cambios"
                ) : (
                  "Crear estación"
                )}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
            {formError && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                {formError}
              </p>
            )}
          </form>

          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Estaciones existentes</h3>
            {stations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay estaciones configuradas.</p>
            ) : (
              stations.map((station) => (
                <div
                  key={station.id}
                  className="flex items-start justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{station.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {station.categories.length
                        ? station.categories.map((c) => c.name).join(", ")
                        : "Sin categorías"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(station)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:bg-danger/10"
                      onClick={() => deleteMutation.mutate(station.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
