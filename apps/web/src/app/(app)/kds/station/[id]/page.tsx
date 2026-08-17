import { notFound } from "next/navigation";
import { KdsBoard } from "@/components/kds/kds-board";

interface KdsStationPageProps {
  params: Promise<{ id: string }>;
}

export default async function KdsStationPage({ params }: KdsStationPageProps) {
  const { id } = await params;
  const stationId = Number(id);
  if (!stationId || Number.isNaN(stationId)) {
    notFound();
  }

  return <KdsBoard fixedStationId={stationId} title="Estación de cocina" />;
}
