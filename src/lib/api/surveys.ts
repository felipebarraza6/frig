import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type Survey = YggdraSchemas["Survey"] & { slug?: string | null };
export type SurveyList = YggdraSchemas["SurveyList"] & {
  slug?: string | null;
  questions?: unknown;
  description?: string | null;
  is_anonymous?: boolean;
  allow_multiple_responses?: boolean;
};
export type SurveyRequest = YggdraSchemas["SurveyRequest"] & { slug?: string | null };
export type SurveyResponse = YggdraSchemas["SurveyResponse"] & {
  workflow?: "DONE" | "QUOTED" | null;
};
export type SurveyType = NonNullable<Survey["survey_type"]>;
export type SurveyStatus = NonNullable<Survey["status"]>;

export interface PublicSurvey {
  id: string;
  title: string;
  slug: string;
  description?: string;
  survey_type?: SurveyType;
  questions?: unknown;
  is_anonymous?: boolean;
  allow_multiple_responses?: boolean;
  branch_name?: string;
}

export type SurveyQuestionType = "nps" | "rating" | "text" | "select" | "boolean" | "url" | "file";

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  label: string;
  required?: boolean;
  max?: number;
  options?: string[];
}

type Paginated<T> = { count?: number; next?: string | null; results?: T[] };

function asList<T>(data: T[] | Paginated<T> | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export function parseSurveyQuestions(raw: unknown): SurveyQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: SurveyQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const label = typeof row.label === "string" ? row.label : "";
    const type = String(row.type ?? "text") as SurveyQuestionType;
    if (!id || !label) continue;
    const q: SurveyQuestion = {
      id,
      type: ["nps", "rating", "text", "select", "boolean", "url", "file"].includes(type)
        ? type
        : "text",
      label,
      required: Boolean(row.required),
    };
    if (typeof row.max === "number") q.max = row.max;
    if (Array.isArray(row.options)) {
      q.options = row.options.filter((o): o is string => typeof o === "string");
    }
    out.push(q);
  }
  return out;
}

export function surveyTypeLabel(value?: string | null): string {
  switch (value) {
    case "NPS":
      return "Recomendación (Lealtad 0–10)";
    case "CSAT":
      return "Satisfacción de Atención (1–5 Estrellas)";
    case "CES":
      return "Nivel de Esfuerzo";
    case "CUSTOM":
      return "Encuesta Libre";
    default:
      return value || "Encuesta";
  }
}

export function surveyStatusLabel(value?: string | null): string {
  switch (value) {
    case "DRAFT":
      return "Borrador";
    case "ACTIVE":
      return "Activa";
    case "PAUSED":
      return "Pausada";
    case "CLOSED":
      return "Cerrada";
    default:
      return value || "—";
  }
}

/** Link interno (auth) para llenar la encuesta. */
export function surveyFillPath(surveyId: string, clientId?: number | null): string {
  const qs = new URLSearchParams({ id: surveyId });
  if (clientId) qs.set("client", String(clientId));
  return `/survey/fill?${qs.toString()}`;
}

export function surveyFillAbsoluteUrl(surveyId: string, clientId?: number | null): string {
  if (typeof window === "undefined") return surveyFillPath(surveyId, clientId);
  return `${window.location.origin}${surveyFillPath(surveyId, clientId)}`;
}

export type PublicSurveyClientLink = {
  c: number;
  t: string;
  e: number;
};

/** Link público (anónimo), patrón menú: dev usa query, prod usa path limpio. */
export function publicSurveyUrl(
  slug: string,
  clientLink?: PublicSurveyClientLink | null,
): string {
  const extra = clientLink
    ? `c=${clientLink.c}&t=${encodeURIComponent(clientLink.t)}&e=${clientLink.e}`
    : "";
  if (process.env.NODE_ENV === "development") {
    const base = `/survey/view?slug=${encodeURIComponent(slug)}`;
    return extra ? `${base}&${extra}` : base;
  }
  const path = `/survey/${encodeURIComponent(slug)}`;
  return extra ? `${path}?${extra}` : path;
}

