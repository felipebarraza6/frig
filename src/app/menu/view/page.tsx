import { Suspense } from "react";
import MenuViewClient from "./menu-view-client";

/**
 * Vista estática del menú público: `/menu/view?slug=…`
 * Evita el error de `generateStaticParams` en next:dev con `output: "export"`.
 * En producción Apache, `/menu/<slug>` sigue reescribiéndose a `/menu/__.html`.
 */
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      }
    >
      <MenuViewClient />
    </Suspense>
  );
}
