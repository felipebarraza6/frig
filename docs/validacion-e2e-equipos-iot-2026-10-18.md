# Validación E2E — Equipos, registros manuales e IoT (prod 2026-10-18)

Validación **end-to-end en producción** del front Frig (`https://frig.yggdra.cl`, SHA `07a1a95`) contra la API Yggdra (`https://api.yggdra.cl`, ref informada `d283601`).  
Método: UI real (Chromium/Playwright) + probes HTTP autenticados. Capturas en `docs/evidencia/equipos-iot-2026-10-18/`.

**Sin deploys, merges ni secretos.** No se tocó Bizantino ni la cuenta de Claudia.

### Contexto de builds

| Pieza | Valor |
|-------|--------|
| Front prod | `07a1a95` (incluye release #20/#21 → Fase 1 GTM / IoT honestidad + gate equipos + nutrición) |
| Contrato OpenAPI visto en API | header `x-yggdra-schema-sha: ee966631…` |
| Repo backend | `felipebarraza6/yggdra_infra` **privado** — este entorno no pudo clonarlo ni leer PR #132 vía GitHub API (404). Referencia de contrato: `src/lib/api/types/yggdra.d.ts` en Frig + probes live |

### Usuario / sucursal de prueba

| Campo | Valor |
|-------|--------|
| Origen | Demo pública landing (`/api/public/landing-config/?group=frig` → `use_cases`) |
| Email | `bistro@demo.yggdra.cl` |
| Sucursal | **Bistro La Tranquera** (`login_slug=bistro`, `branch_id=13`) |
| Rol | OWNER |
| Módulos | `equipment` e `iot_telemetry` **habilitados** (IoT estaba off; se activó vía API `POST /branches/modules/{id}/enable/` y se revalidó en UI) |
| Contraseña | **no documentada** (nunca en commits/PR/logs del informe) |

Datos QA creados en la sucursal demo (limpiar después): equipos `QA Refri E2E UI`, `QA Cámara API2`; IoT `QA Device Cámara`, `QA UI Device Sensor`, conectores `QA Provider Keep` / `QA UI Provider`; lecturas/mantenimientos de prueba vía API.

### Confirmación / corrección de auditorías previas

Referencias: Frig PR #17 (`docs/auditoria-go-to-market-2026-10-17.md`) y hallazgos citados de yggdra_infra PR #132.

| Hallazgo previo | Veredicto 2026-10-18 en prod |
|-----------------|------------------------------|
| IoT parcial: **sin alertas UI / sin gráficos** | **CONFIRMADO.** Banner “En desarrollo: alertas… gráficos…”; tab Lecturas = tabla, sin charts. API sí expone `alert-rules`, `alert-channels`, `alert-triggers`, `readings/stats`. |
| Proveedores IoT **create-only** | **CONFIRMADO en UI** (copy explícito “solo alta” / “Solo lectura · editar próximamente”). **Corrección backend:** API acepta `PATCH` y `DELETE` en `/iot-telemetry/providers/{id}/` (probado). Gap = front wrappers/UI. |
| Equipos: **sin edit / status / mantenimiento** en UI | **CONFIRMADO.** Lista + crear + modal medición; status solo lectura; subtítulo “mantenimiento programado: próximamente”. API sí: `PATCH /equipment/profiles/{id}/`, CRUD `/equipment/maintenances/` (fecha no futura; create OK con fecha pasada). |
| Equipos **always-on** (sin gate) | **CORREGIDO en prod** (Fase 1 / #18): módulo `equipment` en settings; Desinstalar oculta menú y bloquea ruta. |
| Copy DGA/agua en IoT | **CORREGIDO en prod** (#18): labels tipo “Equipo / sensor (personalizado)”, “Sensores del local…”; sin columna DGA en lecturas. |
| Impresoras no modeladas en UI | **CONFIRMADO.** Sin pantalla de config de impresoras en Settings; PDFs térmicos vía API siguen siendo el camino. |

---

## 1. Tabla de resultados paso a paso

Estados: **PASS** / **FAIL** / **NOT AVAILABLE**. Evidencia = archivo bajo `docs/evidencia/equipos-iot-2026-10-18/`.

### 1.1 Equipos

| Paso | Resultado | Evidencia / nota |
|------|-----------|------------------|
| Login demo bistro | PASS | `01-login-form.png`, `02-post-login.png` |
| Settings módulos (Equipos + IoT instalados) | PASS | `03-settings-modules.png` |
| Listar equipos | PASS | `04-equipment-list.png` |
| Crear equipo | PASS | `05-…form.png`, `06-equipment-after-create.png` (toast “Equipo creado”) |
| Ver detalle | PASS | `07-equipment-detail-measure-modal.png` (modal = “detalle”) |
| Editar perfil (serie/fabricante/etc.) | NOT AVAILABLE | Sin formulario de edición |
| Cambiar status (activo/inactivo/roto) | NOT AVAILABLE | Status read-only en modal; API PATCH status **sí** funciona |
| Mantenimiento schedule/record | NOT AVAILABLE | Copy “próximamente”; API maintenances parcial (sin fechas futuras) |
| Eliminar / archivar | NOT AVAILABLE | Sin acciones en lista |
| Gate módulo off | PASS | `34–36` Desinstalar → sin `a[href=/equipment]`; deep link cae a dashboard |
| Gate módulo on (reinstalar) | PASS | `37-modules-equipment-reinstalled.png` |

### 1.2 Registros manuales (mediciones de equipo)

| Paso | Resultado | Evidencia / nota |
|------|-----------|------------------|
| UI registrar medición (form) | PASS | `07`, `08` — form valor/unidad/min-max |
| Guardar lectura in-range | **FAIL** | `08-equipment-reading-in-range.png` — toast **`branch: Este campo es requerido.`** |
| Lectura fuera de rango | **FAIL** | `09` — mismo 400; historial vacío |
| Historial en UI | FAIL / vacío | Consecuencia del 400 |
| Editar / eliminar lectura en UI | NOT AVAILABLE | Sin controles |
| Filtro por fecha en UI | NOT AVAILABLE | Sin inputs fecha |
| Validaciones unidades/rangos (API) | PASS (API) | Con `branch` en body: create OK; `is_normal=false` si value>max; PATCH/DELETE measurement OK |
| Causa raíz | P0 front | `createEquipmentMeasurement` en `src/lib/api/equipment.ts` **no envía `branch`**; backend lo exige en body (header `X-Branch-ID` no basta) |

### 1.3 IoT

| Paso | Resultado | Evidencia / nota |
|------|-----------|------------------|
| Página `/iot` + tabs | PASS | `12–16` |
| Copy neutral (frig #18) | PASS | Sin DGA/pozo; “Sensores del local…”; banner honestidad |
| Banner honestidad alertas/gráficos | PASS | `12`, `15`, `17` |
| Proveedor crear | PASS | `26–28` toast “Proveedor de telemetría configurado” |
| Proveedor editar/eliminar UI | NOT AVAILABLE | Copy “solo alta”; API PATCH/DELETE OK |
| Dispositivo crear | PASS | `29–30` toast “Dispositivo creado” |
| Vincular producto IOT | PASS (campo) | Form dispositivo incluye producto; cards muestran “Sin vincular” si vacío |
| Dispositivo editar/eliminar | PASS | Iconos lápiz/basura en cards (`12`, `30`) |
| Variables listar | PASS | `13`, `33` (p.ej. Temperatura vía API) |
| Lectura manual UI | PASS parcial | `31–32` modal existe; automatización chocó validación HTML5 en un campo; **API** `POST /iot-telemetry/readings/` OK |
| Historial lecturas | PASS | `17` tabla con 3.2 °C |
| Gráficos | NOT AVAILABLE | Copy “próximamente”; sin chart lib |
| Alertas umbral / notificaciones | NOT AVAILABLE | Banner en desarrollo; sin inbox |
| Simulator / webhook UI | NOT AVAILABLE | Solo `bulk_create` API + sync device |
| Gate IoT off | PASS | `38` toast “módulo iot_telemetry no está habilitado” + Activar módulo |
| Informe `/reports/equipment` | PASS | `23-reports-equipment.png` |
| Impresoras UI | NOT AVAILABLE | `24-settings-hub.png` |

---

## 2. Gaps priorizados

### P0

| ID | Gap | Impacto |
|----|-----|---------|
| **EQ-P0-01** | Mediciones manuales rotas en prod: FE no manda `branch` → 400 | Bitácora de equipos **inusable** (cold-chain manual vendible = no) |
| **IOT-P0-01** | Alertas/umbrales sin UI (API sí) mientras settings/landing pueden sobreprometer | No vender IoT como cerrado |
| **IOT-P0-02** | Sin gráficos / stats en UI (`readings/stats` existe) | Misma honestidad comercial |

### P1

| ID | Gap | Impacto |
|----|-----|---------|
| **EQ-P1-01** | Sin UI edit perfil / cambio status / delete|archive | Operación incompleta; API ya lista |
| **EQ-P1-02** | Sin UI mantenimientos (`/equipment/maintenances/`) | Agenda preventiva ausente |
| **EQ-P1-03** | Sin editar/borrar mediciones ni filtro fecha en UI | Historial no gestionable |
| **IOT-P1-01** | Proveedores create-only en UI (API PATCH/DELETE listos) | Ops de conectores a medias |
| **IOT-P1-02** | Sin UI alert-rules / channels / triggers | Motor backend inutilizado en Frig |
| **IOT-P1-03** | Device↔equipment unificación débil (“Sin vincular”) | Cold-chain fragmentado |
| **PRINT-P1** | Impresoras no configurables en UI | Gap GTM previo intacto |

### P2

| ID | Gap |
|----|-----|
| **IOT-P2-01** | Simulator/webhook documentado en UI; pairing hardware |
| **IOT-P2-02** | Realtime/offline badges más allá de `is_online` estático |
| **EQ-P2-01** | Assignments de herramientas (`/equipment/assignments/`) |
| **BE-P2** | Maintenances rechazan fecha futura (“no puede ser futura”) — bloqueará “programar” si no se ajusta semántica |

---

## 3. Plan de fix concreto

### 3.1 Front (frig)

| Prioridad | Cambio | Archivos / endpoints |
|-----------|--------|----------------------|
| P0 | Incluir `branch` (desde sesión/`X-Branch-ID` context) en `createEquipmentMeasurement`; tipar `branch: number` | `src/lib/api/equipment.ts`; callers `src/app/(app)/equipment/page.tsx` → `POST /equipment/measurements/` |
| P0/P1 | UI edit perfil + select status + delete/archive | `equipment/page.tsx` + `updateEquipmentProfile` ya existe → `PATCH /equipment/profiles/{id}/`, `DELETE …` |
| P1 | CRUD mediciones (edit/delete) + filtro fecha query | wrappers PATCH/DELETE measurements; UI historial |
| P1 | UI mantenimientos (lista + alta) | nuevo cliente `maintenances` → `/equipment/maintenances/` |
| P1 | Wrappers + UI edit/delete providers | `src/lib/api/iot.ts` (`updateTelemetryProvider`/`deleteTelemetryProvider`); `iot/page.tsx` ProviderModal |
| P1 | Pantalla mínima alertas: rules + channels + triggers acknowledge | OpenAPI `/iot-telemetry/alert-*`; o bajar copy settings si se difiere |
| P1 | Charts con `fetchTelemetryReadingStats` | `iot.ts` ya tiene `fetchTelemetryReadingStats` |
| P1 | Help guide IoT alineada a banner | `src/app/(app)/help/**` |

### 3.2 Backend (yggdra_infra)

| Prioridad | Cambio | Endpoints / área |
|-----------|--------|------------------|
| P0 (opcional defensa) | Aceptar `branch` omitido e inferirlo de `X-Branch-ID` en measurements create (compat FE viejo) | `POST /api/equipment/measurements/` |
| P1 | Documentar / exponer ingest webhook o token device para sensores | `devices.device_token`, `POST /iot-telemetry/readings/`, `…/bulk_create/`, `…/devices/{id}/sync_readings/` |
| P1 | Alert engine: verificar evaluación al ingest + canales EMAIL | `alert-rules`, `alert-channels`, `alert-triggers` |
| P1 | Maintenances: permitir `scheduled` futuro vs `performed` pasado (hoy “fecha no puede ser futura”) | `POST /api/equipment/maintenances/` |
| P2 | Modelo/config impresoras térmicas por sucursal | hoy solo PDF thermal; sin recurso printers en Frig |
| Nota | Repo privado no auditable desde este agente; contrastar con freeze OpenAPI en Frig y SHA prod |

### 3.3 Endpoints tocados / verificados en esta corrida

```
# Equipos
GET/POST   /api/equipment/profiles/
PATCH/DELETE /api/equipment/profiles/{id}/
GET/POST   /api/equipment/measurements/     # body.branch REQUIRED
PATCH/DELETE /api/equipment/measurements/{id}/
GET/POST   /api/equipment/maintenances/

# IoT
GET/POST   /api/iot-telemetry/providers/
PATCH/DELETE /api/iot-telemetry/providers/{id}/   # UI no usa
GET/POST   /api/iot-telemetry/devices/
PATCH/DELETE /api/iot-telemetry/devices/{id}/
GET/POST   /api/iot-telemetry/variables/
GET/POST   /api/iot-telemetry/readings/
GET        /api/iot-telemetry/readings/stats/
GET/POST   /api/iot-telemetry/alert-rules|channels|triggers/

# Módulos
POST /api/branches/modules/{id}/enable|disable/
POST /api/branches/modules/by_branch/toggle/
```

---

## 4. Resumen por área

### Equipos

**Funciona:** listar, crear (producto EQUIPMENT + perfil), ver “detalle” como modal de medición, gate de módulo (Desinstalar/Instalar), informe ligero `/reports/equipment`.  
**Falta:** editar perfil, cambiar status en UI, mantenimiento, eliminar/archivar. API de status/mantenimientos/mediciones (con `branch`) ya responde.

### Registros manuales

**UI rota en prod (P0):** el formulario existe y valida número/unidad/rango visualmente, pero el POST falla por `branch` requerido.  
**API OK** si se envía `branch`: create, `is_normal`, PATCH, DELETE. Sin filtro fecha ni edit/delete en UI.

### IoT

**Funciona:** módulos gated; copy neutral + banner honestidad (#18); tabs dispositivos/variables/lecturas/proveedores; alta proveedor; CRUD dispositivo (UI); listado lecturas; export CSV/Excel/JSON; sync button.  
**Falta:** edit/delete proveedores en UI; gráficos; alertas/notificaciones; simulator/webhook UI. Backend tiene stats + alert-* sin superficie Frig.

---

## 5. Artefactos

- Capturas: `docs/evidencia/equipos-iot-2026-10-18/` (39 PNG)
- Este informe: `docs/validacion-e2e-equipos-iot-2026-10-18.md`
- Cleanup sugerido en branch demo `bistro`: borrar productos/dispositivos/proveedores con prefijo `QA …`
