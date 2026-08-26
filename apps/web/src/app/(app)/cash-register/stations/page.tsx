"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  X,
  Monitor,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchCashRegisterStations,
  createCashRegisterStation,
  updateCashRegisterStation,
  deleteCashRegisterStation,
  type CashRegisterStation,
  type CashRegisterStationRequest,
} from "@/lib/api/cash-register-stations";
import { useCurrentBranch } from "@/lib/store/session";

interface StationFormState {
  name: string;
  code: string;
  is_active: boolean;
}

function emptyForm(): StationFormState {
  return { name: "", code: "", is_active: true };
}

function stationToForm(station: CashRegisterStation): StationFormState {
  return {
    name: station.name,
    code: station.code,
    is_active: station.is_active ?? true,
  };
}

export default function CashRegisterStationsPage() {
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CashRegisterStation | null>(null);
  const [form, setForm] = useState<StationFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CashRegisterStation | null>(null);

  const { data: stations = [], isLoading, error } = useQuery({
    queryKey: ["cash-register-stations"],
    queryFn: fetchCashRegisterStations,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CashRegisterStationRequest) =>
      createCashRegisterStation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register-stations"] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CashRegisterStationRequest> }) =>
      updateCashRegisterStation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register-stations"] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCashRegisterStation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register-stations"] });
      setConfirmDelete(null);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q),
    );
  }, [stations, search]);

  function openModal(station?: CashRegisterStation) {
    setEditing(station ?? null);
    setFormError(null);
    setForm(station ? stationToForm(station) : emptyForm());
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    if (!form.code.trim()) {
      setFormError("El código es obligatorio.");
      return;
    }

    const payload: CashRegisterStationRequest = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      is_active: form.is_active,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleDelete() {
    if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const serverError =
    (createMutation.error instanceof Error ? createMutation.error.message : null) ||
    (updateMutation.error instanceof Error ? updateMutation.error.message : null);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Estaciones de caja / POS</h1>
          <p className="text-xs text-muted-foreground">
            {branch ? `Sucursal: ${branch.business_name}` : "Crea y gestiona los puntos de venta físicos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            onClick={() => openModal()}
            className="sm:hidden"
            title="Nueva estación"
            aria-label="Nueva estación"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
            className="hidden sm:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva estación
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar estación…"
            className="pl-9"
            aria-label="Buscar estación"
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
            <p className="font-medium">No se pudieron cargar las estaciones.</p>
            {error instanceof Error && <p className="mt-1 opacity-90">{error.message}</p>}
          </div>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Monitor className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {search ? "No se encontraron estaciones" : "Aún no hay estaciones creadas"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search
                  ? "Prueba con otro término de búsqueda."
                  : "Crea una nueva estación para comenzar."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Estación</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((station) => (
                    <tr key={station.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                            <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{station.name}</p>
                            <p className="text-xs text-muted-foreground">{station.branch_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {station.code}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex rounded px-2 py-0.5 text-xs font-medium",
                            station.is_active
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-rose-500/10 text-rose-700",
                          )}
                        >
                          {station.is_active ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openModal(station)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(station)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((station) => (
                <div
                  key={station.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <Monitor className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{station.name}</p>
                        <p className="text-xs text-muted-foreground">{station.branch_name}</p>
                        <span
                          className={cn(
                            "mt-1 inline-flex rounded px-2 py-0.5 text-[10px] font-medium",
                            station.is_active
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-rose-500/10 text-rose-700",
                          )}
                        >
                          {station.is_active ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openModal(station)}
                        title="Editar"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-danger hover:text-danger"
                        onClick={() => setConfirmDelete(station)}
                        title="Eliminar"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">
                    <span className="block text-[10px] uppercase tracking-wide">Código</span>
                    <span className="font-mono font-medium text-foreground">{station.code}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">
                {editing ? "Editar estación" : "Nueva estación"}
              </h2>
              <button
                onClick={closeModal}
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="flex flex-1 flex-col overflow-hidden"
              id="station-form"
            >
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="station-name" className="text-sm font-medium">
                      Nombre
                    </label>
                    <Input
                      id="station-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ej: Caja 1"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="station-code" className="text-sm font-medium">
                      Código
                    </label>
                    <Input
                      id="station-code"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      placeholder="Ej: CAJA1"
                      required
                    />
                    <p className="text-xs text-muted-foreground">Código único por sucursal.</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    Activa
                  </label>

                  {formError && <p className="text-sm text-danger">{formError}</p>}
                  {serverError && !formError && <p className="text-sm text-danger">{serverError}</p>}
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar estación?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará{" "}
              <span className="font-medium text-foreground">{confirmDelete.name}</span>. Esta
              acción no se puede deshacer.
            </p>
            {deleteMutation.error && (
              <p className="mt-2 text-sm text-danger">
                {deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : "Error al eliminar"}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
