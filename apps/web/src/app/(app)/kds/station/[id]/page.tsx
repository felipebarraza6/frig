import { KdsStationClient } from "./kds-station-client";

// Exportación estática (deploy por FTP): se genera una instancia con el
// placeholder "__" y el servidor (ver .htaccess en out/) reescribe las URLs
// reales (/kds/station/<id>) a esa instancia. La estación se resuelve en el cliente.
export function generateStaticParams() {
  return [{ id: "__" }];
}

export default async function KdsStationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KdsStationClient id={id} />;
}
