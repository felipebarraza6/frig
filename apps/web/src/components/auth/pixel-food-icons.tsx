"use client";

/**
 * Íconos pixel-art de comida compartidos entre el login y los fondos animados.
 * SVG 16x16 con crispEdges para el look retro.
 */

export type FoodKind = "tazon" | "helado" | "cafe" | "tallarines" | "bebida";

export const FOOD_ICONS: readonly { label: string; kind: FoodKind }[] = [
  { label: "Tazón", kind: "tazon" },
  { label: "Helado", kind: "helado" },
  { label: "Café", kind: "cafe" },
  { label: "Tallarines", kind: "tallarines" },
  { label: "Bebida", kind: "bebida" },
] as const;

export function FoodIcon({ kind, size = 28 }: { kind: FoodKind; size?: number }) {
  const s = { width: size, height: size, imageRendering: "pixelated" } as const;
  switch (kind) {
    case "tazon":
      return (
        <svg viewBox="0 0 16 16" style={s} shapeRendering="crispEdges">
          <path d="M6 1h1v2H6zm4 0h1v2H6zm-3 0h1v1H7z" fill="#a9c9b8" />
          <path d="M2 5h12v2H2z" fill="#1a1d18" />
          <path d="M3 7h10v4H3z" fill="#f7f6f1" stroke="#1a1d18" strokeWidth={0} />
          <path d="M3 7h10v4H3z" fill="#ffffff" />
          <path d="M4 7h8v2H4z" fill="#d8783d" />
          <path d="M5 7h2v2H5zM8 7h2v2H8z" fill="#8a4f2b" opacity=".5" />
          <path d="M2 5h12v2H2z" fill="#1a1d18" />
          <path d="M5 11h6v2H5zM6 13h4v1H6z" fill="#1a1d18" />
        </svg>
      );
    case "helado":
      return (
        <svg viewBox="0 0 16 16" style={s} shapeRendering="crispEdges">
          <path d="M5 2h6v1H5zM4 3h8v1H4zM4 4h8v3H4z" fill="#f1d195" />
          <path d="M5 3h2v1H5z" fill="white" opacity=".6" />
          <path d="M6 7h4v1H6zM5 8h6v1H5zM5 9h6v1H5zM6 10h4v1H6zM6 11h4v1H6zM7 12h2v1H7zM7 13h2v1H7z" fill="#d8a45c" />
          <path d="M6 7h1v6H6z" fill="#b8893a" opacity=".5" />
          <path d="M10 4h1v2h-1z" fill="#e9a84a" opacity=".4" />
        </svg>
      );
    case "cafe":
      return (
        <svg viewBox="0 0 16 16" style={s} shapeRendering="crispEdges">
          <path d="M7 0h1v2H7zm3 1h1v2h-1z" fill="#a9c9b8" opacity=".9" />
          <path d="M3 5h8v1H3z" fill="#1a1d18" />
          <path d="M3 6h8v6H3z" fill="white" />
          <path d="M3 6h8v1H3z" fill="#f7f6f1" />
          <path d="M4 7h6v1H4z" fill="#8a4f2b" />
          <path d="M4 7h6v2H4z" fill="#6b3a1f" opacity=".15" />
          <path d="M11 6h2v6H11z" fill="white" />
          <path d="M12 7h1v4h-1z" fill="#1a1d18" opacity=".08" />
          <path d="M3 12h8v1H3z" fill="#1a1d18" />
          <path d="M4 4h1v1H4z" fill="#a9c9b8" opacity=".5" />
        </svg>
      );
    case "tallarines":
      return (
        <svg viewBox="0 0 16 16" style={s} shapeRendering="crispEdges">
          <path d="M7 0h1v2H7z" fill="#a9c9b8" />
          <path d="M2 5h12v2H2z" fill="#1a1d18" />
          <path d="M3 7h10v4H3z" fill="white" />
          <path d="M4 7h8v1H4z" fill="#e8c17a" />
          <path d="M4 8h8v1H4z" fill="#d8a45c" />
          <path d="M4 9h8v1H4z" fill="#e8c17a" />
          <path d="M5 7h1v3H5zM7 7h1v3H7zM9 7h1v3H9z" fill="#b8893a" opacity=".5" />
          <path d="M6 7h1v1H6zM9 9h1v1H9z" fill="#c95f4b" />
          <path d="M5 11h6v2H5zM6 13h4v1H6z" fill="#1a1d18" />
          <path d="M8 8h2v1H8z" fill="#8dc4a3" />
        </svg>
      );
    case "bebida":
      return (
        <svg viewBox="0 0 16 16" style={s} shapeRendering="crispEdges">
          <path d="M5 2h6v1H5z" fill="#1a1d18" />
          <path d="M4 3h8v1H4z" fill="white" />
          <path d="M4 4h8v8H4z" fill="#8dc4a3" />
          <path d="M4 4h8v2H4z" fill="#bfe7d0" />
          <path d="M5 6h1v4H5z" fill="white" opacity=".55" />
          <path d="M10 1h2v3h-2z" fill="#d8783d" />
          <path d="M11 1h1v4H11z" fill="#1a1d18" opacity=".12" />
          <path d="M4 12h8v1H4z" fill="#1a1d18" />
          <path d="M5 4h6v1H5z" fill="#2f6b3c" opacity=".2" />
        </svg>
      );
  }
}
