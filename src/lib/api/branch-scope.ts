/**
 * Sucursal para X-Branch-ID cuando un admin gestiona otra sucursal
 * (p. ej. diálogo SII en /branches) sin cambiar la sucursal de sesión.
 */
let scopedBranchId: string | null = null;

export function setBranchApiScope(id: string | number | null) {
  scopedBranchId = id == null || id === "" ? null : String(id);
}

export function getBranchApiScope(): string | null {
  return scopedBranchId;
}

export function getEffectiveBranchId(sessionId?: string | null): string | null {
  return scopedBranchId ?? sessionId ?? null;
}