export function publicSurveyAbsoluteUrl(
  slug: string,
  origin?: string,
  clientLink?: PublicSurveyClientLink | null,
): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${publicSurveyUrl(slug, clientLink)}`;
}

/** POST /surveys/surveys/{id}/client-link/ — token HMAC para WhatsApp personalizado. */
export async function createSurveyClientLink(
  surveyId: string,
  clientId: number,
  ttlSeconds?: number,
): Promise<{
  survey_id: string;
  slug: string;
  client: number;
  client_token: string;
  client_token_exp: number;
  query: string;
}> {
  return apiFetch(`/surveys/surveys/${surveyId}/client-link/`, {
    method: "POST",
    body: {
      client: clientId,
      ...(ttlSeconds != null ? { ttl_seconds: ttlSeconds } : {}),
    },
  });
}

export async function fetchPublicSurvey(slug: string): Promise<PublicSurvey> {
  return apiFetch<PublicSurvey>(`/surveys/public/${encodeURIComponent(slug)}/`, {
    auth: "none",
    branch: "none",
    credentials: "omit",
  });
}

export async function submitPublicSurveyResponse(
  slug: string,
  payload: {
    answers?: Record<string, unknown>;
    nps_score?: number | null;
    comment?: string;
    respondent_name?: string;
    respondent_email?: string;
    channel?: string;
    client?: number | null;
    client_token?: string;
    client_token_exp?: number | null;
  },
): Promise<SurveyResponse> {
  return apiFetch<SurveyResponse>(
    `/surveys/public/${encodeURIComponent(slug)}/respond/`,
    {
      method: "POST",
      body: { channel: "web", ...payload },
      auth: "none",
      branch: "none",
      credentials: "omit",
    },
  );
}

export function npsTemplateQuestions(): SurveyQuestion[] {
  return [
    {
      id: "nps",
      type: "nps",
      label: "Del 0 al 10, ¿qué tan probable es que nos recomiendes?",
      required: true,
    },
    {
      id: "comment",
      type: "text",
      label: "¿Qué podríamos mejorar?",
      required: false,
    },
  ];
}

export function csatTemplateQuestions(): SurveyQuestion[] {
  return [
    {
      id: "csat",
      type: "rating",
      label: "¿Cómo calificarías tu experiencia?",
      required: true,
      max: 5,
    },
    {
      id: "comment",
      type: "text",
      label: "Comentario (opcional)",
      required: false,
    },
  ];
}

export function cesTemplateQuestions(): SurveyQuestion[] {
  return [
    {
      id: "ces",
      type: "rating",
      label: "¿Qué tan fácil fue resolver lo que necesitabas? (1 = difícil, 5 = muy fácil)",
      required: true,
      max: 5,
    },
    {
      id: "obstacle",
      type: "text",
      label: "¿Qué te lo hizo difícil? (opcional)",
      required: false,
    },
  ];
}

export function customTemplateQuestions(): SurveyQuestion[] {
  return [
    {
      id: "need",
      type: "text",
      label: "¿Qué necesitás cotizar o resolver?",
      required: true,
    },
    {
      id: "details",
      type: "text",
      label: "Detalles, medidas o preferencias",
      required: false,
    },
    {
      id: "timing",
      type: "select",
      label: "¿Para cuándo lo necesitás?",
      required: false,
      options: ["Lo antes posible", "Esta semana", "Este mes", "Sin apuro"],
    },
  ];
}

export interface CustomSurveyTemplate {
  id: string;
  name: string;
  description?: string;
  survey_type: SurveyType;
  questions: SurveyQuestion[];
  created_at: string;
  is_system?: boolean;
}

export const DEFAULT_SYSTEM_TEMPLATES: CustomSurveyTemplate[] = [
  {
    id: "tmpl_system_custom",
    name: "Formulario / Levantamiento Libre",
    description: "Formulario personalizable para cualquier requerimiento o consulta de clientes.",
    survey_type: "CUSTOM",
    questions: customTemplateQuestions(),
    created_at: "2026-01-01T00:00:00.000Z",
    is_system: true,
  },
  {
    id: "tmpl_system_nps",
    name: "Encuesta de Recomendación (Lealtad 0 al 10)",
    description: "Mide qué tan probable es que el cliente recomiende tu empresa (Promotores 9-10 vs Detractores 0-6).",
    survey_type: "NPS",
    questions: npsTemplateQuestions(),
    created_at: "2026-01-01T00:00:00.000Z",
    is_system: true,
  },
  {
    id: "tmpl_system_csat",
    name: "Satisfacción de Atención o Visita (1 a 5 Estrellas)",
    description: "Calificación rápida de 1 a 5 estrellas para evaluar el servicio recibido tras una visita.",
    survey_type: "CSAT",
    questions: csatTemplateQuestions(),
    created_at: "2026-01-01T00:00:00.000Z",
    is_system: true,
  },
];

const CUSTOM_TEMPLATES_KEY = "frig_custom_survey_templates";

export function getStoredCustomTemplates(): CustomSurveyTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getAllTemplates(): CustomSurveyTemplate[] {
  const custom = getStoredCustomTemplates();
  return [...custom, ...DEFAULT_SYSTEM_TEMPLATES];
}

export function saveCustomTemplate(
  template: Omit<CustomSurveyTemplate, "id" | "created_at"> & { id?: string },
): CustomSurveyTemplate {
  const current = getStoredCustomTemplates();
  const id = template.id || `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newTmpl: CustomSurveyTemplate = {
    ...template,
    id,
    created_at: new Date().toISOString(),
  };
  const existingIdx = current.findIndex((t) => t.id === id);
  let updated: CustomSurveyTemplate[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = newTmpl;
  } else {
    updated = [newTmpl, ...current];
  }
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(updated));
  return newTmpl;
}

