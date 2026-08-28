import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeApplier } from "@/components/theme-applier";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FRIG — Punto de venta gastronómico",
  description: "POS, comandas y cocina para restaurantes.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#14160f" },
  ],
};

/*
 * Anti-FOUC: aplica el tema multi-tenant persistido (store Zustand
 * `frig.session`) antes del primer paint. Replica la lógica de
 * applyThemeConfig (src/lib/api/branches.ts): mismas CSS vars, mismo
 * cálculo de foreground por luminancia y misma clase .dark. Es
 * idempotente y silencioso si no hay datos; ThemeApplier re-aplica el
 * tema definitivo tras hidratar.
 */
const themeInitScript = `(function(){try{
var raw=localStorage.getItem("frig.session");if(!raw)return;
var theme=JSON.parse(raw);theme=theme&&theme.state&&theme.state.theme;if(!theme)return;
var root=document.documentElement;
function fg(hex){var m=/^#?([0-9a-f]{6})$/i.exec(String(hex||"").trim());if(!m)return "#ffffff";
var n=parseInt(m[1],16);var l=0.299*((n>>16)&255)+0.587*((n>>8)&255)+0.114*(n&255);
return l>150?"#1a1d18":"#ffffff";}
var primary=theme.primary_color||"#2f6b3c";
var secondary=theme.secondary_color||"#f2e8cf";
root.style.setProperty("--brand-primary",primary);
root.style.setProperty("--brand-secondary",secondary);
root.style.setProperty("--primary-foreground",fg(primary));
root.style.setProperty("--secondary-foreground",fg(secondary));
root.style.setProperty("--color-primary-foreground",fg(primary));
root.style.setProperty("--color-secondary-foreground",fg(secondary));
if(typeof theme.borderRadius==="number"&&theme.borderRadius>0){root.style.setProperty("--brand-radius",theme.borderRadius+"px");}
if(theme.algorithm==="dark"){root.classList.add("dark");}
else if(theme.algorithm==="light"){root.classList.remove("dark");}
}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <ThemeApplier />
          {children}
        </Providers>
      </body>
    </html>
  );
}