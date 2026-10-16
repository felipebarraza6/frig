# Validación de gaps — Frig front (2026-10-16)

Auditoría **solo lectura** del frontend Frig (Next.js, export estático) contra la API Yggdra (`https://api.yggdra.cl/api`) y el contrato en `src/lib/api/types/yggdra.d.ts` (SHA `3566330…`).

**Objetivo:** priorizar gaps y mejoras antes de vender Frig con fuerza.  
**Alcance:** flujos de negocio, contrato FE↔API, roles/permisos de caja, UI/UX, a11y, performance, tests, seguridad, dead code y CI/CD (uso mínimo de GitHub Actions).  
**Método:** revisión de código + cross-ref con helpers de sesión, clientes API y workflows; sin cambios de código en este entregable.

**Política de caja (referencia del producto):** cualquier miembro de la sucursal puede **abrir** caja y hacer **cash in/out**; **cerrar**, **anular movimientos**, **acciones de histórico** y **reabrir** un día cerrado son **OWNER-only**.

---

## Veredicto

Frig cubre bien el núcleo operativo (POS, mesas, ventas, productos, soporte, multi-sucursal) y tiene contract tests útiles en venta/caja. **No está lista para vender “duro” sin cerrar P0 de caja, inventario y Flow menú público**, más el endurecimiento mínimo de permisos y cobro desde Ventas. Los P1 son deuda de producto/UX que se nota en demos y operación diaria.

---

## Top 10 quick wins

| # | Quick win | Por qué | Esf. | Ref. |
|---|-----------|---------|------|------|
| 1 | Gatear **Cerrar caja** en POS con `useCanManageCashMovements` | Alinea POS con política OWNER y con `/cash-register` | S | P0-01 |
| 2 | Quitar o condicionar `skip_cash_register_validation: true` en `OrderPayModal` | Evita cobros fuera de caja / arqueo incompleto | S | P0-02 |
| 3 | Distinguir **403 vs 404** en `getCurrentCashRegister` | POS no opera “sin caja” por permiso denegado silencioso | S | P1-01 |
| 4 | Escape en `DropdownPortal` | Cierra selects/menús en toda la app | S | P1-02 |
| 5 | Click-outside + Escape en dropdowns de cliente (sales + POS) | Dropdowns que quedan abiertos | S | P1-03 |
| 6 | `isError` ≠ empty en inventario y purchase-orders | Fallo de red deja de parecer “no hay datos” | S | P1-04 |
| 7 | Loading/error de estaciones en `/cash-register` | Evita flash “sin estaciones” | S | P1-05 |
| 8 | Guard de rol en `/cash-register/stations` | Impide CRUD de estaciones por URL al cajero | S | P1-06 |
| 9 | Deploy: no re-ejecutar lint/typegen/tsc (solo build + FTP) | Menos minutos de Actions | S | P1-07 |
| 10 | Paths-ignore `docs/**` en CI de PR | Validaciones de solo docs no gastan CI | S | P1-08 |

---

## Tabla priorizada

Leyenda de esfuerzo: **S** ≤ ~medio día · **M** ~1–3 días de trabajo técnico · **L** cambio de diseño/API o varios módulos.

### P0 — bloquear venta fuerte / riesgo de dinero o datos incorrectos

