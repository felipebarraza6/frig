"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";
import { searchProductsForSale, type ProductForSale } from "@/lib/api/products";
import { mediaUrl } from "@/lib/api/client";
import { formatCLP } from "@/lib/utils";
import { BlobShadow } from "./salon-environment";
import {
  HotspotLabel,
  type HotspotHoverInfo,
  type SalonOverlayKind,
} from "./venue-screens";

/* ------------------------------------------------------------------ */
/* Tótem de catálogo: kiosco con pantalla pixel art que hojea los     */
/* productos (fotos reales pixeladas). Click → galería completa para  */
/* ver y gestionar el catálogo sin salir del salón.                   */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 6;
const PAGE_MS = 5200;

/** Productos del catálogo para el tótem y la galería. */
export function useCatalogProducts(enabled = true) {
  const { data } = useQuery({
    queryKey: ["products", "catalog-totem"],
    queryFn: () => searchProductsForSale({}),
    staleTime: 120_000,
    enabled,
  });
  return useMemo(() => (enabled ? (data ?? []) : []), [data, enabled]);
}

/** Carga las imágenes primarias como HTMLImageElement (para canvas 2D). */
function useProductImages(products: ProductForSale[]) {
  const [images, setImages] = useState<Map<number, HTMLImageElement>>(new Map());
  const key = products.map((p) => `${p.id}:${p.primary_image}`).join("|");

  useEffect(() => {
    let alive = true;
    const map = new Map<number, HTMLImageElement>();
    for (const p of products) {
      const url = mediaUrl(p.primary_image || null);
      if (!url) continue;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!alive) return;
        map.set(p.id, img);
        setImages(new Map(map));
      };
      img.onerror = () => {};
      img.src = url;
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key resume productos+urls
  }, [key]);

  return images;
}

/** Pantalla del tótem: grid pixelado de productos, hojea solo. */
function useTotemTexture(
  primary: string,
  products: ProductForSale[],
  images: Map<number, HTMLImageElement>,
) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 480;
    c.height = 600;
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

  // Canvas tiny reutilizable para pixelar fotos
  const tiny = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 28;
    c.height = 28;
    return c;
  }, []);

  useEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tctx = tiny.getContext("2d")!;
    const pages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
    let page = 0;

    const paint = () => {
      const w = canvas.width;
      const h = canvas.height;
      // Fondo pixel oscuro
      ctx.fillStyle = "#0d0a08";
      ctx.fillRect(0, 0, w, h);
      // Scanlines sutiles
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);

      // Header
      ctx.fillStyle = primary;
      ctx.fillRect(0, 0, w, 64);
      ctx.fillStyle = "#14100c";
      ctx.font = "900 30px monospace";
      ctx.textAlign = "left";
      ctx.fillText("★ CATÁLOGO", 20, 42);
      ctx.textAlign = "right";
      ctx.font = "700 18px monospace";
      ctx.fillText(`${products.length} items`, w - 20, 40);
      ctx.textAlign = "left";

      // Grid 2×3
      const items = products.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
      const cellW = (w - 60) / 2;
      const cellH = 150;
      items.forEach((p, i) => {
        const cx = 20 + (i % 2) * (cellW + 20);
        const cy = 84 + Math.floor(i / 2) * (cellH + 16);

        // Marco del producto
        ctx.fillStyle = "#1a1512";
        ctx.fillRect(cx, cy, cellW, cellH);
        ctx.strokeStyle = `${primary}88`;
        ctx.lineWidth = 3;
        ctx.strokeRect(cx + 1.5, cy + 1.5, cellW - 3, cellH - 3);

        // Foto pixelada (tiny → upscale sin smoothing)
        const img = images.get(p.id);
        const imgSize = cellH - 56;
        const ix = cx + (cellW - imgSize) / 2;
        const iy = cy + 10;
        if (img) {
          tctx.clearRect(0, 0, 28, 28);
          tctx.imageSmoothingEnabled = true;
          const side = Math.min(img.width, img.height);
          tctx.drawImage(
            img,
            (img.width - side) / 2,
            (img.height - side) / 2,
            side,
            side,
            0,
            0,
            28,
            28,
          );
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tiny, 0, 0, 28, 28, ix, iy, imgSize, imgSize);
        } else {
          ctx.fillStyle = "#241c16";
          ctx.fillRect(ix, iy, imgSize, imgSize);
          ctx.strokeStyle = `${primary}66`;
          ctx.lineWidth = 2;
          ctx.strokeRect(ix + 4, iy + 4, imgSize - 8, imgSize - 8);
          ctx.fillStyle = primary;
          ctx.font = "900 36px monospace";
          ctx.textAlign = "center";
          ctx.fillText(
            (p.name.trim()[0] ?? "·").toUpperCase(),
            ix + imgSize / 2,
            iy + imgSize / 2 - 4,
          );
          ctx.fillStyle = "#8a8278";
          ctx.font = "700 11px monospace";
          ctx.fillText("SIN FOTO", ix + imgSize / 2, iy + imgSize / 2 + 22);
          ctx.textAlign = "left";
        }

        // Nombre + precio
        ctx.fillStyle = "#f2ede4";
        ctx.font = "700 15px monospace";
        ctx.fillText(p.name.slice(0, 18), cx + 10, cy + cellH - 26);
        ctx.fillStyle = primary;
        ctx.font = "900 16px monospace";
        ctx.fillText(formatCLP(Number(p.price ?? 0)), cx + 10, cy + cellH - 6);
      });

      // Footer: puntos de página
      ctx.fillStyle = `${primary}55`;
      ctx.fillRect(0, h - 34, w, 34);
      const dotY = h - 17;
      for (let d = 0; d < pages; d++) {
        ctx.fillStyle = d === page ? "#ffffff" : `${primary}`;
        const dx = w / 2 + (d - (pages - 1) / 2) * 22;
        ctx.fillRect(dx - 5, dotY - 5, 10, 10);
      }

      if (texRef.current) texRef.current.needsUpdate = true;
    };

    paint();
    const interval = window.setInterval(() => {
      page = (page + 1) % pages;
      paint();
    }, PAGE_MS);
    return () => window.clearInterval(interval);
  }, [primary, products, images, canvas, tiny]);

  return texture;
}

