# Mapa de API Yggdra — Frig v1

> Fuente: `legacy/yggdra_infra` rama `dev` (Django 6.0.1 + DRF 3.16 + drf_spectacular).  
> Fecha del mapeo: 2026-08-10

## 1. Stack y convenciones

- **Base URL**: `http://localhost:8000/api/`
- **Auth**: DRF Token (`rest_framework.authtoken`), no JWT. El login devuelve una cookie `auth_token` HttpOnly; también se puede enviar header `Authorization: Token <key>`.
- **Branch (sucursal)**: se selecciona via header `X-Branch-ID` (entero o UUID). El middleware `BranchMiddleware` resuelve `request.branch`. Si no se envía, usa la sucursal por defecto del usuario.
- **Multi-tenant**: `BranchModelApi` agrega `branch`, `is_active`, `created`, `modified` a todos los modelos de negocio. `ERPBaseViewSet` filtra automáticamente por sucursal, oculta inactivos y hace soft-delete.
- **OpenAPI**: `/api/schema/` y `/api/docs/` en DEBUG. Ideal para generar tipos TypeScript con `openapi-typescript`.
- **Soft-delete**: DELETE hace `is_active=False`. Para incluir inactivos usar `?show_inactive=true` o `?include_inactive=true`.

## 2. Autenticación y sesión

| Método | Endpoint | Notas |
|--------|----------|-------|
| POST | `/api/accounts/users/login/` | Devuelve `user` (UserResponseSerializer) y setea cookie `auth_token`. |
| POST | `/api/accounts/users/login_complete/` | **Recomendado para Frig**. Devuelve `token`, `user` (con `branch_assignments`, `is_multi_branch`, `type_user`), `branches`, `owned_organizations` y `permissions.enabled_apps`. |
| POST | `/api/accounts/users/logout/` | Borra token y cookie. |
| GET/POST/... | `/api/accounts/users/` | CRUD usuarios. |

Header necesario en cada request autenticada:
```http
Authorization: Token <token_key>
X-Branch-ID: <branch_id>
```

## 3. Sucursal, organización y theming

### 3.1 Branch
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET/POST | `/api/branches/` | Lista/crea sucursales (registrar al final del router). |
| GET/PATCH/PUT/DELETE | `/api/branches/{id}/` | CRUD sucursal. |
| GET/POST | `/api/branches/organizations/` | Organizaciones (holdings). |
| GET/POST | `/api/branches/users/` | Asignaciones usuario↔sucursal (`BranchUser`). |
| GET/POST | `/api/branches/roles/` | Definiciones de rol por sucursal. |

### 3.2 Tema / white-label
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET/POST/PATCH | `/api/branches/themes/` | `BranchThemeConfig`: logo, favicon, banner, colores HEX (`primary_color`, `secondary_color`), `app_name`, `tagline`, `algorithm` (light/dark), `motion`, `compact`, `borderRadius`, `font_size`, `social_links`, `login_welcome_message`, etc. |
| GET/POST/PATCH | `/api/branches/pos-config/` | `BranchPOSConfig`: `show_price_in_selector`, `show_product_images`, `require_branch_selection`, etc. |
| GET/POST/PATCH | `/api/branches/modules/` | `BranchModuleConfiguration`: habilitar/deshabilitar módulos por sucursal (`pos`, `products`, `tables`, `recipes`, `invoices`, etc.). |

