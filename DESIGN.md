# FRIG — Sistema de diseño (app)

Referencia práctica del sistema real de la aplicación (POS/ERP multi-sucursal,
Next.js + Tailwind 4). La landing pública tiene su propio lenguaje decorativo
(hero `frig-*`, sprites pixel); este documento cubre la app.

## 1. Tokens de color (multi-tenant)

La paleta NO está fija en el código: los tokens de marca viven en `:root` de
`src/app/globals.css` y se inyectan dinámicamente desde la config de sucursal
(`BranchThemeConfig` de Yggdra), así cada negocio se re-tematiza sin recompilar.

- `--brand-primary`, `--brand-secondary`, `--brand-surface`,
  `--brand-foreground`, `--brand-radius`, `--brand-motion`, `--brand-compact`.
- Los tokens shadcn mapean a los de marca en `@theme inline`: `primary`,
  `secondary`, `background`, `foreground`, `muted`, `muted-foreground`,
  `border`, `input`, `card`, `surface`, `ring`, `radius`.
- Semánticos: `--danger` (rojo), `--success` (verde), `--warning` (ámbar),
  redefinidos en `.dark` con más luminancia para mantener contraste.

**Regla: usar tokens, nunca colores hardcodeados.** En la app no se escriben
clases tipo `bg-emerald-500` o `text-rose-700`: se usa
`bg-success/10 text-success`, `bg-danger/10 text-danger`,
`bg-warning/10 text-warning`. Así el UI respeta la marca del tenant y el modo
oscuro sin trabajo extra.

## 2. Kit de UI (`src/components/ui/*`)

Componentes base compartidos — usarlos en lugar de elementos nativos sueltos:

- `button` — acciones (variantes `default`/`outline`/`ghost`, tamaños `sm`/`md`).
- `input`, `select`, `searchable-select`, `multi-select` — campos de formulario
  y filtros; `field` — wrapper label + control + mensaje de error.
- `switch` — toggles binarios.
- `modal`, `animated-overlay`, `dropdown-portal` — superficies superpuestas.
- `actions-menu` — menú de acciones por fila/tarjeta.
- `skeleton` — placeholder de carga.
- `toaster` — notificaciones.
- `carousel`, `staggered-fade` — contenedores con animación de entrada.

`cn(...)` (de `@/lib/utils`) combina clases con resolución de conflictos.

## 3. Patrones de página

- **`PageShell` + `PageBody`** (`src/components/page-shell.tsx`): contenedor
  centrado `max-w-7xl` (referencia Dashboard) + cuerpo con
  `gap-6 p-4 sm:p-6`. Toda pantalla de módulo usa este eje; no full-width.
- **`PageHeader`** (`src/components/page-header.tsx`): encabezado estándar con
  borde inferior, padding `px-4 py-3 sm:px-6`, título, subtítulo, ícono
  (`bg-primary/10 text-primary` — hereda el color de marca de la
  sucursal/org) y acciones a la derecha. Toda página nueva lo usa; no crear
  `h1` ad-hoc.
- **Estados**: `src/lib/status-styles.ts` centraliza el color por estado —
  `statusBadge()` (chip con borde), `statusChip()` (sólido), `statusDot()`
  (punto). No declarar mapas de clases inline por página.
- **Dinero**: `formatCLP(value)` de `@/lib/utils` formatea pesos chilenos
  (`es-CL`, sin decimales). Nunca formatear montos a mano.
- **Tabla-desktop / cards-mobile**: en listados con columnas, tabla con
  `hidden md:block` y tarjetas con `md:hidden` debajo (misma data, jerarquía
  adaptada al ancho). Referencia: `GroupPanel` del kit de informes.
- **Vacíos**: mensaje corto centrado con ícono en `text-muted-foreground`;
  nunca dejar una tabla vacía sin explicación.

## 4. Informes

`src/components/reports/report-kit.tsx` es el kit compartido de los informes.
La navegación entre informes vive solo en el menú lateral (no hay tabs
internos entre reportes).

- `ReportDateFilters` — inputs Desde/Hasta + presets en píldora, controlado.
- `ReportKpi` + `DeltaChip` + `previousWindow` — KPIs con delta período a
  período (PoP).
- `GroupPanel` + `ShareBar` — sección agrupada con participación %.
- Utilidades: `src/lib/date-range.ts` (`fmtDateInput`, `daysAgoInput`,
  `rangeDates`, `getCurrentMonthRange`, presets) y `src/lib/export-csv.ts`
  (`downloadCsv`, BOM + separador `;` para Excel chileno).

## 5. Glassmorphism

Superficies frosted glass centralizadas en tokens CSS (`globals.css`).
Se adaptan solas al color de marca (`--brand-primary`) y a `.dark`.

Tokens:
- `--glass-bg`, `--glass-bg-strong` — tint semitransparente (light deja ver el fondo animado)
- `--glass-border`, `--glass-blur`, `--glass-shadow`, `--glass-highlight`

Utilidades:
- `.glass` — cards / paneles de informe
- `.glass-strong` — sticky headers / overlays
- `.glass-read` — paneles de lectura (más frost/blur para legibilidad)
- `.glass-chip` — tabs, date range, pills

Reglas:
- Usar las clases del kit; no inventar `backdrop-blur` ad-hoc por página.
- Con `prefers-reduced-transparency` caen a `var(--card)` sólido.
- No aplicar glass en POS / caja / KDS ni en tablas densas desktop.
- El fondo cósmico (`HeroPlexus`) da profundidad; sin él el efecto se ve plano.

Referencia aplicada: Dashboard + informes (nutrición, ventas, dinero, ingresos, gastos).
