"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SurveyFillForm } from "@/components/surveys/survey-fill-form";
import { fetchPublicSurvey } from "@/lib/api/surveys";

function resolveSlug(explicit?: string | null): string {
  if (explicit && explicit !== "__") return explicit;
  if (typeof window === "undefined") return "";
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get("slug")?.trim();
  if (q) return q;
  const parts = window.location.pathname.split("/").filter(Boolean);
  // /survey/<slug> or /survey/view
  if (parts[0] === "survey" && parts[1] && parts[1] !== "view" && parts[1] !== "__") {
    return decodeURIComponent(parts[1]);
  }
  return "";
}

export default function SurveyViewClient({ slug: slugProp }: { slug?: string }) {
  const searchParams = useSearchParams();
  const params = useParams<{ slug?: string }>();
  const slug = useMemo(() => {
    const fromProp = slugProp?.trim();
    if (fromProp && fromProp !== "__") return fromProp;
    const fromQuery = searchParams.get("slug")?.trim();
    if (fromQuery) return fromQuery;
    const fromParams = typeof params?.slug === "string" ? params.slug : "";
    if (fromParams && fromParams !== "__" && fromParams !== "view") return fromParams;
    return resolveSlug(null);
  }, [slugProp, searchParams, params]);

  const publicClientLink = useMemo(() => {
    const c = searchParams.get("c");
    const t = searchParams.get("t");
    const e = searchParams.get("e");
    if (!c || !t || !e) return null;
    if (!/^\d+$/.test(c) || !/^\d+$/.test(e)) return null;
    return { client: Number(c), token: t, exp: Number(e) };
  }, [searchParams]);

  const surveyQuery = useQuery({
    queryKey: ["surveys", "public", slug],
    queryFn: () => fetchPublicSurvey(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(ellipse_at_top,var(--primary)_0%,transparent_55%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-10">
        {!slug ? (
          <div className="glass my-auto rounded-2xl px-6 py-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Falta el enlace de la encuesta</p>
          </div>
        ) : surveyQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : surveyQuery.error || !surveyQuery.data ? (
          <div className="glass my-auto rounded-2xl px-6 py-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Encuesta no disponible</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Puede estar pausada, expirada o el link es incorrecto.
            </p>
          </div>
        ) : (
          <>
            {surveyQuery.data.branch_name ? (
              <p className="mb-4 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {surveyQuery.data.branch_name}
              </p>
            ) : null}
            <SurveyFillForm
              survey={surveyQuery.data}
              mode="public"
              publicClientLink={publicClientLink}
            />
          </>
        )}
      </main>
    </div>
  );
}
