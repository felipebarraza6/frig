"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Branch, BranchThemeConfig, User } from "@/lib/types";
import { setBranchId, clearBranchId } from "@/lib/api/session-storage";

interface SessionState {
  user: User | null;
  branches: Branch[];
  currentBranchId: ID_STR | null;
  theme: BranchThemeConfig | null;
  hasHydrated: boolean;
  setSession: (user: User, branches: Branch[]) => void;
  setUser: (user: User) => void;
  setCurrentBranch: (branchId: ID_STR) => void;
  setTheme: (theme: BranchThemeConfig | null) => void;
  clearSession: () => void;
  setHasHydrated: (v: boolean) => void;
}

type ID_STR = string;

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      branches: [],
      currentBranchId: null,
      theme: null,
      hasHydrated: false,
      setSession: (user, branches) =>
        set({ user, branches, currentBranchId: null }),
      setUser: (user) => set({ user }),
      setCurrentBranch: (branchId) => {
        setBranchId(branchId);
        set({ currentBranchId: branchId });
      },
      setTheme: (theme) => set({ theme }),
      clearSession: () => {
        clearBranchId();
        set({
          user: null,
          branches: [],
          currentBranchId: null,
          theme: null,
        });
      },
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "frig.session",
      partialize: (s) => ({
        user: s.user,
        branches: s.branches,
        currentBranchId: s.currentBranchId,
        theme: s.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
    },
  ),
);

/** Sucursal activa como objeto Branch, o null si no hay sesión/branch. */
export function useCurrentBranch(): Branch | null {
  const branches = useSessionStore((s) => s.branches);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  if (!currentBranchId) return null;
  return branches.find((b) => String(b.branch_id) === currentBranchId) ?? null;
}