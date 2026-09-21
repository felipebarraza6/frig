# Auditoría de sucursales (branches) — FRIG frontend vs API Yggdra

Fecha: 2026-09-19 · Alcance: gestión de sucursales en el frontend FRIG contra
los endpoints `​/api/branches/*` del backend (ver `src/lib/api/types/yggdra.d.ts`).

## 1. Propuesta de gestión

La sucursal es la unidad operativa del sistema (datos fiscales, POS, módulos,
plan, usuarios, marca). La propuesta de UI es **una tarjeta = una sucursal
operando**, con la configuración integrada en la propia tarjeta:

- **Portada de marca**: degradé con el color primario de la sucursal, logo,
  badge de organización (vista super admin) y pill de estado Activa/Inactiva
  (clicable: alterna el estado vía `PATCH /branches/{id}`).
- **Grid de configuración 2×2** (un clic = el diálogo correspondiente):
  1. **Plan** — nombre + vencimiento con semáforo (rojo vencido, ámbar ≤ 7 días),
     abre `ApplyPlanDialog` (aplicar/renovar/cancelar suscripción).
  2. **Usuarios** — total + distribución por rol, abre gestión completa de
     usuarios (ver §3).
  3. **Marca** — punto de color + app_name + estado del logo, abre
     `BranchThemeDialog` (branding, colores, logo/favicon/banner).
  4. **Facturación SII** — estado de configuración y N° de resolución; se
     deshabilita si el módulo `invoices` no está activo en la sucursal.
- **Chips de módulos activos** (primeros 4 + "+N"): visibilidad inmediata de
  qué tiene operando cada sucursal.
- **Contacto**: teléfono, email, RUT, dominio personalizado y email remitente.
- **Acciones**: Editar (identificación, ubicación, acceso/dominio, plan,
  prueba) + toggle de activación.

Cabecera con resumen (total, activas, inactivas, usuarios, alertas de plan),
búsqueda y filtro por estado (server-side vía `?is_active=`), paginación.

## 2. Inventario API ↔ frontend

### Consumidos por el frontend (`src/lib/api/branches.ts`, `module-plans.ts`)

| Endpoint | Función | UI |
|---|---|---|
| `GET /branches/` (search, is_active, paginado) | `fetchBranches` | Lista + filtro estado |
| `GET /branches/{id}/` | `fetchBranch` | Refresco puntual |
| `POST /branches/` | `createBranch` | BranchForm |
| `PATCH /branches/{id}/` | `updateBranch` | BranchForm, toggle activo, SII multipart |
| `GET /branches/{id}/users/` | `fetchBranchUsers` | Diálogo usuarios |
| `POST /branches/{id}/invite-user/` | `inviteBranchUser` | Diálogo usuarios |
| `GET /branches/{id}/roles/` | `fetchBranchRoles` | Diálogo usuarios |
| `GET /branches/{id}/available-users/` | `fetchBranchAvailableUsers` | Asignar existente (super admin) |
| `POST /branches/{id}/users/assign/` | `assignBranchUser` | Asignar existente (super admin) |
| `POST /branches/{id}/remove-user/` | `removeBranchUser` | Menú de usuario |
| `PUT /branches/{id}/toggle_user_status/` | `toggleBranchUserStatus` | Toggle activo por usuario |
| `PUT /branches/{id}/update-user-role/` | `updateBranchUserRole` | Select de rol por usuario |
| `POST /branches/{id}/transfer-ownership/` | `transferBranchOwnership` | Menú de usuario (super admin) |
| `POST /branches/{id}/leave-branch/` | `leaveBranch` | Wrapper listo (sin UI propia) |
| `GET /branches/{id}/enabled-roles/` | `fetchBranchEnabledRoles` | Wrapper listo (roles + módulos) |
| `GET/PATCH /branches/{id}/theme-config/` | `fetch/updateBranchTheme` | BranchThemeDialog |
| `GET /branches/themes/`, `public-login-theme/{slug}/`, `…/by-host/` | `fetchBranchTheme*` | Login/branding global |
| `POST /branches/{id}/apply-plan/` | `applyBranchPlan` | BranchForm / ApplyPlanDialog |
| `POST /branches/{id}/cancel-subscription/` | `cancelBranchSubscription` | ApplyPlanDialog |
| `GET /branches/{id}/subscriptions/` | `fetchBranchSubscriptionHistory` | Wrapper listo |
| `GET /branches/{id}/capabilities/` | `fetchBranchCapabilities` | Wrapper listo (diagnóstico) |
| `GET /branches/modules/by_branch?branch_id=` | `fetchBranchModules` | Chips de módulos + gate SII |

### Campos del modelo `Branch` ahora visibles en UI

