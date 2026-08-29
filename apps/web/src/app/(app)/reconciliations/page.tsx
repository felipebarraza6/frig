"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Scale,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Search,
  X,
  Plus,
  SlidersHorizontal,
  Download,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchBankReconciliations,
  fetchBankReconciliationsSummary,
  createBankReconciliation,
  markBankReconciliationBalanced,
  markBankReconciliationPending,
  validateBankReconciliation,
  type BankReconciliation,
} from "@/lib/api/bank-reconciliations";
import { fetchBankAccounts } from "@/lib/api/bank-accounts";
import { formatCLP } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "COMPLETED", label: "Completadas" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "DISCREPANCY", label: "Con discrepancia" },
];

function statusBadgeClass(status?: string | null) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-500/10 text-emerald-700";
    case "PENDING":
      return "bg-amber-500/10 text-amber-700";
    case "IN_PROGRESS":
      return "bg-primary/10 text-primary";
    case "DISCREPANCY":
      return "bg-danger/10 text-danger";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "COMPLETED": return "Balanceada";
    case "PENDING": return "Pendiente";
    case "IN_PROGRESS": return "En progreso";
    case "DISCREPANCY": return "Discrepancia";
    default: return status ?? "—";
  }
}

function parseAmount(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value) || 0;
}

export default function ReconciliationsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [createOpen, setCreateOpen] = useState(false);

  const queryClient = useQueryClient();

  const filter = useMemo(() => ({
    status: (statusFilter || undefined) as BankReconciliation["status"],
    bank_account: accountFilter || undefined,
    ...pageUrl,
  }), [statusFilter, accountFilter, pageUrl]);

  // Data queries
  const { data: reconciliationsData, isLoading, isError, refetch } = useQuery({
    queryKey: ["bank-reconciliations", filter],
    queryFn: () => fetchBankReconciliations(filter),
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["bank-reconciliations", "summary"],
    queryFn: fetchBankReconciliationsSummary,
  });

  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: fetchBankAccounts,
  });

  const reconciliations = useMemo(() => reconciliationsData?.results ?? [], [reconciliationsData]);
  const totalCount = reconciliationsData?.count ?? 0;

  // Mutations
  const markBalanced = useMutation({
    mutationFn: markBankReconciliationBalanced,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] }),
  });

  const markPending = useMutation({
    mutationFn: markBankReconciliationPending,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] }),
  });

  const validate = useMutation({
    mutationFn: validateBankReconciliation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] }),
  });

