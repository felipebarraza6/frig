"use client";

import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, ExternalLink, Store } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchPublicMenuBySlug,
  publicMenuUrl,
  publicMenuAbsoluteUrl,
} from "@/lib/api/public-catalog";
import { fetchBranchTheme } from "@/lib/api/branches";
import { getToken } from "@/lib/api/session-storage";
import { useSessionStore } from "@/lib/store/session";
import { BrandLogo } from "@/components/brand-logo";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicMenuSlug } from "@/lib/hooks/usePublicMenuSlug";

export default function MenuTotemPage({ slug: slugProp }: { slug?: string } = {}) {
  const slug = usePublicMenuSlug(slugProp);
  const sessionTheme = useSessionStore((s) => s.theme);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-menu-totem", slug],
    queryFn: () => fetchPublicMenuBySlug(slug),
    enabled: Boolean(slug),
  });

  const catalog = data?.catalog;

  const { data: branchTheme } = useQuery({
    queryKey: ["branch-theme", catalog?.branch],
    queryFn: () => fetchBranchTheme(String(catalog!.branch)),
    enabled: Boolean(catalog?.branch) && Boolean(getToken()) && !catalog?.logo,
    staleTime: 5 * 60_000,
  });

  const logoSrc =
    catalog?.logo || branchTheme?.logo || sessionTheme?.logo || null;

  const themeColor = catalog?.theme_color ?? "#1890ff";
  const secondaryColor = catalog?.secondary_color ?? "#f8f9fa";
  const fontFamily = catalog?.font_family ?? "system";

  const menuUrl = useMemo(
    () => (slug ? publicMenuAbsoluteUrl(slug) : ""),
    [slug],
  );

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  const fontClass =
    fontFamily === "serif"
      ? "font-serif"
      : fontFamily === "sans"
        ? "font-sans"
        : fontFamily === "rounded"
          ? "font-sans"
          : "font-sans";

  if (!slug) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium">Falta el menú a mostrar.</p>
        <p className="text-xs text-muted-foreground">Abre el tótem con el slug del catálogo.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center" style={{ backgroundColor: secondaryColor }}>
        <Skeleton className="h-8 w-8 rounded-full" style={{ backgroundColor: themeColor }} />
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Store className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Menú no disponible</h1>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "No se encontró el catálogo solicitado."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-dvh flex-col items-center justify-center p-8 text-center print:p-0 ${fontClass}`}
      style={{ backgroundColor: secondaryColor }}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-border bg-white p-8 shadow-xl print:border-none print:shadow-none print:p-0"
        style={{ borderColor: `${themeColor}30` }}
      >
        <div className="flex flex-col items-center gap-3">
          <BrandLogo
            src={logoSrc}
            name={catalog.branch_name || catalog.title}
            alt={catalog.branch_name || catalog.title}
            fallbackColor={themeColor}
            containerClassName="h-20 w-20 rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
            className="h-full w-full object-contain p-2"
          />
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: themeColor }}>
            {catalog.title}
          </h1>
        </div>
        {catalog.description && (
          <p className="mt-2 text-sm text-muted-foreground">{catalog.description}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Escanea para ver el menú</p>

        <div className="mt-8 flex justify-center">
          <div className="rounded-2xl border border-border bg-white p-4" style={{ borderColor: `${themeColor}30` }}>
            <QRCodeSVG value={menuUrl} size={360} level="H" includeMargin />
          </div>
        </div>

        <p className="mt-6 break-all text-sm text-muted-foreground">{menuUrl}</p>

        <div className="mt-8 flex justify-center gap-3 print:hidden">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <a
            href={publicMenuUrl(slug)}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "default" }))}
            style={{ backgroundColor: themeColor }}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Ver menú
          </a>
        </div>
      </div>
    </div>
  );
}
