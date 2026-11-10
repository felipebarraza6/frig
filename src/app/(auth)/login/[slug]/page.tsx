import { LANDING_USE_CASES } from "@/content/landing";
import { SPONSORED_SLUGS } from "@/lib/sponsors";
import { LoginSlugRedirect } from "./login-slug-redirect";

// Exportación estática (deploy por FTP): una instancia por cada demo
// conocida (para que dev y la exportación resuelvan /login/<slug>) más el
// placeholder "__"; .htaccess (post-export.mjs) reescribe cualquier otro
// /login/<slug> a esta página y el cliente redirige a /login?branch=<slug>.
export function generateStaticParams() {
  const demoSlugs = LANDING_USE_CASES.map((useCase) => useCase.slug);
  const sponsorSlugs = Object.keys(SPONSORED_SLUGS);
  const slugs = Array.from(new Set(["__", ...demoSlugs, ...sponsorSlugs]));
  return slugs.map((slug) => ({ slug }));
}

export default function Page() {
  return <LoginSlugRedirect />;
}
