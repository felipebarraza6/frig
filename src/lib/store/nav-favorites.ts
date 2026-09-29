"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Máximo de atajos: coincide con los slots del dock inferior móvil. */
export const MAX_NAV_FAVORITES = 4;

interface NavFavoritesState {
  favorites: string[];
  toggleFavorite: (href: string) => void;
  isFavorite: (href: string) => boolean;
}

export const useNavFavorites = create<NavFavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (href) =>
        set((state) => {
          const exists = state.favorites.includes(href);
          if (exists) {
            return { favorites: state.favorites.filter((h) => h !== href) };
          }
          return { favorites: [href, ...state.favorites].slice(0, MAX_NAV_FAVORITES) };
        }),
      isFavorite: (href) => get().favorites.includes(href),
    }),
    {
      name: "frig.nav-favorites",
      // Cap legado: antes el máximo era 8; el dock solo muestra 4.
      merge: (persisted, current) => {
        const p = persisted as Partial<NavFavoritesState> | undefined;
        const favorites = Array.isArray(p?.favorites)
          ? p.favorites.filter((h): h is string => typeof h === "string").slice(0, MAX_NAV_FAVORITES)
          : current.favorites;
        return { ...current, ...p, favorites };
      },
    },
  ),
);

