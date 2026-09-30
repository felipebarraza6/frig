import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type SupportTicketList = YggdraSchemas["TicketList"];
export type SupportTicketDetail = YggdraSchemas["TicketDetail"];
export type SupportTicketCreate = YggdraSchemas["TicketCreateUpdateRequest"];
export type SupportTicketCategory = YggdraSchemas["TicketCategory"];
export type SupportTicketType = YggdraSchemas["TicketType"];
export type SupportTicketComment = YggdraSchemas["TicketComment"];
export type SupportSlaPolicy = YggdraSchemas["SLAPolicy"];

export type SupportTicketPriority = NonNullable<SupportTicketCreate["priority"]>;
export type SupportTicketStatus = NonNullable<SupportTicketList["status"]>;

/** Tipos de consulta de la UI FRIG (se mapean a categorías del API). */
export type SupportInquiryKind =
  | "doubt"
  | "incident"
  | "claim"
  | "feedback"
  | "manual";

export const SUPPORT_INQUIRY_OPTIONS: {
  value: SupportInquiryKind;
  label: string;
  categoryName: string;
  priority: SupportTicketPriority;
  subjectPrefix: string;
}[] = [
  {
    value: "doubt",
    label: "Duda",
    categoryName: "Duda",
    priority: "MEDIUM",
    subjectPrefix: "[Duda]",
  },
  {
    value: "incident",
    label: "Incidencia",
    categoryName: "Incidencia",
    priority: "HIGH",
    subjectPrefix: "[Incidencia]",
  },
  {
    value: "claim",
    label: "Reclamo",
    categoryName: "Reclamo",
    priority: "HIGH",
    subjectPrefix: "[Reclamo]",
  },
  {
    value: "feedback",
    label: "Feedback",
    categoryName: "Feedback",
    priority: "LOW",
    subjectPrefix: "[Feedback]",
  },
  {
    value: "manual",
    label: "Manual o guía",
    categoryName: "Manual",
    priority: "LOW",
    subjectPrefix: "[Manual]",
  },
];

function asList<T>(data: T[] | { results?: T[] } | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

/** GET /api/support/categories/ */
export async function fetchSupportCategories(): Promise<SupportTicketCategory[]> {
  const data = await apiFetch<SupportTicketCategory[] | { results?: SupportTicketCategory[] }>(
    "/support/categories/?page_size=100",
  );
  return asList(data).filter((c) => c.is_active !== false);
}

/** POST /api/support/categories/ — seed mínimo si la sucursal no tiene categorías. */
export async function createSupportCategory(payload: {
  name: string;
  description?: string;
  color?: string;
  /** El API exige branch en create (UUID/id de sucursal). */
  branch: number;
}): Promise<SupportTicketCategory> {
  return apiFetch<SupportTicketCategory>("/support/categories/", {
    method: "POST",
    body: payload,
  });
}

/**
 * Seeds de soporte (categorías + SLA) corriendo UNA vez por sucursal y
 * sesión, fuera de los queryFn: React Query puede re-ejecutar un queryFn
 * (retry, remount, refetch) y los POST repetidos producían carreras.
 */
const supportBootstrapPromises = new Map<string, Promise<unknown>>();

export function bootstrapFrigSupport(branchId: number, productName?: string) {
  const key = `${branchId}|${productName ?? ""}`;
  let promise = supportBootstrapPromises.get(key);
  if (!promise) {
    promise = Promise.allSettled([
      ensureFrigSupportCategories(branchId, productName),
      ensureFrigSlaPolicy(branchId, productName),
    ]);
    supportBootstrapPromises.set(key, promise);
  }
  return promise;
}

/**
 * Asegura las 4 categorías FRIG. Si ya existen (por nombre), las reutiliza.
 * Si el create falla por permisos, devuelve las que haya.
 */
export async function ensureFrigSupportCategories(
  branchId: number,
  productName = "App",
): Promise<SupportTicketCategory[]> {
  const existing = await fetchSupportCategories();
  const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]));
  const colors: Record<string, string> = {
    Duda: "#3b82f6",
    Incidencia: "#ef4444",
    Reclamo: "#f97316",
    Feedback: "#8b5cf6",
    Manual: "#10b981",
  };

  for (const opt of SUPPORT_INQUIRY_OPTIONS) {
    const key = opt.categoryName.toLowerCase();
    if (byName.has(key)) continue;
    try {
      const created = await createSupportCategory({
        name: opt.categoryName,
        description: `Casos de tipo ${opt.label} · ${productName}`,
        color: colors[opt.categoryName] ?? "#1890ff",
        branch: branchId,
      });
      byName.set(key, created);
    } catch {
      // Sin permiso de crear categorías: se usa lo que ya exista.
    }
  }

  return Array.from(byName.values());
}

