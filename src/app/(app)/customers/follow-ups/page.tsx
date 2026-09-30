"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FolderKanban,
  Plus,
  Search,
  Tags,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageBody, PageShell } from "@/components/page-shell";
import { CrmDenied } from "@/components/customers/crm-denied";
import { CrmNav } from "@/components/customers/crm-nav";
import {
  ActionTypePicker,
  CATEGORY_COLORS,
  CategoryPicker,
  PlanningCard,
} from "@/components/customers/follow-up-kit";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { searchCustomers } from "@/lib/api/customers";
import { fetchLeads, type LeadList } from "@/lib/api/crm-leads";
import {
  activityTypeLabel,
  completeOpportunityActivity,
  createFollowUpCategory,
  createOpportunityActivity,
  deleteFollowUpCategory,
  ensureClientFollowUpOpportunity,
  ensureLeadFollowUpOpportunity,
  fetchFollowUpActivitiesPage,
  FOLLOW_UP_ACTIVITY_OPTIONS,
  type FollowUpActivity,
  type OpportunityActivityType,
} from "@/lib/api/crm";
import { CRM_KEYS } from "@/lib/api/keys";
import { useCrmFollowUpCategories, useCrmOpportunityClientMap } from "@/lib/hooks/useCrm";
import { LoadMoreFooter } from "@/components/ui/load-more";
import { useCanManageCustomers } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

type TimeBucket = "overdue" | "today" | "later" | "none";

function leadDisplayName(lead?: LeadList | null): string {
  if (!lead) return "";
  const name = lead.full_name || `${lead.first_name} ${lead.last_name ?? ""}`.trim();
  return lead.company ? `${name} · ${lead.company}` : name;
}

