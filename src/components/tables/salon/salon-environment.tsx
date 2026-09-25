"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/** PRNG determinista (mulberry32): generación procedural pura para React. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Tema del salón vía useSyncExternalStore: suscripción al <html> sin
   setState en effects ni hydration mismatch. */
const SERVER_THEME = { primary: "#c67d52", bg: "#121212", isDark: true };
let themeCache: typeof SERVER_THEME | null = null;
let themeKey = "";

function readSalonTheme() {
  const el = document.documentElement;
  const cs = getComputedStyle(el);
  const primary = cs.getPropertyValue("--brand-primary").trim() || "#c67d52";
  const bg = cs.getPropertyValue("--background").trim() || "#121212";
  const key = `${primary}|${bg}|${el.className}`;
  if (key !== themeKey || !themeCache) {
    themeKey = key;
    themeCache = {
      primary,
      bg,
      isDark: el.classList.contains("dark") || bg.toLowerCase() === "#121212",
    };
  }
  return themeCache;
}

function subscribeTheme(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  return () => obs.disconnect();
}

/** Colores del tema (marca + fondo), reactivo a cambios de tema. */
export function useSalonTheme() {
  return useSyncExternalStore(subscribeTheme, readSalonTheme, () => SERVER_THEME);
}

/* ------------------------------------------------------------------ */
/* Piso del salón estilo pixel art: tiles cuadrados con grout, viñeta */
/* suave y un anillo de luz primary que persigue al puntero.          */
/* ------------------------------------------------------------------ */

const FLOOR_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FLOOR_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform vec3 uBase;
  uniform vec3 uLine;
  uniform vec3 uPrimary;
  uniform vec2 uPointer;
  uniform float uHeat;
  uniform float uTime;

  void main() {
    vec2 p = vWorld.xz;

    // Baldosas grandes, limpias, con junta fina
    float tileSize = 1.4;
    vec2 cell = p / tileSize;
    vec2 f = fract(cell);
    float edge = min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y));
    float grout = 1.0 - smoothstep(0.0, 0.028, edge);
    float checker = mod(floor(cell.x) + floor(cell.y), 2.0);

    // Superficie mate: base cálida + checker muy sutil (nada de pozos)
    vec3 col = mix(uBase, uBase * 1.045, checker);
    // Micro-ruido de tabla (sin procedural pesado)
    float grain = fract(sin(dot(floor(p * 18.0), vec2(12.9898, 78.233))) * 43758.5453);
    col *= 0.97 + grain * 0.06;

    // Junta suave, apenas teñida
    col = mix(col, uLine, grout * 0.55);

    // Hover: glow primary suave (sin crater ni ripples)
    float pd = distance(p, uPointer);
    float glow = exp(-pd * pd * 0.28) * uHeat;
    col = mix(col, mix(col, uPrimary, 0.35), glow * 0.45);
    col += uPrimary * glow * 0.08;

    // Viñeta suave
    vec2 c = abs(vUv - 0.5) * 2.0;
    float vig = smoothstep(1.35, 0.55, max(c.x, c.y));
    col *= mix(0.88, 1.0, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function SalonFloor({
  primary,
  dark,
  roomW,
  roomH,
}: {
  primary: string;
  dark: boolean;
  roomW: number;
  roomH: number;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { raycaster, pointer, camera } = useThree();
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(999, 0, 999), []);
  const heat = useRef(0);

  const uniforms = useMemo(
    () => ({
      uBase: { value: new THREE.Color(dark ? "#1c222b" : "#e9e2d4") },
      uLine: { value: new THREE.Color(dark ? "#2b3442" : "#d8cfbc") },
      uPrimary: { value: new THREE.Color(primary) },
      uPointer: { value: new THREE.Vector2(999, 999) },
      uHeat: { value: 0 },
      uTime: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- colores se actualizan vía ref
    [],
  );

  useEffect(() => {
    const m = mat.current;
    if (!m) return;
    // Piso limpio: tinte primary muy leve
    m.uniforms.uBase.value
      .set(dark ? "#252a32" : "#ebe4d6")
      .lerp(new THREE.Color(primary), dark ? 0.12 : 0.08);
    m.uniforms.uLine.value
      .set(dark ? "#1a1e24" : "#d2c8b6")
      .lerp(new THREE.Color(primary), 0.18);
    m.uniforms.uPrimary.value.set(primary);
  }, [primary, dark]);

  useFrame((state) => {
    const m = mat.current;
    if (!m) return;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    raycaster.setFromCamera(pointer, camera);
    const inside = raycaster.ray.intersectPlane(floorPlane, hit);
    const within =
      inside && Math.abs(hit.x) < roomW / 2 + 2 && Math.abs(hit.z) < roomH / 2 + 2;
    if (within) {
      m.uniforms.uPointer.value.set(hit.x, hit.z);
    }
    heat.current = THREE.MathUtils.lerp(heat.current, within ? 1 : 0, 0.12);
    m.uniforms.uHeat.value = heat.current;
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.02, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[roomW + 4, roomH + 4]} />
      <shaderMaterial
        ref={mat}
        vertexShader={FLOOR_VERT}
        fragmentShader={FLOOR_FRAG}
        uniforms={uniforms}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Luces planas (sin shadow maps: el look pixel art usa blob shadows  */
/* baratos). Un punto cálido sigue al mouse sobre el piso.            */
/* ------------------------------------------------------------------ */

export function SalonLights({ primary, dark }: { primary: string; dark: boolean }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const { pointer, raycaster, camera } = useThree();
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    raycaster.setFromCamera(pointer, camera);
    const ok = raycaster.ray.intersectPlane(floorPlane, hit);
    if (lightRef.current && ok) {
      lightRef.current.position.x = THREE.MathUtils.lerp(lightRef.current.position.x, hit.x, 0.12);
      lightRef.current.position.z = THREE.MathUtils.lerp(lightRef.current.position.z, hit.z, 0.12);
    }
  });

  return (
    <>
      <ambientLight intensity={dark ? 0.62 : 0.78} />
      <directionalLight position={[10, 18, 8]} intensity={dark ? 1.0 : 0.95} color="#fff2e2" />
      <directionalLight position={[-10, 8, -9]} intensity={0.45} color={primary} />
      <hemisphereLight args={dark ? ["#33405c", "#191411", 0.55] : ["#f8fafc", "#d8d0c0", 0.55]} />
      {/* Luz cálida que persigue al puntero */}
      <pointLight
        ref={lightRef}
        position={[0, 2.6, 0]}
        intensity={dark ? 9 : 5}
        distance={11}
        color={primary}
        decay={2}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Blob shadow pixelado: círculo suave horneado en canvas con         */
/* NearestFilter. Barato y combina con el estilo.                     */
/* ------------------------------------------------------------------ */

let blobTex: THREE.CanvasTexture | null = null;
function getBlobTexture() {
  if (blobTex) return blobTex;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, "rgba(0,0,0,0.5)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.28)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  blobTex = tex;
  return tex;
}

export function BlobShadow({
  radius,
  opacity = 0.5,
}: {
  radius: number;
  opacity?: number;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.015, 0]}
      renderOrder={1}
      raycast={() => null}
    >
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial
        map={getBlobTexture()}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}