### 3.3 Login dinámico por marca
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/api/branches/public-login-theme/by-host/?host=...` | Devuelve tema según host (dominio personalizado). |
| GET | `/api/branches/public-login-theme/{slug}/` | Tema por slug de sucursal. |
| GET | `/api/branches/public-org-login-theme/{slug}/` | Tema por slug de organización. |

**Conclusión**: el theming multi-tenant ya existe en Yggdra. Frig debe consumir `/api/branches/themes/` y `/api/branches/` en vez de inventar un TenantConfig aparte.

## 4. Catálogo / menú (inventory)

### 4.1 Endpoints
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET/POST | `/api/inventory/products/` | Productos vendibles. Ver `product_type`. |
| GET/PATCH/PUT/DELETE | `/api/inventory/products/{id}/` | CRUD producto. |
| GET/POST | `/api/inventory/categories/` | Categorías de producto. |
| GET/POST | `/api/inventory/modifier-groups/` | Grupos de modificadores (ej: “Elige base"). |
| GET/POST | `/api/inventory/modifier-options/` | Opciones de modificador. |
| GET/POST | `/api/inventory/product-modifier-groups/` | Relación producto ↔ grupo de modificadores. |
| GET/POST | `/api/inventory/combos/` | Combos. |
| GET/POST | `/api/inventory/combo-items/` | Items de combo. |
| GET/POST | `/api/inventory/gallery/` | Galería de imágenes de producto. |
| GET/POST | `/api/inventory/product-documents/` | Documentos adjuntos (fotos, fichas). |

### 4.2 Modelo Product (campos relevantes para el POS)
- `name`, `code` (SKU), `description`
- `price` / `sale_price` / `wholesale_price`
- `quantity`, `minimum_stock`, `reorder_point`
- `measurement_unit`
- `category` (FK a `CategoryProduct`)
- `product_type`: `DIRECT_SALE`, `RECIPE_BASED`, `SERVICE`, `CERTIFICATE`, etc.
- `is_for_sale`, `is_public`, `is_featured`, `is_active`
- `icon_name`, `color`
- Campos nutricionales (`energy_kcal`, `proteins_g`, etc.) para etiquetado.
- Relación a galería y documentos (fotos).

**Recomendación para Frig**: el POS filtra `product_type__in=["DIRECT_SALE", "RECIPE_BASED", "SERVICE"]` y `is_for_sale=true`. Las cards muestran `name`, foto desde `gallery` o `documents` tipo PHOTO, y `price`.

### 4.3 Modificadores
- `ModifierGroup`: define grupo (ej: “Proteína", “Tamaño").
- `ModifierOption`: opciones con precio extra.
- `ProductModifierGroup`: asocia grupo a producto.

## 5. Ventas / pedidos (sales)

### 5.1 Endpoints principales
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET/POST | `/api/sales/orders/` | Órdenes. Filtros: `status`, `order_type`, `payment_status`, `date__date`, `created__gte`, etc. |
| GET/PATCH/PUT/DELETE | `/api/sales/orders/{id}/` | CRUD orden. |
| GET/POST | `/api/sales/order-products/` | Líneas de orden. |
| GET/POST | `/api/sales/order-product-modifiers/` | Modificadores por línea. |
| GET/POST | `/api/sales/kitchen-tickets/` | **Comandas de cocina**. Estados: PENDING, PREPARING, READY, DELIVERED, CANCELLED. |
| GET/POST | `/api/sales/kitchen-ticket-items/` | Items individuales de comanda. |
| GET/POST | `/api/sales/order-splits/` | Divisiones de cuenta. |
| GET/POST | `/api/sales/daily-menus/` | Menú del día. |
| GET/POST | `/api/sales/quotations/` | Cotizaciones. |
| GET/POST | `/api/sales/pos/` | Acciones POS específicas (ver abajo). |
| GET/POST | `/api/sales/analytics/` | Datos para gráficos de ventas. |
| GET/POST | `/api/sales/tips/` | Propinas. |
| GET/POST | `/api/sales/invoicing/` | Facturación electrónica. |

### 5.2 Acciones de Order (`/api/sales/orders/`)
| Método | URL | Acción |
|--------|-----|--------|
| GET | `/api/sales/orders/sales/` | Solo `order_type=SALE`. |
| GET | `/api/sales/orders/orders/` | Solo `order_type=ORDER`. |
| GET | `/api/sales/orders/dashboard/` | Datos resumidos para dashboard. |
| POST | `/api/sales/orders/{id}/cancel/` | Cancelar orden (revierte pagos e inventario). Body opcional `{"reason":"..."}`. |
| POST | `/api/sales/orders/{id}/return_products/` | Devolución parcial. |
| POST | `/api/sales/orders/validate_inventory/` | Validar stock antes de crear orden. |
| GET | `/api/sales/orders/{id}/inventory_summary/` | Movimientos de inventario de la orden. |
| GET | `/api/sales/orders/{id}/tax_document/` | Documento tributario principal. |
| GET | `/api/sales/orders/{id}/generate-boleta-pdf/` | PDF boleta formato 80mm. |
| GET | `/api/sales/orders/{id}/generate-boleta-domiciliaria-pdf/` | PDF boleta A4. |
| GET | `/api/sales/orders/arqueo/` | Arqueo de caja por rol (requiere `X-Branch-ID`). |

### 5.3 Modelo Order (campos relevantes)
- `id` (UUID)
- `status`: DRAFT, PENDING, IN_PROGRESS, COMPLETED, CANCELLED, RETURNED, REFUNDED
- `order_type`: SALE, ORDER, AGREEMENT
- `payment_status`: PENDING, PARTIAL, INVOICED, PAID, REFUNDED
- `table` (FK, nullable → permite modo sin mesas)
- `client` (FK a `customers.Client`, nullable)
- `processed_by`, `delivered_by`
- `total_amount`, `total_cost`
- `observation`, `driver_note`, `address`
- Campos de delivery (`delivery_cost`, `delivery_type`, `is_urgent`, etc.)
- `registers` → `OrderProduct` (líneas)
- `kitchen_tickets` → `KitchenTicket`
- `payments` → pagos
- `tax_documents`

**Importante para Frig**: `table` es nullable, así que el modo takeaway ya es compatible. Para el modo sin mesas se crea la orden con `table=null` y se usa `client.name` o un campo temporal de “nombre para retiro".

### 5.4 Modelo OrderProduct
- `order`, `product`, `quantity`, `actual_quantity`
- `unit_price`, `total_price` (GeneratedField)
- `unit_cost`, `total_cost`
- `discount_percentage`, `discount_amount`
- `notes`
- `kitchen_items`

### 5.5 KitchenTicket — el KDS
| Método | URL | Acción |
|--------|-----|--------|
| POST | `/api/sales/kitchen-tickets/{id}/start/` | PENDING → PREPARING |
| POST | `/api/sales/kitchen-tickets/{id}/ready/` | PREPARING → READY |
| POST | `/api/sales/kitchen-tickets/{id}/deliver/` | READY → DELIVERED |
| POST | `/api/sales/kitchen-tickets/{id}/cancel/` | Cualquier estado → CANCELLED (excepto DELIVERED). |

**Flujo KDS**: se crea `Order` → se crea `KitchenTicket` vinculado a la orden con `items` apuntando a `OrderProduct`. La cocina consume `GET /api/sales/kitchen-tickets/?status=PENDING` y va moviendo estados. El frontend puede hacer polling cada 5s (v1).

### 5.6 POS actions (`/api/sales/pos/`)
| Método | URL | Uso |
|--------|-----|-----|
| GET | `/api/sales/pos/search_orders/?q=...&branch_id=...` | Buscar órdenes pendientes de pago. |
| GET | `/api/sales/pos/client_orders/?client_id=...` | Órdenes pendientes de un cliente. |
| POST | `/api/sales/pos/process_payment/` | Pagar una o más órdenes. |
| POST | `/api/sales/pos/validate_payment/` | Validar antes de pagar. |
| GET | `/api/sales/pos/payment_methods/?branch_id=...` | Medios de pago disponibles. |
| GET | `/api/sales/pos/measurement_summary/` | Resumen de órdenes de medición (no relevante para gastronomía). |

**Nota**: `POSViewSet` fue diseñado para mediciones (Smart Hydro). Para Frig v1 se usará `/api/sales/orders/` directamente para crear la orden; el pago se hará via `process_payment` o endpoints de `finance` si aplica.

## 6. Mesas (tables)

| Método | Endpoint | Uso |
|--------|----------|-----|
| GET/POST | `/api/tables/tables/` | CRUD mesas. |

El campo `Order.table` es nullable, por lo que el modo takeaway no requiere cambios en backend.

## 7. Clientes (customers)

| Método | Endpoint | Uso |
|--------|----------|-----|
| GET/POST | `/api/customers/clients/` | Clientes (FK desde Order). |

Para modo takeaway se puede usar un cliente genérico “Cliente local" o crear clientes on-the-fly.

## 8. Recetas (recipes)

| Método | Endpoint | Uso |
|--------|----------|-----|
| GET/POST | `/api/recipes/recipes/` | Recetas. |
| GET/POST | `/api/recipes/ingredients/` | Ingredientes. |
| GET/POST | `/api/recipes/variants/` | Variantes de receta. |

Relevante para productos `product_type=RECIPE_BASED` y para el módulo de costos/nutrición.

## 9. Promociones, finanzas y analytics

- `/api/promotions/...` — cupones, descuentos, happy hour.
- `/api/finance/...` — pagos, métodos de pago, documentos tributarios.
- `/api/sales/analytics/` — ventas para dashboard.
- `/api/analytics/...` — reportes más elaborados.

Ver routers específicos en Fase 4 del plan.

## 10. Realtime / websockets

- Yggdra tiene **Django Channels** configurado con Redis en producción y memoria en dev (`CHANNEL_LAYERS` en settings).
- El uso actual de Channels es para `ai_agents` (chat/webhooks), **no hay un canal específico para KDS**.
- **Decisión Frig v1**: polling HTTP cada 5s sobre `/api/sales/kitchen-tickets/?status=PENDING`. Para v1.1 se evaluará un channel group `branch-{id}-kitchen` para push de nuevas comandas.

## 11. Impresión de comandas

- Yggdra **no tiene** un endpoint ESC/POS de impresión térmica directa.
- Tiene generación de PDFs: `/api/sales/orders/{id}/generate-boleta-pdf/` (80mm) y `generate-boleta-domiciliaria-pdf/` (A4).
- **Decisión Frig v1**: crear un microservicio `services/printer` (Node/Go) que escuche nuevas `KitchenTicket` (polling o webhook) y envíe ESC/POS a la impresora térmica. Fallback: imprimir PDF desde el navegador con `window.print()` y CSS 80mm.

## 12. Planes / suscripciones (módulos)

- `BranchSubscription` + `BranchModulePlan` controlan qué módulos puede usar una sucursal.
- `BranchModuleConfiguration` habilita/deshabilita módulos granularmente (`pos`, `tables`, `products`, `recipes`, `invoices`, etc.).
- Frig debe leer los módulos habilitados al iniciar sesión y adaptar el menú.

## 13. Datos de prueba local

```bash
./start-dev-light.sh   # levanta DB, Redis, API, Celery
# admin@example.com / admin123
```

Sucursales demo: `Bizantni Gelato`, `Smart Hydro`.

## 14. Capa de datos recomendada para Frig

```
packages/api-client/
  schema.json          # descargado de /api/schema/
  types/               # generado por openapi-typescript
  client.ts            # fetch wrapper con token + X-Branch-ID
