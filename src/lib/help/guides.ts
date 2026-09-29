/**
 * Catálogo completo de guías del producto (Ayuda → Documentación).
 * Cubre todos los grupos del menú y roles ops / admin / dev.
 */

export type HelpGuideAudience = "ops" | "admin" | "dev";

export type HelpGuideGroup =
  | "inicio"
  | "vender"
  | "local"
  | "crm"
  | "catalogo"
  | "dinero"
  | "informes"
  | "ajustes"
  | "ayuda"
  | "integraciones";

/** Mini pantalla con datos como en la app. */
export interface HelpExample {
  caption?: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  /** Líneas "nombre · valor" (cuenta, ticket, listado). */
  items?: string[];
  rows?: { label: string; value: string }[];
  total?: string;
  code?: string;
}

export interface HelpGuideSection {
  heading: string;
  body: string[];
  tips?: string[];
  /** Lo que esta función no cubre (alcance). */
  limits?: string[];
  example?: HelpExample;
}

export interface HelpGuide {
  slug: string;
  title: string;
  summary: string;
  group: HelpGuideGroup;
  /** Módulo relacionado (null = transversal). */
  module: string | null;
  audience: HelpGuideAudience[];
  icon: string;
  href?: string;
  sections: HelpGuideSection[];
}

export const HELP_GUIDE_GROUPS: {
  id: HelpGuideGroup;
  label: string;
  description: string;
}[] = [
  { id: "inicio", label: "Inicio", description: "Acceso, roles y panorama general" },
  { id: "vender", label: "Vender", description: "POS, caja, ventas y cotizaciones" },
  { id: "local", label: "Local", description: "Mesas, planta virtual y cocina KDS" },
  { id: "crm", label: "CRM", description: "Clientes y promociones" },
  { id: "catalogo", label: "Catálogo", description: "Productos, menús públicos e inventario" },
  { id: "dinero", label: "Dinero", description: "Pagos, finanzas, proveedores y bancos" },
  { id: "informes", label: "Informes", description: "Ventas, flujo de caja y nutrición" },
  { id: "ajustes", label: "Ajustes", description: "Organización, usuarios, sucursales y módulos" },
  { id: "ayuda", label: "Ayuda", description: "Suscripción, soporte y documentación" },
  { id: "integraciones", label: "Integraciones", description: "Alcance de la API que la app usa en el local" },
];

