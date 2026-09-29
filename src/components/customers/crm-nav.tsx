"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  FileText,
  FolderKanban,
  Kanban,
  UserCircle,
  Users,
} from "lucide-react";
import { useCanManageCustomers } from "@/lib/store/session";
import { fetchLeads } from "@/lib/api/crm-leads";
import { fetchFollowUpActivities, fetchOpportunities } from "@/lib/api/crm";
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
  const canManage = useCanManageCustomers();

  // Queries for real-time counts across all CRM pages
  const leadsQuery = useQuery({
    queryKey: ["crm", "leads", "nav-counter"],
    queryFn: () => fetchLeads({ page_size: 50 }),
    enabled: canManage && propProspects === undefined,
    staleTime: 45_000,
  });

  const pipelineQuery = useQuery({
    queryKey: ["crm", "opportunities", "nav-counter"],
    queryFn: () => fetchOpportunities({ is_active: true, page_size: 100 }),
    enabled: canManage && propPipeline === undefined,
    staleTime: 45_000,
  });

  const followUpsQuery = useQuery({
    queryKey: ["crm", "activities", "nav-counter"],
    queryFn: () => fetchFollowUpActivities({ is_completed: false, page_size: 50 }),
    enabled: canManage && propFollowUps === undefined,
    staleTime: 45_000,
  });

  const prospectsCount =
    propProspects ??
    (leadsQuery.data?.results ?? []).filter(
      (l) => !["CONVERTED", "LOST", "ARCHIVED"].includes(l.status ?? ""),
    ).length;

  const pipelineCount = propPipeline ?? (pipelineQuery.data?.length ?? 0);

  const followUpsCount =
    propFollowUps ??
    (followUpsQuery.data ?? []).length;

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
