# FRIG Design System

## 1. Atmosphere & Identity

FRIG se siente nórdico, gastronómico y confiable: verde bosque, superficies sobrias y detalles pixelados que evocan una cocina digital sin convertir la interfaz en un videojuego. La firma visual es una runa gastronómica de píxeles acompañada por alimentos que flotan con baja opacidad.

## 2. Color

| Rol | Token | Valor | Uso |
|---|---|---|---|
| Bosque profundo | `--frig-bg` | `#0f2e1c` | Fondo de marca |
| Bosque elevado | `--frig-bg-soft` | `#163b24` | Superficies internas |
| Texto principal | `--frig-text` | `#f3f7f4` | Títulos y contenido |
| Texto secundario | `--frig-text-muted` | `#a9c9b8` | Descripciones |
| Musgo | `--frig-accent` | `#8dc4a3` | CTA, runa y foco |
| Musgo activo | `--frig-accent-strong` | `#a9d8bf` | Hover |
| Línea | `--frig-line` | `rgba(141, 196, 163, 0.18)` | Bordes sutiles |
| Vuelto | `--frig-coin` | `#e9bd4a` | Monedas pixeladas |
| Masa | `--frig-dough` | `#e8c17a` | Pan, pizza y taco |
| Tomate | `--frig-tomato` | `#d8783d` | Ingredientes cálidos |
| Café | `--frig-coffee` | `#8a4f2b` | Bebidas y sombras cálidas |
| Proteína | `--frig-meat` | `#9f442f` | Hamburguesa |
| Manzana | `--frig-apple` | `#c95f4b` | Fruta pixelada |
| Pan tostado | `--frig-bread` | `#d8a45c` | Pan pixelado |
| Pan claro | `--frig-bread-light` | `#f1d195` | Brillo del pan |

El acento verde se reserva para interacción y firma visual. Los sprites de comida usan una paleta apagada para permanecer en segundo plano.

## 3. Typography

- **Lectura:** Geist, pesos 400/500/600/700.
- **Firma pixel:** Pixelify Sans, solo en marca, runa y pequeñas etiquetas.
- **Display:** 34px, 600, línea 1.15, tracking negativo y balance de líneas.
- **Cuerpo:** 15px, línea 1.6.
- **Feature:** título 14px/600; descripción 13px.
- Nunca usar Pixelify para párrafos o formularios.

## 4. Spacing & Layout

- Unidad base: 4px.
- Login desktop: panel de marca flexible + columna fija de 22–28rem.
- Alto desktop: `100dvh`, sin scroll de documento.
- Panel: 32–48px horizontal; 32–40px vertical.
- A 375px la interfaz forma una sola columna legible.

## 5. Components

### PixelFoodMark
- **Estructura:** SVG pixelado de runa, plato y vapor.
- **Variantes:** `sm`, `md`, `lg`.
- **Estados:** decorativo o con nombre accesible según contexto.
- **Motion:** brillo de entrada solo en el hero; estático en login.

### PixelFoodBg
- **Estructura:** grilla tenue + sprites SVG de comida y vuelto.
- **Variantes:** una atmósfera verde de baja opacidad.
- **Accesibilidad:** siempre `aria-hidden`; desaparece con movimiento reducido.
- **Motion:** solo `transform` y `opacity`, deriva lenta y escalonada.

### DemoCta
- **Estructura:** botón + modal compartido.
- **Estados:** hover, active, focus, abierto y cerrado.
- **Accesibilidad:** modal con foco atrapado, Escape y restauración de foco.

## 6. Motion & Interaction

- Microinteracción: 150ms ease-out.
- Entrada: 320ms ease-out con stagger de 70ms.
- Atmósfera pixel: 9–15s, baja opacidad, `transform` únicamente.
- `prefers-reduced-motion` elimina movimiento decorativo.

## 7. Depth & Surface

Estrategia mixta: cambios tonales y líneas sutiles. El panel usa gradientes radiales verdes; modales conservan la elevación del componente compartido.

## 8. Accessibility Constraints & Accepted Debt

- WCAG 2.2 AA; texto de cuerpo con contraste mínimo 4.5:1.
- Todos los controles tienen foco visible y etiquetas.
- Los elementos decorativos no entran al árbol accesible.
- **Deuda aceptada:** auditoría visual automatizada pendiente porque Playwright no está instalado en el proyecto.
