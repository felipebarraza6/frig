"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Landmark,
  X,
  Star,
  Search,
  Scale,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Calendar,
  DollarSign,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchBankAccounts,
  fetchBankAccount,
  fetchBanks,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setBankAccountAsDefault,
  fetchBankAccountTransactions,
  fetchBankAccountBalanceSummary,
  type BankAccountSummary,
  type BankAccountRequest,
  type BankAccountTransaction,
} from "@/lib/api/bank-accounts";
import {
  fetchBankReconciliations,
  fetchBankReconciliationsSummary,
  createBankReconciliation,
  updateBankReconciliation,
  deleteBankReconciliation,
  markBankReconciliationBalanced,
  markBankReconciliationPending,
  validateBankReconciliation,
  type BankReconciliation,
  type BankReconciliationRequest,
} from "@/lib/api/bank-reconciliations";
import { formatCLP } from "@/lib/utils";

const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Cuenta corriente" },
  { value: "SAVINGS", label: "Cuenta de ahorro" },
  { value: "BUSINESS", label: "Cuenta empresarial" },
  { value: "PAYROLL", label: "Cuenta de nómina" },
  { value: "INVESTMENT", label: "Cuenta de inversión" },
  { value: "OTHER", label: "Otra" },
] as const;

const CURRENCIES = [
  { value: "CLP", label: "Peso Chileno" },
  { value: "USD", label: "Dólar" },
  { value: "EUR", label: "Euro" },
  { value: "BRL", label: "Real" },
  { value: "ARS", label: "Peso Argentino" },
  { value: "PEN", label: "Sol" },
] as const;

const REC_STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "DISCREPANCY", label: "Con discrepancias" },
] as const;

function accountTypeLabel(value?: string | null): string {
  return ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? (value ?? "—");
}

function currencyLabel(value?: string | null): string {
  return CURRENCIES.find((c) => c.value === value)?.label ?? (value ?? "—");
}

function statusLabel(value?: BankReconciliation["status"]): string {
  return REC_STATUS_OPTIONS.find((s) => s.value === value)?.label ?? (value ?? "—");
}

function statusBadgeClasses(value?: BankReconciliation["status"]): string {
  switch (value) {
    case "COMPLETED":
      return "bg-success/10 text-success";
    case "IN_PROGRESS":
      return "bg-primary/10 text-primary";
    case "DISCREPANCY":
      return "bg-danger/10 text-danger";
    case "PENDING":
    default:
      return "bg-warning/10 text-warning";
  }
}

function todayDateInput(): string {
  return new Date().toISOString().split("T")[0];
}

const EMPTY_FORM: BankAccountRequest = {
  account_name: "",
  account_number: "",
  account_type: "CHECKING",
  bank: "",
  branch: 0,
  holder_name: "",
  currency: "CLP",
  initial_balance: "0",
  is_default: false,
  is_active: true,
};

const EMPTY_RECONCILIATION_FORM: BankReconciliationRequest = {
  bank_account: "",
  reconciliation_date: todayDateInput(),
  bank_statement_balance: "",
  system_balance: "0",
  status: "PENDING",
  notes: "",
};

