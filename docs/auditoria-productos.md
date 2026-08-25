# Auditoría E2E del módulo Productos — FRIG

> Fecha: 2026-08-24 · Alcance: productos, combos, menús, nutrición + validación de regresión de dashboard/POS/caja/ventas.
> Método: auditoría de código (4 agentes exploradores) + verificación en vivo contra Yggdra en `http://localhost:8000` (admin@example.com, branch 1).

## 1. Decisiones de alcance (usuario)

- **Tipos de producto gestionados por FRIG**: `DIRECT_SALE` (venta directa), `RECIPE_BASED` (producto compuesto) y `RAW_MATERIAL` (materia prima). `SERVICE` fuera por ahora.
- El resto de tipos del enum de Yggdra (`TOOL`, `IOT`, `MEASUREMENT_MATERIAL`, `SUPPLIER_PRODUCT`, `EQUIPMENT`, `CERTIFICATE`, `WASTE_MATERIAL`, `TANK_CONTAINER`) **no son legacy**: pertenecen a otro contexto de app (APR/Smart Hydro) y no se ofrecen en FRIG.
- Profundidad: producción completa (bugs + validaciones + UX + verificación E2E + smoke de regresión).

## 2. Respuestas a las dudas planteadas

| Duda | Respuesta |
|---|---|
| "¿Existe el tipo 'ingrediente'?" | No como tipo. Los ingredientes de receta son `Product` con `product_type=RAW_MATERIAL` (`RecipeIngredient.ingredient` es FK a Product). RAW_MATERIAL es necesario para armar productos compuestos y para el cálculo nutricional. |
| "¿Producto de proveedor va en gestión de productos?" | No. `SUPPLIER_PRODUCT` existe en el enum pero el frontend no lo usa (`fetchSupplierProducts` es código muerto). Los datos de proveedores se gestionan en el módulo Proveedores. |
| "¿Materia de medición se usa?" | Es del contexto APR (Smart Hydro), no gastronomía. Fuera de FRIG. |

**Modelo real**: catálogo de venta e insumos comparten tabla y endpoints (`/inventory/products/`), diferenciados por `product_type` + `is_for_sale` + config de tipos por sucursal. El POS ya está aislado (filtra por `is_for_sale=true` + configuración de tipos).

## 3. Verificación en vivo contra Yggdra (resultados)

| Verificación | Resultado |
|---|---|
| Filtros `is_for_sale`, `is_active`, `page_size` en `GET /inventory/products/` | ✅ Funcionan (respuesta 200, todos los resultados cumplen `is_for_sale=true`). |
| `GET /inventory/products/export-excel/` y `export-pdf/` | ✅ Funcionan (200, MIME correcto). No están en el schema OpenAPI, pero el backend real los entrega. |
| `GET /inventory/inventory-history/export-excel\|pdf/` | ✅ Funcionan. |
| `ProductList` (listado) vs `Product` (retrieve) | ⚠️ El **listado no expone** `is_public` ni campos nutricionales; el **detalle sí**. → Editar desde el listado borraba esos datos. |
| `POST /recipes/recipes/` con `branch: 0` | ❌ 400: `Clave primaria "0" inválida`. |
| `POST /recipes/recipes/` sin `branch` / sin `code` / sin `instructions` | ❌ 400 por separado: `branch`, `code` e `instructions` son **requeridos** al crear (el schema los marca opcionales). |
| `POST /recipes/recipes/` con `branch` + `code` reales | ✅ 201. |
| `POST /inventory/combos/` (cualquier payload) | ❌ **500 en backend**: `ComboWriteSerializer.create` crea el `Combo` sin asignar `branch` y el modelo lo exige → «Todos los registros deben estar asociados a una sucursal». |
| `POST /recipes/recipes/{id}/calculate_nutrition/` y `download-nutrition-label-pdf/` | ✅ 200 (calcula y descarga PDF con auth). |

## 4. Correcciones aplicadas (frontend, `apps/web`)

