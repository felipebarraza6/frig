import { API_BASE, API_ORIGIN } from "./client";

/** Áreas de la API que usa la app (filtro ?app=). */
export const FRIG_API_APPS = [
  { id: "sales", label: "Ventas", blurb: "Pedidos, cobros, mesas, cocina y cotizaciones" },
  { id: "inventory", label: "Inventario", blurb: "Productos, combos, recintos, stock y compras" },
  { id: "accounts", label: "Usuarios", blurb: "Sesión y perfil del equipo" },
  { id: "branches", label: "Sucursales", blurb: "Locales, equipo, tema y módulos" },
  { id: "shared", label: "Configuración", blurb: "Ajustes compartidos del local" },
  { id: "finance", label: "Finanzas", blurb: "Caja, ingresos, egresos e impuestos" },
  { id: "bank_accounts", label: "Bancos", blurb: "Billeteras y conciliaciones" },
  { id: "invoices", label: "Facturación", blurb: "Boletas y documentos tributarios" },
  { id: "promotions", label: "Promociones", blurb: "Descuentos y cupones del POS" },
  { id: "recipes", label: "Recetas", blurb: "Fichas de receta e insumos" },
  { id: "nutrition", label: "Nutrición", blurb: "Tablas y etiquetado de productos" },
] as const;

export type FrigApiAppId = (typeof FRIG_API_APPS)[number]["id"];

export interface OpenApiInfo {
  title?: string;
  version?: string;
  description?: string;
}

export interface OpenApiTag {
  name: string;
  description?: string;
}

export interface OpenApiSchemaNode {
  type?: string | string[];
  format?: string;
  properties?: Record<string, OpenApiSchemaNode>;
  items?: OpenApiSchemaNode;
  required?: string[];
  enum?: unknown[];
  example?: unknown;
  default?: unknown;
  nullable?: boolean;
  allOf?: OpenApiSchemaNode[];
  oneOf?: OpenApiSchemaNode[];
  anyOf?: OpenApiSchemaNode[];
  $ref?: string;
  additionalProperties?: boolean | OpenApiSchemaNode;
  description?: string;
  title?: string;
  readOnly?: boolean;
  writeOnly?: boolean;
}

export interface OpenApiRequestBody {
  required?: boolean;
  content?: Record<
    string,
    {
      schema?: OpenApiSchemaNode;
      example?: unknown;
      examples?: Record<string, { value?: unknown }>;
    }
  >;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: unknown[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, unknown>;
  security?: unknown[];
}

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

export interface OpenApiPathItem {
  path: string;
  methods: Partial<Record<HttpMethod, OpenApiOperation>>;
}

export interface OpenApiDocument {
  openapi?: string;
  info?: OpenApiInfo;
  tags?: OpenApiTag[];
  paths?: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, unknown> };
}

const METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete", "head", "options"];

/**
 * Rutas que no se muestran en Ayuda → API: secretos, admin de plataforma,
 * bootstrap interno de la app y mesa de tickets.
 */
const SENSITIVE_PATH_RE = [
  /password/i,
  /magic[-_]?login/i,
  /magic[-_]?link/i,
  /otp|totp|mfa|2fa/i,
  /impersonat/i,
  /secret/i,
  /api[-_]?key/i,
  /certificate/i,
  /digital[_-]?cert/i,
  /apply-plan/i,
  /cancel-subscription/i,
  /frontend-config/i,
  /\/schema/i,
  /\/docs/i,
  /redoc/i,
  /invitation/i,
  /verify[-_]?email/i,
  /set[-_]?password/i,
  /change[-_]?password/i,
  /reset[-_]?password/i,
  /\/token\b/i,
  /auth[-_]?token/i,
  /\/support\//i,
  /plan-checkout\/groups/i,
  /module-plans/i,
  /celery/i,
  /debug/i,
];

const SENSITIVE_OP_RE =
  /superadmin|super.?admin|solo superadministr|imperson|certificado digital|contraseña/i;

const SENSITIVE_FIELD_RE =
  /password|passwd|secret|token|otp|api_key|apikey|certificate|private_key|refresh/i;

export function isSensitiveOpenApiPath(path: string): boolean {
  return SENSITIVE_PATH_RE.some((re) => re.test(path));
}

function isSensitiveOperation(
  path: string,
  method: HttpMethod,
  op: OpenApiOperation,
): boolean {
  if (isSensitiveOpenApiPath(path)) return true;
  const blob = `${op.summary ?? ""} ${op.description ?? ""} ${op.operationId ?? ""}`;
  if (SENSITIVE_OP_RE.test(blob)) return true;
  const p = path.toLowerCase();
  if (p.includes("/accounts/users") && !p.includes("login")) {
    if (method !== "get") return true;
  }
  return false;
}