export function deleteCustomTemplate(id: string): void {
  const current = getStoredCustomTemplates();
  const updated = current.filter((t) => t.id !== id);
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(updated));
}

/** Arma preguntas de levantamiento CUSTOM desde campos de ficha. */
export function questionsFromExtraFieldDefinitions(
  defs: Array<{
    id: string;
    name: string;
    key?: string;
    field_type?: string | null;
    is_required?: boolean;
    options?: unknown;
  }>,
): SurveyQuestion[] {
  return defs.map((d) => {
    const t = (d.field_type ?? "TEXT").toUpperCase();
    let type: SurveyQuestionType = "text";
    if (t === "BOOLEAN") type = "boolean";
    else if (t === "SELECT" || t === "MULTISELECT") type = "select";
    else if (t === "URL") type = "url";
    else if (t === "FILE" || t === "IMAGE") type = "file";
    const q: SurveyQuestion = {
      id: d.key || d.id.slice(0, 8),
      type,
      label: d.name,
      required: Boolean(d.is_required),
    };
    if (type === "select") {
      const opts = Array.isArray(d.options)
        ? d.options
            .map((o) => {
              if (typeof o === "string") return o;
              if (o && typeof o === "object") {
                const row = o as { label?: unknown; value?: unknown };
                return String(row.label ?? row.value ?? "").trim();
              }
              return "";
            })
            .filter(Boolean)
        : [];
      q.options = opts.length > 0 ? opts : ["Opción 1", "Opción 2"];
    }
    return q;
  });
}

/** Resumen de respuestas para pegar en observación de cotización. */
export function formatSurveyAnswersForQuotation(
  title: string,
  questions: SurveyQuestion[],
  answers: unknown,
): string {
  const map =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? (answers as Record<string, unknown>)
      : {};
  const lines: string[] = [`Levantamiento: ${title}`];
  for (const q of questions) {
    const raw = map[q.id];
    if (raw === null || raw === undefined || raw === "") continue;
    const val =
      typeof raw === "boolean"
        ? raw
          ? "Sí"
          : "No"
        : Array.isArray(raw)
          ? raw.join(", ")
          : String(raw);
    lines.push(`· ${q.label}: ${val}`);
  }
  if (lines.length === 1) return "";
  return lines.join("\n");
}

