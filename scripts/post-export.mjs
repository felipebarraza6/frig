// Post-procesado del export estático de Next.js: genera out/.htaccess para Apache.
//
// Next 16 emite cada ruta como "<ruta>.html" plano (más un directorio con el
// payload RSC), no como "<ruta>/index.html". Por eso:
//   1. Las URLs legacy de bodega (/warehouses/<id>) se reescriben a la vista
//      estática /warehouses/view.html (resuelve el id desde la querystring).
//      Otras rutas dinámicas (/menu/<slug>, /menu/<slug>/totem,
//      /kds/station/<id> → /kds/monitor.html?station_id=, /reset-password/<token>,
//      /checkout/pay-installment/<id> (link del correo de cuotas),
//      /survey/<slug> salvo /survey/view y /survey/fill)
//      se reescriben a la instancia estática. Las páginas "use client"
//      resuelven el parámetro real desde la URL/query.
//   2. Cualquier otra URL sin extensión se resuelve a su "<ruta>.html" si existe
//      (sirve tanto /pos como /pos/).

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "out");

const apiOrigin = new URL(
  process.env.NEXT_PUBLIC_YGGDRA_API_BASE || "https://api.yggdra.cl/api",
).origin;
const wsOrigin = apiOrigin.replace(/^http/, "ws");

// 'unsafe-inline' en script-src: el export estático de Next inyecta scripts
// inline sin nonce. blob: y cdn.jsdelivr.net: troika (texto del salón 3D)
// levanta workers desde blob: y baja fuentes de unicode-font-resolver.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${wsOrigin} https://cdn.jsdelivr.net`,
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const dynamicRewrites = [
  ["^menu/[^/]+/totem/?$", "/menu/__/totem.html"],
  ["^menu/[^/]+/?$", "/menu/__.html"],
  ["^login/[^/]+/?$", "/login/__.html"],
  ["^warehouses/\\d+/?$", "/warehouses/view.html"],
  ["^kds/station/(\\d+)/?$", "/kds/monitor.html?station_id=$1"],
  // Link del correo recordatorio de cuotas (plan_checkout/tasks.py).
  ["^checkout/pay-installment/[^/]+/?$", "/checkout/pay-installment.html"],
  ["^reset-password/[^/]+/?$", "/reset-password/__.html"],
  // Link público de levantamiento: /survey/<slug>. Excluye las páginas
  // estáticas reales /survey/view y /survey/fill (las resuelve la regla 2).
  ["^survey/(?!(?:view|fill)/?$)[^/]+/?$", "/survey/__.html"],
  // Legacy: el salón 3D se renombró de /salon-test → /salon-demo
  ["^salon-test/?$", "/salon-demo.html"],
];

const dynamicRules = dynamicRewrites
  .map(([pattern, target]) => {
    const flags = target.includes("?") ? "[L,QSA]" : "[L]";
    return `RewriteRule ${pattern} ${target} ${flags}`;
  })
  .join("\n");

const htaccess = `# Generado por scripts/post-export.mjs — no editar a mano.
RewriteEngine On

# 1) Rutas dinámicas → instancia estática del placeholder "__" (resolución en el cliente)
${dynamicRules}

# 2) URLs sin extensión → su <ruta>.html (Next 16 exporta HTML plano, no index.html)
RewriteCond %{DOCUMENT_ROOT}/$1.html -f
RewriteRule ^(.+?)/?$ /$1.html [L]

# Seguridad (equivalente a los headers que Next servía antes del export estático)
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set Permissions-Policy "camera=(), microphone=(), geolocation=()"
  Header set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header set Content-Security-Policy "${csp}"
</IfModule>
`;

writeFileSync(join(outDir, ".htaccess"), htaccess);
console.log(`OK: ${join(outDir, ".htaccess")}`);
