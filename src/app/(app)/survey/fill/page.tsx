"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { PageBody, PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { SurveyFillForm } from "@/components/surveys/survey-fill-form";
import { fetchSurvey } from "@/lib/api/surveys";

function FillInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() ?? "";
  const clientRaw = searchParams.get("client");
  const clientId =
    clientRaw && /^\d+$/.test(clientRaw) ? Number(clientRaw) : null;

  const surveyQuery = useQuery({
    queryKey: ["surveys", "detail", id],
    queryFn: () => fetchSurvey(id),
    enabled: Boolean(id),
  });

  if (!id) {
    return (
      <PageShell>
        <PageBody>
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Falta el id de la encuesta</p>
            <Link
              href="/customers/surveys"
              className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Ir a Encuestas
            </Link>
          </div>
        </PageBody>
      </PageShell>
    );
  }

  const isLevantamiento = surveyQuery.data?.survey_type === "CUSTOM";
  const backHref = isLevantamiento ? "/customers/forms" : "/customers/surveys";
  const backLabel = isLevantamiento ? "Fichas" : "Encuestas";

  return (
    <PageShell className="max-w-2xl">
      <PageBody>
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>

        {surveyQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : surveyQuery.error || !surveyQuery.data ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium">No se pudo cargar la encuesta</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Revisá el link o que la encuesta exista en esta sucursal.
            </p>
          </div>
        ) : (
          <SurveyFillForm survey={surveyQuery.data} clientId={clientId} />
        )}
      </PageBody>
    </PageShell>
  );
}

export default function SurveyFillPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <PageBody>
            <Skeleton className="h-40 w-full rounded-2xl" />
          </PageBody>
        </PageShell>
      }
    >
      <FillInner />
    </Suspense>
  );
}
