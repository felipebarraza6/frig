"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { kitchenTicketCode, type KitchenTicket } from "@/lib/api/kitchen";
import type { KitchenStation } from "@/lib/api/kitchen-stations";
import { BlobShadow } from "./salon-environment";

/* ------------------------------------------------------------------ */
/* Pantallas vivas del salón en estilo pixel art: KDS de cocina,      */
/* alacena de inventario y barra de órdenes. Cámara fija: el click    */
/* abre el panel correspondiente SIN salir de la vista 3D.            */
/* ------------------------------------------------------------------ */

export type SalonOverlayKind =
  | "kitchen"
  | "inventory"
  | "orders"
  | "catalog"
  | "deliveries"
  | "cash";

/** Info que un hotspot muestra al pasar el mouse (tooltip que sigue al cursor). */
export interface HotspotHoverInfo {
  title?: string;
  subtitle?: string;
  action?: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Altura de muro del salón (misma fórmula que el venue). */
export function salonWallH(roomW: number, roomH: number) {
  return clamp(4.6 + Math.min(roomW, roomH) * 0.06, 4.8, 6.4);
}

export function kdsBankLayout(roomW: number, roomH: number, wallH: number, count: number) {
  const n = Math.max(1, count);
  const screenW = clamp(roomW * (n > 1 ? 0.14 : 0.18), 1.55, 2.35);
  const screenH = clamp(screenW * 0.78, 1.15, 1.65);
  const gap = 0.22;
  const z = -(roomH / 2 + 0.42);
  const cy = 1.62;
  const originX = roomW * 0.22;
  return { screenW, screenH, z, cy, gap, originX, n };
}

export function kdsScreenLayout(roomW: number, roomH: number, wallH: number) {
  const b = kdsBankLayout(roomW, roomH, wallH, 1);
  return { screenW: b.screenW, screenH: b.screenH, x: b.originX, z: b.z, cy: b.cy };
}

export function inventoryShelfLayout(roomW: number, roomH: number, wallH: number) {
  // Pared trasera, a la izquierda del logo, mirando al frente (+z)
  const x = -roomW * 0.27;
  const z = -(roomH / 2 + 0.5);
  const shelfW = clamp(roomW * 0.15, 2.2, 3.2);
  const shelfH = clamp(wallH * 0.6, 2.4, 3.1);
  return { x, z, shelfW, shelfH };
}

export function ordersCounterLayout(roomW: number, roomH: number) {
  // Frente izquierdo, mirando a la cámara (+z)
  const z = roomH / 2 - 1.7;
  const x = -roomW * 0.24;
  const counterW = clamp(roomW * 0.18, 2.4, 3.4);
  return { x, z, counterW };
}

/* ------------------------------------------------------------------ */
/* Textura del KDS pixel art: NearestFilter, bloques cuadrados y      */
/* monospace. Se repinta solo cuando cambian los datos (y un latido   */
/* cada ~1s para los puntos vivos).                                   */
/* ------------------------------------------------------------------ */

function ticketsForStation(tickets: KitchenTicket[], stationId: number | null) {
  if (stationId == null) return tickets;
  return tickets.filter((t) =>
    t.items.some((it) => Number(it.station) === stationId),
  );
}

function useKdsScreenTexture(
  primary: string,
  tickets: KitchenTicket[],
) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 640;
    return c;
  }, []);
  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }, [canvas]);

  const texRef = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    texRef.current = texture;
    return () => {
      texRef.current = null;
      texture.dispose();
    };
  }, [texture]);

  useEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const paint = (beat: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0d0a08";
      ctx.fillRect(0, 0, w, h);

      // Scanlines pixel
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      ctx.fillStyle = `${primary}33`;
      ctx.fillRect(0, 0, w, 36);
      ctx.fillStyle = "#c8c0b4";
      ctx.font = "700 16px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${hh}:${mm}`, w - 16, 24);
      ctx.textAlign = "left";
      const pulse = beat % 1 < 0.5 ? 6 : 8;
      ctx.fillStyle = primary;
      ctx.fillRect(16, 14 - Math.floor(pulse / 2), pulse, pulse);

      const pending = tickets.filter((t) => t.status === "PENDING").length;
      const prep = tickets.filter((t) => t.status === "PREPARING").length;
      const ready = tickets.filter((t) => t.status === "READY").length;
      const chips = [
        { n: pending, c: "#f59e0b" },
        { n: prep, c: primary },
        { n: ready, c: "#22c55e" },
      ];
      const chipW = (w - 36 - 16) / 3;
      chips.forEach((c, i) => {
        const x = 18 + i * (chipW + 8);
        ctx.fillStyle = "#181210";
        ctx.fillRect(x, 48, chipW, 52);
        ctx.fillStyle = c.c;
        ctx.fillRect(x, 48, chipW, 5);
        ctx.font = "900 28px monospace";
        ctx.fillText(String(c.n), x + 10, 86);
      });

      let y = 118;
      const live = tickets.slice(0, 6);
      if (live.length === 0) {
        ctx.fillStyle = "#5c564e";
        ctx.font = "500 15px sans-serif";
        ctx.fillText("Sin comandas en cola", 18, y + 28);
      } else {
        for (const t of live) {
          if (y > h - 70) break;
          const stColor =
            t.status === "PENDING"
              ? "#f59e0b"
              : t.status === "PREPARING"
                ? primary
                : "#22c55e";
          const mesa = t.table_number ?? t.table_name;
          const when = t.created
            ? new Date(t.created).toLocaleTimeString("es-CL", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          ctx.fillStyle = "#14100d";
          ctx.fillRect(16, y, w - 32, 58);
          ctx.fillStyle = stColor;
          ctx.fillRect(16, y, 5, 58);
          ctx.fillStyle = "#ede6da";
          ctx.font = "700 15px sans-serif";
          ctx.fillText(
            `${kitchenTicketCode(t)}${mesa ? ` · Mesa ${mesa}` : ""}`,
            30,
            y + 20,
          );
          ctx.fillStyle = "#9a9388";
          ctx.font = "500 12px sans-serif";
          const line = (t.items ?? [])
            .slice(0, 3)
            .map((it) => `${it.quantity ?? 1}× ${it.product_name}`)
            .join("  ·  ");
          ctx.fillText((line || "Sin ítems").slice(0, 42), 30, y + 40);
          ctx.fillStyle = stColor;
          ctx.font = "600 11px sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(when, w - 28, y + 20);
          ctx.textAlign = "left";
          y += 66;
        }
      }

      if (texRef.current) texRef.current.needsUpdate = true;
    };

    paint(0);
    const interval = window.setInterval(() => paint(performance.now() / 1000), 1000);
    return () => window.clearInterval(interval);
  }, [primary, tickets, canvas]);

  return texture;
}

