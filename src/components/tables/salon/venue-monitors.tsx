"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { kitchenTicketCode, type KitchenTicket } from "@/lib/api/kitchen";
import type { CashRegister } from "@/lib/api/cash-register";
import type { YggdraSchemas } from "@/lib/api/types";
import { formatCLP } from "@/lib/utils";
import { BlobShadow } from "./salon-environment";
import {
  HotspotLabel,
  kdsScreenLayout,
  salonWallH,
  type HotspotHoverInfo,
  type SalonOverlayKind,
} from "./venue-screens";

type ProductSummary = YggdraSchemas["ProductInventorySummary"];

/* ------------------------------------------------------------------ */
/* Monitores y hotspots extra del salón (mismo lenguaje pixel art):   */
/* - Monitor de inventario junto a la pantalla de cocina.             */
/* - Ventanilla de entregados del día.                                */
/* - Caja registradora sobre la barra (POS).                          */
/* ------------------------------------------------------------------ */

/** Canvas pixelado + textura viva; `markDirty` repinta el frame. */
function usePixelTexture(width: number, height: number) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
  }, [width, height]);
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

  const markDirty = useMemo(
    () => () => {
      if (texRef.current) texRef.current.needsUpdate = true;
    },
    [],
  );

  return { canvas, texture, markDirty };
}

function paintScanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
}

/* ------------------------------------------------------------------ */
/* Monitor de inventario (gemelo del KDS) en la pared trasera.        */
/* ------------------------------------------------------------------ */