Datos: `business_name`, `fantasy_name`, `commercial_business`, `phone`, `dni`,
`email`, `region/province/commune/address`, `logo`. Estado: `is_active`,
`can_manage`. Multi-tenant: `organization_name` (badge en portada).
Plan: `plan_name`, `plan_expiration_date`. Equipo: `users_count`,
`users_by_role`. SII: `sii_config.sii_enabled/sii_resolution_number`.
Marca: `theme_config.{primary_color, logo, app_name}`.
Config: `allow_multi_branch_access`, `allow_public_customer_signup`,
`custom_domain`, `from_email` (nuevos en `BranchPayload`; escribibles vía
`BranchRequest` del spec).

### Endpoints del backend sin UI en esta pantalla (por diseño)

- `GET /branches/metrics/` — métricas agregadas; el spec reusa el schema
  `Branch` (tipado flojo). Para un dashboard multi-sucursal futuro: normalizar
  defensivamente antes de usar.
- `GET /branches/{id}/capabilities/` — devuelve suscripción + módulos + tipos
  de producto + diagnóstico de sync. Ya hay wrapper; falta UI de diagnóstico
  (candidato a un tab "Estado" en la tarjeta/detalle).
- `POST /branches/{id}/change-user-branch/`, `approve-pending-roles/`,
  `extra-fields/`, `extra-field-values/` — operaciones avanzadas de RRHH/roles
  pendientes de producto; no bloquean la gestión diaria.
- `my-branches`, `my-branches-select`, `set-active-branch` — usados por el
  branch switcher de sesión, no por esta pantalla.

## 3. Qué se implementó en esta pasada

1. **Página `branches/page.tsx` rediseñada**: filtros-indicadores en una fila
   (Sucursales / Activas / Inactivas / Usuarios / Planes por vencer, con
   conteo) con el buscador centrado debajo; tarjetas centradas, sin
   degradados (solo el color de marca en el punto de la tile Marca y el
   fallback del logo, para comportarse bien en cualquier tema).
2. **Módulos siempre traducidos**: mapa completo de slugs → etiqueta en
   español para los chips (`dashboard`, `sales`, `config`, etc. nunca se
   muestran crudos).
3. **Gestión completa de usuarios** (`branch-users-dialog.tsx`): lista con
   avatar/rol/estado, cambio de rol, activar/desactivar acceso, remover,
   invitar por email, asignar usuario existente (super admin) y transferir
   propiedad (super admin) con confirmaciones inline. Acciones como botones
   directos en la fila (el menú desplegable se cortaba dentro del scroll).
4. **Roles limitados a FRIG y dependientes de módulos** (`lib/roles.ts`):
   base siempre disponible — Propietario, Administrador local, Empleado;
   operativos según módulo activo — Cajero (POS), Mesero (Mesas),
   Repartidor (Retiro/Delivery). Los roles de otras apps del backend se
   filtran del selector de invitar y del cambio de rol. Si un usuario ya
   tiene un rol fuera del catálogo, se muestra solo en su fila para no
   perderlo al guardar.
5. **Permisos por rol**: propietario (o super admin) configura todo (editar,
   plan, marca, SII, activar/desactivar); administrador local solo gestiona
   usuarios; resto solo lectura. En la tarjeta se usa `role_code` de la
   sucursal + `can_manage`.
6. **Formulario de sucursal** (`branch-form.tsx`): nueva sección "Acceso y
   dominio" (multi-sucursal, registro público de clientes, dominio
   personalizado, email remitente).
7. **API**: wrappers nuevos para assign/remove/toggle/role/transfer/leave/
   enabled-roles/available-users; tipos `Branch`/`BranchPayload` extendidos.
   `BranchUser.user` puede llegar como id o como objeto anidado; el diálogo
   normaliza ambos formatos (corrige el "Usuario [object Object]").

## 4. Deuda conocida / riesgos

- Los payloads de `remove-user`, `toggle_user_status`, `update-user-role` y
  `transfer-ownership` no están tipados en el spec (reusan `BranchRequest`);
  se envía `{ user_id, … }` convención DRF. Si el backend espera otro nombre
  (`HTTP_USER_ID` header, `role` en vez de `role_definition`), el error llega
  con `detail` y se muestra en el toast — ajustar el wrapper en un solo lugar.
- `GET /branches/metrics/` y `capabilities/` requieren normalización propia
  antes de exponerse en UI (respuestas no tipadas en el spec).
- Las sucursales de una organización también se gestionan desde
  `organizations/` (vista holding); esta pantalla es la unidad por sucursal.
- El search del backend filtra por nombre/RUT/email según implementación; los
  placeholders de la UI lo describen así.
