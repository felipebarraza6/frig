# FRIG

El punto de venta gastronómico que no te hace pelear con la tecnología.

FRIG es un POS multi-tenant y white-label pensado para restaurantes, cafeterías, locales de comida rápida y cualquier negocio gastronómico que necesite vender sin complicaciones. Nace con una misión clara: ser facil de usar.
## ¿Qué hace FRIG?

- **Varias sucursales, una sola cuenta.** Cada usuario puede operar el punto de venta de la sucursal que le corresponda, con su propio tema y branding.
- **Tema white-label por sucursal.** Logo, colores primarios y mensajes de bienvenida se configuran por branch, así cada local se siente propio.
- **POS rápido y táctil.** Busca productos, agrégalos al carrito, ajusta cantidades y cobra en segundos.
- **Gestión de productos sencilla.** Crea productos, define precio, costo y stock inicial; activa o desactiva ítems según necesites.
- **Cobro completo.** Registra ventas como órdenes y ciérralas con el método de pago que elijas: efectivo, tarjeta, etc.
- **Backend robusto.** Se conecta a la API Yggdra (Django) para autenticación, catálogo, ventas, pagos y temas.

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TypeScript |
| Estado | Zustand + persistencia en localStorage |
| Datos | TanStack Query (React Query) |
| Movimiento | Framer Motion |
| Iconos | Lucide React |
| Backend | API Yggdra (Django REST, corre en Docker) |

## Estructura del repo

```
frig/
├── apps/web/        # Aplicación principal del POS
├── docs/            # Documentación y mapas del proyecto
├── legacy/          # Referencias locales (no se suben)
└── .omo/            # Estado de sesiones locales (no se sube)
```

El frontend vive en `apps/web/` y consume directamente la API Yggdra corriendo en `http://localhost:8000`.

## Cómo levantar el proyecto

Requisitos:

- Node 20+ (se recomienda usar `nvm`)
- La API Yggdra corriendo en Docker (`yggdra-light-api`)

Pasos:

```bash
cd apps/web
nvm use 20
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y prueba con:

- Correo: `admin@example.com`
- Contraseña: `admin123`

La primera sucursal configurada es **Clínica WM Odontología** (sucursal 5), así que el tema, logo y colores que veas corresponden a ella.

## Comandos útiles

```bash
# Revisar estilo
npx eslint .

# Verificar tipos
npx tsc --noEmit

# Build de producción
npx next build
```

> Nota: aunque `bun` aparece como package manager del proyecto, actualmente `next build` puede fallar con Bun. Usa Node 20 para builds estables.

## QA y flujo completo

El proyecto incluye verificación de punta a punta:

1. **Lint + TypeScript + Build** pasan sin errores.
2. **Flujo E2E** (producto → venta → pago) se valida con un script de Playwright que crea un producto, lo vende en el POS y registra el pago.

## Detalles técnicos importantes

- La autenticación usa `localStorage` para el token (`frig.token`) y el store persistido de Zustand (`frig.session`).
- Cada request al backend lleva `Authorization: Token <key>` y el header `X-Branch-ID` de la sucursal activa.
- Los cambios en el backend Yggdra requieren `docker restart yggdra-light-api` porque Gunicorn carga con `--preload`.
- El formulario de productos envía `quantity` como stock inicial, necesario porque el backend valida stock en cada venta.

## Próximos pasos sugeridos

- Impresión de comandas/tickets.
- Panel de cocina (KDS).
- Dashboard de ventas por sucursal.
- Soporte para propinas y descuentos.
- Modo offline con sincronización.

---

Construido con la idea de que operar un restaurante debería ser tan simple como atender una mesa.