### Tipos de producto
- `lib/hooks/useBranchProductTypes.ts`: constante `FRIG_PRODUCT_TYPES` (los 3 tipos gastronómicos), opciones intersectadas con el plan de la sucursal, labels corregidos (eliminados `COMPOSITE`/`COMBO`/`MENU` que no existen en el enum; agregados los reales).
- `components/products/product-form.tsx`: default de tipo corregido (ya no depende de opciones aún no cargadas), lógica por tipo:
  - `RAW_MATERIAL`: no se vende por defecto (oculta precio de venta y checkboxes de venta/menú QR).
  - `RECIPE_BASED`: sección receta existente (se mantiene stock propio porque el POS exige `quantity` para vender).
  - Aviso si se cambia de tipo y la receta quedaría huérfana.

### Bugs bloqueantes
1. PDF etiqueta nutricional: ahora descarga vía `apiFile` + `useDownloadFile` con token (`downloadRecipeNutritionLabel`), los `window.open` con ruta relativa están eliminados.
2. Pérdida de datos al editar: `fetchProduct(id)` (retrieve) y el formulario se precarga desde el detalle completo (`products/page.tsx` y `nutrition/page.tsx`).
3. Eliminar producto sin confirmación / sin feedback: diálogo de confirmación + toasts de éxito/error en eliminar y activar/desactivar.
4. `branch: 0` eliminado: `createRecipe` envía el `branch_id` real de sesión (el backend lo exige); `ComboWriteRequest` ya no envía `branch` (no lo acepta).
5. `fetchRecipesByProduct`: ahora recorre páginas (`page_size=500`) en vez de mirar solo la primera.
6. Selector de productos de menús: `page_size=1000`.
7. `updateProduct(0)` latente en nutrición: bloqueado (error claro si falta id).
8. Receta huérfana al cambiar de tipo: aviso al usuario (no se borra la receta).
9. Exports de productos/inventario: verificados en vivo, funcionan (sin cambio).
10. "Calcular desde receta": botón siempre visible para compuestos, con hint "guarda primero" cuando no hay receta; PDF deshabilitado sin cálculo.

### Validaciones y UX
- Form de producto: nombre con trim; precio de venta requerido (> 0) para tipos vendibles; compuesto exige ≥ 1 materia prima con cantidad > 0; `datalist` de unidades de medida.
- Combos: valida `end_date >= start_date` y ≥ 1 producto con cantidad > 0.
- Listado de productos: empty state.
- Limpieza: casts redundantes eliminados, doble filtrado en menús/nutrición eliminado.

### Bugs de regresión fuera del módulo (ventas/dashboard)
- `lib/api/orders.ts`: `fetchOrders` ahora respeta `page_size` (drawer de métricas del dashboard pedía 50 y recibía el default) — B1.
- Export Excel de ventas: `ordersQueryString` ahora incluye `client__in` (el export perdía el filtro de cliente) — B2. Lógica unificada en `buildOrdersQueryString`.
- Query key de payment-methods unificada en el POS terminal (F8 acotado).
- Fix preexistente de compilación: `post-sale-modal.tsx` usaba `product__name` inexistente.

## 5. Parche de backend aplicado (Yggdra, contenedor Docker)

`POST/PATCH /api/inventory/combos/` devolvía **500 siempre** (bloqueaba crear/editar combos desde la UI). Se parcheó `/app/apps/inventory/serializers/combos.py` **dentro del contenedor `yggdra-light-api`** (autorizado por el usuario):

- `ComboWriteSerializer` ahora resuelve `branch` desde `request.branch` (header `X-Branch-ID`) en `create`, y los `ComboItem` heredan `branch` del combo en `create` y `update`.

Verificado en vivo: POST 201, PATCH 200, DELETE 204 (con ítems).

### ⚠️ Evaluación del parche: real pero acotado — necesita atención

