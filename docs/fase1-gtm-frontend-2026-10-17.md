# Fase 1 GTM frontend — decisiones (2026-10-17)

Entrega de código (tests + honestidad IoT + gate Equipos + rutas huérfanas). Sin deploy.

## Rutas huérfanas — elección (lo más seguro)

| Ruta | Decisión | Motivo |
|------|----------|--------|
| `/dash-fast` | **Redirect** → `/dashboard` | Cubo 3D experimental, sin menú, bundle pesado. No vender como feature. |
| `/finance` | **Menú Dinero** (“Resumen financiero”) | Hub útil ya existente; módulo `finance` always-on. |
| `/banks` | **Menú Dinero** (“Bancos”) | CRUD real usado por billeteras; módulo `bank_accounts`. |

## Equipos

- Módulo `equipment` en `FRIG_SETTINGS_MODULES` (toggle como IoT).
- Rutas `/equipment` y `/reports/equipment` gated; menú oculto si desactivado.

## IoT

- Copy restaurante/producción; sin columna DGA; banner “en desarrollo” para alertas/gráficos/edición de conectores.

## Tests

- `cash-checkout-flow.contract.test.ts`: open → in/out → sell → pay → close; 403 vs 404; cancel-movement string|number; OWNER close.
- `modules.equipment.test.ts`: gate equipment/iot + finance/banks.
