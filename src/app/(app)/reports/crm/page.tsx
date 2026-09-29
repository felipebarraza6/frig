"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  ListChecks,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CrmDenied } from "@/components/customers/crm-denied";
import {
  DeltaChip,
  GroupPanel,
  ReportDateFilters,
  ReportKpi,
  ReportTabPanels,
  ShareBar,
  previousWindow,
} from "@/components/reports/report-kit";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCustomerStats } from "@/lib/api/customers";
import {
  activityTypeLabel,
  fetchFollowUpActivities,
  fetchOpportunities,
  fetchOpportunityStages,
  type FollowUpActivity,
  type OpportunityList,
  type OpportunityStage,
} from "@/lib/api/crm";
import { fetchLeads, leadStatusLabel, type LeadList } from "@/lib/api/crm-leads";
import { getCurrentMonthRange } from "@/lib/date-range";
import { useCanManageCustomers } from "@/lib/store/session";
import { cn, formatCLP } from "@/lib/utils";

type TabKey = "resumen" | "embudo" | "acciones" | "hallazgos";

const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "resumen", label: "Resumen", icon: LayoutDashboard },
  { key: "embudo", label: "Embudo", icon: Kanban },
  { key: "acciones", label: "Acciones", icon: ListChecks },
  { key: "hallazgos", label: "Hallazgos", icon: AlertCircle },
];

const SAMPLE = 200;

