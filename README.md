<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/chef-hat.svg" alt="FRIG Logo" width="80" height="80">
  <h1 align="center">FRIG POS</h1>
  <p align="center">
    <strong>El punto de venta gastronómico que no te hace pelear con la tecnología.</strong>
  </p>
  <p align="center">
    <a href="#qué-hace-frig">Características</a> •
    <a href="#tecnología">Tecnología</a> •
    <a href="#desarrollo">Desarrollo</a> •
    <a href="#próximos-pasos">Próximos Pasos</a>
  </p>
</div>

---

**FRIG** es un POS (*Point of Sale*) multi-tenant y white-label diseñado para restaurantes, cafeterías, locales de comida rápida y cualquier negocio gastronómico que necesite operar sin fricciones. Nace con una misión clara: ser rápido, táctil y ridículamente fácil de usar.

## 🍔 ¿Qué hace FRIG?

- **Multi-sucursal en una sola cuenta:** Cada cajero puede operar el punto de venta de la sucursal que le corresponda.
- **Identidad White-Label:** Logo, colores primarios y mensajes se configuran por sucursal. Cada local se siente como un software a medida.
- **Checkout Rápido y Táctil:** Búsqueda rápida, carrito dinámico, ajuste de cantidades y cobro en milisegundos.
- **Gestión Simplificada:** Creación de productos, precio, costo y stock inicial. Activación o desactivación de ítems según demanda.
- **Cierre Eficiente:** Múltiples métodos de pago integrados (efectivo, tarjeta, transferencias, etc) gestionados a nivel de caja.

## 🛠 Tecnología

Construido con un stack de vanguardia para asegurar la máxima fluidez en dispositivos de baja y alta gama.

| Capa | Herramienta |
|------|-------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Estilos** | Tailwind CSS v4 |
| **Animación** | Framer Motion (Transiciones fluidas a 60fps) |
| **Estado** | Zustand + Persistencia en `localStorage` |
| **Datos** | TanStack Query (Caché y Server State) |
| **Backend** | API Yggdra (Django REST Framework) |

---

## 💻 Desarrollo

La aplicación web ha sido reestructurada para operar directamente desde la raíz del repositorio, simplificando los flujos de despliegue y desarrollo.

### Estructura de Carpetas
```
frig/
├── app/             # Rutas y páginas de Next.js (App Router)
├── components/      # Componentes UI (ui/ compartidos, landing/, pos/, etc)
├── lib/             # Integración con Yggdra API, hooks, utilidades y estado
├── content/         # Copys y contenido estático
├── docs/            # Documentación profunda y mapas del proyecto
└── public/          # Assets estáticos (imágenes, fuentes, runas)
```

### Levantando el Proyecto

**Requisitos previos:**
- Node.js 20+ (se recomienda `nvm`)
- La API Yggdra corriendo en Docker (`yggdra-light-api`) en el puerto `:8000`.

**Ejecución:**
```bash
# 1. Instalar dependencias
npm install

# 2. Levantar servidor local
npm run dev
```

El POS estará disponible en [http://localhost:3000](http://localhost:3000).

**Credenciales de Prueba:**
- **Email:** `admin@example.com`
- **Password:** `admin123`
*(Por defecto ingresará a la sucursal "Bizantni Gelato", permitiendo probar el sistema de theming white-label).*

### Comandos Útiles

```bash
npm run lint         # Auditoría de código con ESLint
npm run type-check   # Verificación estricta de TypeScript
npm run build        # Compilar para producción en Vercel / Node
```

## 🔐 Detalles de Arquitectura

- **Autenticación stateless:** Emplea `localStorage` para persistir el token (`frig.token`) y la sesión (`frig.session`).
- **Contexto de sucursal:** Cada request incluye el header `X-Branch-ID` asegurando segregación de datos.
- **Stock Predictivo:** El backend Yggdra valida inventario en cada venta para prevenir quiebres de stock.

## 🚀 Próximos Pasos

El producto se encuentra en evolución continua. El roadmap actual incluye:

- [ ] **Impresión Ticked / Comandas:** Soporte para impresoras térmicas ESC/POS (80mm).
- [ ] **KDS (Kitchen Display System):** Pantalla de comandas para la cocina.
- [ ] **Dashboards:** Analítica de ventas multi-sucursal en tiempo real.
- [ ] **Propinas y Descuentos:** Flexibilidad de cobro en mesa.
- [ ] **Modo Offline:** Persistencia con `IndexedDB` y `Workbox` para ventas sin conexión.

---

<div align="center">
  <sub>Construido con la idea de que operar un restaurante debería ser tan simple como atender una mesa.</sub>
</div>