import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type ExtraFieldGroup = YggdraSchemas["ClientExtraFieldGroup"];
export type ExtraFieldDefinition = YggdraSchemas["ClientExtraFieldDefinition"];
export type ExtraFieldValue = YggdraSchemas["ClientExtraFieldValue"];

type Paginated<T> = { count?: number; next?: string | null; results?: T[] };

function asList<T>(data: T[] | Paginated<T> | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export function fieldTypeLabel(type?: string | null): string {
  const map: Record<string, string> = {
    TEXT: "Texto",
    NUMBER: "Número",
    INTEGER: "Entero",
    DECIMAL: "Decimal",
    DATE: "Fecha",
    DATETIME: "Fecha y hora",
    BOOLEAN: "Sí/No",
    SELECT: "Selección",
    MULTISELECT: "Múltiple",
    EMAIL: "Email",
    PHONE: "Teléfono",
    URL: "URL",
    FILE: "Archivo",
    IMAGE: "Imagen",
  };
  return map[type ?? ""] ?? type ?? "—";
}

function slugKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "campo";
}

export async function fetchExtraFieldGroups(): Promise<ExtraFieldGroup[]> {
  const data = await apiFetch<ExtraFieldGroup[] | Paginated<ExtraFieldGroup>>(
    "/customers/extra-field-groups/?page_size=50",
  );
  return asList(data).filter((g) => g.is_active !== false);
}

export async function createExtraFieldGroup(payload: {
  name: string;
  key?: string;
  description?: string;
  color?: string;
}): Promise<ExtraFieldGroup> {
  return apiFetch("/customers/extra-field-groups/", {
    method: "POST",
    body: {
      key: payload.key || slugKey(payload.name),
      color: "#1890ff",
      ...payload,
    },
  });
}