/** GET /api/support/sla-policies/ */
export async function fetchSupportSlaPolicies(): Promise<SupportSlaPolicy[]> {
  const data = await apiFetch<SupportSlaPolicy[] | { results?: SupportSlaPolicy[] }>(
    "/support/sla-policies/?page_size=50",
  );
  return asList(data).filter((p) => p.is_active !== false);
}

/**
 * El create de tickets exige una política SLA activa.
 * Si no hay ninguna, intenta crear una política de soporte por defecto.
 */
export async function ensureFrigSlaPolicy(
  branchId: number,
  productName = "App",
): Promise<SupportSlaPolicy | null> {
  const existing = await fetchSupportSlaPolicies();
  if (existing.length > 0) return existing[0] ?? null;
  try {
    return await apiFetch<SupportSlaPolicy>("/support/sla-policies/", {
      method: "POST",
      body: {
        branch: branchId,
        name: `Soporte ${productName}`,
        description: "Política por defecto para casos del local",
        response_time_low: 1440,
        response_time_medium: 480,
        response_time_high: 240,
        response_time_critical: 60,
        resolution_time_low: 10080,
        resolution_time_medium: 2880,
        resolution_time_high: 1440,
        resolution_time_critical: 480,
        escalation_time: 1440,
        is_active: true,
      },
    });
  } catch {
    return null;
  }
}

/** GET /api/support/ticket-types/ */
export async function fetchSupportTicketTypes(): Promise<SupportTicketType[]> {
  const data = await apiFetch<SupportTicketType[] | { results?: SupportTicketType[] }>(
    "/support/ticket-types/?page_size=100",
  );
  return asList(data).filter((t) => t.is_active !== false);
}

export interface SupportTicketsFilter {
  search?: string;
  status?: string;
  page_size?: number;
  requester_email?: string;
  client?: number | string;
}

/** GET /api/support/tickets/ */
export async function fetchSupportTickets(
  filter: SupportTicketsFilter = {},
): Promise<SupportTicketList[]> {
  const qs = new URLSearchParams();
  qs.set("page_size", String(filter.page_size ?? 50));
  if (filter.search) qs.set("search", filter.search);
  if (filter.status) qs.set("status", filter.status);
  if (filter.requester_email) qs.set("requester_email", filter.requester_email);
  if (filter.client != null) qs.set("client", String(filter.client));
  const data = await apiFetch<SupportTicketList[] | { results?: SupportTicketList[] }>(
    `/support/tickets/?${qs.toString()}`,
  );
  return asList(data);
}

/** GET /api/support/tickets/{id}/ */
export function fetchSupportTicket(id: string): Promise<SupportTicketDetail> {
  return apiFetch<SupportTicketDetail>(`/support/tickets/${id}/`);
}

/** Adjunto de ticket: archivo en API o data URL legado en custom_data. */
export interface SupportAttachment {
  id?: string;
  name: string;
  content_type: string;
  /** data URL pendiente de subir o legado. */
  data?: string;
  file_url?: string | null;
  size?: number;
  added_at?: string;
}

export interface SupportTicketCustomData {
  attachments?: SupportAttachment[];
  [key: string]: unknown;
}

export const SUPPORT_ATTACHMENT_MAX_FILES = 5;
export const SUPPORT_ATTACHMENT_MAX_BYTES = 1_800_000; // ~1.8 MB por archivo ya comprimido

export function parseTicketAttachments(customData: unknown): SupportAttachment[] {
  if (!customData || typeof customData !== "object") return [];
  const raw = (customData as SupportTicketCustomData).attachments;
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is SupportAttachment => {
    if (!a || typeof a !== "object") return false;
    const att = a as SupportAttachment;
    if (typeof att.name !== "string") return false;
    if (typeof att.data === "string" && att.data.startsWith("data:")) return true;
    if (typeof att.file_url === "string" && att.file_url) return true;
    return false;
  });
}

export function mergeTicketCustomData(
  existing: unknown,
  attachments: SupportAttachment[],
): SupportTicketCustomData {
  const base =
    existing && typeof existing === "object"
      ? ({ ...(existing as SupportTicketCustomData) } as SupportTicketCustomData)
      : ({} as SupportTicketCustomData);
  const prev = parseTicketAttachments(base);
  return {
    ...base,
    attachments: [...prev, ...attachments],
  };
}

/**
 * Lee un File y lo convierte a data URL.
 * Imágenes: redimensiona (máx. 1600px) y comprime JPEG para no inflar custom_data.
 */
