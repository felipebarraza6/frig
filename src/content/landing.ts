import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Bike,
  Boxes,
  ChartColumn,
  ChefHat,
  CreditCard,
  FileText,
  Kanban,
  LayoutGrid,
  Leaf,
  QrCode,
  Rotate3d,
  ShieldCheck,
  Store,
  Truck,
  Warehouse,
  Zap,
} from "lucide-react";

export interface LandingFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface LandingValueProp {
  headline: string;
  subhead: string;
  /** Segunda lectura del hero: qué es hoy y qué llega a ser. */
  continuation: string;
  points: string[];
}

export const LANDING_VALUE_PROP: LandingValueProp = {
  headline: "De la venta al cierre, una sola gestión",
  subhead:
    "Frig es la gestión comercial de un negocio de comida. Quien atiende, quien cocina, quien cobra y quien cierra el día trabajan sobre el mismo movimiento: el pedido, la comanda, el arqueo, la receta y la boleta.",
  continuation:
    "Eso es el sistema de hoy. A la larga es el ERP del negocio: las compras al proveedor, las finanzas del período, las personas y las sucursales quedan en la misma cuenta, en el navegador, sin instalar un programa por cada tarea.",
  points: [
    "Todos los módulos, en todos los planes",
    "Caja, mesas y cocina en el mismo turno",
    "Tu marca, sin instaladores ni cajas",
    "Demos reales, listas para probar",
  ],
};

/** Pruebas cortas del hero. No son métricas inventadas: son hechos del producto. */
export const LANDING_PROOF = [
  { value: "0", label: "instaladores" },
  { value: "1", label: "sistema por negocio" },
  { value: "UF", label: "precio, no por módulo" },
] as const;

/**
 * Ambiente de revisión, aparte de producción.
 * El workflow de staging inyecta NEXT_PUBLIC_STAGING_URL. En local (y en el
 * build FTP de producción) cae al GitHub Pages del repo.
 */
export const LANDING_STAGING_URL =
  process.env.NEXT_PUBLIC_STAGING_URL?.trim() ||
  "https://felipebarraza6.github.io/frig/";

export const LANDING_STAGING = {
  kicker: "Staging para revisar",
  title: "Hay una versión de staging para revisar bien",
  body: "Antes de pasar a producción, el mismo sistema corre en un ambiente aparte: módulos, flujos y marca se prueban ahí, sin tocar el local en vivo.",
} as const;

/**
 * Funcionalidades reales de FRIG (alineadas a los módulos de la app).
 * Cada ítem describe algo que el sistema hace hoy, no promesas.
 */
export const LANDING_FEATURES: LandingFeature[] = [
  {
    icon: Zap,
    title: "Punto de venta táctil",
    description: "Cobra en segundos con modificadores, combos y descuentos.",
  },
  {
    icon: Banknote,
    title: "Caja y arqueo",
    description: "Apertura, movimientos, cierre y cuadratura del día.",
  },
  {
    icon: Rotate3d,
    title: "Salón digital 3D",
    description:
      "Tu local en 3D: pantallas de cocina vivas en los muros, tótem de catálogo y recorrido en primera persona.",
  },
  {
    icon: LayoutGrid,
    title: "Mesas y salón",
    description:
      "Cuentas por mesa, estados en vivo y modo garzón sobre el mapa del local.",
  },
  {
    icon: ChefHat,
    title: "Cocina y KDS",
    description:
      "Comandas en pantalla con tiempos en vivo, colores de estado configurables y monitor del salón.",
  },
  {
    icon: Bike,
    title: "Delivery y retiro",
    description: "Pedidos con despacho y panel de pendientes.",
  },
  {
    icon: Warehouse,
    title: "Inventario y recetas",
    description: "Descuento automático de insumos al vender.",
  },
  {
    icon: Boxes,
    title: "Bodegas visuales",
    description:
      "Bodegas por salas y casillas con vista 3D e inspector de stock a golpe de vista.",
  },
  {
    icon: ChartColumn,
    title: "Informes y finanzas",
    description:
      "Ventas, dinero, gastos e ingresos: KPIs con deltas por período, listos para decidir.",
  },
  {
    icon: Kanban,
    title: "CRM comercial",
    description:
      "Prospectos, embudo de oportunidades, seguimientos y encuestas públicas con QR.",
  },
  {
    icon: FileText,
    title: "Facturación electrónica",
    description: "Boletas y facturas al SII con un clic.",
  },
  {
    icon: QrCode,
    title: "Menú QR y pedidos",
    description:
      "Carta digital con carrito, pedidos desde la mesa y modo tótem para autoservicio.",
  },
  {
    icon: Leaf,
    title: "Etiquetas nutricionales",
    description:
      "Etiqueta normada generada desde tus recetas, imprimible en un clic.",
  },
  {
    icon: CreditCard,
    title: "Medios de pago",
    description: "Transbank, efectivo, transferencia y propina del 10%.",
  },
  {
    icon: Store,
    title: "Multi-sucursal",
    description: "Gestiona varios locales desde una sola cuenta.",
  },
  {
    icon: Truck,
    title: "Proveedores y compras",
    description: "Órdenes de compra, cotizaciones y recepción de mercadería.",
  },
  {
    icon: ShieldCheck,
    title: "Roles y permisos",
    description: "Acceso granular para administradores, cajeros y garzones.",
  },
];