function getPresetDate(preset: "today_pm" | "tomorrow" | "in_2_days" | "next_week"): string {
  const d = new Date();
  if (preset === "today_pm") {
    d.setHours(16, 0, 0, 0);
    if (d.getTime() < Date.now()) {
      d.setTime(Date.now() + 2 * 60 * 60 * 1000);
    }
  } else if (preset === "tomorrow") {
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
  } else if (preset === "in_2_days") {
    d.setDate(d.getDate() + 2);
    d.setHours(10, 0, 0, 0);
  } else if (preset === "next_week") {
    const day = d.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + daysUntilMonday);
    d.setHours(10, 0, 0, 0);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${date}T${hours}:${minutes}`;
}

export default function FollowUpsHubPage() {
  const canManage = useCanManageCustomers();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [targetKind, setTargetKind] = useState<"client" | "prospect">("client");
  const [clientId, setClientId] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [leadId, setLeadId] = useState("");
  const [leadQuery, setLeadQuery] = useState("");
  const [activityType, setActivityType] = useState<OpportunityActivityType>("CALL");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [typeFilter, setTypeFilter] = useState<OpportunityActivityType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<TimeBucket | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "completed">("open");
  const [doneTimeFilter, setDoneTimeFilter] = useState<"all" | "done_today" | "done_week" | "done_older">("all");

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLORS[0]);

  const categoriesQuery = useCrmFollowUpCategories();

  // "Cargar más" incremental: sin truncado silencioso de page_size fijo.
  const [openPageSize, setOpenPageSize] = useState(60);
  const [donePageSize, setDonePageSize] = useState(60);

  const openQuery = useQuery({
    queryKey: CRM_KEYS.activities.list({ is_completed: false, page_size: openPageSize }),
    queryFn: () =>
      fetchFollowUpActivitiesPage({ is_completed: false, page_size: openPageSize }),
    enabled: canManage,
    placeholderData: keepPreviousData,
  });

  const doneQuery = useQuery({
    queryKey: CRM_KEYS.activities.list({ is_completed: true, page_size: donePageSize }),
    queryFn: () =>
      fetchFollowUpActivitiesPage({ is_completed: true, page_size: donePageSize }),
    enabled: canManage,
    placeholderData: keepPreviousData,
  });

  const clientMapQuery = useCrmOpportunityClientMap();

  const clientsQuery = useQuery({
    queryKey: ["customers", "task-picker", clientQuery],
    queryFn: () => searchCustomers(clientQuery),
    enabled: canManage && actionModalOpen && targetKind === "client",
  });

  const leadsQuery = useQuery({
    queryKey: ["crm", "leads", "task-picker", leadQuery],
    queryFn: () => fetchLeads({ search: leadQuery.trim() || undefined, page_size: 50 }),
    enabled: canManage && actionModalOpen && targetKind === "prospect",
  });

  const complete = useMutation({
    mutationFn: (id: string) => completeOpportunityActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
      toast.success("¡Acción completada!");
    },
    onError: () => toast.error("No se pudo completar"),
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const text = description.trim();
      if (!text) throw new Error("Escribí la acción");
      let opportunityId = "";
      if (targetKind === "prospect") {
        if (!leadId) throw new Error("Elegí un prospecto");
        const lead = (leadsQuery.data?.results ?? []).find((l) => l.id === leadId);
        const name = leadDisplayName(lead) || "Prospecto";
        const { opportunity } = await ensureLeadFollowUpOpportunity({
          leadId,
          leadName: name,
        });
        opportunityId = opportunity.id;
      } else {
        const id = Number(clientId);
        if (!Number.isFinite(id) || !clientId) throw new Error("Elegí un cliente");
        const name =
          clientsQuery.data?.find((c) => String(c.id) === clientId)?.name || "Cliente";
        const { opportunity } = await ensureClientFollowUpOpportunity({
          clientId: id,
          clientName: name,
        });
        opportunityId = opportunity.id;
      }
      return createOpportunityActivity({
        opportunity: opportunityId,
        activity_type: activityType,
        category: categoryId || null,
        description: text,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      setDescription("");
      setScheduledAt("");
      setClientId("");
      setLeadId("");
      setActionModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "opportunity-client-map"] });
      toast.success("Acción planificada con éxito");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
  });

  const saveCategory = useMutation({
    mutationFn: () =>
      createFollowUpCategory({
        name: categoryName.trim(),
        color: categoryColor,
        order: (categoriesQuery.data?.length ?? 0) + 1,
      }),
    onSuccess: (created) => {
      setCategoryName("");
      setCategoryId(created.id);
      setCategoryOpen(false);
      queryClient.invalidateQueries({ queryKey: ["crm", "follow-up-categories"] });
      toast.success("Categoría creada");
    },
    onError: () => toast.error("No se pudo crear la categoría"),
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) => deleteFollowUpCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "follow-up-categories"] });
      toast.success("Categoría quitada");
    },
    onError: () => toast.error("No se pudo quitar"),
  });

  const categories = categoriesQuery.data ?? [];
  const clientMap = useMemo(() => clientMapQuery.data ?? {}, [clientMapQuery.data]);
  const rawActivities = useMemo(() => openQuery.data?.rows ?? [], [openQuery.data?.rows]);
  const rawDoneActivities = useMemo(() => doneQuery.data?.rows ?? [], [doneQuery.data?.rows]);

  // Filter activities by search string
  const filteredActivities = useMemo(() => {
    if (!search.trim()) return rawActivities;
    const q = search.toLowerCase();
    return rawActivities.filter((item) => {
      const clientRef = clientMap[item.opportunity];
      const matchClient = clientRef?.clientName?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      return matchClient || matchDesc;
    });
  }, [rawActivities, search, clientMap]);

  // Filter completed activities by search string
  const filteredDoneActivities = useMemo(() => {
    if (!search.trim()) return rawDoneActivities;
    const q = search.toLowerCase();
    return rawDoneActivities.filter((item) => {
      const clientRef = clientMap[item.opportunity];
      const matchClient = clientRef?.clientName?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      return matchClient || matchDesc;
    });
  }, [rawDoneActivities, search, clientMap]);

  const buckets = useMemo(() => groupOpenTasks(filteredActivities), [filteredActivities]);
  const visibleBuckets = buckets
    .filter((bucket) => timeFilter === "all" || bucket.id === timeFilter)
    .map((bucket) => ({
      ...bucket,
      items: bucket.items.filter((item) => {
        if (typeFilter !== "all" && item.activity_type !== typeFilter) return false;
        if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
        return true;
      }),
    }));
  const visibleCount = visibleBuckets.reduce((sum, bucket) => sum + bucket.items.length, 0);

  const doneBuckets = useMemo(() => groupDoneTasks(filteredDoneActivities), [filteredDoneActivities]);
  const visibleDoneBuckets = doneBuckets
    .filter((bucket) => doneTimeFilter === "all" || bucket.id === doneTimeFilter)
    .map((bucket) => ({
      ...bucket,
      items: bucket.items.filter((item) => {
        if (typeFilter !== "all" && item.activity_type !== typeFilter) return false;
        if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
        return true;
      }),
    }));
  const visibleDoneCount = visibleDoneBuckets.reduce((sum, bucket) => sum + bucket.items.length, 0);

  // Raw counts for time cards
  const allBuckets = useMemo(() => groupOpenTasks(rawActivities), [rawActivities]);
  const overdueCount = allBuckets.find((b) => b.id === "overdue")?.items.length ?? 0;
  const todayCount = allBuckets.find((b) => b.id === "today")?.items.length ?? 0;
  const laterCount = allBuckets.find((b) => b.id === "later")?.items.length ?? 0;
  const noneCount = allBuckets.find((b) => b.id === "none")?.items.length ?? 0;
  const doneCount = rawDoneActivities.length;

  const allDoneBuckets = useMemo(() => groupDoneTasks(rawDoneActivities), [rawDoneActivities]);
  const doneTodayCount = allDoneBuckets.find((b) => b.id === "done_today")?.items.length ?? 0;

  if (!canManage) {
    return <CrmDenied title="Seguimientos" icon={<FolderKanban className="h-5 w-5" />} />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Seguimientos Comerciales"
        icon={<FolderKanban className="h-5 w-5" />}
        subtitle="Compromisos, llamadas, reuniones y tareas del equipo de ventas."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9" onClick={() => setCategoryOpen(true)}>
              <Tags className="h-4 w-4" />
              Categorías
            </Button>
            <Button className="h-9" onClick={() => setActionModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva acción
            </Button>
          </div>
        }
      />

      <PageBody className="gap-4">
        {/* Navigation Tabs */}
        <CrmNav
          followUpsCount={rawActivities.length}
          className="glass rounded-2xl p-1.5"
        />

        {/* Priority Time Buckets */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <button
            type="button"
            onClick={() => {
              setStatusFilter("open");
              setTimeFilter(timeFilter === "overdue" ? "all" : "overdue");
            }}
            className={cn(
              "flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all",
              overdueCount > 0
                ? "border-destructive/30 bg-destructive/5 hover:border-destructive/60"
                : "border-border bg-card",
              statusFilter === "open" && timeFilter === "overdue" && "ring-2 ring-destructive/50",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-destructive">Vencidas</span>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{overdueCount}</p>
            <span className="text-[11px] text-muted-foreground">Requieren atención urgente</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("open");
              setTimeFilter(timeFilter === "today" ? "all" : "today");
            }}
            className={cn(
              "flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all",
              todayCount > 0
                ? "border-primary/40 bg-primary/5 hover:border-primary/70"
                : "border-border bg-card",
              statusFilter === "open" && timeFilter === "today" && "ring-2 ring-primary/50",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary">Para Hoy</span>
              <CalendarCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{todayCount}</p>
            <span className="text-[11px] text-muted-foreground">Compromisos de la jornada</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("open");
              setTimeFilter(timeFilter === "later" ? "all" : "later");
            }}
            className={cn(
              "flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 text-left transition-all hover:border-border/80",
              statusFilter === "open" && timeFilter === "later" && "ring-2 ring-primary/40",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Próximas</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{laterCount}</p>
            <span className="text-[11px] text-muted-foreground">Programadas a futuro</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("open");
              setTimeFilter(timeFilter === "none" ? "all" : "none");
            }}
            className={cn(
              "flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 text-left transition-all hover:border-border/80",
              statusFilter === "open" && timeFilter === "none" && "ring-2 ring-primary/40",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Sin fecha fija</span>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{noneCount}</p>
            <span className="text-[11px] text-muted-foreground">Tareas pendientes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "completed" ? "open" : "completed");
            }}
            className={cn(
              "flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all col-span-2 sm:col-span-1",
              doneCount > 0
                ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60"
                : "border-border bg-card",
              statusFilter === "completed" && "ring-2 ring-emerald-500/50 border-emerald-500/60 bg-emerald-500/10",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Completadas</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{doneCount}</p>
            <span className="text-[11px] text-muted-foreground">Historial de acciones</span>
          </button>
        </div>

        {/* Minimal Single-Row Toolbar */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Status Switcher: Pendientes / Completadas */}
            <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/50 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter("open")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                  statusFilter === "open"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Pendientes
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono font-bold">
                  {rawActivities.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                  statusFilter === "completed"
                    ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Completadas
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                  {doneCount}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-48 sm:w-60 shrink-0">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={statusFilter === "open" ? "Buscar por cliente o acción…" : "Buscar completadas por cliente…"}
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

            {/* Category Select */}
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              containerClassName="w-36 shrink-0"
              className="text-xs h-8 rounded-xl"
            >
              <option value="all">Categoría: Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            {/* Activity Type Select */}
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as OpportunityActivityType | "all")}
              containerClassName="w-36 shrink-0"
              className="text-xs h-8 rounded-xl"
            >
              <option value="all">Acción: Todas</option>
              {FOLLOW_UP_ACTIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {activityTypeLabel(opt.value)}
                </option>
              ))}
            </Select>

            {/* Quick Time Bucket Pills (desktop/tablet) */}
            {statusFilter === "open" ? (
              <div className="hidden md:flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl border border-border/50 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setTimeFilter("all")}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all",
                    timeFilter === "all"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter("overdue")}
                  className={cn(
                    "px-2 py-0.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                    timeFilter === "overdue"
                      ? "bg-background text-destructive shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Vencidas
                  {overdueCount > 0 && (
                    <span className="text-[10px] px-1 rounded-full bg-destructive/15 text-destructive font-mono font-bold">
                      {overdueCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter("today")}
                  className={cn(
                    "px-2 py-0.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                    timeFilter === "today"
                      ? "bg-background text-amber-500 shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Hoy
                  {todayCount > 0 && (
                    <span className="text-[10px] px-1 rounded-full bg-amber-500/15 text-amber-600 font-mono font-bold">
                      {todayCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter("later")}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all",
                    timeFilter === "later"
                      ? "bg-background text-primary shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Próximas
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl border border-border/50 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setDoneTimeFilter("all")}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all",
                    doneTimeFilter === "all"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setDoneTimeFilter("done_today")}
                  className={cn(
                    "px-2 py-0.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                    doneTimeFilter === "done_today"
                      ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Hoy
                  {doneTodayCount > 0 && (
                    <span className="text-[10px] px-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      {doneTodayCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDoneTimeFilter("done_week")}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all",
                    doneTimeFilter === "done_week"
                      ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Esta semana
                </button>
                <button
                  type="button"
                  onClick={() => setDoneTimeFilter("done_older")}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all",
                    doneTimeFilter === "done_older"
                      ? "bg-background text-muted-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Anteriores
                </button>
              </div>
            )}

            {/* Clear filters shortcut */}
            {(search ||
              categoryFilter !== "all" ||
              typeFilter !== "all" ||
              (statusFilter === "open" ? timeFilter !== "all" : doneTimeFilter !== "all")) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("all");
                  setTypeFilter("all");
                  setTimeFilter("all");
                  setDoneTimeFilter("all");
                }}
                className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Activities List / Board */}
        {statusFilter === "open" ? (
          openQuery.isError ? (
            <EmptyState
              icon={AlertCircle}
              title="Error al cargar seguimientos"
              description="Hubo un problema al consultar las tareas y compromisos. Verificá tu conexión o reintentá."
              action={
                <Button size="sm" onClick={() => openQuery.refetch()}>
                  Reintentar
                </Button>
              }
            />
          ) : openQuery.isLoading || clientMapQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
          ) : visibleCount === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Al día en seguimientos"
              description="No hay acciones pendientes con estos filtros. Planificá una nueva llamada o tarea."
              action={
                <Button size="sm" onClick={() => setActionModalOpen(true)}>
                  Planificar acción
                </Button>
              }
            />
          ) : (
            <div
              className={cn(
                "grid gap-4 transition-opacity duration-300",
                openQuery.isFetching ? "opacity-60" : "opacity-100",
                timeFilter === "all" ? "xl:grid-cols-4" : "grid-cols-1",
              )}
            >
              {visibleBuckets.map((bucket) =>
                bucket.items.length === 0 && timeFilter !== "all" ? null : (
                  <section key={bucket.id} className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
                      <h2 className="text-sm font-semibold">{bucket.label}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.2 text-[11px] font-semibold text-muted-foreground tabular-nums">
                        {bucket.items.length}
                      </span>
                    </div>

                    {bucket.items.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
                        Nada pendiente acá
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {bucket.items.map((item) => {
                          const ref = clientMap[item.opportunity];
                          return (
                            <PlanningCard
                              key={item.id}
                              activity={item}
                              clientName={ref?.clientName}
                              clientHref={ref?.href}
                              onComplete={(id) => complete.mutate(id)}
                              completing={complete.isPending}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>
                ),
              )}
            </div>
          )
        ) : (
          /* statusFilter === "completed" */
          doneQuery.isError ? (
            <EmptyState
              icon={AlertCircle}
              title="Error al cargar actividades completadas"
              description="Hubo un problema al consultar el historial de actividades. Verificá tu conexión o reintentá."
              action={
                <Button size="sm" onClick={() => doneQuery.refetch()}>
                  Reintentar
                </Button>
              }
            />
          ) : doneQuery.isLoading || clientMapQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
          ) : visibleDoneCount === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Sin acciones completadas"
              description={
                search ||
                categoryFilter !== "all" ||
                typeFilter !== "all" ||
                doneTimeFilter !== "all"
                  ? "No hay actividades completadas que coincidan con los filtros aplicados."
                  : "Aún no se han completado actividades de seguimiento comercial."
              }
              action={
                <Button size="sm" variant="outline" onClick={() => setStatusFilter("open")}>
                  Ver pendientes
                </Button>
              }
            />
          ) : (
            <div
              className={cn(
                "grid gap-4 transition-opacity duration-300",
                doneQuery.isFetching ? "opacity-60" : "opacity-100",
                doneTimeFilter === "all" ? "xl:grid-cols-3" : "grid-cols-1",
              )}
            >
              {visibleDoneBuckets.map((bucket) =>
                bucket.items.length === 0 && doneTimeFilter !== "all" ? null : (
                  <section key={bucket.id} className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <h2 className="text-sm font-semibold">{bucket.label}</h2>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {bucket.items.length}
                      </span>
                    </div>

                    {bucket.items.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
                        Sin actividades completadas en este período
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {bucket.items.map((item) => {
                          const ref = clientMap[item.opportunity];
                          return (
                            <PlanningCard
                              key={item.id}
                              activity={item}
                              clientName={ref?.clientName}
                              clientHref={ref?.href}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>
                ),
              )}
            </div>
          )
        )}

        {statusFilter === "open" ? (
          <LoadMoreFooter
            showing={rawActivities.length}
            total={openQuery.data?.count ?? 0}
            isLoading={openQuery.isFetching}
            onLoadMore={() => setOpenPageSize((n) => Math.min(n + 100, 1000))}
            label="acciones pendientes"
          />
        ) : (
          <LoadMoreFooter
            showing={rawDoneActivities.length}
            total={doneQuery.data?.count ?? 0}
            isLoading={doneQuery.isFetching}
            onLoadMore={() => setDonePageSize((n) => Math.min(n + 100, 1000))}
            label="acciones completadas"
          />
        )}
      </PageBody>

      {/* Modal: Planificar Acción */}
      <AnimatedOverlay
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
          <h2 className="text-base font-semibold">Planificar Acción Comercial</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Agendá una llamada, visita, cotización o recordatorio para un cliente o un prospecto.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Para quién *</label>
              <div className="mt-1 flex overflow-hidden rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTargetKind("client");
                    setLeadId("");
                  }}
                  className={cn(
                    "flex-1 px-3 py-1.5 font-medium transition-colors",
                    targetKind === "client"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  Cliente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetKind("prospect");
                    setClientId("");
                  }}
                  className={cn(
                    "flex-1 border-l border-border px-3 py-1.5 font-medium transition-colors",
                    targetKind === "prospect"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  Prospecto
                </button>
              </div>
              <div className="mt-2">
                {targetKind === "client" ? (
                  <SearchableSelect
                    placeholder="Buscar cliente…"
                    searchPlaceholder="Nombre o RUT…"
                    options={(clientsQuery.data ?? []).map((c) => ({
                      value: String(c.id),
                      label: c.name || `Cliente #${c.id}`,
                    }))}
                    value={clientId}
                    onChange={setClientId}
                    onQueryChange={setClientQuery}
                    loading={clientsQuery.isFetching}
                  />
                ) : (
                  <SearchableSelect
                    placeholder="Buscar prospecto…"
                    searchPlaceholder="Nombre, empresa o teléfono…"
                    options={(leadsQuery.data?.results ?? [])
                      .filter(
                        (l) =>
                          l.status !== "CONVERTED" &&
                          l.status !== "LOST" &&
                          l.status !== "ARCHIVED",
                      )
                      .map((l) => ({
                        value: l.id,
                        label: leadDisplayName(l) || `Prospecto`,
                      }))}
                    value={leadId}
                    onChange={setLeadId}
                    onQueryChange={setLeadQuery}
                    loading={leadsQuery.isFetching}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo de acción</label>
                <div className="mt-1">
                  <ActionTypePicker value={activityType} onChange={setActivityType} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Programar para</label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="mt-1 text-xs"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setScheduledAt(getPresetDate("today_pm"))}
                    className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Hoy tarde
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduledAt(getPresetDate("tomorrow"))}
                    className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Mañana 10:00
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduledAt(getPresetDate("in_2_days"))}
                    className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    En 2 días
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduledAt(getPresetDate("next_week"))}
                    className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Próx. lunes
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Categoría comercial</label>
              <div className="mt-1">
                {categoriesQuery.isLoading ? (
                  <Skeleton className="h-7 w-48 rounded-full" />
                ) : (
                  <CategoryPicker
                    categories={categories}
                    value={categoryId}
                    onChange={setCategoryId}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Descripción del compromiso *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Ej. Llamar para confirmar recepción de cotización de hornos…"
                className="mt-1 w-full resize-none rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="mt-2 flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={() => setActionModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={
                  !(targetKind === "prospect" ? leadId : clientId) ||
                  !description.trim() ||
                  createTask.isPending
                }
                isLoading={createTask.isPending}
                onClick={() => createTask.mutate()}
              >
                Planificar
              </Button>
            </div>
          </div>
        </div>
      </AnimatedOverlay>

      {/* Modal: Categorías de Gestión */}
      <AnimatedOverlay
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
          <h2 className="text-base font-semibold">Categorías de Seguimiento</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Clasificá llamadas de cobranza, postventa, cotizaciones o reactivación.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Nombre, ej. Cobranza semanal"
            />
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => setCategoryColor(color)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform",
                    categoryColor === color && "ring-2 ring-foreground ring-offset-2 scale-110",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!categoryName.trim() || saveCategory.isPending}
                isLoading={saveCategory.isPending}
                onClick={() => saveCategory.mutate()}
              >
                <Plus className="h-3.5 w-3.5" />
                Crear categoría
              </Button>
            </div>

            <ul className="mt-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto border-t border-border pt-2">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between rounded-xl border border-border p-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: category.color || "#1890ff" }}
                    />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-destructive hover:bg-destructive/10"
                    disabled={removeCategory.isPending}
                    onClick={() => removeCategory.mutate(category.id)}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </AnimatedOverlay>
    </PageShell>
  );
}


