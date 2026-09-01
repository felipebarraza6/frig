# Auditoría del módulo Modificadores — FRIG

> Fecha: 2026-09-01 · Alcance: `/products/modifiers` (`apps/web`) vs API Yggdra (`/api/inventory/modifier-*`, `/api/inventory/product-modifier-groups/`).
> Método: revisión de código + schema OpenAPI generado + comparación funcional frontend/backend.

## 1. Resumen ejecutivo

El frontend ya puede crear, editar y eliminar **grupos de modificadores** y sus **opciones**, y los productos pueden tener grupos asignados desde el formulario de producto. El POS consume correctamente esos grupos al vender.

La brecha principal es que la vista de modificadores **no cierra el círculo de gestión**: un usuario que crea un grupo no puede ver **a qué productos está aplicado** ni gestionar esa asignación desde el mismo lugar. El backend sí expone ese dato.

## 2. Contrato del backend (Yggdra)

| Recurso | Endpoint | Capacidad relevante |
|---|---|---|
| Grupos | `GET/POST /api/inventory/modifier-groups/` | Listar/crear grupos |
| Grupos | `GET/PATCH/DELETE /api/inventory/modifier-groups/{id}/` | Detalle, edición, soft-delete |
| Opciones | `GET/POST /api/inventory/modifier-options/` | Listar/crear opciones |
| Opciones | `GET/PATCH/DELETE /api/inventory/modifier-options/{id}/` | Detalle, edición, eliminación |
| Asignaciones producto↔grupo | `GET /api/inventory/product-modifier-groups/` | **Soporta `?modifier_group={id}`** para listar productos de un grupo, y `?product={id}` para listar grupos de un producto |
| Asignaciones producto↔grupo | `POST/PATCH/DELETE /api/inventory/product-modifier-groups/{id}/` | Crear/editar/eliminar vínculo |

Campos importantes del modelo:

- `ModifierGroup`: `name`, `description`, `min_selections`, `max_selections`, `is_required`, `order`, `is_active`, `options`, `options_count`.
- `ModifierOption`: `group`, `name`, `surcharge`, `is_default`, `order`, `is_active`.
- `ProductModifierGroup`: `product`, `modifier_group`, `modifier_group_name`, `is_required` (sobrescribe el del grupo para ese producto).

## 3. Estado del frontend

### 3.1 Lo que ya funciona

| Función | Frontend | Backend | Estado |
|---|---|---|---|
| Listar grupos | `fetchModifierGroups()` | `GET /inventory/modifier-groups/` | ✅ |
| Crear/editar grupo | Modal en `/products/modifiers` | `POST/PATCH` | ✅ |
| Activar/desactivar grupo | Toggle en fila | `PATCH is_active` | ✅ |
| Eliminar grupo | Confirm + DELETE | Soft-delete en backend | ✅ (pero ver 4.3) |
| CRUD de opciones | `OptionsEditor` dentro del modal de grupo | `POST/PATCH/DELETE /inventory/modifier-options/` | ✅ |
| Asignar grupo a producto | Tab "Modificadores" en `ProductForm` | `POST /inventory/product-modifier-groups/` | ✅ |
| Sobreescribir `is_required` por producto | Switch en `ProductForm` | `PATCH` de `ProductModifierGroup` | ✅ |
| Consumo en POS | `ModifierModal` | Datos de `ProductModifierGroup` | ✅ |

### 3.2 Lo que falta para cerrar el círculo

| ID | Hallazgo | Severidad |
|---|---|---|
| M-1 | **No se ven los productos asignados a un grupo**. La página de modificadores solo muestra opciones; no indica qué productos usan el grupo. | Alta |
| M-2 | **No se puede desasignar un grupo de un producto** desde la vista de modificadores. Hay que abrir cada producto individualmente. | Media |
| M-3 | **No hay conteo de productos afectados** en el listado de grupos. | Baja |
| M-4 | **El mensaje de eliminación dice "no se puede deshacer"**, pero el backend hace soft-delete (`is_active=false`). La entidad sigue existiendo y podría reactivarse si el backend lo soporta. | Baja/UX |
| M-5 | **Orden de opciones (`order`) no se refleja en el POS**: el modal de modificadores las muestra en el orden que devuelve el backend, sin reordenar por `order`. | Baja |

## 4. Detalle de los hallazgos

### 4.1 M-1: Visibilidad de productos asignados (Alta)

**Evidencia técnica:**

- `apps/web/src/app/(app)/products/modifiers/page.tsx` lista grupos y expande opciones, pero nunca consulta `ProductModifierGroup` filtrado por `modifier_group`.
- `apps/web/src/lib/api/modifier-groups.ts` tiene `fetchProductModifierGroups(productId?)` que usa el filtro `?product=`, pero **no tiene** una función para `?modifier_group=`.
- El schema OpenAPI confirma que el listado acepta `modifier_group` como query param:
  ```ts
  inventory_product_modifier_groups_list: {
    query?: {
      modifier_group?: number;
      product?: number;
      page?: number;
      page_size?: number;
    };
  }
  ```

**Impacto:**
Un administrador que cree o edite un grupo no sabe si afectará productos existentes, ni puede auditar impacto antes de eliminar/desactivar.

**Recomendación:**
Agregar en la vista de grupos una sección expandible (o pestaña/modal) que liste los productos asignados, usando `GET /inventory/product-modifier-groups/?modifier_group={groupId}`.

### 4.2 M-2: Gestión bidireccional de asignaciones (Media)

**Evidencia técnica:**

- La asignación solo ocurre en `apps/web/src/components/products/product-form.tsx` (tab `modifiers`), función `saveModifierGroups()`.
- `apps/web/src/app/(app)/products/modifiers/page.tsx` no importa ni usa `removeProductModifierGroup` ni `assignModifierGroupToProduct`.

