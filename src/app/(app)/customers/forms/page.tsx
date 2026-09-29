"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Copy,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Hash,
  Image as ImageIcon,
  Layers,
  Link2,
  List,
  ListChecks,
  Mail,
  Paperclip,
  Pause,
  Pencil,
  Phone,
  Play,
  Plus,
  Power,
  QrCode,
  Search,
  Sparkles,
  ToggleLeft,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageBody, PageShell } from "@/components/page-shell";
import { CrmDenied } from "@/components/customers/crm-denied";
import { SurveyFillForm } from "@/components/surveys/survey-fill-form";
import { CrmNav } from "@/components/customers/crm-nav";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  createExtraFieldDefinition,
  createExtraFieldGroup,
  deleteExtraFieldDefinition,
  deleteExtraFieldGroup,
  fetchExtraFieldDefinitions,
  fetchExtraFieldGroups,
  fieldTypeLabel,
  parseFieldOptions,
  updateExtraFieldDefinition,
  updateExtraFieldGroup,
  type ExtraFieldDefinition,
  type ExtraFieldGroup,
  type ExtraFieldOption,
} from "@/lib/api/customer-fields";
import {
  activateSurvey,
  createSurvey,
  fetchSurveyResponsePage,
  fetchSurveys,
  pauseSurvey,
  publicSurveyAbsoluteUrl,
  questionsFromExtraFieldDefinitions,
  surveyStatusLabel,
  updateSurvey,
  type SurveyList,
} from "@/lib/api/surveys";
import { useCanManageCustomers } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

type GroupDraft = { id?: string; name: string; description: string };
type FieldDraft = {
  id?: string;
  name: string;
  description: string;
  field_type: string;
  group: string;
  is_required: boolean;
  display_in_card: boolean;
  optionsText: string;
};

function optionsToText(opts: ExtraFieldOption[]): string {
  return opts.map((o) => o.label || o.value).join("\n");
}

function textToOptions(raw: string): ExtraFieldOption[] {
  return raw
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({ value: label, label }));
}

type PresetTemplate = {
  title: string;
  description: string;
  badge: string;
  fields: Array<{
    name: string;
    field_type: string;
    description?: string;
    is_required?: boolean;
    display_in_card?: boolean;
    options?: ExtraFieldOption[];
  }>;
};

const SECTION_PRESETS: PresetTemplate[] = [
  {
    title: "Levantamiento Técnico & Proyecto",
    description: "Especificaciones del servicio, medidas, fechas y adjuntos técnicos.",
    badge: "Recomendado",
    fields: [
      {
        name: "Tipo de Proyecto / Servicio",
        field_type: "SELECT",
        is_required: true,
        display_in_card: true,
        options: [
          { value: "Instalación Nueva", label: "Instalación Nueva" },
          { value: "Mantención / Reparación", label: "Mantención / Reparación" },
          { value: "Modificación / Ampliación", label: "Modificación / Ampliación" },
        ],
      },
      {
        name: "Medidas y Especificaciones",
        field_type: "TEXT",
        is_required: false,
        display_in_card: true,
        description: "Dimensiones, espacio disponible o especificaciones clave",
      },
      { name: "Presupuesto Estimado ($)", field_type: "NUMBER", is_required: false, display_in_card: true },
      { name: "Fecha Requerida de Ejecución", field_type: "DATE", is_required: false, display_in_card: true },
      { name: "Observaciones Técnicas", field_type: "TEXT", is_required: false, display_in_card: false },
      { name: "Adjuntar Plano / Fotografía", field_type: "FILE", is_required: false, display_in_card: false },
    ],
  },
  {
    title: "Facturación & Datos Comerciales",
    description: "RUT, razón social, correo de facturación y teléfono de tesorería.",
    badge: "Comercial",
    fields: [
      { name: "RUT Empresa / Cliente", field_type: "TEXT", is_required: true, display_in_card: true },
      { name: "Razón Social", field_type: "TEXT", is_required: true, display_in_card: true },
      { name: "Giro Comercial", field_type: "TEXT", is_required: false, display_in_card: true },
      { name: "Correo Facturación (DTE)", field_type: "EMAIL", is_required: true, display_in_card: true },
      { name: "Teléfono Tesorería", field_type: "PHONE", is_required: false, display_in_card: false },
    ],
  },
  {
    title: "Despacho & Logística en Terreno",
    description: "Dirección de entrega, contacto en sitio y condiciones de acceso.",
    badge: "Terreno",
    fields: [
      { name: "Dirección Exacta de Entrega", field_type: "TEXT", is_required: true, display_in_card: true },
      { name: "Nombre del Contacto en Terreno", field_type: "TEXT", is_required: true, display_in_card: true },
      { name: "Teléfono Contacto Terreno", field_type: "PHONE", is_required: true, display_in_card: true },
      {
        name: "Horario Hábil de Recepción",
        field_type: "TEXT",
        is_required: false,
        display_in_card: false,
        description: "Ej: Lunes a Viernes 08:30 a 17:30",
      },
      {
        name: "Restricción de Vehículos / Acceso",
        field_type: "BOOLEAN",
        is_required: false,
        display_in_card: false,
        description: "¿Se requiere camión pluma o permiso especial?",
      },
    ],
  },
];