export async function fileToSupportAttachment(file: File): Promise<SupportAttachment> {
  const isImage = file.type.startsWith("image/");
  if (isImage) {
    const data = await compressImageFile(file);
    return {
      name: file.name.replace(/\.\w+$/, ".jpg"),
      content_type: "image/jpeg",
      data,
      size: Math.round((data.length * 3) / 4),
      added_at: new Date().toISOString(),
    };
  }
  // PDF u otros: base64 directo con tope de tamaño.
  if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
    throw new Error(`"${file.name}" es demasiado grande (máx. ~1,5 MB).`);
  }
  const data = await readFileAsDataUrl(file);
  return {
    name: file.name,
    content_type: file.type || "application/octet-stream",
    data,
    size: file.size,
    added_at: new Date().toISOString(),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file: File): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  const img = await loadImage(raw);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, w, h);
  let quality = 0.82;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > SUPPORT_ATTACHMENT_MAX_BYTES && quality > 0.45) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  if (out.length > SUPPORT_ATTACHMENT_MAX_BYTES) {
    throw new Error(`"${file.name}" sigue siendo muy pesada. Prueba otra captura.`);
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

export interface CreateSupportTicketInput {
  subject: string;
  description: string;
  category: string;
  priority?: SupportTicketPriority;
  ticket_type?: string | null;
  sla_policy?: string | null;
  /** Cliente CRM asociado (reclamos / casos desde ficha 360). */
  client?: number | null;
  requester_email?: string;
  requester_name?: string;
  attachments?: SupportAttachment[];
}

interface TicketFileAttachmentRow {
  id?: string;
  ticket?: string;
  file?: string;
  file_url?: string | null;
  description?: string;
  created?: string;
}

function guessContentType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function fileRowToAttachment(row: TicketFileAttachmentRow): SupportAttachment {
  const url = row.file_url || row.file || "";
  const nameFromUrl = url.split("/").pop()?.split("?")[0] || "archivo";
  const name = row.description?.trim() || decodeURIComponent(nameFromUrl);
  return {
    id: row.id,
    name,
    content_type: guessContentType(name),
    file_url: url || null,
    added_at: row.created,
  };
}

/** GET /api/support/ticket-attachments/?ticket= */
export async function fetchTicketFileAttachments(
  ticketId: string,
): Promise<SupportAttachment[]> {
  const qs = new URLSearchParams();
  qs.set("ticket", ticketId);
  qs.set("page_size", "50");
  try {
    const data = await apiFetch<
      TicketFileAttachmentRow[] | { results?: TicketFileAttachmentRow[] }
    >(`/support/ticket-attachments/?${qs.toString()}`);
    return asList(data).map(fileRowToAttachment);
  } catch {
    return [];
  }
}

function dataUrlToFile(dataUrl: string, filename: string, contentType: string): File {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: contentType || "application/octet-stream" });
}

export async function uploadTicketAttachment(
  ticketId: string,
  attachment: SupportAttachment,
): Promise<SupportAttachment> {
  if (!attachment.data) {
    return attachment;
  }
  const file = dataUrlToFile(
    attachment.data,
    attachment.name,
    attachment.content_type,
  );
  const form = new FormData();
  form.append("ticket", ticketId);
  form.append("file", file);
  form.append("description", attachment.name);
  const row = await apiFetch<TicketFileAttachmentRow>("/support/ticket-attachments/", {
    method: "POST",
    body: form,
  });
  return fileRowToAttachment(row);
}

/** POST /api/support/tickets/ */
export async function createSupportTicket(
  payload: CreateSupportTicketInput,
): Promise<YggdraSchemas["TicketCreateUpdate"]> {
  const { attachments, ...rest } = payload;
  const body: SupportTicketCreate = {
    ...rest,
    source: "INTERNAL",
    ...(rest.client != null ? { client: rest.client } : {}),
  };
  const ticket = await apiFetch<YggdraSchemas["TicketCreateUpdate"]>("/support/tickets/", {
    method: "POST",
    body,
  });
  const id = String((ticket as { id?: string }).id ?? "");
  if (id && attachments && attachments.length > 0) {
    for (const att of attachments) {
      try {
        await uploadTicketAttachment(id, att);
      } catch {
        /* se conserva el ticket aunque un archivo falle */
      }
    }
  }
  return ticket;
}

/** Sube adjuntos al endpoint de archivos; si falla, guarda en custom_data. */
export async function appendTicketAttachments(
  ticketId: string,
  existingCustomData: unknown,
  attachments: SupportAttachment[],
): Promise<YggdraSchemas["TicketCreateUpdate"]> {
  if (attachments.length === 0) {
    return fetchSupportTicket(ticketId) as Promise<YggdraSchemas["TicketCreateUpdate"]>;
  }
  try {
    for (const att of attachments) {
      await uploadTicketAttachment(ticketId, att);
    }
    return fetchSupportTicket(ticketId) as Promise<YggdraSchemas["TicketCreateUpdate"]>;
  } catch {
    return apiFetch(`/support/tickets/${ticketId}/`, {
      method: "PATCH",
      body: {
        custom_data: mergeTicketCustomData(existingCustomData, attachments),
      },
    });
  }
}

