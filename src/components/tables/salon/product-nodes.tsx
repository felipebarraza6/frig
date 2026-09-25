"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";
import { searchProductsForSale, type ProductForSale } from "@/lib/api/products";
import { mediaUrl } from "@/lib/api/client";
import { formatCLP } from "@/lib/utils";
import { seededRandom } from "./salon-environment";

type ProductItem = ProductForSale;

/* ------------------------------------------------------------------ */
/* Nodos del universo: TARJETAS CON FOTO de productos reales (nada de */
/* partículas). Flotan alrededor del salón; al pasar el mouse cerca   */
/* las texturas se encienden, respiran y se inclinan; al hacer click  */
/* se abre el inventario con ese producto.                            */
/* ------------------------------------------------------------------ */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Posiciones base en anillo alrededor del salón. */
export function useNodeLayout(roomW: number, roomH: number) {
  return useMemo(() => {
    const rand = seededRandom(Math.round(roomW * 31 + roomH * 7) + 5);
    const count = clamp(10 + Math.round((roomW + roomH) * 0.35), 12, 18);
    const bases: THREE.Vector3[] = [];
    const phases: number[] = [];
    for (let i = 0; i < count; i++) {
      const ring = 0.6 + rand() * 0.45;
      const ang = (i / count) * Math.PI * 2 + rand() * 0.35;
      const rx = Math.cos(ang) * (roomW * 0.52 * ring + 3.0 + rand() * 3.2);
      const rz = Math.sin(ang) * (roomH * 0.52 * ring + 3.0 + rand() * 3.2);
      const sky = rand() < 0.2;
      const x = sky ? (rand() - 0.5) * roomW * 0.55 : rx;
      const z = sky ? (rand() - 0.5) * roomH * 0.55 : rz;
      const y = sky
        ? 4.6 + rand() * 2.8
        : 1.9 + rand() * (4.2 + roomW * 0.05);
      bases.push(new THREE.Vector3(x, y, z));
      phases.push(rand() * Math.PI * 2);
    }
    return { bases, phases };
  }, [roomW, roomH]);
}

/** Productos con foto para poblar el universo. */
export function usePhotoProducts(limit = 24) {
  const { data } = useQuery({
    queryKey: ["products", "salon-photos"],
    queryFn: () => searchProductsForSale({}),
    staleTime: 120_000,
  });
  return useMemo(() => {
    const all = data ?? [];
    const withImg = all.filter((p) => Boolean(p.primary_image));
    const pool = withImg.length >= 6 ? withImg : all;
    return pool.slice(0, limit);
  }, [data, limit]);
}

/** Carga texturas de productos con CORS anónimo (mismo origen de media). */
function useProductTextures(products: ProductItem[]) {
  const [textures, setTextures] = useState<Map<number, THREE.Texture>>(new Map());
  const key = products.map((p) => `${p.id}:${p.primary_image ?? ""}`).join("|");

  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const map = new Map<number, THREE.Texture>();
    for (const p of products) {
      const url = mediaUrl(p.primary_image || null);
      if (!url) continue;
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          if (!alive) return;
          map.set(p.id, tex);
          setTextures(new Map(map));
        },
        undefined,
        () => {},
      );
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key resume productos+urls
  }, [key]);

  return textures;
}

/** Placeholder con inicial cuando el producto no tiene foto. */
function usePlaceholderTexture(name: string, primary: string) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, "#1a1f1c");
    grad.addColorStop(1, "#0d1210");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = primary;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 236, 236);
    ctx.globalAlpha = 1;
    ctx.fillStyle = primary;
    ctx.font = "700 120px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((name.trim()[0] ?? "·").toUpperCase(), 128, 138);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [name, primary]);
}

interface ProductNodesProps {
  bases: THREE.Vector3[];
  phases: number[];
  products: ProductItem[];
  primary: string;
  dark: boolean;
  onProductClick?: (product: ProductItem) => void;
}

export function ProductNodes({
  bases,
  phases,
  products,
  primary,
  dark,
  onProductClick,
}: ProductNodesProps) {
  const textures = useProductTextures(products);
  const fallback = usePlaceholderTexture(products[0]?.name ?? "·", primary);
  const { gl } = useThree();
  const glRef = useRef(gl);
  useEffect(() => {
    glRef.current = gl;
  }, [gl]);
  const [hovered, setHovered] = useState<number | null>(null);

  const items = useMemo(() => {
    if (products.length === 0) return [];
    // Reparte productos sobre las bases (barajado estable)
    return bases.map((base, i) => ({
      base,
      phase: phases[i] ?? 0,
      product: products[(i * 7 + 3) % products.length],
    }));
  }, [bases, phases, products]);

  if (items.length === 0) return null;

  return (
    <group>
      {items.map((it, i) => (
        <ProductCard
          key={i}
          base={it.base}
          phase={it.phase}
          product={it.product}
          texture={textures.get(it.product.id) ?? fallback}
          primary={primary}
          dark={dark}
          hovered={hovered === i}
          onHover={(v) => {
            setHovered(v ? i : null);
            glRef.current.domElement.style.cursor = v ? "pointer" : "";
          }}
          onClick={() => onProductClick?.(it.product)}
        />
      ))}
    </group>
  );
}