/**
 * Recorrido de la gestión. Cada tramo abre el módulo donde ese trabajo se hace.
 * No agrega funciones: ordena las que ya existen.
 */
export const LANDING_CYCLE = [
  {
    label: "Vender",
    detail: "El pedido se arma y se cobra.",
    module: "Punto de venta táctil",
  },
  {
    label: "Atender",
    detail: "La mesa tiene cuenta y estado.",
    module: "Mesas y salón",
  },
  {
    label: "Preparar",
    detail: "La comanda nace de esa venta.",
    module: "Cocina y KDS",
  },
  {
    label: "Cobrar",
    detail: "El dinero entra al turno.",
    module: "Caja y arqueo",
  },
  {
    label: "Documentar",
    detail: "La boleta sale al SII.",
    module: "Facturación electrónica",
  },
  {
    label: "Abastecer",
    detail: "La receta descuenta el insumo.",
    module: "Inventario y recetas",
  },
  {
    label: "Cerrar",
    detail: "El período se lee en finanzas.",
    module: "Informes y finanzas",
  },
] as const;

/** Oficio de cada módulo. Solo lo que el sistema hace hoy. */
export interface LandingModuleDossier {
  role: string;
  /** Tres nombres cortos, uno por paso, para leer el recorrido de un vistazo. */
  marks: readonly [string, string, string];
  steps: readonly [string, string, string];
  method: string;
  traits: readonly [string, string, string];
  links: readonly string[];
}