1. **Es un fix real de ese 500 específico** (branch faltante en `Combo.objects.create`), con causa raíz identificada y verificación en vivo. Pero es un **parche de emergencia efímero**: el contenedor se pierde al reconstruir la imagen. Hay que portarlo al source de Yggdra.
2. **No sigue el patrón idiomático del repo**: Yggdra resuelve branch vía `branch_id` (campo write_only en `ProductSerializer`) + `BranchScopedCreateMixin`/`UniversalFilterMixin.perform_create`. Productos asigna branch automáticamente (verificado: POST sin branch → branch=1). Lo correcto en el source es mover la resolución al viewset (mixin) o declarar `branch_id` en el serializer, en vez de resolver en `create()` como hizo este parche (funcional, pero local).
3. **Quedaban otros 500 latentes en el mismo endpoint** (probados en vivo) y se extendió el parche para cubrirlos:
   - **Nombre duplicado** → `unique_together = ["name", "branch"]` → IntegrityError → 500 sin manejo. Ahora: 400 con mensaje «Ya existe un combo activo con este nombre.»
   - **Recrear tras soft-delete** → el DELETE es soft (`is_active=False`) pero la fila sigue ocupando el `unique`, así que recrear el mismo nombre daba 500. Ahora: se **reactiva el combo eliminado** (mismo id, nuevos datos, ítems reemplazados) → 201.
   - **Renombrar en edición** a un nombre ocupado (activo o eliminado) → 400 con mensaje claro.
   - Verificación final en vivo: crear 201 · duplicado 400 · editar 200 · soft-delete + recrear 201.
   - El frontend ya no envía `branch` (no pertenece al contrato).

## 6. Verificación final

- `bun run type-check`: ✅ verde.
- `bun run lint`: ⚠️ 4 errores **preexistentes** (no introducidos por esta iteración) en `pos/terminal/page.tsx` (476, 490, 492) y `sales/page.tsx` (1149): `react-hooks/set-state-in-effect` y `react-hooks/refs` en lógica de bootstrap (lectura de query params, refs de inicio de orden). Los archivos del módulo productos pasan limpios.
- `bun run build`: ❌ **falla preexistente del entorno**: Bun 1.3.11 crashea (segfault) al recolectar page data de `/menu/[slug]` (ruta cliente, no relacionada con estos cambios). El dev server (`next dev`) funciona y compila las rutas correctamente (verificado /login, /products → 200).
- Smoke de regresión a nivel API (dashboard, POS, caja, ventas): todos los endpoints clave responden 200.

## 7. Pendientes documentados (backlog, fuera de alcance)

- **Galería de imágenes de producto** (API `/inventory/gallery/` lista, sin cliente ni UI; el POS no muestra fotos).
- **CRUD de grupos de modificadores** (API lista; el frontend solo los consume en el POS).
- **Paginación real en POS/dashboard**: `page_size=1000` hardcoded — catálogos > 1000 productos se truncan silenciosamente.
- **Cadena proveedores → órdenes de compra → stock** desconectada: las OC no crean productos ni actualizan inventario (`SUPPLIER_PRODUCT` sin uso, `fetchSupplierProducts` muerto).
- **Unidades de medida**: texto libre, sin catálogo ni conversión.
- **Gestión de bodegas** en edición de producto (hoy solo al crear).
- **Listado de productos sin nutrición**: el serializer de lista del backend no expone `is_public`/nutrición → los badges de la página de nutrición y «Público en menú QR» dependen del detalle. Fix de backend sugerido: agregar esos campos a `ProductListSerializer` (solo lectura).
- **Lint preexistente** (4 errores en pos/terminal y sales) y **build roto por Bun** — ver sección 6.
- Combos: portar al source de Yggdra el parche del contenedor — resolver branch (`request.branch` / patron `BranchScopedCreateMixin`), 400 para nombre duplicado, reactivación tras soft-delete — ver sección 5. El parche del contenedor es efímero.

## 8. Bug reportado post-auditoría: filtros de Categoría y Tipo vacíos («solo Todos»)

**Síntoma**: en el listado de productos, los dropdowns de Categoría y Tipo no muestran opciones (solo los valores por defecto), incluso con la tabla cargada y tras hard refresh. Backend verificado OK con token admin (200 en `/inventory/categories/simple-list/` y `/branches/modules/product-types/`) y CORS/preflight OK — el fallo ocurría en el navegador, en silencio.

