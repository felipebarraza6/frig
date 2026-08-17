"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingBag, ChefHat, CreditCard, Store, Monitor } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { fetchPublicMenuBySlug, type PublicMenuProduct } from "@/lib/api/public-catalog";
import { formatCLP } from "@/lib/utils";

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

export default function PublicMenuPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-menu", slug],
    queryFn: () => fetchPublicMenuBySlug(slug),
    enabled: Boolean(slug),
  });

  const catalog = data?.catalog;
  const showPrices = catalog?.show_prices ?? true;
  const showDescriptions = catalog?.show_descriptions ?? true;
  const showCategories = catalog?.show_categories ?? true;
  const mode = catalog?.mode ?? "VITRINA";
  const themeColor = catalog?.theme_color ?? "#1890ff";
  const secondaryColor = catalog?.secondary_color ?? "#f8f9fa";
  const fontFamily = catalog?.font_family ?? "system";

  const grouped = useMemo(() => groupByCategory(data?.products ?? []), [data?.products]);
  const firstCategory = grouped[0]?.category?.name ?? "Otros";
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!showCategories || !activeCategory) return grouped;
    return grouped.filter((g) => (g.category?.name ?? "Otros") === activeCategory);
  }, [grouped, activeCategory, showCategories]);

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: secondaryColor }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: themeColor }} />
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ backgroundColor: secondaryColor }}
      >
        <Store className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Menú no disponible</h1>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "No se encontró el catálogo solicitado."}
        </p>
      </div>
    );
  }

  const fontClass =
    fontFamily === "serif"
      ? "font-serif"
      : fontFamily === "sans"
        ? "font-sans"
        : fontFamily === "rounded"
          ? "font-sans"
          : "font-sans";

  return (
    <div className={`min-h-screen ${fontClass}`} style={{ backgroundColor: secondaryColor }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b px-4 py-6 shadow-sm sm:px-6"
        style={{ backgroundColor: themeColor }}
      >
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{catalog.title}</h1>
          {catalog.description && showDescriptions && (
            <p className="mt-1 text-sm text-white/90">{catalog.description}</p>
          )}
          {catalog.branch_name && <p className="mt-2 text-xs text-white/80">{catalog.branch_name}</p>}
        </div>
      </header>

      {/* Llamado a acción para estaciones POS */}
      {catalog.station_type === "POS" && catalog.station && (
        <div
          className="border-b px-4 py-4 sm:px-6"
          style={{ backgroundColor: secondaryColor }}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-xl border px-4 py-3 shadow-sm sm:px-6"
            style={{ borderColor: `${themeColor}40`, backgroundColor: "#fff" }}
          >
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

      {/* Categorías */}
      {showCategories && grouped.length > 1 && (
        <nav className="sticky top-[88px] z-10 border-b border-border bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto pb-1">
            {grouped.map((g) => {
              const name = g.category?.name ?? "Otros";
              const active = (activeCategory ?? firstCategory) === name;
              return (
                <button
                  key={name}
                  onClick={() => setActiveCategory(name)}
                  className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: active ? themeColor : "transparent",
                    color: active ? "#fff" : "#374151",
                    border: `1px solid ${active ? themeColor : "#e5e7eb"}`,
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Productos */}
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white p-8 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">
              No hay productos disponibles en este menú.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {filtered.map((group) => (
              <section key={group.category?.id ?? "otros"}>
                {showCategories && (
                  <h2 className="mb-3 text-lg font-semibold text-foreground">
                    {group.category?.name ?? "Otros"}
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {group.products.map((product) => (
                    <article
                      key={product.id}
                      className="group relative flex gap-4 overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{product.name}</h3>
                          {showDescriptions && product.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {product.description}
                            </p>
                          )}
                        </div>
                        {showPrices && (
                          <p
                            className="mt-3 text-lg font-bold tabular-nums"
                            style={{ color: themeColor }}
                          >
                            {formatCLP(product.sale_price ?? product.price ?? "0")}
                          </p>
                        )}
                        {product.is_nutritional_ingredient && (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {product.energy_kcal ? <span>{product.energy_kcal} kcal</span> : null}
                            {product.proteins_g ? <span>Proteínas {product.proteins_g} g</span> : null}
                            {product.total_fats_g ? <span>Grasas {product.total_fats_g} g</span> : null}
                            {product.carbohydrates_g ? <span>Carbs {product.carbohydrates_g} g</span> : null}
                            {product.sodium_mg ? <span>Sodio {product.sodium_mg} mg</span> : null}
                          </div>
                        )}
                      </div>
                      {product.primary_image ? (
                        <Image
                          src={product.primary_image}
                          alt={product.name}
                          width={96}
                          height={96}
                          className="h-24 w-24 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <ChefHat className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}

                      {(mode === "ORDENAR" || mode === "PAGAR") && (
                        <button
                          className="absolute right-3 top-3 rounded-full p-2 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          style={{ backgroundColor: themeColor }}
                          aria-label="Agregar"
                          title="Próximamente: agregar al pedido"
                        >
                          {mode === "PAGAR" ? (
                            <CreditCard className="h-4 w-4" />
                          ) : (
                            <ShoppingBag className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Menú digital generado con FRIG · {catalog.mode_display}
        </footer>
      </main>
    </div>
  );
}
