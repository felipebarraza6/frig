/**
 * Validadores de formularios compartidos.
 *
 * Extraídos de `src/app/(app)/suppliers/page.tsx` (los más maduros de la app)
 * para que el resto de los formularios use la misma base sin duplicar lógica.
 * Sin dependencias externas.
 */

/** Mapa de errores por campo (campo → mensaje). */
export type FieldErrors<T = Record<string, string>> = Partial<Record<keyof T & string, string>>;

/** Primer mensaje de error del mapa, o `null` si no hay errores. */
export function firstError(errors: FieldErrors<Record<string, string>>): string | null {
  for (const key of Object.keys(errors)) {
    const message = errors[key];
    if (message) return message;
  }
  return null;
}

/* ── RUT chileno ─────────────────────────────────────────────────────────── */

/** Limpia un RUT dejando solo dígitos + K (sin formato). */
export function cleanRUT(value: string): string {
  return value.toUpperCase().replace(/[^0-9K]/g, "").slice(0, 9);
}

/** Formatea un RUT chileno: 12345678K → 12.345.678-K. */
export function formatRUT(value: string): string {
  const clean = cleanRUT(value);
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

/** Dígito verificador esperado para el cuerpo del RUT (módulo 11). */
function rutDV(body: string): string {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return "0";
  if (res === 10) return "K";
  return String(res);
}

/** Valida RUT chileno: cuerpo numérico de 7-8 dígitos y DV correcto. */
export function isValidRUT(value: string): boolean {
  const clean = cleanRUT(value);
  if (clean.length < 8) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d{7,8}$/.test(body)) return false;
  return rutDV(body) === dv;
}

/* ── Texto y contacto ────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,15}$/;

/** Email básico con dominio de al menos 2 caracteres. */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Teléfono chileno/internacional simple: + opcional, 8-16 dígitos con espacios o guiones. */
export function isValidPhoneCL(value: string): boolean {
  return PHONE_RE.test(value.trim());
}

/* ── Números ─────────────────────────────────────────────────────────────── */

/** Número finito mayor que 0 (montos, cantidades con decimales). */
export function isPositiveAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Entero mayor que 0 (cantidades, stock, etc.). */
export function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/** Número finito mayor o igual que 0 (descuentos, tolerancias, etc.). */
export function isNonNegativeNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/* ── Fechas ──────────────────────────────────────────────────────────────── */

/** Ambas fechas válidas e inicio estrictamente anterior a fin. */
export function isDateRangeValid(start: string, end: string): boolean {
  if (!start || !end) return false;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return false;
  return startTime < endTime;
}