**Causa raíz (backend, Yggdra)**: `product-types` devuelve **403 «No tienes acceso a esta sucursal»** a roles que no sean `OWNER`/`ADMIN_LOCAL` (`apps/branches/views/branch_modules.py:1047-1055` → chequeo `role_definition__code__in=[ROLE_OWNER, ROLE_ADMIN_LOCAL]`). El viewset de categorías también aplica `ModuleRolePermission` vía `ERPBaseViewSet.get_permissions()`. Para un rol operativo (cajero/mesero/gelatiere), ambas queries fallan con 403 y la página no muestra error → opciones vacías. Con el token de admin (superuser) todo devuelve 200, por eso no se detectó en la verificación en vivo inicial.

**Fix aplicado (frontend, `apps/web`)** — resiliencia, sin ensanchar permisos:
- `lib/hooks/useBranchProductTypes.ts`: si la config de la sucursal no entrega ninguno de los 3 tipos gastronómicos (403 por rol o plan sin esos tipos), se usan como fallback `DIRECT_SALE` / `RECIPE_BASED` / `RAW_MATERIAL` con sus labels (constante `FRIG_DEFAULT_OPTIONS`). Aplica al filtro del listado y al select del formulario.
- `lib/hooks/useCategoryOptions.ts` (nuevo hook centralizado): usa directamente el listado paginado `/inventory/categories/` porque es el mismo endpoint de la página de Categorías y se verificó que trae datos; el endpoint `/inventory/categories/simple-list/` mostró comportamiento inconsistente (vacío aunque el paginado tuviera resultados). Expone `refetch` para forzar recarga. Reemplaza los usos dispersos de `fetchCategoryList` en:
  - `app/(app)/products/page.tsx` (filtro del listado)
  - `components/products/product-form.tsx` (select de categoría)
  - `app/(app)/products/menus/page.tsx` (categorías del menú QR)
  - `components/kds/kds-board.tsx` (categorías de estaciones de cocina)
- `lib/api/categories.ts:fetchCategoryList`: ahora filtra objetos inválidos (sin `id`) y maneja array, objeto individual o paginado de forma robusta.
- `app/(app)/products/page.tsx`: mensaje de diagnóstico visible debajo del select cuando no se cargan categorías (muestra la sucursal actual y botón "Reintentar").
- `components/ui/select.tsx`: bug crítico corregido — el componente no aplanaba children anidados (por ejemplo, `{array.map(...)}` dentro del select), por lo que las opciones generadas dinámicamente no se renderizaban. Ahora usa `React.Children.toArray()` + `React.isValidElement()`.

Verificación: `type-check` ✅, lint sin errores en los archivos modificados ✅.

> Nota backend (opcional): relajar `available_product_types` para que cualquier usuario con acceso a la sucursal (`BranchUser.is_active` + branch_id) pueda leer los tipos, igual que el catálogo — el POS ya consume ese endpoint.

## 9. Segunda iteración de auditoría E2E — validación de dashboard, POS, caja, ventas y productos

### 9.1 Alcance reconfirmado con el usuario

- **Tipos de producto que FRIG gestiona**: `DIRECT_SALE` (venta directa), `RECIPE_BASED` (producto compuesto) y `RAW_MATERIAL` (materia prima / ingrediente).
- **Fuera del alcance de Productos**: `SUPPLIER_PRODUCT` (pertenece a módulo Proveedores/ÓC), `MEASUREMENT_MATERIAL` (contexto APR/Smart Hydro), `SERVICE` (no se ofrece por ahora).
- `RAW_MATERIAL` **sí es necesario**: es el tipo de los ingredientes de receta y la base del cálculo nutricional de productos compuestos.

### 9.2 Validación de tipos de producto (frontend)

