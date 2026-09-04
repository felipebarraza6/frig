import PublicMenuPage from "./menu-client";

// Exportación estática (deploy por FTP): se genera una instancia con el
// placeholder "__" y el servidor (ver .htaccess en out/) reescribe las URLs
// reales (/menu/<slug>) a esa instancia. El menú se carga en el cliente.
export function generateStaticParams() {
  return [{ slug: "__" }];
}

export default function Page() {
  return <PublicMenuPage />;
}
