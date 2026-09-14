<div align="center">
  <img src="public/icons/logo-horizontal.png" alt="FRIG" width="360">
  <p align="center">
    <strong>El sistema operativo gastronómico que vive en la web.</strong><br/>
    Punto de venta, cocina, mesas, inventario y finanzas — en una sola plataforma multi-sucursal y white-label.
  </p>
  <p align="center">
    <a href="https://frig.yggdra.cl"><strong>🌐 frig.yggdra.cl</strong></a> ·
    <a href="#-capacidades">Capacidades</a> ·
    <a href="#-rendimiento">Rendimiento</a> ·
    <a href="#-multicanal-y-multi-dispositivo">Multicanal</a> ·
    <a href="#-tecnología">Tecnología</a> ·
    <a href="#-desarrollo">Desarrollo</a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/deploy-producci%C3%B3n-success" alt="Deploy" />
    <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js 16" />
    <img src="https://img.shields.io/badge/React-19-blue" alt="React 19" />
    <img src="https://img.shields.io/badge/build-est%C3%A1tico_(CDN_ready)-orange" alt="Static" />
  </p>
</div>

---

FRIG es el ERP gastronómico que corre 100% en el navegador: sin instaladores, sin servidores locales, sin licencias por caja. Abres una pestaña en cualquier dispositivo y tienes un punto de venta listo para operar. Cada sucursal opera con su propia marca (white-label), sus propios módulos activados a la carta y su propio equipo, mientras el dueño controla todo desde una sola cuenta.

> **Pruébalo en vivo → [frig.yggdra.cl](https://frig.yggdra.cl)**

## ✨ Capacidades

### 🛒 Venta (POS)
- **Punto de venta táctil** con búsqueda instantánea, carrito dinámico y checkout en segundos.
- **Caja y cierre de turno** con múltiples métodos de pago: efectivo, tarjeta, transferencia y billeteras.
- **Cotizaciones y ventas** con histórico completo por sucursal.
- **Promociones y clientes**: fidelización, descuentos y perfiles de compra.

### 🔥 Cocina y salón
- **Pantalla de cocina (KDS)** y flujo de producción de pedidos.
- **Gestión de mesas y mapa de mesas** interactivo para servicio en salón.

### 📦 Catálogo e inventario
- **Productos, combos, modificadores y categorías** con fotos, códigos y precios por sucursal.
- **Recetas**: el stock de un plato se calcula automáticamente desde sus ingredientes — el POS siempre muestra disponibilidad real.
- **Bodegas, inventario y movimientos** con alertas de stock bajo y quiebre, exportables a Excel/PDF.
- **Proveedores y órdenes de compra** con recepción de mercadería.

### 💰 Finanzas
- **Ingresos, egresos y gastos fijos** con configuración tributaria (boletas, facturas, SII en Chile).
- **Billeteras y conciliaciones bancarias**: cuadra los movimientos del negocio contra el banco.

### 🥗 Menú digital y nutrición
- **Menús digitales públicos** con el branding de cada sucursal.
- **Etiquetado e informes nutricionales** por producto — listo para normativa de etiquetado.

### 🏢 Gestión multi-sucursal
- **Organización, usuarios y roles por sucursal** (propietario, administrador, cajero, cocina…) con permisos granulares.
- **Módulos activables a la carta** por sucursal: cada local enciende solo lo que usa.
- **Super admin**: gestión de organizaciones y planes por organización, con white-label total — cada sitio desplegado (frig.yggdra.cl, intranet.macanuobowl.cl, mani.agenciapatagoniachile.com) es la misma app con la marca de su cliente.

## ⚡ Rendimiento

La velocidad no es un detalle: es la diferencia entre cobrar una mesa o perderla.

- **Build 100% estático (SSG)**: la app completa se exporta a HTML/JS y se sirve desde hosting con CDN. Sin cold starts, sin servidores que caer en la hora punta.
- **Interacciones a 60 fps** con transiciones fluidas (Framer Motion), pensadas para tablets de gama baja en un salón con WiFi mediocre.
- **Caché de datos inteligente** (TanStack Query): el catálogo y el stock se sienten instantáneos; las mutaciones invalidan solo lo necesario.
- **Estado local persistente** (Zustand + localStorage): sesión, sucursal activa y preferencias sobreviven a recargas y cortes de red.
- **CI/CD con gates de calidad**: lint + type-check + build en cada PR, y deploy atómico a producción con la misma batería de verificaciones.

## 📱 Multicanal y multi-dispositivo

Un mismo sistema, todos los formatos de trabajo:

- **Tablet y touch**: el POS está diseñado táctil primero — botones grandes, gestos, cero teclado.
- **Escritorio**: la gestión administrativa (finanzas, inventario, catálogo) aprovecha pantallas grandes con tablas y filtros completos.
- **Móvil**: consulta de métricas y operaciones clave desde el bolsillo.
- **Cliente final**: menú digital público con la marca de la sucursal, sin app que instalar.
- **Multi-tenant por diseño**: cada request viaja con el contexto de sucursal (`X-Branch-ID`), así que una misma URL sirve negocios completamente distintos.

## 🛠 Tecnología

| Capa | Herramienta |
|------|-------------|
| **Frontend** | Next.js 16 (App Router, output estático), React 19, TypeScript estricto |
| **Estilos** | Tailwind CSS v4 + theming white-label por CSS custom properties |
| **Animación** | Framer Motion (transiciones a 60 fps) |
| **Estado** | Zustand (persistencia en `localStorage`) + TanStack Query (server state) |
| **Iconografía** | Lucide |
| **Backend** | API Yggdra (Django REST Framework), multi-tenant |
| **CI/CD** | GitHub Actions → deploy FTP a 3 hostings de producción |

## 💻 Desarrollo

### Estructura de carpetas
```
frig/
├── src/app/         # Rutas y páginas (App Router)
├── src/components/  # UI compartida (ui/), POS, branches, landing, etc.
├── src/lib/         # Cliente de API Yggdra, hooks, stores y utilidades
├── src/content/     # Copys y contenido estático
├── docs/            # Auditorías y documentación profunda
└── public/          # Assets estáticos
```

### Levantando el proyecto

**Requisitos previos:**
- Node.js 20+ (se recomienda `nvm`)
- La API Yggdra corriendo localmente en `:8000` (repo `yggdra_infra`)

```bash
npm install
npm run dev        # http://localhost:3000
```

### Comandos

```bash
npm run lint         # ESLint
npm run type-check   # TypeScript estricto
npm run build        # Build de producción (export estático)
```

### CI/CD

- **CI** (`.github/workflows/ci.yml`): lint + type-check + build en cada push a branches y PRs. No despliega.
- **Deploy** (`.github/workflows/deploy.yml`): al pushear `master`, los mismos gates y luego FTP atómico a los tres hostings de producción.

## 🔐 Detalles de arquitectura

- **Autenticación stateless**: token y sesión persistidos en `localStorage` (`frig.token`, `frig.session`).
- **Contexto de sucursal obligatorio**: cada request incluye el header `X-Branch-ID`, garantizando segregación total de datos entre tenants.
- **Theming white-label**: colores, logo y mensajes se resuelven por sucursal y se inyectan como variables CSS al arrancar — sin rebuilds por cliente.
- **Rutas dinámicas en hosting estático**: el build genera `.htaccess` (scripts/post-export.mjs) para servir la app correctamente en Apache.

---

<div align="center">
  <sub><strong>FRIG</strong> — operar un restaurante debería ser tan simple como atender una mesa.</sub>
  <br/>
  <sub><a href="https://frig.yggdra.cl">frig.yggdra.cl</a></sub>
</div>