export const HELP_GUIDES: HelpGuide[] = [
  // ── Inicio ──────────────────────────────────────────────────────────────
  {
    slug: "primeros-pasos",
    title: "Primeros pasos",
    summary: "Login, sucursal activa, menú y dock móvil.",
    group: "inicio",
    module: null,
    audience: ["ops", "admin"],
    icon: "Sparkles",
    sections: [
      {
        heading: "Entrar",
        body: [
          "Abre la URL de tu marca e inicia sesión con el correo que te asignó el propietario.",
          "Al entrar ves el menú de tu sucursal: solo aparecen las áreas que el plan y los módulos permiten.",
        ],
        tips: ["Si no puedes entrar, pide al propietario que revise tu usuario y la sucursal asignada."],
      },
      {
        heading: "Sucursal activa",
        body: [
          "Todo lo que haces (ventas, stock, caja) queda en la sucursal que estás viendo.",
          "Si trabajas en varios locales, cámbialos desde el conmutador del menú. Colores y logo siguen a ese local.",
        ],
        example: {
          kicker: "Conmutador",
          title: "Macanuo Bowl",
          subtitle: "Las ventas y el color de esta sesión son de este local.",
          badge: "Activa",
          rows: [
            { label: "Rol", value: "Cajero" },
            { label: "Plan", value: "Plan mensual" },
          ],
        },
      },
      {
        heading: "Navegación",
        body: [
          "En escritorio el menú lateral agrupa Vender, Local, Catálogo, Dinero y Ajustes.",
          "En el teléfono el dock inferior no cambia al navegar. Abre Menú para el resto de pantallas y fija favoritos.",
        ],
        tips: ["En Ayuda están las guías, la API y Soporte para hablar con el equipo."],
      },
    ],
  },
  {
    slug: "roles-y-permisos",
    title: "Roles y permisos",
    summary: "OWNER, ADMIN_LOCAL, CAJERO, GARZÓN, COCINERO y qué puede hacer cada uno.",
    group: "inicio",
    module: "config",
    audience: ["admin", "ops"],
    icon: "UserIcon",
    href: "/users",
    sections: [
      {
        heading: "Roles habituales",
        body: [
          "OWNER: contrata plan, gestiona sucursal y equipo.",
          "ADMIN_LOCAL: opera y configura módulos, sin cancelar suscripción de plataforma.",
          "CAJERO: POS, caja y cobros. GARZÓN: mesas y pedidos. COCINERO: KDS.",
        ],
      },
      {
        heading: "Módulos",
        body: [
          "Aunque tengas rol, si el módulo está apagado en Ajustes → Módulos no verás la ruta.",
          "El candado de suscripción (sin plan activo) deja Perfil, Ayuda y Soporte.",
        ],
      },
    ],
  },
  {
    slug: "dashboard",
    title: "Dashboard",
    summary: "Resumen del día: ventas, caja y alertas.",
    group: "inicio",
    module: "dashboard",
    audience: ["admin", "ops"],
    icon: "LayoutDashboard",
    href: "/dashboard",
    sections: [
      {
        heading: "Qué mirar",
        body: [
          "KPIs del período (ventas, tickets, promedio).",
          "Accesos rápidos a POS, ventas y reportes según módulos activos.",
        ],
      },
    ],
  },

  // ── Vender ──────────────────────────────────────────────────────────────
  {
    slug: "pos",
    title: "Punto de venta (POS)",
    summary: "Terminal de venta, cuentas abiertas y cobros.",
    group: "vender",
    module: "pos",
    audience: ["ops", "admin"],
    icon: "HandCoins",
    href: "/pos",
    sections: [
      {
        heading: "Antes de vender",
        body: [
          "Abre la estación de caja ligada al punto de venta.",
          "Confirma que POS y Caja estén activos en Módulos.",
        ],
      },
      {
        heading: "Flujo de cobro",
        body: [
          "Crea o retoma una cuenta, agrega productos, combos y opciones (tamaño, extras).",
          "Revisa el total, aplica cupón o descuento si Promociones está activo.",
          "Cobra: el pago queda en la caja abierta de esa estación.",
        ],
        tips: [
          "En el teléfono usa el POS a pantalla completa.",
          "Si no ves un producto, confirma que esté marcado En venta y que el módulo de catálogo esté activo.",
        ],
        example: {
          kicker: "POS · Mesa 7",
          title: "Cuenta abierta",
          badge: "Por cobrar",
          items: [
            "Completo italiano × 2 · $9.000",
            "Bebida 350 ml · $1.200",
            "Cupón 10% · −$1.020",
          ],
          total: "$9.180",
        },
      },
      {
        heading: "Si algo no cuadra",
        body: [
          "Sin caja abierta no se puede cobrar: ábrela en Caja.",
          "Una cuenta de mesa se cierra al pagar; vuelve a Mesas si necesitas reabrir el salón.",
        ],
      },
    ],
  },
  {
    slug: "caja",
    title: "Caja",
    summary: "Apertura, movimientos, arqueo y cierre de estación.",
    group: "vender",
    module: "cash_register",
    audience: ["ops", "admin"],
    icon: "Banknote",
    href: "/cash-register",
    sections: [
      {
        heading: "Ciclo de caja",
        body: [
          "Abre la estación con el efectivo inicial antes del primer cobro.",
          "Durante el turno entran pagos del POS e ingresos o egresos que registres a mano.",
          "Al cerrar, cuenta el efectivo, anota diferencias y confirma el arqueo.",
        ],
        tips: ["No compartas una estación abierta entre turnos distintos: cierra y abre de nuevo."],
        example: {
          kicker: "Estación Barra",
          title: "Caja abierta",
          badge: "Turno",
          rows: [
            { label: "Apertura", value: "$50.000" },
            { label: "Ventas POS", value: "$128.400" },
            { label: "Egresos", value: "$8.000" },
            { label: "Esperado", value: "$170.400" },
          ],
        },
      },
      {
        heading: "Estaciones",
        body: [
          "Un local puede tener barra, terraza o delivery, cada una con su caja.",
          "Configúralas en Caja → Estaciones y elige cuál usas al vender.",
        ],
      },
    ],
  },
  {
    slug: "ventas",
    title: "Ventas",
    summary: "Historial de órdenes, estados, devoluciones y documentos.",
    group: "vender",
    module: "sales",
    audience: ["ops", "admin"],
    icon: "ShoppingBag",
    href: "/sales",
    sections: [
      {
        heading: "Listado",
        body: [
          "Filtra por fecha, estado de pago y tipo de orden.",
          "Abre el detalle para ver líneas, pagos, descuentos y documentos.",
        ],
        example: {
          kicker: "Hoy",
          title: "Venta #1842",
          subtitle: "Mesa 7 · 13:42",
          badge: "Pagada",
          items: ["Efectivo · $9.180", "2 productos · Completos"],
        },
      },
      {
        heading: "Detalle",
        body: [
          "Desde el detalle puedes registrar un cobro pendiente, una devolución o descargar boleta y comanda de cocina cuando el local lo usa.",
          "Unir órdenes: pasa los productos de otras cuentas abiertas a esta. Sirve para mostrador, delivery o mesas (más universal que juntar solo mesas).",
          "Pagar en cuotas: conviertes el saldo en un plan (fechas y montos). Cada cuota se cobra aparte hasta cerrar la orden.",
          "El estado de pago se actualiza al registrar el dinero; no borres una venta cobrada: anula o devuelve según el caso.",
        ],
      },
    ],
  },
  {
    slug: "cotizaciones",
    title: "Cotizaciones",
    summary: "Presupuestos convertibles a orden de venta.",
    group: "vender",
    module: "sales",
    audience: ["ops", "admin"],
    icon: "FileText",
    href: "/quotations",
    sections: [
      {
        heading: "Flujo",
        body: [
          "Crea la cotización con cliente y líneas.",
          "Cuando el cliente acepta, conviértela a orden (venta).",
        ],
        tips: ["Si no ves el PDF, pide al administrador que revise el módulo de documentos."],
      },
    ],
  },

  // ── Local ───────────────────────────────────────────────────────────────
  {
    slug: "mesas",
    title: "Mesas",
    summary: "Estado del salón y cuentas por mesa.",
    group: "local",
    module: "tables",
    audience: ["ops"],
    icon: "Table",
    href: "/tables",
    sections: [
      {
        heading: "Operación",
        body: [
          "Cada mesa muestra si está libre, ocupada o en espera de pago.",
          "Abre o une la cuenta de la mesa con el POS. El cobro cierra la mesa.",
        ],
        tips: ["En hora punta usa la planta virtual para ver el salón de un vistazo."],
        example: {
          kicker: "Salón",
          title: "Mesa 7",
          badge: "Ocupada",
          rows: [
            { label: "Personas", value: "4" },
            { label: "Cuenta", value: "$9.180" },
            { label: "Tiempo", value: "28 min" },
          ],
        },
      },
    ],
  },
  {
    slug: "planta-virtual",
    title: "Planta virtual",
    summary: "Mapa del salón para asignar y mover mesas.",
    group: "local",
    module: "tables",
    audience: ["ops", "admin"],
    icon: "Cuboid",
    href: "/tables/map",
    sections: [
      {
        heading: "Uso",
        body: [
          "La vista Virtual muestra la planta. Arrastra o selecciona mesas según el layout configurado.",
          "Pantalla completa disponible para uso en hostess o tablet de salón.",
        ],
      },
    ],
  },
  {
    slug: "kds",
    title: "KDS — cocina",
    summary: "Pantallas de cocina, estaciones y estados de comanda.",
    group: "local",
    module: "production",
    audience: ["ops"],
    icon: "Monitor",
    href: "/kds",
    sections: [
      {
        heading: "Estaciones",
        body: [
          "Cada estación (plancha, barra, postres) recibe solo sus tickets.",
          "Avanza el plato: recibido → en preparación → listo → entregado.",
        ],
        tips: ["Si un ticket no aparece, revisa que el producto tenga estación de cocina asignada."],
        example: {
          kicker: "Plancha",
          title: "Mesa 7 · #1842",
          badge: "En preparación",
          items: ["Completo italiano × 2", "Sin mayo · extra palta"],
        },
      },
      {
        heading: "Monitor",
        body: [
          "El monitor resume lo listo y lo pendiente para el salón o la expedición.",
          "Úsalo en una pantalla fija; no sustituye el trabajo en la estación de cocina.",
        ],
      },
    ],
  },

  // ── CRM ─────────────────────────────────────────────────────────────────
  {
    slug: "clientes",
    title: "Clientes",
    summary: "Ficha 360: historial, deuda y seguimientos comerciales.",
    group: "crm",
    module: "customers",
    audience: ["ops", "admin"],
    icon: "UserCircle",
    href: "/customers",
    sections: [
      {
        heading: "Ficha 360",
        body: [
          "Abrí un cliente para ver identidad, KPIs, ventas y montos por cobrar.",
          "Desde Pendientes podés cobrar sin salir de la ficha.",
        ],
      },
      {
        heading: "Seguimientos",
        body: [
          "Registrá notas, llamadas y tareas en la pestaña Seguimientos.",
          "Quedan ligados al cliente para el próximo contacto comercial.",
        ],
      },
    ],
  },
  {
    slug: "prospectos",
    title: "Prospectos",
    summary: "Leads antes de convertirse en clientes.",
    group: "crm",
    module: "customers",
    audience: ["ops", "admin"],
    icon: "Users",
    href: "/customers/prospects",
    sections: [
      {
        heading: "Flujo",
        body: [
          "Alta rápida → contactar / calificar → Convertir a cliente.",
          "Al convertir se crea la ficha y podés seguir en Clientes.",
        ],
      },
    ],
  },
  {
    slug: "seguimientos",
    title: "Seguimientos",
    summary: "Notas, llamadas y tareas comerciales.",
    group: "crm",
    module: "customers",
    audience: ["ops", "admin"],
    icon: "FolderKanban",
    href: "/customers/follow-ups",
    sections: [
      {
        heading: "Dónde",
        body: [
          "Hub de abiertos/completados, o pestaña Seguimientos dentro de cada cliente.",
        ],
      },
    ],
  },
  {
    slug: "fichas",
    title: "Fichas de levantamiento",
    summary: "Campos del cliente y el formulario de levantamiento para cotizar.",
    group: "crm",
    module: "customers",
    audience: ["admin", "ops"],
    icon: "FileText",
    href: "/customers/forms",
    sections: [
      {
        heading: "Armar",
        body: [
          "Creá secciones y campos (texto, sí/no, fecha, etc.).",
          "Publicá el levantamiento de la sección: el link queda en Fichas.",
          "Desde el cliente se envía por WhatsApp; al responder, se aplica a la ficha y se cotiza.",
        ],
      },
    ],
  },
  {
    slug: "encuestas",
    title: "Encuestas",
    summary: "Satisfacción NPS y CSAT con link público.",
    group: "crm",
    module: "customers",
    audience: ["ops", "admin"],
    icon: "ClipboardList",
    href: "/customers/surveys",
    sections: [
      {
        heading: "Crear",
        body: [
          "Plantillas NPS (0–10) o CSAT (1–5).",
          "Copiá el link público (QR) o el interno (staff).",
        ],
      },
      {
        heading: "Link",
        body: [
          "Público: sin login (/survey/view?slug=…).",
          "Interno: dentro de la app con sesión y cliente opcional.",
        ],
      },
    ],
  },
  {
    slug: "pipeline",
    title: "Pipeline comercial",
    summary: "Embudo de oportunidades por etapa, con valor y cierre esperado.",
    group: "crm",
    module: "customers",
    audience: ["admin", "ops"],
    icon: "Kanban",
    href: "/customers/pipeline",
    sections: [
      {
        heading: "Mover",
        body: [
          "Arrastrá o usá las flechas ← → de cada tarjeta para cambiar de etapa.",
          "El detalle permite editar valor, cierre esperado y notas (botón lápiz).",
        ],
      },
      {
        heading: "KPIs",
        body: [
          "Total abierto, valor ponderado por probabilidad de etapa y ganado.",
          "Creá oportunidades desde un prospecto con el atajo de la tarjeta.",
        ],
      },
    ],
  },
  {
    slug: "promociones",
    title: "Promociones y descuentos",
    summary: "Cupones, % y reglas aplicables en POS.",
    group: "crm",
    module: "promotions",
    audience: ["admin", "ops"],
    icon: "Percent",
    href: "/promotions/discounts",
    sections: [
      {
        heading: "Configurar",
        body: [
          "Define descuentos por porcentaje, monto o cupón.",
          "Vigencia, sucursal y restricciones de productos según el contrato del backend.",
        ],
      },
      {
        heading: "Aplicar en POS",
        body: [
          "En el cobro, el cajero puede aplicar cupón o descuento de línea/cuenta.",
        ],
      },
    ],
  },

  // ── Catálogo ────────────────────────────────────────────────────────────
  {
    slug: "productos",
    title: "Productos",
    summary: "Catálogo vendible: precios, tipos y disponibilidad.",
    group: "catalogo",
    module: "product_catalog",
    audience: ["admin"],
    icon: "Package",
    href: "/products",
    sections: [
      {
        heading: "Tipos",
        body: [
          "Venta directa, receta, servicio u otros tipos que tenga tu sucursal.",
          "Marca En venta para que el producto salga en el POS y en las cartas públicas.",
        ],
        example: {
          kicker: "Catálogo",
          title: "Completo italiano",
          badge: "En venta",
          rows: [
            { label: "Tipo", value: "Venta directa" },
            { label: "Precio", value: "$4.500" },
            { label: "Categoría", value: "Sandwiches" },
          ],
        },
      },
      {
        heading: "Precios y stock",
        body: [
          "Define precio de venta (y mayorista si aplica) y un mínimo para reponer.",
          "Asocia bodegas y, si compras a un proveedor, déjalo en la ficha.",
        ],
        tips: ["Un producto sin stock en recinto puede venderse igual si no controlas inventario; actívalo si quieres cortar venta al llegar a cero."],
      },
    ],
  },
  {
    slug: "combos-y-modificadores",
    title: "Combos y modificadores",
    summary: "Armados con precio especial y opciones por producto.",
    group: "catalogo",
    module: "product_catalog",
    audience: ["admin"],
    icon: "Boxes",
    href: "/products/combos",
    sections: [
      {
        heading: "Combos",
        body: ["Agrupa productos con precio de combo.", "Se venden como unidad en el POS."],
      },
      {
        heading: "Modificadores",
        body: [
          "Grupos (tamaño, proteína) y opciones con cargo extra.",
          "Se asocian a productos vía product-modifier-groups.",
        ],
      },
    ],
  },
  {
    slug: "categorias",
    title: "Categorías",
    summary: "Organiza el catálogo para POS y menús públicos.",
    group: "catalogo",
    module: "product_catalog",
    audience: ["admin"],
    icon: "Tags",
    href: "/categories",
    sections: [
      {
        heading: "Uso",
        body: [
          "Crea categorías y asigna productos.",
          "El orden y visibilidad impactan cartas digitales y el selector del POS.",
        ],
      },
    ],
  },
  {
    slug: "etiquetado-nutricional",
    title: "Etiquetado nutricional",
    summary: "Tablas nutricionales y PDF de cumplimiento.",
    group: "catalogo",
    module: "nutrition",
    audience: ["admin"],
    icon: "Apple",
    href: "/products/nutrition",
    sections: [
      {
        heading: "Studio",
        body: [
          "Selecciona producto compuesto o insumo y revisa el cálculo nutricional.",
          "Genera vista previa / PDF desde el cliente cuando el backend no entrega PDF nativo.",
        ],
      },
    ],
  },
  {
    slug: "menus-y-vitrinas",
    title: "Menús y vitrinas",
    summary: "Cartas digitales, QR, totems y pedidos públicos.",
    group: "catalogo",
    module: "public_catalog",
    audience: ["admin", "ops"],
    icon: "Store",
    href: "/products/menus",
    sections: [
      {
        heading: "Publicar",
        body: [
          "Configura menú/vitrina, branding y modo (solo lectura, WhatsApp, pago).",
          "Comparte URL o QR. El logo cae al tema de sucursal si no hay branding propio.",
        ],
        tips: ["Ingredientes en carta pública pueden requerir campos del backend."],
      },
    ],
  },
  {
    slug: "bodegas",
    title: "Bodegas (recintos)",
    summary: "Planta de recintos: frío, seco, herramientas y stock por sala.",
    group: "catalogo",
    module: "inventory",
    audience: ["admin", "ops"],
    icon: "Warehouse",
    href: "/warehouses",
    sections: [
      {
        heading: "Planta",
        body: [
          "El hub muestra recintos como salas. Entra a cada uno para ver productos y movimientos.",
          "Frío, seco u otros tipos se distinguen por el color del tema del local.",
        ],
      },
      {
        heading: "Agregar productos",
        body: [
          "Desde el recinto puedes encolar productos y cantidades.",
          "El stock que ves es el de esa sala, no el consolidado de toda la sucursal.",
        ],
      },
    ],
  },
  {
    slug: "inventario",
    title: "Inventario",
    summary: "Stock por bodega, alertas y movimientos.",
    group: "catalogo",
    module: "inventory",
    audience: ["admin", "ops"],
    icon: "ClipboardList",
    href: "/inventory",
    sections: [
      {
        heading: "Operación",
        body: [
          "Consulta existencias, mínimos y puntos de reorden.",
          "Los ingresos por OC actualizan cantidades al recibir.",
        ],
      },
    ],
  },

  // ── Dinero ──────────────────────────────────────────────────────────────
  {
    slug: "pagos",
    title: "Pagos",
    summary: "Transacciones y métodos de pago de la sucursal.",
    group: "dinero",
    module: "payment_methods",
    audience: ["admin", "ops"],
    icon: "Banknote",
    href: "/payments",
    sections: [
      {
        heading: "Uso",
        body: [
          "Revisa pagos registrados (efectivo, tarjeta, transferencia…).",
          "Los métodos disponibles se configuran por sucursal.",
        ],
      },
    ],
  },
  {
    slug: "ingresos-y-egresos",
    title: "Ingresos y egresos",
    summary: "Registro manual de dinero que no viene del POS.",
    group: "dinero",
    module: "finance",
    audience: ["admin"],
    icon: "ArrowDownLeft",
    href: "/revenues",
    sections: [
      {
        heading: "Ingresos",
        body: ["Registra entradas extra (arriendos, aportes) con categoría y fecha."],
      },
      {
        heading: "Egresos",
        body: ["Registra salidas operativas fuera de OC o gastos fijos."],
      },
      {
        heading: "Gastos fijos",
        body: ["Programa gastos recurrentes (arriendo, servicios) en Gastos."],
      },
    ],
  },
  {
    slug: "documentos-tributarios",
    title: "DTE (documentos tributarios)",
    summary: "Boleta o factura electrónica por cada venta, enviada al SII.",
    group: "dinero",
    module: "invoices",
    audience: ["admin"],
    icon: "FileText",
    href: "/tax-documents",
    sections: [
      {
        heading: "Qué es un DTE",
        body: [
          "Es el comprobante electrónico de una venta: boleta (consumidor final) o factura (empresa con RUT).",
          "Se genera desde una orden pagada. El folio sale del CAF cargado en Configuración financiera.",
        ],
      },
      {
        heading: "Cómo se configura",
        body: [
          "En Configuración financiera eliges la app de facturación, y para cada caso (boleta, factura, nota) la función de esa app.",
          "Los CAF, la resolución SII y el certificado se cargan ahí, no en la ficha de sucursal.",
        ],
      },
      {
        heading: "Estados",
        body: [
          "Borrador → Emitido → Enviado al SII → Aceptado o Rechazado.",
          "Un documento ya emitido se anula con una nota de crédito.",
        ],
      },
    ],
  },
  {
    slug: "proveedores-y-oc",
    title: "Proveedores y órdenes de compra",
    summary: "Directorio, OC y recepción de mercadería.",
    group: "dinero",
    module: "suppliers",
    audience: ["admin"],
    icon: "Truck",
    href: "/suppliers",
    sections: [
      {
        heading: "Proveedores",
        body: ["Mantén el directorio con contacto y productos asociados."],
      },
      {
        heading: "Órdenes de compra",
        body: [
          "Crea la OC, envíala y recibe cantidades: el stock de bodega se actualiza al completar.",
          "Estados de la OC siguen las reglas de Yggdra (parcial / completa).",
        ],
      },
    ],
  },
  {
    slug: "billeteras-y-conciliaciones",
    title: "Billeteras y conciliaciones",
    summary: "Cuentas bancarias, saldos y cuadre con cartolas.",
    group: "dinero",
    module: "bank_accounts",
    audience: ["admin"],
    icon: "Wallet",
    href: "/bank-accounts",
    sections: [
      {
        heading: "Billeteras",
        body: ["Registra cuentas y saldos de la organización/sucursal."],
      },
      {
        heading: "Conciliaciones",
        body: ["Cuadra movimientos internos con el extracto bancario."],
      },
    ],
  },
  {
    slug: "config-financiera",
    title: "Configuración financiera",
    summary: "Impuestos y parámetros de dinero de la sucursal.",
    group: "dinero",
    module: "finance",
    audience: ["admin"],
    icon: "Settings",
    href: "/finance/settings",
    sections: [
      {
        heading: "Qué configurar",
        body: [
          "Impuestos, redondeos y preferencias contables expuestas por Yggdra.",
          "Afecta reportes de dinero e ingresos/egresos.",
        ],
      },
    ],
  },

  // ── Informes ────────────────────────────────────────────────────────────
  {
    slug: "informes-ventas",
    title: "Informe de ventas",
    summary: "Ventas por cliente, tipo y día.",
    group: "informes",
    module: null,
    audience: ["admin"],
    icon: "TrendingUp",
    href: "/reports/sales",
    sections: [
      {
        heading: "Filtros",
        body: [
          "Usa rango de fechas y presets del kit de informes.",
          "Exporta CSV/Excel según la pantalla.",
        ],
      },
    ],
  },
  {
    slug: "informe-crm",
    title: "Informe CRM",
    summary: "Prospectos, embudo y acciones del período con deltas.",
    group: "informes",
    module: "customers",
    audience: ["admin"],
    icon: "Users",
    href: "/reports/crm",
    sections: [
      {
        heading: "Pestañas",
        body: [
          "Resumen con KPIs vs. período anterior, Embudo por etapa, Acciones y Hallazgos.",
          "Hallazgos enlazan directo a la pantalla para resolver cada problema.",
        ],
      },
      {
        heading: "Exportar",
        body: [
          "Botón Exportar CSV: resumen, embudo, estados, fuentes y acciones.",
          "Los KPIs se calculan en el servidor (sin límite de registros).",
        ],
      },
    ],
  },
  {
    slug: "informes-dinero",
    title: "Informes de dinero",
    summary: "Ingresos, gastos y flujo de caja consolidado.",
    group: "informes",
    module: null,
    audience: ["admin"],
    icon: "Wallet",
    href: "/reports/money",
    sections: [
      {
        heading: "Pantallas",
        body: [
          "Ingresos y Gastos detallan categorías.",
          "Dinero une pagos, orígenes, ingresos y egresos del período.",
        ],
      },
    ],
  },
  {
    slug: "informe-nutricional",
    title: "Informe nutricional",
    summary: "Compuestos, insumos y cálculo nutricional.",
    group: "informes",
    module: "nutrition",
    audience: ["admin"],
    icon: "Apple",
    href: "/reports/nutrition",
    sections: [
      {
        heading: "Uso",
        body: [
          "Analiza productos compuestos e insumos.",
          "Complementa el studio de etiquetado en Catálogo.",
        ],
      },
    ],
  },

  // ── Ajustes ─────────────────────────────────────────────────────────────
  {
    slug: "organizacion",
    title: "Organización",
    summary: "Holding, planes de venta y planes de módulos.",
    group: "ajustes",
    module: "config",
    audience: ["admin"],
    icon: "Building2",
    href: "/organization",
    sections: [
      {
        heading: "Qué gestionas",
        body: [
          "Datos de la organización y sucursales asociadas.",
          "Superadmin: editor de planes de venta (GroupPlan) y planes de módulos.",
        ],
      },
    ],
  },
  {
    slug: "usuarios",
    title: "Usuarios",
    summary: "Altas, roles por sucursal y desactivación.",
    group: "ajustes",
    module: "config",
    audience: ["admin"],
    icon: "UserIcon",
    href: "/users",
    sections: [
      {
        heading: "Asignación",
        body: [
          "Crea o invita personas y asígnales un rol en cada sucursal.",
          "Un mismo correo puede ser cajero en un local y garzón en otro.",
        ],
        tips: ["Desactiva en vez de borrar si la persona deja de trabajar: se conserva el historial de ventas."],
      },
    ],
  },
  {
    slug: "sucursales",
    title: "Sucursales",
    summary: "Alta de locales, plan aplicado y equipo.",
    group: "ajustes",
    module: "config",
    audience: ["admin"],
    icon: "Store",
    href: "/branches",
    sections: [
      {
        heading: "Ficha",
        body: [
          "Nombre comercial, dirección y preferencias.",
          "El plan de módulos define qué ve el equipo. El dueño contrata planes comerciales desde Suscripción.",
        ],
      },
    ],
  },
  {
    slug: "modulos",
    title: "Módulos",
    summary: "Activa o apaga capacidades por sucursal.",
    group: "ajustes",
    module: "config",
    audience: ["admin"],
    icon: "Settings",
    href: "/settings/modules",
    sections: [
      {
        heading: "Efecto",
        body: [
          "Un módulo apagado oculta su ruta en el menú.",
          "Algunos dependen de otros: Caja necesita POS activo.",
        ],
        tips: ["El plan contratado limita qué módulos puedes encender."],
      },
    ],
  },

  // ── Ayuda ───────────────────────────────────────────────────────────────
  {
    slug: "suscripcion",
    title: "Suscripción",
    summary: "Planes comerciales, candado sin plan y contratación.",
    group: "ayuda",
    module: null,
    audience: ["admin"],
    icon: "CreditCard",
    href: "/profile",
    sections: [
      {
        heading: "Reglas",
        body: [
          "La suscripción es por sucursal. Sin plan activo puedes usar Perfil, Ayuda y Soporte.",
          "El propietario contrata o cambia plan pagando desde Perfil → Suscripción.",
          "Cancelar el plan apaga los módulos extra; el local queda bloqueado hasta un nuevo pago.",
        ],
        tips: ["Elige el plan en la parrilla y pulsa Contratar. Se activa cuando el pago se confirma."],
        example: {
          kicker: "Perfil · Suscripción",
          title: "Plan mensual",
          badge: "Activo",
          rows: [
            { label: "Local", value: "Macanuo Bowl" },
            { label: "Precio", value: "2,5 UF" },
            { label: "Término", value: "15 oct 2026" },
          ],
        },
      },
    ],
  },
  {
    slug: "solicitudes-soporte",
    title: "Soporte",
    summary: "Casos del local: incidencias, dudas, ideas, visitas técnicas y plazos.",
    group: "ayuda",
    module: null,
    audience: ["ops", "admin"],
    icon: "FolderKanban",
    href: "/support",
    sections: [
      {
        heading: "Para qué sirve",
        body: [
          "Soporte es el canal del equipo del local con el equipo de atención: un problema, una duda, una idea o un pedido de manual.",
          "Vive en Ayuda → Soporte. Cada caso tiene tablero, hilo, adjuntos y plazos.",
        ],
        limits: [
          "No es un chat de clientes finales ni un helpdesk de otro producto.",
          "No sustituye las guías de uso ni la consola API.",
        ],
      },
      {
        heading: "Qué puedes pedir",
        body: [
          "Incidencia: algo no funciona (cobro, stock, pantalla).",
          "Duda: cómo hacer una operación en la app.",
          "Feedback: una mejora o un comentario.",
          "Manual: pedir o aclarar una guía.",
        ],
        tips: ["Una captura o un PDF del error acorta la respuesta."],
        example: {
          kicker: "Nuevo caso",
          title: "Incidencia",
          subtitle: "El POS no cobra con tarjeta en Mesa 7.",
          badge: "Alta",
          rows: [
            { label: "Asunto", value: "[Incidencia] Cobro con tarjeta" },
            { label: "Adjunto", value: "captura-pos.png" },
          ],
        },
      },
      {
        heading: "Cómo abrir y seguir un caso",
        body: [
          "Elige el tipo, escribe asunto y descripción, adjunta archivos si hace falta y envía.",
          "El caso aparece en el tablero. Ábrelo para ver el hilo (no es una ventana encima de todo).",
          "Puedes agregar más información y archivos mientras el caso está abierto.",
          "Cuando se resuelve, evalúa con estrellas y un comentario.",
        ],
        tips: [
          "El enlace con el identificador del caso abre siempre el mismo hilo.",
          "Sin plan activo igual puedes usar Soporte, junto con Perfil y Ayuda.",
        ],
      },
      {
        heading: "Tablero, visita y plazos",
        body: [
          "Columnas: abierto, en curso, visita pendiente, en espera y cerrado.",
          "Si hace falta una visita técnica, el caso pasa a visita pendiente y ves la agenda (fecha y estado de la orden de trabajo).",
          "En el detalle aparecen el plazo de primera respuesta y el de cierre.",
        ],
        limits: [
          "No se configuran políticas de plazo ni agentes desde esta pantalla: eso lo opera el equipo que atiende.",
          "Los comentarios internos del equipo que atiende no se muestran al solicitante.",
        ],
        example: {
          kicker: "Tablero",
          title: "#184 · POS no cobra con tarjeta",
          badge: "Visita pendiente",
          rows: [
            { label: "Primera respuesta", value: "Hoy 16:00" },
            { label: "Visita", value: "Mañana 10:30 · en ruta" },
          ],
        },
      },
    ],
  },
  {
    slug: "documentacion-ayuda",
    title: "Cómo usar esta documentación",
    summary: "Guías de producto + contrato API en el menú Ayuda.",
    group: "ayuda",
    module: null,
    audience: ["ops", "admin", "dev"],
    icon: "BookOpen",
    href: "/help",
    sections: [
      {
        heading: "Mapa",
        body: [
          "Guías de uso: cómo opera cada pantalla, por rol.",
          "API para integrar: consola y alcance de lo que la app ya hace en el local.",
          "Soporte: casos del equipo (problemas, dudas, ideas, visitas).",
        ],
        tips: ["La consola API no lista secretos ni funciones que la app no usa."],
      },
    ],
  },

  // ── Integraciones ───────────────────────────────────────────────────────
  {
    slug: "integraciones-api",
    title: "Integraciones con la API",
    summary: "Alcance de la app: qué puedes automatizar y cómo hacerlo sin depender de otra persona.",
    group: "integraciones",
    module: null,
    audience: ["dev", "admin"],
    icon: "Code2",
    href: "/help/api",
    sections: [
      {
        heading: "Qué cubre esta API",
        body: [
          "Las mismas funciones que usa la app en el local: vender, catálogo, stock, dinero, sucursal y marca.",
          "Sirve para un totem, un canal propio, un reporte o un conector. Tú eliges el área en la consola, copias la ruta, el JSON y el curl.",
        ],
        limits: [
          "No documentamos productos de la plataforma que la app no usa (agentes, IoT, otros verticales).",
          "No aparecen claves, reset de acceso, certificados ni administración de planes de plataforma.",
          "Los casos con personas se atienden en Ayuda → Soporte, no por esta consola.",
        ],
      },
      {
        heading: "Cómo trabajar en autonomía",
        body: [
          "Entra con un usuario del local (el mismo de siempre). Guarda el token.",
          "En cada llamada manda el token y el id de sucursal. Así ves solo ese local.",
          "Abre Ayuda → API para integrar → elige el área → filtra Leer o Crear → abre el detalle.",
          "Copia la URL, el ejemplo JSON (si es crear o actualizar) y el curl. Pégalo en tu cliente y ajusta ids reales.",
        ],
        tips: [
          "Si el módulo está apagado en la app, la API responde que no tienes permiso: enciéndelo en Módulos o elige otra función.",
          "Los listados vienen en páginas (results, count, next).",
        ],
        example: {
          kicker: "Consola · Ventas",
          title: "Crear un pedido",
          badge: "Crear",
          subtitle: "Clic en el JSON para copiarlo. Cambia mesa y productos por los de tu local.",
          code: `{
  "table": 7,
  "items": [
    { "product": "Completo italiano", "qty": 2 }
  ]
}`,
        },
      },
      {
        heading: "Mapa rápido",
        body: [
          "Ventas: pedidos, cobros, mesas, cocina, cotizaciones.",
          "Inventario: productos, combos, categorías, recintos, stock, órdenes de compra.",
          "Recetas y nutrición: fichas y etiquetado.",
          "Finanzas, bancos, facturación y promociones: caja, movimientos, documentos y cupones.",
          "Sucursales y usuarios: locales, tema visual y equipo (sobre todo lecturas).",
        ],
      },
    ],
  },
  {
    slug: "api-ventas-pos",
    title: "API: ventas y salón",
    summary: "Lo que la app hace al vender: pedido, cobro, mesa y cocina.",
    group: "integraciones",
    module: "sales",
    audience: ["dev"],
    icon: "Code2",
    href: "/help/api",
    sections: [
      {
        heading: "Qué puedes hacer",
        body: [
          "Crear un pedido, agregar líneas (producto, combo, opciones), consultar el historial.",
          "Registrar un cobro. El dinero entra a la caja abierta de esa estación, igual que en el POS.",
          "Leer mesas (libre, ocupada, por pagar) y tickets de cocina (recibido, en preparación, listo).",
          "Crear o convertir cotizaciones, como en la pantalla de Cotizaciones.",
        ],
        example: {
          kicker: "Tu canal · mismo pedido que el POS",
          title: "Mesa 7",
          badge: "Pagada",
          items: ["Completo italiano × 2 · $9.000", "Bebida 350 ml · $1.200"],
          total: "$10.200",
        },
        limits: [
          "Sin caja abierta el cobro falla: ábrela en la app o replica el flujo de Caja en Finanzas.",
          "No inventes estados de pedido que la app no muestra. Sigue los del detalle de Ventas.",
        ],
      },
      {
        heading: "En la consola",
        body: [
          "Área Ventas. Filtra Crear para altas y Leer para consultas.",
          "Copia el JSON del detalle; cambia sucursal, mesa, producto e importes por datos reales.",
        ],
        tips: ["Promociones y cupones se aplican como en el POS: área Promociones, si el módulo está activo."],
      },
    ],
  },
  {
    slug: "api-inventario",
    title: "API: catálogo e inventario",
    summary: "Productos, cartas, recintos, stock y compras que la app ya opera.",
    group: "integraciones",
    module: "inventory",
    audience: ["dev"],
    icon: "Code2",
    href: "/help/api",
    sections: [
      {
        heading: "Qué puedes hacer",
        body: [
          "Leer y mantener productos, categorías, combos y modificadores (las mismas fichas del catálogo).",
          "Consultar recintos y existencias por sala. Recibir una orden de compra actualiza el stock, como en la app.",
          "Leer recetas y datos de etiquetado si esos módulos están activos.",
          "Publicar o leer cartas/vitrinas públicas (modos vitrina, pedir, pagar) que ya usa Menús.",
        ],
        limits: [
          "El stock es de la sucursal del encabezado, no el consolidado de toda la organización.",
          "No crees tipos de producto que el plan del local no permite.",
        ],
      },
      {
        heading: "En la consola",
        body: [
          "Áreas Inventario, Recetas y Nutrición.",
          "Para cartas públicas usa las rutas de catálogo que aparecen al filtrar el área Inventario.",
        ],
      },
    ],
  },
  {
    slug: "api-sucursal-y-marca",
    title: "API: sucursal, equipo y marca",
    summary: "Locales, colores, logo y usuarios que la app ya muestra.",
    group: "integraciones",
    module: "config",
    audience: ["dev"],
    icon: "Code2",
    href: "/help/api",
    sections: [
      {
        heading: "Qué puedes hacer",
        body: [
          "Leer las sucursales del usuario y el tema (colores, logo, textos de marca).",
          "Consultar el equipo asignado al local.",
        ],
        limits: [
          "Altas de usuario, certificados tributarios y cambio de clave se hacen en la app, no desde un conector.",
          "Encender o apagar módulos es de Ajustes en la app; la API respeta ese estado.",
        ],
      },
      {
        heading: "En la consola",
        body: [
          "Áreas Sucursales y Usuarios. Quédate en lecturas salvo que tu flujo replique una pantalla de la app.",
        ],
      },
    ],
  },
  {
    slug: "api-dinero-y-planes",
    title: "API: dinero y contratación",
    summary: "Caja, movimientos, documentos, cupones y planes que la app ya cobra.",
    group: "integraciones",
    module: null,
    audience: ["dev"],
    icon: "Code2",
    href: "/help/api",
    sections: [
      {
        heading: "Dinero del local",
        body: [
          "Caja: abrir, movimientos, cierre y estaciones (igual que Caja en la app).",
          "Ingresos, egresos y gastos fijos. Billeteras y conciliaciones bancarias.",
          "Documentos tributarios si el módulo de facturación está activo.",
          "Descuentos y cupones del POS (área Promociones).",
        ],
        limits: [
          "No operes impuestos ni certificados SII fuera de lo que la pantalla de la app permite.",
        ],
      },
      {
        heading: "Planes",
        body: [
          "Ver precios públicos de la landing. Contratar o cambiar el plan de un local existente lo hace el propietario en la app (pago autenticado).",
        ],
        limits: [
          "No uses contratación pública para un local que ya existe: eso crea otra organización.",
          "No administres el catálogo de planes de plataforma desde tu conector.",
        ],
      },
    ],
  },
];

