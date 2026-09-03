import { LoginSlugRedirect } from "./login-slug-redirect";

// Exportación estática (deploy por FTP): instancia del placeholder "__";
// .htaccess (post-export.mjs) reescribe /login/<slug> a esta página y el
// cliente redirige a /login?branch=<slug> con el slug real.
export function generateStaticParams() {
  return [{ slug: "__" }];
}

export default function Page() {
  return <LoginSlugRedirect />;
}
