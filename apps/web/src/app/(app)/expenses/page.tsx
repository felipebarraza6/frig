"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Loader2, X, Ban, TrendingUp, FileDown, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchExpenses,
  fetchExpenseCategories,
  createExpense,
  updateExpense,
  deleteExpense,
  cancelExpense,
  exportExpensesExcel,
  downloadExpenseVoucher,
  type FixedExpense,
  type FixedExpenseRequest,
} from "@/lib/api/expenses";
import { formatCLP } from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "PENDING", label: "Pendiente" },
  { value: "CANCELLED", label: "Cancelado" },
];

const FREQUENCY_OPTIONS = [
  { value: "ONE_TIME", label: "Una vez" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMI_ANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
];

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

function frequencyLabel(value?: string | null): string {
  return FREQUENCY_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FixedExpense | null>(null);
  const [form, setForm] = useState<FixedExpenseRequest>({
    name: "",
    description: "",
    branch: 0,
    category: "",
    amount: "",
    frequency: "ONE_TIME",
    start_date: new Date().toISOString().slice(0, 10),
    status: "ACTIVE",
    is_recurring: false,
    supplier: "",
    notes: "",
  });

  const { data: page, isLoading } = useQuery({
    queryKey: ["expenses", { search, category, status, startDate, endDate, pageUrl }],
    queryFn: () => fetchExpenses({ search, category, status, startDate, endDate, ...pageUrl }),
  });

  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const filter = { search, category, status, startDate, endDate };

  async function handleExportExcel() {
    await downloadFile(() => exportExpensesExcel(filter), {
      filename: exportFilename("egresos", "xlsx"),
      extension: "xlsx",
    });
  }

  async function handleDownloadVoucher(expense: FixedExpense) {
    await downloadFile(() => downloadExpenseVoucher(expense.id), {
      filename: `comprobante_${expense.id.slice(0, 8)}.pdf`,
    });
  }

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: fetchExpenseCategories,
  });

  const expenses = page?.results ?? [];
  const totalExpenses = page?.count ?? 0;

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateExpense(editing.id, form);
      } else {
        await createExpense(form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setConfirmDelete(null);
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelExpense(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  function openModal(expense?: FixedExpense) {
    setEditing(expense ?? null);
    if (expense) {
      setForm({
        name: expense.name,
        description: expense.description ?? "",
        branch: expense.branch,
        category: expense.category,
        amount: expense.amount,
        frequency: expense.frequency ?? "ONE_TIME",
        start_date: expense.start_date,
        end_date: expense.end_date ?? undefined,
        status: expense.status ?? "ACTIVE",
        is_recurring: expense.is_recurring ?? false,
        supplier: expense.supplier ?? "",
        notes: expense.notes ?? "",
      });
    } else {
      setForm({
        name: "",
        description: "",
        branch: 0,
        category: "",
        amount: "",
        frequency: "ONE_TIME",
        start_date: new Date().toISOString().slice(0, 10),
        status: "ACTIVE",
        is_recurring: false,
        supplier: "",
        notes: "",
      });
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Egresos</h1>
          <p className="text-xs text-muted-foreground">
            Gastos, proveedores y pagos recurrentes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Exportar Excel
          </Button>
          <Button onClick={() => openModal()}>
            <Plus className="h-4 w-4" />
            Nuevo egreso
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Buscar gasto…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-category" className="text-xs text-muted-foreground">Categoría</label>
            <Select
              id="filter-category"
              value={category}
              onChange={(e) => updateFilter(setCategory, e.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
            <Select
              id="filter-status"
              value={status}
              onChange={(e) => updateFilter(setStatus, e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-start" className="text-xs text-muted-foreground">Desde</label>
            <Input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => updateFilter(setStartDate, e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-end" className="text-xs text-muted-foreground">Hasta</label>
            <Input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => updateFilter(setEndDate, e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Gasto</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Frecuencia</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Inicio</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{e.name}</p>
                            {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.category_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.supplier_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{frequencyLabel(e.frequency)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(e.amount)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            e.status === "ACTIVE"
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : e.status === "CANCELLED"
                                ? "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger"
                                : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700"
                          }
                        >
                          {statusLabel(e.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.start_date}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadVoucher(e)}
                            disabled={isDownloading}
                            title="Descargar comprobante"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openModal(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {e.status !== "CANCELLED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancel.mutate(e.id)}
                              disabled={cancel.isPending}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Anular
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {totalExpenses} gasto{totalExpenses === 1 ? "" : "s"} en total
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
              <h2 className="text-base font-semibold">{editing ? "Editar egreso" : "Nuevo egreso"}</h2>
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
                <label htmlFor="expense-name" className="text-sm font-medium">Nombre</label>
                <Input
                  id="expense-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="expense-category" className="text-sm font-medium">Categoría</label>
                  <Select
                    id="expense-category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                  >
                    <option value="">Selecciona</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="expense-amount" className="text-sm font-medium">Monto</label>
                  <Input
                    id="expense-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="expense-frequency" className="text-sm font-medium">Frecuencia</label>
                  <Select
                    id="expense-frequency"
                    value={form.frequency}
                    onChange={(e) => {
                      const freq = e.target.value as FixedExpenseRequest["frequency"];
                      setForm({ ...form, frequency: freq, is_recurring: freq !== "ONE_TIME" });
                    }}
                  >
                    {FREQUENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="expense-date" className="text-sm font-medium">Fecha inicio</label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="expense-supplier" className="text-sm font-medium">Proveedor</label>
                <Input
                  id="expense-supplier"
                  value={form.supplier ?? ""}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value || null })}
                  placeholder="Opcional"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="expense-notes" className="text-sm font-medium">Notas</label>
                <Input
                  id="expense-notes"
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                  placeholder="Opcional"
                />
              </div>
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
            <h2 className="text-base font-semibold">¿Eliminar egreso?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.name}</span>.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => remove.mutate(confirmDelete.id)} disabled={remove.isPending}>
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