function dayKey(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inRange(iso: string | null | undefined, start: string, end: string): boolean {
  const d = dayKey(iso);
  if (!d) return false;
  return (!start || d >= start) && (!end || d <= end);
}

function stageMeta(stages: OpportunityStage[], opp: OpportunityList): OpportunityStage | undefined {
  return stages.find((s) => s.id === opp.stage || s.name === opp.stage_name);
}

function isOpenOpp(stages: OpportunityStage[], opp: OpportunityList): boolean {
  const stage = stageMeta(stages, opp);
  return !stage?.is_closed;
}

function leadName(lead: LeadList): string {
  return lead.full_name || `${lead.first_name} ${lead.last_name ?? ""}`.trim() || "Prospecto";
}

export default function CrmReportPage() {
  const canManage = useCanManageCustomers();
  const month = getCurrentMonthRange();
  const [start, setStart] = useState(month.start);
  const [end, setEnd] = useState(month.end);
  const [tab, setTab] = useState<TabKey>("resumen");
  const prev = previousWindow(start, end);

  const leadsQuery = useQuery({
    queryKey: ["reports", "crm", "leads"],
    queryFn: () => fetchLeads({ page_size: SAMPLE }),
    enabled: canManage,
  });
  const oppsQuery = useQuery({
    queryKey: ["reports", "crm", "opportunities"],
    queryFn: () => fetchOpportunities({ page_size: SAMPLE, is_active: true }),
    enabled: canManage,
  });
  const stagesQuery = useQuery({
    queryKey: ["reports", "crm", "stages"],
    queryFn: fetchOpportunityStages,
    enabled: canManage,
  });
  const openActsQuery = useQuery({
    queryKey: ["reports", "crm", "activities", "open"],
    queryFn: () => fetchFollowUpActivities({ is_completed: false, page_size: SAMPLE }),
    enabled: canManage,
  });
  const doneActsQuery = useQuery({
    queryKey: ["reports", "crm", "activities", "done"],
    queryFn: () => fetchFollowUpActivities({ is_completed: true, page_size: SAMPLE }),
    enabled: canManage,
  });
  const statsQuery = useQuery({
    queryKey: ["reports", "crm", "customer-stats"],
    queryFn: fetchCustomerStats,
    enabled: canManage,
  });

  const leads = leadsQuery.data?.results ?? [];
  const opps = oppsQuery.data ?? [];
  const stages = stagesQuery.data ?? [];
  const openActs = openActsQuery.data ?? [];
  const doneActs = doneActsQuery.data ?? [];
  const loading =
    leadsQuery.isLoading ||
    oppsQuery.isLoading ||
    stagesQuery.isLoading ||
    openActsQuery.isLoading ||
    doneActsQuery.isLoading;

  const report = useMemo(() => {
    const now = new Date();
    const leadsIn = (a: string, b: string) => leads.filter((l) => inRange(l.created, a, b));
    const convertedIn = (a: string, b: string) =>
      leads.filter((l) => l.status === "CONVERTED" && inRange(l.modified, a, b));
    const oppsIn = (a: string, b: string) => opps.filter((o) => inRange(o.created, a, b));
    const doneIn = (a: string, b: string) =>
      doneActs.filter((act) => inRange(act.completed_at || act.modified, a, b));

    const currLeads = leadsIn(start, end);
    const prevLeads = leadsIn(prev.start, prev.end);
    const currConverted = convertedIn(start, end);
    const prevConverted = convertedIn(prev.start, prev.end);
    const currOpps = oppsIn(start, end);
    const prevOpps = oppsIn(prev.start, prev.end);
    const currDone = doneIn(start, end);
    const prevDone = doneIn(prev.start, prev.end);

    const openPipeline = opps.filter((o) => isOpenOpp(stages, o));
    const pipelineValue = openPipeline.reduce((s, o) => s + (Number(o.estimated_value) || 0), 0);
    const weighted = openPipeline.reduce((s, o) => s + (Number(o.weighted_value) || 0), 0);
    const overdue = openActs.filter((a) => {
      if (!a.scheduled_at || a.is_completed) return false;
      return new Date(a.scheduled_at).getTime() < now.getTime();
    });
    const unscheduled = openActs.filter((a) => !a.scheduled_at);

    const byStatus = new Map<string, number>();
    for (const lead of currLeads) {
      const key = leadStatusLabel(lead.status);
      byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
    }
    const statusRows = Array.from(byStatus.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const bySource = new Map<string, number>();
    for (const lead of currLeads) {
      const key = lead.source_name?.trim() || "Sin fuente";
      bySource.set(key, (bySource.get(key) ?? 0) + 1);
    }
    const sourceRows = Array.from(bySource.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const stageRows = stages
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((stage) => {
        const items = opps.filter((o) => o.stage === stage.id || o.stage_name === stage.name);
        return {
          key: stage.name,
          count: items.length,
          total: items.reduce((s, o) => s + (Number(o.estimated_value) || 0), 0),
          secondary: items.reduce((s, o) => s + (Number(o.weighted_value) || 0), 0),
          closed: Boolean(stage.is_closed),
        };
      })
      .filter((row) => row.count > 0);

    const byType = new Map<string, number>();
    for (const act of currDone) {
      const key = activityTypeLabel(act.activity_type);
      byType.set(key, (byType.get(key) ?? 0) + 1);
    }
    const typeRows = Array.from(byType.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const byCategory = new Map<string, number>();
    for (const act of [...currDone, ...openActs.filter((a) => inRange(a.created, start, end))]) {
      const key = act.category_name?.trim() || "Sin categoría";
      byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
    }
    const categoryRows = Array.from(byCategory.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const staleNew = leads.filter((l) => {
      if (l.status !== "NEW" && l.status !== "CONTACTED") return false;
      const created = dayKey(l.created);
      return created && created < start;
    });
    const openWithoutValue = openPipeline.filter((o) => !(Number(o.estimated_value) > 0));
    const qualified = leads.filter((l) => l.status === "QUALIFIED");
    const hasWon = stages.some((s) => s.is_won);
    const hasLost = stages.some((s) => s.is_closed && !s.is_won);

    const findings: Array<{ tone: "rose" | "amber" | "blue"; title: string; detail: string; href: string }> = [];
    if (overdue.length > 0) {
      findings.push({
        tone: "rose",
        title: `${overdue.length} acción${overdue.length === 1 ? "" : "es"} vencida${overdue.length === 1 ? "" : "s"}`,
        detail: "Tienen fecha pasada y siguen abiertas. Conviene cerrarlas o reprogramarlas.",
        href: "/customers/follow-ups",
      });
    }
    if (openWithoutValue.length > 0) {
      findings.push({
        tone: "amber",
        title: `${openWithoutValue.length} oportunidad${openWithoutValue.length === 1 ? "" : "es"} abierta${openWithoutValue.length === 1 ? "" : "s"} sin valor`,
        detail: "El embudo no puede estimar cierre si el monto queda en cero.",
        href: "/customers/pipeline",
      });
    }
    if (staleNew.length > 0) {
      findings.push({
        tone: "amber",
        title: `${staleNew.length} prospecto${staleNew.length === 1 ? "" : "s"} sin avanzar`,
        detail: "Siguen en Nuevo o Contactado desde antes de este período.",
        href: "/customers/prospects",
      });
    }
    if (qualified.length > 0 && openPipeline.length === 0) {
      findings.push({
        tone: "blue",
        title: `${qualified.length} prospecto${qualified.length === 1 ? "" : "s"} calificado${qualified.length === 1 ? "" : "s"} y el embudo abierto está vacío`,
        detail: "Hay interés marcado, pero no hay oportunidades activas para empujarlos.",
        href: "/customers/pipeline",
      });
    }
    if (unscheduled.length > 0) {
      findings.push({
        tone: "blue",
        title: `${unscheduled.length} acción${unscheduled.length === 1 ? "" : "es"} sin fecha`,
        detail: "Quedan en la bandeja, pero no entran a la planificación del día.",
        href: "/customers/follow-ups",
      });
    }
    if (!hasWon || !hasLost) {
      findings.push({
        tone: "blue",
        title: "El embudo no cierra ganado y perdido",
        detail: "Sin esas etapas el informe no puede separar ventas cerradas de oportunidades caídas.",
        href: "/customers/pipeline",
      });
    }

    return {
      currLeads,
      prevLeads,
      currConverted,
      prevConverted,
      currOpps,
      prevOpps,
      currDone,
      prevDone,
      openPipeline,
      pipelineValue,
      weighted,
      overdue,
      unscheduled,
      statusRows,
      sourceRows,
      stageRows,
      typeRows,
      categoryRows,
      findings,
    };
  }, [leads, opps, stages, openActs, doneActs, start, end, prev.start, prev.end]);

  if (!canManage) {
    return <CrmDenied title="Informe CRM" icon={<Users className="h-5 w-5" />} />;
  }

  const capped =
    Boolean(leadsQuery.data?.next) ||
    opps.length >= SAMPLE ||
    openActs.length >= SAMPLE ||
    doneActs.length >= SAMPLE;

  return (
    <div className="mx-auto flex min-h-full w-full min-w-0 max-w-7xl flex-col">
      <PageHeader
        title="Informe CRM"
        icon={<Users className="h-5 w-5" />}
        subtitle="Prospectos, embudo y acciones comerciales del período"
        actions={
          <Link
            href="/customers"
            className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            Ir a clientes
          </Link>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <ReportDateFilters
          start={start}
          end={end}
          onChange={({ start: s, end: e }) => {
            setStart(s);
            setEnd(e);
          }}
          idPrefix="crm"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.key === "hallazgos" && report.findings.length > 0 ? (
              <span className="rounded-full bg-warning px-1.5 text-[10px] font-semibold text-card">
                {report.findings.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <ReportTabPanels activeKey={tab} className="flex flex-col gap-5">
            {tab === "resumen" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ReportKpi
                    label="Prospectos nuevos"
                    value={String(report.currLeads.length)}
                    icon={Users}
                    tone="blue"
                    delta={<DeltaChip curr={report.currLeads.length} prev={report.prevLeads.length} />}
                    hint="Creados en el período"
                  />
                  <ReportKpi
                    label="Convertidos"
                    value={String(report.currConverted.length)}
                    icon={CheckCircle2}
                    tone="emerald"
                    delta={<DeltaChip curr={report.currConverted.length} prev={report.prevConverted.length} />}
                    hint="Pasaron a cliente en el período"
                  />
                  <ReportKpi
                    label="Oportunidades nuevas"
                    value={String(report.currOpps.length)}
                    icon={Kanban}
                    tone="blue"
                    delta={<DeltaChip curr={report.currOpps.length} prev={report.prevOpps.length} />}
                  />
                  <ReportKpi
                    label="Acciones hechas"
                    value={String(report.currDone.length)}
                    icon={ListChecks}
                    tone="emerald"
                    delta={<DeltaChip curr={report.currDone.length} prev={report.prevDone.length} />}
                  />
                  <ReportKpi
                    label="Embudo abierto"
                    value={formatCLP(report.pipelineValue)}
                    icon={FolderKanban}
                    tone="amber"
                    hint={`${report.openPipeline.length} abiertas · ponderado ${formatCLP(report.weighted)}`}
                  />
                  <ReportKpi
                    label="Acciones vencidas"
                    value={String(report.overdue.length)}
                    icon={AlertCircle}
                    tone={report.overdue.length > 0 ? "rose" : "slate"}
                    hint="Abiertas con fecha ya pasada"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {statsQuery.data
                    ? `La sucursal tiene ${statsQuery.data.active_clients} clientes activos de ${statsQuery.data.total_clients}. `
                    : ""}
                  En este período entraron {report.currLeads.length} prospectos, se convirtieron{" "}
                  {report.currConverted.length} y se cerraron {report.currDone.length} acciones.
                  {capped ? " Cada lista usa hasta 200 registros recientes." : ""}
                </p>
                <div className="grid gap-3 lg:grid-cols-2">
                  <CountPanel title="Prospectos del período por estado" rows={report.statusRows} />
                  <CountPanel title="Prospectos del período por fuente" rows={report.sourceRows} />
                </div>
              </>
            ) : null}

            {tab === "embudo" ? (
              <GroupPanel
                title="Oportunidades por etapa"
                icon={Kanban}
                rows={report.stageRows}
                columns={{ count: "Cantidad", total: "Valor estimado", secondary: "Ponderado" }}
                emptyMessage="No hay oportunidades en el embudo."
              />
            ) : null}

            {tab === "acciones" ? (
              <>
                <div className="grid gap-3 lg:grid-cols-2">
                  <CountPanel title="Acciones hechas por tipo" rows={report.typeRows} />
                  <CountPanel title="Acciones del período por categoría" rows={report.categoryRows} />
                </div>
                <OverdueList items={report.overdue} />
              </>
            ) : null}

            {tab === "hallazgos" ? (
              report.findings.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Sin hallazgos"
                  description="Prospectos, embudo y acciones no muestran huecos en lo que alcanza a ver este informe."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {report.findings.map((f) => (
                    <li key={f.title}>
                      <Link
                        href={f.href}
                        className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                      >
                        <AlertCircle
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            f.tone === "rose" && "text-danger",
                            f.tone === "amber" && "text-warning",
                            f.tone === "blue" && "text-primary",
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{f.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{f.detail}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </ReportTabPanels>
        )}
      </div>
    </div>
  );
}

function CountPanel({ title, rows }: { title: string; rows: Array<{ key: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 p-4 pb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{rows.length} grupo(s)</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">Sin datos en el período.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.key}</p>
                <ShareBar value={row.count} max={max} />
              </div>
              <span className="text-sm font-semibold tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OverdueList({ items }: { items: FollowUpActivity[] }) {
  const shown = items.slice(0, 8);
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 p-4 pb-3">
        <h3 className="text-sm font-semibold">Vencidas ahora</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{items.length}</span>
      </div>
      {shown.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">No hay acciones con fecha vencida.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {shown.map((act) => (
            <li key={act.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{act.description || "Sin detalle"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {activityTypeLabel(act.activity_type)}
                  {act.category_name ? ` · ${act.category_name}` : ""}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-danger">
                {dayKey(act.scheduled_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
