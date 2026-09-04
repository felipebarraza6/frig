"use client";

import { useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownPortal } from "./dropdown-portal";

export interface ActionMenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  danger?: boolean;
}

interface ActionsMenuProps {
  items: ActionMenuItem[];
  ariaLabel?: string;
  /** Optional custom trigger content. Defaults to MoreVertical icon. */
  trigger?: React.ReactNode;
  /** Variant of the trigger button. */
  variant?: "ghost" | "outline" | "default";
  /** Size of the trigger button. */
  size?: "sm" | "default" | "icon";
  /** Optional className for the trigger button. */
  className?: string;
}

export function ActionsMenu({
  items,
  ariaLabel = "Acciones",
  trigger,
  variant = "ghost",
  size = "sm",
  className,
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        variant={variant}
        size={size}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={className}
      >
        {trigger ?? <MoreVertical className="h-4 w-4" />}
      </Button>
      <DropdownPortal
        triggerRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        align="right"
        className="w-44 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onClick();
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted ${
              item.danger ? "text-danger" : "text-foreground"
            }`}
          >
            {item.icon && <item.icon className="h-4 w-4" />}
            {item.label}
          </button>
        ))}
      </DropdownPortal>
    </div>
  );
}
