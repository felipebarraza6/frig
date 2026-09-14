# Requerimientos backend — Inventario (alertas y POS)

> Fecha: 2026-09-14 · Origen: auditoría end-to-end de alertas de inventario y
> modal de inventario del POS (frig). Backend: `yggdra_infra`.

## Contexto

El frontend ya mitigó en cliente los dos problemas encontrados, pero ambos
tienen raíz en el backend y conviene resolverlos allá:

1. Las alertas (`/inventory`) mostraban bowls "sin stock 0/0" mientras el POS
   los veía disponibles. Causa: `/inventory/product-inventory/{low_stock,
   out_of_stock}` (`views/inventory.py:237-255`) filtra por la columna cruda
   `Product.quantity`, que para productos `RECIPE_BASED` es 0 porque su stock
   real vive en los ingredientes.
2. El modal de inventario del POS listaba productos que no llevan inventario
   (bowls, servicios) porque `/inventory/product-inventory/` expone filas para
   productos `RECIPE_BASED` / `tracks_inventory=false`.

## Requerimientos

### 1. `low_stock` / `out_of_stock` de product-inventory deben ser recipe-aware

- `GET /inventory/product-inventory/low_stock/` y `.../out_of_stock/` deben
  usar `Product.effective_quantity` (stock efectivo, derivado de recetas para
  `RECIPE_BASED`) en vez de la columna `quantity`. Es el mismo cálculo que ya
  hacen `GET /inventory/products/low-stock/` y `.../out-of-stock/`
  (`views/products.py:588-660`).
- Alternativa aceptable: deprecar los dos endpoints de `product-inventory` y
  que el frontend solo use los de `products` (que es lo que hace hoy frig).
  Si se deprecaban, responder 410 con hint.

### 2. `product-inventory` no debe exponer productos sin inventario propio

- `GET /inventory/product-inventory/` no debería listar (ni crear filas para)
  productos con `tracks_inventory=false` ni tipos `RECIPE_BASED`, `SERVICE`,
  `CERTIFICATE`, `IOT`, `TOOL`, `EQUIPMENT` (no venden stock de bodega).
- Mínimo aceptable: soportar filtro de query `?tracks_inventory=true` y
  `?product_type=` para que el frontend no tenga que cruzar con el catálogo.
- Al registrar un movimiento manual contra un producto sin inventario propio,
  rechazar con 400 claro (hoy `create_movement` lo permite y contamina
  `Product.quantity`).

### 3. Stock unificado (ya planificado)

- Ejecutar `docs/plan-fix-stock-unificado.md` (repo backend): fuente única =
  `WarehouseProduct`, movimientos siempre con bodega, `Product.quantity` solo
  como caché. Esto elimina las discrepancias residuales entre
  `stock_available` (listado) y `quantity` (resumen).

## Estado frontend (frig)

- `fetchLowStock` / `fetchOutOfStock` ya apuntan a
  `/inventory/products/{low-stock,out-of-stock}` (recipe-aware, commit
  `afe9d03`).
- El modal de inventario del POS filtra productos sin inventario propio
  cruzando con el catálogo (`NO_INVENTORY_TYPES` + `tracks_inventory === false`).
  Este filtro cliente se puede simplificar cuando exista el filtro de backend
  del punto 2.