export const LANDING_MODULE_DOSSIERS: Record<string, LandingModuleDossier> = {
  "Punto de venta táctil": {
    marks: ['Arma', 'Toma', 'Cobra'],
    role: "Aquí parte la gestión del día. El pedido se arma en pantalla y ese mismo movimiento es el que cocina prepara, caja arquea, bodega descuenta y el SII puede recibir.",
    steps: [
      "Se elige el producto y se ajusta en la misma cuenta: modificador, combo o descuento.",
      "El pedido queda tomado. Cocina y la mesa lo ven sin que nadie lo vuelva a escribir.",
      "Al cobrar, el medio de pago, la caja del turno y la boleta salen de este movimiento.",
    ],
    method: "Pantalla táctil en el navegador. No hay un programa de caja instalado al lado del resto de la gestión.",
    traits: ["Modificadores en el producto", "Combos armados", "Descuentos en la misma cuenta"],
    links: ["Cocina y KDS", "Caja y arqueo", "Inventario y recetas", "Facturación electrónica"],
  },
  "Caja y arqueo": {
    marks: ['Abre', 'Anota', 'Cuadra'],
    role: "La caja no es una planilla al lado de la venta. Recibe lo cobrado, anota lo que entra y sale en el turno, y cierra contra el día real.",
    steps: [
      "Se abre el turno con el monto inicial. Desde ahí la caja pertenece a esa gestión.",
      "Cada cobro entra solo. Las entradas y salidas del turno se anotan sobre el mismo arqueo.",
      "Al cerrar se cuadra el dinero del turno contra lo vendido.",
    ],
    method: "Apertura, movimientos y cierre viven en el mismo sistema que la venta. El día no se reconstruye después.",
    traits: ["Apertura con monto inicial", "Entradas y salidas del turno", "Cierre contra lo vendido"],
    links: ["Punto de venta táctil", "Medios de pago", "Informes y finanzas"],
  },
  "Salón digital 3D": {
    marks: ['Recorre', 'Mira', 'Pide'],
    role: "El salón deja de ser un plano mudo. Se recorre, muestra la cocina en los muros y ofrece el catálogo en el tótem, sobre la misma operación.",
    steps: [
      "El salón se recorre en primera persona, en el navegador, sobre el plano del negocio.",
      "En los muros se ve la cocina en vivo: la operación no queda en otra pantalla escondida.",
      "El tótem muestra el catálogo para quien pide por su cuenta.",
    ],
    method: "El plano se recorre en el navegador. La cocina y la carta que muestra son las de la gestión, no un render aparte.",
    traits: ["Recorrido en primera persona", "Pantallas de cocina en los muros", "Tótem de catálogo"],
    links: ["Mesas y salón", "Cocina y KDS", "Menú QR y pedidos"],
  },
  "Mesas y salón": {
    marks: ['Mapa', 'Cuenta', 'Cocina'],
    role: "Cada mesa es una cuenta de la gestión, no un número en un papel. Quien atiende ve el estado, y cocina recibe lo que esa mesa pidió.",
    steps: [
      "El mapa muestra cada mesa y su estado, para quien atiende y para quien administra.",
      "Abrir una mesa abre su cuenta: lo pedido queda a nombre de esa mesa.",
      "Lo que se agrega viaja a cocina y el estado de la mesa cambia cuando el plato está listo.",
    ],
    method: "Mapa del salón con cuenta por mesa y modo garzón. La mesa es una cuenta, no una anotación suelta.",
    traits: ["Cuenta separada por mesa", "Estados de la mesa", "Modo garzón sobre el mapa"],
    links: ["Punto de venta táctil", "Cocina y KDS", "Salón digital 3D"],
  },
  "Cocina y KDS": {
    marks: ['Entra', 'Tiempo', 'Listo'],
    role: "La comanda nace de la venta, no de un grito. Cocina ve el tiempo y el estado, y el salón ve cuándo el plato está listo.",
    steps: [
      "La comanda entra cuando se vende o cuando la mesa pide. No hay una orden paralela.",
      "En pantalla se ve el tiempo y el estado, con colores que el negocio configura.",
      "Al marcar listo, el salón se entera por el monitor.",
    ],
    method: "Pantalla de cocina con tiempos en vivo, colores de estado y monitor del salón.",
    traits: ["Tiempos en vivo", "Colores de estado configurables", "Monitor del salón"],
    links: ["Punto de venta táctil", "Mesas y salón", "Menú QR y pedidos"],
  },
  "Delivery y retiro": {
    marks: ['Entra', 'Pendiente', 'Cierra'],
    role: "El pedido que no se come en la mesa entra a la misma gestión: se despacha o se retira, y queda pendiente hasta que se cierra.",
    steps: [
      "El pedido entra como despacho o como retiro, en la misma operación del día.",
      "Queda en el panel de pendientes hasta que sale o lo vienen a buscar.",
      "Cocina lo prepara y caja lo cobra en la misma cuenta.",
    ],
    method: "Despacho y retiro comparten el panel de pendientes con el resto de la operación.",
    traits: ["Despacho", "Retiro en el negocio", "Panel de pendientes"],
    links: ["Punto de venta táctil", "Cocina y KDS", "Caja y arqueo"],
  },
  "Inventario y recetas": {
    marks: ['Receta', 'Descuenta', 'Repone'],
    role: "La receta es el puente entre lo que se vende y lo que hay en bodega. Cada venta descuenta el insumo, sin un conteo aparte al cerrar.",
    steps: [
      "Cada producto que se vende tiene receta: la lista de insumos que lo componen.",
      "Al vender, esos insumos bajan del stock. El conteo no se deja para el final del día.",
      "Lo que falta se ve en bodega y se repone con una compra.",
    ],
    method: "La receta une la venta con la bodega. El descuento del insumo es automático.",
    traits: ["Receta por producto", "Descuento al vender", "Stock de insumos"],
    links: ["Punto de venta táctil", "Bodegas visuales", "Etiquetas nutricionales", "Proveedores y compras"],
  },
  "Bodegas visuales": {
    marks: ['Lugar', 'Casilla', 'Lee'],
    role: "El stock tiene lugar: sala y casilla. La mercadería que se recibe y el insumo que descuenta la receta se miran en el mismo mapa.",
    steps: [
      "El stock no es un número suelto: vive en una sala y en una casilla.",
      "Se entra a la sala, se elige la casilla y se inspecciona qué hay.",
      "La recepción de una compra y el descuento de una receta se leen ahí.",
    ],
    method: "Bodegas por salas y casillas, con vista 3D e inspector de stock.",
    traits: ["Salas y casillas", "Vista 3D", "Inspector de stock"],
    links: ["Inventario y recetas", "Proveedores y compras"],
  },
  "Informes y finanzas": {
    marks: ['Período', 'Delta', 'Fuente'],
    role: "El cierre no se reconstruye en una hoja. Ventas, dinero, gastos e ingresos salen de la operación y se comparan con el período anterior.",
    steps: [
      "Se elige el período. Ventas, dinero, gastos e ingresos salen de lo que ya pasó en el día.",
      "Cada indicador se compara con el período anterior: el delta dice si el negocio subió o bajó.",
      "Caja, boletas y compras alimentan esa lectura. No se vuelven a tipear.",
    ],
    method: "Indicadores del período con delta. La fuente es la gestión del día, no un cierre armado a mano.",
    traits: ["Ventas y dinero", "Gastos e ingresos", "Delta contra el período anterior"],
    links: ["Caja y arqueo", "Facturación electrónica", "Proveedores y compras"],
  },
  "CRM comercial": {
    marks: ['Ficha', 'Embudo', 'Encuesta'],
    role: "Antes de la venta está la relación. El prospecto, el seguimiento y la encuesta quedan en la misma cuenta que después cobra y atiende.",
    steps: [
      "El prospecto tiene ficha antes de ser una venta del negocio.",
      "Se mueve en el embudo de oportunidades y se le deja seguimiento.",
      "La encuesta pública, con QR, recoge lo que la persona dice cuando ya comió.",
    ],
    method: "Prospectos, oportunidades, seguimientos y encuestas públicas en la misma cuenta que cobra y atiende.",
    traits: ["Ficha del prospecto", "Embudo de oportunidades", "Encuesta pública con QR"],
    links: ["Menú QR y pedidos", "Informes y finanzas"],
  },
  "Facturación electrónica": {
    marks: ['Venta', 'Documento', 'SII'],
    role: "El documento tributario sale de la venta, no de otro sistema. Boleta o factura van al SII con el movimiento que ya pasó por caja.",
    steps: [
      "La venta ya está cerrada. El documento no se arma en un sistema paralelo.",
      "Se emite boleta o factura con ese mismo movimiento.",
      "El envío va al SII, y los informes leen el documento que salió.",
    ],
    method: "Boleta y factura electrónica al SII desde la venta ya cobrada.",
    traits: ["Boleta", "Factura", "Envío al SII"],
    links: ["Punto de venta táctil", "Caja y arqueo", "Informes y finanzas"],
  },
  "Menú QR y pedidos": {
    marks: ['Carta', 'Carrito', 'Cocina'],
    role: "La carta pública también es gestión. El pedido que arma la mesa entra a cocina y a la cuenta, igual que el que toma quien atiende.",
    steps: [
      "La mesa abre la carta en el teléfono. Es la carta del negocio, no un archivo aparte.",
      "Arma el pedido en el carrito, con lo mismo que vería quien atiende.",
      "Ese pedido entra a cocina y a la cuenta de la mesa.",
    ],
    method: "Carta digital con carrito, pedido desde la mesa y modo tótem de autoservicio.",
    traits: ["Carta en el teléfono", "Carrito", "Tótem de autoservicio"],
    links: ["Cocina y KDS", "Mesas y salón", "Punto de venta táctil"],
  },
  "Etiquetas nutricionales": {
    marks: ['Receta', 'Norma', 'Imprime'],
    role: "La etiqueta no se redacta aparte. Sale de la misma receta que descuenta bodega, en el formato que pide la norma.",
    steps: [
      "La receta ya tiene los datos del producto. No se abre una ficha paralela.",
      "Con eso se arma la etiqueta en el formato normado.",
      "Se imprime desde el mismo lugar donde vive la receta.",
    ],
    method: "La etiqueta nutricional sale de la receta que también descuenta la bodega.",
    traits: ["Datos desde la receta", "Formato normado", "Impresión en un clic"],
    links: ["Inventario y recetas"],
  },
  "Medios de pago": {
    marks: ['Medio', 'Caja', 'Propina'],
    role: "El cobro cierra la venta dentro del sistema. Transbank, efectivo o transferencia quedan en la cuenta, con la propina si corresponde.",
    steps: [
      "La cuenta elige el medio: Transbank, efectivo o transferencia.",
      "El cobro queda en esa venta y entra a la caja del turno.",
      "Si corresponde, se suma la propina del 10%.",
    ],
    method: "Los medios de pago cierran la venta dentro del sistema. El cobro no se pasa a mano a otra planilla.",
    traits: ["Transbank", "Efectivo y transferencia", "Propina del 10%"],
    links: ["Punto de venta táctil", "Caja y arqueo", "Facturación electrónica"],
  },
  "Multi-sucursal": {
    marks: ['Cuenta', 'Elige', 'Lee'],
    role: "Varias sucursales no son varios sistemas. Una cuenta cambia de negocio, y cada uno conserva su caja, su salón y su bodega.",
    steps: [
      "Una cuenta entra al sistema. No hay un acceso distinto por cada sucursal.",
      "Se elige el negocio y se trabaja su operación: caja, salón y bodega de esa sucursal.",
      "Las finanzas pueden leer el conjunto sin mezclar el turno de cada una.",
    ],
    method: "Varias sucursales en la misma cuenta. Cada una conserva su operación.",
    traits: ["Una cuenta", "Cambio de sucursal", "Operación separada por sucursal"],
    links: ["Caja y arqueo", "Informes y finanzas", "Bodegas visuales"],
  },
  "Proveedores y compras": {
    marks: ['Cotiza', 'Ordena', 'Recibe'],
    role: "La mercadería entra por el mismo camino por el que después sale en la receta. Se cotiza, se ordena y se recibe en bodega.",
    steps: [
      "Se pide cotización al proveedor cuando falta mercadería.",
      "La orden de compra deja por escrito lo que se va a recibir.",
      "Al recepcionar, entra a bodega y queda disponible para la receta.",
    ],
    method: "Cotización, orden y recepción son el tramo de compras del mismo sistema que vende.",
    traits: ["Cotización al proveedor", "Orden de compra", "Recepción que entra a bodega"],
    links: ["Bodegas visuales", "Inventario y recetas", "Informes y finanzas"],
  },
  "Roles y permisos": {
    marks: ['Define', 'Reparte', 'Entra'],
    role: "La gestión se reparte. Quien cobra, quien atiende y quien administra ven el tramo que les toca, dentro del mismo sistema.",
    steps: [
      "Se define el rol: administración, caja o salón.",
      "Cada rol ve su tramo. Quien cobra no administra todo, y quien atiende no cierra la caja.",
      "La persona entra con ese acceso y trabaja dentro de la misma gestión.",
    ],
    method: "Permisos por rol. La gestión se reparte sin partir el sistema en programas distintos.",
    traits: ["Administración", "Caja", "Garzón"],
    links: ["Punto de venta táctil", "Caja y arqueo", "Mesas y salón"],
  },
};

