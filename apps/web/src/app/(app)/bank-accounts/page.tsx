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
  Filter,
  Wallet,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  CalendarRange,
  Download,
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

type TxPreset = "today" | "week" | "month" | "last30";

/**
 * Devuelve el rango [from, to] en formato YYYY-MM-DD para un preset de fechas
 * usado en el filtro de movimientos.
 */
function presetRange(
  preset: TxPreset,
): { from: string; to: string; label: string } {
  const today = new Date();
  const todayIso = today.toISOString().split("T")[0];
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const addDays = (d: Date, n: number) => {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
  };
  switch (preset) {
    case "today":
      return { from: todayIso, to: todayIso, label: "Hoy" };
    case "week": {
      const dow = today.getDay();
      const monday = addDays(today, dow === 0 ? -6 : 1 - dow);
      return { from: fmt(monday), to: todayIso, label: "Esta semana" };
    }
    case "month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(first), to: todayIso, label: "Este mes" };
    }
    case "last30":
    default: {
      const from = addDays(today, -29);
      return { from: fmt(from), to: todayIso, label: "Últimos 30 días" };
    }
  }
}

const TX_PRESET_OPTIONS: { value: TxPreset; label: string }[] = [
  { value: "last30", label: "Últimos 30 días" },
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
];

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
  const [txFilter, setTxFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [txPreset, setTxPreset] = useState<TxPreset>("last30");

  const txFilterParams = useMemo(() => {
    const range = presetRange(txPreset);
    return {
      startDate: range.from,
      endDate: range.to,
      direction: txFilter === "ALL" ? undefined : txFilter,
    };
  }, [txPreset, txFilter]);

  const {
    data: transactions = [],
    isLoading: loadingTransactions,
    isError: isTransactionsError,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ["bank-accounts", txAccount?.id, "transactions", txFilterParams],
    queryFn: () => fetchBankAccountTransactions(txAccount!.id, txFilterParams),
    enabled: txModalOpen && Boolean(txAccount?.id),
  });

  const {
    data: balanceSummary,
    isLoading: loadingBalanceSummary,
  } = useQuery({
    queryKey: ["bank-accounts", txAccount?.id, "balance-summary", txFilterParams],
    queryFn: () => fetchBankAccountBalanceSummary(txAccount!.id, txFilterParams),
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
    setTxFilter("ALL");
    setTxPreset("last30");
    setTxModalOpen(true);
  }

  function closeTransactions() {
    setTxModalOpen(false);
    setTxAccount(null);
    setTxFilter("ALL");
    setTxPreset("last30");
  }

  const txRange = useMemo(
    () => presetRange(txPreset),
    [txPreset],
  );

  const txPeriodLabel = txRange.label;

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
      return [
        t.payment_date,
        t.payment_direction === "INCOME" ? "Ingreso" : "Egreso",
        (t.description ?? t.payment_source ?? "").replace(/[\r\n,;]/g, " "),
        (t.reference ?? "").replace(/[\r\n,;]/g, " "),
        (t.payment_method_name ?? "").replace(/[\r\n,;]/g, " "),
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

  const anyRecActionPending =
    recMarkBalanced.isPending || recMarkPending.isPending || recValidate.isPending;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-start md:justify-between md:px-6">
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
                        anyActionPending={anyRecActionPending}
                        onMarkBalanced={() => recMarkBalanced.mutate(rec.id)}
                        onMarkPending={() => recMarkPending.mutate(rec.id)}
                        onValidate={() => recValidate.mutate(rec.id)}
                        onEdit={() => startEditReconciliation(rec)}
                        onDelete={() => setRecConfirmDelete(rec)}
                      />
                    ))}
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
                  {formatCLP(balanceSummary?.total_income ?? periodIncome)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Egresos del período
                </p>
                <p className="text-sm font-semibold tabular-nums text-danger">
                  {formatCLP(balanceSummary?.total_expenses ?? periodExpense)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Los totales reflejan el período seleccionado.
            </p>
          </div>

          <div className="flex flex-col gap-3 border-b border-border px-6 py-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Período:</span>
              <Select
                value={txPreset}
                onChange={(e) => setTxPreset(e.target.value as TxPreset)}
                className="h-8 w-44 text-xs"
                aria-label="Período de movimientos"
              >
                {TX_PRESET_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
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
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="hidden h-3 w-20 sm:block" />
                    <Skeleton className="ml-auto h-4 w-20" />
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
                  onClick={() => setTxPreset("last30")}
                >
                  Ver últimos 30 días
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
  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* Header: icono + nombre banco + nombre cuenta */}
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Landmark className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {account.bank_name || "Banco"}
          </p>
          <p className="truncate text-base font-semibold leading-tight" title={account.account_name}>
            {account.account_name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
            {maskAccountNumber(account.account_number)} · {accountTypeLabel(account.account_type)} · {currencyLabel(account.currency)}
          </p>
        </div>
      </div>

      {/* Pills: badges de estado */}
      <div className="mb-3 flex flex-wrap gap-2">
        {account.is_default ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Star className="h-3 w-3 fill-current" />
            Principal
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            No principal
          </span>
        )}
        {account.is_active === false ? (
          <span className="inline-flex items-center rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
            Inactiva
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Activa
          </span>
        )}
      </div>

      {/* Stats inline (mismo patrón 2-col que ProductCard: precio + stock) */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Saldo actual</p>
          <p className="text-xl font-bold tabular-nums tracking-tight">
            {formatCLP(account.current_balance)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Sucursal</p>
          <p className="truncate text-sm font-medium" title={account.branch_name ?? undefined}>
            {account.branch_name || "—"}
          </p>
        </div>
      </div>

      {/* Actions: mismo patrón icon-only con sr-only que ProductCard */}
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onTransactions(account)}
            title="Movimientos"
            aria-label={`Movimientos de ${account.account_name}`}
          >
            <Receipt className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onReconciliations(account)}
            title="Conciliaciones"
            aria-label={`Conciliaciones de ${account.account_name}`}
          >
            <Scale className="h-4 w-4" />
          </Button>
          {!account.is_default && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onSetDefault(account.id)}
              disabled={isSetDefaultPending}
              title="Marcar como principal"
              aria-label={`Marcar como principal ${account.account_name}`}
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(account)}
            title="Editar"
            aria-label={`Editar ${account.account_name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-danger"
            onClick={() => onDelete(account)}
            title="Eliminar"
            aria-label={`Eliminar ${account.account_name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function BankAccountCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
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

function translateTransactionSource(value?: string | null): string | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  if (upper === "EXPENSE" || upper === "EGRESO") return "Egreso";
  if (upper === "REVENUE" || upper === "INCOME" || upper === "INGRESO") return "Ingreso";
  return value;
}

function TransactionCard({ tx }: { tx: BankAccountTransaction }) {
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

  const title = translateTransactionSource(tx.description ?? tx.payment_source) ?? "Movimiento";

  return (
    <div className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/20">
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
              {tx.payment_method_name && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="h-3 w-3" />
                    {tx.payment_method_name}
                  </span>
                </>
              )}
              {tx.reference && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Ref: {tx.reference}
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
          {tx.status && (
            <p className="text-xs capitalize text-muted-foreground">{tx.status.toLowerCase()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReconciliationCard({
  rec,
  isLast,
  isFirst,
  anyActionPending,
  onMarkBalanced,
  onMarkPending,
  onValidate,
  onEdit,
  onDelete,
}: {
  rec: BankReconciliation;
  isLast: boolean;
  isFirst: boolean;
  anyActionPending: boolean;
  onMarkBalanced: () => void;
  onMarkPending: () => void;
  onValidate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statement = parseFloat(rec.bank_statement_balance ?? "0");
  const system = parseFloat(rec.system_balance ?? "0");
  const diff = parseFloat(rec.difference ?? "0");

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
        <div className="flex flex-wrap items-center gap-1 sm:flex-col sm:items-end">
          {rec.status !== "COMPLETED" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-success hover:text-success"
              onClick={onMarkBalanced}
              disabled={anyActionPending}
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
              onClick={onMarkPending}
              disabled={anyActionPending}
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
              onClick={onValidate}
              disabled={anyActionPending}
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
            onClick={onEdit}
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
            onClick={onDelete}
            title="Eliminar"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">Eliminar</span>
          </Button>
        </div>
      </div>
      {!isFirst && (
        <div className="pointer-events-none absolute -bottom-3 left-4 right-4 h-px bg-border" aria-hidden="true" />
      )}
    </div>
  );
}
