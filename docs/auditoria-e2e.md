# Auditoría E2E — FRIG frontend vs backend Yggdra (schema vivo)

> Fecha: 2026-09-06 · Método: cruce automatizado 100% reproducible · Scripts: `scripts/api-audit/`
> Base: schema OpenAPI **en vivo** (`GET /api/schema/`, 4,3 MB) vs 295 llamadas API extraídas del código frontend (44 archivos).
> Complementa (no reemplaza): `auditoria-frig-vs-backend.md` (flujos), `plan-madurez-api.md` (deuda), `api-map.md` (mapa).

## 1. Veredicto

**El contrato está íntegro: 295/295 llamadas frontend resuelven a un endpoint real del schema vivo y 0 llamadas usan un método HTTP fuera de contrato.** El frontend cubre 279 de 1.916 operaciones (14,6%) en 207 de 1.085 paths (19,1%). No hay rotura; hay **1.637 operaciones de backend sin exposición UI** — el "máximo provecho" está ahí.

## 2. Cómo reproducir

```bash
# 1. Schema vivo del backend (Docker :8000)
curl -s http://localhost:8000/api/schema/ -o /tmp/opencode/yggdra-schema.yml

# 2. Extraer y cruzar
python3 scripts/api-audit/extract_schema.py
python3 scripts/api-audit/extract_frontend.py src
python3 scripts/api-audit/crossref.py      # match llamadas ↔ paths + sin-match
python3 scripts/api-audit/report.py        # cobertura por dominio + drift
```

Salidas en `/tmp/opencode/`: `backend-paths.json`, `frontend-calls.json`, `crossref.json` (usadas/no usadas/sin-match), `report.json` (cobertura por tag + drift).

## 3. Matriz de cobertura por dominio

```
  0.0%    0/227  ai-agents          0.0%    0/86  scheduling
  0.0%    0/87  support            0.0%    0/80  employees
  0.0%    0/79  iot-telemetry      0.0%    0/42  logistics
  0.0%    0/41  crm                0.0%    0/39  services
  0.0%    0/30  documents          0.0%    0/32  equipment
  0.0%    0/24  workflows          0.0%    0/23  production
  0.0%    0/19  campaigns          0.0%    0/19  currencies
  0.0%    0/16  surveys            0.0%    0/19  unified-config
  4.5%    3/67  shared            14.3%    8/56  recipes
  9.3%    7/75  customers         20.8%   43/207 inventory
 13.7%   17/124 branches          25.0%    3/12  analytics
 14.3%    3/21  external-apps     26.2%   33/126 sales
 29.5%   13/44  accounts          35.0%    7/20  public-catalog
 46.7%   99/212 finance            50.0%    7/14  tables
 52.3%   23/44  suppliers          70.6%   12/17  promotions
```

Los 16 dominios en 0% son verticales que Yggdra (plataforma horizontal) expone pero que FRIG (POS gastronómico) no necesita hoy: RRHH, IoT, soporte, producción, etc. **No son deuda — son alcance.** La oportunidad está en los dominios que FRIG sí usa a medias (§4).

## 4. Oportunidades de mayor provecho (backend listo, UI ausente)

Ordenadas por valor/effort. Todas verificadas contra el schema vivo.

### P1 — Alto valor, bajo effort (endpoints listos, faltan pantallas o secciones)

| Oportunidad | Endpoints | Valor |
|---|---|---|
| **Propinas** (roadmap) | `GET/POST /api/sales/tips/`, `GET /api/sales/tips/by-employee/` | Feature anunciada en README; API completa sin UI |
| **Menú del día** | `/api/sales/daily-menus/` + `add-item/`, `toggle-active/` | Diferenciador gastronómico natural |
| **Analytics de ventas** | `GET /api/sales/analytics/by-day/`, `by-hour/` | Gráficos sin cálculo cliente |
| **Stats de cotizaciones** | `GET /api/sales/quotations/stats/` | Cierra el módulo cotizaciones ya en curso |
| **Dashboard de órdenes** | `GET /api/sales/orders/dashboard/` | Métricas agregadas para el home |
| **Boleta SII** | `POST /api/sales/invoicing/{id}/generate-boleta/`, `boleta-status/`, `download-boleta/` | Documentación tributaria completa sin frontend |
| **Notificaciones** | `GET /api/shared/notifications/my_notifications/` | Campanita de avisos (caja, KDS, stock) |
| **Entitlements** | `GET /api/shared/app-status/user-app-permissions/` | Decidir módulos del menú por permiso real, no solo por plan |
| **Clientes: stats y bulk** | `GET /api/customers/clients/stats/`, `total/`, `bulk_import/` | Cabeceras de métricas + carga masiva |

