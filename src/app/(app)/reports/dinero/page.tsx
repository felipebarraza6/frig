import { redirect } from "next/navigation";

/** Ruta legacy en español → canónica en inglés. */
export default function DineroReportRedirect() {
  redirect("/reports/money");
}