**Impacto:**
Para quitar un grupo de muchos productos hay que editar producto por producto.

**Recomendación:**
Desde la vista de modificadores, permitir al menos ver los productos vinculados y ofrecer un link para editar el producto. Opcionalmente, permitir desasignar directamente (requiere confirmación por impacto en ventas/POS).

### 4.3 M-3: Conteo de productos afectados (Baja)

El listado de grupos muestra `options_count` pero no hay un conteo equivalente de productos asignados. `ModifierGroupList` no incluye ese campo; se debe derivar del endpoint de asignaciones.

### 4.4 M-4: Mensaje de eliminación inconsistente con soft-delete (Baja/UX)

En `page.tsx`:
```tsx
if (confirm("¿Eliminar esta opción? Esta acción no se puede deshacer."))
```
El backend usa `ERPBaseViewSet` con `SoftDeleteMixin`; el DELETE pone `is_active=false`. El mensaje actual genera desconfianza si más adelante se habilita restauración.

**Recomendación:**
Ajustar el copy a "Se desactivará" o "Se eliminará lógicamente" si se confirma que el backend usa soft-delete.

### 4.5 M-5: Orden de opciones en POS (Baja)

`apps/web/src/components/pos/modifier-modal.tsx` itera `groupData.options` sin ordenar por `order`. Si el operador configura un orden específico, el POS puede no respetarlo.

**Recomendación:**
Ordenar por `option.order` antes de renderizar.

## 5. Acciones propuestas

1. **Alta prioridad**: implementar panel "Productos asignados" en `/products/modifiers`.
   - Nueva función `fetchProductModifierGroupsByGroup(groupId)` en `lib/api/modifier-groups.ts`.
   - Mostrar lista expandible al editar/expandir un grupo.
   - Cada ítem muestra nombre del producto y link a `/products` para editar.
2. **Media prioridad**: mostrar conteo de productos asignados en la fila del grupo.
3. **Baja prioridad**: corregir copy de confirmación de eliminación y ordenar opciones por `order` en POS.

## 6. Correcciones aplicadas (frontend, `apps/web`)

### 6.1 Visibilidad de productos asignados a un grupo (M-1)

- `lib/api/modifier-groups.ts`: nueva función `fetchProductModifierGroupsByGroup(groupId)` que consume `GET /api/inventory/product-modifier-groups/?modifier_group={groupId}&page_size=500`.
- `lib/api/products.ts`: filtro `ids` agregado a `ProductsFilter`; se envía como `id__in` para resolver nombres de producto sin N+1.
- `app/(app)/products/modifiers/page.tsx`: nuevo componente `GroupProducts` que lista los productos vinculados a un grupo con nombre, código y link directo a edición (`/products?edit={id}`). Se muestra en:
  - Modal de edición de grupo (pestaña **Productos**).
  - Vista expandida de cards móviles.
- Tabla desktop: nueva columna **Productos** con conteo de asignaciones.
- Cards móviles: nueva fila **Productos** en el resumen.

### 6.2 Asignación y desasignación de productos desde `/products/modifiers` (M-2)

- `GroupProducts` incluye un selector de productos activos para venta (`SearchableSelect`) y un botón **Asignar**.
- Al asignar se llama `POST /api/inventory/product-modifier-groups/` con `modifier_group` y `product`.
- Cada producto asignado tiene un botón de eliminar para desasignarlo (`DELETE /api/inventory/product-modifier-groups/{id}/`).
- Las queries se invalidan para mantener sincronizados el conteo y el listado.

### 6.3 Modal con pestañas

- El modal de editar grupo ahora tiene tres pestañas visibles: **General**, **Opciones** y **Productos**.
- Esto resuelve el problema de descubrimiento: antes la sección de productos quedaba oculta debajo del fold y el usuario no la veía.

### 6.5 Navegación directa a edición de producto

- `app/(app)/products/page.tsx`: envuelto en `<Suspense>` para soportar `useSearchParams`.
- `app/(app)/products/products-client.tsx`: lee el query param `edit` al montar y abre el formulario de edición del producto indicado; limpia el parámetro al cerrar el formulario.

### 6.6 Conteo en tiempo real (M-3)

- La página de modificadores carga todas las asignaciones una vez (`fetchProductModifierGroups()`) y construye un mapa `groupId → count` para mostrar el conteo sin llamadas extra.
- `components/products/product-form.tsx`: al guardar modificadores se invalida también la query global de asignaciones, así el conteo se actualiza al volver a `/products/modifiers`.

### 6.7 Modales de confirmación en lugar de `alert()` nativo

- Reemplazados los `confirm()` nativos por modales del componente `Modal` compartido:
  - Eliminar opción de un grupo.
  - Desasignar producto de un grupo.
  - Eliminar grupo (ya existía, se mantiene).
- Esto unifica la UX con el resto de la app y evita diálogos del sistema operativo.

### 6.8 Orden de opciones en POS (M-5)

- `components/pos/modifier-modal.tsx`: las opciones se ordenan por `order` antes de renderizar, respetando la configuración del grupo.

## 7. Verificación post-cambios

- `bun run type-check`: ✅ sin errores.
- `bun run build`: ✅ 47/47 páginas generadas.
- `bunx eslint` sobre archivos modificados: ✅ sin errores (solo warnings preexistentes).

## 8. Pendientes fuera de alcance

- Reactivar grupos/opciones eliminados: el backend usa soft-delete, pero no hay UI de restauración.
- Selector de productos con búsqueda remota lazy: hoy carga los primeros 1000 productos para venta y filtra localmente. Catálogos mayores requerirán paginación remota.
