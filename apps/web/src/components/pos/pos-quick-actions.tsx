"use client";

import { useState, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  ClipboardList,
  UserSearch,
  Truck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchBranchPOSConfig,
  DEFAULT_POS_QUICK_ACTIONS,
  type POSQuickAction,
} from "@/lib/api/branches";
import { fetchPaymentMethods } from "@/lib/api/payments";
import { getCurrentCashRegister } from "@/lib/api/cash-register";
import { fetchOrders } from "@/lib/api/orders";
import { fetchPurchaseOrders } from "@/lib/api/suppliers";
import { cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";
import PayPendingItemModal from "./pay-pending-item-modal";

type Order = YggdraSchemas["Order"] & {
  order_number?: string | null;
  paid_amount?: string | null;
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Receipt,
  ClipboardList,
  UserSearch,
  Truck,
};

const TYPE_LABELS: Record<POSQuickAction["type"], string> = {
  pay_account: "Cuentas",
  pay_order: "Órdenes",
  collect: "Cobrar por cliente",
  pay_purchase_order: "Órdenes de compra",
};

type PaymentMethodItem = {
  id: string;
  name: string;
  is_active: boolean;
  is_pos_enabled?: boolean;
};

interface PosQuickActionsProps {
  stationId?: number | string | null;
  onContinueOrder?: (order: Order) => void;
  onCancelOrder?: (order: Order) => void;
}

export default function PosQuickActions({
  stationId,
  onContinueOrder,
  onCancelOrder,
}: PosQuickActionsProps) {
  const [activeType, setActiveType] = useState<string | null>(null);

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["branch-pos-config"],
    queryFn: fetchBranchPOSConfig,
    staleTime: 60_000,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  const posPaymentMethods = useMemo(
    () => paymentMethods.filter((m) => m.is_active && m.is_pos_enabled !== false),
    [paymentMethods],
  );

  const { data: cashRegister } = useQuery({
    queryKey: ["cash-register", "current", stationId],
    queryFn: () => getCurrentCashRegister(stationId),
    staleTime: 30_000,
    retry: false,
  });

  const { data: accountsCountData } = useQuery({
    queryKey: ["pending-accounts-count"],
    queryFn: async () => {
      const data = await fetchOrders({ order_type: "SALE", payment_status: ["PENDING", "PARTIAL"], page_size: 1 });
      return data.count ?? (data.results?.length ?? 0);
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: ordersCountData } = useQuery({
    queryKey: ["pending-orders-count"],
    queryFn: async () => {
      const [byPayment, byDelivery] = await Promise.all([
        fetchOrders({ order_type: "ORDER", payment_status: ["PENDING", "PARTIAL"], page_size: 50 }),
        fetchOrders({ order_type: "ORDER", status: ["PENDING", "IN_PROGRESS"], page_size: 50 }),
      ]);
      const map = new Map<string, Order>();
      for (const o of [...(byPayment.results ?? []), ...(byDelivery.results ?? [])] as Order[]) {
        map.set(o.id, o);
      }
      const filtered = Array.from(map.values()).filter(
        (o) =>
          ["PENDING", "PARTIAL"].includes(o.payment_status ?? "") ||
          ["PENDING", "IN_PROGRESS"].includes(o.status ?? ""),
      );
      if (filtered.length >= 50) {
        const c1 = byPayment.count ?? 0;
        const c2 = byDelivery.count ?? 0;
        return Math.max(c1, c2, filtered.length);
      }
      return filtered.length;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: collectCountData } = useQuery({
    queryKey: ["pending-collect-count"],
    queryFn: async () => {
      const data = await fetchOrders({ order_type: ["SALE", "ORDER"], payment_status: ["PENDING", "PARTIAL"], page_size: 100 });
      const ids = new Set<number | string>();
      for (const o of (data.results ?? []) as Order[]) {
        const cid = (o.client as unknown as { id?: number | string })?.id;
        if (cid != null) ids.add(cid);
      }
      if ((data.results?.length ?? 0) >= 100 && data.count != null && data.count > 100) {
        return ids.size > 0 ? ids.size : (data.count ?? 0);
      }
      return ids.size;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: purchaseOrdersCountData } = useQuery({
    queryKey: ["pending-purchase-orders-count"],
    queryFn: async () => {
      const data = await fetchPurchaseOrders({ status: "SENT", payment_status: "PENDING", page_size: 1 });
      return data.count ?? (data.results?.length ?? 0);
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  function getCountForAction(type: string): number {
    switch (type) {
      case "pay_account":
        return accountsCountData ?? 0;
      case "pay_order":
        return ordersCountData ?? 0;
      case "collect":
        return collectCountData ?? 0;
      case "pay_purchase_order":
        return purchaseOrdersCountData ?? 0;
      default:
        return 0;
    }
  }

  const actions = useMemo(() => {
    const list = config?.quick_actions?.length
      ? config.quick_actions
      : DEFAULT_POS_QUICK_ACTIONS;
    return list.filter((a) => a.enabled);
  }, [config]);

  const activeAction = useMemo(
    () => actions.find((a) => a.id === activeType) ?? null,
    [actions, activeType],
  );

  if (config?.enable_quick_actions === false || actions.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-visible">
        {loadingConfig && !config ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          actions.map((action) => {
            const Icon = ICON_MAP[action.icon] ?? Receipt;
            const count = getCountForAction(action.type);
            return (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveType(action.id)}
                title={TYPE_LABELS[action.type]}
                className={cn(
                  "relative h-7 gap-1 overflow-visible border-primary/20 px-2 text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
                  "sm:h-8 sm:px-2.5",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                <span className="hidden whitespace-nowrap lg:inline">{TYPE_LABELS[action.type]}</span>
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Button>
            );
          })
        )}
      </div>

    {activeAction && (
      <PayPendingItemModal
        open={!!activeAction}
        type={activeAction.type}
        onClose={() => setActiveType(null)}
        cashRegisterId={cashRegister?.id ?? null}
        paymentMethods={posPaymentMethods as PaymentMethodItem[]}
        onContinueOrder={onContinueOrder}
        onCancelOrder={onCancelOrder}
      />
    )}
  </>
  );
}
