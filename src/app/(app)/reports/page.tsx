import { redirect } from "next/navigation";

/** `/reports` redirige al informe nutricional (ruta canónica). */
export default function ReportsIndexPage() {
  redirect("/reports/nutrition");
}