export function CatalogTotem3D({
  primary,
  dark,
  roomW,
  roomH,
  products,
  onActivate,
  onHoverChange,
}: {
  primary: string;
  dark: boolean;
  roomW: number;
  roomH: number;
  products: ProductForSale[];
  onActivate: (kind: SalonOverlayKind) => void;
  onHoverChange?: (info: HotspotHoverInfo | null) => void;
}) {
  const images = useProductImages(products);
  const tex = useTotemTexture(primary, products, images);
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const glowMat = useRef<THREE.MeshStandardMaterial>(null);

  // Frente derecho, dejando hueco al centro-derecha para las cajas POS
  const x = roomW * 0.38;
  const z = roomH / 2 - 1.55;

  useFrame(() => {
    if (group.current) {
      const s = hovered ? 1.07 : 1;
      group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, s, 0.14));
      group.current.position.y = THREE.MathUtils.lerp(
        group.current.position.y,
        hovered ? 0.18 : 0,
        0.14,
      );
    }
    if (glowMat.current) {
      glowMat.current.emissiveIntensity = THREE.MathUtils.lerp(
        glowMat.current.emissiveIntensity,
        hovered ? 1.15 : 0.55,
        0.16,
      );
    }
  });

  const bodyColor = dark ? "#1d1712" : "#8a6f4d";

  return (
    <group position={[x, 0, z]}>
      <group ref={group}>
        {/* Base */}
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[1.5, 0.18, 1.0]} />
          <meshStandardMaterial color={bodyColor} roughness={0.7} metalness={0.1} />
        </mesh>
        {/* Columna */}
        <mesh position={[0, 0.7, 0.18]}>
          <boxGeometry args={[0.55, 1.15, 0.35]} />
          <meshStandardMaterial color={bodyColor} roughness={0.7} metalness={0.1} />
        </mesh>
        {/* Pantalla inclinada con marco luminoso */}
        <group position={[0, 1.75, 0]} rotation={[-0.1, 0, 0]}>
          <mesh
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
              onHoverChange?.({
                title: "Catálogo",
                subtitle: `${products.length} producto${products.length === 1 ? "" : "s"} en venta`,
                action: "Click para abrir la galería",
              });
            }}
            onPointerOut={() => {
              setHovered(false);
              onHoverChange?.(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onActivate("catalog");
            }}
          >
            <boxGeometry args={[1.6, 2.0, 0.14]} />
            <meshStandardMaterial
              ref={glowMat}
              color={dark ? "#14100c" : "#f5efe2"}
              roughness={0.4}
              metalness={0.2}
              emissive={primary}
              emissiveIntensity={0.55}
            />
          </mesh>
          <mesh position={[0, 0, 0.085]}>
            <planeGeometry args={[1.44, 1.84]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
        </group>
        <HotspotLabel
          text={
            hovered
              ? "Abrir catálogo →"
              : `Catálogo · ${products.length} productos`
          }
          primary={primary}
          hovered={hovered}
          y={3.05}
        />
      </group>
      <BlobShadow radius={1.15} opacity={0.45} />
    </group>
  );
}
