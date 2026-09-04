import ResetPasswordPage from "./reset-password-client";

// Exportación estática (deploy por FTP): se genera una instancia con el
// placeholder "__" y el servidor (ver .htaccess en out/) reescribe las URLs
// reales (/reset-password/<token>) a esa instancia. El token se usa en el cliente.
export function generateStaticParams() {
  return [{ token: "__" }];
}

export default function Page() {
  return <ResetPasswordPage />;
}