| Lugar | Comportamiento | Estado |
|---|---|---|
| `lib/hooks/useBranchProductTypes.ts` | Filtra la config del plan a los 3 tipos gastronómicos; fallback a los 3 si el endpoint falla. | ✅ |
| `app/(app)/products/page.tsx` | Filtro de Tipo usa `useBranchProductTypes`. | ✅ |
| `components/products/product-form.tsx` | Select de Tipo usa `useBranchProductTypes`; RAW_MATERIAL oculta precio de venta y checks de venta/QR. | ✅ |
| `app/(app)/pos/terminal/page.tsx` | Filtra el catálogo POS por `allowedProductTypes` derivado de `useBranchProductTypes`. | ✅ |
| `components/pos/product-card.tsx` | Muestra label del tipo vía `useBranchProductTypes`. | ✅ |

### 9.2.1 Dependencia del módulo Recetas / Nutrición

- En FRIG los 3 tipos de producto (`DIRECT_SALE`, `RECIPE_BASED`, `RAW_MATERIAL`) están siempre disponibles para venta, **independientemente de si el módulo de etiquetado nutricional está activo**.
- `useBranchProductTypes` ya no filtra por módulos activos: siempre expone los 3 tipos gastronómicos.
- El etiquetado nutricional sigue dependiendo exclusivamente del módulo `nutrition`.
- La sección de receta/ingredientes en el formulario aparece para productos compuestos sin condicionarse al módulo de nutrición.

### 9.3 Flujo producto compuesto → receta → ingredientes

| Paso | Comportamiento | Estado |
|---|---|---|
| Crear producto `RECIPE_BASED` | Guarda producto primero, luego receta + ingredientes. | ✅ |
| Ingredientes | Búsqueda de `RAW_MATERIAL` con ≥ 2 caracteres; valida cantidad > 0. | ✅ |
| Cambiar tipo fuera de `RECIPE_BASED` | Muestra aviso de receta huérfana (no se borra). | ✅ |
| Calcular nutrición desde receta | Requiere receta guardada; endpoint `calculate_nutrition` + PDF. | ✅ |
| `lib/api/recipes.ts:fetchRecipesByProduct` | Recorre páginas con `page_size=500`. Antes usaba `new URL(data.next)` sin base; corregido para soportar URLs relativas usando `API_BASE`. | ✅ |

### 9.4 Etiquetado nutricional

- Formulario editable con 11 campos (energía, proteínas, grasas, carbohidratos, sodio, etc.).
- Preview de etiqueta MINSAL en el formulario.
- Página `/products/nutrition` lista productos con datos nutricionales y permite calcular/descargar etiqueta para compuestos.
- Limitación conocida: el serializer de lista no expone campos nutricionales ni `is_public`; la página de nutrición depende del detalle para mostrar badges completos.

### 9.5 Mejoras de experiencia móvil (responsive)

Se hizo una pasada de responsive enfocada en el módulo Productos y páginas relacionadas:

| Archivo | Cambio |
|---|---|
| `components/ui/select.tsx` | Corregido bug de children anidados (`{array.map(...)}`) que ocultaba opciones dinámicas en móvil. |
| `app/(app)/products/page.tsx` | Header responsive con iconos cuadrados táctiles (36px); filtros en grid 1 col / 2 col según ancho; **vista de cards en móvil** en lugar de tabla, evitando scroll horizontal y rotura de layout; tabla conservada para desktop; paginación con textos compactos en móvil. Modal de bodegas reemplazado por componente dedicado. |
| `components/products/product-warehouses-modal.tsx` | Nuevo modal de bodegas: resumen de cuántas bodegas y stock total; tarjetas por bodega con tipo, ubicación, stock, mín/máx/reorden, alerta de stock bajo y fecha; al hacer clic en una bodega se ve el **historial de movimientos** con tipo, origen, cantidad, stock anterior/actual, fecha, usuario y notas. |
| `components/products/product-form.tsx` | Todos los grids (`grid-cols-2/3/4`) ahora se apilan en móvil (`grid-cols-1` o `grid-cols-2` → `sm:`); ingredientes de receta muestran nombre en fila completa en móvil; modal pasa a `z-[60]` y en móvil ocupa el 92% de la pantalla inferior con bordes redondeados arriba, evitando que el bottom nav lo tape. |
| `app/(app)/categories/page.tsx` | Header compacto, tabla con hint y scroll, acciones con iconos, paginación apilada. |
| `app/(app)/products/nutrition/page.tsx` | Padding responsive. |
| `app/(app)/products/menus/page.tsx` | Header compacto, tabla con hint y scroll, acciones con iconos cuadrados táctiles. |
| `components/products/product-type-help.tsx` | Nuevo componente explicativo de los 3 tipos de producto FRIG con íconos, descripción y ejemplos genéricos (no solo de heladería). |
| `components/products/product-form.tsx` | Muestra la tarjeta explicativa del tipo seleccionado debajo del select. |