/** Origen del nombre. Amar, ver el conjunto, hilar las nubes. Sin hogar como destino ni relatos de pareja. */
export const LANDING_ORIGIN = {
  kicker: "La razón del nombre",
  title: "Se llama Frig por quien mira lejos",
  paragraphs: [
    "Frigg es de los relatos nórdicos. Mira los nueve mundos al mismo tiempo, y la imagen del inicio es ella hilando las nubes. El viernes lleva su nombre desde hace siglos. Frig es como se escribió ese nombre.",
    "Lo usamos porque un negocio de comida también se hila. Cocina, caja, bodega y las personas que trabajan tienen que verse juntas. Si el día queda en una sola cabeza, el resto trabaja a ciegas.",
    "Ese es el objetivo. No otro programa para empujar una venta. Un lugar donde el día del negocio está a la vista de quien lo hace.",
  ],
  sourceLabel: "Frigg, en Wikipedia",
  sourceHref: "https://es.wikipedia.org/wiki/Frigg",
  image: "/brand/frigg-hilando.jpg",
  imageAlt: "Frigg hilando las nubes, ilustración de J. C. Dollman, 1909",
  caption: "Frigg hilando las nubes. J. C. Dollman, 1909. Dominio público.",
  imageHref: "https://es.wikipedia.org/wiki/Frigg",
} as const;