const create = useMutation({
    mutationFn: createBankReconciliation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
      setCreateOpen(false);
    },
  });

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Conciliaciones bancarias</h1>
          <p className="text-xs text-muted-foreground">
            Compara saldos del extracto bancario con el sistema
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nueva conciliación
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Stats */}
        <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {loadingSummary ? (
            <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
          ) : (
            <>
              <StatCard label="Total" value={summary?.total ?? 0} icon={Scale} sub="conciliaciones" tone="slate" />
              <StatCard label="Pendientes" value={summary?.pending ?? 0} icon={Clock} sub="por revisar" tone="amber" />
              <StatCard label="Completadas" value={summary?.completed ?? 0} icon={CheckCircle2} sub="balanceadas" tone="emerald" />
              <StatCard label="Discrepancias" value={summary?.discrepancy ?? 0} icon={AlertCircle} sub="requieren atención" tone="rose" />
            </>
          )}
        </section>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-9" aria-label="Buscar" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
              <Select id="filter-status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPageUrl({}); }}>
                {STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-account" className="text-xs text-muted-foreground">Cuenta</label>
              <Select id="filter-account" value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setPageUrl({}); }}>
                <option value="">Todas</option>
                {accounts?.map((a) => (<option key={a.id} value={a.id}>{a.account_name}</option>))}
              </Select>
            </div>
          </div>
          {/* Mobile filters */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="h-10 pl-9" aria-label="Buscar" />
              </div>
              <Button variant="outline" size="sm" className="h-10 px-3" onClick={() => setShowMobileFilters((v) => !v)}>
                <SlidersHorizontal className="h-4 w-4" /><span className="ml-2">Filtros</span>
              </Button>
            </div>
            <div className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${showMobileFilters ? "" : "hidden"}`}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Filtros</span>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setShowMobileFilters(false)}>
                  <X className="h-4 w-4" /><span className="sr-only">Cerrar</span>
                </Button>
              </div>
              <div className="grid gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Estado</label>
                  <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPageUrl({}); }}>
                    {STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Cuenta</label>
                  <Select value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setPageUrl({}); }}>
                    <option value="">Todas</option>
                    {accounts?.map((a) => (<option key={a.id} value={a.id}>{a.account_name}</option>))}
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10"><AlertCircle className="h-7 w-7 text-danger" /></div>
            <p className="text-sm font-medium">No se pudieron cargar las conciliaciones</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-3"><TableSkeleton /><div className="flex justify-end"><Skeleton className="h-9 w-40" /></div></div>
        ) : reconciliations.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border p-8 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Scale className="h-7 w-7 text-muted-foreground" /></div>
              <p className="mt-4 text-base font-medium">Sin conciliaciones</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Registra el saldo de tu extracto bancario para compararlo con el sistema.</p>
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Crear primera conciliación</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cuenta</th>
                    <th className="px-4 py-3 text-right">Saldo sistema</th>
                    <th className="px-4 py-3 text-right">Saldo banco</th>
                    <th className="px-4 py-3 text-right">Diferencia</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.map((rec) => {
                    const diff = parseAmount(rec.system_balance) - parseAmount(rec.bank_statement_balance);
                    return (
                      <tr key={rec.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-muted-foreground">{rec.reconciliation_date}</td>
                        <td className="px-4 py-3 font-medium">{rec.bank_account_name ?? rec.bank_account}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCLP(parseAmount(rec.system_balance))}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCLP(parseAmount(rec.bank_statement_balance))}</td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${Math.abs(diff) < 0.01 ? "text-emerald-600" : "text-danger"}`}>
                          {diff >= 0 ? "+" : ""}{formatCLP(Math.abs(diff))}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(rec.status)}`}>{statusLabel(rec.status)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {rec.status !== "COMPLETED" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markBalanced.mutate(rec.id)} disabled={markBalanced.isPending} title="Marcar balanceada">
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            {rec.status === "COMPLETED" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => markPending.mutate(rec.id)} disabled={markPending.isPending} title="Marcar pendiente">
                                <Clock className="h-4 w-4" />
                              </Button>
                            )}
                            {rec.status === "COMPLETED" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => validate.mutate(rec.id)} disabled={validate.isPending} title="Validar">
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {reconciliations.map((rec) => {
                const diff = parseAmount(rec.system_balance) - parseAmount(rec.bank_statement_balance);
                return (
                  <div key={rec.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{rec.bank_account_name ?? rec.bank_account}</p>
                        <p className="text-xs text-muted-foreground">{rec.reconciliation_date}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(rec.status)}`}>{statusLabel(rec.status)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div><span className="block text-[10px] uppercase text-muted-foreground">Sistema</span><span className="tabular-nums">{formatCLP(parseAmount(rec.system_balance))}</span></div>
                      <div><span className="block text-[10px] uppercase text-muted-foreground">Banco</span><span className="tabular-nums">{formatCLP(parseAmount(rec.bank_statement_balance))}</span></div>
                      <div><span className="block text-[10px] uppercase text-muted-foreground">Diferencia</span><span className={`tabular-nums font-semibold ${Math.abs(diff) < 0.01 ? "text-emerald-600" : "text-danger"}`}>{diff >= 0 ? "+" : ""}{formatCLP(Math.abs(diff))}</span></div>
                    </div>
                    <div className="mt-3 flex justify-end gap-1 border-t border-border pt-3">
                      {rec.status !== "COMPLETED" && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => markBalanced.mutate(rec.id)} disabled={markBalanced.isPending}>
                          <CheckCircle2 className="mr-1 h-3 w-3" />Balancear
                        </Button>
                      )}
                      {rec.status === "COMPLETED" && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => markPending.mutate(rec.id)} disabled={markPending.isPending}>
                          <Clock className="mr-1 h-3 w-3" />Reabrir
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
              <p className="text-muted-foreground"><span className="font-medium text-foreground">{totalCount} conciliacion{totalCount === 1 ? "" : "es"}</span></p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-10 px-4" onClick={() => setPageUrl({ previous: reconciliationsData?.previous })} disabled={!reconciliationsData?.previous}>
                  <span className="sm:hidden">Ant.</span><span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button variant="outline" size="sm" className="h-10 px-4" onClick={() => setPageUrl({ next: reconciliationsData?.next })} disabled={!reconciliationsData?.next}>
                  <span className="sm:hidden">Sig.</span><span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      <CreateReconciliationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        accounts={accounts ?? []}
        onSubmit={(payload) => create.mutate(payload)}
        isPending={create.isPending}
        error={create.error instanceof Error ? create.error.message : null}
      />
    </div>
  );
}

