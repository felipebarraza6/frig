import MenuTotemPage from "./totem-client";

// Exportación estática (deploy por FTP): se genera una instancia con el
// placeholder "__" y el servidor (ver .htaccess en out/) reescribe las URLs
// reales (/menu/<slug>/totem) a esa instancia. El catálogo se carga en el cliente.
export function generateStaticParams() {
  return [{ slug: "__" }];
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MenuTotemPage slug={slug} />;
}
