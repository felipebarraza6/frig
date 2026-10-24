import type { NextConfig } from "next";

// `output: "export"` solo en build de producción (FTP/estático).
// En `next:dev` lo desactivamos: con export activo, rutas como /menu/[slug]
// exigen generateStaticParams y fallan al abrir /menu/<slug-real> (Turbopack).
const isProdBuild = process.env.NODE_ENV === "production";

// GitHub Pages de un repo de proyecto sirve en /<repo>, no en la raíz.
// Solo el workflow de staging define NEXT_PUBLIC_BASE_PATH="/frig".
// El deploy FTP de producción no lo define: las rutas siguen en /.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "";

const nextConfig: NextConfig = {
  ...(isProdBuild ? { output: "export" as const } : {}),
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath,
        // Pages no reescribe /frig → /frig/; sin esto el asset de la raíz 404.
        trailingSlash: true,
      }
    : {}),
  images: { unoptimized: true },
};

export default nextConfig;
