/**
 * Sin la env definida, `next build` (NODE_ENV=production) apunta a la API real
 * y solo `next dev` cae en el backend local. Así un build de producción
 * hecho a mano no publica una app que habla con localhost.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_YGGDRA_API_BASE ??
  (process.env.NODE_ENV === "production"
    ? "https://api.yggdra.cl/api"
    : "http://localhost:8000/api");

/** Origen del backend sin el prefijo /api (archivos servidos fuera de la API). */
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");
