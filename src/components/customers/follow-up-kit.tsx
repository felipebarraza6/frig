"use client";

import type { LucideIcon } from "lucide-react";
import {
  FileText,
  ListTodo,
  Mail,
  NotebookPen,
  Phone,
  Users,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  activityTypeLabel,
  FOLLOW_UP_ACTIVITY_OPTIONS,
  type FollowUpActivity,
  type FollowUpCategory,
  type OpportunityActivityType,
} from "@/lib/api/crm";
import { cn } from "@/lib/utils";

export const CATEGORY_COLORS = [
  "#f59e0b",
  "#8b5cf6",
  "#1890ff",
  "#16a34a",
  "#ef4444",
  "#64748b",
  "#ec4899",
  "#0ea5e9",
];

const ACTION_ICONS: Record<string, LucideIcon> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  NOTE: NotebookPen,
  TASK: ListTodo,
  QUOTE: FileText,
};

export function actionIcon(type?: string | null): LucideIcon {
  if (!type) return NotebookPen;
  return ACTION_ICONS[type] ?? NotebookPen;
}

export function shortDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActionTypePicker({
  value,
  onChange,
}: {
  value: OpportunityActivityType;
  onChange: (next: OpportunityActivityType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FOLLOW_UP_ACTIVITY_OPTIONS.map((opt) => {
        const Icon = actionIcon(opt.value);
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            <Icon className="h-3 w-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  allowEmpty = true,
}: {
  categories: FollowUpCategory[];
  value: string;
  onChange: (next: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowEmpty ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            value === ""
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground",
          )}
        >
          Sin categoría
        </button>
      ) : null}
      {categories.map((category) => {
        const active = value === category.id;
        const color = category.color || "#1890ff";
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onChange(category.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
              active ? "text-white" : "bg-muted text-foreground",
            )}
            style={active ? { backgroundColor: color } : undefined}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: active ? "white" : color }}
            />
            {category.name}
          </button>
        );
      })}
    </div>
  );
}

export function PlanningCard({
  activity,
  clientName,
  clientHref,
  onComplete,
  completing,
}: {
  activity: FollowUpActivity;
  clientName?: string;
  clientHref?: string | null;
  onComplete?: (id: string) => void;
  completing?: boolean;
}) {
  const Icon = actionIcon(activity.activity_type);
  const done = Boolean(activity.is_completed);
  const color = activity.category_color || "#64748b";
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:shadow-sm",
        done && "border-emerald-500/25 bg-emerald-500/[0.03]",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            done
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-primary/10 text-primary",
          )}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-semibold">
              {activityTypeLabel(activity.activity_type)}
            </p>
            {done && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                Completada
              </span>
            )}
          </div>
          {clientHref ? (
            <Link href={clientHref} className="block truncate text-[11px] font-medium text-primary hover:underline">
              {clientName || "Cliente"}
            </Link>
          ) : (
            <p className="truncate text-[11px] text-muted-foreground">{clientName || "Sin cliente"}</p>
          )}
        </div>
      </div>
      {activity.category_name ? (
        <span
          className="w-fit rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {activity.category_name}
        </span>
      ) : null}
      <p className="line-clamp-3 text-sm leading-snug text-foreground/90">{activity.description}</p>
      <div className="mt-auto flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>
          {activity.scheduled_at
            ? shortDateTime(activity.scheduled_at)
            : done && activity.completed_at
              ? `Hecho ${shortDateTime(activity.completed_at)}`
              : "Sin fecha"}
        </span>
        {!done && onComplete ? (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7 px-2"
            disabled={completing}
            onClick={() => onComplete(activity.id)}
          >
            <Check className="h-3.5 w-3.5" />
            Listo
          </Button>
        ) : null}
      </div>
    </article>
  );
}