export function openApiDocsUrl(app?: string): string {
  if (app) return `${API_ORIGIN}/api/docs/${app}/`;
  return `${API_ORIGIN}/api/docs/`;
}

export function openApiRedocUrl(app?: string): string {
  if (app) return `${API_ORIGIN}/api/redoc/${app}/`;
  return `${API_ORIGIN}/api/redoc/`;
}

export function openApiSchemaUrl(app?: string): string {
  const qs = new URLSearchParams({ format: "json" });
  if (app) qs.set("app", app);
  return `${API_BASE}/schema/?${qs.toString()}`;
}

export async function fetchOpenApiSchema(app?: string): Promise<OpenApiDocument> {
  const res = await fetch(openApiSchemaUrl(app), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`No se pudo cargar el schema (${res.status})`);
  }
  return (await res.json()) as OpenApiDocument;
}

export function listOpenApiPaths(doc: OpenApiDocument): OpenApiPathItem[] {
  const paths = doc.paths ?? {};
  return Object.keys(paths)
    .sort()
    .map((path) => {
      const item = paths[path] ?? {};
      const methods: OpenApiPathItem["methods"] = {};
      for (const m of METHODS) {
        const op = item[m];
        if (!op) continue;
        if (isSensitiveOperation(path, m, op)) continue;
        methods[m] = op;
      }
      return { path, methods };
    })
    .filter((p) => Object.keys(p.methods).length > 0);
}

