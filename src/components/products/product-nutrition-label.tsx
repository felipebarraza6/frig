import { NutritionLabelPreview } from "./nutrition-label-preview";

interface ProductNutritionLabelProps {
  product: {
    energy_kcal?: string | null;
    proteins_g?: string | null;
    total_fats_g?: string | null;
    saturated_fats_g?: string | null;
    monounsaturated_fats_g?: string | null;
    polyunsaturated_fats_g?: string | null;
    trans_fats_g?: string | null;
    cholesterol_mg?: string | null;
    carbohydrates_g?: string | null;
    total_sugars_g?: string | null;
    sodium_mg?: string | null;
  };
}

export function ProductNutritionLabel({ product }: ProductNutritionLabelProps) {
  return (
    <NutritionLabelPreview
      values={{
        energyKcal: product.energy_kcal ?? "",
        proteinsG: product.proteins_g ?? "",
        totalFatsG: product.total_fats_g ?? "",
        saturatedFatsG: product.saturated_fats_g ?? "",
        monounsaturatedFatsG: product.monounsaturated_fats_g ?? "",
        polyunsaturatedFatsG: product.polyunsaturated_fats_g ?? "",
        transFatsG: product.trans_fats_g ?? "",
        cholesterolMg: product.cholesterol_mg ?? "",
        carbohydratesG: product.carbohydrates_g ?? "",
        totalSugarsG: product.total_sugars_g ?? "",
        sodiumMg: product.sodium_mg ?? "",
      }}
    />
  );
}
