# Auditoría: módulos Nutrición y Menús digitales en Productos — FRIG

> Fecha: 2026-08-28 · Alcance: `apps/web` — gating de UI de `nutrition` y `public_catalog` en el módulo Productos.
> Estado: hallazgos marcados como **[CORREGIDO]** aplicados en esta misma fecha; el resto queda como backlog.

## 1. Síntoma reportado (producción)

- En el formulario de productos siempre aparecen el check "Este producto tiene información nutricional" y los inputs nutricionales, aunque el módulo de Nutrición esté desactivado.
- No se puede desactivar el módulo (o el cambio no se refleja): "siempre sale y no puedo desactivarlo".
- También aparecen elementos del módulo Menús digitales dentro de productos (check "Público en menú QR").

Ambos módulos (`nutrition`, `public_catalog`) son activables/desactivables desde `/settings/modules`.

## 2. Verificación en vivo contra Yggdra (localhost:8000)

- `GET /api/shared/frontend-config/?branch_id=1` → `modules: { enabled: [...], disabled: [], permissions: [...] }` (forma real actual del contrato).
  - `nutrition` aparece en `enabled` cuando la config de la sucursal lo tiene activo y **desaparece al desactivarlo** (verificado con el toggle).
- `POST /branches/modules/by_branch/toggle/` (nutrition off → on): el backend persiste `is_enabled: false` y `frontend-config` deja de incluir el módulo. El ciclo en backend funciona.

Conclusión: en el backend el mecanismo está sano; el problema está en cómo el **frontend** consume y mantiene fresco ese estado.

## 3. Hallazgos

| ID | Severidad | Hallazgo | Archivo | Estado |
|----|-----------|----------|---------|--------|
| N-A | **Alta** | El store de sesión persiste `modules` en localStorage y **nunca se refresca** al entrar a la app: `frontend-config` solo se pide en login / select-branch / toggle de módulos. Si el backend cambia (otra ventana, otro dispositivo, o un cambio hecho antes de recargar), la UI sigue mostrando secciones del módulo ya desactivado — la causa directa de "Nutrición siempre sale y no puedo desactivarlo". | `app/(app)/layout.tsx` | **[CORREGIDO]** |
| N-B | **Alta** | El check "Público en menú QR" (`is_public`) en el formulario de producto se muestra siempre (solo condicionado a `isSellable`), sin consultar el módulo `public_catalog` (Menús digitales). | `components/products/product-form.tsx` | **[CORREGIDO]** |
| N-C | Media | `normalizeModules` (forma 1) guardaba la **`permissions`** de cada módulo (`{read, write, delete}`) como `submodule_config`, contaminando el store: los checks de submódulos (`useIsSubmoduleEnabledFromConfig`, `useIsNutritionEnabled`) leían claves que no son submódulos. | `lib/store/session.ts` | **[CORREGIDO]** |
| N-D | Baja / backlog | El menú público `/menu/[slug]` muestra datos nutricionales de cada producto (`is_nutritional_ingredient`) sin distinguir si el módulo `nutrition` está activo. Es una ruta pública sin sesión: el frontend no conoce el estado de módulos de la sucursal — requiere que el backend lo exponga (p. ej. en el payload del catálogo público o excluyendo campos nutricionales si el módulo está off). | `app/menu/[slug]/page.tsx:213` | Backlog backend |
| N-E | Nota | Si el toggle falla con 403 (plan o permisos), el store hace rollback al estado anterior y se muestra toast ("módulo no incluido en el plan activo / sin permisos"). Un usuario en ese caso ve que "no puede desactivarlo" con el toast como única pista. Por diseño; revisar el plan de la sucursal si aplica. | `app/(app)/settings/modules/page.tsx` | Backlog plan |
| N-F | **Alta** | En `/settings/modules`, cuando un módulo configurable no tiene fila en `GET /branches/modules/by_branch/` (caso de módulos activos "por plan", como `nutrition` en Macanuo Bowl branch 5: sin fila en `by_branch` pero presente en `frontend-config.enabled`), la card se **sintetizaba como `is_enabled: false`**: la card mostraba "Inactivo" mientras el módulo estaba activo en toda la app (menú, form de productos, rutas), y el toggle accionaba en dirección contraria (activar en vez de desactivar). Causa directa de "no sé si está activado / el toggle no lo reconoce para desactivar". | `app/(app)/settings/modules/page.tsx` | **[CORREGIDO]** |

## 4. Fixes aplicados

1. **`app/(app)/layout.tsx`** — al montar la app (sesión + sucursal activa) se vuelve a pedir `frontend-config` y se actualiza el store (`setFrontendConfig`). Elimina el estado stale de localStorage y alinea la UI con los módulos activos del backend en cada carga completa.
2. **`components/products/product-form.tsx`** — el check "Público en menú QR" ahora solo se muestra si el módulo `public_catalog` está habilitado (`useIsModuleEnabledFromConfig("public_catalog")`), igual que el tab Nutrición depende de `nutrition`.
3. **`lib/store/session.ts` (normalizeModules forma 1)** — ya no copia `permissions` a `submodule_config`; el store queda con `{ is_enabled }` limpio y los checks de submódulos leen solo configuración real de submódulos.
4. **`app/(app)/settings/modules/page.tsx`** — las cards sintetizadas (módulo sin fila en `by_branch`, activo por plan/frontend-config) ahora toman `is_enabled` y `submodule_config` del store de sesión en vez de asumir `false`: la card refleja el estado real y el toggle desactiva/activa en la dirección correcta. El optimistic update agrega la fila al cache (flip inmediato también en cards sintetizadas) y el rollback la retira si la mutation falla.
5. **`app/(app)/layout.tsx`** — el refresco de `frontend-config` usa `user?.id` (primitivo) y un guard por sucursal (`refreshedBranchRef`): **depender del objeto `user` re-disparaba el efecto en cada respuesta** (`setFrontendConfig` reemplaza `user` con una referencia nueva) y generaba un **loop infinito de `GET frontend-config`** más re-renders en toda la app.
6. **`app/(app)/settings/modules/page.tsx`** — hardening del toggle contra clics encolados: `handleToggle` ignora clics mientras hay una mutation en vuelo (`isPending`), la card deja de ser clicable en ese estado, y `animKey` pasó de `Date.now()` (cambiaba en cada render → re-mount del pulso) a un valor estable mientras pendiente.

## 5. Verificación

- `bun run type-check`: ✅ verde.
- `eslint` sobre los archivos modificados: ✅ sin errores.
- Dev server (`next dev`): `GET /login` y `/` → 200.
- Ciclo backend re-verificado: toggle nutrition off → fuera de `frontend-config.enabled`; toggle on → de vuelta.
- Caso Macanuo Bowl (branch 5): `by_branch` sin fila de `nutrition` + `frontend-config.enabled` con `nutrition` → la card mentía como "Inactivo". Toggle API crea la fila y `frontend-config` la refleja (`enabled_by: 15` = el OWNER, verificado en vivo). Estado restaurado tras el diagnóstico.

## 6. Pendiente en entorno real

- Reproducir el síntoma original en el navegador del usuario (con su sesión) y confirmar que tras estos cambios el tab Nutrición aparece/desaparece según el módulo. En este entorno no se pudo completar la reproducción E2E (extensión WebBridge sin conectar al navegador), pero el flujo quedó verificado a nivel API y de código.