export function filterPathsByQuery(
  paths: OpenApiPathItem[],
  query: string,
): OpenApiPathItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return paths;
  return paths.filter((p) => {
    if (p.path.toLowerCase().includes(q)) return true;
    return Object.values(p.methods).some((op) => {
      if (!op) return false;
      return (
        (op.summary ?? "").toLowerCase().includes(q) ||
        (op.operationId ?? "").toLowerCase().includes(q) ||
        (op.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  });
}

export function groupPathsByTag(paths: OpenApiPathItem[]): Map<string, OpenApiPathItem[]> {
  const map = new Map<string, OpenApiPathItem[]>();
  for (const p of paths) {
    const tags = new Set<string>();
    for (const op of Object.values(p.methods)) {
      if (!op?.tags?.length) {
        tags.add("Sin tag");
        continue;
      }
      op.tags.forEach((t) => tags.add(t));
    }
    if (tags.size === 0) tags.add("Sin tag");
    for (const tag of tags) {
      const list = map.get(tag) ?? [];
      list.push(p);
      map.set(tag, list);
    }
  }
  return map;
}

export const METHOD_TONE: Record<HttpMethod, string> = {
  get: "bg-success/12 text-success border-success/20",
  post: "bg-primary/12 text-primary border-primary/20",
  put: "bg-warning/12 text-warning border-warning/20",
  patch: "bg-warning/12 text-warning border-warning/20",
  delete: "bg-danger/12 text-danger border-danger/20",
  head: "bg-muted text-muted-foreground border-border",
  options: "bg-muted text-muted-foreground border-border",
};

export const METHOD_LABEL: Record<HttpMethod, string> = {
  get: "Leer",
  post: "Crear",
  put: "Reemplazar",
  patch: "Actualizar",
  delete: "Eliminar",
  head: "Head",
  options: "Options",
};

export function methodNeedsBody(method: HttpMethod): boolean {
  return method === "post" || method === "put" || method === "patch";
}

function resolveRef(
  ref: string,
  components?: Record<string, OpenApiSchemaNode>,
): OpenApiSchemaNode | null {
  // "#/components/schemas/OrderRequest"
  const name = ref.split("/").pop();
  if (!name || !components) return null;
  return components[name] ?? null;
}

function derefSchema(
  schema: OpenApiSchemaNode | undefined,
  components?: Record<string, OpenApiSchemaNode>,
  stack: Set<string> = new Set(),
): OpenApiSchemaNode | null {
  if (!schema) return null;
  if (schema.$ref) {
    if (stack.has(schema.$ref)) return { type: "object" };
    const resolved = resolveRef(schema.$ref, components);
    if (!resolved) return { type: "object" };
    const next = new Set(stack);
    next.add(schema.$ref);
    return derefSchema(resolved, components, next) ?? resolved;
  }
  if (schema.allOf?.length) {
    const merged: OpenApiSchemaNode = { type: "object", properties: {}, required: [] };
    for (const part of schema.allOf) {
      const d = derefSchema(part, components, stack);
      if (!d) continue;
      merged.properties = { ...merged.properties, ...(d.properties ?? {}) };
      merged.required = [...(merged.required ?? []), ...(d.required ?? [])];
      if (d.example !== undefined && merged.example === undefined) merged.example = d.example;
    }
    return merged;
  }
  if (schema.oneOf?.length) return derefSchema(schema.oneOf[0], components, stack);
  if (schema.anyOf?.length) return derefSchema(schema.anyOf[0], components, stack);
  return schema;
}

/** Genera un valor de ejemplo a partir de un nodo OpenAPI. */
export function buildExampleFromSchema(
  schema: OpenApiSchemaNode | undefined,
  components?: Record<string, OpenApiSchemaNode>,
  depth = 0,
): unknown {
  if (depth > 6) return null;
  const node = derefSchema(schema, components);
  if (!node) return null;
  if (node.example !== undefined) return node.example;
  if (node.default !== undefined) return node.default;
  if (node.enum?.length) return node.enum[0];

  const types = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];
  const type = types.find((t) => t !== "null") ?? types[0];

  if (type === "array") {
    const item = buildExampleFromSchema(node.items, components, depth + 1);
    return item === null ? [] : [item];
  }

  if (type === "object" || node.properties) {
    const obj: Record<string, unknown> = {};
    const props = node.properties ?? {};
    const required = new Set(node.required ?? []);
    const keys = Object.keys(props);
    // Preferir required; si no hay, tomar hasta 8 campos escribibles.
    const pick = keys.filter(
      (k) => !props[k]?.readOnly && !SENSITIVE_FIELD_RE.test(k),
    );
    const ordered = [
      ...pick.filter((k) => required.has(k)),
      ...pick.filter((k) => !required.has(k)),
    ].slice(0, 12);
    for (const key of ordered) {
      obj[key] = buildExampleFromSchema(props[key], components, depth + 1);
    }
    return obj;
  }

  if (type === "integer" || type === "number") {
    if (node.format === "float" || node.format === "double") return 1.0;
    return 1;
  }
  if (type === "boolean") return true;
  if (type === "string") {
    if (node.format === "date") return "2026-01-15";
    if (node.format === "date-time") return "2026-01-15T12:00:00";
    if (node.format === "email") return "usuario@ejemplo.com";
    if (node.format === "uuid") return "00000000-0000-0000-0000-000000000001";
    if (node.format === "uri" || node.format === "url") return "https://ejemplo.com";
    if (node.format === "binary") return "<archivo>";
    return "texto";
  }
  if (node.nullable) return null;
  return null;
}

/**
 * Extrae un JSON de ejemplo del requestBody (application/json).
 * Si no hay body (GET/DELETE), retorna null.
 */
export function buildRequestBodyExample(
  operation: OpenApiOperation | null | undefined,
  doc?: OpenApiDocument | null,
): unknown | null {
  if (!operation?.requestBody) return null;
  const content = operation.requestBody.content ?? {};
  const json =
    content["application/json"] ??
    content["application/*+json"] ??
    Object.values(content)[0];
  if (!json) return {};
  if (json.example !== undefined) return json.example;
  const examples = json.examples;
  if (examples) {
    const first = Object.values(examples)[0];
    if (first?.value !== undefined) return first.value;
  }
  const components = doc?.components?.schemas as Record<string, OpenApiSchemaNode> | undefined;
  return buildExampleFromSchema(json.schema, components) ?? {};
}

export function formatExampleJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** URL absoluta del endpoint lista para pegar. */
export function absoluteEndpointUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Reglas claras de uso de la API (sin jerga innecesaria). */
export const FRIG_API_CONTRACT = {
  scope: {
    title: "Alcance",
    lines: [
      "Solo lo que la app usa: ventas, catálogo, inventario, dinero, sucursal y marca.",
      "Si el módulo está apagado en el local, la API también lo niega.",
      "Soporte a personas se gestiona en Ayuda → Soporte, no en esta consola.",
    ],
  },
  auth: {
    title: "Cómo entrar",
    lines: [
      "Inicia sesión con un usuario del local. La respuesta trae un token.",
      "En cada llamada envía el token y el identificador de sucursal.",
      "Guarda el token como secreto. No lo dejes en código público ni en capturas.",
    ],
  },
  tenant: {
    title: "Sucursal",
    lines: [
      "Los datos son del local del encabezado. No mezcles sucursales en una misma petición.",
      "Usa el id que te asignaron. Operar otro local sin permiso falla.",
    ],
  },
  lists: {
    title: "Listados",
    lines: [
      "Las listas vienen en páginas: results, count, next y previous.",
      "Eliminar suele desactivar el registro, no borrarlo del todo.",
    ],
  },
  errors: {
    title: "Si algo falla",
    lines: [
      "401: vuelve a iniciar sesión.",
      "403: tu rol o el módulo del local no alcanza.",
      "400: revisa el JSON de ejemplo de esa ruta.",
      "404: el recurso no existe en esa sucursal.",
    ],
  },
} as const;
