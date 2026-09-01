# Auditoría frontend FRIG — UI/UX, rendimiento, seguridad

> Fecha: 2026-08-28. Alcance: `apps/web` (Next.js 16, React 19, Tailwind 4, Zustand, TanStack Query 5).
> Estado: los hallazgos marcados como **[CORREGIDO]** ya están aplicados en esta misma fecha; el resto queda como backlog priorizado.

## 1. Resumen ejecutivo

La app está funcionalmente sólida (tipos OpenAPI generados, realtime por WebSocket, tokens multi-tenant bien pensados, `reducedMotion` respetado). Los problemas encontrados son de **acabado percibido** (golpes de layout, estados de carga, contraste white-label) y de **higiene de seguridad/rendimiento**, no de lógica.

## 2. Seguridad

### Críticos

- **[CORREGIDO] XSS por `return_to` sin validar** en `/pos/terminal` → `javascript:` u open-redirect desde un link, con robo del token en localStorage. Fix: whitelist `^\/(?!\/)` en `pos/terminal/page.tsx` (todos los usos).
- **[CORREGIDO] Cero headers de seguridad**: `next.config.ts` vacío. Fix: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`. **Pendiente**: CSP completa con nonce (requiere auditoría de scripts inline; el backend ya emite cookie `auth_token` HttpOnly — migrar el auth a cookie es la medida estructural).
- **Token DRF en localStorage** (`frig.token`): cualquier XSS = sesión robada. Mitigado parcialmente con lo anterior; la solución real es migrar a la cookie HttpOnly que Yggdra ya setea en login.

### Medios

- **[CORREGIDO] Cache de React Query no se limpiaba en logout** (equipos compartidos POS/tótem) → `queryClient.clear()` en ambos handlers de logout.
- **[CORREGIDO] `clearSession()` dejaba el blob `frig.session` en localStorage** → ahora hace `removeItem`.
- **[CORREGIDO] `document.write` del ticket con `orderLabel` sin escapar** en `<title>` → escapado igual que `content`.
- **Token en query string del WebSocket** (`useBranchWebSocket.ts`) — queda en access logs. Mover a subprotocolo o primer mensaje (requiere soporte en Channels).
- **Errores ≥500 crudos del backend llegan a toasts** — mostrar mensaje genérico en 5xx, detalle solo en log dev.
- **`xlsx@0.18.5` con CVEs conocidos** (CVE-2023-30533, CVE-2024-22363, sin fix en npm). Superficie baja (solo exportación, nunca `XLSX.read` de archivos ajenos). Opciones: tarball del CDN de SheetJS (0.20.x) o mover exportaciones a endpoints del backend.
- **Autorización 100% client-side** (roles leídos de localStorage): es UX, no seguridad. Verificar que Yggdra enforce permisos por endpoint (fuera de este repo).

### Menores

- `frig.session` persiste `user` completo en claro (excluir del `partialize` a futuro).
- Slug sin `encodeURIComponent` en `public-catalog.ts`.
- Fallback silencioso a `http://localhost:8000` si falta la env en producción → fallar ruidoso en build de prod.
- Drift de lockfiles: `package-lock.json` no contiene `xlsx`; `bun.lock` sí. Elegir un gestor.

## 3. Rendimiento

### Corregidos

- **`xlsx-js-style` (~300-800 KB) fuera del bundle del terminal POS** → import dinámico en `generateOrdersExcel`; igual para `xlsx` en `reports` y `warehouses/[id]`.
- **Re-render de toda la página del terminal por cada cambio del carrito** → selector primitivo (`cartTotal`) en vez de `s.items`; `handleAddProduct` con `useCallback`.
- **Búsqueda del catálogo (1000 productos) con `useDeferredValue`** → tipeo sin bloqueo.
- **Sidebar ya no empuja el contenido en hover** (era el layout shift más visible de la app): pin reserva `ml-60`, hover expande como overlay.
- **Animación `height: 0→auto` del sidebar** reemplazada por grid-rows (sin layout thrash).
- **Imágenes con `loading="lazy"`/`decoding="async"`** en `BrandLogo`.

