import { Info, ShoppingCart, ChefHat, Wheat } from "lucide-react";

export const PRODUCT_TYPE_DESCRIPTIONS: Record<
  string,
  { title: string; icon: React.ComponentType<{ className?: string }>; description: string; examples: string }
> = {
  DIRECT_SALE: {
    title: "Venta directa",
    icon: ShoppingCart,
    description:
      "Producto que vendes tal cual al cliente. Tiene su propio precio de venta y stock. No necesita receta ni ingredientes.",
    examples: "Ej: una camiseta, un jugo embotellado, un servicio de reparación.",
  },
  RECIPE_BASED: {
    title: "Producto compuesto",
    icon: ChefHat,
    description:
      "Se arma a partir de una receta con materias primas. Ideal cuando un producto final depende de varios ingredientes y quieres calcular su costo o etiqueta nutricional.",
    examples: "Ej: un menú ejecutivo, un combo preparado, un producto ensamblado.",
  },
  RAW_MATERIAL: {
    title: "Materia prima",
    icon: Wheat,
    description:
      "Ingrediente base que usas dentro de recetas. Por defecto no se vende directamente al cliente, pero puedes tener stock y costo propio.",
    examples: "Ej: harina, aceite, tornillos, tela, papel.",
  },
};

interface ProductTypeHelpProps {
  productType?: string | null;
}

export function ProductTypeHelp({ productType }: ProductTypeHelpProps) {
  const config = productType ? PRODUCT_TYPE_DESCRIPTIONS[productType] : null;
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4 text-primary" />
        <span>{config.title}</span>
      </div>
      <p className="text-muted-foreground">{config.description}</p>
      <p className="mt-1 text-xs text-muted-foreground">{config.examples}</p>
    </div>
  );
}

export function ProductTypeLegend() {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <Info className="h-4 w-4 text-primary" />
        <span>Tipos de producto en FRIG</span>
      </div>
      <div className="flex flex-col gap-2">
        {Object.entries(PRODUCT_TYPE_DESCRIPTIONS).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <div key={key} className="flex items-start gap-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{config.title}</p>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
