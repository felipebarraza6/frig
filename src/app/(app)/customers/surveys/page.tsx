"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  Globe,
  HardDrive,
  HelpCircle,
  Info,
  Layers,
  Link2,
  List,
  MessageSquare,
  Paperclip,
  Pause,
  Play,
  Plus,
  Search,
  Star,
  ToggleLeft,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageBody, PageShell } from "@/components/page-shell";
import { CrmDenied } from "@/components/customers/crm-denied";
import { CrmNav } from "@/components/customers/crm-nav";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadMoreFooter } from "@/components/ui/load-more";
import { StatCard } from "@/components/ui/stat-card";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { SurveyFillForm } from "@/components/surveys/survey-fill-form";
import {
  activateSurvey,
  createSurvey,
  createSurveyFromTemplate,
  csatTemplateQuestions,
  customTemplateQuestions,
  deleteCustomTemplate,
  deleteSurvey,
  fetchGlobalNpsSummary,
  fetchSurvey,
  fetchSurveyNpsSummary,
  fetchSurveyResponsePage,
  fetchSurveys,
  getAllTemplates,
  getStoredCustomTemplates,
  npsTemplateQuestions,
  parseSurveyQuestions,
  pauseSurvey,
  publicSurveyAbsoluteUrl,
  saveCustomTemplate,
  surveyFillAbsoluteUrl,
  surveyFillPath,
  surveyStatusLabel,
  surveyTypeLabel,
  updateSurvey,
  type CustomSurveyTemplate,
  type SurveyList,
  type SurveyQuestion,
  type SurveyType,
} from "@/lib/api/surveys";
import { useCanManageCustomers } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