### Pendientes (backlog)

- Reconciliar polling con WebSocket: hay `refetchInterval` de 10-30s en POS/KDS/mesas/sidebar **además** del WS que ya invalida esas queries. Dejar polling solo como fallback cuando el socket esté caído + debounce de ~300-500ms en `invalidateQueriesForEvent`.
- `framer-motion` en el root layout → `LazyMotion` o mover `MotionConfig` al grupo `(app)`.
- Refetch completo del catálogo (1000 productos) tras cada venta → actualizar stock con `setQueryData`.
- Normalizar query keys duplicadas (ver plan de API).
- `memo` de `ProductCard` sigue anulado por el `onKeyDown` inline por producto (requiere reestructurar el map o pasar handler estable).
- Shell 100% client-side: a mediano plazo, layout server con gate en boundary cliente acotado.

## 4. UI/UX

### Corregidos

- **Tokens faltantes** (`--color-accent`, `--color-primary-foreground`, `--color-secondary-foreground`) que dejaban hovers muertos y texto ilegible sobre el color de marca → definidos en `@theme` (light y dark).
- **Contraste white-label**: `applyThemeConfig` ahora deriva el foreground del primario/secundario por luminancia YIQ; `Button`, `Toaster` y `MobileMenuSheet` usan `text-primary-foreground` en vez de `text-white` hardcodeado.
- **Flash de tema (FOUC de marca)**: script inline pre-paint en el root layout que lee el tema persistido y aplica vars + `.dark` antes de hidratar.
- **~20 páginas con spinner genérico → skeletons geométricos** que replican la estructura final (products, tables, tables/map, customers, suppliers, payment-methods, inventory, warehouses, quotations, cash-register ×3, stations, bank-accounts ×3, profile, settings/modules, kds-board).
- **`loading.tsx` global en `(app)`**: la navegación entre rutas ya no queda en blanco.
- **`SkeletonPulse` duplicados eliminados** (dashboard, reports) → `Skeleton` compartido.
- **Toaster ya no tapa la bottom-nav móvil** (`bottom-24` en móvil).
- **Componente `Modal` compartido** (`src/components/ui/modal.tsx`) con portal a `document.body`, `AnimatePresence` + `m.div` (`domAnimation`), cierre con `Escape`, **focus trap** (Tab/Shift+Tab), scroll lock del body, restauración de foco al cerrar, `role="dialog"`, `aria-modal="true"`, `aria-labelledby/describedby`, soporte para sm/md/lg/xl/full, subcomponentes `ModalBody/ModalFooter/ModalSection/ModalHeader/ModalTitle/ModalDescription/ModalClose`. Migrados: `modifier-modal`, `combo-picker-modal`, `post-sale-modal`, `order-collect-modal`.
- **`PageHeader` compartido** (`src/components/page-header.tsx`): title `text-lg font-semibold`, subtitle `text-sm text-muted-foreground`, icono opcional en cuadrado `bg-primary/10`, badge opcional, acciones a la derecha. Aplicado en `reports` y `settings/modules` (kds/monitor se conserva con jerarquía TV).
- **`STATUS_STYLES` centralizado** (`src/lib/status-styles.ts`): `statusBadge`/`statusChip`/`statusDot` mapean estados a tokens `--color-success/danger/warning/muted` con contraste correcto en dark. Aplicado en `tables/page.tsx` (`STATUS_OPTIONS` ya no embebe colores; `statusColor()` consulta `statusBadge`). Pendiente extender a sales/kds-board/cash-register/inventory.
- **Focus rings en icon-buttons** de `tables/page.tsx` (Liberar, Libre, Transferir) y `tables/map/page.tsx` (Gestionar, Mover) con `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`.
- **`framer-motion` con `LazyMotion` + `domAnimation`** en `providers.tsx`: la lib ya no entra completa al bundle inicial de todas las rutas (incluidas login y menú público). Modo `strict={false}` para convivir con los ~100 `motion.X` ya existentes en el código; los componentes que no usan animación se benefician del tree-shake de `domAnimation`.

### Pendientes (backlog priorizado)