export const DEMO_CONTACTS = {
  to: "frig@yggdra.cl",
  subject: "Solicito una demo de FRIG",
} as const;

// ── Planes de precio ─────────────────────────────────────────────────────────

/**
 * Parrilla de precios de FRIG. Filosofía: todos los planes incluyen TODOS los
 * módulos (FRIG es abierta, no vende por herramienta). El precio crece con el
 * nivel de demanda del negocio — sucursales, puntos de venta y usuarios —
 * no con las funciones disponibles.
 */
export interface LandingPlan {
  id: string;
  name: string;
  tagline: string;
  priceUf: number | null;
  /** Recursos incluidos (lo que crece entre niveles). */
  resources: string[];
  highlighted?: boolean;
  /** Texto del sello del plan destacado (viene del sistema). */
  badge?: string | null;
}

export const LANDING_INTEGRATION_UF = 0;

export const LANDING_PLANS: LandingPlan[] = [
  {
    id: "demo",
    name: "Plan Demo",
    tagline: "Prueba gratuita sin compromiso",
    priceUf: 0,
    resources: ["POS básico", "Inventario", "1 sucursal", "Soporte email"],
  },
  {
    id: "local",
    name: "Plan Local",
    tagline: "Para locales pequeños",
    priceUf: 5,
    resources: ["POS avanzado", "Inventario completo", "3 sucursales", "Soporte prioritario", "Reportes básicos"],
    highlighted: true,
    badge: "Más Popular",
  },
  {
    id: "pro",
    name: "Plan Pro",
    tagline: "Para redes y franquicias",
    priceUf: 15,
    resources: ["Todo en Local", "Sucursales ilimitadas", "Agentes IA", "Workflows", "Soporte 24/7", "API completa"],
  },
];