| ID | Hallazgo | Archivo:línea | Impacto | Fix sugerido | Esf. |
|----|----------|---------------|---------|--------------|------|
| P0-01 | POS permite **cerrar caja** a no-OWNER; `/cash-register` sí exige OWNER | `src/app/(app)/pos/terminal/page.tsx:2752-2758` vs `cash-register/page.tsx:775-776` + `session.ts:386-393` | Bypass de política OWNER-only vía terminal | Envolver el botón/mutación de cierre con `useCanManageCashMovements`; alinear copy | S |
| P0-02 | Cobro desde Ventas siempre salta validación de caja | `src/components/sales/order-pay-modal.tsx:82` (contraste: `cart-panel.tsx:576` usa `false`) | Arqueo incompleto; pagos sin estación/caja | Exigir caja/estación o `skip` solo con justificación explícita; alinear con POS | S–M |
| P0-03 | Cash in/out restringidos a `isRegisterController` (quien abrió + OWNER), no a “cualquier miembro” | `cash-register/page.tsx:581-589,895+`; `pos/terminal/page.tsx:531-539,2624+` | Política incumplida; ADMIN_LOCAL/CAJERO que no abrieron no pueden mover efectivo pese a helpers `canRegisterCashMovements` | Eliminar lock de opener **o** formalizar “solo quien abrió” en política/docs; alinear copy (“administrador” vs OWNER) | M |
| P0-04 | Inventario: tipo **TRANSFER** en formulario sin bodega destino; transfer real es otro endpoint | `inventory/page.tsx:40,1088-1094` vs `warehouses.ts` / `warehouse-inspector.tsx` | Usuario cree que transfiere; movimiento incompleto o stock inconsistente | Quitar TRANSFER del form o UI origen/destino + `transferStock` | M |
| P0-05 | **ADJUSTMENT** en backend fija `stock = quantity`; UI etiqueta solo “Cantidad” y no remapea | `inventory.ts:62-73`; form `inventory/page.tsx:38,1109-1118` | “Ajuste +5” puede dejar stock en 5 | UI “Stock resultante” o remapear delta; documentar semántica | M |
| P0-06 | Menú público Flow cobra **solo el primer ítem** del carrito | `public-menu-cart.tsx:108-128` | Cliente paga parcial; resto a WhatsApp | Checkout multi-ítem o bloquear carrito multi hasta soporte API | M–L |
| P0-07 | Resume Flow depende de `sessionStorage` en la pestaña origen; popup/otra pestaña no lo ve | `checkout-modal.tsx:201`; `checkout/result/page.tsx:24-32` | Post-pago no retoma polling si se cierra la pestaña origen | `localStorage` + `BroadcastChannel`, o return URL con `checkout_id` | M |
| P0-08 | Token de auth en `localStorage` + WebSocket con `?token=` | `session-storage.ts:1-14`; `useBranchWebSocket.ts:102-104` | XSS / logs / proxies = robo de sesión | Preferir cookie HttpOnly; WS sin token en query | L |
| P0-09 | Deploy FTP en claro (puerto 21) ×3 hosts | `.github/workflows/deploy.yml:70-103` | Credenciales/artefactos en tránsito | FTPS/SFTP o CDN; un solo artefacto | M |
| P0-10 | Bundle POS: Three.js / `TablesCanvas` (~3k LOC) importado estático | `pos/terminal/page.tsx:112`; `tables-canvas.tsx` | Terminal lento en dispositivos de caja | `next/dynamic` + `ssr: false` | M |

### P1 — demos, operación diaria, contrato y permisos