1. **Migrar los ~36 modales restantes** al componente `Modal` compartido (actualmente migrados 4: modifier, combo-picker, post-sale, order-collect). Mayor impacto en ventas, KDS, branches, products.
2. **Extender `STATUS_STYLES`** a `sales/page.tsx`, `kds-board.tsx`, `cash-register/page.tsx` e `inventory/page.tsx` (resto de los 39 archivos con colores hardcodeados).
3. **Headers de página restantes** (pos/page, pos/terminal, customers, suppliers, etc.) — `PageHeader` ya está disponible; migrar gradualmente.
4. **Radio de borde del tenant no se propaga** a cards (`rounded-xl/2xl` fijos) → mapear más radios a `--brand-radius`.
5. **Duraciones de motion dispersas** (0.12s a 0.8s) → constantes compartidas; `--brand-motion` y `--brand-compact` se definen pero nadie los consume.
6. **Re-animación con stagger en cada refetch** (sales) — las keys re-mountean con datos nuevos; animar solo en mount inicial.
7. **Menú móvil duplica reglas de permisos** distintas a las del sidebar/layout → unificar en un solo lugar.
8. **KDS móvil**: columnas apiladas con scroll anidado → tabs o scroll-snap.
9. **Modo oscuro desacoplado del surface de marca**.
10. **Reducir consumo del API**: implementar el plan en `docs/plan-madurez-api.md` (query keys centralizadas, `/api/pos/bootstrap/`, optimistic updates en KDS/mesas, etc.).

## 5. Auditoría: activar / desactivar módulos end-to-end

### 5.1 Fallas detectadas

| ID | Severidad | Falla | Archivo |
|----|-----------|-------|---------|
| M-A | **Crítica** | **Loop de redirección** para cajero/mesero: si un módulo se desactiva mientras el usuario operativo está en esa ruta, layout redirige a `/dashboard`, pero `/dashboard` no está en sus allowed paths → redirige a `/pos/terminal` → `/pos/terminal` puede estar deshabilitado → loop. | `app/(app)/layout.tsx:72` |
| M-B | Alta | **Dos `useIsRouteModuleEnabled`** con fuentes distintas: `useRouteModuleAccess.ts` lee session store (frontend-config, sin loading), `useBranchModules.ts` hace su propia query. Layout usa el primero, pero nada garantiza que estén sincronizados. | `lib/hooks/useRouteModuleAccess.ts` y `lib/hooks/useBranchModules.ts` |
| M-D | Media | **Sin optimistic update** en el toggle de `/settings/modules`: el usuario espera el round-trip para ver el cambio. Si la red falla, no hay rollback explícito del estado (la invalidación lo revierte pero la UI parpadea). | `app/(app)/settings/modules/page.tsx` |
| M-E | Media | **`RealtimeProvider` no escucha cambios de módulos**: si otro dispositivo/ventana cambia el estado, el sidebar y los guards quedan stale hasta `refetchOnWindowFocus`. Único WS scope: `pos/cash_register/dashboard/order`. | `components/realtime/realtime-provider.tsx` |
| M-F | Media | **`ForbiddenListener` matching por substring**: `rawMessage.includes('sales')` matchea "salesperson"; `'config'` matchea "configuration". Toast legítimos se silencian o se dejan pasar de más. | `components/forbidden-listener.tsx:33` |
| M-G | Media | **Rutas permitidas inconsistentes entre sidebar/mobile-menu/session**: sidebar cajero no incluye `/pos/terminal`; mobile-menu sí. Session store es la única fuente coherente. | `app-sidebar.tsx:81`, `mobile-menu-sheet.tsx:110` |
| M-I | Media | **`useIsNutritionEnabled` no respeta submódulos**: chequea solo `modules["nutrition"].is_enabled`, no `submodule_config.recipes/ingredients`. Una página de nutrición puede cargar datos que el submódulo no permite. | `lib/store/session.ts:449` |

### 5.2 Fixes aplicados