export default function BankAccountsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BankAccountSummary | null>(null);
  const [form, setForm] = useState<BankAccountRequest>(EMPTY_FORM);
  const [search, setSearch] = useState("");

  // Reconciliations modal state
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccountSummary | null>(null);
  const [recEditingId, setRecEditingId] = useState<string | null>(null);
  const [recForm, setRecForm] = useState<BankReconciliationRequest>(EMPTY_RECONCILIATION_FORM);
  const [recStatusFilter, setRecStatusFilter] = useState<BankReconciliation["status"] | "">("");
  const [recConfirmDelete, setRecConfirmDelete] = useState<BankReconciliation | null>(null);

  const {
    data: accounts = [],
    isLoading,
    isError: isAccountsError,
    refetch: refetchAccounts,
  } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: fetchBankAccounts,
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["banks"],
    queryFn: fetchBanks,
  });

  const { data: editingAccount, isLoading: loadingEditing } = useQuery({
    queryKey: ["bank-accounts", editingId],
    queryFn: () => fetchBankAccount(editingId!),
    enabled: Boolean(editingId),
  });

  const {
    data: reconciliationsData,
    isLoading: loadingReconciliations,
    isError: isReconciliationsError,
    refetch: refetchReconciliations,
  } = useQuery({
    queryKey: ["bank-reconciliations", selectedAccount?.id, recStatusFilter],
    queryFn: () =>
      fetchBankReconciliations({
        bank_account: selectedAccount?.id,
        status: recStatusFilter || undefined,
        page_size: 100,
      }),
    enabled: recModalOpen && Boolean(selectedAccount?.id),
  });

  const {
    data: reconciliationSummary,
    isLoading: loadingReconciliationSummary,
  } = useQuery({
    queryKey: ["bank-reconciliations", "summary"],
    queryFn: fetchBankReconciliationsSummary,
  });

  // Transactions drawer state
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txAccount, setTxAccount] = useState<BankAccountSummary | null>(null);

  const {
    data: transactions = [],
    isLoading: loadingTransactions,
    isError: isTransactionsError,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ["bank-accounts", txAccount?.id, "transactions"],
    queryFn: () => fetchBankAccountTransactions(txAccount!.id),
    enabled: txModalOpen && Boolean(txAccount?.id),
  });

  const {
    data: balanceSummary,
    isLoading: loadingBalanceSummary,
  } = useQuery({
    queryKey: ["bank-accounts", txAccount?.id, "balance-summary"],
    queryFn: () => fetchBankAccountBalanceSummary(txAccount!.id),
    enabled: txModalOpen && Boolean(txAccount?.id),
  });

  const reconciliations = useMemo(
    () => reconciliationsData?.results ?? [],
    [reconciliationsData],
  );

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.account_name.toLowerCase().includes(q) ||
        (a.bank_name ?? "").toLowerCase().includes(q) ||
        a.account_number.toLowerCase().includes(q),
    );
  }, [accounts, search]);

  useEffect(() => {
    if (editingAccount) {
      setForm({
        account_name: editingAccount.account_name,
        account_number: editingAccount.account_number,
        account_type: editingAccount.account_type,
        bank: editingAccount.bank,
        branch: editingAccount.branch,
        holder_name: editingAccount.holder_name,
        currency: editingAccount.currency ?? "CLP",
        initial_balance: editingAccount.initial_balance ?? "0",
        is_default: editingAccount.is_default ?? false,
        is_active: editingAccount.is_active ?? true,
      });
    } else if (!editingId) {
      setForm(EMPTY_FORM);
    }
  }, [editingAccount, editingId]);

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) {
        await updateBankAccount(editingId, form);
      } else {
        await createBankAccount(form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBankAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      setConfirmDelete(null);
    },
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => setBankAccountAsDefault(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-accounts"] }),
  });

  const recSave = useMutation({
    mutationFn: async () => {
      const payload = { ...recForm, bank_account: selectedAccount!.id };
      if (recEditingId) {
        await updateBankReconciliation(recEditingId, payload);
      } else {
        await createBankReconciliation(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
      resetRecForm();
    },
  });

  const recRemove = useMutation({
    mutationFn: (id: string) => deleteBankReconciliation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
      setRecConfirmDelete(null);
    },
  });

  const recMarkBalanced = useMutation({
    mutationFn: (id: string) => markBankReconciliationBalanced(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] }),
  });

  const recMarkPending = useMutation({
    mutationFn: (id: string) => markBankReconciliationPending(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] }),
  });

  const recValidate = useMutation({
    mutationFn: (id: string) => validateBankReconciliation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] }),
  });

  function openModal(account?: BankAccountSummary) {
    setEditingId(account?.id ?? null);
    if (!account) {
      setForm(EMPTY_FORM);
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  function openReconciliations(account: BankAccountSummary) {
    setSelectedAccount(account);
    setRecModalOpen(true);
    resetRecForm(account);
  }

  function closeReconciliations() {
    setRecModalOpen(false);
    setSelectedAccount(null);
    setRecEditingId(null);
    setRecStatusFilter("");
  }

  function resetRecForm(account: BankAccountSummary | null = selectedAccount) {
    setRecEditingId(null);
    setRecForm({
      ...EMPTY_RECONCILIATION_FORM,
      bank_account: account?.id ?? "",
      system_balance: account?.current_balance ?? "0",
    });
  }

  function openTransactions(account: BankAccountSummary) {
    setTxAccount(account);
    setTxModalOpen(true);
  }

  function closeTransactions() {
    setTxModalOpen(false);
    setTxAccount(null);
  }

  function startEditReconciliation(rec: BankReconciliation) {
    setRecEditingId(rec.id);
    setRecForm({
      bank_account: rec.bank_account,
      reconciliation_date: rec.reconciliation_date,
      bank_statement_balance: rec.bank_statement_balance,
      system_balance: rec.system_balance,
      status: rec.status ?? "PENDING",
      notes: rec.notes ?? "",
    });
  }

  function cancelEditReconciliation() {
    resetRecForm();
  }

  const summary = useMemo(() => {
    if (!selectedAccount || reconciliations.length === 0) return null;
    const last = reconciliations[0];
    const system = parseFloat(selectedAccount.current_balance ?? "0");
    const statement = parseFloat(last.bank_statement_balance ?? "0");
    const difference = system - statement;
    return { system, statement, difference, lastStatus: last.status };
  }, [selectedAccount, reconciliations]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Cuentas bancarias</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona las cuentas y sus conciliaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            onClick={() => openModal()}
            className="sm:hidden"
            title="Nueva cuenta"
            aria-label="Nueva cuenta"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
            className="hidden sm:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva cuenta
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cuenta…"
            className="pl-9"
            aria-label="Buscar cuenta"
          />
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loadingReconciliationSummary ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Total conciliaciones"
                value={reconciliationSummary?.total ?? 0}
                icon={Scale}
                sub="registradas"
              />
              <StatCard
                label="Pendientes"
                value={reconciliationSummary?.pending ?? 0}
                icon={Clock}
                sub="por revisar"
              />
              <StatCard
                label="Completadas"
                value={reconciliationSummary?.completed ?? 0}
                icon={CheckCircle2}
                sub="balanceadas"
              />
              <StatCard
                label="Discrepancias"
                value={reconciliationSummary?.discrepancy ?? 0}
                icon={AlertCircle}
                sub="requieren atención"
              />
            </>
          )}
        </section>

        {isAccountsError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <AlertCircle className="h-10 w-10 text-danger" />
            <p className="text-sm font-medium">No se pudieron cargar las cuentas</p>
            <Button variant="outline" size="sm" onClick={() => refetchAccounts()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AccountCardSkeleton />
            <AccountCardSkeleton />
            <AccountCardSkeleton />
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Landmark className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {search ? "No se encontraron cuentas" : "No hay cuentas bancarias"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search
                  ? "Prueba con otro término de búsqueda."
                  : "Agrega una nueva cuenta para comenzar."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAccounts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
                      <Landmark className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.account_name}</p>
                      <p className="text-xs text-muted-foreground">{a.bank_name}</p>
                    </div>
                  </div>
                  {a.is_default && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Principal
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <p className="text-muted-foreground">Número: <span className="text-foreground">{a.account_number}</span></p>
                  <p className="text-muted-foreground">Tipo: <span className="text-foreground">{accountTypeLabel(a.account_type)}</span></p>
                  <p className="text-muted-foreground">Moneda: <span className="text-foreground">{currencyLabel(a.currency)}</span></p>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">Saldo actual</p>
                  <p className="text-xl font-semibold tabular-nums">{formatCLP(a.current_balance)}</p>
                </div>
                <div className="mt-3 flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openTransactions(a)}
                    title="Movimientos"
                    aria-label="Movimientos"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span className="sr-only">Movimientos</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openReconciliations(a)}
                    title="Conciliaciones"
                    aria-label="Conciliaciones"
                  >
                    <Scale className="h-3.5 w-3.5" />
                    <span className="sr-only">Conciliaciones</span>
                  </Button>
                  {!a.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setDefault.mutate(a.id)}
                      disabled={setDefault.isPending}
                      title="Marcar como principal"
                      aria-label="Marcar como principal"
                    >
                      <Star className="h-3.5 w-3.5" />
                      <span className="sr-only">Principal</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openModal(a)}
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
                    onClick={() => setConfirmDelete(a)}
                    title="Eliminar"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Eliminar</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
              <h2 className="text-base font-semibold">{editingId ? "Editar cuenta" : "Nueva cuenta bancaria"}</h2>
              <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {loadingEditing ? (
              <div className="grid flex-1 place-items-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
                className="flex flex-1 flex-col overflow-hidden"
                id="bank-account-form"
              >
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="ba-name" className="text-sm font-medium">Nombre de la cuenta</label>
                      <Input
                        id="ba-name"
                        value={form.account_name}
                        onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                        required
                        placeholder="Ej: Cuenta principal"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <label htmlFor="ba-bank" className="text-sm font-medium">Banco</label>
                        <Select
                          id="ba-bank"
                          value={form.bank}
                          onChange={(e) => setForm({ ...form, bank: e.target.value })}
                          required
                        >
                          <option value="">Selecciona</option>
                          {banks.map((b) => (
                            <option key={b.id} value={b.id}>{b.display_name}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label htmlFor="ba-type" className="text-sm font-medium">Tipo</label>
                        <Select
                          id="ba-type"
                          value={form.account_type}
                          onChange={(e) => setForm({ ...form, account_type: e.target.value as BankAccountRequest["account_type"] })}
                        >
                          {ACCOUNT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <label htmlFor="ba-number" className="text-sm font-medium">Número de cuenta</label>
                        <Input
                          id="ba-number"
                          value={form.account_number}
                          onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label htmlFor="ba-currency" className="text-sm font-medium">Moneda</label>
                        <Select
                          id="ba-currency"
                          value={form.currency}
                          onChange={(e) => setForm({ ...form, currency: e.target.value as BankAccountRequest["currency"] })}
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="ba-holder" className="text-sm font-medium">Titular</label>
                      <Input
                        id="ba-holder"
                        value={form.holder_name}
                        onChange={(e) => setForm({ ...form, holder_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="ba-balance" className="text-sm font-medium">Saldo inicial</label>
                      <Input
                        id="ba-balance"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.initial_balance}
                        onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.is_default}
                          onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                          className="h-4 w-4 accent-primary"
                        />
                        Cuenta principal
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                          className="h-4 w-4 accent-primary"
                        />
                        Activa
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
            )}
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
            <h2 className="text-base font-semibold">¿Eliminar cuenta?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.account_name}</span>.
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

      {recModalOpen && selectedAccount && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">Conciliaciones: {selectedAccount.account_name}</h2>
                <p className="text-xs text-muted-foreground">
                  Saldo actual: <span className="font-medium text-foreground">{formatCLP(selectedAccount.current_balance)}</span>
                </p>
              </div>
              <button onClick={closeReconciliations} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Summary */}
              {summary && (
                <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted/30 p-3 text-center sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Sistema</p>
                    <p className="text-sm font-semibold tabular-nums">{formatCLP(summary.system)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Extracto</p>
                    <p className="text-sm font-semibold tabular-nums">{formatCLP(summary.statement)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Diferencia</p>
                    <p className={`text-sm font-semibold tabular-nums ${summary.difference === 0 ? "text-success" : "text-danger"}`}>
                      {summary.difference >= 0 ? "+" : ""}{formatCLP(summary.difference)}
                    </p>
                  </div>
                </div>
              )}

              {/* Form */}
              <div className="border-b border-border p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    recSave.mutate();
                  }}
                  className="flex flex-col gap-3"
                >
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="flex flex-col gap-1.5 sm:col-span-1">
                      <label htmlFor="rec-date" className="text-xs font-medium">Fecha</label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="rec-date"
                          type="date"
                          value={recForm.reconciliation_date}
                          onChange={(e) => setRecForm({ ...recForm, reconciliation_date: e.target.value })}
                          required
                          className="pl-8"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-1">
                      <label htmlFor="rec-balance" className="text-xs font-medium">Saldo extracto</label>
                      <div className="relative">
                        <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="rec-balance"
                          type="number"
                          step="0.01"
                          value={recForm.bank_statement_balance}
                          onChange={(e) => setRecForm({ ...recForm, bank_statement_balance: e.target.value })}
                          required
                          placeholder="0"
                          className="pl-8"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="rec-notes" className="text-xs font-medium">Notas</label>
                      <div className="relative">
                        <FileText className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="rec-notes"
                          value={recForm.notes ?? ""}
                          onChange={(e) => setRecForm({ ...recForm, notes: e.target.value })}
                          placeholder="Opcional"
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {recEditingId ? "Editando conciliación existente" : "Nueva conciliación"}
                    </div>
                    <div className="flex gap-2">
                      {recEditingId && (
                        <Button type="button" variant="outline" size="sm" onClick={cancelEditReconciliation}>
                          Cancelar
                        </Button>
                      )}
                      <Button type="submit" size="sm" disabled={recSave.isPending}>
                        {recSave.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        {recEditingId ? "Guardar cambios" : "Agregar conciliación"}
                      </Button>
                    </div>
                  </div>
                  {recSave.isError && (
                    <p className="text-sm text-danger">
                      {recSave.error instanceof Error ? recSave.error.message : "Error al guardar"}
                    </p>
                  )}
                </form>
              </div>

              {/* Filter */}
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <p className="text-sm font-medium">Historial</p>
                <Select
                  value={recStatusFilter}
                  onChange={(e) => setRecStatusFilter(e.target.value as BankReconciliation["status"] | "")}
                  className="h-8 w-40 text-xs"
                >
                  {REC_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingReconciliations ? (
                  <div className="grid place-items-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : isReconciliationsError ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
                    <AlertCircle className="h-10 w-10 text-danger" />
                    <p className="text-sm font-medium">No se pudieron cargar las conciliaciones</p>
                    <Button variant="outline" size="sm" onClick={() => refetchReconciliations()}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Reintentar
                    </Button>
                  </div>
                ) : reconciliations.length === 0 ? (
                  <div className="grid place-items-center rounded-xl border border-dashed border-border p-8 text-center">
                    <div>
                      <Scale className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">Sin conciliaciones</p>
                      <p className="text-xs text-muted-foreground">
                        Registra el saldo de tu extracto bancario para compararlo con el sistema.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reconciliations.map((rec) => {
                      const statement = parseFloat(rec.bank_statement_balance ?? "0");
                      const system = parseFloat(rec.system_balance ?? "0");
                      const diff = parseFloat(rec.difference ?? "0");
                      return (
                        <div
                          key={rec.id}
                          className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/20"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-sm font-medium">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  {rec.reconciliation_date}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(rec.status)}`}>
                                  {statusLabel(rec.status)}
                                </span>
                                {rec.is_balanced && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Balanceada
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 grid grid-cols-3 gap-2 text-xs sm:grid-cols-3">
                                <div>
                                  <p className="text-muted-foreground">Sistema</p>
                                  <p className="font-medium tabular-nums">{formatCLP(system)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Extracto</p>
                                  <p className="font-medium tabular-nums">{formatCLP(statement)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Diferencia</p>
                                  <p className={`font-medium tabular-nums ${diff === 0 ? "text-success" : "text-danger"}`}>
                                    {diff >= 0 ? "+" : ""}{formatCLP(diff)}
                                  </p>
                                </div>
                              </div>
                              {rec.notes && (
                                <p className="mt-2 text-xs text-muted-foreground">{rec.notes}</p>
                              )}
                              {rec.reconciled_by_name && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Por: {rec.reconciled_by_name}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 sm:flex-col sm:items-end">
                              {rec.status !== "COMPLETED" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-success hover:text-success"
                                  onClick={() => recMarkBalanced.mutate(rec.id)}
                                  disabled={recMarkBalanced.isPending || recMarkPending.isPending || recValidate.isPending}
                                  title="Marcar balanceada"
                                  aria-label="Marcar balanceada"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">Balanceada</span>
                                </Button>
                              )}
                              {rec.status !== "PENDING" && rec.status !== "COMPLETED" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-warning hover:text-warning"
                                  onClick={() => recMarkPending.mutate(rec.id)}
                                  disabled={recMarkBalanced.isPending || recMarkPending.isPending || recValidate.isPending}
                                  title="Marcar pendiente"
                                  aria-label="Marcar pendiente"
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  <span className="sr-only">Pendiente</span>
                                </Button>
                              )}
                              {rec.status !== "COMPLETED" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-primary hover:text-primary"
                                  onClick={() => recValidate.mutate(rec.id)}
                                  disabled={recMarkBalanced.isPending || recMarkPending.isPending || recValidate.isPending}
                                  title="Validar"
                                  aria-label="Validar"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  <span className="sr-only">Validar</span>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => startEditReconciliation(rec)}
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
                                onClick={() => setRecConfirmDelete(rec)}
                                title="Eliminar"
                                aria-label="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Eliminar</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {recConfirmDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10">
                <AlertCircle className="h-5 w-5 text-danger" />
              </div>
              <div>
                <h2 className="text-base font-semibold">¿Eliminar conciliación?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se eliminará la conciliación del <span className="font-medium text-foreground">{recConfirmDelete.reconciliation_date}</span>.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRecConfirmDelete(null)} disabled={recRemove.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => recRemove.mutate(recConfirmDelete.id)} disabled={recRemove.isPending}>
                {recRemove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      {txModalOpen && txAccount && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">Movimientos: {txAccount.account_name}</h2>
                <p className="text-xs text-muted-foreground">
                  Saldo actual: <span className="font-medium text-foreground">{formatCLP(txAccount.current_balance)}</span>
                </p>
              </div>
              <button onClick={closeTransactions} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              {balanceSummary && (
                <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted/30 p-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className="text-sm font-semibold tabular-nums">{formatCLP(balanceSummary.current_balance ?? txAccount.current_balance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ingresos</p>
                    <p className="text-sm font-semibold tabular-nums text-emerald-700">{formatCLP(balanceSummary.total_income ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Egresos</p>
                    <p className="text-sm font-semibold tabular-nums text-danger">{formatCLP(balanceSummary.total_expenses ?? 0)}</p>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4">
                {loadingTransactions || loadingBalanceSummary ? (
                  <div className="grid place-items-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : isTransactionsError ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
                    <AlertCircle className="h-10 w-10 text-danger" />
                    <p className="text-sm font-medium">No se pudieron cargar los movimientos</p>
                    <Button variant="outline" size="sm" onClick={() => refetchTransactions()}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Reintentar
                    </Button>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="grid place-items-center rounded-xl border border-dashed border-border p-8 text-center">
                    <div>
                      <Receipt className="mx-auto h-10 w-10 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">Sin movimientos</p>
                      <p className="text-xs text-muted-foreground">
                        No se encontraron transacciones para esta cuenta.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <TransactionCard key={tx.id} tx={tx} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <Skeleton className="mb-1 h-7 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function AccountCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
      <div className="mt-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-1 h-7 w-32" />
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
}

function TransactionCard({ tx }: { tx: BankAccountTransaction }) {
  const isIncome = tx.payment_direction === "INCOME";
  const amount = parseFloat(tx.amount) || 0;
  return (
    <div className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isIncome ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
            {isIncome ? (
              <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-rose-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{tx.description || tx.payment_source || "Movimiento"}</p>
            <p className="text-xs text-muted-foreground">
              {tx.payment_method_name || tx.payment_source} · {new Date(tx.payment_date).toLocaleDateString("es-CL")}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-semibold tabular-nums ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
            {isIncome ? "+" : "-"}{formatCLP(amount)}
          </p>
          <p className="text-xs text-muted-foreground">{tx.status}</p>
        </div>
      </div>
    </div>
  );
}
