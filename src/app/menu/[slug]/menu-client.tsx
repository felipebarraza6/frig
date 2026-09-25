"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, ChefHat, Store, Monitor, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  fetchPublicMenuBySlug,
  extractWhatsappFromDescription,
  stripWhatsappMarker,
  type PublicMenuProduct,
} from "@/lib/api/public-catalog";
import { enrichProductsWithIngredientLines } from "@/lib/api/public-menu-ingredients";
import { fetchBranchTheme } from "@/lib/api/branches";
import { getToken } from "@/lib/api/session-storage";
import { useSessionStore } from "@/lib/store/session";
import { BrandLogo } from "@/components/brand-logo";
import {
  PublicMenuCartBar,
  type PublicCartLine,
} from "@/components/menu/public-menu-cart";
import { formatCLP, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicMenuSlug } from "@/lib/hooks/usePublicMenuSlug";
import { HeroPlexus } from "@/components/landing/hero-plexus";

function groupByCategory(products: PublicMenuProduct[]) {
  const map = new Map<
    string,
    { category?: { id: number; name: string } | null; products: PublicMenuProduct[] }
  >();
  const others: PublicMenuProduct[] = [];

  for (const p of products) {
    if (p.category) {
      const key = String(p.category.id);
      if (!map.has(key)) {
        map.set(key, { category: p.category, products: [] });
      }
      map.get(key)!.products.push(p);
    } else {
      others.push(p);
    }
  }

  const result = Array.from(map.values());
  if (others.length > 0) {
    result.push({ category: null, products: others });
  }
  return result;
}

