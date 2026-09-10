# Plan fix — Stock unificado con fuente única (bodegas)

> Fecha: 2026-09-10 · Backend: `yggdra_infra` (rama `dev`) · Frontend: frig (después)
> Estado: PLAN para implementar en backend. El frontend NO se toca hasta que
> este fix esté deployado y verificado.

## 1. Síntoma (verificado en vivo, backend local, admin)

Dos endpoints del mismo producto devuelven cantidades distintas. Ejemplos
reales (branch 5, Macanuo Bowl):

| Producto | `GET /inventory/products/` (`stock_available`) | `GET /inventory/product-inventory/` (`quantity`) |
|---|---|---|
| Bowl Pollo Thai | 0 | 200 |
| Bowl Mediterráneo | 346 | 100 |
| Té helado | 47 | 147 |
| Almendras fileteadas | 9 | 9.015 |

22 de 50 productos de la sucursal discrepan. Además el listado trunca a
entero y el resumen trae floats, y los números "cambian solos" entre
verificaciones (346 → 100).

## 2. Causa raíz

Dos fuentes de verdad, escritas por caminos distintos:

1. **`Product.quantity`** (DecimalField 14,4, `apps/inventory/models/products.py:103-109`): lo acumulan los movimientos en `InventoryHistory.create_movement` (`apps/inventory/models/inventory.py:219-220`), **incluso los movimientos con `warehouse=None`** (campo nullable por diseño, `:50-58`; el serializer lo permite, `serializers/inventory.py:104-106`).
2. **`Σ WarehouseProduct.current_quantity`** (IntegerField, `models/warehouse_products.py:29-33`): es lo que anota el listado (`views/products.py:90-96`).

Efectos en cadena:

- Movimiento IN sin bodega → sube `Product.quantity` → el resumen lo
  muestra; el listado sigue en 0 (no hay filas).
- El **próximo** movimiento de ese producto dispara `update_total_quantity()`
  (`models/products.py:530-550`), que **sobrescribe `quantity` con la suma de
  bodegas y borra el stock huérfano** (346 → 100).
- `current_quantity` entero: los decimales se pierden al pasar por bodega
  (0.250 kg → 0 o redondeo), y hay `int()` en 5 serializers
  (`serializers/products.py:134,303,361,478`, `serializers/inventory.py:254`).

## 3. Decisión: fuente única = bodegas

`WarehouseProduct` es la única fuente de verdad; `Product.quantity` queda
como caché mantenido siempre por `update_total_quantity()`. Todo movimiento
queda asignado a una bodega (resolviendo la default cuando el cliente no la
manda). Es el modelo mental que ya usa el POS y elimina la doble escritura.

## 4. Pasos (backend)

### 4.1 Schema — decimales
- `models/warehouse_products.py`: `current_quantity` →
  `DecimalField(max_digits=14, decimal_places=4)`.
- `makemigrations inventory`.
- Revisar usos del campo (`update_current_quantity` `:107-116`, signals,
  services, serializers) y quitar `int()` internos que trunquen.

### 4.2 Write path — movimientos siempre con bodega
- `models/inventory.py` `InventoryHistory.create_movement` (`:148-231`):
  cuando `warehouse is None`, resolver la bodega por defecto de la sucursal
  del producto: activa con `is_default=True` → si no, la primera activa → si
  no hay ninguna, crear "Bodega General" (`warehouse_type="GENERAL"`,
  `is_default=True`). Patrón existente: `services/movement_service.py`
  `_resolve_warehouse` (`:330-354`).
- Con esto, `update_total_quantity` mantiene `Product.quantity = Σ bodegas`
  siempre, para todo camino de escritura (manual, venta, transferencia,
  recetas, tools).

### 4.3 Lecturas unificadas — sin truncar
- Quitar `int()` en `serializers/products.py:134,303,361,478` y
  `serializers/inventory.py:254`. `quantity`/`stock_available` devuelven
  Decimal en AMBOS endpoints (mismo shape).
- Verificar que `stock_status` siga calculándose sobre la misma cantidad.

### 4.4 Migración de datos
Después de la migración de schema:
1. UPDATE de `InventoryHistory` con `warehouse IS NULL` → bodega por defecto
   de su sucursal (misma lógica 4.2, dentro de la migración con
   `apps.get_model`).
2. Recalcular `WarehouseProduct.current_quantity` desde la suma de
   movimientos por bodega, y `Product.quantity` desde la suma de bodegas.
   Replicar la lógica del comando existente
   `apps/inventory/management/commands/recompute_product_quantities.py`
   (no invocar el comando desde la migración).

### 4.5 Tests (`apps/inventory/tests/`)
- IN con `warehouse=None` → queda en bodega por defecto; `/products/` y
  `/product-inventory/` devuelven la MISMA cantidad.
- Entrada 0.25 → ambos endpoints 0.25 (sin truncar).
- Regresión: `bulk_deduct_stock` (venta POS) descuenta bodega.
- Seguir el estilo de `test_views.py` / `test_sales_integration.py`.

### 4.6 Verificación manual
- Los productos de la tabla del §1 deben coincidir entre endpoints.
- Crear producto nuevo sin bodega → ambos endpoints 0, `OUT_OF_STOCK` en
  alertas.

## 5. Después (frontend frig — cuando el fix esté arriba)

1. Tipos: `quantity`/`stock_available` siempre `number` decimal
   (`src/lib/api/types/index.ts` ya es defensivo).
2. `formatStock` y tarjeta POS: mostrar decimales sin redondear cuando aplica
   (unidades fraccionarias como kg).
3. Considerar que el POS consuma una sola fuente de stock por producto.
4. Guard ya aplicado: `cart.ts` `availableStock` trata cantidad no numérica
   como 0 (no `Infinity`).

## 6. Fuera de scope

- `product-inventory/` ignorando `X-Branch-ID` para superuser (mezcla
  sucursales): verificar comportamiento con usuario no superuser antes de
  tocar; probablemente no afecta a usuarios reales.
- Endpoint `POST /sales/orders/validate_inventory/` existe en el schema pero
  el frontend jamás lo llama — backlog.

## 7. Pendiente relacionado: productos que NUNCA llevan stock

El schema del backend declara `tracks_inventory?: boolean` ("Controla
Inventario — si debe llevar control de stock tradicional") en `Product`,
`ProductRequest` y `PatchedProductRequest` (`yggdra.d.ts` ~líneas 43133,
47979, 48988). El frontend de frig **nunca lo envía**: el toggle
`tracksWarehouseStock` del form es estado local
(`src/components/products/product-form.tsx:436`) sin mapeo a la API.

Para productos tipo servicio/cargo (sin inventario) falta:

1. **Backend**: verificar que `tracks_inventory=false` esté implementado de
   verdad (no descontar en ventas, no bloquear, excluir de alertas).
2. **Frontend (frig)**: conectar el toggle del form a `tracks_inventory` y,
   cuando es false, tratar el producto como "sin límite de stock" en el POS
   y no exigir bodega.
3. Contrato consistente: `quantity`/`stock_available` pueden omitirse o
   venir `null` para estos productos → el guard de `cart.ts` ya los trata
   como 0; definir si el POS debe mostrar "∞"/"sin stock" en su lugar.
