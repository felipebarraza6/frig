"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  parseSurveyQuestions,
  submitPublicSurveyResponse,
  submitSurveyResponse,
  surveyTypeLabel,
  type PublicSurvey,
  type Survey,
  type SurveyQuestion,
} from "@/lib/api/surveys";
import {
  applySurveyAnswersToClientFicha,
  fetchExtraFieldDefinitions,
} from "@/lib/api/customer-fields";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { useQueryClient } from "@tanstack/react-query";

type FillSurvey = Pick<
  Survey,
  "id" | "title" | "description" | "survey_type" | "questions" | "status" | "is_anonymous"
> & { slug?: string | null };

function NpsPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 11 }, (_, n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors",
            value === n
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:border-primary/40 hover:bg-primary/10",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function RatingPicker({
  max,
  value,
  onChange,
}: {
  max: number;
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition-colors",
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:border-primary/40 hover:bg-primary/10",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export function SurveyFillForm({
  survey,
  clientId,
  mode = "app",
  publicClientLink,
  onSubmitted,
}: {
  survey: FillSurvey | PublicSurvey;
  clientId?: number | null;
  /** app = autenticado; public = anónimo por slug */
  mode?: "app" | "public";
  /** Token HMAC del link personalizado (?c=&t=&e=). */
  publicClientLink?: {
    client: number;
    token: string;
    exp: number;
  } | null;
  /** Si viene, el padre vuelve al listado al enviar. */
  onSubmitted?: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const questions = useMemo(
    () => parseSurveyQuestions(survey.questions),
    [survey.questions],
  );
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>(
    {},
  );
  const [comment, setComment] = useState("");
  const [respondentName, setRespondentName] = useState("");
  const [done, setDone] = useState(false);
  const slug = "slug" in survey ? survey.slug : null;
  const status = "status" in survey ? survey.status : "ACTIVE";

  const npsQuestion = questions.find((q) => q.type === "nps");
  const npsScore =
    typeof answers[npsQuestion?.id ?? ""] === "number"
      ? (answers[npsQuestion!.id] as number)
      : null;

  function setAnswer(q: SurveyQuestion, value: string | number | boolean) {
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
  }

  const canSubmit = questions.every((q) => {
    if (!q.required) return true;
    const v = answers[q.id];
    if (v === undefined || v === null || v === "") return false;
    return true;
  });

  const submit = useMutation({
    mutationFn: () => {
      const payload = {
        answers,
        nps_score: npsScore,
        comment: comment.trim() || undefined,
        respondent_name: respondentName.trim() || undefined,
        channel: mode === "public" ? "qr" : "web",
      };
      if (mode === "public") {
        if (!slug) throw new Error("Falta el slug público de la encuesta");
        return submitPublicSurveyResponse(slug, {
          ...payload,
          ...(publicClientLink
            ? {
                client: publicClientLink.client,
                client_token: publicClientLink.token,
                client_token_exp: publicClientLink.exp,
              }
            : {}),
        });
      }
      return submitSurveyResponse({
        survey: survey.id,
        client: clientId ?? null,
        ...payload,
      });
    },
    onSuccess: async (_res, _vars, _ctx) => {
      setDone(true);
      const isCustom = survey.survey_type === "CUSTOM";
      if (mode === "app" && isCustom && clientId != null) {
        try {
          const defs = await fetchExtraFieldDefinitions();
          const { applied } = await applySurveyAnswersToClientFicha({
            clientId,
            answers,
            definitions: defs,
          });
          queryClient.invalidateQueries({
            queryKey: ["customers", "extra-field-values", clientId],
          });
          queryClient.invalidateQueries({
            queryKey: ["surveys", "responses", "client", clientId],
          });
          toast.success(
            applied > 0
              ? `Respuesta enviada y ${applied} campo${applied === 1 ? "" : "s"} guardado${applied === 1 ? "" : "s"} en la ficha`
              : "Respuesta enviada (sin campos de ficha coincidentes)",
          );
          onSubmitted?.();
          return;
        } catch {
          toast.success("Respuesta enviada (no se pudo copiar a la ficha)");
          onSubmitted?.();
          return;
        }
      }
      toast.success("Respuesta enviada");
      onSubmitted?.();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo enviar"),
  });

  if (done) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-sm">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <p className="mt-4 text-lg font-semibold">Gracias</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Tu respuesta quedó registrada
          {survey.title ? ` en “${survey.title}”` : ""}.
        </p>
      </div>
    );
  }

  if (status && status !== "ACTIVE") {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm font-medium">Esta encuesta no está activa</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pedile al equipo que la active desde{" "}
          {survey.survey_type === "CUSTOM" ? "Fichas" : "Encuestas"}.
        </p>
      </div>
    );
  }

  const isForm = survey.survey_type === "CUSTOM";
  const formTitle = isForm
    ? (survey.title ?? "").replace(/^Levantamiento\s·\s/, "") || survey.title
    : survey.title;
  const intro = (survey.description ?? "").trim();
  const showIntro =
    intro.length > 0 &&
    intro !== "Completá estos datos para que podamos armarte una cotización.";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <div className={cn(isForm && "glass space-y-5 rounded-2xl p-5 sm:p-6")}>
        <header className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {isForm ? "Ficha" : surveyTypeLabel(survey.survey_type)}
          </p>
          <h1 className="font-display text-xl font-semibold tracking-tight">{formTitle}</h1>
          {showIntro ? (
            <p className="text-sm text-muted-foreground">{intro}</p>
          ) : null}
        </header>

        <div className="flex flex-col gap-4">
      {!survey.is_anonymous && !(mode === "app" && clientId != null) && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="respondent-name">
            Tu nombre
          </label>
          <Input
            id="respondent-name"
            value={respondentName}
            onChange={(e) => setRespondentName(e.target.value)}
            placeholder="Nombre"
          />
        </div>
      )}

      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta encuesta no tiene preguntas configuradas.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {q.label}
                {q.required ? <span className="text-danger"> *</span> : null}
              </label>
              {q.type === "nps" && (
                <NpsPicker
                  value={typeof answers[q.id] === "number" ? (answers[q.id] as number) : null}
                  onChange={(n) => setAnswer(q, n)}
                />
              )}
              {q.type === "rating" && (
                <RatingPicker
                  max={q.max && q.max > 0 ? q.max : 5}
                  value={typeof answers[q.id] === "number" ? (answers[q.id] as number) : null}
                  onChange={(n) => setAnswer(q, n)}
                />
              )}
              {q.type === "text" &&
                (isForm ? (
                  <Input
                    value={String(answers[q.id] ?? "")}
                    onChange={(e) => setAnswer(q, e.target.value)}
                    placeholder="Escribí acá"
                  />
                ) : (
                  <textarea
                    value={String(answers[q.id] ?? "")}
                    onChange={(e) => setAnswer(q, e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Escribí aquí…"
                  />
                ))}
              {q.type === "url" && (
                <Input
                  type="url"
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) => setAnswer(q, e.target.value)}
                  placeholder="https://"
                />
              )}
              {q.type === "file" && (
                <div className="flex flex-col gap-1">
                  <input
                    type="file"
                    className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setAnswer(q, file ? file.name : "");
                    }}
                  />
                  {answers[q.id] ? (
                    <p className="text-xs text-muted-foreground">{String(answers[q.id])}</p>
                  ) : null}
                </div>
              )}
              {q.type === "boolean" && (
                <div className="flex gap-2">
                  {(["Sí", "No"] as const).map((label) => {
                    const val = label === "Sí";
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setAnswer(q, val)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-sm font-medium",
                          answers[q.id] === val
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              {q.type === "select" && (
                <Select
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) => setAnswer(q, e.target.value)}
                >
                  <option value="">Elegí…</option>
                  {(q.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          ))}
        </div>
      )}

      {!isForm && !questions.some((q) => q.id === "comment") && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="survey-comment">
            Comentario libre (opcional)
          </label>
          <textarea
            id="survey-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      <Button
        className="h-11 w-full"
        disabled={!canSubmit || submit.isPending}
        isLoading={submit.isPending}
        onClick={() => submit.mutate()}
      >
        Enviar
      </Button>
        </div>
      </div>
    </div>
  );
}
