"use client";

import { useMemo, useState, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { LazyMotion, MotionConfig } from "framer-motion";
import { ApiError } from "@/lib/api/client";
import { AppProvider } from "@/lib/app-context";
import { useSessionStore } from "@/lib/store/session";
import {
  createQueryPersister,
  queryPersistStorageKey,
  QUERY_PERSIST_BUSTER,
  QUERY_PERSIST_MAX_AGE,
  shouldPersistQuery,
} from "@/lib/query-persist";

const loadFeatures = () =>
  import("framer-motion").then((res) => res.domAnimation);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: QUERY_PERSIST_MAX_AGE,
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          if (error instanceof ApiError) {
            if (error.status >= 400 && error.status < 500 && error.status !== 408) {
              return false;
            }
          }
          return true;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const userId = useSessionStore((s) => s.user?.id);
  const branchId = useSessionStore((s) => s.currentBranchId);
  // Clave por usuario+sucursal: tablets compartidas no mezclan caches.
  const storageKey = queryPersistStorageKey(userId, branchId);
  const persister = useMemo(() => createQueryPersister(storageKey), [storageKey]);

  return (
    <PersistQueryClientProvider
      // Remount al cambiar usuario/sucursal para hidratar el blob correcto.
      key={storageKey}
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: QUERY_PERSIST_MAX_AGE,
        buster: `${QUERY_PERSIST_BUSTER}:${storageKey}`,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" && shouldPersistQuery(query.queryKey),
        },
      }}
      onSuccess={() => {
        queryClient.resumePausedMutations().catch(() => {});
      }}
    >
      <LazyMotion features={loadFeatures} strict={false}>
        <MotionConfig reducedMotion="user">
          <AppProvider>{children}</AppProvider>
        </MotionConfig>
      </LazyMotion>
    </PersistQueryClientProvider>
  );
}
