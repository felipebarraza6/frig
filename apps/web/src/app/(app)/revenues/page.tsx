"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Pencil, Trash2, Loader2, X, CheckCircle2, TrendingDown, FileDown, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchRevenues,
  fetchRevenueCategories,
  createRevenue,
  updateRevenue,
  deleteRevenue,
  cancelRevenue,
  markRevenueAsReceived,
  exportRevenuesExcel,
  downloadRevenueVoucher,
  type Revenue,
  type RevenueRequest,
} from "@/lib/api/revenues";
import { formatCLP } from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendiente" },
  { value: "RECEIVED", label: "Recibido" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "REFUNDED", label: "Reembolsado" },
  { value: "SCHEDULED", label: "Programado" },
];

const REVENUE_TYPES = [
  { value: "SALE", label: "Venta" },
  { value: "SERVICE", label: "Servicio" },
  { value: "RENTAL", label: "Alquiler" },
  { value: "COMMISSION", label: "Comisión" },
  { value: "INVESTMENT", label: "Inversión" },
  { value: "REFUND", label: "Reembolso" },
  { value: "OTHER", label: "Otro" },
];

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

export default function RevenuesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Revenue | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Revenue | null>(null);
  const [form, setForm] = useState<RevenueRequest>({
    title: "",
    description: "",
    branch: 0,
    category: "",
    revenue_type: "SALE",
    amount: "",
    revenue_date: new Date().toISOString().slice(0, 10),
    status: "PENDING",
  });

  const { data: page, isLoading } = useQuery({
    queryKey: ["revenues", { search, category, status, startDate, endDate, pageUrl }],
    queryFn: () => fetchRevenues({ search, category, status, startDate, endDate, ...pageUrl }),
  });

  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const filter = { search, category, status, startDate, endDate };

  async function handleExportExcel() {
    await downloadFile(() => exportRevenuesExcel(filter), {
      filename: exportFilename("ingresos", "xlsx"),
      extension: "xlsx",
    });
  }

  async function handleDownloadVoucher(revenue: Revenue) {
    await downloadFile(() => downloadRevenueVoucher(revenue.id), {
      filename: `comprobante_${revenue.id.slice(0, 8)}.pdf`,
    });
  }

  const { data: categories = [] } = useQuery({
    queryKey: ["revenue-categories"],
    queryFn: fetchRevenueCategories,
  });

  const revenues = page?.results ?? [];
  const totalRevenues = page?.count ?? 0;

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateRevenue(editing.id, form);
      } else {
        await createRevenue(form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRevenue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      setConfirmDelete(null);
    },
  });

  const markReceived = useMutation({
    mutationFn: (id: string) => markRevenueAsReceived(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["revenues"] }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelRevenue(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["revenues"] }),
  });

  function openModal(revenue?: Revenue) {
    setEditing(revenue ?? null);
    if (revenue) {
      setForm({
        title: revenue.title,
        description: revenue.description ?? "",
        branch: revenue.branch,
        category: revenue.category,
        revenue_type: revenue.revenue_type,
        amount: revenue.amount,
        revenue_date: revenue.revenue_date,
        status: revenue.status ?? "PENDING",
      });
    } else {
      setForm({
        title: "",
        description: "",
        branch: 0,
        category: "",
        revenue_type: "SALE",
        amount: "",
        revenue_date: new Date().toISOString().slice(0, 10),
        status: "PENDING",
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
          <h1 className="text-lg font-semibold">Ingresos</h1>
          <p className="text-xs text-muted-foreground">
            Ventas, servicios y otros ingresos
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
            <TrendingDown className="mr-1 h-4 w-4" />
            Nuevo ingreso
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
              placeholder="Buscar ingreso…"
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
                    <th className="px-4 py-3">Título</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {revenues.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium">{r.title}</p>
                          {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.category_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.revenue_type_display}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(r.amount)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            r.status === "RECEIVED"
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : r.status === "CANCELLED" || r.status === "REFUNDED"
                                ? "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger"
                                : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700"
                          }
                        >
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.revenue_date}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markReceived.mutate(r.id)}
                              disabled={markReceived.isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Recibir
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadVoucher(r)}
                            disabled={isDownloading}
                            title="Descargar comprobante"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openModal(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {r.status !== "CANCELLED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancel.mutate(r.id)}
                              disabled={cancel.isPending}
                            >
                              Cancelar
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(r)}
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
                {totalRevenues} ingreso{totalRevenues === 1 ? "" : "s"} en total
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
              <h2 className="text-base font-semibold">{editing ? "Editar ingreso" : "Nuevo ingreso"}</h2>
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
                <label htmlFor="revenue-title" className="text-sm font-medium">Título</label>
                <Input
                  id="revenue-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="revenue-category" className="text-sm font-medium">Categoría</label>
                  <Select
                    id="revenue-category"
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
                  <label htmlFor="revenue-type" className="text-sm font-medium">Tipo</label>
                  <Select
                    id="revenue-type"
                    value={form.revenue_type}
                    onChange={(e) => setForm({ ...form, revenue_type: e.target.value as RevenueRequest["revenue_type"] })}
                  >
                    {REVENUE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="revenue-amount" className="text-sm font-medium">Monto</label>
                  <Input
                    id="revenue-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="revenue-date" className="text-sm font-medium">Fecha</label>
                  <Input
                    id="revenue-date"
                    type="date"
                    value={form.revenue_date}
                    onChange={(e) => setForm({ ...form, revenue_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="revenue-desc" className="text-sm font-medium">Descripción</label>
                <Input
                  id="revenue-desc"
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value || null })}
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
            <h2 className="text-base font-semibold">¿Eliminar ingreso?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.title}</span>.
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
