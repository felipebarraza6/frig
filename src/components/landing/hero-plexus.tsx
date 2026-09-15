"use client";

import { useEffect, useRef } from "react";

/**
 * Muralla viva de datos a toda la página: grilla densa de cuadros anclados,
 * SIEMPRE tenuemente visibles (laten en su lugar) y teñidos con la paleta
 * de tonos de las demos. El cursor REVELA con fuerza a su paso: los bloques
 * cercanos se encienden, vibran más, quedan "tibios" y a veces se rompen
 * en fragmentos. Los calientes se conectan con trazos de circuito.
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
    let wake = 0;
    let t = 0;

    // Paleta de marca Frig: cobres, brasas y un toque de salvia.
    const PALETTE = [
      "240, 162, 106", // brasa clara
      "198, 125, 82", // cobre
      "232, 146, 94", // cobre cálido
      "240, 140, 60", // naranja profundo
      "157, 182, 143", // salvia (contraste frío de la marca)
      "255, 217, 168", // chispa caliente
    ];

    type P = {
      ax: number;
      ay: number;
      s: number;
      ox: number; // offset cuantizado: el cuadro SALTA, no fluye
      oy: number;
      next: number; // instante del próximo salto
      rgb: string;
      base: number; // visibilidad en reposo (0.04..0.1)
      heat: number;
      glitch: number;
    };
    type F = { x: number; y: number; vx: number; vy: number; s: number; life: number; rgb: string };
    let pts: P[] = [];
    let frags: F[] = [];

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const spacing = 38; // denso: poco espacio vacío
      pts = [];
      for (let gx = spacing / 2; gx < w + spacing; gx += spacing) {
        for (let gy = spacing / 2; gy < h + spacing; gy += spacing) {
          if (Math.random() < 0.22) continue;
          pts.push({
            ax: gx + (Math.random() - 0.5) * 16,
            ay: gy + (Math.random() - 0.5) * 16,
            s: 2 + Math.random() * 3.5,
            ox: 0,
            oy: 0,
            next: Math.random() * 1.6,
            rgb: PALETTE[Math.floor(Math.random() * PALETTE.length)],
            base: 0.04 + Math.random() * 0.07,
            heat: 0,
            glitch: 0,
          });
        }
      }
      frags = [];
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

    function block(x: number, y: number, s: number, alpha: number, rgb: string, hot: boolean) {
      const c = ctx!;
      const half = s / 2;
      c.fillStyle = hot
        ? `rgba(255, 235, 210, ${alpha * 0.4})`
        : `rgba(${rgb}, ${alpha * 0.3})`;
      c.strokeStyle = `rgba(${rgb}, ${alpha})`;
      c.lineWidth = 1;
      c.fillRect(x - half, y - half, s, s);
      c.strokeRect(x - half, y - half, s, s);
      if (alpha > 0.22) {
        const inner = Math.max(1.5, s * 0.36);
        c.fillStyle = hot
          ? `rgba(255, 245, 230, ${alpha})`
          : `rgba(${rgb}, ${alpha * 0.8})`;
        c.fillRect(x - inner / 2, y - inner / 2, inner, inner);
      }
    }

    function trace(ax: number, ay: number, bx: number, by: number, alpha: number, rgb: string) {
      const c = ctx!;
      c.strokeStyle = `rgba(${rgb}, ${alpha})`;
      c.lineWidth = 1;
      c.setLineDash([4, 4]);
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, ay);
      c.lineTo(bx, by);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = `rgba(255, 220, 180, ${alpha * 1.3})`;
      c.fillRect(bx - 1.5, ay - 1.5, 3, 3);
    }

    const REVEAL = 330;
    const LINK = 120;
    const HEAT_DECAY = 0.994;

    // Ola de barrido (evento "frig:matrix-sweep"): un frente vertical
    // enciende todos los nodos a su paso — el fondo "se traga" la pantalla
    // y luego los nodos decaen revelando el nuevo contenido.
    let sweep: { start: number; dur: number } | null = null;
    let sweepGlowUntil = -1; // la pared se mantiene encendida mientras cambia el contenido
    function onSweep() {
      sweep = { start: -1, dur: 0.9 };
      sweepGlowUntil = -1;
    }

    function tick() {
      ctx!.clearRect(0, 0, w, h);
      t += 0.016;

      if (sweep) {
        if (sweep.start < 0) sweep.start = t;
        if (t - sweep.start > sweep.dur) sweep = null;
        // mantener la pared encendida un poco después de la ola:
        // da tiempo a que el contenido nuevo emerja "desde" ella.
        sweepGlowUntil = t + 1.1;
      }
      const holdGlow = t < sweepGlowUntil;
      const decay = holdGlow ? 0.9988 : HEAT_DECAY;
      const sweepP = sweep ? (t - sweep.start) / sweep.dur : -1;
      const frontX = sweepP >= 0 ? sweepP * (w + 200) - 100 : -9999;

      const target = mouse.x > -999 ? 1 : 0;
      wake += (target - wake) * 0.06;

      const hot: Array<{ x: number; y: number; alpha: number; rgb: string; p: { ax: number; ay: number; s: number; glitch: number } }> = [];

      for (const p of pts) {
        const dx = p.ax - mouse.x;
        const dy = p.ay - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < REVEAL) {
          const near = 1 - d / REVEAL;
          if (near * wake > p.heat) p.heat = near * wake;
          if (p.heat > 0.85 && Math.random() < 0.004 && frags.length < 60) {
            for (let f = 0; f < 2; f++) {
              frags.push({
                x: p.ax,
                y: p.ay,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2 - 0.3,
                s: p.s * (0.3 + Math.random() * 0.3),
                life: 1,
                rgb: p.rgb,
              });
            }
            p.glitch = 10;
          }
        }
        // ola de barrido: el frente enciende todo lo que toca
        if (sweepP >= 0) {
          const sd = frontX - p.ax;
          if (sd > 0 && sd < 130) {
            p.heat = Math.max(p.heat, (1 - sd / 130) * 0.95);
          }
        }
        if (p.heat < 0.03) p.heat = 0;
        else p.heat *= decay;
        if (p.glitch > 0) p.glitch -= 1;
        // glint autónomo: sin mouse, un bloque brilla suave de vez en cuando
        // ("acá hay algo") — se enciende y se apaga con la misma decaída.
        if (p.heat < 0.02 && Math.random() < 0.0006) {
          p.heat = 0.14 + Math.random() * 0.14;
        }

        // reposo: latido tenue siempre visible; calor: encendido pleno
        // (parpadeo también cuantizado: cambia con cada salto, no fluye)
        const twinkle = 0.55 + 0.45 * Math.sin(p.next * 41.7 + p.ox * 13.1);
        const idle = p.base * twinkle * Math.max(wake, 0.25);
        const lit = p.heat > 0 ? Math.min(1, p.heat * twinkle + p.heat * 0.3) : 0;
        const alpha = Math.max(idle, lit);
        if (alpha < 0.02) continue;

        // movimiento DIGITAL: quieto en su celda; a intervalos aleatorios
        // SALTA (teletransporte cuantizado) a otra micro-posición. Nada de ondas.
        if (t > p.next) {
          const amp = 1 + p.heat * 3.5;
          p.ox = (Math.random() - 0.5) * 2 * amp;
          p.oy = (Math.random() - 0.5) * 2 * amp;
          // de vez en cuando, un salto largo: paquete de datos recolocado
          if (Math.random() < 0.08) {
            p.ox = (Math.random() - 0.5) * amp * 6;
            p.oy = (Math.random() - 0.5) * amp * 6;
          }
          p.next = t + 0.5 + Math.random() * 1.4;
        }
        const x = p.ax + p.ox;
        const y = p.ay + p.oy;
        const isHot = p.heat > 0.5;
        if (p.heat > 0.15) {
          hot.push({ x, y, alpha, rgb: p.rgb, p });
        }
        const grow = 1 + (p.heat > 0 ? p.heat * 0.55 : 0) + (p.glitch > 0 ? 0.45 : 0);
        block(x, y, p.s * grow, alpha, p.rgb, isHot);
      }

      // trazos solo entre bloques calientes (barato: lista chica)
      // + paquetes de datos viajando por el circuito
      for (let i = 0; i < hot.length; i++) {
        const a = hot[i];
        for (let j = i + 1; j < hot.length; j++) {
          const b = hot[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const alpha = 0.24 * (1 - Math.sqrt(d2) / LINK) * a.alpha * b.alpha;
            if (alpha > 0.02) {
              trace(a.x, a.y, b.x, b.y, alpha, a.rgb);
              // paquete: un cuadrito brillante recorre la ruta L
              if ((i + j) % 3 === 0) {
                const k = (t * 0.9 + i * 0.37 + j * 0.11) % 1;
                let px: number, py: number;
                if (k < 0.5) {
                  px = a.x + (b.x - a.x) * (k * 2);
                  py = a.y;
                } else {
                  px = b.x;
                  py = a.y + (b.y - a.y) * ((k - 0.5) * 2);
                }
                ctx!.fillStyle = `rgba(255, 230, 200, ${alpha * 2.2})`;
                ctx!.fillRect(px - 1.5, py - 1.5, 3, 3);
              }
            }
          }
        }
      }

      // fragmentos de matrix
      for (let i = frags.length - 1; i >= 0; i--) {
        const f = frags[i];
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.01;
        f.life -= 0.014;
        if (f.life <= 0) {
          frags.splice(i, 1);
          continue;
        }
        block(f.x, f.y, f.s, f.life * 0.8, f.rgb, false);
      }

      raf = requestAnimationFrame(tick);
    }

    resize();
    tick();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("frig:matrix-sweep", onSweep);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("frig:matrix-sweep", onSweep);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
