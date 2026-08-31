"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  ClipboardList,
  UserSearch,
  Truck,
  TrendingDown,
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
import { cn } from "@/lib/utils";
import PayPendingItemModal from "./pay-pending-item-modal";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Receipt,
  ClipboardList,
  UserSearch,
  Truck,
  TrendingDown,
};

type PaymentMethodItem = {
  id: string;
  name: string;
  is_active: boolean;
  is_pos_enabled?: boolean;
};

interface PosQuickActionsProps {
  stationId?: number | string | null;
}

export default function PosQuickActions({ stationId }: PosQuickActionsProps) {
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

  const { data: cashRegister } = useQuery({
    queryKey: ["cash-register", "current", stationId],
    queryFn: () => getCurrentCashRegister(stationId),
    staleTime: 30_000,
    retry: false,
  });

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
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-background px-3 py-2">
        {loadingConfig && !config ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          actions.map((action) => {
            const Icon = ICON_MAP[action.icon] ?? Receipt;
            return (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveType(action.id)}
                className={cn(
                  "gap-1.5 text-xs",
                  action.color && `border-${action.color}-500/30 hover:bg-${action.color}-500/10`,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{action.label}</span>
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
        paymentMethods={paymentMethods as PaymentMethodItem[]}
      />
    )}
  </>
  );
}
