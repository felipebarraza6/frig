"use client";

/**
 * Cada módulo tiene un ejemplo isométrico distinto.
 * La unión va en el piso, como una pieza. Al pasar el mouse sobre el dibujo, la cinta se enciende.
 * El nudo es un rombo, no una medalla.
 */

import { LANDING_MODULE_DOSSIERS } from "@/content/landing";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

type V3 = [number, number, number];
type Tone = "copper" | "ember" | "cold" | "paper" | "void";

const TONE: Record<Tone, { top: string; front: string; side: string; stroke: string; alpha: number }> = {
  copper: { top: "#6e4b38", front: "#3a261c", side: "#22160f", stroke: "#c67d52", alpha: 1 },
  ember: { top: "#c48468", front: "#7a4634", side: "#462818", stroke: "#e8b08a", alpha: 1 },
  cold: { top: "#525252", front: "#303030", side: "#1c1c1c", stroke: "rgba(255,255,255,0.5)", alpha: 1 },
  paper: { top: "#8a7260", front: "#4e3a2c", side: "#2c2018", stroke: "#d7a88a", alpha: 1 },
  void: { top: "#342a24", front: "#221a16", side: "#140e0c", stroke: "#c67d52", alpha: 1 },
};

function iso(ox: number, oy: number, s: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const notes: { title: string; meta?: string; ax: number; ay: number }[] = [];
  const see = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  const p = (x: number, y: number, z: number) => {
    const q = {
      x: ox + (x - y) * s * 0.8660254,
      y: oy + (x + y) * s * 0.5 - z * s,
    };
    see(q.x, q.y);
    return q;
  };

  const pts = (list: V3[]) =>
    list
      .map(([x, y, z]) => {
        const q = p(x, y, z);
        return `${q.x.toFixed(2)},${q.y.toFixed(2)}`;
      })
      .join(" ");

  function path(list: V3[], opacity = 1) {
    const d = list
      .map(([x, y, z], i) => {
        const q = p(x, y, z);
        return `${i === 0 ? "M" : "L"}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
      })
      .join(" ");
    return (
      <path
        d={d}
        fill="none"
        stroke="#c67d52"
        strokeWidth={1}
        strokeOpacity={opacity}
        strokeLinejoin="miter"
        strokeMiterlimit={2}
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  /** Borde frontal, un pelo hacia la cámara, para que la línea toque la cara. */
  function lip(x: number, y: number, z: number, w: number, d: number): V3 {
    return [x + w / 2, y + d + 0.05, z];
  }

  function topOf(x: number, y: number, z: number, w: number, d: number, h: number): V3 {
    return [x + w / 2, y + d / 2, z + h];
  }

  /** Borde trasero de la tapa: el punto más alto en pantalla, para sentar el texto encima. */
  function crown(x: number, y: number, z: number, w: number, _d: number, h: number): V3 {
    return [x + w / 2, y - 0.04, z + h];
  }

  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    tone: Tone = "copper",
    open = false,
    loose = false,
    aimAt?: V3,
  ) {
    const c = TONE[tone];
    const hub = p(x + w / 2, y + d / 2, z + h / 2);
    const aim = aimAt ? p(aimAt[0], aimAt[1], aimAt[2]) : p(x + Math.min(w * 0.34, 0.42), y + d * 0.78, z + h);
    const far: V3 = [x, y, z + h];
    const backRight: V3 = [x + w, y, z + h];
    const frontRight: V3 = [x + w, y + d, z + h];
    const frontLeft: V3 = [x, y + d, z + h];
    const backRightB: V3 = [x + w, y, z];
    const frontRightB: V3 = [x + w, y + d, z];
    const frontLeftB: V3 = [x, y + d, z];
    const hair = {
      fill: "none",
      stroke: c.stroke,
      strokeWidth: 1,
      strokeLinejoin: "miter" as const,
      strokeMiterlimit: 2,
      vectorEffect: "non-scaling-stroke" as const,
    };
    const shadow =
      tone === "void" ? null : (
        <polygon
          points={pts([
            [x + 0.12, y + 0.16, z],
            [x + w + 0.12, y + 0.16, z],
            [x + w + 0.12, y + d + 0.16, z],
            [x + 0.12, y + d + 0.16, z],
          ])}
          fill="#000"
          fillOpacity={0.55}
        />
      );
    const faces = (
      <>
        {shadow}
        <polygon points={pts([backRight, frontRight, frontRightB, backRightB])} fill={c.side} />
        <polygon points={pts([frontLeft, frontRight, frontRightB, frontLeftB])} fill={c.front} />
        {open ? (
          <polygon
            points={pts([
              [x + 0.12, y + 0.12, z + 0.08],
              [x + w - 0.12, y + 0.12, z + 0.08],
              [x + w - 0.12, y + d - 0.12, z + 0.08],
              [x + 0.12, y + d - 0.12, z + 0.08],
            ])}
            fill="#070707"
            stroke={c.stroke}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <polygon points={pts([far, backRight, frontRight, frontLeft])} fill={c.top} />
        )}
        <path
          {...hair}
          d={`M${pts([far, backRight, backRightB, frontRightB, frontLeftB, frontLeft])}Z`}
        />
        {h > 0.32 ? (
          <path
            {...hair}
            d={`M${pts([frontRight, backRight])}M${pts([frontRight, frontRightB])}M${pts([frontRight, frontLeft])}`}
          />
        ) : null}
      </>
    );
    if (loose) return faces;
    return (
      <g className="iso-piece" data-cx={hub.x} data-cy={hub.y} data-ax={aim.x} data-ay={aim.y}>
        {faces}
      </g>
    );
  }

  function knot(at: V3, hot = true, r = 5, loose = false) {
    const q = p(...at);
    const mark = (
      <polygon
        points={`${q.x.toFixed(2)},${(q.y - r).toFixed(2)} ${(q.x + r).toFixed(2)},${q.y.toFixed(2)} ${q.x.toFixed(2)},${(q.y + r).toFixed(2)} ${(q.x - r).toFixed(2)},${q.y.toFixed(2)}`}
        fill="#101010"
        stroke={hot ? "#c67d52" : "rgba(255,255,255,0.45)"}
        strokeWidth={1.35}
      />
    );
    if (loose || at[2] <= 0.35) return mark;
    return (
      <g className="iso-piece" data-cx={q.x} data-cy={q.y}>
        {mark}
      </g>
    );
  }

  /** Centro de la planta, en el piso. La cinta sale de aquí y queda bajo la pieza. */
  function base(x: number, y: number, _z: number, w: number, d: number): V3 {
    return [x + w / 2, y + d / 2, 0];
  }

  function cluster(x: number, y: number, z: number, children: ReactNode, aimAt?: V3) {
    const hub = p(x, y, z);
    const aim = aimAt ? p(...aimAt) : hub;
    return (
      <g className="iso-piece" data-cx={hub.x} data-cy={hub.y} data-ax={aim.x} data-ay={aim.y}>
        {children}
      </g>
    );
  }

  function tag(
    at: V3,
    title: string,
    meta?: string,
    _anchor: "middle" | "start" | "end" = "middle",
    _lift = -18,
  ) {
    const q = p(...at);
    notes.push({ title, meta, ax: q.x, ay: q.y });
    return null;
  }

  function caption(x: number, y: number, text: string, meta?: string) {
    see(x, y);
    notes.push({ title: text, meta, ax: x, ay: y });
    return null;
  }

  /**
   * Cinta en el piso: loseta extruida, con canto, no un trazo en el aire.
   * La z de los puntos se ignora para que la unión no corte las caras.
   */
  function lane(list: V3[], width = 0.36, zBase = 0) {
    const usable = list.filter((point, index) => {
      if (index === 0) return true;
      const prev = list[index - 1];
      return Math.hypot(point[0] - prev[0], point[1] - prev[1]) > 0.02;
    });
    if (usable.length < 2) return null;
    const closed =
      usable.length > 3 &&
      Math.hypot(usable[0][0] - usable[usable.length - 1][0], usable[0][1] - usable[usable.length - 1][1]) < 0.05;
    const ring = closed ? usable.slice(0, -1) : usable;
    const n = ring.length;
    const half = width / 2;
    const z0 = zBase;
    const z1 = zBase + 0.08;
    const seg = (i: number) => {
      const j = (i + 1) % n;
      const dx = ring[j][0] - ring[i][0];
      const dy = ring[j][1] - ring[i][1];
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len };
    };
    const leftOf = (d: { x: number; y: number }) => ({ x: -d.y, y: d.x });
    const left: Array<[number, number]> = [];
    const right: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const prev = closed || i > 0 ? seg((i - 1 + n) % n) : null;
      const next = closed || i < n - 1 ? seg(i % n) : null;
      const usePrev = closed || i > 0 ? prev : null;
      const useNext = closed || i < n - 1 ? next : null;
      let ox: number;
      let oy: number;
      if (!usePrev || !useNext) {
        const d = useNext ?? usePrev!;
        const nrm = leftOf(d);
        ox = nrm.x;
        oy = nrm.y;
      } else {
        const a = leftOf(usePrev);
        const b = leftOf(useNext);
        let mx = a.x + b.x;
        let my = a.y + b.y;
        const ml = Math.hypot(mx, my) || 1;
        mx /= ml;
        my /= ml;
        const dot = mx * b.x + my * b.y;
        const miter = Math.min(1 / Math.max(0.42, Math.abs(dot)), 2.05);
        ox = mx * miter;
        oy = my * miter;
      }
      left.push([ring[i][0] + ox * half, ring[i][1] + oy * half]);
      right.push([ring[i][0] - ox * half, ring[i][1] - oy * half]);
    }
    const segCount = closed ? n : n - 1;
    const parts: ReactNode[] = [];
    for (let i = 0; i < segCount; i++) {
      const j = (i + 1) % n;
      const side = (edge: Array<[number, number]>): V3[] => [
        [edge[i][0], edge[i][1], z0],
        [edge[j][0], edge[j][1], z0],
        [edge[j][0], edge[j][1], z1],
        [edge[i][0], edge[i][1], z1],
      ];
      parts.push(
        <g key={i}>
          <polygon points={pts(side(left))} fill="#24160f" />
          <polygon points={pts(side(right))} fill="#140e0a" />
        </g>,
      );
    }
    const hair = {
      className: "iso-floor-top",
      fill: "#5c3424",
      stroke: "#e8b08a",
      strokeWidth: 1,
      strokeLinejoin: "miter" as const,
      strokeMiterlimit: 2,
      vectorEffect: "non-scaling-stroke" as const,
    };
    const ribbon = closed ? (
      <path
        {...hair}
        fillRule="evenodd"
        d={`M${pts(left.map(([x, y]): V3 => [x, y, z1]))}Z M${pts(right.map(([x, y]): V3 => [x, y, z1]))}Z`}
      />
    ) : (
      <polygon
        {...hair}
        points={pts([...left, ...[...right].reverse()].map(([x, y]): V3 => [x, y, z1]))}
      />
    );
    const center = ring
      .map((point, index) => {
        const q = p(point[0], point[1], z1 + 0.02);
        return `${index === 0 ? "M" : "L"}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
      })
      .join(" ");
    const d = closed ? `${center} Z` : center;
    return (
      <g className="iso-lane">
        {parts}
        {ribbon}
        <path d={d} className="iso-floor-bloom" />
        <path d={d} className="iso-floor-glow" />
      </g>
    );
  }

  function band(list: V3[]) {
    return lane(list, 0.62);
  }

  function prism(cx: number, cy: number, z: number, r: number, h: number, tone: Tone, cap?: string, loose = false) {
    const c = TONE[tone];
    const n = 8;
    const ang = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
    const world = (i: number, zz: number, rad: number): V3 => {
      const a = ang(i);
      return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, zz];
    };
    const ring = (zz: number, rad: number) => Array.from({ length: n }, (_, i) => p(...world(i, zz, rad)));
    const top = ring(z + h, r);
    const bot = ring(z, r);
    const facing = (i: number) => {
      const a = ang(i) + Math.PI / n;
      return Math.cos(a) + Math.sin(a) > -0.02;
    };
    const order = Array.from({ length: n }, (_, i) => i)
      .filter(facing)
      .sort((i, j) => top[i].y + top[(i + 1) % n].y - (top[j].y + top[(j + 1) % n].y));
    const hub = p(cx, cy, z + h / 2);
    const lid = p(cx, cy, z + h);
    const upright = new Set<number>();
    const hem: string[] = [];
    for (const i of order) {
      const j = (i + 1) % n;
      upright.add(i);
      upright.add(j);
      hem.push(`M${pts([world(i, z, r), world(j, z, r)])}`);
    }
    const posts = [...upright].map((i) => `M${pts([world(i, z, r), world(i, z + h, r)])}`);
    const hair = {
      fill: "none",
      stroke: c.stroke,
      strokeWidth: 1,
      strokeLinejoin: "miter" as const,
      strokeMiterlimit: 2,
      vectorEffect: "non-scaling-stroke" as const,
    };
    const body = (
      <>
        <polygon
          points={Array.from({ length: n }, (_, i) => world(i, z, r))
            .map(([x, y, zz]) => {
              const q = p(x + 0.1, y + 0.14, zz);
              return `${q.x.toFixed(2)},${q.y.toFixed(2)}`;
            })
            .join(" ")}
          fill="#000"
          fillOpacity={0.5}
        />
        {order.map((i) => {
          const j = (i + 1) % n;
          return (
            <polygon
              key={i}
              points={`${bot[i].x.toFixed(2)},${bot[i].y.toFixed(2)} ${bot[j].x.toFixed(2)},${bot[j].y.toFixed(2)} ${top[j].x.toFixed(2)},${top[j].y.toFixed(2)} ${top[i].x.toFixed(2)},${top[i].y.toFixed(2)}`}
              fill={i % 2 === 0 ? c.front : c.side}
            />
          );
        })}
        <polygon points={top.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(" ")} fill={c.top} />
        {cap ? (
          <polygon
            points={ring(z + h + 0.02, r * 0.62)
              .map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`)
              .join(" ")}
            fill={cap}
          />
        ) : null}
        <path {...hair} d={`M${pts(Array.from({ length: n }, (_, i) => world(i, z + h, r)))}Z${posts.join("")}${hem.join("")}`} />
      </>
    );
    if (loose) return body;
    return (
      <g className="iso-piece" data-cx={hub.x} data-cy={hub.y} data-ax={lid.x} data-ay={lid.y}>
        {body}
      </g>
    );
  }

  function grid(x: number, y: number, w: number, d: number, nx: number, ny: number, z = 0) {
    const lines: ReactNode[] = [];
    for (let i = 0; i <= nx; i++) {
      const t = (w * i) / nx;
      lines.push(<g key={`v${i}`}>{path([[x + t, y, z], [x + t, y + d, z]], 0.32)}</g>);
    }
    for (let j = 0; j <= ny; j++) {
      const t = (d * j) / ny;
      lines.push(<g key={`u${j}`}>{path([[x, y + t, z], [x + w, y + t, z]], 0.32)}</g>);
    }
    return <g>{lines}</g>;
  }

  function mouth(x: number, y: number, z: number, w: number, d: number, h: number, fill: string, loose = false) {
    const padX = w * 0.16;
    const padZ = h * 0.16;
    const yy = y + d + 0.03;
    const hub = p(x + w / 2, y + d / 2, z + h / 2);
    const hole = (
      <polygon
          points={pts([
            [x + padX, yy, z + padZ],
            [x + w - padX, yy, z + padZ],
            [x + w - padX, yy, z + h - padZ],
            [x + padX, yy, z + h - padZ],
          ])}
          fill={fill}
          stroke="#c67d52"
          strokeWidth={1}
          strokeOpacity={0.75}
        />
    );
    if (loose) return hole;
    return (
      <g className="iso-piece" data-cx={hub.x} data-cy={hub.y}>
        {hole}
      </g>
    );
  }

  function rules(x: number, y: number, z: number, w: number, d: number, rows: number) {
    const lines: ReactNode[] = [];
    for (let i = 1; i <= rows; i++) {
      const t = (d * i) / (rows + 1);
      lines.push(
        <g key={i}>
          {path(
            [
              [x + w * 0.12, y + t, z],
              [x + w * 0.88, y + t, z],
            ],
            0.75,
          )}
        </g>,
      );
    }
    return <g>{lines}</g>;
  }

  function bounds() {
    const pad = 26;
    return {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(160, maxX - minX + pad * 2),
      h: Math.max(120, maxY - minY + pad * 2),
    };
  }

  return {
    p,
    pts,
    path,
    lip,
    base,
    topOf,
    crown,
    box,
    knot,
    tag,
    prism,
    grid,
    mouth,
    rules,
    caption,
    band,
    lane,
    cluster,
    bounds,
    see,
    notes: () => notes,
  };
}

type Draw = ReturnType<typeof iso>;

type Note = { title: string; meta?: string; ax: number; ay: number };
type Leader = { x1: number; y1: number; x2: number; y2: number };

function leaderPath(line: Leader, _mark: number) {
  return `M${line.x1.toFixed(2)} ${line.y1.toFixed(2)} L${line.x2.toFixed(2)} ${line.y2.toFixed(2)}`;
}

function diamond(x: number, y: number, r: number) {
  return `${x.toFixed(2)},${(y - r).toFixed(2)} ${(x + r).toFixed(2)},${y.toFixed(2)} ${x.toFixed(2)},${(y + r).toFixed(2)} ${(x - r).toFixed(2)},${y.toFixed(2)}`;
}

function staggerTops(ys: number[], gap: number, limit: number) {
  const items = ys.map((y, index) => ({ index, y: Math.max(0, y - 12) }));
  items.sort((a, b) => a.y - b.y);
  let cursor = 0;
  for (const item of items) {
    item.y = Math.max(item.y, cursor);
    cursor = item.y + gap;
  }
  const overflow = cursor - gap - Math.max(0, limit - 4);
  if (overflow > 0) {
    for (const item of items) item.y = Math.max(0, item.y - overflow);
  }
  const tops = new Array<number>(ys.length);
  for (const item of items) tops[item.index] = item.y;
  return tops;
}

function Diagram({
  label,
  box,
  notes,
  children,
}: {
  label: string;
  box: { x: number; y: number; w: number; h: number };
  notes: Note[];
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [lines, setLines] = useState<Array<Leader | null>>([]);
  const [port, setPort] = useState({ w: 1, h: 1 });
  const scale = Math.min(700 / box.w, 420 / box.h);
  const width = Math.round(box.w * scale);
  const height = Math.round(box.h * scale);
  const tops = staggerTops(
    notes.map((note) => (note.ay - box.y) * scale),
    44,
    height,
  );

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const pieces = [...root.querySelectorAll<SVGGElement>(".iso-piece")];
    const used = new Set<number>();
    notes.forEach((note, noteIndex) => {
      let best = -1;
      let bestD = Infinity;
      pieces.forEach((el, pieceIndex) => {
        if (used.has(pieceIndex)) return;
        const x = Number(el.dataset.cx);
        const y = Number(el.dataset.cy);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const d = Math.hypot(x - note.ax, y - note.ay);
        if (d < bestD) {
          bestD = d;
          best = pieceIndex;
        }
      });
      if (best >= 0) {
        used.add(best);
        pieces[best].dataset.note = String(noteIndex);
      }
    });
    const onEnter = (event: Event) => {
      const id = Number((event.currentTarget as SVGGElement).dataset.note);
      if (Number.isFinite(id)) setActive(id);
    };
    for (const el of pieces) el.addEventListener("pointerenter", onEnter);
    return () => {
      for (const el of pieces) el.removeEventListener("pointerenter", onEnter);
    };
  }, [notes]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const el of root.querySelectorAll<SVGGElement>(".iso-piece")) {
      el.classList.toggle("is-hot", active !== null && el.dataset.note === String(active));
    }
  }, [active, notes]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const legend = root.querySelector(".iso-legend");
      if (!legend || getComputedStyle(legend).display === "none") {
        setLines([]);
        return;
      }
      const w = Math.max(1, Math.round(root.clientWidth));
      const h = Math.max(1, Math.round(root.clientHeight));
      setPort((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      const rootBox = root.getBoundingClientRect();
      const svg = root.querySelector("svg.iso-art");
      const ctm = svg instanceof SVGSVGElement ? svg.getScreenCTM() : null;
      if (!ctm) {
        setLines([]);
        return;
      }
      setLines(
        notes.map((_, index) => {
          const labelEl = legend.querySelector(`[data-note="${index}"]`);
          const piece = root.querySelector(`.iso-piece[data-note="${index}"]`);
          if (!labelEl || !(piece instanceof SVGElement)) return null;
          const lb = labelEl.getBoundingClientRect();
          const point = svg instanceof SVGSVGElement ? svg.createSVGPoint() : null;
          if (!point) return null;
          const ax = Number(piece.dataset.ax);
          const ay = Number(piece.dataset.ay);
          point.x = Number.isFinite(ax) ? ax : Number(piece.dataset.cx);
          point.y = Number.isFinite(ay) ? ay : Number(piece.dataset.cy);
          const spot = point.matrixTransform(ctm);
          const x1 = lb.right - rootBox.left + 6;
          const y1 = lb.top + lb.height / 2 - rootBox.top;
          const x2 = spot.x - rootBox.left;
          const y2 = spot.y - rootBox.top;
          return { x1, y1, x2, y2 };
        }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    measure();
    return () => observer.disconnect();
  }, [notes]);

  return (
    <div
      ref={ref}
      className={active === null ? "iso-live relative" : "iso-live is-pointing relative"}
      onPointerLeave={() => setActive(null)}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        {notes.length > 0 ? (
          <ul className="flex w-full flex-col gap-3 sm:hidden">
            {notes.map((note, index) => (
              <li key={`${note.title}-${index}`}>
                <Callout note={note} index={index} active={active} onEnter={setActive} />
              </li>
            ))}
          </ul>
        ) : null}
        {notes.length > 0 ? (
          <div className="iso-legend relative hidden w-52 shrink-0 sm:block" style={{ height }}>
            {notes.map((note, index) => (
              <Callout
                key={`${note.title}-${index}`}
                note={note}
                index={index}
                active={active}
                onEnter={setActive}
                top={tops[index]}
              />
            ))}
          </div>
        ) : null}
        <div className="min-w-0">
          <svg
            viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
            width={width}
            height={height}
            role="img"
            aria-label={label}
            shapeRendering="geometricPrecision"
            className="iso-art ml-auto block h-auto max-w-full"
          >
            {children}
          </svg>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${port.w} ${port.h}`}
        width={port.w}
        height={port.h}
        className="pointer-events-none absolute left-0 top-0 hidden sm:block"
        aria-hidden
      >
        {lines.map((line, index) =>
          line ? (
            <g key={index} className={active === index ? "iso-leader is-hot" : "iso-leader"}>
              <path d={leaderPath(line, 0)} />
              <polygon points={diamond(line.x2, line.y2, active === index ? 6.2 : 5.2)} />
            </g>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function Callout({
  note,
  index,
  active,
  onEnter,
  top,
}: {
  note: Note;
  index: number;
  active: number | null;
  onEnter: (index: number) => void;
  top?: number;
}) {
  const on = active === index;
  return (
    <button
      type="button"
      data-note={index}
      className="w-full text-left"
      style={top === undefined ? undefined : { position: "absolute", left: 0, top }}
      onPointerEnter={() => onEnter(index)}
      onFocus={() => onEnter(index)}
    >
      <span className="flex items-start gap-2.5">
        <span className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rotate-45 border border-[#c67d52]" aria-hidden />
        <span className="relative min-w-0">
          <span className={on ? "block text-sm font-semibold leading-tight text-white" : "block text-sm font-semibold leading-tight text-zinc-200"}>
            {note.title}
          </span>
          {on && note.meta ? (
            <span
              className={
                top === undefined
                  ? "mt-1.5 block text-xs leading-snug text-zinc-300"
                  : "absolute right-full top-1/2 z-20 mr-3 w-56 -translate-y-1/2 rounded-md border border-[#c67d52]/50 bg-[#101010] px-2.5 py-2 text-xs leading-snug text-zinc-200"
              }
            >
              {note.meta}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function frame(label: string, g: Draw, art: ReactNode) {
  const box = g.bounds();
  const notes = g.notes();
  return (
    <Diagram label={label} box={box} notes={notes}>
      {art}
    </Diagram>
  );
}

function Bike({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x - 16} cy={y + 6} rx={10} ry={6} fill="#101010" stroke="#c67d52" strokeWidth={1.4} />
      <ellipse cx={x + 16} cy={y + 6} rx={10} ry={6} fill="#101010" stroke="#c67d52" strokeWidth={1.4} />
      <path
        d={`M ${x - 16} ${y + 6} L ${x - 1} ${y - 14} L ${x + 16} ${y + 6} M ${x - 1} ${y - 14} L ${x + 8} ${y - 14}`}
        fill="none"
        stroke="#c67d52"
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
  );
}

function PosScreen() {
  const g = iso(48, 40, 40);
  const z = 0.18;
  const combo: V3 = [4.58, 1.22, z + 0.68];
  const agua: V3 = [8.08, 3.75, z + 1.35];
  const ajuste: V3 = [11.15, 4.75, z + 0.14];
  const cuenta: V3 = [14.45, 5.15, z + 1.0];
  return frame(
    "Latte, combo, agua y el ajuste sin azúcar reunidos en la cuenta de $4.400",
    g,
    <>
      {g.lane(
        [
          [1.2, 1.05, 0],
          [4.58, 1.22, 0],
          [8.08, 3.75, 0],
          [11.15, 4.75, 0],
          [14.45, 5.15, 0],
        ],
        0.5,
        0,
      )}
      {g.box(0.55, 0.4, 0, 1.3, 1.25, z, "void", false, true)}
      {g.box(3.35, 0.3, 0, 2.45, 1.85, z, "void", false, true)}
      {g.box(7.4, 3.1, 0, 1.35, 1.3, z, "void", false, true)}
      {g.box(10.15, 4.1, 0, 2.0, 1.3, z, "void", false, true)}
      {g.box(13.3, 4.2, 0, 2.3, 1.9, z, "void", false, true)}
      {g.prism(1.2, 1.0, z, 0.48, 1.15, "paper", "#1a0c08")}
      {g.tag([1.2, 1.0, z + 1.15], "Latte", "$3.200")}
      {g.box(3.55, 0.5, z, 2.05, 1.45, 0.68, "paper", false, false, combo)}
      {g.tag(combo, "Combo", "Almuerzo")}
      {g.box(7.65, 3.32, z, 0.85, 0.85, 1.35, "cold", false, false, agua)}
      {g.tag(agua, "Agua", "$1.200")}
      {g.box(10.37, 4.27, z, 1.55, 0.95, 0.14, "cold", false, false, ajuste)}
      {g.tag(ajuste, "Sin azúcar", "Ajuste")}
      {g.box(13.5, 4.42, z, 1.9, 1.45, 1.0, "ember", false, false, cuenta)}
      {g.tag(cuenta, "Cuenta", "$4.400")}
    </>,
  );
}

function CashStrip() {
  const g = iso(150, 150, 42);
  const z = 0.35;
  const drawers = [
    { title: "Apertura", meta: "$50.000", x: 0.4, tone: "paper" as const, open: false },
    { title: "Entrada", meta: "+$18.000", x: 3.7, tone: "ember" as const, open: true },
    { title: "Cierre", meta: "Cuadrado", x: 7.0, tone: "copper" as const, open: false },
  ];
  return frame(
    "Apertura con $50.000, entrada de $18.000 y cierre cuadrado, en el mismo turno",
    g,
    <>
      {g.box(0.1, 0.35, 0, 10.2, 2.5, z, "void")}
      {g.lane([
        [0.3, 2.55, z + 0.02],
        [9.9, 2.55, z + 0.02],
      ])}
      {drawers.map((item) => (
        <g key={item.title}>
          {g.cluster(item.x + 1.25, 1.6, z + 0.6, <>
            {g.box(item.x, 0.7, z, 2.5, 1.8, 1.15, item.tone, false, true)}
            {item.open ? g.box(item.x + 0.35, 1.85, z + 0.4, 1.8, 1.15, 0.22, "paper", false, true) : null}
            {item.open ? g.box(item.x + 0.55, 2.15, z + 0.64, 1.15, 0.55, 0.06, "ember", false, true) : null}
          </>, [item.x, 2.5, z + 0.7])}
          {g.tag(g.crown(item.x, 0.7, z, 2.5, 1.8, 1.15), item.title, item.meta)}
        </g>
      ))}
    </>,
  );
}

function SalonRoom() {
  const g = iso(250, 130, 44);
  return frame(
    "Salón con plano, muro de cocina en vivo y tótem de catálogo",
    g,
    <>
      {g.grid(0.35, 0.35, 5.4, 4.3, 4, 4, 0)}
      {g.box(0, 0, 0, 6.1, 0.28, 2.5, "void")}
      {g.box(0, 0, 0, 0.28, 5.1, 2.5, "void")}
      {g.mouth(1.5, 0, 0.7, 2.4, 0.28, 1.3, "#1a100c")}
      {g.lane([
        [1.1, 4.5, 0.02],
        [3.55, 3.15, 0.02],
        [2.7, 0.45, 0.02],
      ])}
      {g.knot([1.1, 4.5, 0.02])}
      {g.box(3.25, 2.85, 0, 0.6, 0.6, 1.85, "ember")}
      {g.tag([2.7, 0.15, 2.15], "Muro", "Cocina en vivo", "start", -8)}
      {g.tag([1.3, 4.2, 0.1], "Plano", undefined, "end", -8)}
      {g.tag(g.topOf(3.25, 2.85, 0, 0.6, 0.6, 1.85), "Tótem", "Catálogo")}
    </>,
  );
}

function TablePlan() {
  const g = iso(230, 90, 40);
  const tables = [
    { title: "Mesa 2", meta: "Libre", x: 0.2, y: 0.2, tone: "cold" as const },
    { title: "Mesa 4", meta: "Ocupada", x: 3.5, y: 0.2, tone: "ember" as const },
    { title: "Mesa 9", meta: "Libre", x: 0.2, y: 3.5, tone: "cold" as const },
    { title: "Mesa 7", meta: "Cuenta", x: 3.5, y: 3.5, tone: "copper" as const },
  ];
  return frame(
    "Mapa del salón: mesa 2 libre, mesa 4 ocupada, mesa 7 en cuenta y mesa 9 libre",
    g,
    <>
      {g.grid(0, 0, 6.6, 6.6, 2, 2, 0)}
      {g.lane([
        [1.35, 1.35, 0.02],
        [4.65, 1.35, 0.02],
        [4.65, 4.65, 0.02],
        [1.35, 4.65, 0.02],
        [1.35, 1.35, 0.02],
      ])}
      {tables.map((table) => (
        <g key={table.title}>
          {g.cluster(table.x + 1.15, table.y + 1.15, 0.7, <>
            {[
              [0.34, 0.34],
              [1.78, 0.34],
              [0.34, 1.78],
              [1.78, 1.78],
            ].map(([lx, ly]) => (
              <g key={`${lx}-${ly}`}>{g.box(table.x + lx, table.y + ly, 0, 0.18, 0.18, 0.62, "void", false, true)}</g>
            ))}
            {g.box(table.x, table.y, 0.62, 2.3, 2.3, 0.12, table.tone, false, true)}
          </>, [table.x + 0.48, table.y + 1.72, 0.78])}
          {g.tag(g.topOf(table.x, table.y, 0.62, 2.3, 2.3, 0.16), table.title, table.meta)}
        </g>
      ))}
    </>,
  );
}

function KitchenTickets() {
  const g = iso(160, 155, 46);
  const tickets = [
    { title: "Mesa 7", meta: "Entró · 08:05", x: 0.4, tone: "paper" as const },
    { title: "Mesa 4", meta: "En fuego · 04:12", x: 2.7, tone: "ember" as const },
    { title: "Barra", meta: "Listo · 01:40", x: 5.0, tone: "copper" as const },
  ];
  return frame(
    "Comandas en el pase: mesa 7 entró, mesa 4 en fuego y barra lista",
    g,
    <>
      {g.box(0.1, 0.55, 0, 7.6, 1.55, 0.3, "void")}
      {g.lane([
        [0.25, 1.34, 0.32],
        [7.4, 1.34, 0.32],
      ])}
      {tickets.map((ticket) => (
        <g key={ticket.title}>
          {g.box(ticket.x, 0.85, 0.3, 1.7, 0.44, 2.05, ticket.tone)}
          {g.tag(g.crown(ticket.x, 0.85, 0.3, 1.7, 0.44, 2.05), ticket.title, ticket.meta)}
        </g>
      ))}
    </>,
  );
}

function DeliveryLanes() {
  const g = iso(140, 175, 42);
  const fork: V3 = [3.3, 1.85, 0.12];
  return frame(
    "Un pedido se abre en despacho y en retiro",
    g,
    <>
      {g.band([
        [0.35, 1.85, 0.08],
        fork,
        [6.35, 0.7, 0.08],
      ])}
      {g.band([fork, [6.35, 2.85, 0.08]])}
      {g.knot(fork, true, 6)}
      {g.box(0.45, 1.3, 0.08, 1.2, 1.05, 0.75, "ember")}
      {g.box(5.45, 2.25, 0.08, 1.2, 1.1, 0.95, "copper")}
      <Bike x={g.p(6.2, 0.55, 0.2).x} y={g.p(6.2, 0.55, 0.2).y} />
      {g.see(g.p(6.2, 0.55, 0.2).x - 32, g.p(6.2, 0.55, 0.2).y - 22)}
      {g.see(g.p(6.2, 0.55, 0.2).x + 32, g.p(6.2, 0.55, 0.2).y + 16)}
      {g.tag(g.crown(0.45, 1.3, 0.08, 1.2, 1.05, 0.75), "Pedido", "Misma cuenta")}
      {g.tag([6.55, 0.15, 0.4], "Despacho", "Pedido 18", "start", -4)}
      {g.tag(g.crown(5.45, 2.25, 0.08, 1.2, 1.1, 0.95), "Retiro", "Pedido 19")}
    </>,
  );
}

function RecipeCard() {
  const g = iso(230, 175, 48);
  return frame(
    "Un latte vendido descuenta 18 g de café y 150 ml de leche",
    g,
    <>
      {g.lane([
        [2.25, 1.65, 0.7],
        [0.7, 3.7, 0.82],
      ])}
      {g.lane([
        [2.25, 1.65, 0.7],
        [3.3, 3.7, 0.82],
      ])}
      {g.box(0.05, 3.15, 0, 1.55, 1.35, 0.8, "paper")}
      {g.box(2.85, 3.15, 0, 1.55, 1.35, 0.8, "copper")}
      {g.knot([2.25, 1.65, 0.12], true, 5)}
      {g.prism(2.25, 1.15, 0, 0.72, 1.45, "ember", "#1a0c08")}
      {g.tag([2.25, 1.15, 1.5], "Latte", "1 vendido")}
      {g.tag(g.crown(0.05, 3.15, 0, 1.55, 1.35, 0.8), "Café", "−18 g", "end")}
      {g.tag(g.crown(2.85, 3.15, 0, 1.55, 1.35, 0.8), "Leche", "−150 ml", "start")}
    </>,
  );
}

function Shelf() {
  const g = iso(220, 155, 50);
  const slots = [
    { title: "A1", meta: "Harina", x: 0, z: 1.7, fill: "#2a1c14", side: "end" as const },
    { title: "A2", meta: "Azúcar", x: 1.9, z: 1.7, fill: "#2a1c14", side: "start" as const },
    { title: "B1", meta: "Café", x: 0, z: 0, fill: "#6b3d28", side: "end" as const },
    { title: "B2", meta: "Vacía", x: 1.9, z: 0, fill: "#070707", side: "start" as const },
  ];
  return frame(
    "Sala A de secos: casillas A1 harina, A2 azúcar, B1 café y B2 vacía",
    g,
    <>
      {g.box(-0.16, 0.2, -0.08, 4.0, 0.4, 3.5, "void")}
      {slots.map((slot) => (
        <g key={slot.title}>
          {g.box(slot.x, 0.5, slot.z, 1.75, 1.3, 1.6, slot.title === "B2" ? "cold" : "copper")}
          {g.mouth(slot.x, 0.5, slot.z, 1.75, 1.3, 1.6, slot.fill)}
          {g.tag(
            slot.side === "end" ? [slot.x - 0.2, 0.7, slot.z + 1.15] : [slot.x + 1.95, 0.7, slot.z + 1.15],
            slot.title,
            slot.meta,
            slot.side,
            -6,
          )}
        </g>
      ))}
      {g.tag([0.2, -0.15, 3.55], "Sala A · secos", undefined, "start", -6)}
    </>,
  );
}

function FinanceBars() {
  const g = iso(175, 185, 46);
  const read = "Sale de lo que ya pasó en el día.";
  const bars = [
    { title: "Ventas", h: 2.35, tone: "ember" as const, meta: read },
    { title: "Dinero", h: 1.75, tone: "copper" as const, meta: read },
    { title: "Gastos", h: 0.95, tone: "cold" as const, meta: read },
  ];
  const mark = g.p(7.72, 2.4, 0.38);
  return frame(
    "Ventas, dinero y gastos del período, con alza de 12% contra el período anterior",
    g,
    <>
      {g.box(0.2, 0.4, 0, 8.2, 2.15, 0.28, "void", false, true)}
      {g.lane(
        [
          [0.7, 2.4, 0.28],
          [7.7, 2.4, 0.28],
        ],
        0.16,
        0.28,
      )}
      {bars.map((bar, index) => (
        <g key={bar.title}>
          {g.box(0.7 + index * 2.5, 0.65, 0.28, 1.7, 1.55, bar.h, bar.tone)}
          {g.tag(g.crown(0.7 + index * 2.5, 0.65, 0.28, 1.7, 1.55, bar.h), bar.title, bar.meta)}
        </g>
      ))}
      {g.box(7.5, 2.3, 0.28, 0.44, 0.2, 0.1, "ember")}
      {g.caption(mark.x, mark.y, "+12%", "Contra el período anterior: el delta dice si el negocio subió o bajó.")}
    </>,
  );
}

function Funnel() {
  const g = iso(175, 155, 44);
  return frame(
    "El prospecto baja por el embudo hasta la encuesta",
    g,
    <>
      {g.box(0.2, 0.2, 0, 5.2, 1.7, 1.85, "ember")}
      {g.box(0.7, 1.75, 0, 4.1, 1.65, 1.2, "copper")}
      {g.box(1.25, 3.25, 0, 2.9, 1.55, 0.62, "paper")}
      {g.lane([
        g.lip(0.2, 0.2, 1.85, 5.2, 1.7),
        g.lip(0.7, 1.75, 1.2, 4.1, 1.65),
        g.lip(1.25, 3.25, 0.62, 2.9, 1.55),
      ])}
      {g.knot(g.lip(1.25, 3.25, 0.62, 2.9, 1.55), true, 6)}
      {g.tag(g.crown(0.2, 0.2, 0, 5.2, 1.7, 1.85), "Prospecto", "Ficha", "end")}
      {g.tag([0.55, 1.85, 1.35], "Seguimiento", "Embudo", "end", -4)}
      {g.tag([1.1, 3.35, 0.8], "Encuesta", "Después", "end", -4)}
    </>,
  );
}

function Boleta() {
  const g = iso(230, 140, 44);
  const sheets = [
    { title: "Venta", meta: "Latte · $3.200", x: 0.2, y: 0.1, z: 0.62, tone: "paper" as const },
    { title: "Boleta", meta: "Nº 1842", x: 1.45, y: 1.7, z: 0.32, tone: "copper" as const },
    { title: "SII", meta: "Enviada", x: 2.7, y: 3.3, z: 0.04, tone: "ember" as const },
  ];
  const w = 3.15;
  const d = 1.95;
  return frame(
    "La venta del latte emite la boleta 1842 y sale enviada al SII",
    g,
    <>
      {g.lane(sheets.map((sheet) => g.lip(sheet.x, sheet.y, 0, w, d)))}
      {sheets.map((sheet) => (
        <g key={sheet.title}>
          {g.box(sheet.x, sheet.y, sheet.z, w, d, 0.08, sheet.tone)}
          {g.tag([sheet.x - 0.08, sheet.y + 0.2, sheet.z + 0.35], sheet.title, sheet.meta, "end", -2)}
        </g>
      ))}
      {g.knot([2.7 + w - 0.4, 3.3 + 0.35, 0.16], true, 7)}
    </>,
  );
}

function PhoneMenu() {
  const g = iso(145, 165, 46);
  return frame(
    "La carta del teléfono arma el pedido y entra a cocina en la misma cuenta",
    g,
    <>
      {g.lane([
        g.base(0.35, 0.4, 0, 1.15, 0.78),
        g.base(2.7, 1.05, 0, 1.4, 1.15),
        g.base(5.3, 0.95, 0, 0.5, 1.45),
      ])}
      {g.cluster(0.92, 0.79, 1.28, <>
        {g.box(0.35, 0.4, 0, 1.15, 0.78, 2.55, "void", false, true)}
        {g.mouth(0.35, 0.4, 0.42, 1.15, 0.78, 1.75, "#0c0c0c", true)}
        {g.box(0.68, 0.92, 1.05, 0.48, 0.1, 0.48, "ember", false, true)}
      </>, [0.35, 1.18, 1.55])}
      {g.box(2.7, 1.05, 0, 1.4, 1.15, 0.9, "paper")}
      {g.box(5.3, 0.95, 0, 0.5, 1.45, 1.75, "ember")}
      {g.tag(g.crown(0.35, 0.4, 0, 1.15, 0.78, 2.55), "Carta", "QR", "end")}
      {g.tag(g.crown(2.7, 1.05, 0, 1.4, 1.15, 0.9), "Pedido", "2 ítems")}
      {g.tag(g.crown(5.3, 0.95, 0, 0.5, 1.45, 1.75), "Cocina", "Misma cuenta", "start")}
    </>,
  );
}

function LabelSheet() {
  const g = iso(170, 150, 48);
  return frame(
    "La etiqueta de 200 ml sale de la receta del latte, en formato de norma",
    g,
    <>
      {g.lane([
        [1.45, 1.5, 0],
        [3.55, 2.15, 0],
      ])}
      {g.prism(1.15, 1.05, 0, 0.55, 1.25, "copper", "#1a0c08")}
      {g.cluster(4.3, 1.7, 0.04, g.box(2.15, 0.2, 0, 4.3, 3.05, 0.08, "paper", false, true), [2.15, 2.85, 0.12])}
      {g.rules(2.15, 0.2, 0.1, 4.3, 3.05, 4)}
      {g.box(5.15, 2.15, 0.08, 0.7, 0.55, 0.06, "ember")}
      {g.tag([1.15, 1.05, 1.4], "Receta", "Latte", "end")}
      {g.tag([1.9, 2.5, 0.3], "Etiqueta", "200 ml", "end")}
      {g.tag([5.5, 2.4, 0.28], "Norma", "Lista", "start")}
    </>,
  );
}

function PayMethods() {
  const g = iso(155, 145, 46);
  const spine: V3 = [3.55, 2.35, 0];
  return frame(
    "Transbank, efectivo y transferencia cierran en la cuenta, con propina del 10%",
    g,
    <>
      {g.lane([[1.25, 1.5, 0], spine])}
      {g.lane([[3.45, 1.48, 0], spine])}
      {g.lane([[5.7, 1.42, 0], [4.2, 1.9, 0], spine])}
      {g.lane([spine, [3.55, 4.2, 0]])}
      {g.knot(spine, true, 5)}
      {g.cluster(1.25, 0.82, 0.14, <>
        {g.box(0.15, 0.25, 0, 2.2, 1.15, 0.1, "paper", false, true)}
        {g.box(0.15, 0.55, 0.1, 2.2, 0.22, 0.04, "ember", false, true)}
      </>, [0.5, 1.05, 0.16])}
      {g.cluster(3.55, 0.72, 0.28, <>
        {g.box(2.7, 0.15, 0, 1.7, 1.15, 0.1, "paper", false, true)}
        {g.box(2.86, 0.3, 0.1, 1.38, 0.86, 0.1, "copper", false, true)}
        {g.box(3.02, 0.46, 0.2, 1.06, 0.55, 0.1, "ember", false, true)}
      </>, [3.2, 0.9, 0.32])}
      {g.box(4.75, 0.12, 0, 1.95, 1.15, 0.1, "cold")}
      {g.cluster(3.55, 4.52, 0.22, <>
        {g.box(2.85, 3.95, 0, 1.4, 1.15, 0.1, "copper", false, true)}
        {g.box(3.02, 4.1, 0.1, 1.06, 0.86, 0.1, "ember", false, true)}
        {g.box(3.18, 4.25, 0.2, 0.74, 0.56, 0.1, "ember", false, true)}
      </>, [3.35, 4.65, 0.32])}
      {g.tag(g.topOf(0.15, 0.25, 0, 2.2, 1.15, 0.16), "Transbank", "Tarjeta")}
      {g.tag(g.topOf(3.02, 0.46, 0.2, 1.06, 0.55, 0.1), "Efectivo", "Caja")}
      {g.tag(g.topOf(4.75, 0.12, 0, 1.95, 1.15, 0.1), "Transferencia", "Cuenta", "start")}
      {g.tag(g.topOf(3.18, 4.25, 0.2, 0.74, 0.56, 0.1), "Propina", "10%")}
    </>,
  );
}

function Branches() {
  const g = iso(155, 165, 44);
  return frame(
    "Una cuenta con dos sucursales: Centro con su caja y Costa con su salón",
    g,
    <>
      {g.box(0, 1.3, 0, 8.4, 2.5, 0.32, "void")}
      {g.lane([
        [1.7, 3.15, 0.34],
        [6.5, 3.15, 0.34],
      ])}
      {g.knot([4.1, 3.15, 0.34], true, 6)}
      {g.box(0.45, 1.55, 0.32, 2.3, 2.05, 2.15, "ember")}
      {g.mouth(1.05, 1.55, 0.32, 0.85, 2.05, 1.15, "#0c0c0c")}
      {g.box(4.7, 1.7, 0.32, 3.1, 1.9, 1.35, "copper")}
      {g.mouth(5.7, 1.7, 0.32, 0.9, 1.9, 0.85, "#0c0c0c")}
      {g.tag(g.topOf(0.45, 1.55, 0.32, 2.3, 2.05, 2.15), "Centro", "Su caja")}
      {g.tag(g.topOf(4.7, 1.7, 0.32, 3.1, 1.9, 1.35), "Costa", "Su salón", "start")}
      {g.tag([4.15, 4.15, 0.05], "Cuenta", "Un sistema", "middle", 16)}
    </>,
  );
}

function PurchaseFlow() {
  const g = iso(145, 155, 44);
  const papers = [
    { title: "Cotización", meta: "Proveedor", x: 0.2, y: 0.15, z: 0.7 },
    { title: "Orden", meta: "Compra", x: 1.7, y: 1.05, z: 0.38 },
    { title: "Recepción", meta: "Bodega", x: 3.3, y: 1.95, z: 0.08 },
  ];
  return frame(
    "Cotización, orden de compra y recepción que entra a bodega",
    g,
    <>
      {g.lane([
        g.base(0.2, 0.15, 0, 2.5, 1.7),
        g.base(1.7, 1.05, 0, 2.5, 1.7),
        g.base(3.3, 1.95, 0, 2.5, 1.7),
        g.base(5.15, 2.15, 0, 2.15, 1.85),
      ])}
      {papers.map((paper) => (
        <g key={paper.title}>
          {g.box(paper.x, paper.y, paper.z, 2.5, 1.7, 0.08, "paper")}
          {g.tag(g.topOf(paper.x, paper.y, paper.z, 2.5, 1.7, 0.08), paper.title, paper.meta, "start")}
        </g>
      ))}
      {g.box(5.15, 2.15, 0, 2.15, 1.85, 1.05, "ember", true)}
      {g.knot([6.3, 3.3, 0.55], true, 5)}
    </>,
  );
}

function RoleBadges() {
  const g = iso(185, 145, 44);
  const split: V3 = [2.6, 2.55, 0.04];
  return frame(
    "Admin reparte el acceso: caja cobra y garzón atiende",
    g,
    <>
      {g.lane([g.base(1.85, 0.3, 0, 1.1, 1.0), split, g.base(0.15, 2.5, 0, 2.7, 1.45)])}
      {g.lane([split, g.base(4.15, 2.35, 0, 2.5, 1.7)])}
      {g.knot(split, true, 6)}
      {g.box(1.85, 0.3, 0, 1.1, 1.0, 2.35, "ember")}
      {g.box(0.15, 2.5, 0, 2.7, 1.45, 0.85, "copper")}
      {g.box(0.45, 3.35, 0.4, 1.35, 0.7, 0.16, "paper")}
      {g.prism(5.4, 3.15, 0, 0.18, 0.7, "void")}
      {g.box(4.15, 2.35, 0.7, 2.5, 1.7, 0.14, "paper")}
      {g.box(4.9, 2.85, 0.84, 0.7, 0.7, 0.1, "ember")}
      {g.tag(g.topOf(1.85, 0.3, 0, 1.1, 1.0, 2.35), "Admin", "El negocio")}
      {g.tag(g.topOf(0.15, 2.5, 0, 2.7, 1.45, 0.85), "Caja", "Cobra", "end")}
      {g.tag(g.topOf(4.15, 2.35, 0.7, 2.5, 1.7, 0.14), "Garzón", "Atiende", "start")}
    </>,
  );
}

const STAGES: Record<string, () => ReactNode> = {
  "Punto de venta táctil": PosScreen,
  "Caja y arqueo": CashStrip,
  "Salón digital 3D": SalonRoom,
  "Mesas y salón": TablePlan,
  "Cocina y KDS": KitchenTickets,
  "Delivery y retiro": DeliveryLanes,
  "Inventario y recetas": RecipeCard,
  "Bodegas visuales": Shelf,
  "Informes y finanzas": FinanceBars,
  "CRM comercial": Funnel,
  "Facturación electrónica": Boleta,
  "Menú QR y pedidos": PhoneMenu,
  "Etiquetas nutricionales": LabelSheet,
  "Medios de pago": PayMethods,
  "Multi-sucursal": Branches,
  "Proveedores y compras": PurchaseFlow,
  "Roles y permisos": RoleBadges,
};

function Board({ title, children }: { title: string; children: ReactNode }) {
  const dossier = LANDING_MODULE_DOSSIERS[title];
  return (
    <div>
      <div className="relative z-10 overflow-hidden rounded-2xl border border-[#c67d52]/30 bg-[#101010]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c67d52]">Ejemplo</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Así se mueve</p>
        </div>
        <div className="px-3 py-5 sm:px-6">{children}</div>
      </div>
      {dossier ? (
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {dossier.marks.map((mark, index) => (
            <li
              key={mark}
              className="rounded-xl border border-white/10 bg-[#101010] px-4 py-4"
            >
              <div className="flex items-baseline gap-2.5">
                <p className="font-display text-sm tabular-nums text-[#c67d52]">{String(index + 1).padStart(2, "0")}</p>
                <p className="text-base font-semibold text-white">{mark}</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{dossier.steps[index]}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function ModuleStage({ title }: { title: string }) {
  const Stage = STAGES[title];
  const reduce = useReducedMotion();
  if (!Stage) return null;
  return (
    <div className="mt-6">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={title}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
          transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <Board title={title}>
            <Stage />
          </Board>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
