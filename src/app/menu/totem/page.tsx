import { Suspense } from "react";
import MenuTotemPage from "../[slug]/totem/totem-client";

/**
 * Vista estática del tótem: `/menu/totem?slug=…`
 * Misma razón que `/menu/view` — compatible con `output: "export"` en next:dev.
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
      <MenuTotemPage />
    </Suspense>
  );
}
