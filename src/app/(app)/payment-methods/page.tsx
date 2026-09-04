"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  X,
  Power,
  Search,
  Banknote,
  Landmark,
  FileCheck,
  Wallet,
  Smartphone,
  Bitcoin,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
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

/** Identidad visual por tipo: cuadrito sólido cuyo color deriva siempre del primary de marca. */
interface PaymentTypeMeta {
  icon: LucideIcon;
  solid: string;
  iconClass: string;
}

const TYPE_META: Record<YggdraPaymentMethod["payment_type"], PaymentTypeMeta> = {
  CASH: { icon: Banknote, solid: "bg-primary", iconClass: "text-white" },
  BANK_TRANSFER: { icon: Landmark, solid: "bg-[color-mix(in_oklab,var(--color-primary),black_12%)]", iconClass: "text-white" },
  CHECK: { icon: FileCheck, solid: "bg-[color-mix(in_oklab,var(--color-primary),black_28%)]", iconClass: "text-white" },
  CREDIT_CARD: { icon: CreditCard, solid: "bg-[color-mix(in_oklab,var(--color-primary),black_45%)]", iconClass: "text-white" },
  DEBIT_CARD: { icon: Wallet, solid: "bg-[color-mix(in_oklab,var(--color-primary),white_18%)]", iconClass: "text-[color-mix(in_oklab,var(--color-primary),black_55%)]" },
  DIGITAL_WALLET: { icon: Smartphone, solid: "bg-[color-mix(in_oklab,var(--color-primary),white_32%)]", iconClass: "text-[color-mix(in_oklab,var(--color-primary),black_55%)]" },
  CRYPTO: { icon: Bitcoin, solid: "bg-[color-mix(in_oklab,var(--color-primary),black_60%)]", iconClass: "text-white" },
  OTHER: { icon: MoreHorizontal, solid: "bg-[color-mix(in_oklab,var(--color-primary),black_35%)]", iconClass: "text-white" },
};

export default function PaymentMethodsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<YggdraPaymentMethod | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<YggdraPaymentMethod | null>(null);
  const [detail, setDetail] = useState<YggdraPaymentMethod | null>(null);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
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

  // Creación rápida desde el tile punteado: solo nombre, se configura el resto al editar.
  const quickCreate = useMutation({
    mutationFn: () =>
      createPaymentMethod({
        name: createName.trim(),
        payment_type: "CASH",
        requires_reference: false,
        is_pos_enabled: true,
        is_active: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      setCreating(false);
      setCreateName("");
    },
  });

  function toggleActive(method: YggdraPaymentMethod) {
    updatePaymentMethod(method.id, { is_active: !method.is_active }).then(() =>
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] }),
    );
  }

  function openModal(method?: YggdraPaymentMethod) {
    setEditing(method ?? null);
    if (method) {
      setForm({
        name: method.name,
        payment_type: method.payment_type,
        requires_reference: method.requires_reference ?? false,
        processing_fee: method.processing_fee?.toString() ?? "",
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
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
              {!search && (
                <Button className="mt-4" size="sm" onClick={() => openModal()}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nuevo método
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Galería de tarjetas: cada método es un cuadrito clickeable que abre
             su detalle; al final, un tile punteado crea rápido con solo el nombre. */
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredMethods.map((m) => {
              const meta = TYPE_META[m.payment_type] ?? TYPE_META.OTHER;
              const Icon = meta.icon;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(m)}
                    className={`flex h-full w-full flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${m.is_active ? "" : "opacity-60"}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.solid}`} title={paymentTypeLabel(m.payment_type)}>
                        <Icon className={`h-5 w-5 ${meta.iconClass}`} />
                      </span>
                      {m.is_pos_enabled && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          POS
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {paymentTypeLabel(m.payment_type)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            <li>
              {creating ? (
                <div className="flex h-full flex-col justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 p-3">
                  <Input
                    autoFocus
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (createName.trim() && !quickCreate.isPending) quickCreate.mutate();
                      }
                    }}
                    placeholder="Nombre…"
                    aria-label="Nombre del método"
                    className="h-9 text-sm"
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      className="h-8 flex-1"
                      onClick={() => quickCreate.mutate()}
                      isLoading={quickCreate.isPending}
                      disabled={!createName.trim()}
                    >
                      Crear
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setCreating(false); setCreateName(""); }}
                      aria-label="Cancelar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {quickCreate.isError && (
                    <p className="text-xs text-danger">
                      {quickCreate.error instanceof Error ? quickCreate.error.message : "Error al crear"}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex h-full min-h-[7.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs font-medium">Nuevo método</span>
                </button>
              )}
            </li>
          </ul>
        )}
      </div>

      <AnimatedOverlay
        open={modalOpen}
        onClose={closeModal}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
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
                <Button type="submit" isLoading={save.isPending}>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
      </AnimatedOverlay>

      {detail && (
        <MethodDetailModal
          method={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { openModal(detail); setDetail(null); }}
          onToggle={() => { toggleActive(detail); setDetail(null); }}
          onDelete={() => { setConfirmDelete(detail); setDetail(null); }}
        />
      )}

{confirmDelete && (
      <AnimatedOverlay
        open={true}
        onClose={() => setConfirmDelete(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
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
                isLoading={remove.isPending}
              >
                Eliminar
              </Button>
            </div>
          </div>
      </AnimatedOverlay>
)}
    </div>
  );
}

function MethodDetailModal({ method, onClose, onEdit, onToggle, onDelete }: {
  method: YggdraPaymentMethod;
  onClose: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[method.payment_type] ?? TYPE_META.OTHER;
  const Icon = meta.icon;
  return (
    <AnimatedOverlay
      open
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="w-full rounded-t-xl border-x border-t border-border bg-card shadow-lg md:max-w-sm md:rounded-xl md:border">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.solid}`}>
              <Icon className={`h-6 w-6 ${meta.iconClass}`} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{method.name}</h2>
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {paymentTypeLabel(method.payment_type)}
              </span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className={`mt-0.5 font-medium ${method.is_active ? "text-success" : "text-muted-foreground"}`}>
              {method.is_active ? "Activo" : "Inactivo"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Disponible en POS</p>
            <p className="mt-0.5 font-medium">{method.is_pos_enabled ? "Sí" : "No"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Comisión</p>
            <p className="mt-0.5 font-medium">{method.processing_fee ? `${method.processing_fee}%` : "Sin comisión"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Referencia</p>
            <p className="mt-0.5 font-medium">{method.requires_reference ? "Requerida" : "No requerida"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4">
          <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={onDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />Eliminar
          </Button>
          <Button variant="outline" size="sm" onClick={onToggle}>
            <Power className="mr-1.5 h-3.5 w-3.5" />{method.is_active ? "Desactivar" : "Activar"}
          </Button>
          <Button size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar
          </Button>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
