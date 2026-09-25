import { redirect } from "next/navigation";

/** Ruta legacy en español → canónica en inglés. */
export default function IngresosReportRedirect() {
  redirect("/reports/revenues");
}
