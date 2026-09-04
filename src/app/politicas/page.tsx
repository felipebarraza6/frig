import type { Metadata } from "next";
import Link from "next/link";
import { PixelFoodMark } from "@/components/landing/pixel-food-mark";
import { PixelSlope } from "@/components/landing/pixel-slope";

export const metadata: Metadata = {
  title: "Política de Privacidad — FRIG",
  description:
    "Cómo FRIG trata tus datos: Ley 19.628, no divulgación a terceros, transparencia como producto de código abierto y estado del servicio.",
};

const GOLD = "#e9bd4a";
const CREAM = "#f5efdd";

const SECTIONS = [
  {
    h: "1 · Responsable del tratamiento",
    body: [
      "El responsable del tratamiento de los datos personales recolectados a través de FRIG es su desarrollador y operador (contacto: frig@yggdra.cl, Chile).",
      "Esta política aplica a la plataforma web FRIG (punto de venta, cocina, inventario, finanzas y menú QR) y a sus sitios públicos (landing, demos y login).",
    ],
  },
  {
    h: "2 · Datos que recolectamos",
    body: [
      "Registro y contratación: nombre, correo electrónico, nombre del negocio y datos necesarios para emitir la integración (UF única).",
      "Datos operacionales: productos, precios, ventas, inventarios, usuarios y configuración que cada negocio carga en su propia cuenta. Esos datos pertenecen al negocio, no a FRIG.",
      "Técnicos: dirección IP, navegador y registros de uso mínimos necesarios para operar y proteger el servicio.",
    ],
  },
  {
    h: "3 · Finalidad",
    body: [
      "Usamos los datos exclusivamente para operar la plataforma, autenticar usuarios, prestar soporte, mejorar el servicio y cumplir obligaciones legales.",
      "No elaboramos perfiles publicitarios ni utilizamos los datos operacionales de tu negocio para fines ajenos a la prestación del servicio.",
    ],
  },
  {
    h: "4 · Conservación y seguridad",
    body: [
      "Los datos se conservan mientras la cuenta esté activa y durante los plazos exigidos por la normativa chilena.",
      "Aplicamos medidas técnicas y administrativas razonables: conexión cifrada (HTTPS/TLS), contraseñas con hash, accesos por rol y separación por sucursal/tenant.",
    ],
  },
  {
    h: "5 · No divulgación a terceros",
    body: [
      "No vendemos, cedemos ni compartimos datos personales con terceros para fines comerciales. Punto.",
      "Solo se revelarán datos cuando exista obligación legal o requerimiento de autoridad competente, notificándolo al titular cuando la ley lo permita.",
    ],
  },
  {
    h: "6 · Derechos del titular (Ley 19.628)",
    body: [
      "Conforme a la Ley 19.628 de protección de la vida privada, todo titular puede solicitar en cualquier momento: información sobre sus datos, rectificación, cancelación o bloqueo (oposición).",
      "Para ejercerlos escríbenos a frig@yggdra.cl desde el correo asociado a tu cuenta. Respondemos dentro de los plazos legales vigentes.",
    ],
  },
  {
    h: "7 · Cookies y almacenamiento local",
    body: [
      "Usamos solo cookies y almacenamiento local estrictamente necesarios: sesión de autenticación, preferencias de tema y moneda. No usamos cookies de terceros ni de publicidad.",
    ],
  },
  {
    h: "8 · Menores de edad",
    body: [
      "FRIG es un servicio de gestión comercial dirigido a empresas. No está dirigido a menores de 14 años y no recolectamos intencionalmente datos de menores.",
    ],
  },
  {
    h: "9 · Código abierto y transparencia",
    body: [
      "FRIG es un producto de código abierto: cualquiera puede auditar qué hace el software con los datos. Creemos que la transparencia no es un trámite, es parte del producto.",
      "La sección Plataforma (infraestructura, despliegues y estado del servicio) se mantiene pública y documentada para nuestros clientes.",
    ],
  },
  {
    h: "10 · Servicio en desarrollo activo",
    body: [
      "FRIG es un trabajo en progreso: se despliegan mejoras y nuevas funciones de forma continua. La disponibilidad es esfuerzo razonable y los cortes programados se comunican con anticipación.",
      "Mientras un módulo se encuentre en desarrollo puede estar marcado como beta y cambiar sin previo aviso. Esta política también se actualiza a medida que el producto madura.",
    ],
  },
  {
    h: "11 · Modificaciones a esta política",
    body: [
      "Cualquier cambio se publicará en esta misma página con su fecha de actualización. Si el cambio es sustancial, lo comunicaremos por correo a las cuentas registradas.",
    ],
  },
] as const;

