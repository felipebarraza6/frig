"use client";

import { useQuery } from "@tanstack/react-query";
import { UtensilsCrossed } from "lucide-react";
import { fetchPublicMenuBySlug, type PublicMenuProduct } from "@/lib/api/public-catalog";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { SectionTitle } from "@/components/landing/section-title";

/** Slug del menú demo que alimenta la galería viva de la landing. */
export const LANDING_DEMO_MENU_SLUG = "menu-macanuo";

function formatCLP(value?: string | number | null): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === undefined || n === null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

function GalleryCard({ product, index }: { product: PublicMenuProduct; index: number }) {
  return (
    <ScrollReveal delay={(index % 4) * 0.06} className="h-full">
      <article className="pixel-frame flex h-full flex-col gap-2 p-4 transition-transform hover:-translate-y-1">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10 text-primary">
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <h3 className="min-w-0 truncate font-pixel text-[13px] font-semibold tracking-wider">
            {product.name}
          </h3>
        </div>
        {product.description && (
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
            {product.description}
          </p>
        )}
        {product.category && (
          <p className="text-[11px] text-muted-foreground/70">{product.category.name}</p>
        )}
        <p className="mt-auto pt-1 font-pixel text-sm font-bold tabular-nums text-primary">
          {formatCLP(product.sale_price ?? product.price)}
        </p>
      </article>
    </ScrollReveal>
  );
}

/**
 * Galería viva: productos reales del menú público de una sucursal demo
 * (endpoint público, sin auth). Si el backend no responde o el menú está
 * vacío, la sección simplemente no se renderiza — la landing nunca se rompe.
 */
export function LiveMenuGallery() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["landing-demo-menu", LANDING_DEMO_MENU_SLUG],
    queryFn: () => fetchPublicMenuBySlug(LANDING_DEMO_MENU_SLUG),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (isError || (!isLoading && (data?.products?.length ?? 0) === 0)) return null;

  return (
    <section id="galeria" className="pixel-dither-light scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <ScrollReveal>
          <SectionTitle
            kicker="Galería en vivo"
            title="Así se ve la carta de un local real con FRIG"
            sub="Productos y precios conectados en este momento al menú público de una sucursal demo. Lo que tus clientes verán de tu negocio."
          />
        </ScrollReveal>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="pixel-frame h-36 animate-pulse bg-muted/40" />
              ))
            : data!.products.slice(0, 10).map((p, i) => <GalleryCard key={p.id} product={p} index={i} />)}
        </div>
        <p className="mt-6 text-center font-pixel text-[10px] tracking-[0.2em] text-muted-foreground/60">
          MENÚ PÚBLICO DEMO · DATOS EN VIVO DESDE LA API
        </p>
      </div>
    </section>
  );
}
