"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MAX_NAV_FAVORITES = 8;

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
    },
  ),
);

