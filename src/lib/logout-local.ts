import type { QueryClient } from "@tanstack/react-query";
import { clearStoredSession } from "@/lib/api/session-storage";
import { resetCsrfToken } from "@/lib/api/csrf";
import { useSessionStore } from "@/lib/store/session";
import { clearQueryPersist } from "@/lib/query-persist";

/**
 * Limpieza local al cerrar sesión: token, store, React Query e IndexedDB persistido.
 */
export async function logoutLocal(queryClient: QueryClient): Promise<void> {
  const { user, currentBranchId, clearSession } = useSessionStore.getState();
  const userId = user?.id;
  const branchId = currentBranchId;
  clearStoredSession();
  resetCsrfToken();
  clearSession();
  queryClient.clear();
  try {
    await clearQueryPersist(userId, branchId);
  } catch {
    /* idb opcional */
  }
}