### 9.6 Estado de la rama

- `bun run type-check`: ✅ verde.
- `bun run lint` sobre archivos modificados: ✅ verde.
- `bun run lint` global: ⚠️ 4 errores preexistentes en `pos/terminal/page.tsx` (476, 490, 492) y `sales/page.tsx` (1149): `react-hooks/set-state-in-effect` y `react-hooks/refs`.
- `bun run build`: ❌ crash de Bun 1.3.11 (`segfault` en `/_not-found`), problema del runtime/entorno, no del código.

### 9.7 Último ajuste — edición de productos cuando Recetas está inactivo

- `lib/store/session.ts`:
  - `useIsRecipesEnabled()` ahora detecta si `recipes` está activo como módulo independiente o como submódulo de `nutrition`. Si `nutrition` está activo y no hay una configuración explícita que desactive `recipes`, se asume que recetas está disponible (comportamiento real cuando se activa Nutrición con Recetas e Ingredientes).
  - Nuevo `useIsNutritionEnabled()` para el módulo `nutrition`.
- `lib/hooks/useBranchProductTypes.ts`: filtra a `DIRECT_SALE` cuando `recipes` no está activo; expone `recipesEnabled`.
- `components/products/product-form.tsx`:
  - Detecta productos legacy (`RECIPE_BASED`/`RAW_MATERIAL`) con recetas desactivadas.
  - No fuerza el cambio de tipo al abrir el formulario.
  - Deshabilita el selector de tipo y muestra un aviso amarillo explicativo.
  - Al guardar conserva el `product_type` original del producto, evitando mutaciones silenciosas.
  - **Etiquetado nutricional depende de `nutrition`**, no de `recipes`.
- `app/(app)/products/nutrition/page.tsx`: estado vacío si `nutrition` no está activo.
- Verificación: `type-check` ✅, lint sin errores en archivos tocados ✅.

### 9.8 Ajustes de formulario de producto

- `components/products/product-form.tsx`:
  - **Unidad de medida normalizada**: select con opciones comunes (`unidad`, `kg`, `g`, `litro`, `ml`, `porcion`, `docena`, `metro`, `cm`, `m2`, `caja`, `botella`, `lata`, `bolsa`) más opción **Otro…**. Evita discrepancias como `Kg` vs `kg`. El input libre normaliza a minúsculas.
  - **Unidad de medida por tipo**: visible para **Venta directa** y **Materia prima**; oculta para **Producto compuesto** (el compuesto se mide por el rendimiento de su receta).
  - **Stock por bodega**: en la creación, los campos **Cantidad inicial** y **Stock mínimo** se eliminaron del formulario principal. El stock solo existe si se activa "Gestiona stock por bodega". El panel de asignación a bodegas ahora incluye:
    - Cantidad inicial
    - Stock mínimo
    - Stock máximo
    - Alerta / punto de reorden
    - Ubicación en bodega
    - Si no se activa el check, el producto se crea sin stock inicial.
  - **Formulario por tabs/pasos**: Datos básicos → Precios y venta → Receta (solo compuestos) → Bodegas (siempre disponible en creación; entrar al tab activa automáticamente la gestión por bodega) → Nutrición (solo si el módulo de etiquetado nutricional está activo; de lo contrario el tab se oculta por completo). Navegación Anterior/Siguiente y envío solo en el último paso. Tabs con scroll horizontal en móvil. El tab Datos básicos está ordenado en filas de 2 columnas: Nombre/Código, Tipo/Descripción, Categoría/Unidad de medida.