| ID | Hallazgo | Archivo:línea | Impacto | Fix sugerido | Esf. |
|----|----------|---------------|---------|--------------|------|
| P1-01 | `getCurrentCashRegister` trata 403 como “sin caja” (`null`) | `cash-register.ts:36-52` | POS opera sin feedback de permiso | Distinguir 404 vs 403 en UI/toast | S |
| P1-02 | `DropdownPortal` sin Escape | `dropdown-portal.tsx:102-116` | Menús/selects no cierran con teclado | `keydown` Escape → `onClose` | S |
| P1-03 | Dropdown clientes sin click-outside (sales + POS terminal) | `sales/page.tsx:2244-2282`; `pos/terminal/page.tsx:2012-2042` | Overlay pegado sobre el modal | Mousedown outside + Escape (como cart-panel) | S |
| P1-04 | Inventario / compras: error de red = empty | `inventory/page.tsx:211-214,536+`; `purchase-orders/page.tsx:340-354,1275-1288` | Falso “no hay datos” | Exponer `isError` + retry | S |
| P1-05 | Estaciones en caja: `_loadingStations` descartado; sin UI error | `cash-register/page.tsx:148-153` | Flash vacío / vacío falso | Usar `isLoading`/`isError` como en POS hub | S |
| P1-06 | `/cash-register/stations` sin guard de rol; cajero entra por URL (`startsWith("/cash-register")`) | `stations/page.tsx` (sin check); allowlist `session.ts:618` | CRUD estaciones fuera de política | Guard OWNER (o OWNER+ADMIN_LOCAL); path allowlist explícito | S |
| P1-07 | Deploy re-ejecuta lint + typegen + tsc (ya corridos en CI de `dev`) | `deploy.yml:52-62` | Doble gasto de minutos Actions | Deploy: solo `build` + post-export + upload | S |
| P1-08 | CI en todo `pull_request` sin `paths-ignore` | `ci.yml:10-13` | Docs-only PRs gastan lint/build | `paths-ignore: ['docs/**']` o label `run-ci` | S |
| P1-09 | Helpers dicen que MESERO puede abrir/registrar caja; allowlist WAITER **no** incluye `/cash-register` | `session.ts:400-426` vs `625-630`; layout `layout.tsx:234-238` | “Cualquier miembro” no es real para mesero/cocinero | Incluir ruta si aplica política, o acotar helpers | M |
| P1-10 | Copy “solo esa persona o un administrador” pero ADMIN_LOCAL ≠ `isRegisterController` | `cash-register/page.tsx:818-821`; `terminal/page.tsx:2624-2627` | UX engañosa; ADMIN_LOCAL bloqueado | Incluir ADMIN_LOCAL en controller **o** corregir texto | S |
| P1-11 | Action `POST …/orders/{id}/pay/` tipada como `OrderRequest` en OpenAPI; front manda `PayOrderPayload` | `yggdra.d.ts` (pay action); `orders.ts:164-178` | Typecheck no protege cobro | Backend `@extend_schema`; regenerar tipos | M |
| P1-12 | Semántica inventarios: LOSS/DAMAGE/EXPIRY remapeados a OUT negativo; `product_id` vs `product` en schema | `inventory.ts:62-99` | Drift permanente / 400 si el back cambia | Tipar action real; quitar workaround cuando el back reste bien | M–L |
| P1-13 | `cancel-movement`: schema UUID vs id numérico en FE | `cash-register.ts:13-24,134-141` | Anulación frágil | Alinear schema al PK real | M |
| P1-14 | PDF nutricional “branded”: toast promete logo; `logoDataUrl` no se pasa ni se dibuja | `nutrition/page.tsx:616-638`; `nutrition-label-pdf.ts:33,109+` (param muerto) | Expectativa vs PDF real | Pasar `fetchLogoDataUrl` e implementar dibujo, o bajar el copy | M |
| P1-15 | Feedback hub filtra por heurística de nombre/subject | `support/page.tsx:151-153` | Tickets sin prefijo no aparecen | Filtrar por `category_code === "feedback"` | S |
| P1-16 | Result Flow toma el **primer** `frig.checkout_id.*` | `checkout/result/page.tsx:24-29` | Grupo white-label incorrecto si hay varios | Clave por `group` en query/return | S |
| P1-17 | Polling checkout: timeout de red vuelve al form sin `setError` | `checkout-modal.tsx:142-147` | Usuario no entiende el fallo | Misma UX que EXPIRED/FAILED | S |
| P1-18 | Landing/checkout: tipos locales omiten `price_clp` / cuotas del plan | `checkout.ts:78-92`; `checkout-modal.tsx` | Planes CLP/cuotas del contrato no se reflejan | Usar schemas `PublicLandingConfig` / `GroupPlanPublic` | M |
| P1-19 | Modales ad-hoc sin focus trap / Escape (fuera de `Modal`) | p.ej. `pos-profile-button.tsx:61-99`; overlays en sales/POS | A11y teclado rota en terminal | Migrar a `Modal` / `AnimatedOverlay` | M |
| P1-20 | Sin skip-to-content / landmarks claros | `app/layout.tsx`; `(app)/layout.tsx` | Navegación teclado lenta | Link “Saltar al contenido” + `<main id>` | S |
| P1-21 | Contraste de temas tenant puede fallar WCAG | layout tema + `globals.css` muted | Lectura pobre en white-label | Validar luminancia al aplicar tema | M |
| P1-22 | N+1: queries por estación (POS) y módulos por sucursal | `pos/page.tsx:141-158`; `branches/page.tsx:233-239` | Pico de requests al entrar | Endpoint batch en API | L |
| P1-23 | Dual `xlsx` + `xlsx-js-style` | package.json; warehouse export | Bundle/install más pesado | Una sola lib | S |
| P1-24 | Solo 5 suites de test; sin UI/E2E ni coverage | `*.test.ts` (5); `vitest.config.ts` | Regresiones de cobro/caja/auth no detectadas | RTL para guards/Modal; 3–5 smokes; thresholds en `lib/api` | L |
| P1-25 | Gate de contrato soft-fail si curl falla | `ci.yml:53-56` | Drift OpenAPI puede pasar silencioso | Fail hard en `dev`/`production`; soft solo en forks | S |
| P1-26 | `useFeatureFlag` sin callers | `session.ts:571-572` | API muerta; flags backend no usados | Usar o eliminar | S |
| P1-27 | Soporte: cascada de endpoints oculta 404/400 reales | `support.ts:440-519` | Errores de deploy silenciosos | Tras estabilizar, un solo `/submit/` tipado | M |
| P1-28 | Dos caminos de cobro (POS `createPayment` vs Ventas `payOrder`) | `payments.ts:87-97`; `orders.ts:174-178` | Comportamiento de caja/descuentos diverge | Unificar política o documentar en producto | M |
| P1-29 | Guards 100% cliente; sin `middleware.ts` (coherente con `output: "export"`) | `(app)/layout.tsx:197-286`; `next.config.ts:8-9` | HTML de rutas “privadas” descargable; auth real = API | Documentar modelo; no confiar en UI para seguridad | S (doc) |
| P1-30 | `document.write` / `innerHTML` en preview nutricional | `nutrition/page.tsx:580-587` | Superficie XSS si el DOM se envenena | Sanitizar / clonar nodos de confianza | S |

