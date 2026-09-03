export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN_LOCAL: "Administrador",
  MANAGER: "Gerente",
  EMPLOYEE: "Empleado",
  CAJERO: "Cajero",
  WAITER: "Mesero",
};

export function getRoleLabel(code?: string | null): string | undefined {
  if (!code) return undefined;
  // El backend puede devolver el código en minúsculas (ej: "admin_local").
  const normalized = code.toUpperCase();
  return ROLE_LABELS[normalized] ?? ROLE_LABELS[code] ?? code;
}