function Section({ h, body }: { h: string; body: readonly string[] }) {
  return (
    <section className="pixel-frame p-5 sm:p-6" style={{ background: "#10160f" }}>
      <h2 className="font-pixel text-sm font-semibold tracking-wider" style={{ color: GOLD }}>
        {h}
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {body.map((p) => (
          <p key={p.slice(0, 24)} className="text-sm leading-relaxed text-emerald-100/80">
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

export default function PoliticasPage() {
  return (
    <div
      className="flex min-h-dvh flex-1 flex-col font-sans"
      style={{ background: "#0b110c", color: CREAM }}
    >
      {/* Barra superior */}
      <header className="sticky top-0 z-40 border-b-2 border-[#241f1a] bg-[#14160f]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
              <PixelFoodMark className="h-5 w-5" />
            </span>
            <span className="font-pixel text-base font-semibold tracking-[0.2em] text-white">
              FRIG
            </span>
          </Link>
          <Link
            href="/"
            className="font-pixel text-xs tracking-widest text-emerald-100/70 transition-colors hover:text-white"
          >
            ← VOLVER
          </Link>
        </div>
      </header>

      {/* Cielo con estrellas sobre el encabezado */}
      <div className="pixel-sky-deep relative overflow-hidden">
        {[10, 22, 35, 48, 60, 73, 86].map((left, i) => (
          <span
            key={left}
            aria-hidden
            className="login-twinkle absolute"
            style={{
              left: `${left}%`,
              top: `${18 + ((i * 13) % 55)}%`,
              width: 2 + (i % 2),
              height: 2 + (i % 2),
              backgroundColor: i % 3 === 0 ? GOLD : "#ece7d4",
              animationDelay: `${i * 0.6}s`,
              animationDuration: `${2.4 + (i % 3) * 0.5}s`,
            }}
          />
        ))}
        <div className="relative mx-auto max-w-4xl px-4 pt-14 pb-10 sm:px-6">
          <p
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ color: GOLD }}
          >
            <span className="inline-block h-2 w-2" style={{ backgroundColor: GOLD }} aria-hidden />
            Transparencia
          </p>
          <h1
            className="mt-3 max-w-2xl font-pixel text-2xl leading-snug tracking-wide sm:text-4xl"
            style={{ color: CREAM, textShadow: "3px 3px 0 rgba(0,0,0,0.5)" }}
          >
            Política de <span style={{ color: GOLD }}>Privacidad</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-100/80 sm:text-base">
            Qué datos recolectamos, para qué, y lo que jamás haremos con ellos. Conforme a la
            Ley 19.628 (Chile). Última actualización: septiembre de 2026.
          </p>
        </div>
      </div>

      <PixelSlope fill="#0b110c" from="#1a271b" seed={2} />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-12 sm:px-6">
        {SECTIONS.map((s) => (
          <Section key={s.h} {...s} />
        ))}

        <section
          className="pixel-frame p-5 sm:p-6"
          style={{ background: "#10160f", borderColor: `${GOLD}66` }}
        >
          <h2 className="font-pixel text-sm font-semibold tracking-wider" style={{ color: GOLD }}>
            12 · Contacto
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-emerald-100/80">
            Para ejercer tus derechos, resolver dudas sobre esta política o reportar un problema
            de seguridad:{" "}
            <a href="mailto:frig@yggdra.cl" className="font-semibold" style={{ color: GOLD }}>
              frig@yggdra.cl
            </a>
            . Los reportes de seguridad se responden con prioridad.
          </p>
        </section>
      </main>

      <div className="mt-auto">
        <PixelSlope fill="#14160f" from="#0b110c" seed={5} highlight="#234026" />
        <footer className="bg-[#14160f]">
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 px-4 py-8 font-pixel text-[10px] tracking-[0.18em] text-emerald-100/50 sm:flex-row sm:px-6">
            <span className="flex items-center gap-2">
              <PixelFoodMark className="h-4 w-4" />
              FRIG — GESTIÓN COMERCIAL Y GASTRONÓMICA
            </span>
            <a href="mailto:frig@yggdra.cl" className="text-emerald-100 hover:text-white">
              CONTACTO: frig@yggdra.cl
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
