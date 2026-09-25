import type { NextConfig } from "next";

// `output: "export"` solo en build de producción (FTP/estático).
// En `next:dev` lo desactivamos: con export activo, rutas como /menu/[slug]
// exigen generateStaticParams y fallan al abrir /menu/<slug-real> (Turbopack).
const isProdBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isProdBuild ? { output: "export" as const } : {}),
  images: { unoptimized: true },
};

export default nextConfig;
