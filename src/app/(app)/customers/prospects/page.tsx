"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Kanban,
  LayoutGrid,
  List,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Power,
  Search,
  Tags,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageBody, PageShell } from "@/components/page-shell";
import { CrmDenied } from "@/components/customers/crm-denied";
import { CrmNav } from "@/components/customers/crm-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { EmptyState } from "@/components/ui/empty-state";
import {
  convertLead,
  createLead,
  createLeadSource,
  deleteLead,
  fetchLead,
  leadStatusLabel,
  updateLead,
  updateLeadSource,
  type Lead,
  type LeadList,
  type LeadSource,
  type LeadStatus,
} from "@/lib/api/crm-leads";
import { useCrmLeadSources, useCrmLeadsList } from "@/lib/hooks/useCrm";
import { LoadMoreFooter } from "@/components/ui/load-more";
import { useCanManageCustomers } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";
import { statusBadge } from "@/lib/status-styles";

function cleanPhoneForWa(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export default function ProspectsPage() {
  const router = useRouter();
  const canManage = useCanManageCustomers();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Cross-link ?q=… (desde seguimientos/informes) aplicado en mount.
  const [search, setSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeadList | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [sourceDetail, setSourceDetail] = useState("");
  const [score, setScore] = useState("0");
  const [notes, setNotes] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [editStatus, setEditStatus] = useState<LeadStatus>("NEW");

  // Sources management modal
  const [sourceOpen, setSourceOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<LeadSource | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceDesc, setSourceDesc] = useState("");
  const [sourceColor, setSourceColor] = useState("#1890ff");

  // "Cargar más" incremental: sin truncado silencioso de page_size fijo.
  const [listPageSize, setListPageSize] = useState(60);

  const listQuery = useCrmLeadsList({
    status: statusFilter || undefined,
    source: sourceFilter || undefined,
    search: search.trim() || undefined,
    page_size: listPageSize,
  });

  const sourcesQuery = useCrmLeadSources(true);

  // "Convertidos" solo se excluye si no se pidió explícitamente (los leads
  // convertidos siguen siendo historia comercial consultable).
  const allLeads = useMemo(
    () =>
      (listQuery.data?.results ?? []).filter(
        (l) => statusFilter === "CONVERTED" || l.status !== "CONVERTED",
      ),
    [listQuery.data?.results, statusFilter],
  );

  const sources = useMemo(() => sourcesQuery.data ?? [], [sourcesQuery.data]);
  const activeSources = useMemo(
    () => sources.filter((s) => s.is_active !== false),
    [sources],
  );

  // Status counters
  const metrics = useMemo(() => {
    let openCount = 0;
    let newCount = 0;
    let contactedCount = 0;
    let qualifiedCount = 0;

    for (const l of allLeads) {
      if (!["LOST", "ARCHIVED"].includes(l.status ?? "")) {
        openCount++;
      }
      if (l.status === "NEW") newCount++;
      else if (l.status === "CONTACTED") contactedCount++;
      else if (l.status === "QUALIFIED") qualifiedCount++;
    }

    return { openCount, newCount, contactedCount, qualifiedCount };
  }, [allLeads]);

  function resetForm() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setCompany("");
    setSourceDetail("");
    setScore("0");
    setNotes("");
    setSourceId(activeSources[0]?.id ? String(activeSources[0].id) : "");
    setEditStatus("NEW");
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setSourceId(activeSources[0]?.id ? String(activeSources[0].id) : "");
    setOpen(true);
  }

  function openSourceCreate() {
    setEditingSource(null);
    setSourceName("");
    setSourceDesc("");
    setSourceColor("#1890ff");
    setSourceOpen(true);
  }

  function openSourceEdit(src: LeadSource) {
    setEditingSource(src);
    setSourceName(src.name || "");
    setSourceDesc(src.description || "");
    setSourceColor(src.color || "#1890ff");
    setSourceOpen(true);
  }

  function openEdit(lead: LeadList) {
    setEditing(lead);
    setFirstName(lead.first_name || "");
    setLastName(lead.last_name || "");
    setPhone(lead.phone || "");
    setEmail(lead.email || "");
    setCompany(lead.company || "");
    setSourceDetail("");
    setScore(String(lead.score ?? 0));
    setNotes("");
    setEditStatus((lead.status as LeadStatus) || "NEW");
    setSourceId(lead.source ? String(lead.source) : "");
    setOpen(true);
    void fetchLead(lead.id)
      .then((full) => {
        setFirstName(full.first_name || "");
        setLastName(full.last_name || "");
        setPhone(full.phone || "");
        setEmail(full.email || "");
        setCompany(full.company || "");
        setSourceDetail(full.source_detail || "");
        setScore(String(full.score ?? 0));
        setNotes(full.notes || "");
        setEditStatus((full.status as LeadStatus) || "NEW");
        setSourceId(full.source ? String(full.source) : "");
      })
      .catch(() => toast.error("No se pudo cargar el prospecto"));
  }

  const create = useMutation({
    mutationFn: () =>
      createLead({
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        source_detail: sourceDetail.trim() || undefined,
        notes: notes.trim() || undefined,
        status: "NEW",
        source: sourceId || null,
      }),
    onSuccess: () => {
      setOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["crm", "leads"] });
      toast.success("Prospecto creado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al crear"),
  });

  const saveEdit = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Sin prospecto");
      return updateLead(editing.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        company: company.trim(),
        source_detail: sourceDetail.trim(),
        notes: notes.trim(),
        score: Number.isFinite(Number(score)) ? Number(score) : 0,
        status: editStatus,
        source: sourceId || null,
      });
    },
    onSuccess: () => {
      setOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["crm", "leads"] });
      toast.success("Prospecto actualizado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar"),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      updateLead(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "leads"] });
      toast.success("Estado actualizado");
    },
    onError: () => toast.error("No se pudo actualizar el estado"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "leads"] });
      toast.success("Prospecto eliminado");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const convert = useMutation({
    mutationFn: async (lead: LeadList) => {
      let current: Lead | LeadList = lead;
      if (current.status === "NEW") {
        current = await updateLead(current.id, { status: "CONTACTED" });
      }
      if (current.status !== "QUALIFIED" && current.status !== "CONTACTED") {
        current = await updateLead(current.id, { status: "QUALIFIED" });
      }
      return convertLead(current.id);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("¡Prospecto convertido a cliente con éxito!");
      if (res?.converted_to_client) {
        router.push(`/customers?id=${res.converted_to_client}`);
      }
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudo convertir"),
  });

  const saveSource = useMutation({
    mutationFn: async () => {
      const name = sourceName.trim();
      if (!name) throw new Error("Nombre obligatorio");
      if (editingSource) {
        return updateLeadSource(editingSource.id, {
          name,
          description: sourceDesc.trim(),
          color: sourceColor,
        });
      }
      return createLeadSource({
        name,
        description: sourceDesc.trim() || undefined,
        color: sourceColor,
      });
    },
    onSuccess: () => {
      const wasEdit = Boolean(editingSource);
      setSourceOpen(false);
      setEditingSource(null);
      queryClient.invalidateQueries({ queryKey: ["crm", "lead-sources"] });
      toast.success(wasEdit ? "Fuente actualizada" : "Fuente creada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const toggleSource = useMutation({
    mutationFn: (src: LeadSource) =>
      updateLeadSource(src.id, { is_active: src.is_active === false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "lead-sources"] });
      toast.success("Fuente actualizada");
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  if (!canManage) {
    return <CrmDenied title="Prospectos" icon={<Users className="h-5 w-5" />} />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Prospectos Comerciales"
        icon={<Users className="h-5 w-5" />}
        subtitle="Contactos y oportunidades potenciales antes de convertirlos en clientes activos."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9" onClick={openSourceCreate}>
              <Tags className="h-4 w-4" />
              <span>Fuentes</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-semibold">
                {activeSources.length}
              </span>
            </Button>
            <Button className="h-9" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo prospecto
            </Button>
          </div>
        }
      />

      <PageBody className="gap-4">
        {/* Navigation Tabs */}
        <CrmNav
          prospectsCount={metrics.openCount}
          className="glass rounded-2xl p-1.5"
        />

        {/* Commercial Pipeline KPIs for Leads */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            variant="compact"
            label="Prospectos Activos"
            value={metrics.openCount}
            sub="Abiertos en proceso"
            icon={Users}
            tone="primary"
          />
          <StatCard
            variant="compact"
            label="Nuevos por contactar"
            value={metrics.newCount}
            sub="Pendientes de 1er contacto"
            icon={UserPlus}
            tone={metrics.newCount > 0 ? "warning" : "muted"}
            onClick={() => setStatusFilter(statusFilter === "NEW" ? "" : "NEW")}
            className={statusFilter === "NEW" ? "ring-2 ring-primary/40 cursor-pointer" : "cursor-pointer"}
          />
          <StatCard
            variant="compact"
            label="En Conversación"
            value={metrics.contactedCount}
            sub="Contactados recientemente"
            icon={MessageCircle}
            tone="primary"
            onClick={() => setStatusFilter(statusFilter === "CONTACTED" ? "" : "CONTACTED")}
            className={statusFilter === "CONTACTED" ? "ring-2 ring-primary/40 cursor-pointer" : "cursor-pointer"}
          />
          <StatCard
            variant="compact"
            label="Listos para cierre"
            value={metrics.qualifiedCount}
            sub="Calificados para cliente"
            icon={UserCheck}
            tone="success"
            onClick={() => setStatusFilter(statusFilter === "QUALIFIED" ? "" : "QUALIFIED")}
            className={statusFilter === "QUALIFIED" ? "ring-2 ring-success/40 cursor-pointer" : "cursor-pointer"}
          />
        </div>

        {/* Minimal Single-Row Toolbar */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative w-52 sm:w-64 shrink-0">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar prospecto…"
                className="pl-8 pr-7 text-xs h-8 rounded-xl bg-card"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              containerClassName="w-36 shrink-0"
              className="text-xs h-8 rounded-xl"
            >
              <option value="">Estado: Todos</option>
              <option value="NEW">Nuevos</option>
              <option value="CONTACTED">Contactados</option>
              <option value="QUALIFIED">Calificados</option>
              <option value="CONVERTED">Convertidos</option>
              <option value="LOST">Perdidos</option>
              <option value="ARCHIVED">Archivados</option>
            </Select>

            {/* Source Filter */}
            {activeSources.length > 0 && (
              <Select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                containerClassName="w-36 shrink-0"
                className="text-xs h-8 rounded-xl"
              >
                <option value="">Fuente: Todas</option>
                {activeSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}

            {/* Clear filters shortcut */}
            {(search || statusFilter || sourceFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setSourceFilter("");
                }}
                className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* View switcher */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-card p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                viewMode === "cards"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Vista en tarjetas comerciales"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Vista en tabla"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Leads Content */}
        {listQuery.isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Error al cargar prospectos"
            description="Hubo un problema al consultar los prospectos comerciales. Verificá tu conexión o reintentá."
            action={
              <Button size="sm" onClick={() => listQuery.refetch()}>
                Reintentar
              </Button>
            }
          />
        ) : listQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        ) : allLeads.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={search || statusFilter || sourceFilter ? "No hay prospectos con este filtro" : "Sin prospectos registrados"}
            description="Registrá contactos y potenciales clientes para gestionar llamadas, propuestas y cotizaciones."
            action={
              <Button size="sm" onClick={openCreate}>
                Crear primer prospecto
              </Button>
            }
          />
        ) : viewMode === "cards" ? (
          /* Cards View */
          <div
            className={cn(
              "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-opacity duration-300",
              listQuery.isFetching ? "opacity-60 pointer-events-none" : "opacity-100",
            )}
          >
            {allLeads.map((lead) => {
              const wa = cleanPhoneForWa(lead.phone);
              const fullName = lead.full_name || `${lead.first_name} ${lead.last_name ?? ""}`.trim();

              return (
                <div
                  key={lead.id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
                >
                  <div>
                    {/* Top Row: Name and status badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-sm">{fullName}</h3>
                        {lead.company ? (
                          <p className="truncate text-xs text-muted-foreground">{lead.company}</p>
                        ) : null}
                      </div>

                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          statusBadge(
                            lead.status === "QUALIFIED"
                              ? "ACTIVE"
                              : lead.status === "LOST" || lead.status === "ARCHIVED"
                                ? "CANCELLED"
                                : "PENDING",
                          ),
                        )}
                      >
                        {leadStatusLabel(lead.status)}
                      </span>
                    </div>

                    {/* Source and Score */}
                    <div className="mt-2.5 flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                      <span className="truncate">
                        Fuente: <strong className="text-foreground font-medium">{lead.source_name || "General"}</strong>
                      </span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium tabular-nums">
                        {lead.score ?? 0} pts
                      </span>
                    </div>

                    {/* Quick Contact Icons */}
                    <div className="mt-3 flex items-center gap-1.5">
                      {wa ? (
                        <a
                          href={`https://wa.me/${wa}?text=Hola%20${encodeURIComponent(lead.first_name)},%20te%20escribo%20respecto%20a%20tu%20consulta.`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-success/30 bg-success/10 px-2 text-[11px] font-medium text-success hover:bg-success/20 transition-colors"
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3" />
                          <span>WhatsApp</span>
                        </a>
                      ) : null}

                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Llamar por teléfono"
                        >
                          <Phone className="h-3 w-3" />
                          <span>Llamar</span>
                        </a>
                      ) : null}

                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Enviar correo"
                        >
                          <Mail className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-2.5">
                    {/* Status Changer Menu */}
                    <Select
                      value={lead.status || "NEW"}
                      onChange={(e) =>
                        changeStatus.mutate({
                          id: lead.id,
                          status: e.target.value as LeadStatus,
                        })
                      }
                      className="h-7 w-28 text-[11px]"
                    >
                      <option value="NEW">Nuevo</option>
                      <option value="CONTACTED">Contactado</option>
                      <option value="QUALIFIED">Calificado</option>
                      <option value="LOST">Perdido</option>
                      <option value="ARCHIVED">Archivado</option>
                    </Select>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() =>
                          router.push(
                            `/customers/pipeline?new=true&leadId=${lead.id}&title=${encodeURIComponent(
                              lead.company || fullName,
                            )}`,
                          )
                        }
                        title="Crear trato en Pipeline"
                      >
                        <Kanban className="h-3 w-3" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => openEdit(lead)}
                        title="Editar prospecto"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>

                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-[11px]"
                        disabled={convert.isPending}
                        onClick={() => convert.mutate(lead)}
                        title="Convertir a cliente"
                      >
                        A cliente
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div
            className={cn(
              "overflow-x-auto rounded-2xl border border-border bg-card transition-opacity duration-300",
              listQuery.isFetching ? "opacity-60 pointer-events-none" : "opacity-100",
            )}
          >
            <table className="w-full min-w-[50rem] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-2.5 font-medium">Prospecto</th>
                  <th className="px-3.5 py-2.5 font-medium">Contacto directo</th>
                  <th className="px-3.5 py-2.5 font-medium">Empresa</th>
                  <th className="px-3.5 py-2.5 font-medium">Fuente</th>
                  <th className="px-3.5 py-2.5 font-medium">Estado</th>
                  <th className="px-3.5 py-2.5 font-medium">Puntos</th>
                  <th className="px-3.5 py-2.5 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {allLeads.map((lead) => {
                  const wa = cleanPhoneForWa(lead.phone);
                  const fullName = lead.full_name || `${lead.first_name} ${lead.last_name ?? ""}`.trim();

                  return (
                    <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium">
                        <div>
                          <span>{fullName}</span>
                          {(lead as { notes?: string }).notes && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {(lead as { notes?: string }).notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="hover:underline text-foreground">
                              {lead.phone}
                            </a>
                          )}
                          {wa && (
                            <a
                              href={`https://wa.me/${wa}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-success hover:opacity-80"
                              title="WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="text-muted-foreground hover:text-foreground">
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-muted-foreground">{lead.company || "—"}</td>
                      <td className="px-3.5 py-2.5 text-xs">{lead.source_name || "General"}</td>
                      <td className="px-3.5 py-2.5">
                        <Select
                          value={lead.status || "NEW"}
                          onChange={(e) =>
                            changeStatus.mutate({
                              id: lead.id,
                              status: e.target.value as LeadStatus,
                            })
                          }
                          className="h-7 w-28 text-[11px]"
                        >
                          <option value="NEW">Nuevo</option>
                          <option value="CONTACTED">Contactado</option>
                          <option value="QUALIFIED">Calificado</option>
                          <option value="LOST">Perdido</option>
                          <option value="ARCHIVED">Archivado</option>
                        </Select>
                      </td>
                      <td className="px-3.5 py-2.5 tabular-nums text-xs">{lead.score ?? 0}</td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() =>
                              router.push(
                                `/customers/pipeline?new=true&leadId=${lead.id}&title=${encodeURIComponent(
                                  lead.company || `${lead.first_name} ${lead.last_name || ""}`.trim(),
                                )}`,
                              )
                            }
                            title="Crear trato en Pipeline"
                          >
                            <Kanban className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEdit(lead)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={convert.isPending}
                            onClick={() => convert.mutate(lead)}
                          >
                            A cliente
                          </Button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("¿Eliminar este prospecto?")) {
                                deleteMut.mutate(lead.id);
                              }
                            }}
                            className="p-1 text-muted-foreground hover:text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <LoadMoreFooter
          showing={allLeads.length}
          total={listQuery.data?.count ?? 0}
          isLoading={listQuery.isFetching}
          onLoadMore={() => setListPageSize((n) => Math.min(n + 100, 1000))}
          label="prospectos"
        />
      </PageBody>

      {/* Modal: Crear / Editar Prospecto */}
      <AnimatedOverlay
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div className="w-full rounded-t-2xl border border-border bg-background p-4 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6">
          <h2 className="text-base font-semibold">
            {editing ? "Editar prospecto" : "Nuevo prospecto"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Completá los datos del contacto para seguimiento y prospección.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Apellido</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9…" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Empresa</label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Fuente</label>
              <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">Sin fuente</option>
                {activeSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Puntaje (0-100)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </div>

            {editing && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <Select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as LeadStatus)}
                >
                  <option value="NEW">Nuevo</option>
                  <option value="CONTACTED">Contactado</option>
                  <option value="QUALIFIED">Calificado</option>
                  <option value="LOST">Perdido</option>
                  <option value="ARCHIVED">Archivado</option>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Detalle de la fuente</label>
              <Input
                value={sourceDetail}
                onChange={(e) => setSourceDetail(e.target.value)}
                placeholder="Ej. Campaña Instagram, Referido por Juan…"
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Notas comerciales</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Intereses, presupuesto o acuerdos iniciales…"
                className="w-full resize-none rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!firstName.trim() || create.isPending || saveEdit.isPending}
              isLoading={create.isPending || saveEdit.isPending}
              onClick={() => (editing ? saveEdit.mutate() : create.mutate())}
            >
              {editing ? "Guardar cambios" : "Crear prospecto"}
            </Button>
          </div>
        </div>
      </AnimatedOverlay>

      {/* Modal: Gestión de Fuentes de Leads */}
      <AnimatedOverlay
        open={sourceOpen}
        onClose={() => {
          setSourceOpen(false);
          setEditingSource(null);
        }}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
          <h2 className="text-base font-semibold">
            {editingSource ? "Editar fuente" : "Fuentes de prospectos"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Definí de dónde provienen tus contactos (ej. Web, WhatsApp, Referidos).
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Nombre de la fuente *</label>
              <Input
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Ej. Redes Sociales"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Descripción</label>
              <Input
                value={sourceDesc}
                onChange={(e) => setSourceDesc(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Color representativo</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={sourceColor}
                  onChange={(e) => setSourceColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0"
                />
                <span className="text-xs text-muted-foreground font-mono">{sourceColor}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              {editingSource && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingSource(null);
                    setSourceName("");
                    setSourceDesc("");
                  }}
                >
                  Nuevo
                </Button>
              )}
              <Button
                size="sm"
                disabled={!sourceName.trim() || saveSource.isPending}
                isLoading={saveSource.isPending}
                onClick={() => saveSource.mutate()}
              >
                {editingSource ? "Guardar" : "Crear fuente"}
              </Button>
            </div>

            {/* List of existing sources */}
            <div className="mt-2 border-t border-border pt-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">Fuentes registradas</h3>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {sources.map((src) => (
                  <div
                    key={src.id}
                    className={cn(
                      "flex items-center justify-between rounded-xl border border-border p-2 text-xs",
                      src.is_active === false && "opacity-50",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: src.color || "#1890ff" }}
                      />
                      <span className="truncate font-medium">{src.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openSourceEdit(src)}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={toggleSource.isPending}
                        onClick={() => toggleSource.mutate(src)}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={src.is_active === false ? "Activar" : "Desactivar"}
                      >
                        <Power className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AnimatedOverlay>
    </PageShell>
  );
}
