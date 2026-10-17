# Auditoría go-to-market — Frig (2026-10-17)

Auditoría **solo lectura** del frontend Frig (`frig.yggdra.cl`, Next.js export estático) contra la API Yggdra (`https://api.yggdra.cl/api`, repo `felipebarraza6/yggdra_infra`).

**Objetivo:** decidir si Frig está **100 % listo para vender agresivamente**, con plan priorizado P0/P1/P2.  
**Entrega:** este único documento. **Sin cambios de código de aplicación.**  
**Método:** revisión de rutas (`src/app`), menú (`src/lib/modules.ts`), clientes API, contratos/tests, docs previas y OpenAPI (`yggdra.d.ts`).  
**Capturas:** no disponibles en este entorno (`node_modules` ausente; sin credenciales demo). La auditoría UI/UX es por código + contraste con API.

**Política de caja (producto):** cualquier miembro abre caja y hace cash in/out; **OWNER** (o superadmin) cierra, anula, histórico y reabre.

---

## Veredicto ejecutivo

**No está 100 % listo para vender “a muerte” sin matices.**  
El **núcleo POS/restaurante** (login por sucursal, multi-sucursal, POS, ventas, caja, mesas, KDS, catálogo, inventario, CRM, dinero, informes, menú público) está **operativamente maduro** tras PR #15. Se puede vender con fuerza el paquete gastronómico/comercial **si** se comunica honestamente:

1. **Seguridad/ops aún abiertos (P0 diferidos):** token en `localStorage`, WS con `?token=`, deploy FTP en claro.  
2. **Flow menú público:** multi-ítem bloqueado en front; falta checkout multi en backend.  
3. **IoT / equipos:** MVP usable (CRUD + lecturas), **no** producto cold-chain restaurant-grade (sin alertas UI, sin mantenimiento, copy DGA/agua).  
4. **Tests:** cobertura UI/E2E casi nula; solo contratos críticos.

**Veredicto comercial:** **GO condicionado** para POS/caja/ventas/CRM/inventario; **NO-GO** para vender IoT/maquinaria como diferencial cerrado; **NO-GO** absoluto solo si el cliente exige hardening de sesión/FTP el día 1.

---

## 0. Ítems ya resueltos (no repetir)

### De `docs/validacion-gaps-2026-10-16.md` (PR #14) → implementados en PR #15 (merged, en producción)

| ID previo | Tema | Estado |
|-----------|------|--------|
| P0-01 | POS cerrar caja gated OWNER | **RESUELTO** |
| P0-02 | Ventas: `skip_cash_register_validation: false` | **RESUELTO** |
| P0-03 | Cash in/out para cualquier miembro | **RESUELTO** |
| P0-04 | Inventario: TRANSFER fuera del form | **RESUELTO** |
| P0-05 | ADJUSTMENT = “Stock resultante” | **RESUELTO** |
| P0-06 UI | Flow menú: bloqueo si >1 ítem | **RESUELTO (mitigación UI)** — backend multi-ítem **sigue pendiente** |
| P0-07 | Checkout resume en `localStorage` | **RESUELTO** |
| P0-10 | `TablesCanvas` dynamic import | **RESUELTO** |
| QW3–QW10 | 403 caja, Escape/selects, isError≠empty, stations, deploy/CI docs | **RESUELTO** |

### Aún abiertos desde esa auditoría (diferidos / backend)

| ID | Tema | Estado |
|----|------|--------|
| P0-08 | Token `localStorage` + plan HttpOnly | **ABIERTO** — `docs/plan-token-httponly-ws-auth.md` |
| P0-08b | WS `?token=` | **ABIERTO** |
| P0-09 | FTP puerto 21 ×3 hosts | **ABIERTO** — `docs/plan-deploy-ftps-sftp.md` |
| P0-06 back | Checkout Flow multi-ítem | **ABIERTO** (`yggdra_infra`) |
| P1 inventarios | LOSS/DAMAGE/EXPIRY → OUT negativo | **Workaround FE** |
| PDF nutrición | Backend stub; PDF cliente | **LIMIT** |

---

## 1. Dependencias front → backend (`yggdra_infra`)

