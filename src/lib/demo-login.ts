/**
 * Credenciales públicas de demos (landing-config → use_cases).
 *
 * El login de sucursales demo debe mostrar email/clave y permitir rellenar
 * el formulario. La fuente canónica es GET /public/landing-config/?group=…
 * (campos demo_user / demo_password); no hardcodear secretos en el front.
 */

export interface DemoUseCaseCredentials {
  slug: string;
  name?: string;
  brandColor?: string;
  demoUser: string;
  demoPassword: string;
}

/** Shape mínima de un ítem use_cases del landing-config público. */
export interface DemoUseCaseSource {
  slug?: string | null;
  name?: string | null;
  brand_color?: string | null;
  demo_user?: string | null;
  demo_password?: string | null;
  active?: boolean | null;
}

/**
 * Busca credenciales de una demo activa por slug de login.
 * Devuelve null si el caso no existe, está inactivo o faltan claves.
 */
export function findDemoCredentials(
  useCases: DemoUseCaseSource[] | null | undefined,
  slug: string | null | undefined,
): DemoUseCaseCredentials | null {
  const key = (slug ?? "").trim().toLowerCase();
  if (!key || !useCases?.length) return null;

  const match = useCases.find(
    (item) => (item.slug ?? "").trim().toLowerCase() === key,
  );
  if (!match || match.active === false) return null;

  const demoUser = (match.demo_user ?? "").trim();
  const demoPassword = (match.demo_password ?? "").trim();
  if (!demoUser || !demoPassword) return null;

  return {
    slug: (match.slug ?? key).trim(),
    name: match.name?.trim() || undefined,
    brandColor: match.brand_color?.trim() || undefined,
    demoUser,
    demoPassword,
  };
}
