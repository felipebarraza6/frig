import type { RoleDefinition } from "@/lib/types";

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN_LOCAL: "Administrador local",
  MANAGER: "Gerente",
  EMPLOYEE: "Empleado",
  EMPLEADO: "Empleado",
  CAJERO: "Cajero",
  WAITER: "Mesero",
  MESERO: "Mesero",
  REPARTIDOR: "Repartidor",
  COURIER: "Repartidor",
  COCINERO: "Cocinero",
  COOK: "Cocinero",
};

export function getRoleLabel(code?: string | null): string | undefined {
  if (!code) return undefined;
  // El backend puede devolver el código en minúsculas (ej: "admin_local").
  const normalized = code.toUpperCase();
  return ROLE_LABELS[normalized] ?? ROLE_LABELS[code] ?? code;
}

/**
 * Roles del producto FRIG. Los roles operativos dependen de un módulo:
 * solo se ofrecen cuando ese módulo está activo en la sucursal. Los roles
 * base (propietario, administrador local, empleado) van siempre.
 * Evita ofrecer roles de otras apps del backend (Yggdra/mapps).
 */
const FRIG_ROLE_CATALOG: { codes: string[]; label: string; module: string | null }[] = [
  { codes: ["OWNER"], label: "Propietario", module: null },
  { codes: ["ADMIN_LOCAL"], label: "Administrador local", module: null },
  { codes: ["EMPLOYEE", "EMPLEADO"], label: "Empleado", module: null },
  { codes: ["CAJERO"], label: "Cajero", module: "pos" },
  { codes: ["WAITER", "MESERO"], label: "Mesero", module: "tables" },
  { codes: ["COCINERO", "COOK"], label: "Cocinero", module: "production" },
  { codes: ["REPARTIDOR", "COURIER"], label: "Repartidor", module: "deliveries" },
];

export interface FrigRoleOption {
  id: number | string;
  code: string;
  label: string;
}

/**
 * Cruza el catálogo FRIG con las RoleDefinition reales de la sucursal
 * (se necesita su id para invitar/cambiar rol) y con los módulos activos.
 */
export function frigRoleOptions(
  roles: RoleDefinition[],
  enabledModules: string[],
): FrigRoleOption[] {
  const enabled = new Set(enabledModules);
  const options: FrigRoleOption[] = [];
  for (const entry of FRIG_ROLE_CATALOG) {
    if (entry.module && !enabled.has(entry.module)) continue;
    const def = roles.find(
      (d) => d.code && entry.codes.includes(d.code.toUpperCase()),
    );
    if (def) options.push({ id: def.id, code: entry.codes[0], label: entry.label });
  }
  return options;
}
