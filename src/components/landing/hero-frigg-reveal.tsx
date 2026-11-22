"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo del inicio. En reposo no se dibuja nada: queda el plexus.
 * El mouse asolea solo el trazo por donde pasó: un disco marcado, cola corta.
 * Si el cursor se queda quieto dentro del inicio, ese disco sigue revelado.
 */
export function HeroFriggReveal({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let dead = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const spots: Array<{ x: number; y: number; a: number }> = [];
    let cursor: { x: number; y: number } | null = null;
    let w = 0;
    let h = 0;
    let plate: HTMLCanvasElement | null = null;
    let mask: HTMLCanvasElement | null = null;
    let lit: HTMLCanvasElement | null = null;

    function layout(img: HTMLImageElement) {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.max(1, Math.floor(w * dpr));
      canvas!.height = Math.max(1, Math.floor(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Cubre todo el ancho. Si la altura se sale, se centra y el borde se degrada.
      const scale = w / img.naturalWidth;
      const dw = w;
      const dh = img.naturalHeight * scale;
      const dy = (h - dh) / 2;

      plate = document.createElement("canvas");
      plate.width = Math.max(1, Math.floor(w));
      plate.height = Math.max(1, Math.floor(h));
      const pctx = plate.getContext("2d");
      pctx?.drawImage(img, 0, dy, dw, dh);
      if (pctx) {
        // Baja las luces para que el dibujo salga del negro, no como una lámina clara encima.
        pctx.globalCompositeOperation = "source-atop";
        pctx.fillStyle = "rgba(0,0,0,0.62)";
        pctx.fillRect(0, 0, w, h);
        pctx.globalCompositeOperation = "source-over";
        const top = Math.max(0, dy);
        const bottom = Math.min(h, dy + dh);
        const span = Math.max(1, bottom - top);
        const edge = Math.min(120, span * 0.22);
        pctx.globalCompositeOperation = "destination-in";
        const vertical = pctx.createLinearGradient(0, top, 0, bottom);
        vertical.addColorStop(0, "rgba(0,0,0,0)");
        vertical.addColorStop(edge / span, "rgba(0,0,0,1)");
        vertical.addColorStop(1 - edge / span, "rgba(0,0,0,1)");
        vertical.addColorStop(1, "rgba(0,0,0,0)");
        pctx.fillStyle = vertical;
        pctx.fillRect(0, 0, w, h);
        const side = Math.min(56, w * 0.045);
        const horizontal = pctx.createLinearGradient(0, 0, w, 0);
        horizontal.addColorStop(0, "rgba(0,0,0,0)");
        horizontal.addColorStop(side / w, "rgba(0,0,0,1)");
        horizontal.addColorStop(1 - side / w, "rgba(0,0,0,1)");
        horizontal.addColorStop(1, "rgba(0,0,0,0)");
        pctx.fillStyle = horizontal;
        pctx.fillRect(0, 0, w, h);
        pctx.globalCompositeOperation = "source-over";
      }
      mask = document.createElement("canvas");
      mask.width = plate.width;
      mask.height = plate.height;
      lit = document.createElement("canvas");
      lit.width = plate.width;
      lit.height = plate.height;
    }

    function paint() {
      if (!plate || !mask || !lit) return;
      const mctx = mask.getContext("2d");
      const lctx = lit.getContext("2d");
      if (!mctx || !lctx) return;

      const alive = cursor !== null || spots.some((spot) => spot.a >= 0.08);
      ctx!.clearRect(0, 0, w, h);
      if (!alive) {
        document.querySelector(".cosmic-backdrop")?.classList.remove("is-holding-frigg");
        return;
      }

      mctx.clearRect(0, 0, w, h);
      if (cursor) {
        const radius = 200;
        const glow = mctx.createRadialGradient(cursor.x, cursor.y, radius * 0.94, cursor.x, cursor.y, radius);
        glow.addColorStop(0, "rgba(255,255,255,1)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        mctx.fillStyle = glow;
        mctx.beginPath();
        mctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
        mctx.fill();
      }
      for (const spot of spots) {
        if (spot.a < 0.08) continue;
        const radius = 200;
        const glow = mctx.createRadialGradient(spot.x, spot.y, radius * 0.94, spot.x, spot.y, radius);
        glow.addColorStop(0, `rgba(255,255,255,${spot.a})`);
        glow.addColorStop(1, "rgba(255,255,255,0)");
        mctx.fillStyle = glow;
        mctx.beginPath();
        mctx.arc(spot.x, spot.y, radius, 0, Math.PI * 2);
        mctx.fill();
      }

      lctx.clearRect(0, 0, w, h);
      lctx.globalCompositeOperation = "source-over";
      lctx.drawImage(plate, 0, 0);
      lctx.globalCompositeOperation = "destination-in";
      lctx.drawImage(mask, 0, 0);
      lctx.globalCompositeOperation = "source-over";
      ctx!.drawImage(lit, 0, 0);
      const backdrop = document.querySelector(".cosmic-backdrop");
      backdrop?.classList.toggle("is-holding-frigg", true);
    }

    function tick() {
      if (dead) return;
      for (const spot of spots) spot.a *= 0.86;
      paint();
      raf = requestAnimationFrame(tick);
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        if (cursor) spots.push({ x: cursor.x, y: cursor.y, a: 1 });
        cursor = null;
        if (spots.length > 6) spots.shift();
        return;
      }
      if (cursor && Math.hypot(cursor.x - x, cursor.y - y) >= 8) {
        spots.push({ x: cursor.x, y: cursor.y, a: 1 });
        if (spots.length > 6) spots.shift();
      }
      cursor = { x, y };
    }

    const img = new Image();
    img.onload = () => {
      if (dead) return;
      layout(img);
      if (reduced) return;
      raf = requestAnimationFrame(tick);
    };
    img.src = src;

    const onResize = () => {
      if (img.complete && img.naturalWidth) layout(img);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove);
    return () => {
      dead = true;
      document.querySelector(".cosmic-backdrop")?.classList.remove("is-holding-frigg");
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [src]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
