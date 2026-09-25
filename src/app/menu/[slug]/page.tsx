import { Suspense } from "react";
import PublicMenuPage from "./menu-client";

// Exportación estática (deploy por FTP): se genera una instancia con el
// placeholder "__" y el servidor (ver .htaccess en out/) reescribe las URLs
// reales (/menu/<slug>) a esa instancia. El menú se carga en el cliente
// resolviendo el slug desde el pathname (usePublicMenuSlug).
// En next:dev preferir /menu/view?slug=… (publicMenuUrl ya lo hace).
export function generateStaticParams() {
  return [{ slug: "__" }];
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      }
    >
      <PublicMenuPage />
    </Suspense>
  );
}
