"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  FolderKanban,
  Kanban,
  UserCircle,
  Users,
} from "lucide-react";
import { useCrmNavCounts } from "@/lib/hooks/useCrm";
import { cn } from "@/lib/utils";

interface CrmNavProps {
  prospectsCount?: number;
  followUpsCount?: number;
  pipelineCount?: number;
  className?: string;
}

export function CrmNav({
  prospectsCount: propProspects,
  followUpsCount: propFollowUps,
  pipelineCount: propPipeline,
  className,
}: CrmNavProps) {
  const pathname = usePathname();

  // Contadores compartidos con el hub y los informes (misma query key).
  const counts = useCrmNavCounts(
    propProspects === undefined ||
      propFollowUps === undefined ||
      propPipeline === undefined,
  );

  const prospectsCount = propProspects ?? counts.prospectsCount;
  const pipelineCount = propPipeline ?? counts.pipelineCount;
  const followUpsCount = propFollowUps ?? counts.followUpsCount;

  const items = [
    {
      href: "/customers",
      label: "Clientes",
      icon: UserCircle,
      exact: true,
    },
    {
      href: "/customers/prospects",
      label: "Prospectos",
      icon: Users,
      badge: prospectsCount,
    },
    {
      href: "/customers/pipeline",
      label: "Pipeline",
      icon: Kanban,
      badge: pipelineCount,
    },
    {
      href: "/customers/follow-ups",
      label: "Seguimientos",
      icon: FolderKanban,
      badge: followUpsCount,
    },
    {
      href: "/customers/forms",
      label: "Fichas",
      icon: FileText,
    },
    {
      href: "/customers/surveys",
      label: "Encuestas",
      icon: ClipboardList,
    },
  ];

  return (
    <nav
      className={cn(
        "flex items-center gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      aria-label="Navegación CRM"
    >
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{item.label}</span>
            {typeof item.badge === "number" && item.badge > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted-foreground/15 text-foreground",
                )}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
