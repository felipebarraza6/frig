import { Suspense } from "react";
import WarehouseDetailPage from "./warehouse-detail-client";

// Ruta estática a propósito: con `output: "export"` una ruta dinámica
// ([id]) solo admite los params listados en generateStaticParams, así que en
// dev la navegación a /warehouses/<id> fallaba ("missing param") y se iba en
// loop. El id real se resuelve en el cliente desde la URL (?id= o /warehouses/<id>)
// vía useSearchParams, que exige un boundary de Suspense al prerender estático.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <WarehouseDetailPage />
    </Suspense>
  );
}
