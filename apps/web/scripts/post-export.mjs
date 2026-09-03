// Post-procesado del export estático de Next.js: genera out/.htaccess para Apache.
//
// Next 16 emite cada ruta como "<ruta>.html" plano (más un directorio con el
// payload RSC), no como "<ruta>/index.html". Por eso:
//   1. Las rutas dinámicas (/menu/<slug>, /menu/<slug>/totem, /warehouses/<id>,
//      /kds/station/<id>, /reset-password/<token>) se reescriben a la instancia
//      estática del placeholder "__". Las páginas son "use client" y resuelven
//      el parámetro real desde la URL, así la hidratación no depende del placeholder.
//   2. Cualquier otra URL sin extensión se resuelve a su "<ruta>.html" si existe
//      (sirve tanto /pos como /pos/).

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "out");

const dynamicRewrites = [
  ["^menu/[^/]+/totem/?$", "/menu/__/totem.html"],
  ["^menu/[^/]+/?$", "/menu/__.html"],
  ["^warehouses/[^/]+/?$", "/warehouses/__.html"],
  ["^kds/station/[^/]+/?$", "/kds/station/__.html"],
  ["^reset-password/[^/]+/?$", "/reset-password/__.html"],
];

const dynamicRules = dynamicRewrites
  .map(([pattern, target]) => `RewriteRule ${pattern} ${target} [L]`)
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
</IfModule>
`;

writeFileSync(join(outDir, ".htaccess"), htaccess);
console.log(`OK: ${join(outDir, ".htaccess")}`);