/* Shader de la línea de escaneo (mesh hijo, no repinta canvas). */
const SCAN_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  void main() {
    float y = fract(uTime * 0.10);
    float d = abs(vUv.y - y);
    float glow = exp(-d * 30.0);
    gl_FragColor = vec4(uColor, glow * 0.45);
  }
`;
const SCAN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/* Etiqueta flotante de hotspot: dice QUÉ es y qué hace.              */
/* ------------------------------------------------------------------ */

export function HotspotLabel({
  text,
  primary,
  hovered,
  y,
}: {
  text: string;
  primary: string;
  hovered: boolean;
  y: number;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    group.current.scale.setScalar(
      THREE.MathUtils.lerp(group.current.scale.x, hovered ? 1.04 : 1, 0.14),
    );
  });
  if (!hovered) return null;
  return (
    <group ref={group} position={[0, y, 0]}>
      <Billboard follow>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[0.48 + text.length * 0.08, 0.26]} />
          <meshBasicMaterial
            color={hovered ? primary : "#f4efe6"}
            transparent
            opacity={hovered ? 0.92 : 0.62}
            depthWrite={false}
          />
        </mesh>
        <Text
          fontSize={0.12}
          color={hovered ? "#ffffff" : "#2c261e"}
          anchorX="center"
          anchorY="middle"
        >
          {text}
        </Text>
      </Billboard>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Pantalla KDS grande en la pared derecha.                           */
/* ------------------------------------------------------------------ */

export function KdsScreen3D({
  primary,
  dark,
  stations,
  tickets,
  roomW,
  roomH,
  wallH,
  onActivate,
  onHoverChange,
}: {
  primary: string;
  dark: boolean;
  stations: KitchenStation[];
  tickets: KitchenTicket[];
  roomW: number;
  roomH: number;
  wallH: number;
  onActivate: (kind: SalonOverlayKind, stationId?: number | null) => void;
  onHoverChange?: (info: HotspotHoverInfo | null) => void;
}) {
  const active = stations.filter((s) => s.is_active !== false).slice(0, 3);
  const items: { id: number | null }[] =
    active.length > 0 ? active.map((s) => ({ id: s.id })) : [{ id: null }];
  const { screenW, screenH, z, cy, gap, originX } = kdsBankLayout(
    roomW,
    roomH,
    wallH,
    items.length,
  );

  const bankW =
    items.length * screenW + Math.max(0, items.length - 1) * gap + 0.5;

  return (
    <group>
      <group position={[originX, 0, z + 0.78]}>
        <mesh position={[0, 0.46, 0]}>
          <boxGeometry args={[bankW, 0.92, 0.62]} />
          <meshStandardMaterial
            color={dark ? "#2a2d30" : "#c5c8cc"}
            roughness={0.35}
            metalness={0.45}
          />
        </mesh>
        <mesh position={[0, 0.94, 0.04]}>
          <boxGeometry args={[bankW + 0.1, 0.07, 0.78]} />
          <meshStandardMaterial
            color={dark ? "#3a3f44" : "#e4e7ea"}
            roughness={0.22}
            metalness={0.55}
          />
        </mesh>
      </group>
      {items.map((station, i) => {
        const ox =
          originX + (i - (items.length - 1) / 2) * (screenW + gap);
        const feed =
          station.id == null
            ? tickets
            : ticketsForStation(tickets, station.id);
        return (
          <KdsMonitor
            key={station.id ?? "kds"}
            primary={primary}
            dark={dark}
            tickets={feed}
            screenW={screenW}
            screenH={screenH}
            x={ox}
            y={cy}
            z={z}
            onActivate={() => onActivate("kitchen", station.id)}
            onHoverChange={onHoverChange}
          />
        );
      })}
    </group>
  );
}

function KdsMonitor({
  primary,
  dark,
  tickets,
  screenW,
  screenH,
  x,
  y,
  z,
  onActivate,
  onHoverChange,
}: {
  primary: string;
  dark: boolean;
  tickets: KitchenTicket[];
  screenW: number;
  screenH: number;
  x: number;
  y: number;
  z: number;
  onActivate: () => void;
  onHoverChange?: (info: HotspotHoverInfo | null) => void;
}) {
  const tex = useKdsScreenTexture(primary, tickets);
  const [hovered, setHovered] = useState(false);
  const frameMat = useRef<THREE.MeshStandardMaterial>(null);
  const scanMat = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const liveCount = tickets.length;

  const scanUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color(primary) } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- color se actualiza vía ref
    [],
  );

  useEffect(() => {
    if (scanMat.current) scanMat.current.uniforms.uColor.value.set(primary);
  }, [primary]);

  useFrame((state) => {
    if (scanMat.current) {
      scanMat.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (frameMat.current) {
      frameMat.current.emissiveIntensity = THREE.MathUtils.lerp(
        frameMat.current.emissiveIntensity,
        hovered ? 1.0 : 0.4,
        0.14,
      );
    }
    if (group.current) {
      const s = hovered ? 1.03 : 1;
      group.current.scale.setScalar(
        THREE.MathUtils.lerp(group.current.scale.x, s, 0.14),
      );
    }
  });

  return (
    <group
      ref={group}
      position={[x, y, z]}
      rotation={[-0.2, 0, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHoverChange?.({
          subtitle:
            liveCount > 0
              ? `${liveCount} comanda${liveCount === 1 ? "" : "s"}`
              : "Sin cola",
          action: "Click para operar",
        });
      }}
      onPointerOut={() => {
        setHovered(false);
        onHoverChange?.(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
    >
      <mesh>
        <boxGeometry args={[screenW + 0.2, screenH + 0.2, 0.14]} />
        <meshStandardMaterial
          ref={frameMat}
          color={dark ? "#181410" : "#f5efe2"}
          roughness={0.4}
          metalness={0.2}
          emissive={primary}
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[screenW, screenH, 0.07]} />
        <meshStandardMaterial color="#0d0a08" roughness={0.6} metalness={0.05} />
      </mesh>
      {tex && (
        <mesh position={[0, 0, 0.13]}>
          <planeGeometry args={[screenW * 0.94, screenH * 0.94]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      )}
      <mesh position={[0, 0, 0.145]}>
        <planeGeometry args={[screenW * 0.94, screenH * 0.94]} />
        <shaderMaterial
          ref={scanMat}
          vertexShader={SCAN_VERT}
          fragmentShader={SCAN_FRAG}
          uniforms={scanUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Barra de órdenes cerca de la entrada.                              */
/* ------------------------------------------------------------------ */

export function OrdersCounter3D({
  primary,
  dark,
  roomW,
  roomH,
  openCount,
  onActivate,
  onHoverChange,
}: {
  primary: string;
  dark: boolean;
  roomW: number;
  roomH: number;
  openCount: number;
  onActivate: (kind: SalonOverlayKind) => void;
  onHoverChange?: (info: HotspotHoverInfo | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const bell = useRef<THREE.Group>(null);

  const { x, z, counterW } = ordersCounterLayout(roomW, roomH);

  useFrame(() => {
    if (group.current) {
      const s = hovered ? 1.07 : 1;
      group.current.scale.setScalar(
        THREE.MathUtils.lerp(group.current.scale.x, s, 0.14),
      );
      // Se eleva al hover (como las mesas), sin girar
      group.current.position.y = THREE.MathUtils.lerp(
        group.current.position.y,
        hovered ? 0.18 : 0,
        0.14,
      );
    }
    if (bell.current) {
      bell.current.rotation.z = THREE.MathUtils.lerp(bell.current.rotation.z, 0, 0.2);
    }
  });

  return (
    <group position={[x, 0, z]}>
      <group
        ref={group}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHoverChange?.({
            title: "Ventas / Órdenes",
            subtitle:
              openCount > 0
                ? `${openCount} abierta${openCount === 1 ? "" : "s"}`
                : "Nada pendiente",
            action: "Click · burbuja en el salón",
          });
        }}
        onPointerOut={() => {
          setHovered(false);
          onHoverChange?.(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onActivate("orders");
        }}
      >
        {/* Mesón */}
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[counterW, 1.1, 0.8]} />
          <meshStandardMaterial
            color={dark ? "#1a1512" : "#9a7b58"}
            roughness={0.6}
            metalness={0.1}
            emissive={primary}
            emissiveIntensity={hovered ? 0.25 : 0.05}
          />
        </mesh>
        <mesh position={[0, 1.14, 0]}>
          <boxGeometry args={[counterW + 0.16, 0.08, 0.95]} />
          <meshStandardMaterial
            color={dark ? "#2c241c" : "#e8dcc8"}
            roughness={0.3}
            metalness={0.15}
          />
        </mesh>
        {/* Campana de despacho (pixel: bloque en vez de esfera) */}
        <group ref={bell} position={[counterW * 0.28, 1.26, 0]}>
          <mesh>
            <boxGeometry args={[0.26, 0.16, 0.26]} />
            <meshStandardMaterial
              color={primary}
              metalness={0.7}
              roughness={0.3}
              emissive={primary}
              emissiveIntensity={hovered ? 0.8 : 0.3}
            />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color="#f5e9d0" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
        {/* Tickets colgando */}
        {Array.from({ length: Math.min(4, Math.max(1, openCount)) }).map((_, i) => (
          <mesh key={i} position={[-counterW * 0.32 + i * 0.24, 1.02, 0.42]}>
            <planeGeometry args={[0.16, 0.24]} />
            <meshStandardMaterial
              color="#fdfbf5"
              roughness={0.9}
              side={THREE.DoubleSide}
              emissive={primary}
              emissiveIntensity={hovered ? 0.35 : 0.1}
            />
          </mesh>
        ))}
        <HotspotLabel
          text={
            hovered
              ? "Ver ventas / órdenes →"
              : openCount > 0
                ? `Ventas · ${openCount}`
                : "Ventas / Órdenes"
          }
          primary={primary}
          hovered={hovered}
          y={2.1}
        />
      </group>
      <BlobShadow radius={1.5} opacity={0.4} />
    </group>
  );
}