function ProductCard({
  base,
  phase,
  product,
  texture,
  primary,
  dark,
  hovered,
  onHover,
  onClick,
}: {
  base: THREE.Vector3;
  phase: number;
  product: ProductItem;
  texture: THREE.Texture;
  primary: string;
  dark: boolean;
  hovered: boolean;
  onHover: (v: boolean) => void;
  onClick: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const frameMat = useRef<THREE.MeshStandardMaterial>(null);
  const imgMat = useRef<THREE.MeshStandardMaterial>(null);
  const labelMat = useRef<THREE.MeshBasicMaterial>(null);
  const { camera, raycaster, pointer } = useThree();
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const heat = useRef(0);

  const price = product.price;
  const label = product.name?.slice(0, 22) ?? "Producto";

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;

    // Flotación suave
    group.current.position.set(
      base.x + Math.sin(t * 0.4 + phase) * 0.22,
      base.y + Math.sin(t * 0.65 + phase * 1.3) * 0.3,
      base.z + Math.cos(t * 0.35 + phase * 0.8) * 0.2,
    );

    // Calor: cercanía del rayo del mouse a la tarjeta
    group.current.getWorldPosition(worldPos);
    const rayDist = raycaster.ray.distanceToPoint(worldPos);
    const pointerHeat = THREE.MathUtils.clamp(1 - rayDist / 3.2, 0, 1);
    // Cercanía de cámara: de cerca las texturas "se encienden"
    const camDist = camera.position.distanceTo(worldPos);
    const camHeat = THREE.MathUtils.clamp(1 - camDist / 26, 0.25, 1);
    const target = Math.max(pointerHeat, hovered ? 1 : 0) * camHeat;
    heat.current = THREE.MathUtils.lerp(heat.current, target, 0.12);

    const h = heat.current;
    const s = 1 + h * 0.35 + (hovered ? 0.08 * Math.sin(t * 5) : 0);
    group.current.scale.setScalar(s);

    if (inner.current) {
      // Tilt hacia el puntero al hacer hover
      inner.current.rotation.x = THREE.MathUtils.lerp(
        inner.current.rotation.x,
        hovered ? -pointer.y * 0.25 : 0,
        0.1,
      );
      inner.current.rotation.y = THREE.MathUtils.lerp(
        inner.current.rotation.y,
        hovered ? pointer.x * 0.3 : 0,
        0.1,
      );
    }
    if (frameMat.current) {
      frameMat.current.emissiveIntensity = 0.15 + h * 1.1;
    }
    if (imgMat.current) {
      imgMat.current.emissiveIntensity = 0.08 + h * 0.55;
    }
    if (labelMat.current) {
      labelMat.current.opacity = 0.55 + h * 0.45;
    }
  });

  const W = 1.15;
  const H = 1.35;

  return (
    <group ref={group} position={base}>
      <Billboard follow>
        <group ref={inner}>
          {/* Marco */}
          <RoundedBox
            args={[W + 0.14, H + 0.14, 0.07]}
            radius={0.05}
            smoothness={3}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHover(true);
            }}
            onPointerOut={() => onHover(false)}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <meshStandardMaterial
              ref={frameMat}
              color={dark ? "#101614" : "#f5f1ea"}
              roughness={0.4}
              metalness={0.25}
              emissive={primary}
              emissiveIntensity={0.15}
            />
          </RoundedBox>
          {/* Foto del producto */}
          <mesh position={[0, 0.09, 0.045]}>
            <planeGeometry args={[W, H - 0.34]} />
            <meshStandardMaterial
              ref={imgMat}
              map={texture}
              roughness={0.55}
              metalness={0.05}
              emissive={dark ? "#ffffff" : primary}
              emissiveMap={texture}
              emissiveIntensity={0.08}
              toneMapped={false}
            />
          </mesh>
          {/* Etiqueta nombre + precio */}
          <mesh position={[0, -H / 2 + 0.13, 0.046]}>
            <planeGeometry args={[W, 0.26]} />
            <meshBasicMaterial
              ref={labelMat}
              color={dark ? "#0b100e" : "#ffffff"}
              transparent
              opacity={0.6}
            />
          </mesh>
          <Text
            position={[0, -H / 2 + 0.17, 0.06]}
            fontSize={0.085}
            color={dark ? "#e8f0eb" : "#1c211e"}
            anchorX="center"
            anchorY="middle"
            maxWidth={W - 0.1}
          >
            {label}
          </Text>
          {price != null && (
            <Text
              position={[0, -H / 2 + 0.065, 0.06]}
              fontSize={0.075}
              color={primary}
              anchorX="center"
              anchorY="middle"
            >
              {formatCLP(Number(price))}
            </Text>
          )}
        </group>
      </Billboard>
    </group>
  );
}
