import { Suspense } from "react";
import SurveyViewClient from "./survey-view-client";

/**
 * Vista pública estática: `/survey/view?slug=…`
 * En producción, `/survey/<slug>` puede reescribirse a esta página (como /menu).
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
      <SurveyViewClient />
    </Suspense>
  );
}
