"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, CreditCard, X, Power, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  type YggdraPaymentMethod,
} from "@/lib/api/payments";
import { paymentTypeLabel } from "@/lib/utils";

const PAYMENT_TYPES = [
  { value: "CASH", label: paymentTypeLabel("CASH") },
  { value: "BANK_TRANSFER", label: paymentTypeLabel("BANK_TRANSFER") },
  { value: "CHECK", label: paymentTypeLabel("CHECK") },
  { value: "CREDIT_CARD", label: paymentTypeLabel("CREDIT_CARD") },
  { value: "DEBIT_CARD", label: paymentTypeLabel("DEBIT_CARD") },
  { value: "DIGITAL_WALLET", label: paymentTypeLabel("DIGITAL_WALLET") },
  { value: "CRYPTO", label: paymentTypeLabel("CRYPTO") },
  { value: "OTHER", label: paymentTypeLabel("OTHER") },
] as const;

export default function PaymentMethodsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<YggdraPaymentMethod | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<YggdraPaymentMethod | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    payment_type: "CASH" as YggdraPaymentMethod["payment_type"],
    requires_reference: false,
    processing_fee: "",
    is_pos_enabled: true,
    is_active: true,
  });

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
  });

  const filteredMethods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return methods;
    return methods.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        paymentTypeLabel(m.payment_type).toLowerCase().includes(q),
    );
  }, [methods, search]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        payment_type: form.payment_type,
        requires_reference: form.requires_reference,
        processing_fee: form.processing_fee || undefined,
        is_pos_enabled: form.is_pos_enabled,
        is_active: form.is_active,
      };
      if (editing) {
        await updatePaymentMethod(editing.id, payload);
      } else {
        await createPaymentMethod(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePaymentMethod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      setConfirmDelete(null);
    },
  });

  function openModal(method?: YggdraPaymentMethod) {
    setEditing(method ?? null);
    if (method) {
      setForm({
        name: method.name,
        payment_type: method.payment_type,
        requires_reference: method.requires_reference ?? false,
        processing_fee: method.processing_fee ?? "",
        is_pos_enabled: method.is_pos_enabled ?? true,
        is_active: method.is_active ?? true,
      });
    } else {
      setForm({
        name: "",
        payment_type: "CASH",
        requires_reference: false,
        processing_fee: "",
        is_pos_enabled: true,
        is_active: true,
      });
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Métodos de pago</h1>
          <p className="text-xs text-muted-foreground">
            Configura los métodos de pago aceptados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            onClick={() => openModal()}
            className="sm:hidden"
            title="Nuevo método"
            aria-label="Nuevo método"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
            className="hidden sm:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo método
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar método…"
            className="pl-9"
            aria-label="Buscar método"
          />
        </div>

        {isLoading ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border px-4 py-3">
              <Skeleton className="h-3 w-40" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="hidden h-4 w-20 sm:block" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : filteredMethods.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <CreditCard className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {search ? "No se encontraron métodos" : "No hay métodos de pago configurados"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search
                  ? "Prueba con otro término de búsqueda."
                  : "Agrega un nuevo método de pago."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-center">Referencia</th>
                    <th className="px-4 py-3 text-right">Comisión</th>
                    <th className="px-4 py-3 text-center">POS</th>
                    <th className="px-4 py-3 text-center">Activo</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMethods.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {paymentTypeLabel(m.payment_type)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.requires_reference ? "Sí" : "No"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {m.processing_fee ? `${m.processing_fee}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            m.is_pos_enabled
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {m.is_pos_enabled ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            updatePaymentMethod(m.id, { is_active: !m.is_active }).then(() =>
                              queryClient.invalidateQueries({ queryKey: ["payment-methods"] }),
                            )
                          }
                          className={m.is_active ? "text-emerald-600 hover:text-emerald-700" : "text-muted-foreground hover:text-danger"}
                          aria-label={`${m.is_active ? "Desactivar" : "Activar"} ${m.name}`}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openModal(m)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(m)}
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
              {filteredMethods.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{paymentTypeLabel(m.payment_type)}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={
                              m.is_pos_enabled
                                ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                                : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                            }
                          >
                            POS {m.is_pos_enabled ? "Sí" : "No"}
                          </span>
                          <button
                            onClick={() =>
                              updatePaymentMethod(m.id, { is_active: !m.is_active }).then(() =>
                                queryClient.invalidateQueries({ queryKey: ["payment-methods"] }),
                              )
                            }
                            className={m.is_active ? "text-emerald-600 hover:text-emerald-700" : "text-muted-foreground hover:text-danger"}
                            aria-label={`${m.is_active ? "Desactivar" : "Activar"} ${m.name}`}
                            title={`${m.is_active ? "Desactivar" : "Activar"}`}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openModal(m)}
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
                        onClick={() => setConfirmDelete(m)}
                        title="Eliminar"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Referencia</span>
                      <span className="font-medium text-foreground">{m.requires_reference ? "Sí" : "No"}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Comisión</span>
                      <span className="font-medium text-foreground">{m.processing_fee ? `${m.processing_fee}%` : "—"}</span>
                    </div>
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
              <h2 className="text-base font-semibold">{editing ? "Editar método" : "Nuevo método de pago"}</h2>
              <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
              className="flex flex-1 flex-col overflow-hidden"
              id="payment-method-form"
            >
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pm-name" className="text-sm font-medium">Nombre</label>
                    <Input
                      id="pm-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="Ej: Efectivo"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pm-type" className="text-sm font-medium">Tipo</label>
                    <Select
                      id="pm-type"
                      value={form.payment_type}
                      onChange={(e) => setForm({ ...form, payment_type: e.target.value as YggdraPaymentMethod["payment_type"] })}
                    >
                      {PAYMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="pm-fee" className="text-sm font-medium">Comisión (%)</label>
                      <Input
                        id="pm-fee"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.processing_fee}
                        onChange={(e) => setForm({ ...form, processing_fee: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="pm-ref" className="text-sm font-medium">Requiere referencia</label>
                      <Select
                        id="pm-ref"
                        value={form.requires_reference ? "true" : "false"}
                        onChange={(e) => setForm({ ...form, requires_reference: e.target.value === "true" })}
                      >
                        <option value="false">No</option>
                        <option value="true">Sí</option>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_pos_enabled}
                        onChange={(e) => setForm({ ...form, is_pos_enabled: e.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                      Disponible en POS
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                      Activo
                    </label>
                  </div>
                  {save.isError && (
                    <p className="text-sm text-danger">
                      {save.error instanceof Error ? save.error.message : "Error al guardar"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar método de pago?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.name}</span>.
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