/** Fondo minimal glass-light: manchas de marca + plexus suave (estilo landing). */
function MenuAtmosphere({
  theme,
  secondary,
}: {
  theme: string;
  secondary: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ backgroundColor: secondary }} />
      <div
        className="absolute -left-[20%] top-[-10%] h-[55%] w-[70%] rounded-full opacity-50 blur-3xl"
        style={{
          background: `radial-gradient(circle at center, ${theme}66 0%, transparent 68%)`,
        }}
      />
      <div
        className="absolute -right-[15%] bottom-[-5%] h-[50%] w-[60%] rounded-full opacity-40 blur-3xl"
        style={{
          background: `radial-gradient(circle at center, ${theme}55 0%, transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.28]"
        style={{
          maskImage:
            "radial-gradient(85% 75% at 50% 40%, black 20%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(85% 75% at 50% 40%, black 20%, transparent 100%)",
        }}
      >
        <HeroPlexus className="h-full w-full" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-white/35" />
    </div>
  );
}

export default function PublicMenuPage({ slug: slugProp }: { slug?: string } = {}) {
  const slug = usePublicMenuSlug(slugProp);

  const sessionTheme = useSessionStore((s) => s.theme);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-menu", slug],
    queryFn: () => fetchPublicMenuBySlug(slug),
    enabled: Boolean(slug),
  });

  const productIds = useMemo(
    () => (data?.products ?? []).map((p) => p.id),
    [data?.products],
  );

  const { data: enrichedProducts } = useQuery({
    queryKey: ["public-menu-ingredients", slug, productIds],
    queryFn: () => enrichProductsWithIngredientLines(data?.products ?? []),
    enabled: Boolean(slug) && productIds.length > 0,
    staleTime: 60_000,
  });

  const catalog = data?.catalog;

  // Logo: catálogo → tema sucursal (API) → tema de sesión.
  const { data: branchTheme } = useQuery({
    queryKey: ["branch-theme", catalog?.branch],
    queryFn: () => fetchBranchTheme(String(catalog!.branch)),
    enabled: Boolean(catalog?.branch) && Boolean(getToken()),
    staleTime: 5 * 60_000,
  });

  const logoSrc =
    catalog?.logo ||
    branchTheme?.logo ||
    sessionTheme?.logo ||
    null;

  const showPrices = catalog?.show_prices ?? true;
  const showDescriptions = catalog?.show_descriptions ?? true;
  const showCategories = catalog?.show_categories ?? true;
  const themeColor = catalog?.theme_color ?? "#2f6b3c";
  const secondaryColor = catalog?.secondary_color ?? "#f2e8cf";
  const fontFamily = catalog?.font_family ?? "system";

  const products = enrichedProducts ?? data?.products ?? [];
  const grouped = useMemo(() => groupByCategory(products), [products]);
  const [activeCategory, setActiveCategory] = useState<string>("__all__");
  const [cart, setCart] = useState<PublicCartLine[]>([]);

  const mode = catalog?.mode ?? "VITRINA";
  const canOrder = mode === "ORDENAR" || mode === "PAGAR";
  const whatsappPhone = extractWhatsappFromDescription(catalog?.description);
  const publicDescription = stripWhatsappMarker(catalog?.description);

  const filtered = useMemo(() => {
    if (!showCategories || activeCategory === "__all__") return grouped;
    return grouped.filter((g) => (g.category?.name ?? "Otros") === activeCategory);
  }, [grouped, activeCategory, showCategories]);

  function addToCart(product: PublicMenuProduct) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: number, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.product.id !== productId);
      return prev.map((l) =>
        l.product.id === productId ? { ...l, quantity } : l,
      );
    });
  }

  const fontClass =
    fontFamily === "serif"
      ? "font-serif"
      : fontFamily === "sans" || fontFamily === "rounded"
        ? "font-sans"
        : "font-sans";

  if (!slug) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium">Falta el menú a mostrar.</p>
        <p className="text-xs text-muted-foreground">Abre el link con el slug del catálogo.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="relative flex min-h-screen items-center justify-center"
        style={{ backgroundColor: secondaryColor }}
      >
        <MenuAtmosphere theme={themeColor} secondary={secondaryColor} />
        <Skeleton className="relative z-10 h-8 w-8 rounded-full" style={{ backgroundColor: themeColor }} />
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div
        className="relative flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ backgroundColor: secondaryColor }}
      >
        <MenuAtmosphere theme={themeColor} secondary={secondaryColor} />
        <div className="glass-read relative z-10 rounded-2xl px-8 py-10">
          <Store className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-3 text-xl font-semibold">Menú no disponible</h1>
          <p className="mt-1 text-muted-foreground">
            {error instanceof Error ? error.message : "No se encontró el catálogo solicitado."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("light relative min-h-dvh", fontClass)}>
      <MenuAtmosphere theme={themeColor} secondary={secondaryColor} />

      <div className="relative z-10 flex min-h-dvh flex-col">
        {/* Header glass */}
        <header className="sticky top-0 z-20 border-b border-white/40">
          <div
            className="glass-strong px-4 py-5 sm:px-6"
            style={{
              background: `color-mix(in srgb, ${themeColor} 78%, transparent)`,
              borderColor: `color-mix(in srgb, #fff 35%, ${themeColor})`,
            }}
          >
            <div className="mx-auto flex max-w-3xl items-center gap-3 sm:gap-4">
              <BrandLogo
                src={logoSrc}
                name={catalog.branch_name || catalog.title}
                alt={`Logo ${catalog.branch_name || catalog.title}`}
                fallbackColor={themeColor}
                containerClassName="h-16 w-16 shrink-0 rounded-2xl bg-white shadow-md ring-2 ring-white/70 sm:h-20 sm:w-20"
                className="h-full w-full object-contain p-2"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {catalog.title}
                  </h1>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {catalog.mode_display || mode}
                  </span>
                </div>
                {publicDescription && showDescriptions && (
                  <p className="mt-1 line-clamp-2 text-sm text-white/90">
                    {publicDescription}
                  </p>
                )}
                {catalog.branch_name && (
                  <p className="mt-1.5 text-xs text-white/75">{catalog.branch_name}</p>
                )}
                {mode === "VITRINA" && (
                  <p className="mt-1 text-[11px] text-white/70">Solo vitrina · sin pedidos en esta carta</p>
                )}
                {mode === "ORDENAR" && (
                  <p className="mt-1 text-[11px] text-white/70">Arma tu pedido y envíalo por WhatsApp</p>
                )}
                {mode === "PAGAR" && (
                  <p className="mt-1 text-[11px] text-white/70">Arma tu pedido y paga online o por WhatsApp</p>
                )}
              </div>
            </div>
          </div>
        </header>

        {catalog.station_type === "POS" && catalog.station && (
          <div className="px-4 py-4 sm:px-6">
            <div className="glass-read mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl px-4 py-3 sm:px-6">
              <div>
                <p className="text-sm font-medium" style={{ color: themeColor }}>
                  Punto de venta vinculado
                </p>
                <p className="text-xs text-muted-foreground">
                  Abre el terminal asignado a esta estación para registrar ventas.
                </p>
              </div>
              <Link
                href={`/pos/terminal?station_id=${catalog.station}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: themeColor }}
              >
                <Monitor className="h-4 w-4" />
                Abrir terminal
              </Link>
            </div>
          </div>
        )}

        {showCategories && grouped.length > 0 && (
          <nav className="sticky top-[4.5rem] z-20 px-4 py-3 sm:px-6">
            <div className="glass-strong mx-auto flex max-w-3xl gap-2 overflow-x-auto rounded-2xl px-3 py-2.5 pb-2">
              <button
                type="button"
                onClick={() => setActiveCategory("__all__")}
                className={cn(
                  "glass-chip shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  activeCategory === "__all__" && "text-white",
                )}
                style={
                  activeCategory === "__all__"
                    ? { backgroundColor: themeColor, borderColor: themeColor, color: "#fff" }
                    : undefined
                }
              >
                Todos ({products.length})
              </button>
              {grouped.map((g) => {
                const name = g.category?.name ?? "Otros";
                const active = activeCategory === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setActiveCategory(name)}
                    className={cn(
                      "glass-chip shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      active && "text-white",
                    )}
                    style={
                      active
                        ? { backgroundColor: themeColor, borderColor: themeColor, color: "#fff" }
                        : undefined
                    }
                  >
                    {name} ({g.products.length})
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
          {products.length === 0 ? (
            <div className="glass-read rounded-2xl p-8 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium text-foreground">Este menú no tiene productos aún</p>
              <p className="mt-1 text-sm text-muted-foreground">
                En FRIG → Menús y vitrinas → Editar, asigna productos o la categoría y guarda.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-read rounded-2xl p-8 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">No hay productos en esta categoría.</p>
              <button
                type="button"
                className="mt-3 text-sm font-medium underline"
                style={{ color: themeColor }}
                onClick={() => setActiveCategory("__all__")}
              >
                Ver todos
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {filtered.map((group) => (
                <section key={group.category?.id ?? "otros"} className="space-y-4">
                  {showCategories && (
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold tracking-tight text-foreground">
                        {group.category?.name ?? "Otros"}
                      </h2>
                      <span className="h-px flex-1 bg-border/70" />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {group.products.length}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {group.products.map((product) => {
                      const names =
                        product.ingredient_names && product.ingredient_names.length > 0
                          ? product.ingredient_names
                          : product.ingredient_line
                            ? product.ingredient_line.split(/\s*[·,|]\s*/).filter(Boolean)
                            : [];
                      return (
                        <article
                          key={product.id}
                          className="glass-read flex flex-col overflow-hidden rounded-2xl shadow-sm transition-shadow hover:shadow-md"
                        >
                          {/* Cabecera: foto + nombre */}
                          <div className="flex gap-3 border-b border-border/40 p-4">
                            {product.primary_image ? (
                              <Image
                                src={product.primary_image}
                                alt={product.name}
                                width={72}
                                height={72}
                                className="h-[72px] w-[72px] shrink-0 rounded-xl object-cover ring-1 ring-black/5"
                              />
                            ) : (
                              <div
                                className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl"
                                style={{
                                  background: `color-mix(in srgb, ${themeColor} 12%, white)`,
                                }}
                              >
                                <ChefHat
                                  className="h-7 w-7"
                                  style={{ color: themeColor, opacity: 0.7 }}
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 self-center">
                              <h3 className="text-base font-semibold leading-snug text-foreground">
                                {product.name}
                              </h3>
                              {showDescriptions && product.description && (
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Ingredientes en chips */}
                          {names.length > 0 && (
                            <div className="border-b border-border/40 px-4 py-3">
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Ingredientes
                              </p>
                              <ul className="flex flex-wrap gap-1.5">
                                {names.map((name) => (
                                  <li
                                    key={name}
                                    className="rounded-full border border-border/60 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-foreground/80"
                                  >
                                    {name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Pie: precio + acción */}
                          <div className="mt-auto flex items-center justify-between gap-3 px-4 py-3">
                            <div>
                              {showPrices && (
                                <p
                                  className="text-xl font-bold tabular-nums tracking-tight"
                                  style={{ color: themeColor }}
                                >
                                  {formatCLP(product.sale_price ?? product.price ?? "0")}
                                </p>
                              )}
                              {product.is_nutritional_ingredient && product.energy_kcal ? (
                                <p className="text-[10px] text-muted-foreground">
                                  {product.energy_kcal} kcal
                                </p>
                              ) : null}
                            </div>
                            {canOrder && (
                              <button
                                type="button"
                                onClick={() => addToCart(product)}
                                className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-white shadow-sm"
                                style={{ backgroundColor: themeColor }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Agregar
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          <footer
            className={cn(
              "mt-12 text-center text-xs text-muted-foreground/80",
              canOrder ? "pb-24" : "pb-6",
            )}
          >
            Menú digital · FRIG · {catalog.mode_display}
          </footer>
        </main>
      </div>

      <PublicMenuCartBar
        mode={mode}
        themeColor={themeColor}
        slug={slug}
        catalogTitle={catalog.title}
        whatsappPhone={whatsappPhone}
        cart={cart}
        onChangeQty={changeQty}
        onClear={() => setCart([])}
      />
    </div>
  );
}
