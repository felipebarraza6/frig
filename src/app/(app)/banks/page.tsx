"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Landmark,
  Plus,
  Search,
  X,
  Loader2,
  Pencil,
  Trash2,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchBanks,
  createBank,
  updateBank,
  deleteBank,
  type Bank,
} from "@/lib/api/banks";
import { useToast } from "@/lib/store/toast";

const BANK_NAME_OPTIONS = [
  { value: "BANCO_ESTADO", label: "Banco Estado" },
  { value: "BANCO_CHILE", label: "Banco de Chile" },
  { value: "SANTANDER", label: "Santander" },
  { value: "BCI", label: "BCI" },
  { value: "SCOTIABANK", label: "Scotiabank" },
  { value: "ITAU", label: "Itaú" },
  { value: "BBVA", label: "BBVA" },
  { value: "FALABELLA", label: "Banco Falabella" },
  { value: "RIPLEY", label: "Banco Ripley" },
  { value: "CONSORCIO", label: "Banco Consorcio" },
  { value: "SECURITY", label: "Banco Security" },
  { value: "BICE", label: "Banco BICE" },
  { value: "HSBC", label: "HSBC" },
  { value: "CORPBANCA", label: "Corpbanca" },
  { value: "COOPEUCH", label: "Coopeuch" },
  { value: "OTHER", label: "Otro" },
];

export default function BanksPage() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Bank | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: banks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["banks"],
    queryFn: fetchBanks,
  });

  const filtered = banks.filter(
    (b) =>
      b.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.code?.toLowerCase().includes(search.toLowerCase())
  );

  const createMut = useMutation({
    mutationFn: createBank,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] });
      setModalOpen(false);
      toast.success("Billetera creada");
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateBank>[1]) =>
      updateBank(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] });
      setEditing(null);
      toast.success("Billetera actualizada");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteBank,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] });
      setConfirmDelete(null);
      toast.success("Billetera eliminada");
    },
  });

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (b: Bank) => { setEditing(b); setModalOpen(true); };

  const nameLabel = (val?: string | null) =>
    BANK_NAME_OPTIONS.find((o) => o.value === val)?.label ?? val ?? "—";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Billeteras digitales</h1>
          <p className="text-xs text-muted-foreground">Catálogo de bancos y billeteras del sistema</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />Nueva billetera
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o código..." className="pl-9" aria-label="Buscar" />
        </div>

        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <AlertCircle className="h-7 w-7 text-danger" />
            <p className="text-sm font-medium">No se pudieron cargar las billeteras</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (<div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted/30" />))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Landmark className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{search ? "Sin resultados" : "No hay billeteras"}</p>
              <p className="text-xs text-muted-foreground">Agrega una billetera para comenzar.</p>
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
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">País</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{nameLabel(b.name)}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{b.code}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.country ?? "CL"}</td>
                      <td className="px-4 py-3">
                        {b.is_active !== false ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            <XCircle className="h-3 w-3" />Inactiva
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => setConfirmDelete(b)} title="Eliminar">
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
              {filtered.map((b) => (
                <div key={b.id} className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{nameLabel(b.name)}</p>
                      <p className="text-xs text-muted-foreground font-mono">{b.code}</p>
                    </div>
                    {b.is_active !== false ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">Activa</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Inactiva</span>
                    )}
                  </div>
                  <div className="mt-3 flex justify-end gap-1 border-t border-border pt-3">
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => openEdit(b)}>
                      <Pencil className="mr-1 h-3 w-3" />Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-danger" onClick={() => setConfirmDelete(b)}>
                      <Trash2 className="mr-1 h-3 w-3" />Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Modal */}
      <BankModal
        open={modalOpen || !!editing}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={(payload) => {
          if (editing) updateMut.mutate({ id: editing.id, ...payload });
          else createMut.mutate(payload as Parameters<typeof createBank>[0]);
        }}
        isPending={createMut.isPending || updateMut.isPending}
      />

      {/* Delete Confirmation */}
      <AnimatedOverlay open={!!confirmDelete} onClose={() => setConfirmDelete(null)} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
        <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10">
              <AlertCircle className="h-5 w-5 text-danger" />
            </div>
            <div>
              <h2 className="text-base font-semibold">¿Eliminar billetera?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Se eliminará <span className="font-medium text-foreground">{confirmDelete && nameLabel(confirmDelete.name)}</span>.
                Esta acción no se puede deshacer.
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

function BankModal({ open, editing, onClose, onSubmit, isPending }: {
  open: boolean;
  editing: Bank | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; code: string; country?: string; is_active?: boolean }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [country, setCountry] = useState(editing?.country ?? "CL");
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    onSubmit({ name, code, country: country || undefined, is_active: isActive });
  };

  const handleClose = () => { setName(""); setCode(""); setCountry("CL"); setIsActive(true); onClose(); };

  return (
    <AnimatedOverlay open={open} onClose={handleClose} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
      <div className="flex h-[80dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-w-md md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{editing ? "Editar billetera" : "Nueva billetera"}</h2>
          <button onClick={handleClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="bank-name" className="text-sm font-medium">Nombre del banco</label>
                <Select id="bank-name" value={name} onChange={(e) => setName(e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {BANK_NAME_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bank-code" className="text-sm font-medium">Código</label>
                <Input id="bank-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: BE, BSCH" required />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bank-country" className="text-sm font-medium">País (ISO)</label>
                <Input id="bank-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="CL" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">Activa</label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !name || !code}>
              {isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}