| Área | Dependencia | Notas |
|------|-------------|-------|
| API base | `NEXT_PUBLIC_YGGDRA_API_BASE` → prod `https://api.yggdra.cl/api` | `src/lib/api/client.ts` |
| Auth | Token DRF + header `X-Branch-ID` + `credentials: include` | Sesión en `localStorage` (`frig.token`) |
| Contrato | `src/lib/api/types/yggdra.d.ts` | Sync SHA; prod no publica OpenAPI JSON completo |
| Módulos | `/branch-modules/`, frontend-config | Toggle OWNER; always-on Frig en front |
| Caja/POS/ventas | orders, payments, cash-register | Enforcement real = API |
| Inventario | movements + warehouses transfer | TRANSFER UI → bodegas |
| Flow | checkout público 1 `product_id` | Multi-ítem requiere API |
| IoT | `/iot-telemetry/*` | Alertas/compliance en API sin UI |
| Equipos | `/equipment/*` | Maintenances/assignments en API sin UI |
| White-label | Deploy FTP a 3 hosts | `frig.yggdra.cl`, `intranet.macanuobowl.cl`, `mani.agenciapatagoniachile.com` |

**Sin secretos en este informe.** Credenciales viven en Actions/secrets, no en el código auditado.

---

## 2. Núcleo Frig — gaps y flujos rotos (post-#15)

### 2.1 Auth / login por sucursal

| Qué funciona | Gaps |
|--------------|------|
| `/login`, `/login/[slug]`, forgot/reset, branding por host/slug, `must_set_password`, `demo_expires_at` | Token en JS (P0-08); demos compartidas = superficie si XSS |
| Remember slug (`login-slug`) | Onboarding = set password; no wizard de “primer día” |

### 2.2 Multi-sucursal

| Qué funciona | Gaps |
|--------------|------|
| `/organization`, `/branches` (tema, plan, SII, usuarios), switcher, `X-Branch-ID` | N+1 módulos por sucursal (P1 histórico) |
| `/settings/modules` toggle OWNER | Submódulos compuestos sin UI (`recipes`/`ingredients` vía nutrition) |

### 2.3 POS / ventas / caja

| Qué funciona | Gaps abiertos |
|--------------|---------------|
| Terminal completo, estaciones, cobro, cuentas, mesas | Dos caminos cobro POS vs Ventas (política a unificar/documentar) |
| Caja alineada a política post-#15 | Mesero: helpers dicen “miembro” pero allowlist puede no incluir `/cash-register` |
| Cotizaciones | — |

### 2.4 Inventario / catálogo / nutrición

| Qué funciona | Gaps |
|--------------|------|
| Productos, combos, modifiers, categorías, bodegas, movimientos, OC | LOSS/DAMAGE remap OUT negativo (backend) |
| Nutrición + PDF cliente | Logo “branded” incompleto; backend PDF stub |
| Menús/QR públicos | Flow multi-ítem bloqueado |

### 2.5 CRM / dinero / informes

| Qué funciona | Gaps |
|--------------|------|
| Clientes, prospectos, pipeline, follow-ups, forms, surveys, promos | Rutas huérfanas: `/dash-fast`, `/finance`, `/banks` |
| Pagos con anulación OWNER/ADMIN_LOCAL | `/payment-methods` poco descubrible (no sidebar) |
| Informes ventas/ingresos/gastos/dinero/CRM/nutrition | — |

### 2.6 Flow / menú público

| Qué funciona | Gaps |
|--------------|------|
| Carta, totem, carrito, WhatsApp multi, Flow 1 ítem, resume post-pago | **Backend multi-ítem**; clave checkout multi-host (P1-16 histórico) |

### 2.7 Demo branches

Landing demos (`LANDING_USE_CASES`: pos, minimarket, comida, bistro, grande, heladería, pub, cafetería, gestión). Backend puede inyectar demos reales vía `PlanGroupDemoBranch`.

**Requisito producto:** demos con **acceso completo** y **módulos toggleables**.  
**Riesgo actual:** always-on hardcodeados en front (`FRIG_ALWAYS_ON_MODULES`); IoT toggleable; Equipos always-visible (`module: null`). Verificar en backend que planes demo habiliten `pos`, `cash_register`, `tables`, `inventory`, `nutrition`, `public_catalog`, `iot_telemetry` según el caso de uso.

---

## 3. Auditoría UI/UX pantalla a pantalla (app completa)