### P2 — Medio effort (extienden módulos existentes)

| Oportunidad | Endpoints | Nota |
|---|---|---|
| **Dashboards analíticos completos** | `/api/analytics/dashboard/{orders,customers,inventory,time_series}/`, `financial-dashboard/cash-flow/`, `income-expense/` | La app usa solo `summary`, `module_counts`, `ingredient-consumption` de 12 ops |
| **Rentabilidad (A-5 conocido)** | `/api/finance/financial-metrics/summary/`, `top_performers/` | Cliente exportado, hoy 1 consumidor (`finance/page.tsx`) |
| **Cuentas bancarias de clientes** | `/api/finance/client-bank-accounts/` | Transferencias a datos del cliente |
| **Propina por empleado** | `/api/sales/tips/by-employee/` | Base de reparto |
| **Tarjetas de cliente** | `/api/customers/client-cards/generate/`, `download/` | Fidelización |

### P3 — Verificar valor antes de construir

- `/api/sales/pos/*` (`process_payment`, `validate_payment`, `search_orders`, `payment_methods`, `client_orders`): surface POS dedicada que el front hoy resuelve con orders+payments genéricos. Migrar es riesgo sin ganancia clara; **evaluar, no ejecutar**.
- `/api/shared/backups/`, `/api/shared/global-audit-logs/`, `/api/audit/logs/*`: útiles para un panel admin, no para operación diaria.
- 16 dominios en 0%: fuera de alcance de un POS gastronómico salvo decisión de producto.

## 5. Campos del contrato que el front no consume (muestreo)

El schema `Order` (detalle de venta) expone campos valiosos que el código FRIG nunca lee (grep en `src/`, excl. tipos):

| Campo | Disponible | Lectura FRIG |
|---|---|---|
| `is_partial_refund`, `is_partial_return` | Estado de devolución parcial | 0 |
| `tax_document_folio`, `tax_document_xml_url`, `has_tax_document` | Trazabilidad SII de la orden | 0 |
| `payment_fees`, `day_pay_fees` | Comisiones de pago | 0 |
| `latitude`, `longitude`, `driver_note` | Despacho | 0 |
| `in_route`, `is_checked_order` | Estado de reparto | 0 |
| `total_cost`, `net_amount` | Rentabilidad por orden | 2-3 (parcial) |

Acción recomendada: cuando se toque ventas/caja, mostrar `has_tax_document` + folio y `payment_fees` (costo real de cobrar). Sin urgencia.

## 6. Verificación de contratos recientes

- **Checkout público** — `POST /api/public/{group_slug}-checkout/` y `GET …/{checkout_id}/`: **calzan 1:1** con `src/lib/api/checkout.ts` (body `PlanCheckoutCreateRequest` = `{plan_id, business_name, contact_name, email, website}`, respuesta `{checkout_id, payment_url, status}`). El front está correctamente cableado.
- **PDF cotizaciones** — `GET /api/sales/quotations/{id}/generate-pdf/` **no existe en el backend** (verificado en schema vivo). El placeholder del botón PDF en cotizaciones sigue siendo la decisión correcta; el requerimiento para Yggdra está en `docs/checkout-requerimientos-backend.md`.
- **Drift de método** — 0 de 295. La corrección histórica de `tax-documents` (C-1) se mantiene: el front ya no llama `cancel/` inexistente.

## 7. Limitaciones del método

- El extractor ve URLs literales en `apiFetch`/`apiFile`/`fetch`. URLs armadas dinámicamente por helpers quedan resueltas manualmente (ej. `checkoutPath()`).
- `apiFile` se contabiliza como GET (todas las descargas del schema son GET).
- La cobertura mide **presencia de llamada**, no uso efectivo en runtime: un endpoint llamado desde código muerto contaría como usado. El cruce con páginas activas está en `auditoria-frig-vs-backend.md`.
- Los dominios en 0% podrían contener endpoints de utilidad oculta; el muestreo de §4 cubre los tags que FRIG ya usa.

## 8. Recomendaciones

1. **Propinas** es la oportunidad P1 de mayor valor relativo: ya está en el roadmap del README y la API está completa.
2. Antes de construir cualquier pantalla nueva de analytics, usar `by-day`/`by-hour`/`orders`/`time_series` en vez de agregar lógica al cliente.
3. Cablear `my_notifications` + `user-app-permissions` como infraestructura transversal (campanita + menú por entitlement).
4. Re-correr esta auditoría tras cada sprint de backend: `scripts/api-audit/` es idempotente y toma <2 min.