export async function fetchSurveys(filter: {
  survey_type?: string;
  status?: string;
  page_size?: number;
} = {}): Promise<Paginated<SurveyList>> {
  const qs = new URLSearchParams();
  if (filter.survey_type) qs.set("survey_type", filter.survey_type);
  if (filter.status) qs.set("status", filter.status);
  qs.set("page_size", String(filter.page_size ?? 50));
  const q = qs.toString();
  return apiFetch<Paginated<SurveyList>>(`/surveys/surveys/${q ? `?${q}` : ""}`);
}

export async function fetchSurvey(id: string): Promise<Survey> {
  return apiFetch<Survey>(`/surveys/surveys/${id}/`);
}

/** El back exige slug en el alta. Si no viene, se arma desde el título. */
function publicSurveySlug(title: string): string {
  const base =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "encuesta";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`.slice(0, 80);
}

export async function createSurvey(payload: SurveyRequest): Promise<Survey> {
  return apiFetch<Survey>("/surveys/surveys/", {
    method: "POST",
    body: {
      ...payload,
      slug: payload.slug?.trim() || publicSurveySlug(payload.title || "encuesta"),
    },
  });
}

export async function updateSurvey(
  id: string,
  payload: Partial<SurveyRequest>,
): Promise<Survey> {
  return apiFetch<Survey>(`/surveys/surveys/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function activateSurvey(id: string): Promise<Survey> {
  return apiFetch<Survey>(`/surveys/surveys/${id}/activate/`, {
    method: "POST",
    body: {},
  });
}

export async function pauseSurvey(id: string): Promise<Survey> {
  return apiFetch<Survey>(`/surveys/surveys/${id}/pause/`, {
    method: "POST",
    body: {},
  });
}

export async function deleteSurvey(id: string): Promise<void> {
  return apiFetch<void>(`/surveys/surveys/${id}/`, {
    method: "DELETE",
  });
}

export interface SurveyNpsSummary {
  survey_id: string;
  survey_title: string;
  total_responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps_score: number;
  average_score: number;
}

export async function fetchSurveyNpsSummary(id: string): Promise<SurveyNpsSummary> {
  return apiFetch<SurveyNpsSummary>(`/surveys/surveys/${id}/nps-summary/`);
}

export async function fetchGlobalNpsSummary(): Promise<Omit<SurveyNpsSummary, "survey_id" | "survey_title"> & {
  total_responses: number;
}> {
  return apiFetch(`/surveys/responses/nps-global/`);
}

export async function fetchSurveyResponses(filter: {
  survey?: string;
  client?: number | string;
  page_size?: number;
} = {}): Promise<SurveyResponse[]> {
  const page = await fetchSurveyResponsePage(filter);
  return page.results;
}

export async function fetchSurveyResponsePage(filter: {
  survey?: string;
  surveys?: string[];
  client?: number | string;
  q?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<{ count: number; results: SurveyResponse[] }> {
  const qs = new URLSearchParams();
  if (filter.survey) qs.set("survey", filter.survey);
  if (filter.surveys?.length) qs.set("surveys", filter.surveys.join(","));
  if (filter.client != null) qs.set("client", String(filter.client));
  if (filter.q?.trim()) qs.set("q", filter.q.trim());
  qs.set("page", String(filter.page ?? 1));
  qs.set("page_size", String(filter.page_size ?? 25));
  qs.set("ordering", "-created");
  const data = await apiFetch<Paginated<SurveyResponse> | SurveyResponse[]>(
    `/surveys/responses/?${qs.toString()}`,
  );
  if (Array.isArray(data)) return { count: data.length, results: data };
  return { count: data.count ?? 0, results: data.results ?? [] };
}

export async function submitSurveyResponse(payload: {
  survey: string;
  answers?: Record<string, unknown>;
  nps_score?: number | null;
  comment?: string;
  client?: number | null;
  respondent_name?: string;
  respondent_email?: string;
  channel?: string;
}): Promise<SurveyResponse> {
  return apiFetch<SurveyResponse>("/surveys/responses/", {
    method: "POST",
    body: {
      channel: "web",
      ...payload,
    },
  });
}

/** PATCH respuesta (p. ej. asociar `client` a un levantamiento público). */
export async function updateSurveyResponse(
  id: string,
  payload: Partial<{
    client: number | null;
    answers: Record<string, unknown>;
    comment: string;
    workflow: "DONE" | "QUOTED";
    is_active: boolean;
  }>,
): Promise<SurveyResponse> {
  return apiFetch<SurveyResponse>(`/surveys/responses/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function createSurveyFromTemplate(input: {
  title: string;
  survey_type: SurveyType;
  description?: string;
}): SurveyRequest {
  const questions =
    input.survey_type === "NPS"
      ? npsTemplateQuestions()
      : input.survey_type === "CSAT"
        ? csatTemplateQuestions()
        : customTemplateQuestions();

  return {
    title: input.title,
    description: input.description ?? "",
    survey_type: input.survey_type,
    questions,
    status: "ACTIVE",
    is_anonymous: true,
    allow_multiple_responses: true,
  };
}

// ── Adjuntos (preguntas tipo archivo) ────────────────────────────────────────

export interface SurveyAttachmentRow {
  id: string;
  survey: string;
  client: string | number | null;
  url: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created: string;
}

/** Subida autenticada: la URL devuelta se guarda como valor de la pregunta. */
export async function uploadSurveyAttachment(
  surveyId: string,
  file: File,
): Promise<SurveyAttachmentRow> {
  const form = new FormData();
  form.append("survey", surveyId);
  form.append("file", file);
  return apiFetch<SurveyAttachmentRow>("/surveys/attachments/", {
    method: "POST",
    body: form,
  });
}

/** Subida anónima para formularios públicos (allowlist y tope 5MB en backend). */
export async function uploadPublicSurveyAttachment(
  slug: string,
  file: File,
): Promise<SurveyAttachmentRow> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<SurveyAttachmentRow>(`/surveys/public/${slug}/attach/`, {
    method: "POST",
    body: form,
    auth: "none",
    branch: "none",
    credentials: "omit",
  });
}

// ── Plantillas de encuesta (servidor, compartidas por sucursal) ──────────────

export interface SurveyTemplateRow {
  id: string;
  name: string;
  description: string;
  survey_type: string;
  questions: SurveyQuestion[];
  is_active: boolean;
  created: string;
  modified: string;
}

export async function fetchSurveyTemplates(): Promise<SurveyTemplateRow[]> {
  const data = await apiFetch<Paginated<SurveyTemplateRow> | SurveyTemplateRow[]>(
    "/surveys/templates/",
  );
  return asList(data);
}

export async function createSurveyTemplate(payload: {
  name: string;
  description?: string;
  survey_type?: string;
  questions: SurveyQuestion[];
}): Promise<SurveyTemplateRow> {
  return apiFetch<SurveyTemplateRow>("/surveys/templates/", {
    method: "POST",
    body: payload,
  });
}

export async function updateSurveyTemplate(
  id: string,
  payload: Partial<{ name: string; description: string; questions: SurveyQuestion[] }>,
): Promise<SurveyTemplateRow> {
  return apiFetch<SurveyTemplateRow>(`/surveys/templates/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteSurveyTemplate(id: string): Promise<void> {
  await apiFetch(`/surveys/templates/${id}/`, { method: "DELETE" });
}

/**
 * Migra las plantillas viejas de localStorage al servidor (una sola vez).
 * Devuelve true si migro algo, para refrescar la lista.
 */
export async function migrateLocalTemplatesToServer(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem("frig_custom_survey_templates");
  if (!raw) return false;
  let moved = false;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const tmpl = item as {
          name?: unknown;
          survey_type?: unknown;
          questions?: unknown;
        };
        if (
          typeof tmpl.name === "string" &&
          Array.isArray(tmpl.questions)
        ) {
          await createSurveyTemplate({
            name: tmpl.name,
            survey_type:
              typeof tmpl.survey_type === "string" ? tmpl.survey_type : "CUSTOM",
            questions: tmpl.questions as SurveyQuestion[],
          });
          moved = true;
        }
      }
    }
  } catch {
    // JSON corrupto: se descarta la migración.
  }
  if (moved) window.localStorage.removeItem("frig_custom_survey_templates");
  return moved;
}
