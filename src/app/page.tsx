import type { Metadata } from "next";
import { LandingSite } from "@/components/landing/landing-site";

export const metadata: Metadata = {
  title: "FRIG — Gestión comercial y gastronómica desde 1 UF mensual",
  description:
    "Punto de venta, mesas, cocina en vivo, inventario, finanzas y menú QR en una sola app. Todos los módulos incluidos en todos los planes. Demos por rubro con tu marca.",
};

export default function HomePage() {
  return <LandingSite />;
}
