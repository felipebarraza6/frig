"use client";

import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  FileSpreadsheet,
  GripVertical,
  Link2,
  MessageCircle,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QrModal } from "@/components/ui/qr-modal";
import { QuotationCreateModal } from "@/components/sales/quotation-create-modal";
import { SurveyFillForm } from "@/components/surveys/survey-fill-form";
import {
  applySurveyAnswersToClientFicha,
  fetchExtraFieldDefinitions,
} from "@/lib/api/customer-fields";
import {
  createSurveyClientLink,
  fetchSurvey,
  fetchSurveyResponses,
  fetchSurveys,
  formatSurveyAnswersForQuotation,
  parseSurveyQuestions,
  publicSurveyAbsoluteUrl,
  surveyFillPath,
  updateSurveyResponse,
  type SurveyList,
  type SurveyQuestion,
  type SurveyResponse,
} from "@/lib/api/surveys";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";

type DragItem = { kind: "form" | "response"; id: string };
type ColumnId = "todo" | "done" | "quoted";

function answerPreview(answers: unknown): string {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return "";
  const entries = Object.entries(answers as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  return entries
    .slice(0, 3)
    .map(([, v]) => String(v))
    .join(" · ");
}

function formTitle(title?: string | null): string {
  return (title ?? "").replace(/^Levantamiento\s·\s/, "") || title || "Levantamiento";
}

function whenLabel(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readDrag(event: DragEvent): DragItem | null {
  try {
    const raw = event.dataTransfer.getData("text/plain");
    const parsed = JSON.parse(raw) as DragItem;
    if (parsed?.kind !== "form" && parsed?.kind !== "response") return null;
    if (!parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function CustomerLevantamientosTab({
  customerId,
  customerName,
  customerPhone,
}: {
  customerId: number;
  customerName: string;
  customerPhone?: string | null;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [openResponseId, setOpenResponseId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null);
  const [qrModal, setQrModal] = useState<{ url: string; title: string } | null>(null);

  const responsesQuery = useQuery({
    queryKey: ["surveys", "responses", "client", customerId],
    queryFn: () => fetchSurveyResponses({ client: customerId, page_size: 50 }),
  });

  const defsQuery = useQuery({
    queryKey: ["customers", "extra-field-definitions"],
    queryFn: () => fetchExtraFieldDefinitions(),
    staleTime: 60_000,
  });

  const customQuery = useQuery({
    queryKey: ["surveys", "levantamientos"],
    queryFn: () => fetchSurveys({ survey_type: "CUSTOM", status: "ACTIVE", page_size: 50 }),
    staleTime: 60_000,
  });

  const satisfactionQuery = useQuery({
    queryKey: ["surveys", "satisfaction-links"],
    queryFn: async () => {
      const [nps, csat] = await Promise.all([
        fetchSurveys({ survey_type: "NPS", status: "ACTIVE", page_size: 50 }),
        fetchSurveys({ survey_type: "CSAT", status: "ACTIVE", page_size: 50 }),
      ]);
      return [...(nps.results ?? []), ...(csat.results ?? [])];
    },
    staleTime: 60_000,
  });

  const fillQuery = useQuery({
    queryKey: ["surveys", "detail", fillingId],
    queryFn: () => fetchSurvey(fillingId!),
    enabled: Boolean(fillingId),
  });

  const published = customQuery.data?.results ?? [];
  const encuestas = satisfactionQuery.data ?? [];

  const responses = useMemo(() => {
    return (responsesQuery.data ?? [])
      .filter((row) => {
        const title = row.survey_title ?? "";
        return title.startsWith("Levantamiento") || published.some((s) => s.id === row.survey);
      })
      .sort((a, b) => String(b.created).localeCompare(String(a.created)));
  }, [responsesQuery.data, published]);

  const done = responses.filter((row) => row.workflow !== "QUOTED");
  const quoted = responses.filter((row) => row.workflow === "QUOTED");

  const apply = useMutation({
    mutationFn: async (response: SurveyResponse) => {
      const defs = defsQuery.data ?? (await fetchExtraFieldDefinitions());
      return applySurveyAnswersToClientFicha({
        clientId: customerId,
        answers: response.answers,
        definitions: defs,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["customers", "extra-field-values", customerId],
      });
      if (result.applied === 0) {
        toast.error("No hubo campos coincidentes con la ficha.");
        return;
      }
      toast.success(
        `${result.applied} campo${result.applied === 1 ? "" : "s"} en la ficha`,
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudo aplicar a la ficha"),
  });

  const move = useMutation({
    mutationFn: ({ id, workflow }: { id: string; workflow: "DONE" | "QUOTED" }) =>
      updateSurveyResponse(id, { workflow }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys", "responses", "client", customerId] });
    },
    onError: () => toast.error("No se pudo mover"),
  });

  async function personalUrl(surveyId: string): Promise<string> {
    const link = await createSurveyClientLink(surveyId, customerId);
    return publicSurveyAbsoluteUrl(link.slug, undefined, {
      c: link.client,
      t: link.client_token,
      e: link.client_token_exp,
    });
  }

  async function copyLink(survey: SurveyList, kind: "ficha" | "encuesta") {
    try {
      const url = await personalUrl(survey.id);
      await navigator.clipboard.writeText(url);
      toast.success(kind === "ficha" ? "Link de la ficha copiado" : "Link de la encuesta copiado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo armar el link");
    }
  }

  async function whatsappLink(survey: SurveyList, kind: "ficha" | "encuesta") {
    try {
      const url = await personalUrl(survey.id);
      const label = kind === "ficha" ? formTitle(survey.title) : survey.title || "encuesta";
      const ask =
        kind === "ficha"
          ? `Hola${customerName ? ` ${customerName}` : ""}, completá esta ficha para que armemos tu cotización: ${label}\n${url}`
          : `Hola${customerName ? ` ${customerName}` : ""}, nos ayudás con esta encuesta: ${label}\n${url}`;
      const phone = (customerPhone ?? "").replace(/\D/g, "");
      const href =
        phone.length >= 8
          ? `https://wa.me/${phone}?text=${encodeURIComponent(ask)}`
          : `https://wa.me/?text=${encodeURIComponent(ask)}`;
      window.open(href, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo armar el link");
    }
  }

  async function qrLink(survey: SurveyList, kind: "ficha" | "encuesta") {
    try {
      const url = await personalUrl(survey.id);
      const label = kind === "ficha" ? formTitle(survey.title) : survey.title || "encuesta";
      setQrModal({ url, title: `Ficha para ${customerName || "Cliente"}: ${label}` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo armar el link");
    }
  }

  async function openQuoteFrom(response: SurveyResponse) {
    if (response.workflow !== "QUOTED") {
      move.mutate({ id: response.id, workflow: "QUOTED" });
    }
    try {
      const survey = await fetchSurvey(response.survey);
      const questions = parseSurveyQuestions(survey.questions);
      const notes =
        formatSurveyAnswersForQuotation(
          response.survey_title || survey.title,
          questions,
          response.answers,
        ) || `Levantamiento: ${response.survey_title || "sin título"}`;
      setQuoteNotes(notes);
      setQuoteOpen(true);
    } catch {
      setQuoteNotes(`Levantamiento: ${response.survey_title || "respuesta"}`);
      setQuoteOpen(true);
    }
  }

  function onDrop(column: ColumnId, event: DragEvent) {
    event.preventDefault();
    setOverColumn(null);
    const item = readDrag(event);
    if (!item) return;
    if (item.kind === "form") {
      if (column === "done" || column === "todo") setFillingId(item.id);
      return;
    }
    if (column === "quoted") move.mutate({ id: item.id, workflow: "QUOTED" });
    if (column === "done") move.mutate({ id: item.id, workflow: "DONE" });
  }

  if (fillingId) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setFillingId(null)}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al tablero
        </button>
        {fillQuery.isLoading || !fillQuery.data ? (
          <Skeleton className="h-64 w-full max-w-lg rounded-2xl" />
        ) : (
          <SurveyFillForm
            survey={fillQuery.data}
            clientId={customerId}
            onSubmitted={() => setFillingId(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-2xl p-4">
        <p className="text-sm font-semibold">Enviar link a este cliente</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          El link es solo de {customerName || "este cliente"}. Cuando lo responde, la data queda en su ficha.
          Fichas para cotizar, encuestas para la nota del local.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <LinkGroup
            title="Fichas"
            hint="Fichas publicadas"
            loading={customQuery.isLoading}
            items={published}
            empty="Publicá una sección en Fichas."
            emptyHref="/customers/forms"
            kind="ficha"
            onCopy={copyLink}
            onQrCode={qrLink}
            onWhatsapp={whatsappLink}
          />
          <LinkGroup
            title="Encuestas"
            hint="Satisfacción activa"
            loading={satisfactionQuery.isLoading}
            items={encuestas}
            empty="Creá una encuesta de satisfacción."
            emptyHref="/customers/surveys"
            kind="encuesta"
            onCopy={copyLink}
            onQrCode={qrLink}
            onWhatsapp={whatsappLink}
          />
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Arrastrá una ficha a Completados para llenarla acá. Los hechos se mueven a Cotizados cuando ya armaste la cotización.
      </p>

      {responsesQuery.isLoading || customQuery.isLoading ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-3 xl:grid-cols-3">
          <BoardColumn
            title="Por llenar"
            hint="Elegí o arrastrá para completarla"
            count={published.length}
            active={overColumn === "todo"}
            onDragOver={(event) => {
              event.preventDefault();
              setOverColumn("todo");
            }}
            onDragLeave={() => setOverColumn((current) => (current === "todo" ? null : current))}
            onDrop={(event) => onDrop("todo", event)}
          >
            {published.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nada publicado.</p>
            ) : (
              published.map((survey) => (
                <article
                  key={survey.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "text/plain",
                      JSON.stringify({ kind: "form", id: survey.id } satisfies DragItem),
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  className="cursor-grab rounded-xl border border-dashed border-border bg-card p-3 active:cursor-grabbing"
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{formTitle(survey.title)}</p>
                      <p className="text-[11px] text-muted-foreground">Pendiente de este cliente</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="mt-2 h-7 w-full"
                    onClick={() => setFillingId(survey.id)}
                  >
                    Llenar acá
                  </Button>
                </article>
              ))
            )}
          </BoardColumn>

          <BoardColumn
            title="Completados"
            hint="Ya respondidos"
            count={done.length}
            active={overColumn === "done"}
            onDragOver={(event) => {
              event.preventDefault();
              setOverColumn("done");
            }}
            onDragLeave={() => setOverColumn((current) => (current === "done" ? null : current))}
            onDrop={(event) => onDrop("done", event)}
          >
            {done.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">Todavía no hay.</p>
            ) : (
              done.map((response) => (
                <ResponseCard
                  key={response.id}
                  response={response}
                  open={openResponseId === response.id}
                  onToggle={() =>
                    setOpenResponseId((current) => (current === response.id ? null : response.id))
                  }
                  applying={apply.isPending}
                  onApply={() => apply.mutate(response)}
                  onQuote={() => openQuoteFrom(response)}
                  moveLabel="A cotizados"
                  onMove={() => move.mutate({ id: response.id, workflow: "QUOTED" })}
                />
              ))
            )}
          </BoardColumn>

          <BoardColumn
            title="Cotizados"
            hint="Listos para la venta"
            count={quoted.length}
            active={overColumn === "quoted"}
            onDragOver={(event) => {
              event.preventDefault();
              setOverColumn("quoted");
            }}
            onDragLeave={() => setOverColumn((current) => (current === "quoted" ? null : current))}
            onDrop={(event) => onDrop("quoted", event)}
          >
            {quoted.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                Arrastrá un completado acá.
              </p>
            ) : (
              quoted.map((response) => (
                <ResponseCard
                  key={response.id}
                  response={response}
                  open={openResponseId === response.id}
                  onToggle={() =>
                    setOpenResponseId((current) => (current === response.id ? null : response.id))
                  }
                  applying={apply.isPending}
                  onApply={() => apply.mutate(response)}
                  onQuote={() => openQuoteFrom(response)}
                  moveLabel="Volver a completados"
                  onMove={() => move.mutate({ id: response.id, workflow: "DONE" })}
                />
              ))
            )}
          </BoardColumn>
        </div>
      )}

      <QuotationCreateModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        initialClient={{ id: customerId, name: customerName }}
        initialObservation={quoteNotes}
      />

      {qrModal ? (
        <QrModal
          url={qrModal.url}
          title={qrModal.title}
          heading="Código QR Personalizado"
          copyMessage="Enlace personalizado copiado"
          onClose={() => setQrModal(null)}
        />
      ) : null}
    </div>
  );
}

function LinkGroup({
  title,
  hint,
  loading,
  items,
  empty,
  emptyHref,
  kind,
  onCopy,
  onQrCode,
  onWhatsapp,
}: {
  title: string;
  hint: string;
  loading: boolean;
  items: SurveyList[];
  empty: string;
  emptyHref: string;
  kind: "ficha" | "encuesta";
  onCopy: (survey: SurveyList, kind: "ficha" | "encuesta") => void;
  onQrCode: (survey: SurveyList, kind: "ficha" | "encuesta") => void;
  onWhatsapp: (survey: SurveyList, kind: "ficha" | "encuesta") => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      {loading ? (
        <Skeleton className="mt-2 h-12 w-full rounded-lg" />
      ) : items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {empty}{" "}
          <Link href={emptyHref} className="font-medium text-primary hover:underline">
            Ir
          </Link>
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((survey) => (
            <li key={survey.id} className="flex items-center gap-2 rounded-lg bg-card px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm">
                {kind === "ficha" ? formTitle(survey.title) : survey.title}
              </span>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onCopy(survey, kind)}>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onQrCode(survey, kind)}>
                <QrCode className="h-3.5 w-3.5 text-primary" />
                QR
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onWhatsapp(survey, kind)}>
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BoardColumn({
  title,
  hint,
  count,
  active,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  active: boolean;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent) => void;
  children: ReactNode;
}) {
  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex min-h-52 flex-col gap-2 rounded-2xl border bg-muted/30 p-3",
        active ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <header>
        <h3 className="text-sm font-semibold">
          {title}
          <span className="ml-1.5 tabular-nums text-muted-foreground">{count}</span>
        </h3>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function ResponseCard({
  response,
  open,
  onToggle,
  applying,
  onApply,
  onQuote,
  moveLabel,
  onMove,
}: {
  response: SurveyResponse;
  open: boolean;
  onToggle: () => void;
  applying: boolean;
  onApply: () => void;
  onQuote: () => void;
  moveLabel: string;
  onMove: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["surveys", "detail", response.survey],
    queryFn: () => fetchSurvey(response.survey),
    enabled: open,
  });
  const questions = parseSurveyQuestions(detailQuery.data?.questions);

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ kind: "response", id: response.id } satisfies DragItem),
        );
        event.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab rounded-xl border border-border bg-card p-3 active:cursor-grabbing"
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-2 text-left">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{formTitle(response.survey_title)}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {whenLabel(response.created)}
            {answerPreview(response.answers) ? ` · ${answerPreview(response.answers)}` : ""}
          </span>
        </span>
      </button>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={onMove}>
          {moveLabel}
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onQuote}>
          <FileSpreadsheet className="h-3 w-3" />
          Cotizar
        </Button>
      </div>
      {open ? (
        <div className="mt-3 border-t border-border pt-3">
          <AnswerLines
            questions={questions}
            answers={response.answers}
            loading={detailQuery.isLoading}
          />
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 text-[11px]"
            disabled={applying}
            onClick={onApply}
          >
            <Link2 className="h-3 w-3" />
            Aplicar a ficha
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function AnswerLines({
  questions,
  answers,
  loading,
}: {
  questions: SurveyQuestion[];
  answers: unknown;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-12 w-full rounded-lg" />;
  const bag =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? (answers as Record<string, unknown>)
      : {};
  const rows =
    questions.length > 0
      ? questions.map((question) => ({
          id: question.id,
          label: question.label,
          value: bag[question.id],
        }))
      : Object.entries(bag).map(([id, value]) => ({ id, label: id, value }));
  const filled = rows.filter(
    (row) => row.value !== null && row.value !== undefined && row.value !== "",
  );
  if (filled.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin respuestas.</p>;
  }
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {filled.map((row) => (
        <div key={row.id} className="min-w-0">
          <dt className="text-[10px] text-muted-foreground">{row.label}</dt>
          <dd className="truncate text-sm">
            {row.value === true || row.value === "true"
              ? "Sí"
              : row.value === false || row.value === "false"
                ? "No"
                : String(row.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Acciones al enviar: WhatsApp público + completar ahora (con client). */
export function LevantamientoSendActions({
  surveyId,
  surveySlug,
  surveyTitle,
  customerId,
  customerName,
  customerPhone,
  onDone,
}: {
  surveyId: string;
  surveySlug?: string | null;
  surveyTitle: string;
  customerId: number;
  customerName?: string | null;
  customerPhone?: string | null;
  onDone?: () => void;
}) {
  const toast = useToast();
  const fillHref = surveyFillPath(surveyId, customerId);

  async function whatsapp() {
    if (!surveySlug) return;
    let url = publicSurveyAbsoluteUrl(surveySlug);
    try {
      const link = await createSurveyClientLink(surveyId, customerId);
      url = publicSurveyAbsoluteUrl(link.slug || surveySlug, undefined, {
        c: link.client,
        t: link.client_token,
        e: link.client_token_exp,
      });
    } catch {
      toast.error("No se pudo personalizar el link; se envía el público genérico.");
    }
    const phone = customerPhone?.replace(/\D/g, "") ?? "";
    const text = encodeURIComponent(
      `Hola${customerName ? ` ${customerName}` : ""}, ¿nos completás este formulario?\n${surveyTitle}\n${url}`,
    );
    const href =
      phone.length >= 8 ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(href, "_blank", "noopener,noreferrer");
    onDone?.();
  }

  return (
    <div className="flex flex-col gap-0.5">
      {surveySlug ? (
        <button
          type="button"
          className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"
          onClick={() => void whatsapp()}
        >
          <span className="font-medium">WhatsApp (link personalizado)</span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            Sin login · la respuesta queda asociada a este cliente
          </span>
        </button>
      ) : null}
      <Link
        href={fillHref}
        className="block rounded-lg px-3 py-2 text-xs hover:bg-muted"
        onClick={() => onDone?.()}
      >
        <span className="font-medium">Completar ahora</span>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          En la app, asociado a este cliente
        </span>
      </Link>
    </div>
  );
}
