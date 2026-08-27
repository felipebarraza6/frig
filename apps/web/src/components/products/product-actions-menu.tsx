"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pencil, Warehouse, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { YggdraProduct } from "@/lib/api/types";

interface ProductActionsMenuProps {
  product: YggdraProduct;
  onEdit: (product: YggdraProduct) => void;
  onEditWarehouses: (product: YggdraProduct) => void;
  onDuplicate: (product: YggdraProduct) => void;
  onDelete: (product: YggdraProduct) => void;
}

export function ProductActionsMenu({
  product,
  onEdit,
  onEditWarehouses,
  onDuplicate,
  onDelete,
}: ProductActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const items = [
    {
      label: "Editar",
      icon: Pencil,
      onClick: () => {
        onEdit(product);
        setOpen(false);
      },
    },
    {
      label: "Editar bodegas",
      icon: Warehouse,
      onClick: () => {
        onEditWarehouses(product);
        setOpen(false);
      },
    },
    {
      label: "Duplicar",
      icon: Copy,
      onClick: () => {
        onDuplicate(product);
        setOpen(false);
      },
    },
    {
      label: "Eliminar",
      icon: Trash2,
      danger: true,
      onClick: () => {
        onDelete(product);
        setOpen(false);
      },
    },
  ];

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Acciones de ${product.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-border bg-card shadow-lg">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted ${
                  item.danger ? "text-danger" : "text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
