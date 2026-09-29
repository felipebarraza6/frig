# Plan backend Yggdra — cierre de producción FRIG

Fecha: 2026-09-26  
Front listo: checkout landing, planes en app, candado de suscripción, kanban de solicitudes, consola API, adjuntos en `custom_data`.  
Al volver: FRIG se enchufa a estos contratos **sin parches**.

Orden de ejecución: **1 → 2 → 3 → 4**. Cada ítem tiene contrato, permisos, aceptación y qué deja de hacer el front.

---

## 1. Checkout autenticado sobre sucursal existente (P0)

**Problema:** `POST /api/public/{group}-checkout/` siempre crea Organization + Branch + OWNER. Un dueño que ya tiene sucursal no puede renovar/cambiar plan pagando.

**Hacer**

`POST /api/branches/{id}/change-plan-checkout/`  
Auth: Token + `X-Branch-ID`  
Roles: OWNER de esa sucursal, o superadmin.

Body:

```json
{ "plan_id": "mensual" }
```

`plan_id` = slug del `GroupPlan` del grupo (mismo catálogo que `GET /api/public/{group}-plans/`).

Respuesta `201` (igual que el checkout público):

```json
{
  "checkout_id": "uuid",
  "payment_url": "https://…",
  "status": "PENDING"
}
```

Polling: reutilizar `GET /api/public/{group}-checkout/{checkout_id}/`.

Al `PAID`:

- Aplicar el `branch_module_plan` del GroupPlan (mismo efecto que `POST /branches/{id}/apply-plan/`).
- **No** crear Organization, Branch ni usuario.
- Extender o crear `OrganizationPlanSubscription` / historial de la sucursal.
- Si el plan tiene precio nulo (“a convenir”), `400` con `detail` claro.

**Aceptación**

- Owner logueado paga “Plan Mensual” → misma sucursal, mismo user, plan activo.
- Superadmin puede dispararlo para una sucursal ajena.
- Cajero recibe 403.

**Front al volver:** el botón Contratar del dueño deja de abrir el checkout público y usa este endpoint.

---

## 2. Cancelar suscripción el OWNER (P0)

**Problema:** `POST /api/branches/{id}/cancel-subscription/` responde que solo superadmin puede cancelar.

**Hacer**

Permitir **OWNER** de la sucursal (y superadmin).  
ADMIN_LOCAL, CAJERO, etc. siguen 403.

Efecto: `subscription_status=CANCELLED` (o equivalente), `plan` nulo o inactivo, historial con fila CANCELLED. No borrar la sucursal.

**Aceptación**

- Owner cancela → FRIG bloquea la app salvo Perfil / Ayuda / Solicitudes.
- Otro rol 403 con mensaje: “Solo el propietario puede cancelar el plan.”

**Front al volver:** reponer “Cancelar suscripción” en Perfil para OWNER.

---

## 3. Plan comercial en la sucursal (P1)

**Problema:** FRIG adivina el plan de venta cruzando `plan_name` (“Frig Mensual”) con `display_name` (“Plan Mensual”).

**Hacer**

En `GET /api/branches/{id}/` y/o `GET /api/branches/{id}/capabilities/`:

```json
"commercial_plan": {
  "plan_id": "mensual",
  "display_name": "Plan Mensual",
  "price_uf": "0.61"
}
```

o `null` si no hay suscripción comercial.

Tipar `capabilities` en OpenAPI con su payload real (hoy reusa `Branch`).

**Aceptación**

- Tras checkout (público o autenticado), `commercial_plan.plan_id` coincide con el GroupPlan pagado.
- Sin plan: `null`.

**Front al volver:** marcar “Actual” en la parrilla sin normalizar nombres.

---

## 4. Adjuntos de ticket (P1)

**Problema:** no hay endpoint de archivos en ticket/comentario. FRIG guarda data URLs en `ticket.custom_data.attachments` (tope ~5 archivos, ~1,8 MB comprimidos).

**Hacer** (espejo de `work-order-attachments`)

```
POST   /api/support/ticket-attachments/
GET    /api/support/ticket-attachments/?ticket={uuid}
DELETE /api/support/ticket-attachments/{id}/
```

Multipart: `ticket` (uuid), `file` (imagen/pdf), `description?`.  
Respuesta: `{ id, ticket, file, file_url, name, content_type, uploaded_by, created }`.

Permisos: solicitante del ticket, agente asignado, superadmin.

Opcional: `POST /api/support/comments/` acepte `file` y cree el adjunto ligado al comentario.

**Aceptación**

- Owner sube captura al crear ticket y al responder → `file_url` servible.
- Listado por ticket sin meter base64 en `custom_data`.

**Front al volver:** dejar de escribir `custom_data.attachments`; usar `file_url` en la galería.

Hasta que exista: **no borrar** el contrato de `custom_data.attachments` (FRIG ya lo usa).

---

## 5. Filtros de soporte que el front ya manda (P1, bajo)

Confirmar y documentar en OpenAPI:

| Query | Endpoint | Uso FRIG |
|---|---|---|
| `requester_email` | `GET /support/tickets/` | “Mis solicitudes” |
| `ticket` | `GET /support/work-orders/` | Agenda de visita del caso |
| `ticket` | `GET /support/comments/` | Hilo (ya funciona) |

Si `requester_email` se ignora, el dueño ve tickets ajenos de la sucursal.

**Aceptación:** tickets de otro email no aparecen al filtrar; OT de otro ticket no aparecen.

---

## 6. Seed / operación (P2, no bloquea código)

Por sucursal FRIG (o al provisionar checkout):

- Categorías: Duda, Incidencia, Feedback, Manual
- Una `SLAPolicy` activa (hoy FRIG intenta crearla si el rol puede)
- Crear ticket **exige** categoría + SLA → si el seed falta, el alta 400

Visita técnica:

- Estado ticket `PENDING_VISIT` = “Orden de Trabajo”
- Crear `WorkOrder` con `scheduled_date`, técnico, dirección, notas
- FRIG ya pinta la agenda si `GET /work-orders/?ticket=` devuelve filas

No hace falta endpoint nuevo de “agenda de sesión”: es la OT.

---

## 7. OpenAPI / consola (P2)

- `GET /api/schema/?format=json&app=<app>` estable (sales, inventory, accounts, branches, shared, support, finance, bank_accounts, invoices, promotions, recipes, nutrition)
- `requestBody` con `$ref` resoluble (FRIG arma el JSON de ejemplo de POST/PUT/PATCH)
- `capabilities` no tipado como `Branch`

---

## Fuera de este cierre

- Propinas, notificaciones, dashboards extra, devoluciones, juntar mesas
- Cookie httpOnly del token
- PDF de cotización (si no existe el endpoint, el botón sigue placeholder)
- PgBouncer / `max_connections` local (ops, no contrato)

---

## Checklist de vuelta al front

Cuando estos 4 estén en staging:

1. [ ] `POST /branches/{id}/change-plan-checkout/` + polling hasta PAID en sucursal existente  
2. [ ] OWNER `POST /branches/{id}/cancel-subscription/` → 200  
3. [ ] `commercial_plan` en GET branch  
4. [ ] `POST /support/ticket-attachments/` + listado por ticket  

Aviso y se cablea FRIG en una pasada (Contratar autenticado, Cancelar owner, badge de plan, adjuntos por URL).