export function getHelpGuide(slug: string): HelpGuide | undefined {
  return HELP_GUIDES.find((g) => g.slug === slug);
}

export function helpGuidesForAudience(audience?: HelpGuideAudience): HelpGuide[] {
  if (!audience) return HELP_GUIDES;
  return HELP_GUIDES.filter((g) => g.audience.includes(audience));
}

export function helpGuidesByGroup(group: HelpGuideGroup): HelpGuide[] {
  return HELP_GUIDES.filter((g) => g.group === group);
}

export function helpGuideCount(): number {
  return HELP_GUIDES.length;
}

export type HelpSearchHit = {
  slug: string;
  title: string;
  summary: string;
  group: HelpGuideGroup;
  snippet: string;
  score: number;
};

function guideHaystack(g: HelpGuide): string {
  const parts = [g.title, g.summary, g.slug.replace(/-/g, " ")];
  for (const s of g.sections) {
    parts.push(s.heading, ...s.body);
    if (s.tips) parts.push(...s.tips);
    if (s.limits) parts.push(...s.limits);
    if (s.example) {
      parts.push(s.example.title, s.example.subtitle ?? "", s.example.kicker ?? "");
    }
  }
  const group = HELP_GUIDE_GROUPS.find((x) => x.id === g.group);
  if (group) parts.push(group.label, group.description);
  return parts.join("\n").toLowerCase();
}

function snippetAround(hay: string, token: string): string {
  const i = hay.indexOf(token);
  if (i < 0) return "";
  const start = Math.max(0, i - 40);
  const end = Math.min(hay.length, i + token.length + 72);
  return hay.slice(start, end).replace(/\s+/g, " ").trim();
}

/** Busca en el catálogo de guías (título, cuerpo, tips). Sin mínimo de letras. */
export function searchHelpGuides(query: string, limit = 12): HelpSearchHit[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return [];

  const hits: HelpSearchHit[] = [];
  for (const g of HELP_GUIDES) {
    const hay = guideHaystack(g);
    let score = 0;
    let snippet = "";
    for (const t of tokens) {
      if (!hay.includes(t)) {
        score = -1;
        break;
      }
      const title = g.title.toLowerCase();
      const summary = g.summary.toLowerCase();
      if (title === t) score += 12;
      else if (title.includes(t)) score += 8;
      if (summary.includes(t)) score += 3;
      score += 1;
      if (!snippet) snippet = snippetAround(hay, t);
    }
    if (score < 0) continue;
    hits.push({
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      group: g.group,
      snippet: snippet || g.summary,
      score,
    });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
