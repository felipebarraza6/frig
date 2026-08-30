"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TrendingDown,
  Plus,
  Search,
  X,
  Loader2,
  Pencil,
  Trash2,
  AlertCircle,
  RotateCcw,
  Calendar,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchFixedExpenses,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
  type FixedExpense,
} from "@/lib/api/fixed-expenses";
import { fetchExpenseCategories, type ExpenseCategory } from "@/lib/api/expenses";
import { useToast } from "@/lib/store/toast";

const FREQUENCY_OPTIONS = [
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMI_ANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
  { value: "ONE_TIME", label: "Una vez" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "ACTIVE", label: "Activos" },
  { value: "INACTIVE", label: "Inactivos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "CANCELLED", label: "Cancelados" },
];

function formatCLP(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(num);
}

function statusBadge(status?: string | null) {
  switch (status) {
    case "ACTIVE": return "bg-emerald-500/10 text-emerald-700";
    case "INACTIVE": return "bg-muted text-muted-foreground";
    case "PENDING": return "bg-amber-500/10 text-amber-700";
    case "CANCELLED": return "bg-danger/10 text-danger";
    default: return "bg-muted text-muted-foreground";
  }
}

function statusLabel(s?: string | null) {
  switch (s) {
    case "ACTIVE": return "Activo";
    case "INACTIVE": return "Inactivo";
    case "PENDING": return "Pendiente";
    case "CANCELLED": return "Cancelado";
    default: return s ?? "—";
  }
}

function frequencyLabel(f?: string | null) {
  return FREQUENCY_OPTIONS.find((o) => o.value === f)?.label ?? f ?? "—";
}

export default function FixedExpensesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FixedExpense | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: expenses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["fixed-expenses", statusFilter],
    queryFn: () => fetchFixedExpenses(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: fetchExpenseCategories,
  });

  const filtered = expenses.filter((e) =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.category_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalMonthly = filtered
    .filter((e) => e.status === "ACTIVE")
    .reduce((sum, e) => sum + (parseFloat(e.monthly_amount ?? e.amount) || 0), 0);

  const createMut = useMutation({
    mutationFn: createFixedExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-expenses"] });
      setModalOpen(false);
      toast.success("Gasto fijo creado");
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateFixedExpense>[1]) =>
      updateFixedExpense(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-expenses"] });
      setEditing(null);
      toast.success("Gasto fijo actualizado");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteFixedExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-expenses"] });
      setConfirmDelete(null);
      toast.success("Gasto fijo eliminado");
    },
  });

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (e: FixedExpense) => { setEditing(e); setModalOpen(true); };

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Gastos fijos</h1>
          <p className="text-xs text-muted-foreground">Gastos recurrentes mensuales de la sucursal</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />Nuevo gasto fijo
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10"><TrendingDown className="h-3.5 w-3.5 text-primary" /></div>
              <span className="text-[11px] font-medium text-muted-foreground">Activos</span>
            </div>
            <p className="text-lg font-semibold tabular-nums">{expenses.filter((e) => e.status === "ACTIVE").length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10"><DollarSign className="h-3.5 w-3.5 text-rose-600" /></div>
              <span className="text-[11px] font-medium text-muted-foreground">Total mensual</span>
            </div>
            <p className="text-lg font-semibold tabular-nums">{formatCLP(totalMonthly)}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-border bg-card p-3 sm:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10"><Calendar className="h-3.5 w-3.5 text-amber-600" /></div>
              <span className="text-[11px] font-medium text-muted-foreground">Total anual</span>
            </div>
            <p className="text-lg font-semibold tabular-nums">{formatCLP(totalMonthly * 12)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" aria-label="Buscar" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-44">
            {STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </div>

        {/* Content */}
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <AlertCircle className="h-7 w-7 text-danger" />
            <p className="text-sm font-medium">No se pudieron cargar los gastos fijos</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (<div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-muted/30" />))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <TrendingDown className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{search ? "Sin resultados" : "No hay gastos fijos"}</p>
              <p className="text-xs text-muted-foreground">Registra un gasto fijo para comenzar.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Frecuencia</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-right">Mensual</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{e.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.category_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{frequencyLabel(e.frequency_display ?? e.frequency)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCLP(e.amount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCLP(e.monthly_amount ?? e.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(e.status_display ?? e.status)}`}>
                          {statusLabel(e.status_display ?? e.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => setConfirmDelete(e)} title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((e) => (
                <div key={e.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.category_name ?? "—"} · {frequencyLabel(e.frequency_display ?? e.frequency)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(e.status_display ?? e.status)}`}>
                      {statusLabel(e.status_display ?? e.status)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Monto:</span> <span className="tabular-nums font-medium">{formatCLP(e.amount)}</span></div>
                    <div><span className="text-muted-foreground">Mensual:</span> <span className="tabular-nums font-semibold">{formatCLP(e.monthly_amount ?? e.amount)}</span></div>
                  </div>
                  <div className="mt-3 flex justify-end gap-1 border-t border-border pt-3">
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => openEdit(e)}>
                      <Pencil className="mr-1 h-3 w-3" />Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-danger" onClick={() => setConfirmDelete(e)}>
                      <Trash2 className="mr-1 h-3 w-3" />Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal crear/editar */}
      <FixedExpenseModal
        open={modalOpen || !!editing}
        editing={editing}
        categories={categories}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={(payload) => {
          if (editing) updateMut.mutate({ id: editing.id, ...payload });
          else createMut.mutate(payload as Parameters<typeof createFixedExpense>[0]);
        }}
        isPending={createMut.isPending || updateMut.isPending}
      />

      {/* Confirm delete */}
      <AnimatedOverlay open={!!confirmDelete} onClose={() => setConfirmDelete(null)} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
        <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10">
              <AlertCircle className="h-5 w-5 text-danger" />
            </div>
            <div>
              <h2 className="text-base font-semibold">¿Eliminar gasto fijo?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Se eliminará <span className="font-medium text-foreground">{confirmDelete?.name}</span>.
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleteMut.isPending}>Cancelar</Button>
            <Button variant="danger" onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)} isLoading={deleteMut.isPending}>Eliminar</Button>
          </div>
        </div>
      </AnimatedOverlay>
    </div>
  );
}

function FixedExpenseModal({ open, editing, categories, onClose, onSubmit, isPending }: {
  open: boolean;
  editing: FixedExpense | null;
  categories: ExpenseCategory[];
  onClose: () => void;
  onSubmit: (payload: Parameters<typeof createFixedExpense>[0]) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category ?? "");
  const [amount, setAmount] = useState(editing?.amount ?? "");
  const [frequency, setFrequency] = useState<"MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL" | "ONE_TIME">(editing?.frequency as "MONTHLY" ?? "MONTHLY");
  const [startDate, setStartDate] = useState(editing?.start_date ?? new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(editing?.end_date ?? "");
  const [dueDate, setDueDate] = useState(String(editing?.due_date ?? "1"));
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE" | "PENDING" | "CANCELLED">(editing?.status as "ACTIVE" ?? "ACTIVE");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !categoryId || !amount || !startDate) return;
    onSubmit({
      name,
      description: description || undefined,
      category: categoryId,
      amount,
      frequency,
      start_date: startDate,
      end_date: endDate || null,
      due_date: parseInt(dueDate) || 1,
      status,
    });
  };

  const handleClose = () => { setName(""); setCategoryId(""); setAmount(""); onClose(); };

  return (
    <AnimatedOverlay open={open} onClose={handleClose} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
      <div className="flex h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-w-lg md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{editing ? "Editar gasto fijo" : "Nuevo gasto fijo"}</h2>
          <button onClick={handleClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="fe-name" className="text-sm font-medium">Nombre</label>
                <Input id="fe-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Arriendo local" required />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="fe-desc" className="text-sm font-medium">Descripción</label>
                <Input id="fe-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional..." />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="fe-cat" className="text-sm font-medium">Categoría</label>
                <Select id="fe-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="fe-amount" className="text-sm font-medium">Monto</label>
                  <Input id="fe-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="fe-freq" className="text-sm font-medium">Frecuencia</label>
                  <Select id="fe-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
                    {FREQUENCY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="fe-start" className="text-sm font-medium">Fecha inicio</label>
                  <Input id="fe-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="fe-due" className="text-sm font-medium">Día vencimiento</label>
                  <Input id="fe-due" type="number" min="1" max="31" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="fe-end" className="text-sm font-medium">Fecha fin (opcional)</label>
                <Input id="fe-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="fe-status" className="text-sm font-medium">Estado</label>
                <Select id="fe-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  {STATUS_OPTIONS.filter((o) => o.value).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </Select>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !name || !categoryId || !amount}>
              {isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}
