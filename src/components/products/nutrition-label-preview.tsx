interface NutritionLabelPreviewProps {
  values: {
    energyKcal: string;
    proteinsG: string;
    totalFatsG: string;
    saturatedFatsG: string;
    monounsaturatedFatsG: string;
    polyunsaturatedFatsG: string;
    transFatsG: string;
    cholesterolMg: string;
    carbohydratesG: string;
    totalSugarsG: string;
    sodiumMg: string;
  };
}

function fmt(value: string): string {
  if (!value || value === "0" || value === "0.00") return "0";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num % 1 === 0 ? String(num) : num.toFixed(1);
}

export function NutritionLabelPreview({ values }: NutritionLabelPreviewProps) {
  const hasAny = Object.values(values).some((v) => v && v !== "0" && v !== "0.00");
  if (!hasAny) return null;

  return (
    <div className="mt-4 rounded-lg border-2 border-foreground bg-white p-4 text-foreground shadow-sm">
      <h4 className="border-b-4 border-foreground pb-1 text-xl font-black uppercase">Información nutricional</h4>
      <p className="mt-1 text-xs text-muted-foreground">Por porción de 100 g</p>

      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between border-b border-foreground/20 py-1">
          <span className="font-semibold">Energía</span>
          <span>{fmt(values.energyKcal)} kcal</span>
        </div>
        <div className="flex justify-between border-b border-foreground/20 py-1">
          <span className="font-semibold">Proteínas</span>
          <span>{fmt(values.proteinsG)} g</span>
        </div>
        <div className="flex justify-between border-b border-foreground/20 py-1">
          <span className="font-semibold">Grasas totales</span>
          <span>{fmt(values.totalFatsG)} g</span>
        </div>
        <div className="flex justify-between border-b border-foreground/20 py-1 pl-3">
          <span>Grasas saturadas</span>
          <span>{fmt(values.saturatedFatsG)} g</span>
        </div>
        <div className="flex justify-between border-b border-foreground/20 py-1 pl-3">
          <span>Grasas monoinsaturadas</span>
          <span>{fmt(values.monounsaturatedFatsG)} g</span>
        </div>
        <div className="flex justify-between border-b border-foreground/20 py-1 pl-3">
          <span>Grasas poliinsaturadas</span>
          <span>{fmt(values.polyunsaturatedFatsG)} g</span>
        </div>
        <div className="flex justify-between border-b border-foreground/20 py-1 pl-3">
          <span>Grasas trans</span>
          <span>{fmt(values.transFatsG)} g</span>
        </div>
        <div className="flex justify-between border-b border-foreground/20 py-1">
          <span className="font-semibold">Colesterol</span>
          <span>{fmt(values.cholesterolMg)} mg</span>
        </div>
        <div className="flex justify-between border-b border-foreground/20 py-1">
          <span className="font-semibold">Carbohidratos</span>
          <span>{fmt(values.carbohydratesG)} g</span>
        </div>
        <div className="flex justify-between border-b border-foreground/20 py-1 pl-3">
          <span>Azúcares totales</span>
          <span>{fmt(values.totalSugarsG)} g</span>
        </div>
        <div className="flex justify-between border-b-4 border-foreground py-1">
          <span className="font-semibold">Sodio</span>
          <span>{fmt(values.sodiumMg)} mg</span>
        </div>
      </div>
    </div>
  );
}
