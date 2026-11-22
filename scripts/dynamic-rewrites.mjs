// Rutas que el export estático no puede prerenderizar con el id real.
// Apache (post-export.mjs) y el Worker de Cloudflare (workers/asset-rewrites.js)
// leen esta misma lista.

export const dynamicRewrites = [
  { pattern: "^menu/[^/]+/totem/?$", apache: "/menu/__/totem.html", asset: "/menu/__/totem" },
  { pattern: "^menu/[^/]+/?$", apache: "/menu/__.html", asset: "/menu/__" },
  { pattern: "^login/[^/]+/?$", apache: "/login/__.html", asset: "/login/__" },
  { pattern: "^warehouses/\\d+/?$", apache: "/warehouses/view.html", asset: "/warehouses/view" },
  { pattern: "^kds/station/(\\d+)/?$", apache: "/kds/monitor.html?station_id=$1", asset: "/kds/monitor?station_id=$1" },
  { pattern: "^checkout/pay-installment/[^/]+/?$", apache: "/checkout/pay-installment.html", asset: "/checkout/pay-installment" },
  { pattern: "^reset-password/[^/]+/?$", apache: "/reset-password/__.html", asset: "/reset-password/__" },
  // Excluye /survey/view y /survey/fill, que son páginas estáticas reales.
  { pattern: "^survey/(?!(?:view|fill)/?$)[^/]+/?$", apache: "/survey/__.html", asset: "/survey/__" },
  { pattern: "^salon-test/?$", apache: "/salon-demo.html", asset: "/salon-demo" },
];

function applyCaptures(template, match) {
  return template.replace(/\$(\d+)/g, (_, n) => match[Number(n)] ?? "");
}

/** Path sin query que Apache debe servir, o null si la URL no es dinámica. */
export function apacheTarget(pathname) {
  return matchRewrite(pathname, "apache");
}

/**
 * Path canónico del asset (sin .html). El html_handling de Workers
 * resuelve /menu/__ → menu/__.html. Pedir el .html aquí provocaría un 307.
 */
export function assetTarget(pathname) {
  return matchRewrite(pathname, "asset");
}

function matchRewrite(pathname, key) {
  const path = pathname.replace(/^\//, "");
  for (const rule of dynamicRewrites) {
    const match = path.match(new RegExp(rule.pattern));
    if (!match) continue;
    return applyCaptures(rule[key], match);
  }
  return null;
}

/** URL absoluta ya reescrita, conservando la query original (QSA). */
export function rewriteRequestUrl(requestUrl) {
  const url = new URL(requestUrl);
  const dest = assetTarget(url.pathname);
  if (!dest) return null;
  const next = new URL(dest, url.origin);
  if (url.search) {
    const incoming = url.search.slice(1);
    next.search = next.search ? `${next.search.slice(1)}&${incoming}` : incoming;
  }
  return next.toString();
}
