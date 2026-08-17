"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
          return { favorites: [href, ...state.favorites].slice(0, 8) };
        }),
      isFavorite: (href) => get().favorites.includes(href),
    }),
    {
      name: "frig.nav-favorites",
    },
  ),
);
