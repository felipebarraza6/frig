import { Suspense } from "react";
import MenuTotemPage from "./totem-client";

// Exportación estática (deploy por FTP): placeholder "__" + .htaccess.
// En next:dev preferir /menu/totem?slug=… (publicTotemUrl ya lo hace).
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
      <MenuTotemPage />
    </Suspense>
  );
}
