"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  DollarSign,
  Kanban,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  User,
  UserCircle,
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createOpportunity,
  createOpportunityActivity,
  createOpportunityProduct,
  deleteOpportunity,
  deleteOpportunityProduct,
  fetchOpportunitiesPage,
  fetchOpportunityActivities,
  fetchOpportunityProducts,
  moveOpportunity,
  updateOpportunity,
  type OpportunityRow,
  type OpportunityProduct,
  type OpportunityStage,
  type OpportunityActivity,
  type OpportunityActivityType,
} from "@/lib/api/crm";
import { CRM_KEYS } from "@/lib/api/keys";
import { fetchLeads } from "@/lib/api/crm-leads";
import { searchCustomers } from "@/lib/api/customers";
import { useCrmStages } from "@/lib/hooks/useCrm";
import { LoadMoreFooter } from "@/components/ui/load-more";
import { useCanManageCustomers } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { cn, formatCLP } from "@/lib/utils";

function PipelineInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canManage = useCanManageCustomers();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityRow | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "products" | "activities">("info");
  // Prefill desde cross-links (?new=true&leadId=…&clientId=…&title=…) en mount.
  // Al cerrar el modal, closeCreateModal limpia los params para que no reaparezca.
  const hasNewParams = Boolean(
    searchParams.get("new") === "true" ||
      searchParams.get("leadId") ||
      searchParams.get("clientId") ||
      searchParams.get("title"),
  );
  const [createModalOpen, setCreateModalOpen] = useState(hasNewParams);
  const [newTitle, setNewTitle] = useState(() => searchParams.get("title") ?? "");
  const [contactType, setContactType] = useState<"client" | "prospect">(() =>
    searchParams.get("leadId") ? "prospect" : "client",
  );
  const [newClientId, setNewClientId] = useState(() => searchParams.get("clientId") ?? "");
  const [newLeadId, setNewLeadId] = useState(() => searchParams.get("leadId") ?? "");
  const [clientQuery, setClientQuery] = useState("");
  const [leadQuery, setLeadQuery] = useState("");
  const [newStageId, setNewStageId] = useState("");
  const [newEstimatedValue, setNewEstimatedValue] = useState("");
  const [newExpectedCloseDate, setNewExpectedCloseDate] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Edición de oportunidad existente (reutiliza el modal de creación)
  const [editingOpp, setEditingOpp] = useState<OpportunityRow | null>(null);

  // Product form states for opportunity detail
  const [newProdName, setNewProdName] = useState("");
  const [newProdQty, setNewProdQty] = useState("1");
  const [newProdPrice, setNewProdPrice] = useState("");

  // Activity form states for opportunity detail
  const [newActType, setNewActType] = useState<OpportunityActivityType>("NOTE");
  const [newActDesc, setNewActDesc] = useState("");

  // Tamaño de página creíble + "cargar más" (sin truncado silencioso)
  const [oppPageSize, setOppPageSize] = useState(60);

  const stagesQuery = useCrmStages();

  const opportunitiesQuery = useQuery({
    queryKey: CRM_KEYS.opportunities.list({ page_size: oppPageSize, is_active: true }),
    queryFn: () => fetchOpportunitiesPage({ page_size: oppPageSize, is_active: true }),
    enabled: canManage,
    placeholderData: keepPreviousData,
  });

  const clientsQuery = useQuery({
    queryKey: ["customers", "pipeline-picker", clientQuery],
    queryFn: () => searchCustomers(clientQuery),
    enabled: canManage && createModalOpen,
  });

  const leadsQuery = useQuery({
    queryKey: ["crm", "leads", "pipeline-picker", leadQuery],
    queryFn: () => fetchLeads({ page_size: 50, search: leadQuery }),
    enabled: canManage && createModalOpen && contactType === "prospect",
  });

  const stages = stagesQuery.data ?? [];
  const allOpportunities = opportunitiesQuery.data?.rows ?? [];
  const opportunitiesTotal = opportunitiesQuery.data?.count ?? 0;

  // Filter opportunities by search term
  const opportunities = useMemo(() => {
    if (!search.trim()) return allOpportunities;
    const q = search.toLowerCase();
    return allOpportunities.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        (o.client_name && o.client_name.toLowerCase().includes(q)),
    );
  }, [allOpportunities, search]);

  // KPIs
  const kpis = useMemo(() => {
    let totalValue = 0;
    let weightedValue = 0;
    let openCount = 0;
    let wonValue = 0;

    for (const o of allOpportunities) {
      const stage = stages.find((s) => s.id === o.stage || s.name === o.stage_name);
      const est = Number(o.estimated_value) || 0;
      if (stage?.is_won) {
        wonValue += est;
      } else if (!stage?.is_closed) {
        openCount++;
        totalValue += est;
        const prob = (stage?.probability ?? 50) / 100;
        weightedValue += Number(o.weighted_value) || est * prob;
      }
    }

    return { totalValue, weightedValue, openCount, wonValue };
  }, [allOpportunities, stages]);

  // Mutations
  const moveMut = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      moveOpportunity(id, stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] });
      toast.success("Oportunidad movida");
    },
    onError: () => toast.error("No se pudo mover la etapa"),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) throw new Error("Ingresá un título para la oportunidad");
      const stageId = newStageId || stages[0]?.id;
      if (!stageId) throw new Error("No hay etapas disponibles");

      if (editingOpp) {
        return updateOpportunity(editingOpp.id, {
          title: newTitle.trim(),
          stage_id: stageId,
          description: newDescription.trim() || undefined,
          estimated_value: Number(newEstimatedValue) || 0,
          expected_close_date: newExpectedCloseDate || null,
        });
      }

      return createOpportunity({
        title: newTitle.trim(),
        stage_id: stageId,
        client: contactType === "client" && newClientId ? Number(newClientId) : null,
        lead: contactType === "prospect" && newLeadId ? newLeadId : null,
        description: newDescription.trim() || undefined,
        estimated_value: Number(newEstimatedValue) || 0,
        expected_close_date: newExpectedCloseDate || undefined,
      });
    },
    onSuccess: () => {
      setCreateModalOpen(false);
      setEditingOpp(null);
      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: CRM_KEYS.opportunities.root() });
      toast.success(editingOpp ? "Oportunidad actualizada" : "Oportunidad creada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteOpportunity(id),
    onSuccess: () => {
      setSelectedOpportunity(null);
      queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] });
      toast.success("Oportunidad eliminada");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  // Opportunity Products Query & Mutation
  const productsQuery = useQuery({
    queryKey: ["crm", "opportunity-products", selectedOpportunity?.id],
    queryFn: () => fetchOpportunityProducts(selectedOpportunity!.id),
    enabled: Boolean(selectedOpportunity?.id && detailTab === "products"),
  });

  const addProductMut = useMutation({
    mutationFn: () => {
      if (!selectedOpportunity) throw new Error("Sin oportunidad");
      return createOpportunityProduct({
        opportunity: selectedOpportunity.id,
        notes: newProdName.trim(),
        quantity: Number(newProdQty) || 1,
        unit_price: Number(newProdPrice) || 0,
      });
    },
    onSuccess: () => {
      setNewProdName("");
      setNewProdPrice("");
      setNewProdQty("1");
      queryClient.invalidateQueries({
        queryKey: ["crm", "opportunity-products", selectedOpportunity?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] });
      toast.success("Producto agregado");
    },
    onError: () => toast.error("No se pudo agregar el producto"),
  });

  const deleteProductMut = useMutation({
    mutationFn: (id: string) => deleteOpportunityProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["crm", "opportunity-products", selectedOpportunity?.id],
      });
      toast.success("Producto quitado");
    },
    onError: () => toast.error("No se pudo quitar"),
  });

  // Opportunity Activities Query & Mutation
  const activitiesQuery = useQuery({
    queryKey: ["crm", "opportunity-activities", selectedOpportunity?.id],
    queryFn: () => fetchOpportunityActivities(selectedOpportunity!.id),
    enabled: Boolean(selectedOpportunity?.id && detailTab === "activities"),
  });

  const addActivityMut = useMutation({
    mutationFn: () => {
      if (!selectedOpportunity) throw new Error("Sin oportunidad");
      if (!newActDesc.trim()) throw new Error("Escribí la nota o acción");
      return createOpportunityActivity({
        opportunity: selectedOpportunity.id,
        activity_type: newActType,
        description: newActDesc.trim(),
      });
    },
    onSuccess: () => {
      setNewActDesc("");
      queryClient.invalidateQueries({
        queryKey: ["crm", "opportunity-activities", selectedOpportunity?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
      toast.success("Actividad registrada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  function resetCreateForm() {
    setNewTitle("");
    setContactType("client");
    setNewClientId("");
    setClientQuery("");
    setNewLeadId("");
    setLeadQuery("");
    setNewStageId(stages[0]?.id || "");
    setNewEstimatedValue("");
    setNewExpectedCloseDate("");
    setNewDescription("");
  }

  /** Limpia ?new=true&leadId=… para que el modal no reaparezca al volver/recargar. */
  function clearNewParams() {
    if (
      searchParams.get("new") ||
      searchParams.get("leadId") ||
      searchParams.get("clientId") ||
      searchParams.get("title")
    ) {
      router.replace("/customers/pipeline");
    }
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
    setEditingOpp(null);
    clearNewParams();
  }

  function openCreate() {
    resetCreateForm();
    if (stages[0]?.id) setNewStageId(stages[0].id);
    setCreateModalOpen(true);
  }

  function openEdit(opp: OpportunityRow) {
    setEditingOpp(opp);
    setNewTitle(opp.title ?? "");
    setNewStageId(opp.stage ? String(opp.stage) : stages[0]?.id ?? "");
    setNewEstimatedValue(
      opp.estimated_value != null && Number(opp.estimated_value) > 0
        ? String(opp.estimated_value)
        : "",
    );
    setNewExpectedCloseDate(opp.expected_close_date ?? "");
    setNewDescription(opp.description ?? "");
    setCreateModalOpen(true);
  }

  if (!canManage) {
    return <CrmDenied title="Pipeline Comercial" icon={<Kanban className="h-5 w-5" />} />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Pipeline Comercial"
        icon={<Kanban className="h-5 w-5" />}
        subtitle="Embudo visual de oportunidades y avance comercial por etapas."
        actions={
          <Button className="h-9" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva oportunidad
          </Button>
        }
      />

      <PageBody className="gap-4">
        {/* Navigation Tabs */}
        <CrmNav
          pipelineCount={kpis.openCount}
          className="glass rounded-2xl p-1.5"
        />

        {/* Commercial KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            variant="compact"
            label="En negociación"
            value={kpis.openCount}
            sub="Oportunidades abiertas"
            icon={TrendingUp}
            tone="primary"
          />
          <StatCard
            variant="compact"
            label="Valor en Pipeline"
            value={formatCLP(kpis.totalValue)}
            sub="Suma de tratos abiertos"
            icon={DollarSign}
            tone="primary"
          />
          <StatCard
            variant="compact"
            label="Valor Ponderado"
            value={formatCLP(kpis.weightedValue)}
            sub="Proyección por probabilidad"
            icon={SlidersHorizontal}
            tone="muted"
          />
          <StatCard
            variant="compact"
            label="Cerrado Ganado"
            value={formatCLP(kpis.wonValue)}
            sub="Tratos ganados"
            icon={CheckCircle2}
            tone="success"
          />
        </div>

        {/* Minimal Single-Row Toolbar */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative w-56 sm:w-72 shrink-0">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por trato o cliente…"
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

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {opportunitiesQuery.isFetching && (
              <span className="text-[11px] text-muted-foreground animate-pulse">
                Actualizando…
              </span>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {opportunities.length} {opportunities.length === 1 ? "oportunidad" : "oportunidades"}
            </span>
          </div>
        </div>

        {/* Kanban Board */}
        {stagesQuery.isError || opportunitiesQuery.isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Error al cargar el pipeline"
            description="No se pudieron consultar las etapas o tratos comerciales. Verificá tu conexión o reintentá."
            action={
              <Button size="sm" onClick={() => { stagesQuery.refetch(); opportunitiesQuery.refetch(); }}>
                Reintentar
              </Button>
            }
          />
        ) : stagesQuery.isLoading || opportunitiesQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-96 rounded-2xl" />
            ))}
          </div>
        ) : stages.length === 0 ? (
          <EmptyState
            icon={Kanban}
            title="Sin etapas configuradas"
            description="Creá tus etapas comerciales para empezar a mover tratos."
          />
        ) : (
          <div
            className={cn(
              "flex gap-4 overflow-x-auto pb-4 pt-1 transition-opacity duration-300 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              opportunitiesQuery.isFetching ? "opacity-60" : "opacity-100",
            )}
          >
            {stages.map((stage, stageIdx) => {
              const stageOpps = opportunities.filter(
                (o) => o.stage === stage.id || o.stage_name === stage.name,
              );
              const stageTotal = stageOpps.reduce(
                (sum, o) => sum + (Number(o.estimated_value) || 0),
                0,
              );

              const nextStage = stages[stageIdx + 1];
              const prevStage = stages[stageIdx - 1];

              return (
                <div
                  key={stage.id}
                  className="flex min-w-[18rem] max-w-[20rem] flex-1 shrink-0 flex-col rounded-2xl border border-border bg-card/60 p-3 shadow-xs"
                >
                  {/* Column Header */}
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: stage.color || "#64748b" }}
                      />
                      <span className="truncate text-sm font-semibold">{stage.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                        {stageOpps.length}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground/80">
                      {formatCLP(stageTotal)}
                    </span>
                  </div>

                  {/* Column Cards */}
                  <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-22rem)] pr-0.5">
                    {stageOpps.length === 0 ? (
                      <div className="grid place-items-center rounded-xl border border-dashed border-border/70 py-8 text-center text-xs text-muted-foreground">
                        Sin tratos en esta etapa
                      </div>
                    ) : (
                      stageOpps.map((opp) => (
                        <div
                          key={opp.id}
                          onClick={() => {
                            setSelectedOpportunity(opp);
                            setDetailTab("info");
                          }}
                          className="group relative cursor-pointer rounded-xl border border-border bg-background p-3 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-medium leading-snug line-clamp-2">
                              {opp.title}
                            </h3>
                            <div className="flex shrink-0 items-center gap-1">
                              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
                                {formatCLP(Number(opp.estimated_value) || 0)}
                              </span>
                              <button
                                type="button"
                                title="Editar oportunidad"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(opp);
                                }}
                                className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {opp.client ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/customers?id=${opp.client}`);
                              }}
                              className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:underline truncate"
                              title="Ver ficha 360 del cliente"
                            >
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{opp.client_name || `Cliente #${opp.client}`}</span>
                            </button>
                          ) : opp.client_name ? (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{opp.client_name}</span>
                            </p>
                          ) : null}

                          {opp.expected_close_date ? (
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span>Cierre: {opp.expected_close_date}</span>
                            </p>
                          ) : null}

                          {/* Quick Stage Mover Buttons */}
                          <div
                            className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {prevStage ? (
                              <button
                                type="button"
                                disabled={moveMut.isPending}
                                onClick={() =>
                                  moveMut.mutate({ id: opp.id, stageId: prevStage.id })
                                }
                                className="text-[11px] text-muted-foreground hover:text-foreground"
                                title={`Mover a ${prevStage.name}`}
                              >
                                ← {prevStage.name}
                              </button>
                            ) : <span />}

                            {nextStage ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 gap-1 px-2 text-[11px]"
                                disabled={moveMut.isPending}
                                onClick={() =>
                                  moveMut.mutate({ id: opp.id, stageId: nextStage.id })
                                }
                              >
                                <span>{nextStage.name}</span>
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <LoadMoreFooter
          showing={allOpportunities.length}
          total={opportunitiesTotal}
          isLoading={opportunitiesQuery.isFetching}
          onLoadMore={() => setOppPageSize((n) => Math.min(n + 100, 1000))}
          label="oportunidades"
        />
      </PageBody>

      {/* Modal: Nueva Oportunidad */}
      <AnimatedOverlay
        open={createModalOpen}
        onClose={closeCreateModal}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-xl sm:max-w-2xl sm:rounded-2xl sm:p-6">
          <h2 className="text-base font-semibold">
            {editingOpp ? "Editar Oportunidad" : "Nueva Oportunidad Comercial"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {editingOpp
              ? "Actualizá etapa, valor, cierre esperado o notas del trato."
              : "Registrá una negociación o cotización para hacerle seguimiento en el embudo."}
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Título del trato *</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Suministro equipamiento gastronómico"
                className="mt-1"
              />
            </div>

            {/* Tipo de contacto: Prospecto o Cliente (solo alta; en edición se mantiene) */}
            {!editingOpp && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vincular a</label>
              <div className="mt-1.5 flex rounded-xl border border-border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setContactType("client");
                    setNewLeadId("");
                    setLeadQuery("");
                  }}
                  className={cn(
                    "flex-1 py-1.5 px-3 font-medium transition-colors",
                    contactType === "client"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  Cliente registrado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactType("prospect");
                    setNewClientId("");
                    setClientQuery("");
                  }}
                  className={cn(
                    "flex-1 py-1.5 px-3 font-medium transition-colors",
                    contactType === "prospect"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  Prospecto / Lead
                </button>
              </div>
              <div className="mt-2">
                {contactType === "client" ? (
                  <SearchableSelect
                    placeholder="Seleccionar cliente…"
                    searchPlaceholder="Buscar cliente…"
                    options={(clientsQuery.data ?? []).map((c) => ({
                      value: String(c.id),
                      label: c.name || `Cliente #${c.id}`,
                    }))}
                    value={newClientId}
                    onChange={setNewClientId}
                    onQueryChange={setClientQuery}
                    loading={clientsQuery.isFetching}
                  />
                ) : (
                  <SearchableSelect
                    placeholder="Seleccionar prospecto…"
                    searchPlaceholder="Buscar prospecto…"
                    options={(leadsQuery.data?.results ?? []).map((l) => ({
                      value: String(l.id),
                      label: l.full_name || l.email || `Lead #${l.id}`,
                    }))}
                    value={newLeadId}
                    onChange={setNewLeadId}
                    onQueryChange={setLeadQuery}
                    loading={leadsQuery.isFetching}
                  />
                )}
              </div>
            </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {editingOpp ? "Etapa" : "Etapa inicial"}
              </label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Elegí en qué parte del embudo entra. La barra es la chance de cierre de esa etapa.
              </p>
              <StageRail
                className="mt-2"
                stages={stages}
                value={newStageId || stages[0]?.id || ""}
                onChange={setNewStageId}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Valor estimado ($CLP)</label>
                <Input
                  type="number"
                  value={newEstimatedValue}
                  onChange={(e) => setNewEstimatedValue(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Cierre esperado</label>
                <Input
                  type="date"
                  value={newExpectedCloseDate}
                  onChange={(e) => setNewExpectedCloseDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Descripción / Notas</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Detalle de requerimientos, alcance o acuerdos iniciales…"
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="mt-2 flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={closeCreateModal}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!newTitle.trim() || createMut.isPending}
                isLoading={createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {editingOpp ? "Guardar Cambios" : "Crear Oportunidad"}
              </Button>
            </div>
          </div>
        </div>
      </AnimatedOverlay>

      {/* Modal: Detalle de Oportunidad */}
      {selectedOpportunity && (
        <AnimatedOverlay
          open={Boolean(selectedOpportunity)}
          onClose={() => setSelectedOpportunity(null)}
          zIndex="z-[70]"
          panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
        >
          <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-xl sm:max-w-2xl sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{selectedOpportunity.title}</h2>
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {formatCLP(Number(selectedOpportunity.estimated_value) || 0)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Cliente: <span className="font-medium text-foreground">{selectedOpportunity.client_name || "Sin asignar"}</span>
                  {" · "}
                  Etapa actual: <span className="font-medium text-foreground">{selectedOpportunity.stage_name}</span>
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const opp = selectedOpportunity;
                    setSelectedOpportunity(null);
                    openEdit(opp);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    if (confirm("¿Eliminar esta oportunidad comercial?")) {
                      deleteMut.mutate(selectedOpportunity.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Quick Stage Changer in modal */}
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">Mover de etapa</p>
              <StageRail
                className="mt-2"
                stages={stages}
                value={
                  stages.find(
                    (s) =>
                      s.id === selectedOpportunity.stage || s.name === selectedOpportunity.stage_name,
                  )?.id ?? ""
                }
                disabled={moveMut.isPending}
                onChange={(stageId) => {
                  const stage = stages.find((s) => s.id === stageId);
                  if (!stage) return;
                  moveMut.mutate(
                    { id: selectedOpportunity.id, stageId },
                    {
                      onSuccess: () => {
                        setSelectedOpportunity((prev) =>
                          prev ? { ...prev, stage: stage.id, stage_name: stage.name } : null,
                        );
                      },
                    },
                  );
                }}
              />
            </div>

            {/* Detail Tabs */}
            <div className="mt-4 flex gap-2 border-b border-border pb-2 text-xs">
              <button
                type="button"
                onClick={() => setDetailTab("info")}
                className={cn(
                  "rounded-lg px-3 py-1 font-medium transition-colors",
                  detailTab === "info"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Información
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("products")}
                className={cn(
                  "rounded-lg px-3 py-1 font-medium transition-colors",
                  detailTab === "products"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Productos de Interés
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("activities")}
                className={cn(
                  "rounded-lg px-3 py-1 font-medium transition-colors",
                  detailTab === "activities"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Actividades y Bitácora
              </button>
            </div>

            {/* Tab 1: Info */}
            {detailTab === "info" && (
              <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                {selectedOpportunity.client ? (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 sm:col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground text-[11px]">Cliente vinculado</span>
                      <p className="font-semibold text-sm text-foreground">
                        {selectedOpportunity.client_name || `Cliente #${selectedOpportunity.client}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => router.push(`/customers?id=${selectedOpportunity.client}`)}
                    >
                      <UserCircle className="h-4 w-4" />
                      <span>Ver Ficha 360</span>
                    </Button>
                  </div>
                ) : null}
                <div className="rounded-xl border border-border p-3">
                  <span className="text-muted-foreground">Valor Estimado</span>
                  <p className="mt-1 text-base font-semibold">
                    {formatCLP(Number(selectedOpportunity.estimated_value) || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <span className="text-muted-foreground">Valor Ponderado</span>
                  <p className="mt-1 text-base font-semibold">
                    {formatCLP(Number(selectedOpportunity.weighted_value) || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3 sm:col-span-2">
                  <span className="text-muted-foreground">Notas comerciales</span>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">
                    {(selectedOpportunity as { description?: string }).description || "Sin descripción adicional."}
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Products */}
            {detailTab === "products" && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/20 p-2.5">
                  <Input
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="Producto / Servicio de interés"
                    className="min-w-[12rem] flex-1 text-xs"
                  />
                  <Input
                    type="number"
                    value={newProdQty}
                    onChange={(e) => setNewProdQty(e.target.value)}
                    placeholder="Cant."
                    className="w-20 text-xs"
                  />
                  <Input
                    type="number"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder="Precio"
                    className="w-28 text-xs"
                  />
                  <Button
                    size="sm"
                    disabled={!newProdName.trim() || addProductMut.isPending}
                    isLoading={addProductMut.isPending}
                    onClick={() => addProductMut.mutate()}
                  >
                    Agregar
                  </Button>
                </div>

                {productsQuery.isLoading ? (
                  <Skeleton className="h-20 w-full rounded-xl" />
                ) : (productsQuery.data ?? []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No hay productos asociados a esta oportunidad.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {(productsQuery.data ?? []).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-border p-2 text-xs"
                      >
                        <div>
                          <p className="font-medium">{p.product_name || p.notes || "Producto"}</p>
                          <p className="text-muted-foreground">
                            {p.quantity ?? 1} x {formatCLP(Number(p.unit_price) || 0)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{formatCLP(Number(p.total_price) || 0)}</span>
                          <button
                            type="button"
                            onClick={() => deleteProductMut.mutate(p.id)}
                            className="p-1 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Activities */}
            {detailTab === "activities" && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-2.5">
                  <div className="flex gap-2">
                    <Select
                      value={newActType}
                      onChange={(e) => setNewActType(e.target.value as OpportunityActivityType)}
                      className="w-36 text-xs"
                    >
                      <option value="NOTE">Nota</option>
                      <option value="CALL">Llamada</option>
                      <option value="MEETING">Reunión</option>
                      <option value="QUOTE">Cotización</option>
                      <option value="TASK">Tarea</option>
                    </Select>
                    <Input
                      value={newActDesc}
                      onChange={(e) => setNewActDesc(e.target.value)}
                      placeholder="Registrá el resultado de la llamada, reunión o nota…"
                      className="flex-1 text-xs"
                    />
                    <Button
                      size="sm"
                      disabled={!newActDesc.trim() || addActivityMut.isPending}
                      isLoading={addActivityMut.isPending}
                      onClick={() => addActivityMut.mutate()}
                    >
                      Registrar
                    </Button>
                  </div>
                </div>

                {activitiesQuery.isLoading ? (
                  <Skeleton className="h-20 w-full rounded-xl" />
                ) : (activitiesQuery.data ?? []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Sin actividades comerciales registradas aún.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(activitiesQuery.data ?? []).map((act) => (
                      <div
                        key={act.id}
                        className="rounded-xl border border-border bg-background p-2.5 text-xs shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="font-semibold text-primary">{act.activity_type}</span>
                          <span>{new Date(act.created).toLocaleDateString("es-CL")}</span>
                        </div>
                        <p className="mt-1 text-foreground">{act.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end border-t border-border pt-3">
              <Button size="sm" variant="outline" onClick={() => setSelectedOpportunity(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </AnimatedOverlay>
      )}
    </PageShell>
  );
}

export default function PipelinePage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <PageHeader
            title="Pipeline Comercial"
            icon={<Kanban className="h-5 w-5" />}
            subtitle="Embudo visual de oportunidades y avance comercial por etapas."
          />
          <PageBody className="gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <div className="flex gap-4 overflow-x-auto pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-2xl" />
              ))}
            </div>
          </PageBody>
        </PageShell>
      }
    >
      <PipelineInner />
    </Suspense>
  );
}

function stageMeaning(stage: OpportunityStage): string {
  if (stage.is_won) return "Cierra ganada. Sale del embudo abierto.";
  if (stage.is_closed) return "Cierra perdida. No suma al valor en curso.";
  const chance = Number(stage.probability) || 0;
  return `Sigue abierta. Chance de cierre ${chance}%.`;
}

function StageRail({
  stages,
  value,
  onChange,
  disabled,
  className,
}: {
  stages: OpportunityStage[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const selected = stages.find((stage) => stage.id === value) ?? stages[0];
  return (
    <div className={className}>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stages.map((stage, index) => {
          const active = stage.id === (selected?.id ?? "");
          const color = stage.color || "#64748b";
          const chance = Math.max(0, Math.min(100, Number(stage.probability) || 0));
          return (
            <button
              key={stage.id}
              type="button"
              disabled={disabled || active}
              onClick={() => onChange(stage.id)}
              className={cn(
                "min-w-[7.25rem] flex-1 rounded-xl border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-transparent text-white shadow-sm"
                  : "border-border bg-card hover:border-primary/40",
              )}
              style={active ? { backgroundColor: color } : undefined}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.28)" : color }}
                >
                  {index + 1}
                </span>
                <span className={cn("truncate text-xs font-semibold", !active && "text-foreground")}>
                  {stage.name}
                </span>
              </span>
              <span
                className={cn(
                  "mt-2 block h-1.5 overflow-hidden rounded-full",
                  active ? "bg-white/25" : "bg-muted",
                )}
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${chance}%`, backgroundColor: active ? "#fff" : color }}
                />
              </span>
              <span
                className={cn(
                  "mt-1 block text-[10px] font-medium tabular-nums",
                  active ? "text-white/90" : "text-muted-foreground",
                )}
              >
                {stage.is_won ? "Ganada" : stage.is_closed ? "Perdida" : `${chance}%`}
              </span>
            </button>
          );
        })}
      </div>
      {selected ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: selected.color || "#64748b" }}
          />
          <span>
            <span className="font-medium text-foreground">{selected.name}.</span>{" "}
            {stageMeaning(selected)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