### P2 — higiene, polish, deuda

| ID | Hallazgo | Archivo:línea | Impacto | Fix sugerido | Esf. |
|----|----------|---------------|---------|--------------|------|
| P2-01 | Escape faltante en menús de acciones de orden / product / perfil POS | `sales/page.tsx:414+`; `product-actions-menu.tsx:26-36`; `pos-profile-button.tsx:60-69` | Teclado incompleto | Listener Escape | S |
| P2-02 | `canViewHistory` abre link a admin de estaciones | `cash-register/page.tsx:1913` | ADMIN_LOCAL/MANAGER gestionan estaciones | Separar “ver histórico” vs “admin estaciones” | S |
| P2-03 | Superadmin: helpers de caja = true pero layout bloquea rutas operativas | `session.ts` helpers vs `layout.tsx:248-256` | Helpers engañosos | Documentar o devolver false fuera de contexto | S |
| P2-04 | Actions OpenAPI mentirosas (`payments/stats`, `process`, pay público, clients/stats) | `yggdra.d.ts` + clientes `payments.ts`, `public-catalog.ts`, `customers.ts` | Tipado inútil; front inventa interfaces | `@extend_schema` + sync | L |
| P2-05 | Casts/`ProductList` “porque el type no declara” campos que ya existen | `types/index.ts:3-9,36-67` | Ruido de tipos | Limpiar intersections | S |
| P2-06 | `PromotionDiscount.is_active` tipado string; live boolean | `discounts.ts:401-409` | Condiciones frágiles | Boolean en OpenAPI | S |
| P2-07 | Perfil: foto/cover solo en `localStorage` | `profile-appearance.ts` | No multi-dispositivo | Campos en Yggdra o aceptar límite | M |
| P2-08 | Sin UI de cuotas (`pay-installment` / subscription-payments) | OpenAPI vs front checkout | Planes en cuotas sin pantalla | Panel en perfil/suscripción | L |
| P2-09 | PDF backend nutricional ignora params (workaround cliente) | `nutrition-label-pdf.ts:1-6` | Doble implementación | Honrar params en back o documentar no-op | M |
| P2-10 | Rutas legacy redirects + `salon-demo` con canvas 3D | `reports/*`, `salon-demo/` | Ruido en export/bundle | Excluir demo de prod; limpiar redirects | S–M |
| P2-11 | `playwright-core` en dependencies sin uso en `src/` | `package.json` | Install más pesado | Mover a dev/quitar | S |
| P2-12 | `yggdra.d.ts` ~4.5 MB | `src/lib/api/types/yggdra.d.ts` | `tsc`/IDE lentos | Types parciales o exclude de watch | M |
| P2-13 | Tres patrones de overlay (`Modal` / `AnimatedOverlay` / ad-hoc) | components/ui + páginas | Drift a11y | Consolidar | M |
| P2-14 | `getToken` duplicado client vs session-storage | `client.ts:62-64`; `session-storage.ts` | Drift | Un solo módulo | S |
| P2-15 | CI con npm pese a `packageManager: bun` | workflows | Install más lento | setup-bun + cache (opcional) | S |
| P2-16 | Tres FTP seriales del mismo `out/` | `deploy.yml:70-103` | 3× transfer | Matrix o un host canónico + CDN | M |
| P2-17 | Demo salon puede mutar token de sesión | `salon-demo/mock.ts:14` | Contamina sesión real | Storage key aislada / clear on unmount | S |
| P2-18 | Imágenes `<img>` sin unificar en BrandLogo | login/politicas/checkout | Lazy/sizing inconsistente | Componente único | S |

