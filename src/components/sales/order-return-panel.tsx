"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCLP } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { returnOrderProducts } from "@/lib/api/orders";

interface ReturnRow {
  id: string | number;
  name: string;
  max: number;
  unitPrice: string | number;
}

export function OrderReturnPanel({ orderId, products }: { orderId: string; products: ReturnRow[] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});

  const ret = useMutation({
    mutationFn: () => {
      const items = products
        .map((p) => ({
          order_product_id: p.id,
          quantity_to_return: Number.parseInt(qty[String(p.id)] || "0", 10) || 0,
        }))
        .filter((i) => i.quantity_to_return > 0);
      return returnOrderProducts(orderId, { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setOpen(false);
      setQty({});
      toast.success("Devolución registrada");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo registrar la devolución"),
  });

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="mt-2 h-8 border-danger/30 text-danger hover:bg-danger/5" onClick={() => setOpen(true)}>
        Devolver productos
      </Button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-danger/20 bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Devolver productos</p>
      <div className="mt-2 flex flex-col gap-2">
        {products.map((p) => (
          <div key={String(p.id)} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">máx {p.max} · {formatCLP(p.unitPrice ?? 0)}</p>
            </div>
            <Input
              value={qty[String(p.id)] || ""}
              onChange={(e) => setQty((q) => ({ ...q, [String(p.id)]: e.target.value }))}
              placeholder="0"
              inputMode="numeric"
              className="h-8 w-20"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="ghost" className="h-8" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button size="sm" className="h-8" onClick={() => ret.mutate()} disabled={ret.isPending} isLoading={ret.isPending}>
          Confirmar devolución
        </Button>
      </div>
    </div>
  );
}
