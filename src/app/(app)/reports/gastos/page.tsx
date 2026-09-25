import { redirect } from "next/navigation";

/** Ruta legacy en español → canónica en inglés. */
export default function GastosReportRedirect() {
  redirect("/reports/expenses");
}
