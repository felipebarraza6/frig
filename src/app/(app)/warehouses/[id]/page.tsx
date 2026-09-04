import WarehouseDetailPage from "./warehouse-detail-client";

// Exportación estática (deploy por FTP): se genera una instancia con el
// placeholder "__" y el servidor (ver .htaccess en out/) reescribe las URLs
// reales (/warehouses/<id>) a esa instancia. Los datos se cargan en el cliente.
export function generateStaticParams() {
  return [{ id: "__" }];
}

export default function Page() {
  return <WarehouseDetailPage />;
}