Leyenda: **OK** usable · **GAP** falta feature/descubrimiento · **LIMIT** incompleto/workaround · **ORPHAN** sin menú · **P0/P1/P2** prioridad UX.

### 3.1 Auth y landing

| Ruta | Acciones | Estado UI/UX | Gaps |
|------|----------|--------------|------|
| `/` landing | Demo cards, checkout planes, precios | OK | Promesas IoT/impresoras en preview marketing > realidad |
| `/login` | Login, branding, forgot | OK | Densidad animaciones; token storage invisible al user |
| `/login/[slug]` | White-label | OK | — |
| `/forgot-password`, `/reset-password/[token]` | Reset | OK | — |
| `/politicas` | Privacidad | OK | — |

### 3.2 Resumen

| Ruta | Acciones | Estado | Gaps |
|------|----------|--------|------|
| `/dashboard` | KPIs, filtros, deep-links, CRM widgets | OK | Workaround contador productos; error con retry |
| `/dash-fast` | Cubo 3D KPIs | **ORPHAN P1** | Invisible en sidebar; offline si counts fallan |

### 3.3 Informes

| Ruta | Estado | Gaps |
|------|--------|------|
| `/reports` → nutrition | OK redirect | — |
| `/reports/sales`, `revenues`, `expenses`, `money`, `nutrition`, `crm` | OK | Consistencia export CSV/Excel por informe |
| `/reports/equipment` | OK ligero | Sin export; sin IoT; ver §5 |
| Aliases `dinero/ingresos/gastos/finanzas` | OK | Deuda redirects |

### 3.4 Vender

| Ruta | Acciones | Estado | Gaps UI/UX |
|------|----------|--------|------------|
| `/pos` | Hub estaciones, abrir caja, CRUD estación | OK | Skeletons OK |
| `/pos/terminal` | Catálogo, carrito, cobro, caja, mesas, tickets | OK post-#15 | Modal/a11y mixto; archivo ~2.8k LOC; móvil con bottom bar |
| `/sales` | Historial, pagar, anular, DTE, export | OK | Filtros localStorage; muchos overlays |
| `/quotations` | Crear/convertir/export | OK | — |
| `/cash-register` | Abrir/movimientos/cerrar OWNER | OK | Copy/roles mesero a validar |
| `/cash-register/stations` | CRUD + guard | OK | — |

### 3.5 Local

| Ruta | Estado | Gaps |
|------|--------|------|
| `/tables` | OK CRUD/estados/transfer | — |
| `/tables/map`, `/full` | OK canvas dynamic | Perf en low-end |
| `/kds`, `/terminal`, `/monitor` | OK | **P2** monitor móvil columnas apiladas |
| `/salon-demo` | Demo mock aislada | No vender como feature; riesgo sesión si mock falla |

### 3.6 CRM

| Ruta | Estado | Gaps |
|------|--------|------|
| `/customers` (+ deuda, export) | OK | — |
| `/prospects`, `/pipeline`, `/follow-ups`, `/forms`, `/surveys` | OK | Empty/error distinguidos |
| `/promotions/discounts` | OK | — |
| Públicas survey | OK | — |

`docs/gaps-crm-pendientes.md`: 0 gaps internos (2026-09-30). Anulación de pagos **sí** está en UI hoy.

### 3.7 Catálogo / inventario

| Ruta | Estado | Gaps |
|------|--------|------|
| `/products`, combos, modifiers, categories | OK | Tipos filtrados Frig |
| `/products/nutrition` | **LIMIT P1** | PDF cliente; logo branded incompleto |
| `/products/menus` | OK | Modos lectura/WA/pago |
| `/warehouses`, `/warehouses/view` | OK | Transferencias aquí |
| `/inventory` | OK post-#15 | Semántica LOSS backend |
| `/equipment`, `/iot` | Ver §5 | — |
| `/suppliers`, `/purchase-orders` | OK | — |

### 3.8 Dinero

| Ruta | Estado | Gaps |
|------|--------|------|
| `/payments` | OK + void | Link a métodos |
| `/payment-methods` | OK | **P1 descubrimiento** (no sidebar) |
| `/revenues`, `/expenses`, `/fixed-expenses` | OK | — |
| `/finance` | **ORPHAN P1** | Hub útil sin menú |
| `/finance/settings` | OK | Impuestos, SII, CAF |
| `/bank-accounts`, `/reconciliations` | OK | — |
| `/banks` | **ORPHAN P1** | Lista bancos CL hardcodeada |
| `/tax-documents` | OK | — |

