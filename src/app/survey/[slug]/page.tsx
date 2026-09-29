import { Suspense } from "react";
import SurveyViewClient from "../view/survey-view-client";

/** Placeholder para static export; Apache reescribe /survey/<slug> → /survey/__.html */
export function generateStaticParams() {
  return [{ slug: "__" }];
}

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