export function mergeTicketAttachments(
  customData: unknown,
  files: SupportAttachment[],
): SupportAttachment[] {
  const fromCustom = parseTicketAttachments(customData);
  const seen = new Set(files.map((f) => f.id || f.file_url || f.name));
  const extras = fromCustom.filter((a) => !seen.has(a.id || a.file_url || a.name));
  return [...files, ...extras];
}

/** GET /api/support/comments/?ticket= */
export async function fetchTicketComments(ticketId: string): Promise<SupportTicketComment[]> {
  const qs = new URLSearchParams();
  qs.set("ticket", ticketId);
  qs.set("page_size", "100");
  const data = await apiFetch<SupportTicketComment[] | { results?: SupportTicketComment[] }>(
    `/support/comments/?${qs.toString()}`,
  );
  return asList(data).sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
  );
}

/** POST /api/support/comments/ — respuesta del solicitante (pública). */
export function createTicketComment(payload: {
  ticket: string;
  content: string;
}): Promise<SupportTicketComment> {
  return apiFetch<SupportTicketComment>("/support/comments/", {
    method: "POST",
    body: {
      ticket: payload.ticket,
      content: payload.content,
      visibility: "PUBLIC",
    },
  });
}

export type SupportWorkOrder = YggdraSchemas["WorkOrderDetail"];

export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Programada",
  IN_ROUTE: "En camino",
  ON_SITE: "En el local",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export function workOrderStatusLabel(status?: string | null): string {
  if (!status) return "—";
  return WORK_ORDER_STATUS_LABELS[status.toUpperCase()] ?? status;
}

/** GET /api/support/work-orders/?ticket= */
export async function fetchWorkOrdersForTicket(
  ticketId: string,
): Promise<SupportWorkOrder[]> {
  const qs = new URLSearchParams();
  qs.set("ticket", ticketId);
  qs.set("page_size", "20");
  const data = await apiFetch<SupportWorkOrder[] | { results?: SupportWorkOrder[] }>(
    `/support/work-orders/?${qs.toString()}`,
  );
  const list = asList(data);
  return list.filter((wo) => !ticketId || wo.ticket === ticketId);
}

export function slaDeadlineStatus(iso?: string | null): "ok" | "soon" | "late" | "none" {
  if (!iso) return "none";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "none";
  const hours = (t - Date.now()) / 3_600_000;
  if (hours < 0) return "late";
  if (hours <= 24) return "soon";
  return "ok";
}

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierta",
  IN_PROGRESS: "En curso",
  WAITING: "En espera",
  REVISION: "En revisión",
  PENDING_VISIT: "Visita técnica",
  RESOLVED: "Resuelta",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
};

export const SUPPORT_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export function supportStatusLabel(status?: string | null): string {
  if (!status) return "—";
  return SUPPORT_STATUS_LABELS[status.toUpperCase()] ?? status;
}

export function supportPriorityLabel(priority?: string | null): string {
  if (!priority) return "—";
  return SUPPORT_PRIORITY_LABELS[priority.toUpperCase()] ?? priority;
}

/** PATCH satisfacción del solicitante (1–5). */
export function updateTicketSatisfaction(
  id: string,
  payload: { satisfaction_score: number; satisfaction_comment?: string },
): Promise<YggdraSchemas["TicketCreateUpdate"]> {
  return apiFetch(`/support/tickets/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

/** Agrupa tickets por estado para KPIs / filtros. */
export function countTicketsByStatus(tickets: SupportTicketList[]): Record<string, number> {
  const counts: Record<string, number> = {
    ALL: tickets.length,
    OPEN: 0,
    IN_PROGRESS: 0,
    WAITING: 0,
    PENDING_VISIT: 0,
    RESOLVED: 0,
    CLOSED: 0,
    OTHER: 0,
  };
  for (const t of tickets) {
    const key = (t.status ?? "").toUpperCase();
    if (key in counts && key !== "ALL" && key !== "OTHER") {
      counts[key] = (counts[key] ?? 0) + 1;
    } else if (key) {
      counts.OTHER = (counts.OTHER ?? 0) + 1;
    }
  }
  return counts;
}

/** Estados “abiertos” donde el usuario aún puede responder. */
export function isSupportTicketOpen(status?: string | null): boolean {
  const key = (status ?? "").toUpperCase();
  return (
    key === "OPEN" ||
    key === "IN_PROGRESS" ||
    key === "WAITING" ||
    key === "REVISION" ||
    key === "PENDING_VISIT"
  );
}

export function canRateSupportTicket(ticket: {
  status?: string | null;
  satisfaction_score?: number | null;
}): boolean {
  const key = (ticket.status ?? "").toUpperCase();
  const done = key === "RESOLVED" || key === "CLOSED";
  return done && (ticket.satisfaction_score == null || ticket.satisfaction_score === 0);
}