### 3.9 Ajustes / ayuda

| Ruta | Estado | Gaps |
|------|--------|------|
| `/organization`, `/users`, `/branches` | OK | — |
| `/settings/modules` | OK | Sin UI submódulos; copy IoT promete alertas no existentes |
| `/profile` | OK | Apariencia solo localStorage |
| `/help`, `/help/guides`, `/help/api` | OK | Help **excluye IoT** a propósito |
| `/support` | OK | — |

### 3.10 Público

| Ruta | Estado | Gaps |
|------|--------|------|
| `/menu/[slug]`, view, totem | OK | Flow 1 ítem |
| `/checkout/result` | OK resume | Multi-host keys |

### 3.11 Temas transversales UI/UX

| Tema | Hallazgo | Pri |
|------|----------|-----|
| Loading/error/empty | Mayoría de módulos OK post-#15 | — |
| Dead buttons | No hay patrón masivo; anulación pagos viva | — |
| Mock data | Solo `/salon-demo` | P2 |
| Consistencia | 3 overlays (`Modal` / `AnimatedOverlay` / ad-hoc) | P2 |
| A11y | Sin skip-to-content; focus trap irregular; Escape parcial | P1–P2 |
| Móvil | POS/caja pensados; KDS monitor débil | P2 |
| Impresoras | PDFs térmicos 80mm vía API; **sin UI de configuración de impresoras** | P1 config |
| Branding | Tema por sucursal OK; contraste WCAG tenant variable | P2 |

---

## 4. Testing — estado y plan

### 4.1 Tests existentes

| Archivo | Enfoque |
|---------|---------|
| `src/lib/api/sale-flows.contract.test.ts` | Cobro, caja, payOrder skip=false |
| `src/lib/api/inventory-movements.contract.test.ts` | ADJUSTMENT / LOSS remap |
| `src/lib/api/client.test.ts` | Auth redirect / headers |
| `src/lib/api/support.test.ts` | API soporte |
| `src/lib/support-access.test.ts` | Nav/roles soporte |
| `src/lib/login-slug.test.ts` | White-label slug |

