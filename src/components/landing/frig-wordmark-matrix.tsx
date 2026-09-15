"use client";

import { useEffect, useRef } from "react";

/**
 * Wordmark Frig como matriz de datos: la letra se dibuja sólida (cuadritos
 * muestreados del PNG) y encima corren los efectos digitales: cuadritos que
 * destellan, bits que se "caen" (dropout) y glitches con desplazamiento.
 * Mismo lenguaje que los nodos del fondo. Autónomo, sin mouse.
 */
export function FrigWordmarkMatrix({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SRC = "/brand/frig-wordmark.png";
    const COLS = 170;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let t = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let solid: HTMLCanvasElement | null = null; // letra sólida pre-renderizada
    let sparks: Array<{ x: number; y: number; s: number; phase: number; freq: number }> = [];
    let slice: { y: number; hh: number; dx: number } | null = null;
    let sliceUntil = 0;
    let nextSlice = 2.5;

    function build(img: HTMLImageElement) {
      const rows = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * COLS));
      const off = document.createElement("canvas");
      off.width = COLS;
      off.height = rows;
      const octx = off.getContext("2d")!;
      octx.drawImage(img, 0, 0, COLS, rows);
      const data = octx.getImageData(0, 0, COLS, rows).data;

      const rect = canvas!.getBoundingClientRect();
      const cell = rect.height / rows;

      // 1) letra sólida pre-renderizada
      solid = document.createElement("canvas");
      solid.width = w * dpr;
      solid.height = h * dpr;
      const sctx = solid.getContext("2d")!;
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 2) celdas destacadas para el titileo
      sparks = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = (y * COLS + x) * 4;
          const a = data[i + 3];
          if (a < 25) continue;
          const px = (x + 0.5) * cell;
          const py = (y + 0.5) * cell;
          // letra sólida
          sctx.fillStyle = `rgba(${Math.round(data[i] * 0.6 + 255 * 0.4)}, ${Math.round(
            data[i + 1] * 0.6 + 240 * 0.4,
          )}, ${Math.round(data[i + 2] * 0.6 + 215 * 0.4)}, ${Math.min(1, a / 180)})`;
          sctx.fillRect(px - cell * 0.55, py - cell * 0.55, cell * 1.1, cell * 1.1);
          // algunas celdas se vuelven "chispas" animadas
          if (Math.random() < 0.06) {
            sparks.push({
              x: px,
              y: py,
              s: cell * 1.1,
              phase: Math.random() * Math.PI * 2,
              freq: 0.6 + Math.random() * 1.4,
            });
          }
        }
      }
    }

    function setup(img: HTMLImageElement) {
      // fijar el aspect ratio ANTES de medir (el canvas es w-auto y h fija)
      canvas!.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      build(img);
    }

    function tick() {
      ctx!.clearRect(0, 0, w, h);
      t += 0.016;
      if (!solid) {
        raf = requestAnimationFrame(tick);
        return;
      }

      // glitch de rebanada: cada ~4s una franja horizontal se desplaza
      // por un instante (la matriz se "reordena"), nunca reinicia.
      if (t > nextSlice) {
        slice = { y: Math.random() * h * 0.8, hh: 6 + Math.random() * 14, dx: (Math.random() - 0.5) * 10 };
        sliceUntil = t + 0.09 + Math.random() * 0.08;
        nextSlice = t + 2.8 + Math.random() * 3.5;
      }
      const slicing = t < sliceUntil && slice;

      // entrada: la letra se revela de izquierda a derecha (una sola vez)
      const reveal = Math.min(1, t / 1.3);
      const revealW = w * (1 - Math.pow(1 - reveal, 3)); // easeOutCubic

      if (reveal < 1) {
        ctx!.save();
        ctx!.beginPath();
        ctx!.rect(0, 0, revealW, h);
        ctx!.clip();
        ctx!.drawImage(solid, 0, 0, w, h);
        // borde de escaneo: línea cálida en el frente de revelado
        const grad = ctx!.createLinearGradient(revealW - 6, 0, revealW + 6, 0);
        grad.addColorStop(0, "rgba(240, 162, 106, 0)");
        grad.addColorStop(0.5, "rgba(255, 220, 180, 0.9)");
        grad.addColorStop(1, "rgba(240, 162, 106, 0)");
        ctx!.fillStyle = grad;
        ctx!.fillRect(revealW - 6, 0, 12, h);
        ctx!.restore();
      } else {
        ctx!.drawImage(solid, 0, 0, w, h);
      }

      // rebanada desplazada: redibuja una franja del logo con offset
      if (slicing && slice) {
        const sy = slice.y * dpr;
        const sh = slice.hh * dpr;
        ctx!.clearRect(slice.dx, sy, w, sh);
        ctx!.drawImage(solid, 0, sy, solid.width, sh, slice.dx, sy, w, sh);
      }

      // barrido de brillo que recorre las letras
      const sweep = ((t * 0.13) % 1.7) - 0.35;

      // chispas: celdas que destellan por encima de la letra
      for (const s of sparks) {
        const tw = Math.sin(t * s.freq * 3 + s.phase);
        if (tw < 0.55) continue;
        const wave = Math.max(0, 1 - Math.abs(s.x / w - sweep) * 12);
        const alpha = Math.min(1, (tw - 0.55) * 1.6 + wave * 0.7);
        ctx!.fillStyle = `rgba(255, 244, 225, ${alpha})`;
        ctx!.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
      }

      // dropouts: bits que se "caen" (agujeros del color del fondo)
      for (let i = 0; i < 7; i++) {
        const seed = Math.sin(t * 1.7 + i * 78.233) * 43758.5453;
        const fx = Math.abs(seed - Math.floor(seed));
        const seed2 = Math.sin(t * 2.3 + i * 12.9898) * 23321.5453;
        const fy = Math.abs(seed2 - Math.floor(seed2));
        ctx!.globalCompositeOperation = "destination-out";
        ctx!.fillStyle = `rgba(0,0,0,${0.5 + fx * 0.4})`;
        ctx!.fillRect(fx * w, fy * h, 2 + fy * 3, 2 + fx * 3);
        ctx!.globalCompositeOperation = "source-over";
      }

      raf = requestAnimationFrame(tick);
    }

    const img = new Image();
    img.onload = () => {
      setup(img);
      if (reduced) {
        if (solid) ctx!.drawImage(solid, 0, 0, w, h);
        return;
      }
      tick();
    };
    img.src = SRC;

    const onResize = () => {
      if (img.complete) setup(img);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-label="Frig" role="img" />;
}
