"use client";

import Link from "next/link";
import {
  BookOpen,
  Code2,
  ArrowRight,
  KeyRound,
  Link2,
  Sparkles,
  HandCoins,
  Table,
  Users,
  Package,
  Wallet,
  BarChart3,
  Settings,
  LifeBuoy,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageBody, PageShell } from "@/components/page-shell";
import {
  HELP_GUIDES,
  HELP_GUIDE_GROUPS,
  helpGuideCount,
  type HelpGuideGroup,
} from "@/lib/help/guides";
import { API_BASE } from "@/lib/api/client";
import { FRIG_API_APPS } from "@/lib/api/openapi";
import { HelpMotionItem, HelpMotionSection } from "@/components/help/help-motion";
import { HelpSearch } from "@/components/help/help-search";
import { cn } from "@/lib/utils";

const GROUP_ICONS: Record<HelpGuideGroup, LucideIcon> = {
  inicio: Sparkles,
  vender: HandCoins,
  local: Table,
  crm: Users,
  catalogo: Package,
  dinero: Wallet,
  informes: BarChart3,
  ajustes: Settings,
  ayuda: LifeBuoy,
  integraciones: Terminal,
};

const PILLARS = [
  {
    href: "/help/guides",
    title: "Guías de uso",
    blurb: "Cómo usar cada parte de la app: ventas, cocina, inventario y más.",
    icon: BookOpen,
    cta: "Ver guías",
  },
  {
    href: "/help/api",
    title: "API para integrar",
    blurb: "Solo lo que la app usa en el local: qué puedes automatizar, qué no, y cómo copiar cada ruta.",
    icon: Code2,
    cta: "Abrir consola",
  },
  {
    href: "/support",
    title: "Soporte",
    blurb: "Reporta un problema, pide una aclaración o envía una idea al equipo.",
    icon: LifeBuoy,
    cta: "Abrir soporte",
  },
] as const;

export default function HelpHubPage() {
  return (
    <PageShell>
      <PageHeader
        title="Ayuda"
        subtitle="Lee cómo opera el local, conecta tu sistema o habla con el equipo."
        icon={<BookOpen className="h-5 w-5" />}
      />

      <PageBody>
        <HelpMotionSection className="flex flex-col gap-6">
          <HelpMotionItem>
            <section className="glass rounded-2xl px-5 py-6 sm:px-7 sm:py-7">
              <div className="flex max-w-xl flex-col gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Centro de ayuda
                </p>
                <h2 className="font-display text-xl font-semibold tracking-tight text-pretty sm:text-2xl">
                  Encuentra lo que necesitas
                </h2>
                <p className="text-[15px] leading-7 text-muted-foreground text-pretty">
                  {helpGuideCount()} guías del local, {FRIG_API_APPS.length} áreas de API
                  y un canal de soporte. El mismo criterio que en el resto de la app.
                </p>
                <HelpSearch className="mt-3 max-w-xl" />
              </div>
            </section>
          </HelpMotionItem>

          <HelpMotionSection className="grid gap-3 sm:grid-cols-3">
            {PILLARS.map((p) => {
              const Icon = p.icon;
              return (
                <HelpMotionItem key={p.href}>
                  <Link
                    href={p.href}
                    className={cn(
                      "glass group flex h-full flex-col gap-3 rounded-2xl p-4",
                      "transition-all hover:shadow-sm",
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="flex min-h-[4.5rem] flex-col">
                      <p className="font-display text-[15px] font-semibold tracking-tight">
                        {p.title}
                      </p>
                      <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground text-pretty">
                        {p.blurb}
                      </p>
                    </div>
                    <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                      {p.cta}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </HelpMotionItem>
              );
            })}
          </HelpMotionSection>

          <HelpMotionItem className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Guías por área</h3>
              <Link
                href="/help/guides"
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver todas
              </Link>
            </div>
            <HelpMotionSection className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {HELP_GUIDE_GROUPS.map((g) => {
                const count = HELP_GUIDES.filter((item) => item.group === g.id).length;
                if (count === 0) return null;
                const Icon = GROUP_ICONS[g.id] ?? BookOpen;
                return (
                  <HelpMotionItem key={g.id}>
                    <Link
                      href={`/help/guides?group=${g.id}`}
                      className="glass group flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-all hover:shadow-sm"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{g.label}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {g.description}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                        {count}
                      </span>
                    </Link>
                  </HelpMotionItem>
                );
              })}
            </HelpMotionSection>
          </HelpMotionItem>

          <HelpMotionSection className="grid gap-3 lg:grid-cols-2">
            <HelpMotionItem>
              <div className="glass h-full rounded-2xl p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Terminal className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold">Para conectar tu sistema</p>
                </div>
                <ul className="space-y-2.5">
                  <li className="flex gap-2.5 rounded-xl bg-primary/[0.04] px-3 py-2.5">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="block text-sm font-medium">Acceso</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        Token de sesión + identificador de sucursal en cada llamada.
                      </span>
                    </span>
                  </li>
                  <li className="flex gap-2.5 rounded-xl bg-primary/[0.04] px-3 py-2.5">
                    <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="block text-sm font-medium">Dirección base</span>
                      <span className="mt-0.5 block break-all font-mono text-[11px] text-muted-foreground">
                        {API_BASE}
                      </span>
                    </span>
                  </li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <Link href="/help/api" className="font-medium text-primary hover:underline">
                    Abrir consola API
                  </Link>
                </div>
              </div>
            </HelpMotionItem>

            <HelpMotionItem>
              <div className="glass h-full rounded-2xl p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold">Empieza por aquí</p>
                </div>
                <ul className="space-y-2">
                  {["primeros-pasos", "pos", "suscripcion", "integraciones-api"].map((slug) => {
                    const g = HELP_GUIDES.find((item) => item.slug === slug);
                    if (!g) return null;
                    return (
                      <li key={g.slug}>
                        <Link
                          href={`/help/guides?slug=${g.slug}`}
                          className="group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-primary/[0.06]"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium group-hover:text-primary">
                              {g.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              {g.summary}
                            </span>
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </HelpMotionItem>
          </HelpMotionSection>
        </HelpMotionSection>
      </PageBody>
    </PageShell>
  );
}
