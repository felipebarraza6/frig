"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { seededRandom } from "./salon-environment";

/* ------------------------------------------------------------------ */
/* Enlaces entre nodos con "lluvia digital" estilo Matrix: tubos por  */
/* donde caen glifos, con ciclo de materialización (se dibujan desde  */
/* un extremo, brillan, y se desvanecen). Al mirarlos de cerca se     */
/* encienden en verde Matrix.                                         */
/* ------------------------------------------------------------------ */

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789$#*+=<>";

/** Textura de estelas de glifos corriendo en horizontal (U = largo del tubo). */
function useGlyphStreamTexture() {
  return useMemo(() => {
    const rand = seededRandom(1337);
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = "middle";

    const rows = 4;
    const rowH = canvas.height / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH + rowH / 2;
      // Estelas: segmentos con cabeza brillante y cola que se apaga
      let x = rand() * 120;
      while (x < canvas.width) {
        const len = 60 + rand() * 200;
        const headX = x + len;
        const chars = Math.floor(len / 14);
        for (let i = 0; i < chars; i++) {
          const cx = x + i * 14;
          const k = i / chars; // 0 cola → 1 cabeza
          const a = Math.pow(k, 1.8) * (0.35 + rand() * 0.4);
          ctx.font = `${rand() < 0.12 ? "700" : "500"} 13px monospace`;
          ctx.fillStyle = `rgba(190, 255, 214, ${a.toFixed(3)})`;
          ctx.fillText(GLYPHS[Math.floor(rand() * GLYPHS.length)], cx, y);
        }
        // Cabeza blanca brillante
        ctx.font = "700 14px monospace";
        ctx.shadowColor = "rgba(140,255,190,0.9)";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillText(GLYPHS[Math.floor(rand() * GLYPHS.length)], headX, y);
        ctx.shadowBlur = 0;
        x = headX + 30 + rand() * 140;
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

/** Atlas de glifos individuales brillantes (para los viajeros). */
function useGlyphSprites() {
  return useMemo(() => {
    const rand = seededRandom(4242);
    const out: THREE.CanvasTexture[] = [];
    for (let v = 0; v < 8; v++) {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.font = "700 40px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(120,255,180,1)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "rgba(235,255,242,0.98)";
      ctx.fillText(GLYPHS[Math.floor(rand() * GLYPHS.length)], 32, 34);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      out.push(tex);
    }
    return out;
  }, []);
}

const LINK_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINK_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uOffset;
  uniform float uRepeat;
  uniform float uProgress;   // frente de materialización 0..1
  uniform float uHot;        // cuánto lo mira la cámara
  uniform vec3 uPrimary;
  uniform vec3 uMatrix;

  void main() {
    float u = mix(vUv.x, 1.0 - vUv.x, uOffset > 0.5 ? 1.0 : 0.0);

    // Dos capas de lluvia a distinta velocidad (parallax digital)
    vec4 g1 = texture2D(uMap, vec2(u * uRepeat - uTime * uSpeed, vUv.y));
    vec4 g2 = texture2D(uMap, vec2(u * uRepeat * 0.5 - uTime * uSpeed * 0.55 + 0.31, vUv.y));
    vec4 glyph = vec4(max(g1.rgb, g2.rgb * 0.7), max(g1.a, g2.a * 0.65));

    // Materialización: visible solo detrás del frente; el frente arde
    float behind = smoothstep(uProgress, uProgress - 0.10, u);
    float tip = exp(-abs(u - uProgress) * 26.0) * step(0.001, uProgress) * step(uProgress, 0.999);

    // Color: primario en reposo → verde Matrix cuando lo miras
    vec3 base = mix(uPrimary, uMatrix, clamp(uHot * 1.2, 0.0, 1.0));
    vec3 col = base * glyph.rgb * (0.85 + uHot * 0.9);
    col += vec3(1.0) * glyph.a * uHot * 0.35;   // brillo frío al enfocar
    col += mix(base, vec3(1.0), 0.6) * tip * 1.6; // punta de materialización

    float alpha = glyph.a * behind * (0.28 + uHot * 0.72) + tip * 0.9;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

interface LinkDef {
  curve: THREE.QuadraticBezierCurve3;
  mid: THREE.Vector3;
  phase: number;
  speed: number;
  dir: number;
  travelerT: number;
  travelerSpeed: number;
  sprite: number;
}

export function MatrixLinks({
  nodes,
  primary,
  dark,
}: {
  /** Posiciones base (world) de los nodos a conectar. */
  nodes: THREE.Vector3[];
  primary: string;
  dark: boolean;
}) {
  const { camera } = useThree();
  const streamTex = useGlyphStreamTexture();
  const spriteTexs = useGlyphSprites();
  const groupRef = useRef<THREE.Group>(null);
  const travelersRef = useRef<THREE.Group>(null);
  const look = useMemo(() => new THREE.Vector3(), []);
  const toMid = useMemo(() => new THREE.Vector3(), []);

  const links = useMemo<LinkDef[]>(() => {
    if (nodes.length < 2) return [];
    const rand = seededRandom(nodes.length * 7919 + 17);
    let maxDist = 0;
    for (const a of nodes) for (const b of nodes) maxDist = Math.max(maxDist, a.distanceTo(b));
    const linkDist = Math.max(4.2, maxDist * 0.38);
    const out: LinkDef[] = [];
    for (let i = 0; i < nodes.length; i++) {
      let made = 0;
      for (let j = i + 1; j < nodes.length && made < 2; j++) {
        const d = nodes[i].distanceTo(nodes[j]);
        if (d > 1.6 && d < linkDist) {
          const mid = nodes[i].clone().lerp(nodes[j], 0.5);
          mid.y += 0.7 + rand() * 1.2;
          mid.x += (rand() - 0.5) * 0.9;
          mid.z += (rand() - 0.5) * 0.9;
          out.push({
            curve: new THREE.QuadraticBezierCurve3(nodes[i].clone(), mid, nodes[j].clone()),
            mid,
            phase: rand(),
            speed: 0.10 + rand() * 0.22,
            dir: rand() < 0.5 ? 0 : 1,
            travelerT: rand(),
            travelerSpeed: 0.10 + rand() * 0.18,
            sprite: Math.floor(rand() * 8),
          });
          made++;
        }
      }
    }
    return out.slice(0, 64);
  }, [nodes]);

  const geometries = useMemo(
    () =>
      links.map(
        (l) => new THREE.TubeGeometry(l.curve, 56, 0.035, 6, false),
      ),
    [links],
  );

  const materials = useMemo(
    () =>
      links.map(
        (l) =>
          new THREE.ShaderMaterial({
            vertexShader: LINK_VERT,
            fragmentShader: LINK_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
              uMap: { value: streamTex },
              uTime: { value: 0 },
              uSpeed: { value: l.speed },
              uOffset: { value: l.dir },
              uRepeat: { value: 3.5 },
              uProgress: { value: 0 },
              uHot: { value: 0 },
              uPrimary: { value: new THREE.Color(primary) },
              uMatrix: { value: new THREE.Color(dark ? "#3dff8b" : "#0e9f5b") },
            },
          }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primary/dark se actualizan en useEffect
    [links, streamTex],
  );

  // Estado mutable del frame loop vive en un ref (patrón R3F seguro).
  const sim = useRef<{ links: LinkDef[]; materials: THREE.ShaderMaterial[] }>({
    links: [],
    materials: [],
  });

  useEffect(() => {
    sim.current = { links, materials };
    return () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    };
  }, [links, materials, geometries]);

  useEffect(() => {
    for (const m of sim.current.materials) {
      m.uniforms.uPrimary.value.set(primary);
      m.uniforms.uMatrix.value.set(dark ? "#3dff8b" : "#0e9f5b");
    }
  }, [materials, primary, dark]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    camera.getWorldDirection(look);
    const { links: liveLinks, materials: liveMats } = sim.current;

    for (let i = 0; i < liveLinks.length; i++) {
      const l = liveLinks[i];
      const m = liveMats[i];
      if (!m) continue;

      // Ciclo de materialización: aparece → sostiene → se desvanece
      const cycle = (t * 0.09 + l.phase) % 1;
      let prog: number;
      if (cycle < 0.32) prog = THREE.MathUtils.smoothstep(cycle / 0.32, 0, 1);
      else if (cycle < 0.74) prog = 1;
      else prog = 1 - THREE.MathUtils.smoothstep((cycle - 0.74) / 0.26, 0, 1);

      toMid.copy(l.mid).sub(camera.position).normalize();
      const facing = Math.max(0, look.dot(toMid));
      const hot = m.uniforms.uHot.value + (facing * facing - m.uniforms.uHot.value) * 0.08;

      m.uniforms.uTime.value = t;
      m.uniforms.uProgress.value = prog;
      m.uniforms.uHot.value = hot;
    }

    // Glifos viajeros recorriendo los enlaces
    const travelers = travelersRef.current;
    if (travelers && liveLinks.length > 0) {
      for (let i = 0; i < travelers.children.length; i++) {
        const sprite = travelers.children[i] as THREE.Sprite;
        const l = liveLinks[i % liveLinks.length];
        if (!l) break;
        l.travelerT = (l.travelerT + l.travelerSpeed * 0.016) % 1;
        const tt = l.dir > 0.5 ? 1 - l.travelerT : l.travelerT;
        sprite.position.copy(l.curve.getPoint(tt));
        const cycle = (t * 0.09 + l.phase) % 1;
        const alive = cycle < 0.74 ? 1 : 0;
        (sprite.material as THREE.SpriteMaterial).opacity =
          alive * (0.55 + 0.45 * Math.sin(t * 6 + i));
      }
    }
  });

  if (links.length === 0) return null;

  return (
    <group ref={groupRef}>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={materials[i]} frustumCulled={false} />
      ))}
      <group ref={travelersRef}>
        {links.map((l, i) => (
          <sprite key={i} scale={[0.3, 0.3, 1]}>
            <spriteMaterial
              map={spriteTexs[l.sprite]}
              transparent
              opacity={0.8}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              color={dark ? "#bfffda" : "#0b7a45"}
            />
          </sprite>
        ))}
      </group>
    </group>
  );
}
