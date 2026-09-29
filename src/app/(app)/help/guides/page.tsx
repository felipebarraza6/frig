"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  HandCoins,
  Table,
  Package,
  LifeBuoy,
  Code2,
  LayoutDashboard,
  UserIcon,
  ShoppingBag,
  FileText,
  Cuboid,
  Monitor,
  UserCircle,
  Percent,
  Boxes,
  Tags,
  Apple,
  Store,
  Warehouse,
  ClipboardList,
  Banknote,
  ArrowDownLeft,
  Truck,
  Wallet,
  Settings,
  TrendingUp,
  Building2,
  CreditCard,
  FolderKanban,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageBody, PageShell } from "@/components/page-shell";
import { HelpExamplePreview } from "@/components/help/help-example";
import { HelpSearch } from "@/components/help/help-search";
import {
  HelpCardsSkeleton,
  HelpMotionItem,
  HelpMotionSection,
  HelpReveal,
} from "@/components/help/help-motion";
import {
  HELP_GUIDES,
  HELP_GUIDE_GROUPS,
  getHelpGuide,
  type HelpGuide,
  type HelpGuideAudience,
  type HelpGuideGroup,
} from "@/lib/help/guides";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  HandCoins,
  Table,
  Package,
  LifeBuoy,
  Code2,
  LayoutDashboard,
  UserIcon,
  ShoppingBag,
  FileText,
  Cuboid,
  Monitor,
  UserCircle,
  Percent,
  Boxes,
  Tags,
  Apple,
  Store,
  Warehouse,
  ClipboardList,
  Banknote,
  ArrowDownLeft,
  Truck,
  Wallet,
  Settings,
  TrendingUp,
  Building2,
  CreditCard,
  FolderKanban,
  BookOpen,
};

const AUDIENCE_LABEL: Record<HelpGuideAudience, string> = {
  ops: "Operación",
  admin: "Administración",
  dev: "Desarrollo",
};

function GuideIcon({ name }: { name: string }) {
  const Icon = ICONS[name] ?? BookOpen;
  return <Icon className="h-4 w-4" />;
}