- **M-A**: helper `firstEnabledAllowedPath(allowedPaths, enabledSet)` en `lib/modules.ts`. El layout ahora redirige al **primer path permitido cuyo módulo sigue activo**, no a una ruta fija que pueda estar caída. Si todo cae, fallback a `/profile` (libre de módulo, siempre seguro).
- **M-B**: eliminada la copia de `useIsRouteModuleEnabled` en `useBranchModules.ts`; re-exporta desde `useRouteModuleAccess.ts` para mantener compatibilidad. Una sola fuente: session.modules del frontend-config.
- **M-D**: toggle mutation con `onMutate` (optimistic sobre query y session store), `onSuccess` reconcilia con respuesta del backend, `onError` hace rollback explícito desde el contexto y muestra toast diferenciado por tipo de error (plan/permisos/genérico).
- **M-E**: añadido scope `"modules"` en `useBranchWebSocket.ts` (`BranchEventScope`, `DEFAULT_SCOPES`) y en `RealtimeProvider` (`SCOPES`); `invalidateQueries(["branch-modules"])` cuando llega ese evento.
- **M-F**: matching por **word-boundary regex** (`\b(module)\b`) en lugar de substring; aplicado también al regex de "módulos secundarios" de POS.
- **M-G**: `app-sidebar.tsx` y `mobile-menu-sheet.tsx` reemplazan sus arrays locales por `useCashierAllowedPaths()`/`useWaiterAllowedPaths()` del session store. Coherencia total con el layout.
- **M-I**: `useIsNutritionEnabled` ahora exige `submodule_config.recipes !== false` Y `submodule_config.ingredients !== false`.

### 5.3 Fallas restantes (backlog)

- **FRIG_ALWAYS_ON_MODULES hardcodeado en frontend**: si el backend cambia un módulo de always-on a opcional, el frontend sigue mostrándolo sin chequear. Hoy no hay señal del backend para "este módulo es core de Frig" → documentar endpoint o flag.
- **Cache stale entre dispositivos**: si la app estuvo abierta en background >60s en otra ventana, los módulos pueden haber cambiado; el `staleTime: 60s` de TanStack no refresca salvo foco. Considerar `refetchInterval` de fondo o invalidación más agresiva en `visibilitychange`.
- **`/settings/modules` no avisa al usuario operativo**: si un cajero tiene sesión abierta y un admin desactiva POS desde otro dispositivo, el cajero verá la UI rota hasta refrescar. El WS ahora invalida la query pero falta un toast o banner explícito.
- **`useIsRecipesEnabled` siempre devuelve true**: oculto en la observación H/I; documentar la decisión de que recetas son core.

## 7. Pagos y caja (POS)

### Corregido

- **[CORREGIDO] Pago de órdenes de compra (OC) desde POS generaba egreso en caja para cualquier método de pago.** El modal `PayPendingItemModal` enviaba `cash_register_id` al backend en `/suppliers/purchase-orders/{id}/pay_order/` sin importar si el método era efectivo u otro. Yggdra registraba entonces un movimiento `CASH_OUT` que reducía el efectivo esperado en caja, aunque el pago se hiciera con transferencia/tarjeta/etc.
  - Fix (2026-09-01):
    - `pos-quick-actions.tsx` ahora pasa `payment_type` junto con los métodos de pago activos.
    - `pay-pending-item-modal.tsx` determina `isCashMethod = selectedMethod?.payment_type === "CASH"` y envía `cash_register_id` solo cuando el método es efectivo.
    - Para métodos no efectivos el pago se registra contra la OC sin tocar la caja del POS.
    - El botón "Registrar pago" se deshabilita si el método es efectivo y no hay caja abierta; el mensaje de advertencia solo se muestra en ese caso.
  - Archivos: `apps/web/src/components/pos/pos-quick-actions.tsx`, `apps/web/src/components/pos/pay-pending-item-modal.tsx`.

## 6. Verificación post-cambios

- `tsc --noEmit`: 0 errores.
- `eslint .`: 0 errores (3 warnings preexistentes: `<img>` en branch-theme-dialog, `window.location.assign` en client.ts).
- `next build`: 40/40 páginas generadas sin errores (build de producción con Node 20+ recomendado; Bun puede fallar según README).
