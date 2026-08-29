"use client";

/** Diagrama de flujo de procesos de FRIG en estilo pixel-art (SVG 8-bit).
 *  Nodos con bordes crisp y conectores en pasos (escalera). Altura fija:
 *  nunca genera scroll ni rompe la dimensión del panel. */

type FlowNode = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
};

const NODES: FlowNode[] = [
  { x: 40, y: 20, w: 130, h: 44, label: "Ingreso", color: "#8dc4a3" },
  { x: 40, y: 110, w: 130, h: 44, label: "Venta / POS", color: "#e8c17a" },
  { x: 40, y: 200, w: 130, h: 44, label: "Cobro", color: "#d8783d" },
  { x: 220, y: 200, w: 130, h: 44, label: "Caja", color: "#e9bd4a" },
  { x: 220, y: 110, w: 130, h: 44, label: "Pago", color: "#9f442f" },
  { x: 220, y: 20, w: 130, h: 44, label: "Finanzas", color: "#8dc4a3" },
];

type Connector = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** Conectores en pasos (L): de cada nodo al siguiente. */
const CONNECTORS: Connector[] = [
  { x1: 105, y1: 64, x2: 105, y2: 110 }, // Ingreso -> Venta
  { x1: 105, y1: 154, x2: 105, y2: 200 }, // Venta -> Cobro
  { x1: 170, y1: 222, x2: 220, y2: 222 }, // Cobro -> Caja
  { x1: 285, y1: 244, x2: 285, y2: 154 }, // Caja -> Pago
  { x1: 220, y1: 132, x2: 170, y2: 132 }, // Pago -> Finanzas (retorno)
];

export function FlowDiagram() {
  return (
    <svg
      viewBox="0 0 400 280"
      role="img"
      aria-label="Flujo de procesos de FRIG: Ingreso, Venta, Cobro, Caja, Pago, Finanzas"
      className="h-auto w-full max-w-xl"
      shapeRendering="crispEdges"
    >
      {/* Conectores en pasos */}
      {CONNECTORS.map((c, i) => (
        <g key={`connector-${i}`} stroke="#7ea38d" strokeWidth={3} fill="none">
          <path d={`M ${c.x1} ${c.y1} L ${c.x2} ${c.y2}`} />
        </g>
      ))}

      {/* Flechas */}
      <polygon points="98,122 112,122 105,132" fill="#7ea38d" />
      <polygon points="98,212 112,212 105,222" fill="#7ea38d" />
      <polygon points="218,216 218,228 228,222" fill="#7ea38d" />
      <polygon points="278,146 278,132 288,139" fill="#7ea38d" />

      {/* Nodos */}
      {NODES.map((n) => (
        <g key={n.label}>
          <rect
            x={n.x}
            y={n.y}
            width={n.w}
            height={n.h}
            fill="rgba(15,46,28,0.92)"
            stroke={n.color}
            strokeWidth={3}
          />
          <rect
            x={n.x + 6}
            y={n.y + 6}
            width={n.w - 12}
            height={n.h - 12}
            fill="rgba(141,196,163,0.06)"
          />
          <text
            x={n.x + n.w / 2}
            y={n.y + n.h / 2 + 4}
            textAnchor="middle"
            fontSize="14"
            fill={n.color}
            style={{ fontFamily: "inherit", imageRendering: "pixelated" }}
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
