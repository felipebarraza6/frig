"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Demo pública del salón 3D: fuerza tema oscuro para que glass/chips
 * coincidan con la escena (ThemeApplier en localhost quita `.dark`).
 */
export default function SalonDemoLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.add("dark");
    root.dataset.salonDemo = "1";
    return () => {
      delete root.dataset.salonDemo;
      if (!hadDark) root.classList.remove("dark");
    };
  }, []);

  return (
    <div
      className="min-h-dvh bg-[#07080c] text-zinc-100"
      style={
        {
          "--background": "#07080c",
          "--foreground": "#f4f4f5",
          "--card": "#12141a",
          "--muted": "#151820",
          "--muted-foreground": "#a1a1aa",
          "--border": "#27272a",
          "--input": "#27272a",
          "--glass-border": "color-mix(in srgb, #ffffff 14%, transparent)",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
