import { NutritionLabelPreview } from "./nutrition-label-preview";

interface ProductNutritionLabelProps {
  product: {
    name?: string;
    energy_kcal?: string | number | null;
    proteins_g?: string | number | null;
    total_fats_g?: string | number | null;
    saturated_fats_g?: string | number | null;
    monounsaturated_fats_g?: string | number | null;
    polyunsaturated_fats_g?: string | number | null;
    trans_fats_g?: string | number | null;
    cholesterol_mg?: string | number | null;
    carbohydrates_g?: string | number | null;
    total_sugars_g?: string | number | null;
    sodium_mg?: string | number | null;
  };
}

function s(v: string | number | null | undefined): string {
  return v == null ? "" : String(v);
}

export function ProductNutritionLabel({ product }: ProductNutritionLabelProps) {
  return (
    <NutritionLabelPreview
      productName={product.name}
      values={{
        energyKcal: s(product.energy_kcal),
        proteinsG: s(product.proteins_g),
        totalFatsG: s(product.total_fats_g),
        saturatedFatsG: s(product.saturated_fats_g),
        monounsaturatedFatsG: s(product.monounsaturated_fats_g),
        polyunsaturatedFatsG: s(product.polyunsaturated_fats_g),
        transFatsG: s(product.trans_fats_g),
        cholesterolMg: s(product.cholesterol_mg),
        carbohydratesG: s(product.carbohydrates_g),
        totalSugarsG: s(product.total_sugars_g),
        sodiumMg: s(product.sodium_mg),
      }}
    />
  );
}
