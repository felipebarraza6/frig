/**
 * Asset de `public/` con el prefijo del deploy.
 * En producción FTP es "/brand/x.png". En GitHub Pages es "/frig/brand/x.png".
 * Next no reescribe <img src> ni fetch() de canvas: hay que prefijar a mano.
 */
export function publicAsset(path: string): string {
  if (!path) return path;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!base || normalized === base || normalized.startsWith(`${base}/`)) return normalized;
  return `${base}${normalized}`;
}
