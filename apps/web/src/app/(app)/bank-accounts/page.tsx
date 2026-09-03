"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Star,
  Search,
  Scale,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Filter,
  Wallet,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  CalendarRange,
  Download,
  Landmark,
  CreditCard,
  Settings2,
  MoreHorizontal,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
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
  type BankReconciliation,
} from "@/lib/api/bank-reconciliations";
import { formatCLP, cn } from "@/lib/utils";

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

const TX_FILTERS = [
  { value: "ALL", label: "Todos" },
  { value: "INCOME", label: "Ingresos" },
  { value: "EXPENSE", label: "Egresos" },
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

function firstDayOfMonthInput(): string {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
}

function lastNDaysInput(n: number): string {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - n).toISOString().split("T")[0];
}

function formatDateLabel(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function maskAccountNumber(number?: string | null): string {
  if (!number) return "**** 0000";
  const clean = number.replace(/\D/g, "");
  const last4 = clean.slice(-4).padStart(4, "0");
  return `**** ${last4}`;
}

const EMPTY_FORM: BankAccountRequest = {
  account_name: "",
  account_number: "",
  account_type: "CHECKING",
  bank: "",
  branch: 0,
  holder_name: "",
  currency: "CLP",
  initial_balance: 0,
  is_default: false,
  is_active: true,
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
  const [recStatusFilter, setRecStatusFilter] = useState<BankReconciliation["status"] | "">("");

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
  const [txFilter, setTxFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [txDateFrom, setTxDateFrom] = useState<string>(firstDayOfMonthInput());
  const [txDateTo, setTxDateTo] = useState<string>(todayDateInput());

  const txFilterParams = useMemo(() => {
    return {
      startDate: txDateFrom,
      endDate: txDateTo,
      direction: txFilter === "ALL" ? undefined : txFilter,
    };
  }, [txDateFrom, txDateTo, txFilter]);

  const {
    data: transactions = [],
    isLoading: loadingTransactions,
    isError: isTransactionsError,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ["bank-accounts", txAccount?.id, "transactions", txFilterParams],
    queryFn: () => fetchBankAccountTransactions(txAccount!.id, txFilterParams),
    enabled: txModalOpen && Boolean(txAccount?.id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const {
    data: balanceSummary,
    isLoading: loadingBalanceSummary,
  } = useQuery({
    queryKey: ["bank-accounts", txAccount?.id, "balance-summary", txFilterParams],
    queryFn: () => fetchBankAccountBalanceSummary(txAccount!.id, txFilterParams),
    enabled: txModalOpen && Boolean(txAccount?.id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
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

  const filteredTransactions = useMemo(() => {
    if (txFilter === "ALL") return transactions;
    return transactions.filter((t) => t.payment_direction === txFilter);
  }, [transactions, txFilter]);

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
        initial_balance: editingAccount.initial_balance ?? 0,
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
  }

  function closeReconciliations() {
    setRecModalOpen(false);
    setSelectedAccount(null);
    setRecStatusFilter("");
  }

  function openTransactions(account: BankAccountSummary) {
    setTxAccount(account);
    setTxFilter("ALL");
    setTxDateFrom(lastNDaysInput(6));
    setTxDateTo(todayDateInput());
    setTxModalOpen(true);
  }

  function closeTransactions() {
    setTxModalOpen(false);
    setTxAccount(null);
    setTxFilter("ALL");
    setTxDateFrom(lastNDaysInput(6));
    setTxDateTo(todayDateInput());
  }

  const txPeriodLabel = `${formatDateLabel(txDateFrom)} - ${formatDateLabel(txDateTo)}`;

  const periodIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.payment_direction === "INCOME")
        .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0),
    [transactions],
  );
  const periodExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.payment_direction === "EXPENSE")
        .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0),
    [transactions],
  );

  function exportTransactionsCsv() {
    if (!txAccount || transactions.length === 0) return;
    const headers = ["Fecha", "Tipo", "Descripción", "Referencia", "Método", "Monto"];
    const rows = transactions.map((t) => {
      const amount = parseFloat(t.amount) || 0;
      const signed = t.payment_direction === "INCOME" ? amount : -amount;
      const description = getTransactionTitle(t).replace(/[\r\n,;]/g, " ");
      const method = (t.payment_method?.name ?? t.payment_method_name ?? "").replace(/[\r\n,;]/g, " ");
      return [
        t.payment_date,
        t.payment_direction === "INCOME" ? "Ingreso" : "Egreso",
        description,
        (t.reference ?? "").replace(/[\r\n,;]/g, " "),
        method,
        signed.toString(),
      ];
    });
    const csv = [headers, ...rows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimientos_${txAccount.account_name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  const summary = useMemo(() => {
    if (!selectedAccount || reconciliations.length === 0) return null;
    const last = reconciliations[0];
    const system = selectedAccount.current_balance ?? 0;
    const statement = last.bank_statement_balance ?? 0;
    const difference = system - statement;
    return { system, statement, difference, lastStatus: last.status };
  }, [selectedAccount, reconciliations]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-start md:justify-between md:px-6">
        <div>
          <h1 className="text-lg font-semibold">Billeteras digitales</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona las cuentas y sus conciliaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            onClick={() => openModal()}
            className="md:hidden"
            title="Nueva cuenta"
            aria-label="Nueva cuenta"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
            className="hidden md:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva cuenta
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cuenta…"
            className="pl-9"
            aria-label="Buscar cuenta"
          />
        </div>

        {/* Stats: grid responsive como el resto de la app */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
                label="Total"
                value={reconciliationSummary?.total ?? 0}
                icon={Scale}
                sub="conciliaciones"
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
                sub="requieren"
              />
            </>
          )}
        </div>

        {isAccountsError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
              <AlertCircle className="h-7 w-7 text-danger" />
            </div>
            <div>
              <p className="text-sm font-medium">No se pudieron cargar las cuentas</p>
              <p className="text-xs text-muted-foreground">Revisa tu conexión e intenta nuevamente.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchAccounts()}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <BankAccountCardSkeleton />
            <BankAccountCardSkeleton />
            <BankAccountCardSkeleton />
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {search ? "No se encontraron billeteras" : "No hay billeteras digitales"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search
                  ? "Prueba con otro término de búsqueda."
                  : "Agrega una nueva billetera para comenzar."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAccounts.map((a) => (
              <BankAccountCard
                key={a.id}
                account={a}
                onTransactions={openTransactions}
                onReconciliations={openReconciliations}
                onEdit={openModal}
                onDelete={setConfirmDelete}
                onSetDefault={(id) => setDefault.mutate(id)}
                isSetDefaultPending={setDefault.isPending}
              />
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
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </div>
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
                  <div className="flex flex-col gap-5">
                    {/* Preview card */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-md">
                      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
                      <div className="relative flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-primary-foreground/80">
                            {banks.find((b) => String(b.id) === form.bank)?.display_name || "Banco"}
                          </p>
                          <p className="truncate text-lg font-semibold">
                            {form.account_name || "Nombre de la cuenta"}
                          </p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                          <CreditCard className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="relative mt-4">
                        <p className="text-xs text-primary-foreground/70">Saldo inicial</p>
                        <p className="text-2xl font-bold tabular-nums">
                          {formatCLP(form.initial_balance ?? 0)}
                        </p>
                      </div>
                      <div className="relative mt-3 flex items-center justify-between text-xs text-primary-foreground/80">
                        <span>{maskAccountNumber(form.account_number) || "•••• •••• •••• ••••"}</span>
                        <span>{accountTypeLabel(form.account_type)} · {currencyLabel(form.currency)}</span>
                      </div>
                    </div>

                    {/* Section: Account info */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <CreditCard className="h-3.5 w-3.5" />
                        Información de la cuenta
                      </div>
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
                            <option value="">Selecciona un banco</option>
                            {banks.map((b) => (
                              <option key={b.id} value={b.id}>{b.display_name}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label htmlFor="ba-type" className="text-sm font-medium">Tipo de cuenta</label>
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
                    </div>

                    {/* Section: Bank details */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Landmark className="h-3.5 w-3.5" />
                        Detalles bancarios
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-2">
                          <label htmlFor="ba-number" className="text-sm font-medium">Número de cuenta</label>
                          <Input
                            id="ba-number"
                            value={form.account_number}
                            onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                            required
                            placeholder="Ej: 123456789"
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
                        <label htmlFor="ba-holder" className="text-sm font-medium">Titular de la cuenta</label>
                        <Input
                          id="ba-holder"
                          value={form.holder_name}
                          onChange={(e) => setForm({ ...form, holder_name: e.target.value })}
                          required
                          placeholder="Nombre del titular"
                        />
                      </div>
                    </div>

                    {/* Section: Settings */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Settings2 className="h-3.5 w-3.5" />
                        Configuración
                      </div>
                      <div className="flex flex-col gap-2">
                        <label htmlFor="ba-balance" className="text-sm font-medium">Saldo inicial</label>
                        <Input
                          id="ba-balance"
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.initial_balance}
                          onChange={(e) => setForm({ ...form, initial_balance: Number(e.target.value) })}
                          placeholder="0"
                        />
                        <p className="text-xs text-muted-foreground">
                          Solo al crear la cuenta. Usa el saldo real con el que comienza.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-muted/50 p-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={form.is_default}
                            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                            className="h-4 w-4 accent-primary"
                          />
                          <Star className="h-3.5 w-3.5 text-muted-foreground" />
                          Cuenta principal
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                            className="h-4 w-4 accent-primary"
                          />
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                          Activa
                        </label>
                      </div>
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
                    {editingId ? "Guardar cambios" : "Crear cuenta"}
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
              <Button variant="danger" onClick={() => remove.mutate(confirmDelete.id)} isLoading={remove.isPending}>
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
                <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted/30 p-3 text-center">
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

              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Solo historial. Crea y gestiona conciliaciones desde la página dedicada.
                </p>
                <Link href="/reconciliations">
                  <Button type="button" variant="outline" size="sm">
                    Gestionar conciliaciones
                  </Button>
                </Link>
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
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isReconciliationsError ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
                      <AlertCircle className="h-7 w-7 text-danger" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">No se pudieron cargar las conciliaciones</p>
                      <p className="text-xs text-muted-foreground">Revisa tu conexión e intenta nuevamente.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => refetchReconciliations()}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Reintentar
                    </Button>
                  </div>
                ) : reconciliations.length === 0 ? (
                  <div className="grid place-items-center rounded-xl border border-dashed border-border p-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                      <Scale className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm font-medium">Sin conciliaciones</p>
                    <p className="text-xs text-muted-foreground">
                      Registra el saldo de tu extracto bancario para compararlo con el sistema.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reconciliations.map((rec, idx, arr) => (
                      <ReconciliationCard
                        key={rec.id}
                        rec={rec}
                        isLast={idx === 0}
                        isFirst={idx === arr.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {txAccount && (
        <Modal
          open={txModalOpen}
          onClose={closeTransactions}
          title={`Movimientos: ${txAccount.account_name}`}
          description={`Saldo actual: ${formatCLP(txAccount.current_balance)} · Mostrando: ${txPeriodLabel}`}
          size="lg"
        >
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo actual</p>
                <p className="text-sm font-semibold tabular-nums">{formatCLP(balanceSummary?.current_balance ?? txAccount.current_balance)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Ingresos del período
                </p>
                <p className="text-sm font-semibold tabular-nums text-success">
                  {formatCLP(periodIncome)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Egresos del período
                </p>
                <p className="text-sm font-semibold tabular-nums text-danger">
                  {formatCLP(periodExpense)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Los totales reflejan el período seleccionado.
            </p>
          </div>

          <div className="flex flex-col gap-3 border-b border-border px-6 py-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Período:</span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={txDateFrom}
                  onChange={(e) => setTxDateFrom(e.target.value)}
                  className="h-8 w-36 text-xs"
                  aria-label="Desde"
                />
                <span className="text-xs text-muted-foreground">hasta</span>
                <Input
                  type="date"
                  value={txDateTo}
                  onChange={(e) => setTxDateTo(e.target.value)}
                  className="h-8 w-36 text-xs"
                  aria-label="Hasta"
                />
              </div>
              <div className="flex items-center gap-1">
                {[
                  { label: "Hoy", from: todayDateInput(), to: todayDateInput() },
                  { label: "7 días", from: lastNDaysInput(6), to: todayDateInput() },
                  { label: "Este mes", from: firstDayOfMonthInput(), to: todayDateInput() },
                ].map((p) => {
                  const active = txDateFrom === p.from && txDateTo === p.to;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setTxDateFrom(p.from);
                        setTxDateTo(p.to);
                      }}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:ml-auto">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {TX_FILTERS.map((f) => {
                const active = txFilter === f.value;
                const Icon = f.value === "INCOME" ? TrendingUp : f.value === "EXPENSE" ? TrendingDown : Wallet;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setTxFilter(f.value as typeof txFilter)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {f.label}
                  </button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2"
                onClick={exportTransactionsCsv}
                disabled={transactions.length === 0}
                title="Exportar a CSV"
                aria-label="Exportar a CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </div>
          </div>

          <ModalBody>
            {loadingTransactions || loadingBalanceSummary ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                        <div className="min-w-0 space-y-2">
                          <Skeleton className="h-4 w-36" />
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Skeleton className="h-4 w-16 rounded-full" />
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="hidden h-3 w-24 sm:block" />
                          </div>
                        </div>
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isTransactionsError ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
                  <AlertCircle className="h-7 w-7 text-danger" />
                </div>
                <div>
                  <p className="text-sm font-medium">No se pudieron cargar los movimientos</p>
                  <p className="text-xs text-muted-foreground">Revisa tu conexión e intenta nuevamente.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchTransactions()}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reintentar
                </Button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-border p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Receipt className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm font-medium">Sin movimientos</p>
                <p className="text-xs text-muted-foreground">
                  No hay movimientos en el período seleccionado.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setTxDateFrom(firstDayOfMonthInput());
                    setTxDateTo(todayDateInput());
                  }}
                >
                  Ver este mes
                </Button>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-border p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Filter className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm font-medium">Sin resultados</p>
                <p className="text-xs text-muted-foreground">
                  No hay movimientos de este tipo en el período seleccionado.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setTxFilter("ALL")}>
                  Ver todos
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((tx) => (
                  <TransactionCard key={tx.id} tx={tx} />
                ))}
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            <p className="mr-auto text-xs text-muted-foreground">
              {filteredTransactions.length} de {transactions.length} movimientos
            </p>
            <Button variant="outline" onClick={closeTransactions}>Cerrar</Button>
          </ModalFooter>
        </Modal>
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
    <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
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
    <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <Skeleton className="mb-1 h-7 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function BankAccountCard({
  account,
  onTransactions,
  onReconciliations,
  onEdit,
  onDelete,
  onSetDefault,
  isSetDefaultPending,
}: {
  account: BankAccountSummary;
  onTransactions: (a: BankAccountSummary) => void;
  onReconciliations: (a: BankAccountSummary) => void;
  onEdit: (a: BankAccountSummary) => void;
  onDelete: (a: BankAccountSummary) => void;
  onSetDefault: (id: string) => void;
  isSetDefaultPending: boolean;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const isInactive = account.is_active === false;
  const textMuted = isInactive ? "text-muted-foreground" : "text-primary-foreground/80";
  const pillClass = isInactive ? "bg-muted text-muted-foreground" : "bg-white/10 text-primary-foreground/90";
  const primaryPillClass = isInactive ? "bg-primary/10 text-primary" : "bg-white/15 text-white";
  const cardClass = isInactive
    ? "border-border bg-muted/30"
    : "border-transparent bg-gradient-to-br from-primary/90 to-primary text-primary-foreground";

  return (
    <div
      className="group relative h-[280px]"
      style={{ perspective: "1000px" }}
    >
      <div
        className="relative h-full w-full rounded-2xl border shadow-sm transition-all duration-500 hover:-translate-y-0.5 hover:shadow-md"
        style={{
          transformStyle: "preserve-3d",
          transform: showOptions ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front face */}
        <div
          className={cn("absolute inset-0 flex flex-col overflow-hidden rounded-2xl p-5", cardClass)}
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* Decorative card pattern */}
          {!isInactive && (
            <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
          )}

          {/* Header: banco + nombre cuenta */}
          <div className="relative mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[11px] font-medium uppercase tracking-wider", textMuted)}>
                {account.bank_name || "Banco"}
              </p>
              <p className={cn("truncate text-lg font-semibold leading-tight", isInactive && "text-foreground")} title={account.account_name}>
                {account.account_name}
              </p>
              <p className={cn("mt-0.5 truncate text-xs tabular-nums", textMuted)}>
                {maskAccountNumber(account.account_number)} · {accountTypeLabel(account.account_type)} · {currencyLabel(account.currency)}
              </p>
            </div>
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", isInactive ? "bg-muted text-muted-foreground" : "bg-white/15 text-white")}>
              <Wallet className="h-5 w-5" />
            </div>
          </div>

          {/* Saldo */}
          <div className="relative mb-4">
            <p className={cn("text-xs", textMuted)}>Saldo actual</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {formatCLP(account.current_balance)}
            </p>
          </div>

          {/* Pills + sucursal */}
          <div className="relative mb-4 flex flex-wrap items-center gap-2">
            {account.is_default ? (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", primaryPillClass)}>
                <Star className="h-3 w-3 fill-current" />
                Principal
              </span>
            ) : (
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", pillClass)}>
                No principal
              </span>
            )}
            {isInactive ? (
              <span className="inline-flex items-center rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
                Inactiva
              </span>
            ) : (
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", pillClass)}>
                Activa
              </span>
            )}
            <span className={cn("ml-auto truncate text-xs", textMuted)}>
              {account.branch_name || "—"}
            </span>
          </div>

          {/* Options toggle */}
          <div className="mt-auto border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowOptions(true)}
              className={cn("flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors", isInactive ? "bg-muted text-foreground hover:bg-muted/80" : "bg-white/10 text-white hover:bg-white/20")}
            >
              <MoreHorizontal className="h-4 w-4" />
              Opciones
            </button>
          </div>
        </div>

        {/* Back face: opciones */}
        <div
          className={cn("absolute inset-0 flex flex-col overflow-hidden rounded-2xl p-5", cardClass)}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {/* Decorative card pattern */}
          {!isInactive && (
            <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
          )}

          <div className="relative mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold">Opciones de cuenta</p>
            <button
              type="button"
              onClick={() => setShowOptions(false)}
              className={cn("rounded-full p-1.5 transition-colors", isInactive ? "hover:bg-muted" : "bg-white/10 hover:bg-white/20")}
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="relative flex flex-1 flex-col gap-2">
            <button
              type="button"
              onClick={() => { setShowOptions(false); onTransactions(account); }}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors", isInactive ? "hover:bg-muted" : "bg-white/10 hover:bg-white/20")}
            >
              <Receipt className="h-4 w-4" />
              Ver movimientos
            </button>
            <button
              type="button"
              onClick={() => { setShowOptions(false); onReconciliations(account); }}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors", isInactive ? "hover:bg-muted" : "bg-white/10 hover:bg-white/20")}
            >
              <Scale className="h-4 w-4" />
              Conciliaciones
            </button>
            {!account.is_default && (
              <button
                type="button"
                onClick={() => { setShowOptions(false); onSetDefault(account.id); }}
                disabled={isSetDefaultPending}
                className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors", isInactive ? "hover:bg-muted" : "bg-white/10 hover:bg-white/20")}
              >
                <Star className="h-4 w-4" />
                Marcar como principal
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowOptions(false); onEdit(account); }}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors", isInactive ? "hover:bg-muted" : "bg-white/10 hover:bg-white/20")}
            >
              <Pencil className="h-4 w-4" />
              Editar cuenta
            </button>
            <button
              type="button"
              onClick={() => { setShowOptions(false); onDelete(account); }}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors", isInactive ? "text-danger hover:bg-danger/10" : "text-white/80 hover:bg-white/20")}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar cuenta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BankAccountCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="mb-4 flex items-end justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="space-y-1.5 text-right">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function getTransactionTitle(tx: BankAccountTransaction): string {
  const source = tx.payment_source?.toUpperCase();
  if (source === "ORDER" && tx.order) {
    const orderType = tx.order.order_type?.toUpperCase();
    const doc = tx.order.order_number ? ` #${tx.order.order_number}` : "";
    if (orderType === "SALE") return `Venta${doc}`;
    if (orderType === "ORDER") return `Pedido${doc}`;
    return `Orden${doc}`;
  }
  return translateTransactionSource(tx.description ?? tx.payment_source) ?? "Movimiento";
}

function translateTransactionSource(value?: string | null): string | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase().replace(/[_\s]+/g, "_");
  const map: Record<string, string> = {
    EXPENSE: "Egreso",
    EGRESO: "Egreso",
    REVENUE: "Ingreso",
    INCOME: "Ingreso",
    INGRESO: "Ingreso",
    SALE: "Venta",
    VENTA: "Venta",
    ORDER: "Pedido",
    PEDIDO: "Pedido",
    DEPOSIT: "Depósito",
    DEPOSITO: "Depósito",
    WITHDRAWAL: "Retiro",
    RETIRO: "Retiro",
    TRANSFER: "Transferencia",
    TRANSFERENCIA: "Transferencia",
    ADJUSTMENT: "Ajuste",
    AJUSTE: "Ajuste",
    POS_SALE: "Venta POS",
    ORDER_PAYMENT: "Pago de pedido",
    EXPENSE_PAYMENT: "Pago de gasto",
    CASH_REGISTER: "Caja",
    CAJA: "Caja",
    BANK_TRANSFER: "Transferencia bancaria",
    RECONCILIATION: "Conciliación",
    CONCILIACION: "Conciliación",
  };
  return map[upper] ?? value;
}

function translateTransactionStatus(value?: string | null): string | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  const map: Record<string, string> = {
    PENDING: "Pendiente",
    COMPLETED: "Completado",
    CONFIRMED: "Confirmado",
    CANCELLED: "Cancelado",
    FAILED: "Fallido",
    REVERSED: "Reversado",
    DISCREPANCY: "Con discrepancia",
  };
  return map[upper] ?? value;
}

function TransactionCard({ tx }: { tx: BankAccountTransaction }) {
  const [expanded, setExpanded] = useState(false);
  const isIncome = tx.payment_direction === "INCOME";
  const amount = parseFloat(tx.amount) || 0;
  const date = useMemo(() => {
    try {
      return new Date(tx.payment_date).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return tx.payment_date;
    }
  }, [tx.payment_date]);

  const methodName = tx.payment_method?.name ?? tx.payment_method_name;
  const methodType = tx.payment_method?.payment_type_display ?? tx.payment_method?.payment_type;
  const title = useMemo(() => getTransactionTitle(tx), [tx]);
  const source = translateTransactionSource(tx.payment_source) ?? tx.payment_source ?? "—";
  const status = translateTransactionStatus(tx.status) ?? tx.status ?? "—";

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              isIncome ? "bg-emerald-500/10" : "bg-rose-500/10"
            }`}
          >
            {isIncome ? (
              <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-rose-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isIncome ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}>
                {isIncome ? "Ingreso" : "Egreso"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {date}
              </span>
              {methodName && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1" title={methodType}>
                    <Wallet className="h-3 w-3" />
                    {methodName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-semibold tabular-nums ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
            {isIncome ? "+" : "-"}{formatCLP(amount)}
          </p>
          <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Origen</p>
              <p className="font-medium">{source}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Estado</p>
              <p className="font-medium">{status}</p>
            </div>
            {tx.order?.order_number && (
              <div>
                <p className="text-muted-foreground">Documento</p>
                <p className="font-medium">{tx.order.order_number}</p>
              </div>
            )}
            {methodName && (
              <div>
                <p className="text-muted-foreground">Método de pago</p>
                <p className="font-medium">{methodName}</p>
              </div>
            )}
            {tx.reference && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Referencia</p>
                <p className="font-medium">{tx.reference}</p>
              </div>
            )}
            {tx.description && tx.description !== tx.payment_source && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Descripción</p>
                <p className="font-medium">{tx.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

function ReconciliationCard({
  rec,
  isLast,
  isFirst,
}: {
  rec: BankReconciliation;
  isLast: boolean;
  isFirst: boolean;
}) {
  const statement = rec.bank_statement_balance;
  const system = rec.system_balance;
  const diff = rec.difference;

  return (
    <div className="relative rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/20">
      {isLast && (
        <div className="absolute -left-px top-3 h-5 w-1 rounded-r bg-primary" aria-hidden="true" />
      )}
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
      </div>
      {!isFirst && (
        <div className="pointer-events-none absolute -bottom-3 left-4 right-4 h-px bg-border" aria-hidden="true" />
      )}
    </div>
  );
}