export default function CustomerSurveysPage() {
  const canManage = useCanManageCustomers();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [section, setSection] = useState<"surveys" | "templates">("surveys");

  // State for survey creation / editing
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [title, setTitle] = useState("Nueva Encuesta");
  const [description, setDescription] = useState("");
  const [surveyType, setSurveyType] = useState<SurveyType>("CUSTOM");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    { id: "q_1", type: "text", label: "¿Cómo fue tu experiencia?", required: false },
  ]);
  const [saveAsTemplateChecked, setSaveAsTemplateChecked] = useState(false);
  const [modalTab, setModalTab] = useState<"edit" | "preview">("edit");

  const [npsFor, setNpsFor] = useState<string | null>(null);
  const [questionsFor, setQuestionsFor] = useState<string | null>(null);
  const [openSurveyId, setOpenSurveyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showGuide, setShowGuide] = useState(true);

  // "Cargar más" incremental: sin truncado silencioso de page_size fijo.
  const [listPageSize, setListPageSize] = useState(50);

  const listQuery = useQuery({
    queryKey: ["surveys", "list", listPageSize],
    queryFn: () => fetchSurveys({ page_size: listPageSize }),
    enabled: canManage,
  });

  const globalNpsQuery = useQuery({
    queryKey: ["surveys", "nps-global"],
    queryFn: fetchGlobalNpsSummary,
    enabled: canManage,
  });

  const detailNpsQuery = useQuery({
    queryKey: ["surveys", "nps", npsFor],
    queryFn: () => fetchSurveyNpsSummary(npsFor!),
    enabled: Boolean(npsFor),
  });

  const surveys = useMemo(
    () => listQuery.data?.results ?? [],
    [listQuery.data?.results],
  );

  const activeSurveysCount = useMemo(
    () => surveys.filter((s) => s.status === "ACTIVE").length,
    [surveys],
  );

  const customTemplatesCount = useMemo(
    () => (typeof window !== "undefined" ? getAllTemplates().length : 0),
    [section, createOpen],
  );

  function applyFormat(kind: SurveyType) {
    setSurveyType(kind);
    if (kind === "CSAT") setQuestions(csatTemplateQuestions());
    else if (kind === "NPS") setQuestions(npsTemplateQuestions());
    else
      setQuestions([
        { id: `q_${Date.now()}_1`, type: "text", label: "¿Cómo fue tu experiencia?", required: false },
      ]);
  }

  function openCreate(kind: SurveyType = "CUSTOM", initialQuestions?: SurveyQuestion[], initialTitle?: string) {
    setEditingSurveyId(null);
    setSurveyType(kind);
    setTitle(initialTitle || (kind === "CSAT" ? "Nota de la visita" : kind === "NPS" ? "Después de tu visita" : "Nueva Encuesta"));
    setDescription("");
    setSaveAsTemplateChecked(false);
    setModalTab("edit");

    if (initialQuestions) {
      setQuestions(initialQuestions);
    } else {
      applyFormat(kind);
    }
    setCreateOpen(true);
  }

  async function openEdit(survey: SurveyList) {
    let detail: {
      title?: string;
      description?: string | null;
      survey_type?: SurveyType;
      questions?: unknown;
      is_anonymous?: boolean;
      allow_multiple_responses?: boolean;
    } = survey;
    if (!survey.questions) {
      try {
        detail = await fetchSurvey(survey.id);
      } catch {
        // fallback
      }
    }
    setEditingSurveyId(survey.id);
    setTitle(detail.title || "Encuesta");
    setDescription(detail.description || "");
    setSurveyType(detail.survey_type || "CUSTOM");
    setQuestions(parseSurveyQuestions(detail.questions));
    setSaveAsTemplateChecked(false);
    setModalTab("edit");
    setCreateOpen(true);
  }

  const saveSurveyMutation = useMutation({
    mutationFn: async () => {
      const ready = normalizeQuestions(questions);
      if (ready.length === 0) {
        throw new Error("Agregá al menos una pregunta válida con texto");
      }

      if (saveAsTemplateChecked && title.trim()) {
        saveCustomTemplate({
          name: title.trim(),
          description: description.trim() || undefined,
          survey_type: surveyType,
          questions: ready,
        });
      }

      if (editingSurveyId) {
        return updateSurvey(editingSurveyId, {
          title: title.trim() || "Encuesta",
          description: description.trim() || undefined,
          survey_type: surveyType,
          questions: ready,
        });
      } else {
        return createSurvey({
          ...createSurveyFromTemplate({
            title: title.trim() || "Nueva encuesta",
            survey_type: surveyType,
            description: description.trim() || undefined,
          }),
          questions: ready,
        });
      }
    },
    onSuccess: () => {
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(editingSurveyId ? "Encuesta actualizada" : "Encuesta creada y activa");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la encuesta"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (survey: SurveyList) => {
      let detail: {
      title?: string;
      description?: string | null;
      survey_type?: SurveyType;
      questions?: unknown;
      is_anonymous?: boolean;
      allow_multiple_responses?: boolean;
    } = survey;
      if (!survey.questions) {
        detail = await fetchSurvey(survey.id);
      }
      const qs = parseSurveyQuestions(detail.questions);
      return createSurvey({
        title: `${detail.title} (Copia)`,
        description: detail.description || "",
        survey_type: detail.survey_type || "CUSTOM",
        questions: qs,
        status: "ACTIVE",
        is_anonymous: detail.is_anonymous ?? true,
        allow_multiple_responses: detail.allow_multiple_responses ?? true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Encuesta duplicada correctamente");
    },
    onError: () => toast.error("No se pudo duplicar la encuesta"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Encuesta eliminada");
    },
    onError: () => toast.error("No se pudo eliminar la encuesta"),
  });

  const toggle = useMutation({
    mutationFn: async (survey: SurveyList) => {
      if (survey.status === "ACTIVE") return pauseSurvey(survey.id);
      return activateSurvey(survey.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["surveys"] }),
    onError: () => toast.error("No se pudo cambiar el estado"),
  });

  async function copyInternalLink(surveyId: string) {
    try {
      await navigator.clipboard.writeText(surveyFillAbsoluteUrl(surveyId));
      toast.success("Link interno copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function copyPublicLink(slug: string) {
    try {
      await navigator.clipboard.writeText(publicSurveyAbsoluteUrl(slug));
      toast.success("Link público copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  function openPublic(slug: string) {
    window.open(publicSurveyAbsoluteUrl(slug), "_blank", "noopener,noreferrer");
  }

  async function handleSaveAsTemplate(survey: SurveyList) {
    let detail: {
      title?: string;
      description?: string | null;
      survey_type?: SurveyType;
      questions?: unknown;
      is_anonymous?: boolean;
      allow_multiple_responses?: boolean;
    } = survey;
    if (!survey.questions) {
      try {
        detail = await fetchSurvey(survey.id);
      } catch {
        // fallback
      }
    }
    const qs = parseSurveyQuestions(detail.questions);
    saveCustomTemplate({
      name: detail.title || "Plantilla de Encuesta",
      description: detail.description || undefined,
      survey_type: detail.survey_type || "CUSTOM",
      questions: qs,
    });
    toast.success(`Encuesta "${detail.title || "Plantilla"}" guardada en Mis Plantillas`);
  }

  const filteredSurveys = useMemo(() => {
    return surveys.filter((s) => {
      if (typeFilter !== "all" && s.survey_type !== typeFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (s.title ?? "").toLowerCase().includes(q) ||
          (s.slug ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [surveys, typeFilter, statusFilter, search]);

  const globalNps = globalNpsQuery.data;
  const npsScore = globalNps?.nps_score;
  const totalResponses = globalNps?.total_responses ?? 0;
  const promoters = globalNps?.promoters ?? 0;
  const detractors = globalNps?.detractors ?? 0;
  const passives = Math.max(0, totalResponses - promoters - detractors);

  if (!canManage) {
    return (
      <CrmDenied title="Encuestas" icon={<ClipboardList className="h-5 w-5" />} />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Encuestas y Formularios"
        icon={<ClipboardList className="h-5 w-5" />}
        subtitle="Diseñá encuestas 100% personalizadas, gestioná tus plantillas y medí la satisfacción de tus clientes."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-xs"
              onClick={() => setSection(section === "surveys" ? "templates" : "surveys")}
            >
              <Bookmark className="h-4 w-4" />
              {section === "surveys" ? "Plantillas" : "Ver Encuestas"}
            </Button>
            <Button className="h-9 gap-1.5 text-xs" onClick={() => openCreate("CUSTOM")}>
              <Plus className="h-4 w-4" />
              Nueva Encuesta
            </Button>
          </div>
        }
      />

      <PageBody className="gap-4">
        {/* CRM Nav */}
        <CrmNav className="glass rounded-2xl p-1.5" />

        {/* Section Switcher Tabs */}
        <div className="flex items-center justify-between border-b border-border pb-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSection("surveys")}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 pb-2 pt-1 text-xs font-semibold transition-colors",
                section === "surveys"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <ClipboardList className="h-4 w-4" />
              Encuestas y Formularios
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums font-medium text-foreground">
                {surveys.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSection("templates")}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 pb-2 pt-1 text-xs font-semibold transition-colors",
                section === "templates"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Bookmark className="h-4 w-4" />
              Plantillas
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] tabular-nums font-medium text-primary">
                {customTemplatesCount}
              </span>
            </button>
          </div>
        </div>

        {section === "templates" ? (
          <CustomTemplatesSection
            onUseTemplate={(tmpl) => {
              setSection("surveys");
              openCreate(tmpl.survey_type, tmpl.questions, tmpl.name);
            }}
          />
        ) : (
          <>
            {/* KPI Bar */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard
                variant="compact"
                label="Puntaje de Recomendación (NPS)"
                value={
                  npsScore != null
                    ? `${npsScore > 0 ? "+" : ""}${npsScore}`
                    : "—"
                }
                sub={
                  npsScore != null
                    ? npsScore >= 50
                      ? "Nivel Excelente (Recomendación alta)"
                      : npsScore >= 0
                        ? "Satisfacción Positiva"
                        : "Requiere Atención"
                    : "Net Promoter Score (% Promotores - % Detractores)"
                }
                icon={Star}
                tone={
                  npsScore != null && npsScore >= 50
                    ? "success"
                    : npsScore != null && npsScore < 0
                      ? "danger"
                      : "primary"
                }
              />
              <StatCard
                variant="compact"
                label="Clasificación de Clientes (NPS)"
                value={`${promoters} Promotores (9-10)`}
                sub={`${passives} neutros (7-8) · ${detractors} detractores (0-6)`}
                icon={CheckCircle2}
                tone={promoters >= detractors ? "success" : "warning"}
              />
              <StatCard
                variant="compact"
                label="Total Respuestas"
                value={totalResponses}
                sub="Evaluaciones recibidas"
                icon={MessageSquare}
                tone="muted"
              />
              <StatCard
                variant="compact"
                label="Encuestas Activas"
                value={`${activeSurveysCount} / ${surveys.length}`}
                sub="Instrumentos en línea"
                icon={ClipboardList}
                tone="primary"
              />
            </div>

            {/* Guía Explicativa: ¿Qué significan NPS y CSAT? */}
            <div className="rounded-xl border border-border bg-card p-3 sm:p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowGuide((prev) => !prev)}
                  className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary transition-colors text-left"
                >
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>¿Qué significan los indicadores NPS y CSAT? (Guía de lectura)</span>
                  {showGuide ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuide((prev) => !prev)}
                  className="text-[11px] font-medium text-primary hover:underline shrink-0"
                >
                  {showGuide ? "Ocultar guía" : "Explicar siglas"}
                </button>
              </div>

              {showGuide && (
                <div className="mt-3.5 grid gap-3 border-t border-border pt-3.5 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 font-bold text-[11px]">
                        NPS
                      </span>
                      <h4 className="font-bold text-foreground">NPS (Net Promoter Score / Lealtad del Cliente)</h4>
                    </div>
                    <p className="mt-1.5 text-muted-foreground leading-relaxed text-[11px]">
                      Mide qué tan probable es que un cliente recomiende tu empresa o servicio a un amigo o colega (escala de 0 a 10).
                    </p>
                    <ul className="mt-2 space-y-1.5 text-[11px]">
                      <li className="flex items-start gap-1.5">
                        <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <span><strong>Promotores (9 a 10):</strong> Clientes entusiastas y leales que promueven tu marca.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-1 h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                        <span><strong>Pasivos / Neutros (7 a 8):</strong> Clientes satisfechos pero neutrales.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-1 h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                        <span><strong>Detractores (0 a 6):</strong> Clientes insatisfechos.</span>
                      </li>
                    </ul>
                    <p className="mt-2 text-[10px] italic text-muted-foreground border-t border-border pt-1">
                      Nota de recomendación = % Promotores (9-10) menos % Detractores (0-6).
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 font-bold text-[11px]">
                        CSAT
                      </span>
                      <h4 className="font-bold text-foreground">CSAT (Customer Satisfaction / Nota de Atención)</h4>
                    </div>
                    <p className="mt-1.5 text-muted-foreground leading-relaxed text-[11px]">
                      Mide la satisfacción inmediata del cliente sobre una visita, atención puntual o servicio recibido (escala de 1 a 5 estrellas).
                    </p>
                    <ul className="mt-2 space-y-1.5 text-[11px]">
                      <li className="flex items-start gap-1.5">
                        <Star className="mt-0.5 h-3 w-3 text-amber-500 shrink-0 fill-amber-500" />
                        <span><strong>1 a 5 Estrellas:</strong> Calificación directa de la experiencia del cliente.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                        <span><strong>Interpretación:</strong> Muestra la calidad percibida tras ser atendido.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="relative w-52 sm:w-64 shrink-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por título..."
                    className="h-8 pl-8 pr-7 text-xs"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTypeFilter("all")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      typeFilter === "all"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Todas ({surveys.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFilter("CUSTOM")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      typeFilter === "CUSTOM"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Personalizada
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFilter("NPS")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      typeFilter === "NPS"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    NPS (Recomendación 0-10)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFilter("CSAT")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      typeFilter === "CSAT"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    CSAT (Satisfacción 1-5)
                  </button>
                </div>

                <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      statusFilter === "all"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Estado: Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ACTIVE")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      statusFilter === "ACTIVE"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Activas
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("PAUSED")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      statusFilter === "PAUSED"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Pausadas
                  </button>
                </div>
              </div>

              {(search || typeFilter !== "all" || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Restablecer
                </Button>
              )}
            </div>

            {listQuery.isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : surveys.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <ClipboardList className="h-6 w-6" />
                </span>
                <p className="mt-3 text-sm font-medium">Todavía no hay encuestas creadas</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Crea tu primera encuesta para recibir opiniones, datos o evaluar la satisfacción de tus clientes.
                </p>
                <Button className="mt-4" size="sm" onClick={() => openCreate("CUSTOM")}>
                  Crear Encuesta
                </Button>
              </div>
            ) : openSurveyId && surveys.some((survey) => survey.id === openSurveyId) ? (
              <SurveyWorkspace
                survey={surveys.find((survey) => survey.id === openSurveyId)!}
                onBack={() => {
                  setOpenSurveyId(null);
                  setQuestionsFor(null);
                }}
                questionsOpen={questionsFor === openSurveyId}
                onToggleQuestions={() =>
                  setQuestionsFor((current) => (current === openSurveyId ? null : openSurveyId))
                }
                onOpenPublic={openPublic}
                onCopyPublic={copyPublicLink}
                onToggle={toggle.mutate}
                toggling={toggle.isPending}
              />
            ) : filteredSurveys.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No se encontraron encuestas</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No hay encuestas que coincidan con los filtros aplicados.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <SurveySection
                items={filteredSurveys}
                onOpenPublic={openPublic}
                onCopyPublic={copyPublicLink}
                onCopyInternal={copyInternalLink}
                onToggle={toggle.mutate}
                toggling={toggle.isPending}
                onEdit={openEdit}
                onDuplicate={(s) => duplicateMutation.mutate(s)}
                onSaveAsTemplate={handleSaveAsTemplate}
                onDelete={(s) => deleteMutation.mutate(s.id)}
                questionsFor={questionsFor}
                onToggleQuestions={setQuestionsFor}
                onOpen={setOpenSurveyId}
              />
            )}
          </>
        )}

        <LoadMoreFooter
          showing={filteredSurveys.length}
          total={listQuery.data?.count ?? 0}
          isLoading={listQuery.isFetching}
          onLoadMore={() => setListPageSize((n) => Math.min(n + 50, 500))}
          label="encuestas"
        />
      </PageBody>

      {/* Creation & Editing Modal with Live Preview */}
      <AnimatedOverlay
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-border bg-background p-4 shadow-lg sm:max-w-xl sm:rounded-xl sm:p-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {editingSurveyId ? "Editar Encuesta" : "Nueva Encuesta"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Diseñá tu encuesta libremente o usá una plantilla.
              </p>
            </div>

            {/* Modal Tabs: Edit vs Live Preview */}
            <div className="flex items-center rounded-lg border border-border bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setModalTab("edit")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  modalTab === "edit" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Edit2 className="h-3 w-3" />
                Diseñador
              </button>
              <button
                type="button"
                onClick={() => setModalTab("preview")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  modalTab === "preview" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Eye className="h-3 w-3" />
                Vista Previa
              </button>
            </div>
          </div>

          {modalTab === "edit" ? (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="survey-title">
                  Título o Nombre de la Encuesta
                </label>
                <Input
                  id="survey-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Encuesta de Opinión o Satisfacción"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Descripción corta (opcional)
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Cuéntanos cómo fue tu experiencia..."
                  className="h-8 text-xs"
                />
              </div>

              {!editingSurveyId ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Plantilla inicial sugerida</span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => applyFormat("CUSTOM")}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left transition-all",
                        surveyType === "CUSTOM"
                          ? "border-primary bg-primary/10 font-medium text-primary shadow-xs"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span className="block text-xs font-medium">Libre / En blanco</span>
                      <span className="block text-[10px] opacity-75">100% personalizable</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat("NPS")}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left transition-all",
                        surveyType === "NPS"
                          ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span className="block text-xs font-medium">Recomendación (0-10)</span>
                      <span className="block text-[10px] opacity-75">¿Nos recomendarías?</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat("CSAT")}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left transition-all",
                        surveyType === "CSAT"
                          ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span className="block text-xs font-medium">Atención / Visita (1-5★)</span>
                      <span className="block text-[10px] opacity-75">Satisfacción puntual</span>
                    </button>
                  </div>
                </div>
              ) : null}

              <QuestionEditor questions={questions} onChange={setQuestions} />

              <div className="pt-2 border-t border-border">
                <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsTemplateChecked}
                    onChange={(e) => setSaveAsTemplateChecked(e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  <BookmarkPlus className="h-4 w-4 text-primary" />
                  Guardar también en &quot;Plantillas&quot; para usar en el futuro
                </label>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Así es exactamente como verá tu cliente la encuesta:
                </p>
                <SurveyFillForm
                  survey={{
                    id: "preview",
                    title: title || "Vista Previa de Encuesta",
                    description: description || "Encuesta de satisfacción",
                    survey_type: surveyType,
                    questions: normalizeQuestions(questions),
                    status: "ACTIVE",
                  }}
                  mode="public"
                  onSubmitted={() => toast.info("Modo previsualización: las respuestas no se guardan")}
                />
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              isLoading={saveSurveyMutation.isPending}
              disabled={!title.trim() || questions.length === 0 || questions.every((q) => !q.label.trim())}
              onClick={() => saveSurveyMutation.mutate()}
            >
              {editingSurveyId ? "Guardar Cambios" : "Crear Encuesta"}
            </Button>
          </div>
        </div>
      </AnimatedOverlay>
    </PageShell>
  );
}

function SurveySection({
  items,
  onOpenPublic,
  onCopyPublic,
  onCopyInternal,
  onToggle,
  toggling,
  onEdit,
  onDuplicate,
  onSaveAsTemplate,
  onDelete,
  questionsFor,
  onToggleQuestions,
  onOpen,
}: {
  items: SurveyList[];
  onOpenPublic: (slug: string) => void;
  onCopyPublic: (slug: string) => void;
  onCopyInternal: (id: string) => void;
  onToggle: (survey: SurveyList) => void;
  toggling: boolean;
  onEdit: (survey: SurveyList) => void;
  onDuplicate: (survey: SurveyList) => void;
  onSaveAsTemplate: (survey: SurveyList) => void;
  onDelete: (survey: SurveyList) => void;
  questionsFor: string | null;
  onToggleQuestions: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((survey) => (
        <SurveyCard
          key={survey.id}
          survey={survey}
          onOpen={() => onOpen(survey.id)}
          onOpenPublic={onOpenPublic}
          onCopyPublic={onCopyPublic}
          onCopyInternal={onCopyInternal}
          onToggle={() => onToggle(survey)}
          toggling={toggling}
          onEdit={() => onEdit(survey)}
          onDuplicate={() => onDuplicate(survey)}
          onSaveAsTemplate={() => onSaveAsTemplate(survey)}
          onDelete={() => onDelete(survey)}
          questionsOpen={questionsFor === survey.id}
          onToggleQuestions={() =>
            onToggleQuestions(questionsFor === survey.id ? null : survey.id)
          }
        />
      ))}
    </div>
  );
}

function SurveyCard({
  survey,
  onOpen,
  onOpenPublic,
  onCopyPublic,
  onCopyInternal,
  onToggle,
  toggling,
  onEdit,
  onDuplicate,
  onSaveAsTemplate,
  onDelete,
  questionsOpen,
  onToggleQuestions,
}: {
  survey: SurveyList;
  onOpen: () => void;
  onOpenPublic: (slug: string) => void;
  onCopyPublic: (slug: string) => void;
  onCopyInternal: (id: string) => void;
  onToggle: () => void;
  toggling: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onSaveAsTemplate: () => void;
  onDelete: () => void;
  questionsOpen: boolean;
  onToggleQuestions: () => void;
}) {
  const isNps = survey.survey_type === "NPS";

  return (
    <div className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isNps ? <Star className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onOpen}
                  className="truncate text-left text-sm font-semibold text-foreground transition-colors hover:underline group-hover:text-primary"
                >
                  {survey.title}
                </button>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    survey.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {surveyStatusLabel(survey.status)}
                </span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {surveyTypeLabel(survey.survey_type)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{survey.response_count ?? 0}</span>{" "}
                respuestas registradas
              </p>
            </div>
          </div>
        </div>

        {/* 1-Click Actions & ActionsMenu */}
        <div className="flex shrink-0 items-center gap-2">
          {survey.slug ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => onCopyPublic(survey.slug!)}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar Link
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => onOpenPublic(survey.slug!)}
              >
                <Globe className="h-3.5 w-3.5" />
                Abrir Web
              </Button>
            </>
          ) : null}

          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onOpen}
          >
            Ver Respuestas
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <ActionsMenu
            ariaLabel={`Acciones de ${survey.title}`}
            size="icon"
            className="h-8 w-8"
            items={[
              {
                label: "Editar Encuesta",
                icon: Edit2,
                onClick: onEdit,
              },
              {
                label: "Duplicar Encuesta",
                icon: Copy,
                onClick: onDuplicate,
              },
              {
                label: "Guardar como Plantilla",
                icon: BookmarkPlus,
                onClick: onSaveAsTemplate,
              },
              {
                label: "Abrir Ficha Interna",
                icon: ExternalLink,
                onClick: () => window.open(surveyFillPath(survey.id), "_blank"),
              },
              {
                label: "Copiar Link Interno",
                icon: Copy,
                onClick: () => onCopyInternal(survey.id),
              },
              {
                label: questionsOpen ? "Ocultar Preguntas" : "Ver / Editar Preguntas",
                icon: List,
                onClick: onToggleQuestions,
              },
              {
                label: survey.status === "ACTIVE" ? "Pausar Encuesta" : "Activar Encuesta",
                icon: survey.status === "ACTIVE" ? Pause : Play,
                onClick: onToggle,
              },
              {
                label: "Eliminar Encuesta",
                icon: Trash2,
                danger: true,
                onClick: () => {
                  const respuestas =
                    survey.response_count > 0
                      ? ` Se eliminarán también sus ${survey.response_count} ${survey.response_count === 1 ? "respuesta" : "respuestas"}.`
                      : "";
                  if (
                    window.confirm(
                      `¿Eliminar la encuesta "${survey.title}"?${respuestas} Esta acción no se puede deshacer.`,
                    )
                  ) {
                    onDelete();
                  }
                },
              },
            ]}
          />
        </div>
      </div>

      {questionsOpen && (
        <div className="mt-3 border-t border-border pt-3">
          <SurveyQuestionsPanel surveyId={survey.id} />
        </div>
      )}
    </div>
  );
}

function CustomTemplatesSection({
  onUseTemplate,
}: {
  onUseTemplate: (tmpl: CustomSurveyTemplate) => void;
}) {
  const [templates, setTemplates] = useState<CustomSurveyTemplate[]>(() => getAllTemplates());
  const [editingTemplate, setEditingTemplate] = useState<CustomSurveyTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  const reload = () => setTemplates(getAllTemplates());

  const handleDelete = (id: string, name: string) => {
    deleteCustomTemplate(id);
    reload();
    toast.success(`Plantilla "${name}" eliminada`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Plantillas Disponibles</h3>
          <p className="text-xs text-muted-foreground">
            Formatos predefinidos y plantillas guardadas para lanzar encuestas en 1-click.
          </p>
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <HardDrive className="h-3 w-3" />
            Tus plantillas se guardan en este dispositivo (no se sincronizan con el equipo)
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => {
            setEditingTemplate(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva Plantilla
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xs"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bookmark className="h-3.5 w-3.5" />
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      tmpl.is_system
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    {tmpl.is_system ? "Plantilla Sistema" : "Mi Plantilla"}
                  </span>
                </div>

                {!tmpl.is_system ? (
                  <div className="flex gap-1 opacity-80 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditingTemplate(tmpl);
                        setModalOpen(true);
                      }}
                      title="Editar plantilla"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(tmpl.id, tmpl.name)}
                      title="Eliminar plantilla"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>

              <h4 className="mt-2.5 text-sm font-semibold text-foreground">{tmpl.name}</h4>
              {tmpl.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{tmpl.description}</p>
              ) : null}

              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-0.5 font-medium">
                  {tmpl.questions.length} preguntas
                </span>
              </div>
            </div>

            <Button
              size="sm"
              className="mt-4 h-8 w-full gap-1.5 text-xs font-medium"
              onClick={() => onUseTemplate(tmpl)}
            >
              <Plus className="h-3.5 w-3.5" />
              Usar esta plantilla
            </Button>
          </div>
        ))}
      </div>

      {modalOpen && (
        <TemplateEditorModal
          template={editingTemplate}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            reload();
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function TemplateEditorModal({
  template,
  onClose,
  onSaved,
}: {
  template: CustomSurveyTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [questions, setQuestions] = useState<SurveyQuestion[]>(
    template?.questions ?? [
      { id: "q_1", type: "text", label: "¿Cómo estuvo el servicio?", required: false },
    ],
  );
  const toast = useToast();

  const handleSave = () => {
    if (!name.trim()) return;
    const ready = normalizeQuestions(questions);
    if (ready.length === 0) {
      toast.error("Agregá al menos una pregunta válida");
      return;
    }
    saveCustomTemplate({
      id: template?.id,
      name: name.trim(),
      description: description.trim(),
      survey_type: "CUSTOM",
      questions: ready,
    });
    toast.success(template ? "Plantilla actualizada" : "Plantilla guardada en Mis Plantillas");
    onSaved();
  };

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      zIndex="z-[75]"
      panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
    >
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-border bg-background p-4 shadow-lg sm:max-w-lg sm:rounded-xl sm:p-6">
        <h3 className="text-base font-semibold text-foreground">
          {template ? "Editar Plantilla" : "Nueva Plantilla Personalizada"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Diseñá un formato reusable para crear encuestas en 1-click.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Nombre de la plantilla</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Levantamiento Técnico de Instalación"
              className="h-9 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Descripción (opcional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Plantilla estándar para medir atención al cliente"
              className="h-8 text-xs"
            />
          </div>

          <QuestionEditor questions={questions} onChange={setQuestions} />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!name.trim() || questions.length === 0} onClick={handleSave}>
            Guardar Plantilla
          </Button>
        </div>
      </div>
    </AnimatedOverlay>
  );
}

function SurveyWorkspace({
  survey,
  onBack,
  questionsOpen,
  onToggleQuestions,
  onOpenPublic,
  onCopyPublic,
  onToggle,
  toggling,
}: {
  survey: SurveyList;
  onBack: () => void;
  questionsOpen: boolean;
  onToggleQuestions: () => void;
  onOpenPublic: (slug: string) => void;
  onCopyPublic: (slug: string) => void;
  onToggle: (survey: SurveyList) => void;
  toggling: boolean;
}) {
  const [tab, setTab] = useState<"responses" | "analytics" | "questions">("responses");
  const isNps = survey.survey_type === "NPS";

  return (
    <div className="flex flex-col gap-4">
      {/* Top breadcrumb navigation */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado de Encuestas
        </button>
      </div>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {isNps ? <Star className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-foreground sm:text-xl">
                    {survey.title}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      survey.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {surveyStatusLabel(survey.status)}
                  </span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {surveyTypeLabel(survey.survey_type)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {survey.response_count ?? 0} respuestas recibidas de clientes
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {survey.slug ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => onOpenPublic(survey.slug!)}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Abrir Web
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => onCopyPublic(survey.slug!)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar Link
                </Button>
              </>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={toggling}
              onClick={() => onToggle(survey)}
            >
              {survey.status === "ACTIVE" ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Activar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 3 Tabs Segmented Control */}
        <div className="mt-4 flex border-b border-border">
          <button
            type="button"
            onClick={() => setTab("responses")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-xs font-semibold transition-colors",
              tab === "responses"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Respuestas Recibidas
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground">
              {survey.response_count ?? 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("analytics")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-xs font-semibold transition-colors",
              tab === "analytics"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Resumen Visual
          </button>
          <button
            type="button"
            onClick={() => setTab("questions")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-xs font-semibold transition-colors",
              tab === "questions"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" />
            Preguntas y Configuración
          </button>
        </div>
      </div>

      {tab === "responses" && <SurveyAnswerSheet surveyId={survey.id} />}
      {tab === "analytics" && <SurveyAnalyticsSummary surveyId={survey.id} />}
      {tab === "questions" && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <SurveyQuestionsPanel surveyId={survey.id} />
        </div>
      )}
    </div>
  );
}

function SurveyAnalyticsSummary({ surveyId }: { surveyId: string }) {
  const detailQuery = useQuery({
    queryKey: ["surveys", "detail", surveyId],
    queryFn: () => fetchSurvey(surveyId),
  });
  const responsesQuery = useQuery({
    queryKey: ["surveys", "responses", "analytics", surveyId],
    queryFn: () => fetchSurveyResponsePage({ survey: surveyId, page_size: 1000 }),
  });

  const questions = parseSurveyQuestions(detailQuery.data?.questions);
  const responses = responsesQuery.data?.results ?? [];
  const total = responses.length;

  if (detailQuery.isLoading || responsesQuery.isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
        Aún no hay suficientes respuestas para generar el desglose visual.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {questions.map((q) => {
        const answers = responses
          .map((r) => {
            const map =
              r.answers && typeof r.answers === "object" && !Array.isArray(r.answers)
                ? (r.answers as Record<string, unknown>)
                : {};
            return (
              map[q.id] ??
              (q.type === "nps" ? r.nps_score : undefined) ??
              (q.id === "comment" ? r.comment : undefined)
            );
          })
          .filter((v) => v !== undefined && v !== null && v !== "");

        if (q.type === "select") {
          const counts: Record<string, number> = {};
          answers.forEach((ans) => {
            const val = String(ans);
            counts[val] = (counts[val] || 0) + 1;
          });

          return (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
              <div>
                <h4 className="text-xs font-semibold text-foreground">{q.label}</h4>
                <p className="text-[11px] text-muted-foreground">{answers.length} respuestas</p>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {Object.entries(counts).map(([opt, cnt]) => {
                  const pct = Math.round((cnt / (answers.length || 1)) * 100);
                  return (
                    <div key={opt} className="flex flex-col gap-1 text-xs">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-medium text-foreground truncate">{opt}</span>
                        <span className="text-muted-foreground">{cnt} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        if (q.type === "nps") {
          const nums = answers.map(Number).filter((n) => !isNaN(n));
          const totalNps = nums.length || 1;
          const prom = nums.filter((n) => n >= 9).length;
          const pas = nums.filter((n) => n >= 7 && n <= 8).length;
          const det = nums.filter((n) => n <= 6).length;
          const promPct = Math.round((prom / totalNps) * 100);
          const pasPct = Math.round((pas / totalNps) * 100);
          const detPct = Math.round((det / totalNps) * 100);
          const netScore = promPct - detPct;

          return (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">{q.label}</h4>
                    <p className="text-[11px] text-muted-foreground">{nums.length} evaluaciones (Escala 0-10)</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-bold tabular-nums shrink-0",
                      netScore >= 50
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : netScore >= 0
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                    )}
                  >
                    NPS {netScore > 0 ? `+${netScore}` : netScore}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${promPct}%` }} title={`Promotores (9-10): ${promPct}%`} />
                  <div className="h-full bg-amber-400" style={{ width: `${pasPct}%` }} title={`Pasivos (7-8): ${pasPct}%`} />
                  <div className="h-full bg-rose-500" style={{ width: `${detPct}%` }} title={`Detractores (0-6): ${detPct}%`} />
                </div>

                <div className="grid grid-cols-3 gap-1 text-[10px] text-center font-medium">
                  <div className="rounded bg-emerald-500/10 p-1 text-emerald-700 dark:text-emerald-400">
                    <span className="block font-bold">{prom} ({promPct}%)</span>
                    <span>Promotores (9-10)</span>
                  </div>
                  <div className="rounded bg-amber-500/10 p-1 text-amber-700 dark:text-amber-400">
                    <span className="block font-bold">{pas} ({pasPct}%)</span>
                    <span>Pasivos (7-8)</span>
                  </div>
                  <div className="rounded bg-rose-500/10 p-1 text-rose-700 dark:text-rose-400">
                    <span className="block font-bold">{det} ({detPct}%)</span>
                    <span>Detractores (0-6)</span>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        if (q.type === "rating") {
          const nums = answers.map(Number).filter((n) => !isNaN(n));
          const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "—";
          return (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
              <div>
                <h4 className="text-xs font-semibold text-foreground">{q.label}</h4>
                <p className="text-[11px] text-muted-foreground">{answers.length} evaluaciones</p>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{avg}</span>
                <span className="text-xs text-muted-foreground">de {q.max || 5} estrellas max.</span>
              </div>
            </div>
          );
        }

        if (q.type === "boolean") {
          const yes = answers.filter((v) => v === true || v === "true" || v === "Sí").length;
          const pctYes = Math.round((yes / (answers.length || 1)) * 100);
          return (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
              <div>
                <h4 className="text-xs font-semibold text-foreground">{q.label}</h4>
                <p className="text-[11px] text-muted-foreground">{answers.length} respuestas</p>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span>Sí: <strong>{yes}</strong> ({pctYes}%)</span>
                  <span>No: <strong>{answers.length - yes}</strong> ({100 - pctYes}%)</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${pctYes}%` }} />
                  <div className="h-full bg-rose-500" style={{ width: `${100 - pctYes}%` }} />
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={q.id} className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
            <div>
              <h4 className="text-xs font-semibold text-foreground">{q.label}</h4>
              <p className="text-[11px] text-muted-foreground">{answers.length} respuestas de texto</p>
            </div>
            <div className="mt-3 max-h-24 overflow-y-auto text-xs text-muted-foreground flex flex-col gap-1">
              {answers.slice(0, 5).map((ans, idx) => (
                <p key={idx} className="truncate border-b border-border/40 pb-0.5">&quot;{String(ans)}&quot;</p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const EXTRA_QUESTION_TYPES: { value: SurveyQuestion["type"]; label: string }[] = [
  { value: "text", label: "Texto libre" },
  { value: "nps", label: "Puntaje NPS (0-10)" },
  { value: "rating", label: "Nota / Estrellas (1-5)" },
  { value: "select", label: "Opciones de lista" },
  { value: "boolean", label: "Sí / No" },
  { value: "url", label: "Link / Web" },
  // "file" deshabilitado: sin endpoint de uploads el adjunto no llega al servidor (solo el nombre).
];

const EXTRA_QUESTION_ICONS = {
  text: { icon: Type },
  nps: { icon: Star },
  rating: { icon: Star },
  select: { icon: List },
  boolean: { icon: ToggleLeft },
  url: { icon: Link2 },
  file: { icon: Paperclip },
};

function withQuestionType(question: SurveyQuestion, type: SurveyQuestion["type"]): SurveyQuestion {
  const next: SurveyQuestion = { ...question, type };
  if (type === "select") {
    next.options = question.options ?? ["Opción 1", "Opción 2"];
    delete next.max;
  } else if (type === "rating") {
    next.max = question.max && question.max >= 2 ? question.max : 5;
    delete next.options;
  } else {
    delete next.options;
    delete next.max;
  }
  return next;
}

function normalizeQuestions(questions: SurveyQuestion[]): SurveyQuestion[] {
  return questions
    .map((question) => {
      const next: SurveyQuestion = {
        id: question.id || `q_${Math.random().toString(36).substring(2, 7)}`,
        type: question.type,
        label: question.label.trim(),
        required: Boolean(question.required),
      };
      if (question.type === "select") {
        next.options = (question.options ?? []).map((opt) => opt.trim()).filter(Boolean);
      }
      if (question.type === "rating") {
        const max = Number(question.max);
        next.max = max >= 2 && max <= 10 ? max : 5;
      }
      return next;
    })
    .filter((question) => question.label);
}

function QuestionEditor({
  questions,
  onChange,
}: {
  questions: SurveyQuestion[];
  onChange: (next: SurveyQuestion[]) => void;
}) {
  function patch(index: number, question: SurveyQuestion) {
    const next = questions.slice();
    next[index] = question;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Preguntas de la encuesta ({questions.length})</p>
        <span className="text-[11px] text-muted-foreground">
          Podés modificar el texto, tipo o quitar cualquier pregunta
        </span>
      </div>

      {questions.map((question, index) => {
        return (
          <div key={question.id || index} className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="w-44 shrink-0">
                <Select
                  value={question.type}
                  options={EXTRA_QUESTION_TYPES}
                  optionExtras={EXTRA_QUESTION_ICONS}
                  className="h-8 text-xs"
                  onChange={(e) => {
                    const type = e.target.value as SurveyQuestion["type"];
                    if (!EXTRA_QUESTION_TYPES.some((item) => item.value === type)) return;
                    patch(index, withQuestionType(question, type));
                  }}
                />
              </div>
              <Input
                value={question.label}
                onChange={(e) => patch(index, { ...question, label: e.target.value })}
                placeholder="Escribí tu pregunta..."
                className="h-8 text-xs flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(questions.filter((_, i) => i !== index))}
                title="Quitar pregunta"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(question.required)}
                  onChange={(e) => patch(index, { ...question, required: e.target.checked })}
                  className="rounded border-border"
                />
                Respuesta obligatoria
              </label>

              {question.type === "rating" ? (
                <label className="flex items-center gap-1.5">
                  Escala máxima:
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={question.max ?? 5}
                    className="h-7 w-16 text-xs"
                    onChange={(e) =>
                      patch(index, { ...question, max: Number(e.target.value) || 5 })
                    }
                  />
                </label>
              ) : null}
            </div>

            {question.type === "select" ? (
              <div className="mt-1 border-t border-border/50 pt-2">
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">Opciones (una por línea):</p>
                <textarea
                  value={(question.options ?? []).join("\n")}
                  onChange={(e) =>
                    patch(index, { ...question, options: e.target.value.split("\n") })
                  }
                  placeholder={"Opción 1\nOpción 2\nOpción 3"}
                  className="min-h-16 w-full resize-y rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ) : null}
          </div>
        );
      })}

      <Button
        size="sm"
        variant="outline"
        className="h-8 w-full sm:w-fit gap-1 text-xs font-medium"
        onClick={() =>
          onChange([
            ...questions,
            { id: `q_${Date.now()}`, type: "text", label: "", required: false },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar pregunta
      </Button>
    </div>
  );
}

function SurveyQuestionsPanel({ surveyId }: { surveyId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["surveys", "detail", surveyId],
    queryFn: () => fetchSurvey(surveyId),
  });
  const [draft, setDraft] = useState<SurveyQuestion[] | null>(null);
  const [draftFor, setDraftFor] = useState<typeof detailQuery.data>(undefined);

  // Deriva el draft del detalle (ajuste durante render, sin effect).
  if (detailQuery.data && draftFor !== detailQuery.data) {
    setDraftFor(detailQuery.data);
    setDraft(parseSurveyQuestions(detailQuery.data.questions));
  }

  const save = useMutation({
    mutationFn: (next: SurveyQuestion[]) =>
      updateSurvey(surveyId, { questions: normalizeQuestions(next) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys", "detail", surveyId] });
      toast.success("Preguntas guardadas");
    },
    onError: () => toast.error("No se pudieron guardar las preguntas"),
  });

  if (detailQuery.isLoading || !draft) {
    return <Skeleton className="mt-3 h-16 w-full rounded-xl" />;
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <QuestionEditor questions={draft} onChange={setDraft} />
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          className="h-8"
          isLoading={save.isPending}
          disabled={draft.every((question) => !question.label.trim())}
          onClick={() => save.mutate(draft)}
        >
          Guardar preguntas
        </Button>
      </div>
    </div>
  );
}

function cellValue(raw: unknown): string {
  if (raw === true || raw === "true") return "Sí";
  if (raw === false || raw === "false") return "No";
  if (raw === null || raw === undefined || raw === "") return "—";
  return String(raw);
}

function SurveyAnswerSheet({ surveyId }: { surveyId: string }) {
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const timer = setTimeout(() => setQueryText(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset de paginación al cambiar el texto buscado (ajuste durante render).
  const [queryKey, setQueryKey] = useState(queryText);
  if (queryKey !== queryText) {
    setQueryKey(queryText);
    setPage(1);
  }

  const detailQuery = useQuery({
    queryKey: ["surveys", "detail", surveyId],
    queryFn: () => fetchSurvey(surveyId),
  });
  const sheetQuery = useQuery({
    queryKey: ["surveys", "responses", "sheet", surveyId, queryText, page],
    queryFn: () =>
      fetchSurveyResponsePage({
        survey: surveyId,
        q: queryText || undefined,
        page,
        page_size: pageSize,
      }),
  });

  const questions = parseSurveyQuestions(detailQuery.data?.questions);
  const count = sheetQuery.data?.count ?? 0;
  const rows = sheetQuery.data?.results ?? [];
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(count, page * pageSize);

  return (
    <section className="glass rounded-2xl p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Respuestas</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar persona"
          className="h-8 w-full sm:ml-auto sm:w-56"
        />
      </div>
      {sheetQuery.isLoading || detailQuery.isLoading ? (
        <Skeleton className="mt-3 h-40 w-full rounded-xl" />
      ) : count === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Esta encuesta todavía no tiene respuestas.</p>
      ) : (
        <>
          <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 z-20 w-28 bg-muted px-3 py-2 font-medium">Fecha</th>
                  <th className="sticky left-28 z-20 min-w-36 bg-muted px-3 py-2 font-medium">Quién</th>
                  {questions.map((question) => (
                    <th key={question.id} className="px-3 py-2 font-medium">
                      {question.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const answers =
                    row.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
                      ? (row.answers as Record<string, unknown>)
                      : {};
                  return (
                    <tr key={row.id} className="group border-b border-border last:border-0 hover:bg-primary/5">
                      <td className="sticky left-0 bg-card px-3 py-2 text-xs tabular-nums text-muted-foreground group-hover:bg-muted">
                        {row.created
                          ? new Date(row.created).toLocaleString("es-CL", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="sticky left-28 bg-card px-3 py-2 text-sm group-hover:bg-muted">
                        {row.client_name || row.respondent_name || "—"}
                      </td>
                      {questions.map((question) => (
                        <td key={question.id} className="max-w-[16rem] truncate px-3 py-2 text-xs">
                          {cellValue(
                            answers[question.id] ??
                              (question.type === "nps" ? row.nps_score : undefined) ??
                              (question.id === "comment" ? row.comment : undefined),
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs tabular-nums text-muted-foreground">
              {from}–{to} de {count}
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-8" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Anterior
              </Button>
              <Button size="sm" variant="outline" className="h-8" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
