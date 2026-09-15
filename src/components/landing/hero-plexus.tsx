"use client";

import { useEffect, useRef } from "react";

/**
 * Red digital oculta del hero: los nodos flotan invisibles y solo se
 * revelan cerca del cursor, como si el mouse revelara la matriz.
 * Los nodos son destellos de 4 puntas (nada de círculos).
 */
export function HeroPlexus({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const mouse = { x: -9999, y: -9999 };
    // 0 = todo oculto; 1 = matriz revelada. Sigue al cursor con suavidad.
    let wake = 0;

    type P = { x: number; y: number; vx: number; vy: number; r: number; tw: number };
    let pts: P[] = [];

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(110, Math.round((w * h) / 13000));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: 1.2 + Math.random() * 2,
        tw: Math.random() * Math.PI * 2,
      }));
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }
    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    function sparkle(x: number, y: number, r: number, alpha: number, hot: boolean) {
      const c = ctx!;
      c.save();
      c.translate(x, y);
      c.rotate(Math.PI / 4);
      c.strokeStyle = hot
        ? `rgba(255, 200, 140, ${alpha})`
        : `rgba(240, 162, 106, ${alpha})`;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-r, 0);
      c.lineTo(r, 0);
      c.moveTo(0, -r);
      c.lineTo(0, r);
      c.stroke();
      // rayos diagonales cortos: brillo de estrella
      const d = r * 0.45;
      c.strokeStyle = hot
        ? `rgba(255, 200, 140, ${alpha * 0.6})`
        : `rgba(240, 162, 106, ${alpha * 0.6})`;
      c.beginPath();
      c.moveTo(-d, -d);
      c.lineTo(d, d);
      c.moveTo(d, -d);
      c.lineTo(-d, d);
      c.stroke();
      c.restore();
    }

    const REVEAL = 240; // radio en que el cursor revela la matriz
    const LINK = 110;

    function tick() {
      ctx!.clearRect(0, 0, w, h);

      // El despertar sigue la presencia del cursor.
      const target = mouse.x > -999 ? 1 : 0;
      wake += (target - wake) * 0.06;
      if (wake < 0.02) {
        raf = requestAnimationFrame(tick);
        return;
      }

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += 0.03;
        if (p.x < -20) p.x = w + 20;
        else if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        else if (p.y > h + 20) p.y = -20;
      }

      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const adx = a.x - mouse.x;
        const ady = a.y - mouse.y;
        const ad = Math.sqrt(adx * adx + ady * ady);
        // Visibilidad individual: solo nodos cerca del cursor se revelan.
        const near = Math.max(0, 1 - ad / REVEAL);
        const aAlpha = near * near * wake;
        if (aAlpha < 0.03) continue;

        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const bdx = b.x - mouse.x;
          const bdy = b.y - mouse.y;
          const bd = Math.sqrt(bdx * bdx + bdy * bdy);
          const bNear = Math.max(0, 1 - bd / REVEAL);
          if (bNear < 0.05) continue;

          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const alpha = 0.3 * (1 - Math.sqrt(d2) / LINK) * aAlpha * bNear * wake;
            if (alpha > 0.02) {
              ctx!.strokeStyle = `rgba(240, 162, 106, ${alpha})`;
              ctx!.lineWidth = 1;
              ctx!.beginPath();
              ctx!.moveTo(a.x, a.y);
              ctx!.lineTo(b.x, b.y);
              ctx!.stroke();
            }
          }
        }

        // Enlace directo al cursor: la energía converge hacia ti
        if (ad < REVEAL * 1.25) {
          const alpha = 0.42 * (1 - ad / (REVEAL * 1.25)) * wake;
          ctx!.strokeStyle = `rgba(255, 190, 130, ${alpha})`;
          ctx!.lineWidth = 1.2;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(mouse.x, mouse.y);
          ctx!.stroke();
        }

        // Destello con parpadeo propio (titila como estrella)
        const twinkle = 0.55 + 0.45 * Math.sin(a.tw);
        sparkle(a.x, a.y, a.r * (1 + 0.3 * twinkle), aAlpha * twinkle, near > 0.7);
      }

      raf = requestAnimationFrame(tick);
    }

    resize();
    tick();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
