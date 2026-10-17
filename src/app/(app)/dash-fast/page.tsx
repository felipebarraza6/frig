import { redirect } from "next/navigation";

/**
 * Ruta experimental del cubo 3D de KPIs.
 * Decisión Fase 1 GTM: redirigir al dashboard canónico en vez de mantener
 * una página huérfana (sin ítem de menú) y con bundle Three.js.
 */
export default function DashFastRedirect() {
  redirect("/dashboard");
}
