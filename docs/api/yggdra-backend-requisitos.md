# Requisitos backend (Yggdra) — caché, sesión y protocolo

> Peticiones del front FRIG para mejorar rendimiento, consistencia y
> seguridad. Nada de esto bloquea el front actual: son mejoras de protocolo
> que el front ya está preparado para aprovechar.

## 1. Caché HTTP en endpoints públicos

Los públicos se piden en cada visita a login/landing (por cada dominio de
tenant). Hoy vuelven sin cabeceras de caché → el CDN/navegador re-descarga.

| Endpoint | Cabecera sugerida |
|---|---|
| `GET /public/landing-config/` | `Cache-Control: public, max-age=300` |
| `GET /branches/public-login-theme/by-host/` | `Cache-Control: public, max-age=300` |
| `GET /branches/public-login-theme/{slug}/` | `Cache-Control: public, max-age=300` |

- El front ya tiene caché de módulo (promise + TTL 5 min); con estas
  cabeceras el CDN absorbe el resto del tráfico.
- Opcional: `ETag` + `304` si el contenido no cambió (el content de estos
  endpoints cambia pocas veces al día).

## 2. Sesión: cookie httpOnly (reemplazo futuro de localStorage)

Hoy el token vive en `localStorage` (`frig.session`) → vulnerable a XSS.
Propuesta de migración compatible:

1. `login_complete` (y magic-login) setean además:
   `Set-Cookie: frig_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/`
2. El front sigue guardando el token en localStorage como fallback/compat.
3. `apiFetch` intenta `credentials: "include"`; si el backend acepta la
   cookie, el front deja de depender del localStorage gradualmente.
4. Logout: endpoint que expire la cookie + borrado local (ya existe).

Ventaja: el token deja de ser legible por scripts de terceros inyectados.

## 3. ETag en colecciones que cambian poco

`/shared/frontend-config/` se pide en cada arranque de app. Con
`ETag: <hash>` + `If-None-Match` → `304` sin body (el payload es grande).
Ahorra ~50-200 KB por arranque por usuario.

## 4. Consistencia de branding (doble fuente)

Hoy conviven dos fuentes de branding por sucursal:
- `theme_config` de la sucursal (lo que edita el dialog de temas).
- `branding.colors` de la organización (lo que devuelve el by-host).

El front ya prioriza: **sucursal > organización** dentro de la app, y usa
el by-host solo pre-auth. Sugerencia backend: que el by-host devuelva el
branding **efectivo resuelto** (branch gana sobre org, mismo criterio), así
login e app muestran siempre lo mismo sin depender de la prioridad del front.

## 5. Media de branding

- Servir logos/favicons con `Cache-Control: immutable` (los archivos bajo
  `/media/branchs/theme-logos/<uuid>/` son inmutables por nombre).
- Recomendar favicons cuadrados ≥ 64px: el front los usa como favicon del
  tenant con fallback al logo.

## 6. Filtro `product` en `GET /suppliers/supplier-products/`

El schema OpenAPI de listado no expone filtro por `product` / `product__id`
(sí tiene `supplier`, `is_preferred`, `product__name*`, etc.). Hoy
`?product=<id>` se ignora y la respuesta trae todos los vínculos de la
sucursal.

FRIG necesita, al editar un producto, los `SupplierProduct` de ese
`product` id para mostrar el **proveedor principal** (`is_preferred`) y
mantener varios proveedores para órdenes de compra.

**Pedido:** añadir filtro exacto `product` (FK id) al filterset del
viewset, documentarlo en schema, y preferir orden
`-is_preferred, supplier_name`.

Mientras tanto el front pagina toda la colección y filtra en cliente.

## 7. Filtro `product` en `GET /inventory/warehouse-products/`

Mismo patrón que §6: el schema no expone `product` / `product__id` (sí
`warehouse`, `search`, `is_preferred_location`). `?product=<id>` se ignora.

FRIG al editar un producto necesita los vínculos de **ese** producto con
`current_quantity`, `stock_status`, mín/máx/reorden por bodega.

**Pedido:** filtro exacto `product` (FK id) en el filterset, documentado en
schema. Mientras tanto el front pagina + filtra en cliente.

## 8. Etiqueta nutricional: modos, medidas y PDF por producto

Hoy `GET /recipes/recipes/{id}/download-nutrition-label-pdf/` genera un PDF
ReportLab ~3 KB. En auditoría (2026-03) los query `mode` / `size` / `per` /
`with_logo` cambian el hash pero **no el contenido textual** aparente (mismo
tamaño de archivo). La fuente rica es
`GET /recipes/recipes/{id}/nutrition_label/` (valores, ingredientes,
alérgenos, `branch_info`, compliance MINSAL).

FRIG pinta la etiqueta completa en preview/impresión desde ese JSON y
**genera el PDF descargable en el cliente** (`src/lib/nutrition-label-pdf.ts`)
para que modo / tamaño / porción coincidan con la vista. El PDF Yggdra queda
como fallback si falla la generación local.

**Pedido:**
1. Honrar de verdad `mode=simple|logo`, `size=…`, `per=100g|serving`,
   `with_logo=true` (logo de sucursal del `X-Branch-ID`) con contenido distinto
   y tamaño de página real en mm.
2. PDF por **producto** (materia prima / venta directa) además de por receta.
3. Tras `calculate_nutrition`, sincronizar campos nutricionales del
   `resulting_product` (hoy el producto puede quedar vacío aunque la receta
   tenga cálculo).

## 9. Bodegas: contratos de métricas, transferencia y producto en recinto

FRIG rediseñó `/warehouses` (recintos) y `/warehouses/view` (interior por
zonas). El front ya consume lo que existe; estos huecos generan N+1, KPIs
rotos y OpenAPI mentiroso.

1. **`GET /inventory/warehouses/branch_summary/`**
   - `WarehouseService.get_branch_warehouse_summary` no inicializa
     `total_sale_value` y luego hace `+=` → KeyError / 400.
   - Inicializar `total_sale_value = 0`.
   - Aceptar sucursal por `X-Branch-ID` (hoy exige `branch_id` en query).

2. **OpenAPI** de actions `metrics`, `branch_summary`, `types`, `transfer`,
   `products` y `update_quantity`: tipar con los serializers reales
   (`WarehouseMetricsSerializer`, `BranchWarehouseSummarySerializer`,
   `WarehouseTransferSerializer`, lista de `{value,label}`,
   `{ quantity, notes }`). Hoy el schema dice `Warehouse` / `WarehouseRequest`.

3. **`WarehouseProductSerializer`**: exponer `product_sale_price`,
   `total_sale_value`, `product_type`, `tracks_inventory`. Nested
   `warehouse` slim (`id, name, warehouse_type, is_default`). El nested
   completo recalcula totales del recinto en cada fila.

4. **`update_quantity`**: body `{ quantity, notes }` (stock absoluto). No
   `initial_quantity`. Documentar que `quantity` ausente no debe caer a 0
   (eso vacía el recinto).

5. Filtros en `GET /inventory/warehouses/{id}/products/`: `needs_reorder`,
   `location`, `ordering=location_in_warehouse`. Aclarar que
   `product_type=sale` filtra `is_for_sale`, no el enum de tipo.

6. Filtro exacto `product` en `GET /inventory/warehouse-products/` (mismo
   pedido que §7).