lib/hooks/
  useProducts.ts       # TanStack Query → GET /api/inventory/products/
  useOrders.ts         # TanStack Query → GET/POST /api/sales/orders/
  useKitchenTickets.ts # TanStack Query → GET /api/sales/kitchen-tickets/
  useBranchTheme.ts    # TanStack Query → GET /api/branches/themes/
```

### Cliente HTTP mínimo
```ts
const apiFetch = (path, options = {}) => {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${getToken()}`,
      "X-Branch-ID": getCurrentBranchId(),
      ...options.headers,
    },
  });
};
```

## 15. Gaps identificados para v1 (no requieren backend, pero hay que modelarlos en frontend)

1. **Nombre de retiro**: Yggdra no tiene un campo “nombre del cliente para retiro" en `Order`. Se puede usar `client.name` (creando un cliente rápido) o `observation`. Para v1 recomendado: crear `Client` mínimo y asociarlo.
2. **Número correlativo del día**: no existe. Se puede calcular en frontend contando órdenes del día (`GET /api/sales/orders/?date__date=YYYY-MM-DD`) + 1, o agregarlo en backend más adelante.
3. **Modo “sin mesas"**: no es un flag de Yggdra. Se implementa en frontend con `service_mode` en `BranchPOSConfig.configuration_data` (JSON libre) o como submódulo.
4. **Pantalla de llamado**: es una vista del frontend, no requiere backend.

## 16. Rutas críticas para superar a Fudo (checklist)

| Función | Endpoint(s) |
|---------|-------------|
| Login con branding | `POST /api/accounts/users/login_complete/`, `GET /api/branches/themes/`, `GET /api/branches/public-login-theme/{slug}/` |
| Catálogo visual POS | `GET /api/inventory/products/?is_for_sale=true`, `GET /api/inventory/categories/`, `GET /api/inventory/gallery/` |
| Carrito + modificadores | `POST /api/sales/orders/`, `POST /api/sales/order-products/`, `POST /api/sales/order-product-modifiers/` |
| KDS | `GET /api/sales/kitchen-tickets/`, `POST .../start/`, `POST .../ready/`, `POST .../deliver/` |
| Cobro | `POST /api/sales/pos/process_payment/` o endpoints de finance |
| Dashboard | `GET /api/sales/orders/dashboard/`, `GET /api/sales/analytics/` |
| Admin catálogo | CRUD `/api/inventory/products/`, `/api/inventory/categories/`, `/api/inventory/modifier-groups/`, etc. |
| Theming | `PATCH /api/branches/themes/`, `PATCH /api/branches/pos-config/` |

---

*Próximo paso: generar `schema.json` levantando Yggdra y corriendo `openapi-typescript http://localhost:8000/api/schema/ -o packages/api-client/types/yggdra.d.ts`.*