function GuidesInner() {
  const router = useRouter();
  const search = useSearchParams();
  const slug = search.get("slug");
  const audience = (search.get("audience") as HelpGuideAudience | null) ?? null;
  const groupFilter = (search.get("group") as HelpGuideGroup | null) ?? null;

  const guide = slug ? getHelpGuide(slug) : null;

  const list = useMemo(() => {
    let items = HELP_GUIDES;
    if (audience) items = items.filter((g) => g.audience.includes(audience));
    if (groupFilter) items = items.filter((g) => g.group === groupFilter);
    return items;
  }, [audience, groupFilter]);

  const grouped = useMemo(() => {
    return HELP_GUIDE_GROUPS.map((g) => ({
      ...g,
      guides: list.filter((item) => item.group === g.id),
    })).filter((g) => g.guides.length > 0);
  }, [list]);

  function replaceQuery(patch: {
    slug?: string | null;
    audience?: HelpGuideAudience | null;
    group?: HelpGuideGroup | null;
  }) {
    const qs = new URLSearchParams();
    const nextAudience = patch.audience === undefined ? audience : patch.audience;
    const nextGroup = patch.group === undefined ? groupFilter : patch.group;
    const nextSlug = patch.slug === undefined ? slug : patch.slug;
    if (nextAudience) qs.set("audience", nextAudience);
    if (nextGroup) qs.set("group", nextGroup);
    if (nextSlug) qs.set("slug", nextSlug);
    const q = qs.toString();
    router.replace(q ? `/help/guides?${q}` : "/help/guides");
  }

  function openGuide(g: HelpGuide) {
    replaceQuery({ slug: g.slug });
  }

  return (
    <PageShell>
      <PageHeader
        title={guide ? guide.title : "Guías de uso"}
        subtitle={
          guide
            ? guide.summary
            : "Elige un rol o un área. Cada guía cubre una pantalla de la app."
        }
        icon={<BookOpen className="h-5 w-5" />}
        actions={
          guide ? (
            <button
              type="button"
              onClick={() => replaceQuery({ slug: null })}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/40"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Todas
            </button>
          ) : (
            <Link
              href="/help"
              className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/40"
            >
              Volver a Ayuda
            </Link>
          )
        }
      />

      <PageBody>
        <HelpMotionSection className="flex flex-col gap-5">
        {!guide && (
          <HelpMotionItem className="flex flex-col gap-3">
            <HelpSearch />
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: null, label: "Todos los roles" },
                  { id: "ops" as const, label: "Operación" },
                  { id: "admin" as const, label: "Administración" },
                  { id: "dev" as const, label: "Desarrollo" },
                ] as const
              ).map((f) => {
                const active = audience === f.id || (!audience && f.id === null);
                return (
                  <button
                    key={String(f.id)}
                    type="button"
                    onClick={() => replaceQuery({ audience: f.id, slug: null })}
                    className={cn(
                      "glass-chip inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors",
                      active
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => replaceQuery({ group: null, slug: null })}
                className={cn(
                  "glass-chip inline-flex h-8 items-center rounded-full px-3 text-xs font-medium",
                  !groupFilter
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Todas las áreas
              </button>
              {HELP_GUIDE_GROUPS.map((g) => {
                const count = HELP_GUIDES.filter(
                  (item) =>
                    item.group === g.id &&
                    (!audience || item.audience.includes(audience)),
                ).length;
                if (count === 0) return null;
                const active = groupFilter === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => replaceQuery({ group: g.id, slug: null })}
                    className={cn(
                      "glass-chip inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
                      active
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g.label}
                    <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </HelpMotionItem>
        )}

        {guide ? (
          <HelpMotionSection key={guide.slug} className="mx-auto w-full max-w-3xl">
          <article className="glass flex flex-col gap-8 rounded-2xl px-5 py-6 sm:px-8 sm:py-8">
            <HelpMotionItem className="flex flex-wrap gap-1.5">
              {guide.audience.map((a) => (
                <span
                  key={a}
                  className="glass-chip rounded-full px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {AUDIENCE_LABEL[a]}
                </span>
              ))}
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
                {HELP_GUIDE_GROUPS.find((g) => g.id === guide.group)?.label ?? guide.group}
              </span>
              {guide.href && guide.href !== "/help/api" && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Pantalla de la app
                </span>
              )}
            </HelpMotionItem>
            {guide.sections.map((section) => (
              <HelpMotionItem key={section.heading} className="flex flex-col gap-3">
                <h2 className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                  {section.heading}
                </h2>
                <HelpMotionSection className="flex flex-col gap-2.5">
                  {section.body.map((p, i) => (
                    <HelpReveal
                      key={p}
                      className="flex gap-3 text-[15px] leading-7 text-muted-foreground"
                    >
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold tabular-nums text-primary">
                        {i + 1}
                      </span>
                      <span className="min-w-0 text-pretty">{p}</span>
                    </HelpReveal>
                  ))}
                </HelpMotionSection>
                {section.tips && section.tips.length > 0 && (
                  <div className="mt-1 rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Tips
                    </p>
                    <HelpMotionSection className="mt-2 flex flex-col gap-1.5">
                      {section.tips.map((t) => (
                        <HelpReveal
                          key={t}
                          className="text-[13px] leading-6 text-foreground/85 text-pretty"
                        >
                          {t}
                        </HelpReveal>
                      ))}
                    </HelpMotionSection>
                  </div>
                )}
                {section.limits && section.limits.length > 0 && (
                  <div className="mt-1 rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Qué no cubre
                    </p>
                    <HelpMotionSection className="mt-2 flex flex-col gap-1.5">
                      {section.limits.map((t) => (
                        <HelpReveal
                          key={t}
                          className="text-[13px] leading-6 text-foreground/85 text-pretty"
                        >
                          {t}
                        </HelpReveal>
                      ))}
                    </HelpMotionSection>
                  </div>
                )}
                {section.example && <HelpExamplePreview example={section.example} />}
              </HelpMotionItem>
            ))}
            <HelpMotionItem className="flex flex-wrap gap-2 border-t border-border/60 pt-5">
              {guide.href && (
                <Link
                  href={guide.href}
                  className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/40"
                >
                  Abrir pantalla
                </Link>
              )}
              {guide.audience.includes("dev") && (
                <Link
                  href="/help/api"
                  className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/40"
                >
                  Abrir consola API
                </Link>
              )}
            </HelpMotionItem>
          </article>
          </HelpMotionSection>
        ) : (
          <div className="flex flex-col gap-6">
            {grouped.map((g) => (
              <HelpMotionItem key={g.id} className="flex flex-col gap-2">
                <div className="px-0.5">
                  <h2 className="font-display text-[15px] font-semibold tracking-tight">
                    {g.label}
                  </h2>
                  <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                    {g.description}
                  </p>
                </div>
                <HelpMotionSection className="grid gap-3 sm:grid-cols-2">
                  {g.guides.map((item) => (
                    <HelpMotionItem key={item.slug}>
                      <button
                        type="button"
                        onClick={() => openGuide(item)}
                        className="glass group flex h-full w-full flex-col gap-3 rounded-2xl p-4 text-left transition-all hover:shadow-sm"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary transition-transform group-hover:scale-105">
                          <GuideIcon name={item.icon} />
                        </span>
                        <div>
                          <p className="font-display text-[15px] font-semibold tracking-tight group-hover:text-primary">
                            {item.title}
                          </p>
                          <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground text-pretty">
                            {item.summary}
                          </p>
                        </div>
                        <div className="mt-auto flex flex-wrap gap-1">
                          {item.audience.map((a) => (
                            <span
                              key={a}
                              className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {AUDIENCE_LABEL[a]}
                            </span>
                          ))}
                        </div>
                      </button>
                    </HelpMotionItem>
                  ))}
                </HelpMotionSection>
              </HelpMotionItem>
            ))}
          </div>
        )}
        </HelpMotionSection>
      </PageBody>
    </PageShell>
  );
}

export default function HelpGuidesPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <PageHeader title="Guías de uso" icon={<BookOpen className="h-5 w-5" />} />
          <PageBody>
            <HelpCardsSkeleton count={6} />
          </PageBody>
        </PageShell>
      }
    >
      <GuidesInner />
    </Suspense>
  );
}