function CreateReconciliationModal({ open, onClose, accounts, onSubmit, isPending, error }: {
  open: boolean;
  onClose: () => void;
  accounts: Array<{ id: string; account_name: string; current_balance: string | number }>;
  onSubmit: (payload: { bank_account: string; system_balance: string; bank_statement_balance: string; reconciliation_date: string; notes?: string }) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [accountId, setAccountId] = useState("");
  const [systemBalance, setSystemBalance] = useState("");
  const [bankStatementBalance, setBankStatementBalance] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const selectedAccount = accounts.find((a) => a.id === accountId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !systemBalance || !bankStatementBalance) return;
    onSubmit({ bank_account: accountId, system_balance: systemBalance, bank_statement_balance: bankStatementBalance, reconciliation_date: date, ...(notes.trim() ? { notes: notes.trim() } : {}) });
  };

  const handleClose = () => { setAccountId(""); setSystemBalance(""); setBankStatementBalance(""); setDate(new Date().toISOString().split("T")[0]); setNotes(""); onClose(); };

  return (
    <AnimatedOverlay open={open} onClose={handleClose} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Nueva conciliación</h2>
          <button onClick={handleClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="cr-account" className="text-sm font-medium">Cuenta bancaria</label>
                <Select id="cr-account" value={accountId} onChange={(e) => { setAccountId(e.target.value); const a = accounts.find((x) => x.id === e.target.value); if (a) setSystemBalance(String(parseAmount(a.current_balance))); }} required>
                  <option value="">Seleccionar...</option>
                  {accounts.map((a) => (<option key={a.id} value={a.id}>{a.account_name}</option>))}
                </Select>
                {selectedAccount && (<p className="mt-1 text-xs text-muted-foreground">Saldo sistema: <span className="font-medium text-foreground">{formatCLP(parseAmount(selectedAccount.current_balance))}</span></p>)}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cr-date" className="text-sm font-medium">Fecha de conciliación</label>
                <Input id="cr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cr-system" className="text-sm font-medium">Saldo según sistema</label>
                <Input id="cr-system" type="number" step="0.01" value={systemBalance} onChange={(e) => setSystemBalance(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cr-statement" className="text-sm font-medium">Saldo según banco</label>
                <Input id="cr-statement" type="number" step="0.01" value={bankStatementBalance} onChange={(e) => setBankStatementBalance(e.target.value)} required />
              </div>
              {systemBalance && bankStatementBalance && (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Diferencia: <span className={`font-semibold ${Math.abs(parseAmount(systemBalance) - parseAmount(bankStatementBalance)) < 0.01 ? "text-emerald-600" : "text-danger"}`}>{formatCLP(Math.abs(parseAmount(systemBalance) - parseAmount(bankStatementBalance)))}</span></p>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label htmlFor="cr-notes" className="text-sm font-medium">Notas (opcional)</label>
                <Input id="cr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones..." />
              </div>
              {error && (<div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>)}
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !accountId || !systemBalance || !bankStatementBalance}>
              {isPending ? (<><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creando...</>) : (<><FileText className="mr-1.5 h-4 w-4" />Crear conciliación</>)}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}

function StatCard({ label, value, icon: Icon, sub, tone = "slate" }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>; sub: string; tone?: "emerald" | "rose" | "amber" | "slate";
}) {
  const tones = { slate: "bg-card", emerald: "bg-emerald-500/[0.06] border-emerald-500/15", rose: "bg-rose-500/[0.06] border-rose-500/15", amber: "bg-amber-500/[0.06] border-amber-500/15" };
  const icons = { slate: "bg-muted text-muted-foreground", emerald: "bg-emerald-500/15 text-emerald-600", rose: "bg-rose-500/15 text-rose-600", amber: "bg-amber-500/15 text-amber-600" };
  return (
    <div className={`rounded-xl border border-border/60 p-3 shadow-sm ${tones[tone]}`}>
      <div className="mb-1.5 flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${icons[tone]}`}><Icon className="h-3.5 w-3.5" /></div>
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function StatSkeleton() {
  return (<div className="rounded-xl border border-border/60 bg-muted/30 p-3 shadow-sm"><div className="mb-1.5 flex items-center gap-2"><Skeleton className="h-7 w-7 rounded-lg" /><Skeleton className="h-3 w-20" /></div><Skeleton className="h-6 w-16" /><Skeleton className="mt-1 h-3 w-14" /></div>);
}

function TableSkeleton() {
  return (<div className="hidden overflow-x-auto rounded-2xl border border-border md:block"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b border-border">{Array.from({ length: 7 }).map((_, i) => (<th key={i} className="px-4 py-3"><Skeleton className="h-3.5 w-20" /></th>))}</tr></thead><tbody>{Array.from({ length: 5 }).map((_, row) => (<tr key={row} className="border-b border-border last:border-0">{Array.from({ length: 7 }).map((__, col) => (<td key={col} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[80px]" /></td>))}</tr>))}</tbody></table></div>);
}