---

## Matriz por flujo (resumen)

| Flujo | Estado | Notas clave |
|-------|--------|-------------|
| Ventas / POS | Operativo con gaps de caja | P0-01, P0-02, P1-28; toasts/empties sólidos |
| Mesas | Sano | Error/loading/empty + Escape en canvas |
| Caja | Helpers OK; UI desalineada | P0-01, P0-03, P1-01, P1-05, P1-06, P1-09 |
| Productos / recetas / nutrición | Operativo | P1-14 PDF logo; backend PDF stub |
| Inventario | Riesgo de stock | P0-04, P0-05, P1-04, P1-12 |
| Compras | Operativo | P1-04 error≠empty |
| Flow checkout (planes) | OK si pestaña origen vive | P0-07, P1-16, P1-17, P1-18 |
| Flow menú público | Incompleto | P0-06 |
| Soporte / feedback | Operativo | P1-15, P1-27 |
| Sucursales / multi-branch | OK | Switcher + `X-Branch-ID`; invalidación de queries |

---

## Roles y permisos de caja (detalle)

| Acción | Política | Helper | UI `/cash-register` | UI POS terminal |
|--------|----------|--------|---------------------|-----------------|
| Abrir | Cualquier miembro | `canOpenCashRegister` ✓ | Gated a miembro | Abre sin re-check del helper |
| Cash in/out | Cualquier miembro | `canRegisterCashMovements` ✓ | Bloqueado por `isRegisterController` ✗ | Igual ✗ |
| Cerrar | OWNER | `useCanManageCashMovements` ✓ | OWNER ✓ | Sin check ✗ **P0** |
| Anular movimientos | OWNER | idem | OWNER ✓ | N/A |
| Acciones histórico / reabrir | OWNER | idem | OWNER ✓ | N/A |

Enforcement FE = ocultar/deshabilitar. Las mutaciones API **no** re-chequean rol en el cliente; depende del backend. Verificar que Yggdra rechace close/cancel a no-OWNER.

---

## Seguridad (síntesis)

1. **Token en `localStorage`** (`frig.token`) — superficie XSS clásica (P0-08).  
2. **WS `?token=`** — fuga en logs/proxies (P0-08).  
3. **Static export** — no hay middleware SSR; guards en `(app)/layout.tsx` son el modelo correcto, pero **no** sustituyen auth de API (P1-29).  
4. **FTP plaintext** en deploy (P0-09).  
5. Un único `dangerouslySetInnerHTML` estático en layout (bajo riesgo); preview nutricional con `innerHTML` (P1-30).

---

## Tests y CI/CD

**Tests actuales (5):** `client.test.ts`, `sale-flows.contract.test.ts`, `support.test.ts`, `support-access.test.ts`, `login-slug.test.ts`. Cubren contrato de venta/caja y support; **no** cubren UI, a11y ni E2E.

**CI (`ci.yml`):** lint + typegen + tsc + vitest + build; gate de contrato soft si la API no responde.  
**Deploy (`deploy.yml`):** repite lint/typegen/tsc + build + 3× FTP.  
**Recomendación (mínimo Actions):** PR CI liviano (paths-ignore docs); deploy solo build+upload; un artefacto; FTPS cuando se pueda.

---

## Orden de ataque sugerido

1. **Semana de caja/cobro:** P0-01, P0-02, P0-03 (+ confirmar backend OWNER en close/cancel).  
2. **Inventario vendible:** P0-04, P0-05.  
3. **Flow menú + resume:** P0-06, P0-07.  
4. **Quick wins P1-01…P1-08** (tabla Top 10).  
5. **Perf POS + seguridad token/FTP** en paralelo (P0-10, P0-08, P0-09).  
6. **Contrato OpenAPI** (P1-11…P1-13, P2-04) con el equipo Yggdra.

---

*Documento generado en validación read-only 2026-10-16. No incluye cambios de código.*