- `components/products/product-actions-menu.tsx` (nuevo): menú de acciones rápidas por producto (Editar, Bodegas, Duplicar, Eliminar) en tabla y cards móviles.
- `app/(app)/products/page.tsx`: integra el menú de acciones y agrega función **Duplicar producto** (copia el detalle con nombre y código sufijados).
- Verificación: `type-check` ✅, lint sin errores en archivos tocados ✅.
### 9.9 UI/UX móvil — Combos y Categorías

- `app/(app)/products/combos/page.tsx`:
  - Vista de **cards en móvil** (tabla solo en `sm+`): nombre, descripción, precio, n° de productos, vigencia y estado.
  - **Menú de acciones rápidas** (`components/ui/actions-menu.tsx`): Editar, **Duplicar**, Eliminar — en tabla y cards.
  - `handleDuplicate`: copia el combo completo (items incluidos) con nombre sufijado `(copia)`.
  - Modal tipo **bottom-sheet** en móvil (`items-end`, `h-[92dvh]`, header/footer fijos con scroll interno) y centrado en desktop.
  - Estado vacío diferenciado (búsqueda sin resultados vs. sin combos).
- `app/(app)/categories/page.tsx`:
  - Mismo patrón: cards en móvil con icono, nombre y n° de productos; tabla solo en `sm+`.
  - Menú de acciones: Editar, **Duplicar** (crea copia con sufijo `(copia)`), Eliminar.
  - Estado vacío diferenciado y modal bottom-sheet en móvil.
  - Se eliminó el hint "Desliza la tabla horizontalmente" (ya no hay tabla en móvil).
  - Fix de tipos: `YggdraCategory.product_count` es `string` según el esquema generado; el plural de la card usa `Number(...)`.
- Verificación: `bun run type-check` ✅, `eslint` sobre ambos archivos ✅ (sin errores ni warnings).

### 9.10 Rediseño visual — Combos y Categorías

Objetivo: pasar de listados planos a vistas más impactantes, densas en información y 100 % responsive (móvil, tablet y desktop).

