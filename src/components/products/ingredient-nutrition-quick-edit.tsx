"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Apple, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { fetchProduct, updateProduct } from "@/lib/api/products";
import { useToast } from "@/lib/store/toast";

const QUICK_FIELDS = [
  { key: "energy_kcal", label: "kcal" },
  { key: "proteins_g", label: "Prot. g" },
  { key: "total_fats_g", label: "Grasas g" },
  { key: "saturated_fats_g", label: "Sat. g" },
  { key: "monounsaturated_fats_g", label: "Monoins. g" },
  { key: "polyunsaturated_fats_g", label: "Poliins. g" },
  { key: "trans_fats_g", label: "Trans g" },
  { key: "cholesterol_mg", label: "Colest. mg" },
  { key: "carbohydrates_g", label: "Carb. g" },
  { key: "total_sugars_g", label: "Azúc. g" },
  { key: "sodium_mg", label: "Sodio mg" },
] as const;

type QuickKey = (typeof QUICK_FIELDS)[number]["key"];

function numStr(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v);
}

interface IngredientNutritionQuickEditProps {
  productId: number;
  productName: string;
  className?: string;
}

/** Editor compacto de nutrición del producto-ingrediente (PATCH al producto). */
export function IngredientNutritionQuickEdit({
  productId,
  productName,
  className,
}: IngredientNutritionQuickEditProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<QuickKey, string>>({
    energy_kcal: "",
    proteins_g: "",
    total_fats_g: "",
    saturated_fats_g: "",
    monounsaturated_fats_g: "",
    polyunsaturated_fats_g: "",
    trans_fats_g: "",
    cholesterol_mg: "",
    carbohydrates_g: "",
    total_sugars_g: "",
    sodium_mg: "",
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["products", "detail", "nutrition-quick", productId],
    queryFn: () => fetchProduct(productId),
    enabled: open,
    staleTime: 30_000,
  });

  // Sincronizar el borrador cuando llega el producto, sin effect
  // (patrón "adjust state during render" de react.dev).
  const [syncedData, setSyncedData] = useState(data);
  if (data !== syncedData) {
    setSyncedData(data);
    if (data) {
      setDraft({
        energy_kcal: numStr(data.energy_kcal),
        proteins_g: numStr(data.proteins_g),
        total_fats_g: numStr(data.total_fats_g),
        saturated_fats_g: numStr(data.saturated_fats_g),
        monounsaturated_fats_g: numStr(data.monounsaturated_fats_g),
        polyunsaturated_fats_g: numStr(data.polyunsaturated_fats_g),
        trans_fats_g: numStr(data.trans_fats_g),
        cholesterol_mg: numStr(data.cholesterol_mg),
        carbohydrates_g: numStr(data.carbohydrates_g),
        total_sugars_g: numStr(data.total_sugars_g),
        sodium_mg: numStr(data.sodium_mg),
      });
    }
  }

  const hasAny = Object.values(draft).some((v) => v !== "" && Number(v) !== 0);

  async function save() {
    setSaving(true);
    try {
      const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
      await updateProduct(productId, {
        is_nutritional_ingredient: true,
        energy_kcal: toNum(draft.energy_kcal),
        proteins_g: toNum(draft.proteins_g),
        total_fats_g: toNum(draft.total_fats_g),
        saturated_fats_g: toNum(draft.saturated_fats_g),
        monounsaturated_fats_g: toNum(draft.monounsaturated_fats_g),
        polyunsaturated_fats_g: toNum(draft.polyunsaturated_fats_g),
        trans_fats_g: toNum(draft.trans_fats_g),
        cholesterol_mg: toNum(draft.cholesterol_mg),
        carbohydrates_g: toNum(draft.carbohydrates_g),
        total_sugars_g: toNum(draft.total_sugars_g),
        sodium_mg: toNum(draft.sodium_mg),
      });
      queryClient.invalidateQueries({ queryKey: ["products", "detail", "nutrition-quick", productId] });
      queryClient.invalidateQueries({ queryKey: ["products", "detail", productId] });
      toast.success(`Nutrición de ${productName} guardada`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la nutrición");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("col-span-12", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors",
          open
            ? "bg-success/15 text-success ring-1 ring-success/30"
            : "text-muted-foreground hover:bg-success/10 hover:text-success",
        )}
        title="Editar nutrición del ingrediente"
      >
        <Apple className="h-3.5 w-3.5" />
        Nutrición
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-success/[0.06] p-3 ring-1 ring-success/20 shadow-[inset_0_1px_0_var(--glass-highlight)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              Valores por 100 g · {productName}
              {(isLoading || isFetching) && !data ? " · cargando…" : ""}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Cerrar nutrición"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {QUICK_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`ing-nut-${productId}-${f.key}`}>
                <Input
                  id={`ing-nut-${productId}-${f.key}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft[f.key]}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-8 rounded-lg border-0 bg-background/70 text-xs ring-1 ring-border/40"
                  placeholder="0"
                />
              </Field>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              {hasAny ? "Se marca como ingrediente nutricional" : "Completa al menos un valor"}
            </p>
            <Button type="button" size="sm" onClick={save} isLoading={saving} disabled={!data && isLoading}>
              {!saving && <Check className="mr-1 h-3.5 w-3.5" />}
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