export function InventoryMonitor3D({
  primary,
  dark,
  roomW,
  roomH,
  lowStock,
  outOfStock,
  onActivate,
  onHoverChange,
}: {
  primary: string;
  dark: boolean;
  roomW: number;
  roomH: number;
  lowStock: ProductSummary[];
  outOfStock: ProductSummary[];
  onActivate: (kind: SalonOverlayKind) => void;
  onHoverChange?: (info: HotspotHoverInfo | null) => void;
}) {
  const wallH = salonWallH(roomW, roomH);
  const { screenW, screenH, cy } = kdsScreenLayout(roomW, roomH, wallH);
  // Gemelo del KDS pero al lado izquierdo del logo
  const x = -roomW * 0.27;
  const z = -(roomH / 2 + 0.55);

  const { canvas, texture, markDirty } = usePixelTexture(512, 640);
  const [hovered, setHovered] = useState(false);
  const frameMat = useRef<THREE.MeshStandardMaterial>(null);
  const group = useRef<THREE.Group>(null);

  const alertCount = lowStock.length + outOfStock.length;

  useEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#0d0a08";
    ctx.fillRect(0, 0, w, h);
    paintScanlines(ctx, w, h);

    // Header
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, w, 56);
    ctx.fillStyle = "#14100c";
    ctx.font = "800 22px sans-serif";
    ctx.fillText("Stock", 18, 36);
    ctx.textAlign = "right";
    ctx.font = "900 22px monospace";
    ctx.fillText(`${alertCount} alertas`, w - 18, 37);
    ctx.textAlign = "left";

    let y = 88;
    const paintRow = (name: string, qty: string, color: string) => {
      ctx.fillStyle = "#14100d";
      ctx.fillRect(16, y - 24, w - 32, 36);
      ctx.fillStyle = color;
      ctx.fillRect(16, y - 24, 5, 36);
      ctx.fillStyle = "#ede6da";
      ctx.font = "700 16px monospace";
      ctx.fillText(name.slice(0, 24), 32, y);
      ctx.fillStyle = color;
      ctx.font = "900 14px monospace";
      ctx.textAlign = "right";
      ctx.fillText(qty, w - 28, y - 1);
      ctx.textAlign = "left";
      y += 44;
    };

    ctx.fillStyle = "#f87171";
    ctx.font = "900 15px monospace";
    ctx.fillText(`AGOTADOS (${outOfStock.length})`, 18, y);
    y += 18;
    if (outOfStock.length === 0) {
      ctx.fillStyle = "#5c564e";
      ctx.font = "500 15px monospace";
      ctx.fillText("Nada agotado", 32, y + 12);
      y += 44;
    } else {
      for (const p of outOfStock.slice(0, 3)) {
        paintRow(p.name, "0", "#f87171");
      }
    }

    y += 14;
    ctx.fillStyle = "#fbbf24";
    ctx.font = "900 15px monospace";
    ctx.fillText(`STOCK BAJO (${lowStock.length})`, 18, y);
    y += 18;
    if (lowStock.length === 0) {
      ctx.fillStyle = "#5c564e";
      ctx.font = "500 15px monospace";
      ctx.fillText("Sin alertas · alacena sana", 32, y + 12);
    } else {
      for (const p of lowStock.slice(0, 6)) {
        if (y > h - 80) break;
        const qty = `${Number(p.stock_available ?? p.quantity ?? 0)}/${Number(p.minimum_stock ?? 0)}`;
        paintRow(p.name, qty, "#fbbf24");
      }
    }

    // Footer
    ctx.fillStyle = `${primary}66`;
    ctx.fillRect(0, h - 36, w, 36);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("» TOCA PARA REVISAR «", w / 2, h - 13);
    ctx.textAlign = "left";

    markDirty();
  }, [canvas, primary, lowStock, outOfStock, alertCount, markDirty]);

  useFrame(() => {
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
      position={[x, cy, z]}
      rotation={[-0.2, 0, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHoverChange?.({
          title: "Inventario / Bodegas",
          subtitle:
            alertCount > 0
              ? `${alertCount} alerta${alertCount === 1 ? "" : "s"} de stock`
              : "Stock por bodega",
          action: "Click para revisar el stock",
        });
      }}
      onPointerOut={() => {
        setHovered(false);
        onHoverChange?.(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onActivate("inventory");
      }}
    >
      <mesh>
        <boxGeometry args={[screenW + 0.24, screenH + 0.24, 0.16]} />
        <meshStandardMaterial
          ref={frameMat}
          color={dark ? "#181410" : "#f5efe2"}
          roughness={0.4}
          metalness={0.2}
          emissive={primary}
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[0, 0, 0.09]}>
        <boxGeometry args={[screenW, screenH, 0.08]} />
        <meshStandardMaterial color="#0d0a08" roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, 0.14]}>
        <planeGeometry args={[screenW * 0.94, screenH * 0.94]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <HotspotLabel
        text={
          hovered
            ? "Ver stock / bodegas →"
            : alertCount > 0
              ? `Stock · ${alertCount} alertas`
              : "Inventario"
        }
        primary={primary}
        hovered={hovered}
        y={screenH / 2 + 0.5}
      />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Ventanilla de entregados del día (frente del salón).               */
/* ------------------------------------------------------------------ */

export function DeliveryWindow3D({
  primary,
  dark,
  roomW,
  roomH,
  delivered,
  onActivate,
  onHoverChange,
}: {
  primary: string;
  dark: boolean;
  roomW: number;
  roomH: number;
  delivered: KitchenTicket[];
  onActivate: (kind: SalonOverlayKind) => void;
  onHoverChange?: (info: HotspotHoverInfo | null) => void;
}) {
  const { canvas, texture, markDirty } = usePixelTexture(512, 384);
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const frameMat = useRef<THREE.MeshStandardMaterial>(null);

  const x = -roomW * 0.02;
  const z = roomH / 2 - 1.55;
  const winW = 2.6;
  const winH = 1.7;
  const winY = 1.55;

  useEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#0d0a08";
    ctx.fillRect(0, 0, w, h);
    paintScanlines(ctx, w, h);

    // Header verde despacho
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(0, 0, w, 52);
    ctx.fillStyle = "#0c140f";
    ctx.font = "900 24px monospace";
    ctx.fillText("✓ ENTREGADOS HOY", 16, 35);
    ctx.textAlign = "right";
    ctx.fillText(String(delivered.length), w - 18, 36);
    ctx.textAlign = "left";

    let y = 84;
    if (delivered.length === 0) {
      ctx.fillStyle = "#5c564e";
      ctx.font = "500 16px monospace";
      ctx.fillText("Aún no sale nada de cocina", 18, y + 10);
    } else {
      for (const t of delivered.slice(0, 5)) {
        const when = t.completed_at
          ? new Date(t.completed_at).toLocaleTimeString("es-CL", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--:--";
        const who =
          t.items?.[0]?.product_name
            ? `${kitchenTicketCode(t)} · ${t.items[0].product_name}`
            : kitchenTicketCode(t);
        ctx.fillStyle = "#14100d";
        ctx.fillRect(14, y - 22, w - 28, 34);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(14, y - 22, 5, 34);
        ctx.fillStyle = "#ede6da";
        ctx.font = "700 15px monospace";
        ctx.fillText(who.slice(0, 24), 30, y);
        ctx.fillStyle = "#22c55e";
        ctx.font = "900 13px monospace";
        ctx.textAlign = "right";
        ctx.fillText(when, w - 26, y - 1);
        ctx.textAlign = "left";
        y += 42;
      }
    }

    ctx.fillStyle = "#22c55e55";
    ctx.fillRect(0, h - 32, w, 32);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText("» TOCA PARA VER TODOS «", w / 2, h - 11);
    ctx.textAlign = "left";

    markDirty();
  }, [canvas, delivered, markDirty]);

  useFrame(() => {
    if (group.current) {
      const s = hovered ? 1.07 : 1;
      group.current.scale.setScalar(
        THREE.MathUtils.lerp(group.current.scale.x, s, 0.14),
      );
      group.current.position.y = THREE.MathUtils.lerp(
        group.current.position.y,
        hovered ? 0.18 : 0,
        0.14,
      );
    }
    if (frameMat.current) {
      frameMat.current.emissiveIntensity = THREE.MathUtils.lerp(
        frameMat.current.emissiveIntensity,
        hovered ? 0.9 : 0.35,
        0.14,
      );
    }
  });

  const frameColor = dark ? "#18211a" : "#e8f0e4";

  return (
    <group position={[x, 0, z]}>
      <group
        ref={group}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHoverChange?.({
            title: "Entregados hoy",
            subtitle: `${delivered.length} pedido${delivered.length === 1 ? "" : "s"} despachado${delivered.length === 1 ? "" : "s"}`,
            action: "Click para ver el detalle",
          });
        }}
        onPointerOut={() => {
          setHovered(false);
          onHoverChange?.(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onActivate("deliveries");
        }}
      >
        {/* Marco de ventanilla */}
        <mesh position={[0, winY, 0]}>
          <boxGeometry args={[winW + 0.2, winH + 0.2, 0.14]} />
          <meshStandardMaterial
            ref={frameMat}
            color={frameColor}
            roughness={0.45}
            metalness={0.15}
            emissive={primary}
            emissiveIntensity={0.35}
          />
        </mesh>
        <mesh position={[0, winY, 0.08]}>
          <planeGeometry args={[winW, winH]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
        {/* Repisa */}
        <mesh position={[0, winY - winH / 2 - 0.2, 0.18]}>
          <boxGeometry args={[winW + 0.3, 0.1, 0.5]} />
          <meshStandardMaterial
            color={dark ? "#2c241c" : "#e8dcc8"}
            roughness={0.35}
            metalness={0.12}
          />
        </mesh>
        {/* Pilares */}
        <mesh position={[-winW / 2 - 0.02, winY / 2 - 0.1, 0]}>
          <boxGeometry args={[0.14, winY - 0.2, 0.14]} />
          <meshStandardMaterial color={frameColor} roughness={0.5} />
        </mesh>
        <mesh position={[winW / 2 + 0.02, winY / 2 - 0.1, 0]}>
          <boxGeometry args={[0.14, winY - 0.2, 0.14]} />
          <meshStandardMaterial color={frameColor} roughness={0.5} />
        </mesh>
        <HotspotLabel
          text={
            hovered
              ? "Ver entregados →"
              : `Entregados · ${delivered.length} hoy`
          }
          primary={primary}
          hovered={hovered}
          y={winY + winH / 2 + 0.45}
        />
      </group>
      <BlobShadow radius={1.2} opacity={0.35} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Mesón POS: una caja física por cada estación que existe.           */
/* ------------------------------------------------------------------ */

export type SalonPosStation = {
  id: number | null;
  name: string;
  register: CashRegister | null | undefined;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function PosBar3D({
  primary,
  dark,
  roomW,
  roomH,
  stations,
  onActivate,
  onHoverChange,
}: {
  primary: string;
  dark: boolean;
  roomW: number;
  roomH: number;
  stations: SalonPosStation[];
  onActivate: (kind: SalonOverlayKind, stationId?: number | null) => void;
  onHoverChange?: (info: HotspotHoverInfo | null) => void;
}) {
  const items =
    stations.length > 0
      ? stations
      : [{ id: null, name: "Caja", register: null }];
  const count = items.length;
  const barW = clamp(1.5 + count * 0.92, 2.1, 4.6);
  const x = roomW * 0.12;
  const z = roomH / 2 - 1.65;
  const barColor = dark ? "#1a1512" : "#9a7b58";

  return (
    <group position={[x, 0, z]}>
      {/* Mesón POS */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[barW, 1.04, 0.78]} />
        <meshStandardMaterial
          color={barColor}
          roughness={0.6}
          metalness={0.1}
          emissive={primary}
          emissiveIntensity={0.08}
        />
      </mesh>
      <mesh position={[0, 1.08, 0]}>
        <boxGeometry args={[barW + 0.14, 0.08, 0.92]} />
        <meshStandardMaterial
          color={dark ? "#2c241c" : "#e8dcc8"}
          roughness={0.3}
          metalness={0.15}
        />
      </mesh>
      {items.map((station, i) => {
        const ox = (i - (count - 1) / 2) * 0.88;
        return (
          <group key={station.id ?? `pos-${i}`} position={[ox, 1.12, 0]}>
            <CashRegister3D
              primary={primary}
              dark={dark}
              stationName={station.name}
              register={station.register}
              onActivate={() => onActivate("cash", station.id)}
              onHoverChange={onHoverChange}
            />
          </group>
        );
      })}
      <BlobShadow radius={barW * 0.55} opacity={0.38} />
    </group>
  );
}

/** Una caja registradora pixel (POS). El padre la posiciona sobre el mesón. */
export function CashRegister3D({
  primary,
  dark,
  stationName,
  register,
  onActivate,
  onHoverChange,
}: {
  primary: string;
  dark: boolean;
  stationName?: string;
  register: CashRegister | null | undefined;
  onActivate: () => void;
  onHoverChange?: (info: HotspotHoverInfo | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const displayMat = useRef<THREE.MeshStandardMaterial>(null);

  const isOpen = register?.status === "OPEN";
  const label = stationName?.trim() || "Caja";

  useFrame(() => {
    if (group.current) {
      const s = hovered ? 1.04 : 1;
      group.current.scale.setScalar(
        THREE.MathUtils.lerp(group.current.scale.x, s, 0.16),
      );
    }
    if (displayMat.current) {
      displayMat.current.emissiveIntensity = THREE.MathUtils.lerp(
        displayMat.current.emissiveIntensity,
        (isOpen ? 0.7 : 0.25) + (hovered ? 0.5 : 0),
        0.16,
      );
    }
  });

  const bodyColor = dark ? "#1c1815" : "#d8cbb5";

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHoverChange?.({
          title: label,
          subtitle: isOpen
            ? `Abierta · esperado ${formatCLP(Number(register?.expected_amount ?? 0))}`
            : "Caja cerrada · POS",
          action: "Click para ver la caja",
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
      {/* Cajón */}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.62, 0.28, 0.46]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.5}
          metalness={0.2}
          emissive={primary}
          emissiveIntensity={hovered ? 0.3 : 0.06}
        />
      </mesh>
      {/* Ranura de tickets */}
      <mesh position={[0, 0.3, 0.08]}>
        <boxGeometry args={[0.4, 0.05, 0.2]} />
        <meshStandardMaterial color="#0d0a08" roughness={0.6} />
      </mesh>
      <group position={[0, 0.5, 0.2]} rotation={[0.28, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.32, 0.06]} />
          <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <planeGeometry args={[0.42, 0.24]} />
          <meshStandardMaterial
            ref={displayMat}
            color="#0d0a08"
            emissive={isOpen ? "#22c55e" : primary}
            emissiveIntensity={0.5}
            roughness={0.4}
          />
        </mesh>
        <Text
          position={[0, 0.04, 0.045]}
          fontSize={0.055}
          color="#9a9388"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
        <Text
          position={[0, -0.05, 0.045]}
          fontSize={0.075}
          color={isOpen ? "#7dffa8" : "#ffffff"}
          anchorX="center"
          anchorY="middle"
        >
          {isOpen ? formatCLP(Number(register?.expected_amount ?? 0)) : "CERRADA"}
        </Text>
      </group>
      {/* Teclas pixel */}
      {[-0.18, 0, 0.18].map((kx) =>
        [0.08, 0.18].map((kz) => (
          <mesh key={`${kx}-${kz}`} position={[kx, 0.295, kz]}>
            <boxGeometry args={[0.09, 0.03, 0.07]} />
            <meshStandardMaterial
              color={dark ? "#3a322a" : "#b8a888"}
              roughness={0.6}
              emissive={primary}
              emissiveIntensity={hovered ? 0.35 : 0.05}
            />
          </mesh>
        )),
      )}
      <HotspotLabel
        text={hovered ? `Ver ${label} →` : isOpen ? `${label} · abierta` : label}
        primary={primary}
        hovered={hovered}
        y={1.05}
      />
    </group>
  );
}
