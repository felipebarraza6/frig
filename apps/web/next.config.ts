import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exportación estática: el deploy a hosting FTP solo sirve archivos estáticos.
  // Los headers de seguridad deben configurarse en el servidor (Apache/nginx).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
