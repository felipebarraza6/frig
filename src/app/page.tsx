import type { Metadata } from "next";
import { LandingSite } from "@/components/landing/landing-site";
import { StandaloneRedirect } from "@/components/standalone-redirect";

export const metadata: Metadata = {
  title: "FRIG — El restaurante, en una sola pantalla",
  description:
    "Cobra, cocina y controla caja, stock y sucursales desde el navegador. POS, mesas, KDS, inventario y facturación incluidos. Incluye versión de staging para revisar antes de producción.",
};

export default function HomePage() {
  return (
    <>
      <StandaloneRedirect />
      <LandingSite />
    </>
  );
}