export const LANDING_PRICING_NOTE = "Precios en UF. Plan demo sin costo.";

// ── Casos de uso (demos) ─────────────────────────────────────────────────────

/**
 * Demos activas de FRIG por rubro. Cada una tiene su login personalizado
 * (logo y color de marca) en /login/<slug>.
 */
export interface LandingUseCase {
  slug: string;
  name: string;
  rubro: string;
  /** Color de marca de la demo. */
  brandColor: string;
  /** Qué demuestra. */
  highlight: string;
}

export const LANDING_USE_CASES: LandingUseCase[] = [
  {
    slug: "pos",
    name: "Kiosco Express San Miguel",
    rubro: "Punto de venta",
    brandColor: "#f97316",
    highlight: "Cobro táctil en segundos",
  },
  {
    slug: "minimarket",
    name: "Mini Market Don Pepe",
    rubro: "Minimarket",
    brandColor: "#16a34a",
    highlight: "Catálogo con código y stock",
  },
  {
    slug: "comida",
    name: "Sanguchería Chillán",
    rubro: "Comida rápida / takeaway",
    brandColor: "#dc2626",
    highlight: "Combos y modificadores al vuelo",
  },
  {
    slug: "bistro",
    name: "Bistro La Tranquera",
    rubro: "Restaurante mediano",
    brandColor: "#d4a017",
    highlight: "9 mesas con cuentas por mesa",
  },
  {
    slug: "grande",
    name: "Restaurante Puerto Azul",
    rubro: "Restaurante grande",
    brandColor: "#1e3a8a",
    highlight: "18 mesas, cajero y garzones",
  },
  {
    slug: "heladeria",
    name: "Heladería Glacé Andino",
    rubro: "Heladería artesanal",
    brandColor: "#d946ef",
    highlight: "Recetas y sabores por combinación",
  },
  {
    slug: "pub",
    name: "Pub La Oficina",
    rubro: "Pub / Bar",
    brandColor: "#8E44AD",
    highlight: "Tragos y tablas con ventas rápidas",
  },
  {
    slug: "cafeteria",
    name: "Pastelería Dulce Amanecer",
    rubro: "Cafetería / Pastelería",
    brandColor: "#E67E22",
    highlight: "Recetas que descuentan insumos",
  },
  {
    slug: "gestion",
    name: "Comercial Los Robles",
    rubro: "Gestión comercial",
    brandColor: "#2C3E50",
    highlight: "Solo finanzas: lo esencial de tu negocio",
  },
];