- `app/(app)/products/combos/page.tsx`:
  - **Tarjetas de resumen** en la parte superior: Total combos, Activos, Inactivos y Por vencer / Vencidos.
  - **Tabla desktop** rediseñada:
    - Franja de color a la izquierda según estado (activo = verde, por vencer = ámbar, vencido = rojo, inactivo = gris).
    - Icono circular con fondo de estado.
    - Precio resaltado, cantidad de productos como badge redondeado, vigencia con icono de calendario.
    - Toggle rápido de activación/inactivación (botón `Power`) y menú de acciones.
  - **Cards responsive** (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`):
    - Borde superior de color según estado.
    - Icono circular grande, nombre, descripción, precio destacado, productos incluidos, vigencia con alertas de "Vencido" / "Pronto".
    - Toggle `Power` en el header y `ActionsMenu` en el footer.
  - **Activación/desactivación inline**: `toggleActive` carga el combo completo y actualiza solo `is_active`, con invalidación de caché y toast.
  - **Estado vacío** con ilustración de folder, mensaje contextual y botón de creación.
- `app/web/src/app/(app)/categories/page.tsx`:
  - **Tarjetas de resumen**: Total categorías y Productos asignados.
  - **Colores distintivos por categoría**: paleta fija (emerald, blue, amber, rose, violet, sky, orange, lime) asignada de forma determinista por el nombre de la categoría.
  - **Tabla desktop** con franja de color izquierda, icono circular coloreado, badge de tipo y badge de cantidad de productos.
  - **Cards responsive** (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) con borde superior de color, icono, nombre, tipo y conteo de productos.
  - Menú de acciones rápidas (Editar, Duplicar, Eliminar) en tabla y cards.
  - **Estado vacío** ilustrado con botón de creación.
  - Fix lint: `categoryTypeLabel` acepta `string | null` para coincidir con el tipo generado de `YggdraCategory`.
- Verificación: `bun run type-check` ✅, `eslint` sobre ambos archivos ✅ (0 errores, 0 warnings).

### 9.11 Selector de productos con búsqueda en combos

- `components/ui/searchable-select.tsx` (nuevo): componente genérico de select con búsqueda filtrada en tiempo real.
  - Botón que muestra la opción seleccionada o placeholder.
  - Dropdown con input de búsqueda, icono de lupa, botón para limpiar y lista filtrada.
  - Cierra al hacer clic fuera.
  - `autoFocus` en el input cuando se abre.
- `app/(app)/products/combos/page.tsx`: reemplaza el `<Select>` nativo del campo **Producto** en cada ítem del combo por `<SearchableSelect>`.
  - Permite buscar entre miles de productos sin tener que scrollear una lista larga.
  - Convierte el valor string de vuelta a `number` para el payload.
- Verificación: `bun run type-check` ✅, `eslint` sobre archivos tocados ✅.

### 9.12 Ajuste visual — eliminar líneas de color y corregir ancho en Combos/Categorías

Feedback: los bordes de color lateral/superior lucían "muy IA"; se necesita un look más minimalista y coherente con el resto de la app.

- `app/(app)/categories/page.tsx`:
  - Se eliminó la paleta de colores determinista y la función `colorFor()`.
  - Se quitaron las franjas de color en la tabla y el borde superior de color en las cards.
  - Iconos y badges ahora usan `bg-secondary` / `bg-muted` con `text-muted-foreground`, igual que el resto de la app.
  - La tabla ahora usa `overflow-x-auto` y `min-w-[520px]` para no romper el ancho en desktop medio.
  - Las cards tienen `min-w-0` para respetar el grid responsive.
- `app/(app)/products/combos/page.tsx`:
  - Se eliminaron `bar` y `borderTop` del estado del combo.
  - Iconos en tabla y cards pasaron a fondo gris secundario (`bg-secondary`).
  - Se mantuvieron los badges de estado con colores suaves (igual que productos) pero sin líneas.
  - Resumen de estadísticas en una sola columna en móvil para evitar compresión de ancho.
  - Tabla con `overflow-x-auto` y `min-w-[640px]`.
  - Cards con `min-w-0` y fecha con `flex-wrap` para no desbordar.
- `components/ui/searchable-select.tsx`:
  - Se quitó `min-w-[16rem]` del dropdown para que no fuerce scroll horizontal dentro de cards estrechas.
- Verificación: `bun run type-check` ✅, `eslint` sobre archivos tocados ✅.

### 9.13 Separación clara de vistas: tabla desktop / cards móvil

- `app/(app)/categories/page.tsx` y `app/(app)/products/combos/page.tsx`:
  - Tabla visible solo en `sm+` (`hidden sm:block`).
  - Cards visibles solo en móvil (`sm:hidden`).
  - Se eliminaron las clases de grid multi-columna de las cards (ahora son siempre 1 columna, como tarjetas verticales de móvil).
- Verificación: `bun run type-check` ✅, `eslint` ✅.

### 9.14 Fix creación de categorías — branch_id requerido

Problema: al crear una categoría el backend respondía `{branch_id: ["Este campo es requerido."]}`. Aunque la API envía `X-Branch-ID`, el serializer de `CategoryProduct` requiere el campo explícito en el body.

- `lib/api/categories.ts`:
  - Nuevos tipos `CreateCategoryPayload` y `UpdateCategoryPayload` que extienden el request generado con `branch_id?: number`.
  - `createCategory` y `updateCategory` ahora aceptan esos payload ampliados.
- `app/(app)/categories/page.tsx`:
  - Importa `useCurrentBranch` para obtener la sucursal activa.
  - Al guardar o duplicar, incluye `branch_id: Number(branch.branch_id)` en el payload.
  - Si no hay sucursal activa, lanza un error claro antes de llamar a la API.
- Verificación: `bun run type-check` ✅, `eslint` ✅.