export async function updateExtraFieldGroup(
  id: string,
  payload: Partial<{
    name: string;
    description: string;
    color: string;
    is_active: boolean;
  }>,
): Promise<ExtraFieldGroup> {
  return apiFetch(`/customers/extra-field-groups/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteExtraFieldGroup(id: string): Promise<void> {
  await apiFetch(`/customers/extra-field-groups/${id}/`, { method: "DELETE" });
}

export type ExtraFieldOption = { value: string; label: string };

export function parseFieldOptions(raw: unknown): ExtraFieldOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as { value?: unknown; label?: unknown };
      const value = String(r.value ?? "").trim();
      const label = String(r.label ?? r.value ?? "").trim();
      if (!value) return null;
      return { value, label: label || value };
    })
    .filter((x): x is ExtraFieldOption => Boolean(x));
}

/** Texto de observación para cotización a partir de valores de ficha. */
export function formatFichaNotesForQuotation(
  rows: Array<{ groupName: string; fieldName: string; value: unknown }>,
): string {
  const filled = rows.filter((r) => {
    if (r.value === null || r.value === undefined) return false;
    if (typeof r.value === "string" && !r.value.trim()) return false;
    return true;
  });
  if (filled.length === 0) return "";
  const byGroup = new Map<string, string[]>();
  for (const r of filled) {
    const list = byGroup.get(r.groupName) ?? [];
    const val =
      typeof r.value === "boolean"
        ? r.value
          ? "Sí"
          : "No"
        : Array.isArray(r.value)
          ? r.value.join(", ")
          : String(r.value);
    list.push(`· ${r.fieldName}: ${val}`);
    byGroup.set(r.groupName, list);
  }
  const parts: string[] = ["Levantamiento / ficha del cliente:"];
  for (const [group, lines] of byGroup) {
    parts.push("", group, ...lines);
  }
  return parts.join("\n");
}

export async function fetchExtraFieldDefinitions(filter: {
  group?: string;
  includeInactive?: boolean;
} = {}): Promise<ExtraFieldDefinition[]> {
  const qs = new URLSearchParams();
  qs.set("page_size", "100");
  if (filter.group) qs.set("group", filter.group);
  if (filter.includeInactive) qs.set("show_inactive", "true");
  const data = await apiFetch<ExtraFieldDefinition[] | Paginated<ExtraFieldDefinition>>(
    `/customers/extra-field-definitions/?${qs.toString()}`,
  );
  const list = asList(data);
  if (filter.includeInactive) return list;
  return list.filter((d) => d.is_active !== false);
}

export async function createExtraFieldDefinition(payload: {
  name: string;
  key?: string;
  field_type?: string;
  group?: string | null;
  is_required?: boolean;
  display_in_card?: boolean;
  description?: string;
  options?: Array<{ value: string; label: string }>;
}): Promise<ExtraFieldDefinition> {
  return apiFetch("/customers/extra-field-definitions/", {
    method: "POST",
    body: {
      key: payload.key || slugKey(payload.name),
      field_type: payload.field_type ?? "TEXT",
      display_in_card: true,
      options: [],
      ...payload,
    },
  });
}

export async function updateExtraFieldDefinition(
  id: string,
  payload: Partial<{
    name: string;
    is_required: boolean;
    display_in_card: boolean;
    is_active: boolean;
    field_type: string;
    options: ExtraFieldOption[];
    description: string;
  }>,
): Promise<ExtraFieldDefinition> {
  return apiFetch(`/customers/extra-field-definitions/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteExtraFieldDefinition(id: string): Promise<void> {
  await apiFetch(`/customers/extra-field-definitions/${id}/`, { method: "DELETE" });
}

export async function fetchExtraFieldValuesForClient(
  clientId: number,
): Promise<ExtraFieldValue[]> {
  const data = await apiFetch<ExtraFieldValue[] | Paginated<ExtraFieldValue>>(
    `/customers/extra-field-values/?client=${clientId}&page_size=100`,
  );
  return asList(data);
}

export async function createExtraFieldValue(payload: {
  client: number;
  field_definition: string;
  value: unknown;
  notes?: string;
}): Promise<ExtraFieldValue> {
  return apiFetch("/customers/extra-field-values/", {
    method: "POST",
    body: payload,
  });
}

export async function updateExtraFieldValue(
  id: string,
  payload: { value?: unknown; notes?: string },
): Promise<ExtraFieldValue> {
  return apiFetch(`/customers/extra-field-values/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

/** Crea o actualiza el valor de un campo para el cliente. */
export async function upsertExtraFieldValue(input: {
  clientId: number;
  fieldDefinitionId: string;
  value: unknown;
  existingId?: string | null;
}): Promise<ExtraFieldValue> {
  if (input.existingId) {
    return updateExtraFieldValue(input.existingId, { value: input.value });
  }
  return createExtraFieldValue({
    client: input.clientId,
    field_definition: input.fieldDefinitionId,
    value: input.value,
  });
}

/**
 * Copia answers de un levantamiento (survey) a la ficha del cliente.
 * Match por `definition.key` === question id (así publica Fichas → levantamiento).
 * También prueba id corto (8 chars del uuid) por si el key no coincidió.
 */
export async function applySurveyAnswersToClientFicha(input: {
  clientId: number;
  answers: unknown;
  definitions: ExtraFieldDefinition[];
}): Promise<{ applied: number; skipped: number }> {
  const answers =
    input.answers && typeof input.answers === "object" && !Array.isArray(input.answers)
      ? (input.answers as Record<string, unknown>)
      : {};
  const existing = await fetchExtraFieldValuesForClient(input.clientId);
  const byDef = new Map(existing.map((v) => [String(v.field_definition), v]));

  let applied = 0;
  let skipped = 0;

  for (const def of input.definitions) {
    if (def.is_active === false) continue;
    const key = (def.key || "").trim();
    const shortId = def.id.slice(0, 8);
    const raw =
      (key && answers[key] !== undefined ? answers[key] : undefined) ??
      answers[shortId] ??
      answers[def.id];
    if (raw === undefined || raw === null || raw === "") {
      skipped += 1;
      continue;
    }
    const prev = byDef.get(def.id);
    await upsertExtraFieldValue({
      clientId: input.clientId,
      fieldDefinitionId: def.id,
      value: raw,
      existingId: prev?.id,
    });
    applied += 1;
  }

  return { applied, skipped };
}
