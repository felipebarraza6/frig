import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { CRM_KEYS } from "@/lib/api/keys";
import {
  fetchFollowUpActivities,
  fetchFollowUpCategories,
  fetchOpportunities,
  fetchOpportunityClientMap,
  fetchOpportunityStages,
  ensureDefaultOpportunityStages,
  ensureFollowUpCategories,
} from "@/lib/api/crm";
import {
  fetchLeads,
  fetchLeadSources,
  ensureDefaultLeadSource,
} from "@/lib/api/crm-leads";
import { useCanManageCustomers } from "@/lib/store/session";

/**
 * Seeds de CRM (etapas/categorías/fuente por defecto) corriendo UNA vez por
 * sesión, fuera de los queryFn: React Query puede re-ejecutar un queryFn
 * (retry, remount, refetch) y los POST repetidos producían carreras.
 */
let crmDefaultsPromise: Promise<unknown> | null = null;

export function bootstrapCrmDefaults(): Promise<unknown> {
  crmDefaultsPromise ??= Promise.allSettled([
    ensureDefaultOpportunityStages(),
    ensureFollowUpCategories(),
    ensureDefaultLeadSource(),
  ]);
  return crmDefaultsPromise;
}

export function useCrmStages(enabled = true) {
  const canManage = useCanManageCustomers();
  return useQuery({
    queryKey: CRM_KEYS.stages.root(),
    queryFn: async () => {
      await bootstrapCrmDefaults();
      return fetchOpportunityStages();
    },
    enabled: enabled && canManage,
    staleTime: 60_000,
  });
}

export function useCrmLeadsList(
  filters: {
    status?: string;
    source?: string;
    search?: string;
    page_size?: number;
  } = {},
  enabled = true,
) {
  const canManage = useCanManageCustomers();
  return useQuery({
    queryKey: CRM_KEYS.leads.list(filters),
    queryFn: () => fetchLeads(filters),
    enabled: enabled && canManage,
    placeholderData: keepPreviousData,
  });
}

export function useCrmLeadSources(includeInactive = false, enabled = true) {
  const canManage = useCanManageCustomers();
  return useQuery({
    queryKey: [...CRM_KEYS.leadSources.root(), { includeInactive }],
    queryFn: async () => {
      await bootstrapCrmDefaults();
      return fetchLeadSources({ includeInactive });
    },
    enabled: enabled && canManage,
    staleTime: 60_000,
  });
}

export function useCrmOpportunitiesList(
  filters: {
    client?: string | number;
    lead?: string;
    is_active?: boolean;
    page_size?: number;
  } = {},
  enabled = true,
) {
  const canManage = useCanManageCustomers();
  return useQuery({
    queryKey: CRM_KEYS.opportunities.list(filters),
    queryFn: () => fetchOpportunities(filters),
    enabled: enabled && canManage,
    placeholderData: keepPreviousData,
  });
}

export function useCrmActivitiesList(
  filters: {
    is_completed?: boolean;
    activity_type?: string;
    category?: string;
    page_size?: number;
  } = {},
  enabled = true,
) {
  const canManage = useCanManageCustomers();
  return useQuery({
    queryKey: CRM_KEYS.activities.list(filters),
    queryFn: () => fetchFollowUpActivities(filters),
    enabled: enabled && canManage,
    placeholderData: keepPreviousData,
  });
}

export function useCrmFollowUpCategories(enabled = true) {
  const canManage = useCanManageCustomers();
  return useQuery({
    queryKey: CRM_KEYS.followUpCategories.root(),
    queryFn: async () => {
      await bootstrapCrmDefaults();
      return fetchFollowUpCategories();
    },
    enabled: enabled && canManage,
    staleTime: 60_000,
  });
}

export function useCrmOpportunityClientMap(enabled = true) {
  const canManage = useCanManageCustomers();
  return useQuery({
    queryKey: CRM_KEYS.opportunities.clientMap(),
    queryFn: fetchOpportunityClientMap,
    enabled: enabled && canManage,
    staleTime: 30_000,
  });
}

/**
 * Contadores del CrmNav / hub de clientes. Una sola clave por consulta:
 * nav, hub e informes comparten caché y se refrescan con invalidate ["crm"].
 */
export function useCrmNavCounts(enabled = true) {
  const canManage = useCanManageCustomers();
  const enabledAll = enabled && canManage;

  const leads = useQuery({
    queryKey: CRM_KEYS.leads.counter(),
    queryFn: () => fetchLeads({ page_size: 50 }),
    enabled: enabledAll,
    staleTime: 45_000,
  });

  const opportunities = useQuery({
    queryKey: CRM_KEYS.opportunities.counter(),
    queryFn: () => fetchOpportunities({ is_active: true, page_size: 100 }),
    enabled: enabledAll,
    staleTime: 45_000,
  });

  const activities = useQuery({
    queryKey: CRM_KEYS.activities.counter(),
    queryFn: () => fetchFollowUpActivities({ is_completed: false, page_size: 50 }),
    enabled: enabledAll,
    staleTime: 45_000,
  });

  const prospectsCount = (leads.data?.results ?? []).filter(
    (l) => !["CONVERTED", "LOST", "ARCHIVED"].includes(l.status ?? ""),
  ).length;

  return {
    prospectsCount,
    pipelineCount: opportunities.data?.length ?? 0,
    followUpsCount: activities.data?.length ?? 0,
    isLoading: leads.isLoading || opportunities.isLoading || activities.isLoading,
  };
}
