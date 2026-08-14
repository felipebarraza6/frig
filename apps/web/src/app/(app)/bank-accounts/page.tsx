"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Landmark, X, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchBankAccounts,
  fetchBankAccount,
  fetchBanks,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setBankAccountAsDefault,
  type BankAccountSummary,
  type BankAccountRequest,
} from "@/lib/api/bank-accounts";
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

function accountTypeLabel(value?: string | null): string {
  return ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? (value ?? "—");
}

function currencyLabel(value?: string | null): string {
  return CURRENCIES.find((c) => c.value === value)?.label ?? (value ?? "—");
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

export default function BankAccountsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BankAccountSummary | null>(null);
  const [form, setForm] = useState<BankAccountRequest>(EMPTY_FORM);

  const { data: accounts = [], isLoading } = useQuery({
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Cuentas bancarias</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona las cuentas y sus saldos
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        {isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cuentas bancarias configuradas.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
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
                  {!a.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefault.mutate(a.id)}
                      disabled={setDefault.isPending}
                    >
                      <Star className="h-3.5 w-3.5" />
                      Principal
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openModal(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger"
                    onClick={() => setConfirmDelete(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{editingId ? "Editar cuenta" : "Nueva cuenta bancaria"}</h2>
              <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {loadingEditing ? (
              <div className="grid place-items-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
                className="flex flex-col gap-4"
              >
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
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
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
    </div>
  );
}