function groupOpenTasks(items: FollowUpActivity[]) {
  const overdue: FollowUpActivity[] = [];
  const today: FollowUpActivity[] = [];
  const later: FollowUpActivity[] = [];
  const none: FollowUpActivity[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const byTime = (a: FollowUpActivity, b: FollowUpActivity) =>
    String(a.scheduled_at ?? a.created).localeCompare(String(b.scheduled_at ?? b.created));
  for (const item of items) {
    if (!item.scheduled_at) {
      none.push(item);
      continue;
    }
    const when = new Date(item.scheduled_at);
    if (Number.isNaN(when.getTime()) || when < start) overdue.push(item);
    else if (when < end) today.push(item);
    else later.push(item);
  }
  overdue.sort(byTime);
  today.sort(byTime);
  later.sort(byTime);
  return [
    { id: "overdue" as const, label: "Vencidas", items: overdue },
    { id: "today" as const, label: "Hoy", items: today },
    { id: "later" as const, label: "Programadas", items: later },
    { id: "none" as const, label: "Sin fecha", items: none },
  ];
}

function groupDoneTasks(items: FollowUpActivity[]) {
  const today: FollowUpActivity[] = [];
  const thisWeek: FollowUpActivity[] = [];
  const older: FollowUpActivity[] = [];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(startOfToday);
  const day = startOfWeek.getDay();
  // Monday as start of week: day 0 is Sunday -> 6 days back, 1 is Monday -> 0 days back
  const diffToMonday = (day + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

  const byCompletedDateDesc = (a: FollowUpActivity, b: FollowUpActivity) =>
    String(b.completed_at ?? b.modified ?? b.created).localeCompare(
      String(a.completed_at ?? a.modified ?? a.created),
    );

  for (const item of items) {
    const rawDate = item.completed_at ?? item.modified ?? item.created;
    const when = rawDate ? new Date(rawDate) : null;
    if (!when || Number.isNaN(when.getTime())) {
      older.push(item);
    } else if (when >= startOfToday) {
      today.push(item);
    } else if (when >= startOfWeek) {
      thisWeek.push(item);
    } else {
      older.push(item);
    }
  }

  today.sort(byCompletedDateDesc);
  thisWeek.sort(byCompletedDateDesc);
  older.sort(byCompletedDateDesc);

  return [
    { id: "done_today" as const, label: "Completadas Hoy", items: today },
    { id: "done_week" as const, label: "Esta Semana", items: thisWeek },
    { id: "done_older" as const, label: "Anteriores", items: older },
  ];
}