**Conteo:** 6 suites Vitest (~40 tests tras #15).  
**Cobertura estimada:** **&lt;5 %** de superficie UI; **0** tests de componentes React; **0** E2E Playwright (solo dep `playwright-core` sin scripts).  
**CI:** lint + tsc + vitest + build; docs paths-ignore (QW10).

### 4.2 Qué está sin testear (crítico)

- Flujos UI: abrir/cerrar caja, cobro POS, transfer mesa, recepción OC.  
- Guards de módulos/roles (solo parcial en support-access).  
- Menú público Flow + checkout resume.  
- IoT/equipos (nada).  
- CRM pipeline drag/drop.  
- Nutrición PDF.  
- Multi-branch switch + invalidación queries.

### 4.3 Plan de tests priorizado

| Prioridad | Módulo | Unit/contrato | E2E smoke | Esf. |
|-----------|--------|---------------|-----------|------|
| **P0** | Caja + cobro | Extender sale-flows (close OWNER-only, cash in member) | Login → abrir caja → venta → cobro → cierre OWNER | M |
| **P0** | Auth/sesión | Cookie/token helpers cuando exista plan | Login slug + logout limpia storage | S–M |
| **P1** | Inventario | Movements contract + transfer warehouses | Ajuste stock resultante visible | M |
| **P1** | Menú Flow | Cart multi bloqueado; 1 ítem OK | Pago 1 ítem + resume `/checkout/result` | M |
| **P1** | Módulos | `getModuleForPath` / always-on / settings list | Toggle POS oculta terminal | S |
| **P1** | CRM | API clients mocks | Crear prospecto → pipeline | M |
| **P2** | IoT/equipos | CRUD API wrappers | Crear equipo + medición; device + variable | M |
| **P2** | Informes | Aggregations puros | Filtro fechas + CSV | S |
| **P2** | Nutrición | PDF generator snapshot | Abrir etiqueta | S |

**Meta mínima pre-venta agresiva:** P0 unit+1 e2e caja/cobro + P1 Flow smoke.

---

## 5. IoT y maquinaria — sección profunda UI/UX

### 5.1 Mapa de rutas / componentes

| Ruta | Archivo | Tabs / piezas |
|------|---------|---------------|
| `/iot` | `src/app/(app)/iot/page.tsx` (~1800 LOC) | Dispositivos · Variables · Lecturas · Proveedores + 4 modales |
| `/equipment` | `src/app/(app)/equipment/page.tsx` | Lista + CreateEquipmentModal + MeasureModal |
| `/reports/equipment` | `src/app/(app)/reports/equipment/page.tsx` | Resumen · Por bodega |
| API | `src/lib/api/iot.ts`, `equipment.ts` | Wrappers parciales vs OpenAPI |

**Nav:** Catálogo → Equipos (`module: null`, siempre) · Telemetría IoT (`iot_telemetry`) · Informes → Equipos.  
**Permiso UI:** ambos usan `useCanManageInventory` → `CrmDenied` si no.  
**Settings:** card IoT con copy de “alertas”; **sin card Equipos**.

### 5.2 Inconsistencia de módulos (GTM crítico)

| Hecho | Impacto |
|-------|---------|
| `/equipment` y `/reports/equipment` = `ROUTE_MODULE_MAP: null` | Siempre visibles aunque inventario/IoT off |
| `equipment` es submódulo de `inventory` en `COMPOSITE_SUBMODULES` pero **no gatea** la ruta | Doble verdad |
| `/iot` requiere `iot_telemetry` en settings | Telemetría ocultable; bitácora no |
| Deep link producto IOT → `/iot?product_id=` | **Muerto** (página no lee query) |
| Help guides excluyen IoT | Settings lo vende; help lo niega |

### 5.3 `/iot` — capacidades por pantalla

#### Tab Dispositivos

| Capacidad | ¿Hay? | Notas |
|-----------|-------|-------|
| Listar / buscar / CRUD | Sí | Filtro branch en API |
| Asignar sucursal | Sí (campo `branch`) | |
| Vincular producto tipo IOT | Sí | |
| Proveedor + token | Sí | **Token en claro en card** |
| Sync lecturas | Sí | `sync_readings` |
| Onboarding/pairing/QR | **No** | Alta manual |
| Detalle / config hidráulica / DGA editable | **No** | Tipos API existen |
| Proyectos | **No** | Cliente API sin UI |

**Empty/error:** OK con CTA y reintentar.  
**Copy:** tipos Pozo / Captación / Estanque / Flujo — lenguaje **agua/DGA**, no restaurante.

#### Tab Variables

| Capacidad | ¿Hay? |
|-----------|-------|
| CRUD, unidades, factor/offset, min/max, totalizador | Sí |
| Alertas al cruzar umbral | **No** (solo se guardan límites) |
| Charts | **No** |

#### Tab Lecturas

| Capacidad | ¿Hay? |
|-----------|-------|
| Lista (~100), lectura manual, export CSV/XLSX/JSON | Sí |
| Columna “Envío DGA” | Display only |
| Filtro fechas, stats, realtime, gráficos | **No** |

**Bug UX:** KPI “Lecturas Registradas” y export del header usan lecturas del dispositivo contextual, no del parque ni del tab activo.

#### Tab Proveedores

| Capacidad | ¿Hay? |
|-----------|-------|
| Listar + crear | Sí |
| Editar / eliminar | **No** (ni wrappers PATCH/DELETE en cliente) |
| Handlers tdata/thethings/tago | Industrial/hídrido |

### 5.4 API IoT sin UI (deuda)

En cliente sin pantalla: `fetchTelemetryDeviceDetail`, `fetchDeviceStatus`, `fetchTelemetryReadingStats`, projects CRUD tipado.  
En OpenAPI sin cliente/UI: **alert-channels, alert-rules, alert-triggers** (EMAIL/GOOGLE_CHAT/WEBHOOK/SMS/IN_APP — **no WhatsApp**), compliance-configs, device-configs, events, disconnected, bulk readings.  
→ El backend ya tiene motor de alertas; Frig **no lo expone**.

### 5.5 `/equipment` — capacidades

| Capacidad | ¿Hay? | Notas |
|-----------|-------|-------|
| Crear producto EQUIPMENT/TOOL + perfil | Sí | Status hardcode `AVAILABLE` |
| Asignar bodega / tipos medición al crear | Sí | |
| Registrar medición + min/max + historial 12 | Sí | Click fila = medir, no ficha |
| Editar perfil / status / serie / fabricante | **No** | `updateEquipmentProfile` existe |
| Mantenimiento (fechas, logs PREVENTIVE/CORRECTIVE) | **No** | OpenAPI `/equipment/maintenances/` |
| Assignments / types | **No** | OpenAPI sin cliente |
| Delete | **No** | |
| Puente a IoT | **No** | |
| Alertas / export / charts | **No** | |

**Roles:** solo managers de inventario; personal de piso (turno HACCP) no puede loguear temperatura sin ese permiso.

### 5.6 `/reports/equipment`

KPIs lecturas / fuera de rango / SKU por bodega — OK como reporte ligero. Sin export, sin IoT, sin drill-down a alertas.

### 5.7 Expectativa restaurante/producción vs realidad

| Expectativa cliente | Realidad |
|---------------------|----------|
| Cámaras frías, refrigeradores, hornos, sensores °C | Equipos = bitácora manual; IoT = pozo/caudal/DGA |
| Bitácora HACCP por turno + firma | Historial corto en modal |
| Alertas email/WhatsApp si T° > X | Umbrales sin motor UI; WA no en canales IoT |
| Onboarding sensor | Token + HTTP/MQTT manual |
| Mantenimiento preventivo | Campos API; UI cero |
| Vista unificada “mis máquinas” | Dos pantallas desconectadas |

**Posicionamiento:** IoT = herencia Smart Hydro/DGA; Equipos = MVP maquinaria + medición. **Ninguno cierra cold-chain restaurant-grade.**

### 5.8 Gaps UI/UX IoT/equipos priorizados

#### P0 (no vender IoT como cerrado)

| ID | Gap | Fix | Esf. |
|----|-----|-----|------|
| IOT-P0-01 | Gates inconsistentes (equipos always-on / IoT toggle) | Mapear `/equipment` a `inventory` o submódulo + card settings | S |
| IOT-P0-02 | Sin edit/delete equipo ni cambio de status | UI sobre `updateEquipmentProfile` + DELETE | S–M |
| IOT-P0-03 | Copy DGA/agua en Frig gastronómico | Labels restaurante; ocultar columna DGA por defecto | S |
| IOT-P0-04 | Deep link `?product_id` muerto | Leer searchParams y preseleccionar/crear | S |
| IOT-P0-05 | Umbrales sin alertas (copy engañoso settings) | UI mínima alert-rules + email; o bajar copy | M–L |
| IOT-P0-06 | Rol piso no registra lecturas | Separar “medir” vs “administrar” | M |

#### P1

| ID | Gap | Fix | Esf. |
|----|-----|-----|------|
| IOT-P1-01 | Sin detalle dispositivo / stats / charts | Usar detail+stats + chart | M |
| IOT-P1-02 | Proveedores create-only | PATCH/DELETE + mask secrets | S–M |
| IOT-P1-03 | Mantenimientos | Cliente + UI CRUD | M |
| IOT-P1-04 | Unificar equipo ↔ dispositivo IoT | FK opcional en perfil | M–L |
| IOT-P1-05 | Presets cámara/refri/horno | Templates variables+umbrales | M |
| IOT-P1-06 | Informe sin export | CSV | S |
| IOT-P1-07 | Token visible en cards | Mask + copiar | S |
| IOT-P1-08 | Help excluye IoT | Guía operativa | S |

#### P2

| ID | Gap | Fix | Esf. |
|----|-----|-----|------|
| IOT-P2-01 | Compliance DGA UI | Solo vertical agua | L |
| IOT-P2-02 | WhatsApp alerts IoT | Extender canales backend | L |
| IOT-P2-03 | Onboarding hardware QR/pairing | Wizard | L |
| IOT-P2-04 | Realtime WS/poll | Badge offline | M |
| IOT-P2-05 | Assignments herramientas | Checkout a personal | M |

### 5.9 Flujos de pantalla propuestos (producto)

1. **Catálogo → Equipos (ficha):** estado, bodega, serie, próximo mantenimiento, historial mediciones, “vincular sensor IoT”.  
2. **IoT → Onboarding restaurant:** elegir preset (cámara/refri/horno) → umbrales → canal email → dispositivo online.  
3. **Inbox alertas:** triggers acknowledge; deep link a lectura.  
4. **Turno HACCP:** pantalla simple “registrar T°” para roles de piso.  
5. **Mantenimiento:** agenda + log correctivo/preventivo.

---

## 6. Configurabilidad (sin código)

| Área | ¿Configurable sin código? | Notas |
|------|---------------------------|-------|
| Módulos on/off | **Sí** (`/settings/modules`, OWNER) | Always-on hardcodeados en front |
| Submódulos (recipes, equipment…) | **Parcial** | Sin UI de toggles compuestos |
| Roles / permisos | **Sí** (usuarios + roles API) | Guards FE + enforce API |
| Impuestos / SII / CAF | **Sí** (`/finance/settings`) | |
| Métodos de pago | **Sí** (`/payment-methods`) | Descubrimiento débil |
| Branding / tema | **Sí** (sucursales) | Contraste WCAG variable |
| Unidades | **Backend** producto | Labels tipados en front |
| Planes | Org + plan Frig fijo `FRIG_PLAN_NAME` | Nombre hardcodeado |
| Impresoras | **No UI** | Solo PDF thermal vía API |
| IoT proveedores | Create only | Credenciales en form |
| Bancos Chile | Lista hardcodeada `/banks` | |

### Hardcodes por cliente / white-label

| Nombre | Dónde | Tipo |
|--------|-------|------|
| **macanuobowl** / Macanuo Bowl | `deploy.yml`, tests slug, placeholders | Host white-label |
| **mani** / Agencia Patagonia | `deploy.yml`, test `mani-demo` | Host white-label |
| **frig.yggdra.cl** / frig@yggdra.cl | landing, client, políticas | Marca canónica |
| **Bizantino** | **No encontrado** en `src/` activo | — |
| Demos landing | Kiosco Express, Don Pepe, etc. | Marketing ficticio |

**Demo branches:** deben poder activar/desactivar POS, caja, mesas, inventario, nutrición, menú público, IoT desde `/settings/modules`. Equipos hoy no se puede apagar sin código — **gap P0 de configurabilidad**.

---

## 7. Checklist release readiness

| # | Criterio | Estado |
|---|----------|--------|
| 1 | POS + cobro + caja política OWNER | **OK** post-#15 |
| 2 | Ventas validan caja | **OK** |
| 3 | Inventario semántica clara (ajuste/transfer) | **OK UI**; LOSS backend pendiente |
| 4 | CRM operable | **OK** |
| 5 | Menú público Flow multi-ítem | **NO** (bloqueo UI) |
| 6 | Auth endurecida (HttpOnly, WS) | **NO** |
| 7 | Deploy cifrado | **NO** (FTP) |
| 8 | Módulos demo full + toggle | **PARCIAL** (equipos always-on) |
| 9 | IoT/equipos vendible cold-chain | **NO** |
| 10 | Tests e2e críticos | **NO** |
| 11 | Impresoras configurables | **NO** |
| 12 | Docs/help alineados a promesas settings | **PARCIAL** (IoT) |
| 13 | OpenAPI sync CI duro | **PARCIAL** |
| 14 | White-label 3 hosts estables | **OK operativo**; riesgo FTP |

**Listo para vender agresivamente el núcleo gastronómico:** sí, con caveats de seguridad/Flow.  
**Listo 100 % sin asteriscos:** no.

---

## 8. Plan por fases (esfuerzo técnico S/M/L)

Leyenda: **S** cambio acotado · **M** módulo o front+back ligero · **L** diseño/API multi-host.

### Fase P0 — bloqueadores para vender fuerte (núcleo + honestidad IoT)

| ID | Ítem | Dueño | Esf. |
|----|------|-------|------|
| P0-A | Comunicar / mitigar token+WS (o ejecutar plan HttpOnly) | Yggdra + Frig | L |
| P0-B | FTPS/SFTP o CDN deploy | Ops | M–L |
| P0-C | Flow multi-ítem API + quitar bloqueo front | Yggdra + Frig | L + S |
| P0-D | Smoke e2e caja/cobro + extender contract tests | Frig | M |
| P0-E | Gates equipos/IoT + edit equipo + copy restaurant + bajar promesa alertas **o** alertas mínimas | Frig (+Yggdra alertas) | S–M / M–L |
| P0-F | Demo branches: verificar módulos full + toggle IoT; apagar equipos si inventario off | Frig + back planes | S–M |

### Fase P1 — operación diaria y demos sin fricción

| ID | Ítem | Esf. |
|----|------|------|
| P1-A | Menú: `/payment-methods`, `/finance`, `/banks` o deep-links | S |
| P1-B | LOSS/DAMAGE nativo backend; PDF nutrición server o copy | M |
| P1-C | OpenAPI pay/schema publicado; sync CI | M |
| P1-D | IoT: detalle, charts, CRUD proveedores, mantenimientos, presets cold-chain | M–L |
| P1-E | Rol “registrar medición” piso; help IoT | M |
| P1-F | UI submódulos en settings | M |
| P1-G | Skip-to-content + consolidar Modal a11y críticos | M |

### Fase P2 — polish / escala

| ID | Ítem | Esf. |
|----|------|------|
| P2-A | KDS móvil; unificar overlays; status styles | M |
| P2-B | WhatsApp IoT; onboarding hardware; realtime | L |
| P2-C | Coverage umbral lib/api + RTL páginas | L |
| P2-D | Perfil multi-device; cuotas suscripción UI | M–L |
| P2-E | Quitar `playwright-core` unused / dual xlsx | S |

### Orden sugerido de ataque

1. **Honestidad comercial IoT** (P0-E copy/gates) — inmediato, bajo riesgo.  
2. **E2E caja/cobro** (P0-D) — confianza demo.  
3. **Flow multi** (P0-C) — desbloquea menú público.  
4. **Auth/FTP** (P0-A/B) — en paralelo con Yggdra/ops.  
5. **Alertas IoT reales** solo si se vende el módulo.  
6. P1 descubrimiento rutas + nutrición/inventario backend.

---

## 9. Matriz rápida por flujo (post-#15)

| Flujo | ¿Vender hoy? | Nota |
|-------|--------------|------|
| Auth multi-slug / white-label | Sí | Con caveat token |
| POS / mesas / KDS | Sí | Maduro |
| Caja | Sí | Política aplicada |
| Ventas / cotizaciones | Sí | |
| Catálogo / combos / modifiers | Sí | |
| Nutrición | Sí con caveat PDF | |
| Inventario / bodegas / OC | Sí | LOSS workaround |
| CRM completo | Sí | |
| Dinero / SII / billeteras | Sí | Métodos poco visibles |
| Informes | Sí | |
| Menú público + Flow | Parcial | 1 ítem / WA multi |
| IoT telemetría | **No como cerrado** | MVP + ADN DGA |
| Equipos / maquinaria | **Parcial** | Bitácora manual MVP |
| Soporte / help | Sí | Help sin IoT |

---

## 10. Resumen de 10 líneas (para PR / stakeholders)

1. **Veredicto:** GO condicionado al núcleo POS/restaurante; **no** 100 % sin asteriscos.  
2. P0 de caja/inventario/Flow-UI de la auditoría 2026-10-16 están **resueltos en producción (#15)**.  
3. Siguen abiertos: **token localStorage**, **WS ?token=**, **FTP claro**, **Flow multi-ítem backend**.  
4. UI/UX del núcleo: pantallas reales con loading/error/empty; rutas huérfanas `/dash-fast`, `/finance`, `/banks`.  
5. Tests: 6 suites contrato; **&lt;5 %** cobertura; falta e2e caja/cobro.  
6. IoT: CRUD+sync+export OK; **sin alertas UI**, sin charts, copy DGA, proveedores create-only.  
7. Equipos: create+medir OK; **sin edit/status/mantenimiento**; always-visible vs IoT gated.  
8. Config: módulos toggleables OK excepto equipos always-on y submódulos sin UI; sin impresoras.  
9. White-label macanuobowl/mani en deploy; **Bizantino no aparece** en código.  
10. Plan: honestidad IoT + e2e caja → Flow multi → auth/FTP → alertas solo si se vende IoT.

---

*Documento generado 2026-10-17. Solo lectura. No incluye secretos ni workflows nuevos.*