export default function CustomerFormsPage() {
  const canManage = useCanManageCustomers();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "internal">("all");
  const clearedIntro = useRef(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [groupDraft, setGroupDraft] = useState<GroupDraft>({ name: "", description: "" });
  const [fieldDraft, setFieldDraft] = useState<FieldDraft>({
    name: "",
    description: "",
    field_type: "TEXT",
    group: "",
    is_required: false,
    display_in_card: true,
    optionsText: "",
  });

  const groupsQuery = useQuery({
    queryKey: ["customers", "extra-field-groups"],
    queryFn: fetchExtraFieldGroups,
    enabled: canManage,
  });
  const defsQuery = useQuery({
    queryKey: ["customers", "extra-field-definitions", "admin"],
    queryFn: () => fetchExtraFieldDefinitions({ includeInactive: true }),
    enabled: canManage,
  });
  const levantamientosQuery = useQuery({
    queryKey: ["surveys", "levantamientos"],
    queryFn: () => fetchSurveys({ survey_type: "CUSTOM", page_size: 50 }),
    enabled: canManage,
  });

  const groups = groupsQuery.data ?? [];
  const defs = defsQuery.data ?? [];

  const defsByGroup = useMemo(() => {
    const map = new Map<string, ExtraFieldDefinition[]>();
    for (const d of defs) {
      const key = d.group ? String(d.group) : "_none";
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    }
    return map;
  }, [defs]);

  useEffect(() => {
    if (clearedIntro.current || groups.length === 0 || !levantamientosQuery.data) return;
    const linked = (levantamientosQuery.data.results ?? []).flatMap((survey) => {
      const group = groups.find((item) =>
        (survey.title ?? "").startsWith(`Levantamiento · ${item.name}`),
      );
      return group ? [{ survey, description: group.description?.trim() || "" }] : [];
    });
    if (linked.length === 0) {
      clearedIntro.current = true;
      return;
    }
    clearedIntro.current = true;
    void Promise.all(
      linked.map(({ survey, description }) => updateSurvey(survey.id, { description })),
    ).then(() => queryClient.invalidateQueries({ queryKey: ["surveys"] }));
  }, [groups, levantamientosQuery.data, queryClient]);

  function openGroupCreate() {
    setGroupDraft({ name: "", description: "" });
    setGroupOpen(true);
  }

  function openGroupEdit(g: ExtraFieldGroup) {
    setGroupDraft({
      id: g.id,
      name: g.name,
      description: g.description ?? "",
    });
    setGroupOpen(true);
  }

  function openFieldCreate(groupId?: string) {
    setFieldDraft({
      name: "",
      description: "",
      field_type: "TEXT",
      group: groupId || (groups[0]?.id ? String(groups[0].id) : ""),
      is_required: false,
      display_in_card: true,
      optionsText: "",
    });
    setFieldOpen(true);
  }

  function openFieldEdit(f: ExtraFieldDefinition) {
    setFieldDraft({
      id: f.id,
      name: f.name,
      description: f.description ?? "",
      field_type: f.field_type ?? "TEXT",
      group: f.group ? String(f.group) : "",
      is_required: Boolean(f.is_required),
      display_in_card: f.display_in_card !== false,
      optionsText: optionsToText(parseFieldOptions(f.options)),
    });
    setFieldOpen(true);
  }

  const saveGroup = useMutation({
    mutationFn: async () => {
      const name = groupDraft.name.trim();
      if (!name) throw new Error("Nombre obligatorio");
      const description = groupDraft.description.trim();
      const saved = groupDraft.id
        ? await updateExtraFieldGroup(groupDraft.id, { name, description })
        : await createExtraFieldGroup({
            name,
            description: description || undefined,
          });
      const linked = (levantamientosQuery.data?.results ?? []).filter((survey) =>
        (survey.title ?? "").startsWith(`Levantamiento · ${name}`),
      );
      await Promise.all(
        linked.map((survey) => updateSurvey(survey.id, { description })),
      );
      return saved;
    },
    onSuccess: () => {
      setGroupOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customers", "extra-field-groups"] });
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(groupDraft.id ? "Sección actualizada" : "Sección creada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const renameGroup = useMutation({
    mutationFn: async (payload: { id: string; name: string; description: string }) => {
      const name = payload.name.trim();
      if (!name) throw new Error("Nombre obligatorio");
      const description = payload.description.trim();
      const currentName = groups.find((item) => item.id === payload.id)?.name ?? name;
      await updateExtraFieldGroup(payload.id, { name, description });
      const linked = (levantamientosQuery.data?.results ?? []).filter((survey) =>
        (survey.title ?? "").startsWith(`Levantamiento · ${currentName}`),
      );
      await Promise.all(linked.map((survey) => updateSurvey(survey.id, { description })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", "extra-field-groups"] });
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const saveField = useMutation({
    mutationFn: async () => {
      const name = fieldDraft.name.trim();
      if (!name) throw new Error("Nombre obligatorio");
      if (!fieldDraft.id && !fieldDraft.group) throw new Error("Elegí una sección");
      const needsOptions =
        fieldDraft.field_type === "SELECT" || fieldDraft.field_type === "MULTISELECT";
      const options = needsOptions ? textToOptions(fieldDraft.optionsText) : [];
      if (needsOptions && options.length === 0) {
        throw new Error("Agregá al menos una opción (una por línea)");
      }
      if (fieldDraft.id) {
        return updateExtraFieldDefinition(fieldDraft.id, {
          name,
          description: fieldDraft.description.trim(),
          field_type: fieldDraft.field_type,
          is_required: fieldDraft.is_required,
          display_in_card: fieldDraft.display_in_card,
          options: needsOptions ? options : [],
        });
      }
      return createExtraFieldDefinition({
        name,
        field_type: fieldDraft.field_type,
        group: fieldDraft.group,
        is_required: fieldDraft.is_required,
        display_in_card: fieldDraft.display_in_card,
        description: fieldDraft.description.trim() || undefined,
        options: needsOptions ? options : [],
      });
    },
    onSuccess: () => {
      setFieldOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["customers", "extra-field-definitions"],
      });
      toast.success(fieldDraft.id ? "Campo actualizado" : "Campo agregado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const toggleField = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateExtraFieldDefinition(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["customers", "extra-field-definitions"],
      });
      toast.success("Campo actualizado");
    },
    onError: () => toast.error("No se pudo actualizar el campo"),
  });

  const publishLevantamiento = useMutation({
    mutationFn: async (group: ExtraFieldGroup) => {
      const fields = (defsByGroup.get(String(group.id)) ?? []).filter(
        (f) => f.is_active !== false,
      );
      if (fields.length === 0) {
        throw new Error("Esta sección no tiene campos activos");
      }
      const questions = questionsFromExtraFieldDefinitions(fields);
      const survey = await createSurvey({
        title: `Levantamiento · ${group.name}`,
        description: group.description?.trim() || "",
        survey_type: "CUSTOM",
        questions,
        status: "DRAFT",
        is_anonymous: true,
        allow_multiple_responses: true,
      });
      return activateSurvey(survey.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Levantamiento publicado. El link quedó en esta página.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo publicar"),
  });

  const toggleLevantamiento = useMutation({
    mutationFn: async (survey: SurveyList) => {
      if (survey.status === "ACTIVE") return pauseSurvey(survey.id);
      return activateSurvey(survey.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["surveys"] }),
    onError: () => toast.error("No se pudo cambiar el estado"),
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => deleteExtraFieldGroup(id),
    onSuccess: () => {
      setOpenFormId(null);
      queryClient.invalidateQueries({ queryKey: ["customers", "extra-field-groups"] });
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Sección eliminada");
    },
    onError: () => toast.error("No se pudo eliminar la sección"),
  });

  const deleteField = useMutation({
    mutationFn: (id: string) => deleteExtraFieldDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["customers", "extra-field-definitions"],
      });
      toast.success("Campo eliminado");
    },
    onError: () => toast.error("No se pudo eliminar el campo"),
  });

  const duplicateField = useMutation({
    mutationFn: async (field: ExtraFieldDefinition) => {
      const opts = parseFieldOptions(field.options);
      return createExtraFieldDefinition({
        name: `${field.name} (Copia)`,
        description: field.description ?? undefined,
        field_type: field.field_type ?? "TEXT",
        group: field.group ? String(field.group) : undefined,
        is_required: Boolean(field.is_required),
        display_in_card: field.display_in_card !== false,
        options: opts,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", "extra-field-definitions"] });
      toast.success("Campo duplicado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al duplicar"),
  });

  const applyPreset = useMutation({
    mutationFn: async (presetIndex: number) => {
      const p = SECTION_PRESETS[presetIndex];
      if (!p) return;
      const group = await createExtraFieldGroup({
        name: p.title,
        description: p.description,
      });
      for (const field of p.fields) {
        await createExtraFieldDefinition({
          name: field.name,
          field_type: field.field_type,
          group: String(group.id),
          is_required: field.is_required ?? false,
          display_in_card: field.display_in_card ?? true,
          description: field.description,
          options: field.options,
        });
      }
      return group;
    },
    onSuccess: (newGroup) => {
      setPresetOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customers", "extra-field-groups"] });
      queryClient.invalidateQueries({ queryKey: ["customers", "extra-field-definitions"] });
      toast.success(`Sección "${newGroup?.name}" creada exitosamente`);
      if (newGroup?.id) setOpenFormId(newGroup.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al aplicar plantilla"),
  });

  async function copyPublicLink(slug: string) {
    try {
      await navigator.clipboard.writeText(publicSurveyAbsoluteUrl(slug));
      toast.success("Link público copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  if (!canManage) {
    return <CrmDenied title="Fichas" icon={<FileText className="h-5 w-5" />} />;
  }

  const surveys = levantamientosQuery.data?.results ?? [];
  const prefixFor = (group: ExtraFieldGroup) => `Levantamiento · ${group.name}`;
  const matchedSurveyIds = new Set(
    surveys
      .filter((survey) =>
        groups.some((group) => (survey.title ?? "").startsWith(prefixFor(group))),
      )
      .map((survey) => survey.id),
  );
  const looseSurveys = surveys.filter((survey) => !matchedSurveyIds.has(survey.id));
  const selectedGroup = groups.find((group) => group.id === openFormId) ?? null;
  const totalResponses = surveys.reduce((sum, s) => sum + (s.response_count ?? 0), 0);
  const publishedTotal = surveys.filter((s) => s.status === "ACTIVE").length;

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const q = search.toLowerCase();
      const fields = defsByGroup.get(String(g.id)) ?? [];
      const matchSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q) ||
        fields.some((f) => f.name.toLowerCase().includes(q));
      if (!matchSearch) return false;

      const groupSurveys = surveys.filter((survey) =>
        (survey.title ?? "").startsWith(prefixFor(g)),
      );
      const isPublished = groupSurveys.some((s) => s.status === "ACTIVE");
      if (statusFilter === "published" && !isPublished) return false;
      if (statusFilter === "internal" && isPublished) return false;

      return true;
    });
  }, [groups, search, statusFilter, defsByGroup, surveys]);

  const needsOptions =
    fieldDraft.field_type === "SELECT" || fieldDraft.field_type === "MULTISELECT";

  return (
    <PageShell>
      <PageHeader
        title="Fichas Técnicas & Levantamientos"
        icon={<FileText className="h-5 w-5" />}
        subtitle="Estructura técnica para cotizaciones, levantamientos y ficha 360 del cliente."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => setPresetOpen(true)}>
              <Sparkles className="h-4 w-4 text-amber-500" />
              Plantillas Rápidas
            </Button>
            <Button variant="outline" className="h-9 gap-1.5" onClick={openGroupCreate}>
              <Plus className="h-4 w-4" />
              Nueva Sección
            </Button>
            <Button
              className="h-9 gap-1.5"
              onClick={() => openFieldCreate()}
              disabled={groups.length === 0}
            >
              <Plus className="h-4 w-4" />
              Nuevo Campo
            </Button>
          </div>
        }
      />
      <PageBody className="gap-4">
        {/* Navigation Tabs */}
        <CrmNav className="glass rounded-2xl p-1.5" />

        {(groupsQuery.isLoading || defsQuery.isLoading) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        )}

        {!groupsQuery.isLoading && groups.length === 0 && (
          <EmptyState
            icon={FileText}
            title="Todavía no hay secciones de ficha"
            description="Creá una sección (ej. Medidas, Alcance, Rubro) para estructurar datos técnicos y publicar fichas a clientes."
            action={
              <Button size="sm" onClick={openGroupCreate}>
                <Plus className="h-3.5 w-3.5" />
                Crear Sección
              </Button>
            }
          />
        )}

        {!groupsQuery.isLoading && groups.length > 0 && !selectedGroup && (
          <>
            {/* Top KPIs */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard
                variant="compact"
                label="Secciones Activas"
                value={groups.length}
                sub="Plantillas configuradas"
                icon={FileText}
                tone="primary"
              />
              <StatCard
                variant="compact"
                label="Campos Técnicos"
                value={defs.length}
                sub={`${defs.filter((d) => d.is_required).length} obligatorios`}
                icon={ListChecks}
                tone="muted"
              />
              <StatCard
                variant="compact"
                label="Fichas Públicas"
                value={publishedTotal}
                sub="Links web en línea"
                icon={Globe}
                tone="success"
              />
              <StatCard
                variant="compact"
                label="Levantamientos"
                value={totalResponses}
                sub="Respuestas de clientes"
                icon={ClipboardList}
                tone="primary"
              />
            </div>

            {/* Single-Row Minimal Filter Bar */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="relative w-52 sm:w-64 shrink-0">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por sección o campo…"
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

                <Select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | "published" | "internal")
                  }
                  containerClassName="w-44 shrink-0"
                  className="text-xs h-8 rounded-xl"
                >
                  <option value="all">Estado: Todos</option>
                  <option value="published">Ficha en línea</option>
                  <option value="internal">Solo ficha interna</option>
                </Select>

                {(search || statusFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                    className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {filteredGroups.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Sin resultados"
                description="No se encontraron secciones que coincidan con la búsqueda o filtro seleccionado."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                  >
                    Restablecer filtros
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredGroups.map((group) => {
                  const fields = defsByGroup.get(String(group.id)) ?? [];
                  const groupSurveys = surveys.filter((survey) =>
                    (survey.title ?? "").startsWith(prefixFor(group)),
                  );
                  const published = groupSurveys.some((survey) => survey.status === "ACTIVE");
                  return (
                    <SectionCard
                      key={group.id}
                      group={group}
                      fields={fields}
                      surveys={groupSurveys}
                      published={published}
                      onOpen={() => setOpenFormId(group.id)}
                      onAddField={() => openFieldCreate(String(group.id))}
                      onEdit={() => openGroupEdit(group)}
                      onDelete={() => deleteGroup.mutate(group.id)}
                      onPublish={() => publishLevantamiento.mutate(group)}
                      publishing={publishLevantamiento.isPending}
                      onCopy={copyPublicLink}
                    />
                  );
                })}
              </div>
            )}

          </>
        )}

        {selectedGroup && (
          <SectionWorkspace
            group={selectedGroup}
            fields={defsByGroup.get(String(selectedGroup.id)) ?? []}
            surveys={surveys.filter((survey) =>
              (survey.title ?? "").startsWith(prefixFor(selectedGroup)),
            )}
            publishing={publishLevantamiento.isPending}
            togglingSurvey={toggleLevantamiento.isPending}
            togglingField={toggleField.isPending}
            onBack={() => setOpenFormId(null)}
            onEditGroup={() => openGroupEdit(selectedGroup)}
            onAddField={() => openFieldCreate(String(selectedGroup.id))}
            onPublish={() => publishLevantamiento.mutate(selectedGroup)}
            onCopy={copyPublicLink}
            onToggleSurvey={(survey) => toggleLevantamiento.mutate(survey)}
            onEditField={openFieldEdit}
            onToggleField={(field) =>
              toggleField.mutate({ id: field.id, is_active: field.is_active === false })
            }
            onDuplicateField={(field) => duplicateField.mutate(field)}
            onDeleteField={(id) => deleteField.mutate(id)}
          />
        )}
      </PageBody>

      {/* Modal de Plantillas Rápidas */}
      <AnimatedOverlay
        open={presetOpen}
        onClose={() => setPresetOpen(false)}
        zIndex="z-[70]"
        panelClassName="flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-5 sm:p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-bold">Plantillas Rápidas de Fichas</h2>
                <p className="text-xs text-muted-foreground">
                  Crea secciones completas con campos pre-configurados en un solo clic.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPresetOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SECTION_PRESETS.map((preset, idx) => (
              <div
                key={preset.title}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {preset.badge}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {preset.fields.length} campos
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">
                    {preset.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                    {preset.description}
                  </p>
                </div>

                <Button
                  size="sm"
                  className="mt-4 w-full gap-1.5 text-xs"
                  disabled={applyPreset.isPending}
                  isLoading={applyPreset.isPending}
                  onClick={() => applyPreset.mutate(idx)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Usar Plantilla
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setPresetOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </AnimatedOverlay>

      <AnimatedOverlay
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div className="w-full rounded-t-xl border border-border bg-background p-4 sm:max-w-md sm:rounded-xl sm:p-6">
          <h2 className="text-base font-semibold">
            {groupDraft.id ? "Editar sección" : "Nueva sección"}
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            <Input
              placeholder="Nombre (ej. Medidas, Alcance)"
              value={groupDraft.name}
              onChange={(e) =>
                setGroupDraft((d) => ({ ...d, name: e.target.value }))
              }
            />
            <Input
              placeholder="Texto que ve quien abre la ficha"
              value={groupDraft.description}
              onChange={(e) =>
                setGroupDraft((d) => ({ ...d, description: e.target.value }))
              }
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGroupOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!groupDraft.name.trim() || saveGroup.isPending}
              isLoading={saveGroup.isPending}
              onClick={() => saveGroup.mutate()}
            >
              {groupDraft.id ? "Guardar" : "Crear"}
            </Button>
          </div>
        </div>
      </AnimatedOverlay>

      <AnimatedOverlay
        open={fieldOpen}
        onClose={() => setFieldOpen(false)}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div className="w-full rounded-t-xl border border-border bg-background p-4 sm:max-w-md sm:rounded-xl sm:p-6">
          <h2 className="text-base font-semibold">
            {fieldDraft.id ? "Editar campo" : "Nuevo campo"}
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            <Input
              placeholder="Nombre del campo"
              value={fieldDraft.name}
              onChange={(e) =>
                setFieldDraft((d) => ({ ...d, name: e.target.value }))
              }
            />
            <Input
              placeholder="Descripción (opcional)"
              value={fieldDraft.description}
              onChange={(e) =>
                setFieldDraft((d) => ({ ...d, description: e.target.value }))
              }
            />
            <Select
              value={fieldDraft.field_type}
              options={FIELD_TYPES}
              optionExtras={FIELD_TYPE_ICONS}
              onChange={(e) =>
                setFieldDraft((d) => ({ ...d, field_type: e.target.value }))
              }
            />
            {!fieldDraft.id && (
              <Select
                value={fieldDraft.group}
                onChange={(e) =>
                  setFieldDraft((d) => ({ ...d, group: e.target.value }))
                }
              >
                {groups.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.name}
                  </option>
                ))}
              </Select>
            )}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={fieldDraft.is_required}
                onChange={(e) =>
                  setFieldDraft((d) => ({ ...d, is_required: e.target.checked }))
                }
              />
              Obligatorio
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={fieldDraft.display_in_card}
                onChange={(e) =>
                  setFieldDraft((d) => ({ ...d, display_in_card: e.target.checked }))
                }
              />
              Visible en la ficha del cliente
            </label>
            {needsOptions && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Opciones (una por línea)
                </p>
                <textarea
                  className="min-h-[6rem] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={fieldDraft.optionsText}
                  onChange={(e) =>
                    setFieldDraft((d) => ({ ...d, optionsText: e.target.value }))
                  }
                  placeholder={"Pequeño\nMediano\nGrande"}
                />
              </div>
            )}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFieldOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !fieldDraft.name.trim() ||
                (!fieldDraft.id && !fieldDraft.group) ||
                saveField.isPending
              }
              isLoading={saveField.isPending}
              onClick={() => saveField.mutate()}
            >
              {fieldDraft.id ? "Guardar" : "Agregar"}
            </Button>
          </div>
        </div>
      </AnimatedOverlay>
    </PageShell>
  );
}

function SectionCard({
  group,
  fields,
  surveys,
  published,
  onOpen,
  onAddField,
  onEdit,
  onDelete,
  onPublish,
  publishing,
  onCopy,
}: {
  group: ExtraFieldGroup;
  fields: ExtraFieldDefinition[];
  surveys: SurveyList[];
  published: boolean;
  onOpen: () => void;
  onAddField: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: () => void;
  publishing: boolean;
  onCopy: (slug: string) => void;
}) {
  const requiredCount = fields.filter((field) => field.is_required).length;
  const responsesCount = surveys.reduce((sum, survey) => sum + (survey.response_count ?? 0), 0);
  const activeSurvey = surveys.find((s) => s.status === "ACTIVE");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 text-left transition-all duration-150 hover:border-primary/40 hover:shadow-md cursor-pointer"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </span>
              <h2 className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                {group.name}
              </h2>
            </div>
            {group.description?.trim() ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {group.description}
              </p>
            ) : (
              <p className="mt-1 text-xs italic text-muted-foreground/60">
                Sin descripción configurada
              </p>
            )}
          </div>

          <div
            className="flex shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                published
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {published ? "Online" : "Interna"}
            </span>

            <ActionsMenu
              ariaLabel={`Acciones de ${group.name}`}
              size="icon"
              className="h-7 w-7"
              items={[
                { label: "Gestionar ficha", icon: FileText, onClick: onOpen },
                { label: "Editar nombre", icon: Pencil, onClick: onEdit },
                { label: "Agregar campo", icon: Plus, onClick: onAddField },
                {
                  label: published ? "Crear otro link" : "Publicar ficha",
                  icon: Sparkles,
                  onClick: () => {
                    if (!publishing && fields.length > 0) onPublish();
                  },
                },
                ...(activeSurvey?.slug
                  ? [
                      {
                        label: "Copiar enlace público",
                        icon: Copy,
                        onClick: () => onCopy(activeSurvey.slug!),
                      },
                    ]
                  : []),
                {
                  label: "Eliminar sección",
                  icon: Trash2,
                  danger: true,
                  onClick: onDelete,
                },
              ]}
            />
          </div>
        </div>

        {/* Field Chips preview */}
        <div className="mt-3.5 flex min-h-[2.5rem] max-h-16 flex-wrap gap-1.5 overflow-hidden">
          {fields.length === 0 ? (
            <span className="text-xs text-muted-foreground/70">
              No hay campos configurados todavía.
            </span>
          ) : (
            <>
              {fields.slice(0, 4).map((field) => (
                <FieldChip key={field.id} field={field} />
              ))}
              {fields.length > 4 && (
                <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-[10px] font-medium text-muted-foreground">
                  +{fields.length - 4} más
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Metrics footer & Action */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">
              {fields.length}{" "}
              <span className="font-normal text-muted-foreground">campos</span>
            </span>
            <span>•</span>
            <span className="tabular-nums font-medium text-foreground">
              {requiredCount}{" "}
              <span className="font-normal text-muted-foreground">oblig.</span>
            </span>
            <span>•</span>
            <span className="tabular-nums font-medium text-foreground">
              {responsesCount}{" "}
              <span className="font-normal text-muted-foreground">respuestas</span>
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-transform group-hover:translate-x-0.5">
            Gestionar
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function fieldTypeIcon(type?: string | null): LucideIcon {
  switch (type) {
    case "NUMBER":
    case "INTEGER":
    case "DECIMAL":
      return Hash;
    case "DATE":
    case "DATETIME":
      return Calendar;
    case "BOOLEAN":
      return ToggleLeft;
    case "SELECT":
      return List;
    case "MULTISELECT":
      return ListChecks;
    case "EMAIL":
      return Mail;
    case "PHONE":
      return Phone;
    case "URL":
      return Link2;
    case "FILE":
      return Paperclip;
    case "IMAGE":
      return ImageIcon;
    default:
      return Type;
  }
}

const FIELD_TYPES: { value: string; label: string }[] = [
  { value: "TEXT", label: "Texto" },
  { value: "BOOLEAN", label: "Sí/No" },
  { value: "NUMBER", label: "Número" },
  { value: "DATE", label: "Fecha" },
  { value: "PHONE", label: "Teléfono" },
  { value: "EMAIL", label: "Email" },
  { value: "URL", label: "URL" },
  { value: "FILE", label: "Archivo" },
  { value: "SELECT", label: "Selección" },
  { value: "MULTISELECT", label: "Selección múltiple" },
];

const FIELD_TYPE_ICONS = Object.fromEntries(
  FIELD_TYPES.map((item) => [item.value, { icon: fieldTypeIcon(item.value) }]),
);

function FieldChip({ field }: { field: ExtraFieldDefinition }) {
  const Icon = fieldTypeIcon(field.field_type);
  return (
    <span
      title={field.name}
      className={cn(
        "inline-flex h-6 max-w-[9rem] items-center gap-1 rounded-md bg-muted/80 px-1.5 text-[10px] text-foreground",
        field.is_active === false && "opacity-40",
        field.is_required && "ring-1 ring-primary/30",
      )}
    >
      <Icon className="h-3 w-3 shrink-0 text-primary" />
      <span className="truncate">{field.name}</span>
    </span>
  );
}

function FieldWorkspaceCard({
  field,
  onEdit,
  onToggle,
  onDuplicate,
  onDelete,
  toggling,
}: {
  field: ExtraFieldDefinition;
  onEdit: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  toggling: boolean;
}) {
  const Icon = fieldTypeIcon(field.field_type);
  const typeLabel =
    FIELD_TYPES.find((t) => t.value === field.field_type)?.label ?? field.field_type ?? "Texto";
  const opts = parseFieldOptions(field.options);

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 transition-all hover:border-primary/30",
        field.is_active === false && "bg-muted/30 opacity-60",
      )}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-foreground">
                  {field.name}
                </span>
                {field.is_required && (
                  <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                    Obligatorio
                  </span>
                )}
                {field.display_in_card && (
                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                    Perfil 360
                  </span>
                )}
              </div>
              {field.description?.trim() ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {field.description}
                </p>
              ) : null}
            </div>
          </div>

          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {typeLabel}
          </span>
        </div>

        {/* Options tags if SELECT or MULTISELECT */}
        {opts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {opts.map((opt, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {opt.label || opt.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions toolbar */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
        <span className="text-[11px] text-muted-foreground">
          {field.is_active === false ? "Campo desactivado" : "Activo"}
        </span>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
            Editar
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onDuplicate}
            title="Duplicar campo"
          >
            <Copy className="h-3 w-3" />
            Duplicar
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            disabled={toggling}
            onClick={onToggle}
          >
            <Power className="h-3 w-3" />
            {field.is_active === false ? "Activar" : "Pausar"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
            title="Eliminar campo"
            onClick={() => {
              if (window.confirm(`¿Estás seguro de eliminar el campo "${field.name}"?`)) {
                onDelete();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionWorkspace({
  group,
  fields,
  surveys,
  publishing,
  togglingSurvey,
  togglingField,
  onBack,
  onEditGroup,
  onAddField,
  onPublish,
  onCopy,
  onToggleSurvey,
  onEditField,
  onToggleField,
  onDuplicateField,
  onDeleteField,
}: {
  group: ExtraFieldGroup;
  fields: ExtraFieldDefinition[];
  surveys: SurveyList[];
  publishing: boolean;
  togglingSurvey: boolean;
  togglingField: boolean;
  onBack: () => void;
  onEditGroup: () => void;
  onAddField: () => void;
  onPublish: () => void;
  onCopy: (slug: string) => void;
  onToggleSurvey: (survey: SurveyList) => void;
  onEditField: (field: ExtraFieldDefinition) => void;
  onToggleField: (field: ExtraFieldDefinition) => void;
  onDuplicateField: (field: ExtraFieldDefinition) => void;
  onDeleteField: (id: string) => void;
}) {
  const published = surveys.some((survey) => survey.status === "ACTIVE");
  const totalResponses = surveys.reduce((sum, s) => sum + (s.response_count ?? 0), 0);
  const [tab, setTab] = useState<"fields" | "preview" | "responses" | "share">("fields");
  const toast = useToast();

  return (
    <div className="flex flex-col gap-4">
      {/* Top breadcrumb navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a todas las Fichas
        </button>
      </div>

      {/* Section Header Card */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-foreground sm:text-xl">
                    {group.name}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      published
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {published ? "Ficha Online Activa" : "Ficha Interna"}
                  </span>
                </div>
                {group.description?.trim() ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {group.description}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs italic text-muted-foreground/60">
                    Sin descripción configurada.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={onEditGroup}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar Ficha
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={onAddField}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo Campo
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={publishing || fields.length === 0}
              isLoading={publishing}
              onClick={onPublish}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {published ? "Nuevo Link Público" : "Publicar Online"}
            </Button>
          </div>
        </div>

        {/* 4 Tabs Segmented Control */}
        <div className="mt-4 flex flex-wrap border-b border-border">
          <button
            type="button"
            onClick={() => setTab("fields")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-xs font-semibold transition-colors",
              tab === "fields"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" />
            Campos de la Ficha
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground">
              {fields.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-xs font-semibold transition-colors",
              tab === "preview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Vista Previa en Vivo
          </button>
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
              {totalResponses}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("share")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-xs font-semibold transition-colors",
              tab === "share"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            Enlace Público & QR
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground">
              {surveys.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Fields Management */}
      {tab === "fields" && (
        <div>
          {fields.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Esta ficha aún no tiene campos"
              description="Configura los atributos técnicos que necesitas levantar para tus clientes o servicios."
              action={
                <Button size="sm" onClick={onAddField}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Agregar Primer Campo
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {fields.map((field) => (
                <FieldWorkspaceCard
                  key={field.id}
                  field={field}
                  onEdit={() => onEditField(field)}
                  onToggle={() => onToggleField(field)}
                  onDuplicate={() => onDuplicateField(field)}
                  onDelete={() => onDeleteField(field.id)}
                  toggling={togglingField}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Preview */}
      {tab === "preview" && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="mx-auto max-w-xl">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-semibold">Simulador de Ficha Pública</h3>
                <p className="text-xs text-muted-foreground">
                  Así visualiza el cliente la ficha al abrir el enlace web en su dispositivo.
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Vista Previa Interactiva
              </span>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4 shadow-sm sm:p-6">
              <SurveyFillForm
                survey={{
                  id: "preview",
                  title: group.name,
                  description: group.description || undefined,
                  survey_type: "CUSTOM",
                  status: "ACTIVE",
                  questions: questionsFromExtraFieldDefinitions(fields),
                  is_anonymous: false,
                }}
                mode="app"
                onSubmitted={() => {
                  toast.success("¡Formulario de prueba completado exitosamente!");
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Responses received */}
      {tab === "responses" && (
        <ResponseSheet surveys={surveys} fields={fields} />
      )}

      {/* Tab 4: Public Links & QR */}
      {tab === "share" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold">Levantamientos Públicos para Clientes</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Comparte estos enlaces directos con clientes o personal técnico en terreno.
              Cualquier dato enviado se registrará de inmediato en la ficha correspondiente.
            </p>

            {surveys.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center">
                <Globe className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">Aún no hay fichas públicas activas</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Publica esta ficha para generar un enlace web seguro accesible desde cualquier celular o navegador.
                </p>
                <Button
                  size="sm"
                  className="mt-3 gap-1.5"
                  disabled={publishing || fields.length === 0}
                  isLoading={publishing}
                  onClick={onPublish}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generar Enlace Público Ahora
                </Button>
              </div>
            ) : (
              <LevantamientoList
                items={surveys}
                onCopy={onCopy}
                onToggle={onToggleSurvey}
                toggling={togglingSurvey}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function exportResponsesToCSV(
  sectionTitle: string,
  columns: ExtraFieldDefinition[],
  rows: Array<{
    id: string;
    created?: string | null;
    client_name?: string | null;
    respondent_name?: string | null;
    survey_title?: string | null;
    answers?: unknown;
  }>,
) {
  if (rows.length === 0) return;
  const headers = ["Fecha", "Cliente / Respondiente", "Sección", ...columns.map((c) => c.name)];
  const csvLines = [headers.join(",")];

  for (const row of rows) {
    const createdStr = row.created
      ? new Date(row.created).toLocaleString("es-CL").replace(/"/g, '""')
      : "";
    const clientStr = `"${(row.client_name || row.respondent_name || "—").replace(/"/g, '""')}"`;
    const sectionStr = `"${(row.survey_title ?? "").replace(/^Levantamiento\s·\s/, "").replace(/"/g, '""')}"`;
    const fieldVals = columns.map((col) => {
      const val = answerForField(col, row.answers);
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvLines.push([`"${createdStr}"`, clientStr, sectionStr, ...fieldVals].join(","));
  }

  const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Ficha_${sectionTitle.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function QRDialog({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
  return (
    <AnimatedOverlay open onClose={onClose} zIndex="z-[80]" panelClassName="flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 text-center shadow-xl">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <QrCode className="h-5 w-5" />
        </div>
        <h3 className="mt-2 text-base font-bold text-foreground">Código QR para Clientes</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{title}</p>
        <div className="mt-4 flex justify-center rounded-xl border border-border bg-white p-4 shadow-inner">
          {/* eslint-disable-next-next/no-img-element */}
          <img src={qrUrl} alt="QR Code" className="h-44 w-44 rounded-lg object-contain" />
        </div>
        <p className="mt-3 truncate text-[11px] text-muted-foreground">{url}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void navigator.clipboard.writeText(url);
              toast.success("Enlace copiado al portapapeles");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar Link
          </Button>
          <Button size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </AnimatedOverlay>
  );
}

const SHEET_PAGE = 25;

function ResponseSheet({
  surveys,
  fields,
  groups,
}: {
  surveys: SurveyList[];
  fields: ExtraFieldDefinition[];
  groups?: ExtraFieldGroup[];
}) {
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [section, setSection] = useState("all");
  const [page, setPage] = useState(1);
  type SheetRow = {
    id: string;
    created?: string | null;
    client_name?: string | null;
    respondent_name?: string | null;
    survey_title?: string | null;
    answers?: unknown;
  };
  const [selectedRow, setSelectedRow] = useState<SheetRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchText(search.trim()), 300);
    function setSearchText(txt: string) {
      setQueryText(txt);
    }
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [queryText, section]);

  const sections = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const survey of surveys) {
      const label = (survey.title ?? "Sin título").replace(/^Levantamiento\s·\s/, "");
      const list = map.get(label) ?? [];
      list.push(survey.id);
      map.set(label, list);
    }
    return Array.from(map, ([label, ids]) => ({ label, ids }));
  }, [surveys]);

  const surveyIds =
    section === "all"
      ? surveys.map((survey) => survey.id)
      : (sections.find((item) => item.label === section)?.ids ?? []);

  const columns = useMemo(() => {
    if (section === "all" || !groups) return fields;
    const group = groups.find((item) => item.name === section);
    if (!group) return fields;
    return fields.filter((field) => String(field.group) === String(group.id));
  }, [section, fields, groups]);

  const sheetQuery = useQuery({
    queryKey: ["surveys", "responses", "sheet", surveyIds.join(","), queryText, page],
    queryFn: () =>
      fetchSurveyResponsePage({
        surveys: surveyIds,
        q: queryText || undefined,
        page,
        page_size: SHEET_PAGE,
      }),
    enabled: surveyIds.length > 0,
  });

  const count = sheetQuery.data?.count ?? 0;
  const rows = sheetQuery.data?.results ?? [];
  const pages = Math.max(1, Math.ceil(count / SHEET_PAGE));
  const from = count === 0 ? 0 : (page - 1) * SHEET_PAGE + 1;
  const to = Math.min(count, page * SHEET_PAGE);

  return (
    <section className="glass rounded-2xl p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Datos registrados</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={rows.length === 0}
            onClick={() => exportResponsesToCSV(section === "all" ? "Todas_las_secciones" : section, columns, rows)}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar persona o sección"
            className="h-8 w-full sm:w-56"
          />

          {sections.length > 1 ? (
            <div className="w-full sm:w-44">
              <Select value={section} onChange={(e) => setSection(e.target.value)} className="h-8 text-xs">
                <option value="all">Todas las secciones</option>
                {sections.map((item) => (
                  <option key={item.label} value={item.label}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
      </div>
      {surveys.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Publicá una sección para recibir datos.</p>
      ) : sheetQuery.isLoading ? (
        <Skeleton className="mt-3 h-40 w-full rounded-xl" />
      ) : count === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No hay envíos con ese filtro.</p>
      ) : (
        <>
          <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 z-30 w-28 bg-muted px-3 py-2 font-medium">Fecha</th>
                  <th className="sticky left-28 z-30 min-w-36 bg-muted px-3 py-2 font-medium">Quién</th>
                  <th className="px-3 py-2 font-medium">Sección</th>
                  {columns.map((field) => (
                    <th key={field.id} className="px-3 py-2 font-medium">
                      {field.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRow(row)}
                    className="group cursor-pointer border-b border-border last:border-0 hover:bg-primary/5 transition-colors"
                  >
                    <td className="sticky left-0 w-28 bg-card px-3 py-2 text-xs tabular-nums text-muted-foreground group-hover:bg-muted">
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
                    <td className="sticky left-28 min-w-36 bg-card px-3 py-2 text-sm font-medium group-hover:bg-muted">
                      {row.client_name || row.respondent_name || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {(row.survey_title ?? "").replace(/^Levantamiento\s·\s/, "") || "—"}
                    </td>
                    {columns.map((field) => (
                      <td key={field.id} className="max-w-[14rem] truncate px-3 py-2 text-xs">
                        {answerForField(field, row.answers)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs tabular-nums text-muted-foreground">
              {from}–{to} de {count}
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={page >= pages}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Modal de Detalle de Respuesta de Ficha */}
      {selectedRow && (
        <AnimatedOverlay
          open
          onClose={() => setSelectedRow(null)}
          zIndex="z-[75]"
          panelClassName="flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Ficha de {selectedRow.client_name || selectedRow.respondent_name || "Cliente"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {(selectedRow.survey_title ?? "").replace(/^Levantamiento\s·\s/, "")} ·{" "}
                  {selectedRow.created
                    ? new Date(selectedRow.created).toLocaleString("es-CL")
                    : "Sin fecha"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid gap-2 sm:grid-cols-2">
                {columns.map((col) => {
                  const val = answerForField(col, selectedRow.answers);
                  return (
                    <div
                      key={col.id}
                      className="rounded-xl border border-border bg-card p-3 shadow-2xs"
                    >
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {col.name}
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-foreground whitespace-pre-wrap break-words">
                        {val}
                      </dd>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-3">
              <Button size="sm" variant="outline" onClick={() => setSelectedRow(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </AnimatedOverlay>
      )}
    </section>
  );
}

function registeredValue(raw: unknown): string {
  if (raw === true || raw === "true") return "Sí";
  if (raw === false || raw === "false") return "No";
  if (raw === null || raw === undefined || raw === "") return "—";
  if (Array.isArray(raw)) return raw.map((item) => String(item)).join(", ");
  return String(raw);
}

function answerForField(field: ExtraFieldDefinition, answers: unknown): string {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return "—";
  const map = answers as Record<string, unknown>;
  const raw = map[field.key] ?? map[field.id.slice(0, 8)] ?? map[field.id];
  return registeredValue(raw);
}

function surveyStatusClass(status?: string | null): string {
  if (status === "ACTIVE") return "bg-success/10 text-success";
  if (status === "PAUSED") return "bg-warning/10 text-warning";
  if (status === "CLOSED") return "bg-danger/10 text-danger";
  return "bg-muted text-muted-foreground";
}

function LevantamientoList({
  items,
  onCopy,
  onToggle,
  toggling,
}: {
  items: SurveyList[];
  onCopy: (slug: string) => void;
  onToggle: (survey: SurveyList) => void;
  toggling: boolean;
}) {
  const [qrSurvey, setQrSurvey] = useState<SurveyList | null>(null);
  if (items.length === 0) return null;
  return (
    <>
      <ul className="mt-3 divide-y divide-border">
        {items.map((survey) => (
          <li key={survey.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  surveyStatusClass(survey.status),
                )}
              >
                {surveyStatusLabel(survey.status)}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {survey.response_count ?? 0} respuestas
              </span>
            </div>
            <div className="flex shrink-0 gap-1">
              {survey.slug ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() =>
                      window.open(
                        publicSurveyAbsoluteUrl(survey.slug!),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Abrir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setQrSurvey(survey)}
                  >
                    <QrCode className="h-3.5 w-3.5 text-primary" />
                    Ver QR
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => onCopy(survey.slug!)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar Link
                  </Button>
                </>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={toggling}
                onClick={() => onToggle(survey)}
              >
                {survey.status === "ACTIVE" ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {survey.status === "ACTIVE" ? "Pausar" : "Activar"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {qrSurvey && qrSurvey.slug ? (
        <QRDialog
          url={publicSurveyAbsoluteUrl(qrSurvey.slug)}
          title={qrSurvey.title || "Ficha Pública"}
          onClose={() => setQrSurvey(null)}
        />
      ) : null}
    </>
  );
}

