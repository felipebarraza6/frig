"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  expanded: boolean;
  hovering: boolean;
  toggle: () => void;
  setExpanded: (v: boolean) => void;
  setHovering: (v: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      expanded: true,
      hovering: false,
      toggle: () => set((s) => ({ expanded: !s.expanded })),
      setExpanded: (v) => set({ expanded: v }),
      setHovering: (v) => set({ hovering: v }),
    }),
    {
      name: "frig.sidebar",
      partialize: (state) => ({ expanded: state.expanded }),
    },
  ),
);
