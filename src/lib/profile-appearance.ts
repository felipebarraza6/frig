/** Apariencia visual del perfil (avatar + fondo). Persistida por usuario en localStorage
 *  porque `my-profile` de Yggdra aún no expone foto ni cover. */

export type AppearanceRef =
  | { type: "preset"; id: string }
  | { type: "upload"; dataUrl: string };

export interface ProfileAppearance {
  avatar: AppearanceRef;
  cover: AppearanceRef;
  /** Color del nombre/@ sobre el fondo (evita que se traslape). */
  textColorId: string;
}

export interface TextColorPreset {
  id: string;
  label: string;
  /** Color CSS del nombre. */
  color: string;
  /** Color secundario (@, email). */
  muted: string;
  /** Muestra en la paleta. */
  swatch: string;
}

export interface AvatarPreset {
  id: string;
  label: string;
  /** Gradiente CSS o color sólido de fondo. */
  background: string;
  /** Emoji opcional; si falta se muestran las iniciales. */
  emoji?: string;
}

export interface CoverPreset {
  id: string;
  label: string;
  background: string;
}

export const DEFAULT_AVATAR_ID = "brand";
export const DEFAULT_COVER_ID = "brand";
export const DEFAULT_TEXT_COLOR_ID = "white";

export const TEXT_COLOR_PRESETS: TextColorPreset[] = [
  {
    id: "white",
    label: "Blanco",
    color: "#ffffff",
    muted: "rgba(255,255,255,0.82)",
    swatch: "#ffffff",
  },
  {
    id: "cream",
    label: "Crema",
    color: "#fff7ed",
    muted: "rgba(255,247,237,0.82)",
    swatch: "#ffedd5",
  },
  {
    id: "ink",
    label: "Tinta",
    color: "#0f172a",
    muted: "rgba(15,23,42,0.72)",
    swatch: "#0f172a",
  },
  {
    id: "slate",
    label: "Pizarra",
    color: "#1e293b",
    muted: "rgba(30,41,59,0.75)",
    swatch: "#334155",
  },
  {
    id: "brand",
    label: "Marca",
    color: "var(--brand-primary)",
    muted: "color-mix(in srgb, var(--brand-primary) 75%, #fff)",
    swatch: "var(--brand-primary)",
  },
];

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "brand",
    label: "Marca",
    background: "linear-gradient(145deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 55%, #1a1a1a))",
  },
  {
    id: "ember",
    label: "Brasas",
    background: "linear-gradient(145deg, #f97316, #b45309)",
  },
  {
    id: "ocean",
    label: "Océano",
    background: "linear-gradient(145deg, #0ea5e9, #1e3a8a)",
  },
  {
    id: "mint",
    label: "Menta",
    background: "linear-gradient(145deg, #34d399, #065f46)",
  },
  {
    id: "grape",
    label: "Uva",
    background: "linear-gradient(145deg, #a78bfa, #5b21b6)",
  },
  {
    id: "slate",
    label: "Pizarra",
    background: "linear-gradient(145deg, #94a3b8, #334155)",
  },
  {
    id: "chef",
    label: "Chef",
    background: "linear-gradient(145deg, #fb923c, #9a3412)",
    emoji: "👨‍🍳",
  },
  {
    id: "bowl",
    label: "Bowl",
    background: "linear-gradient(145deg, #4ade80, #166534)",
    emoji: "🥗",
  },
  {
    id: "coffee",
    label: "Café",
    background: "linear-gradient(145deg, #d6a07a, #5c3317)",
    emoji: "☕",
  },
  {
    id: "spark",
    label: "Spark",
    background: "linear-gradient(145deg, #fbbf24, #b45309)",
    emoji: "✨",
  },
];

export const COVER_PRESETS: CoverPreset[] = [
  {
    id: "brand",
    label: "Marca",
    background:
      "linear-gradient(120deg, var(--brand-primary) 0%, color-mix(in srgb, var(--brand-primary) 70%, #fff) 45%, color-mix(in srgb, var(--brand-primary) 45%, #111) 100%)",
  },
  {
    id: "dusk",
    label: "Atardecer",
    background: "linear-gradient(120deg, #fb7185 0%, #f97316 40%, #7c2d12 100%)",
  },
  {
    id: "lagoon",
    label: "Laguna",
    background: "linear-gradient(120deg, #67e8f9 0%, #0284c7 50%, #0f172a 100%)",
  },
  {
    id: "forest",
    label: "Bosque",
    background: "linear-gradient(120deg, #86efac 0%, #15803d 55%, #14532d 100%)",
  },
  {
    id: "aurora",
    label: "Aurora",
    background: "linear-gradient(120deg, #c4b5fd 0%, #818cf8 35%, #312e81 100%)",
  },
  {
    id: "sand",
    label: "Arena",
    background: "linear-gradient(120deg, #fde68a 0%, #f59e0b 45%, #78350f 100%)",
  },
  {
    id: "night",
    label: "Noche",
    background: "linear-gradient(120deg, #64748b 0%, #1e293b 55%, #020617 100%)",
  },
  {
    id: "mesh",
    label: "Mesh",
    background:
      "radial-gradient(circle at 15% 20%, color-mix(in srgb, var(--brand-primary) 70%, #fff), transparent 42%), radial-gradient(circle at 85% 10%, #38bdf8, transparent 40%), radial-gradient(circle at 70% 80%, #f472b6, transparent 45%), linear-gradient(135deg, #0f172a, #1e293b)",
  },
];

const STORAGE_PREFIX = "frig.profile-appearance:";

export function defaultAppearance(): ProfileAppearance {
  return {
    avatar: { type: "preset", id: DEFAULT_AVATAR_ID },
    cover: { type: "preset", id: DEFAULT_COVER_ID },
    textColorId: DEFAULT_TEXT_COLOR_ID,
  };
}

export function resolveTextColor(id: string | undefined): TextColorPreset {
  return (
    TEXT_COLOR_PRESETS.find((p) => p.id === id) ??
    TEXT_COLOR_PRESETS.find((p) => p.id === DEFAULT_TEXT_COLOR_ID)!
  );
}

export function appearanceStorageKey(userId: string | number): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadProfileAppearance(
  userId: string | number | null | undefined,
): ProfileAppearance {
  if (userId == null || typeof window === "undefined") return defaultAppearance();
  try {
    const raw = window.localStorage.getItem(appearanceStorageKey(userId));
    if (!raw) return defaultAppearance();
    const parsed = JSON.parse(raw) as Partial<ProfileAppearance>;
    const textColorId =
      typeof parsed.textColorId === "string" &&
      TEXT_COLOR_PRESETS.some((p) => p.id === parsed.textColorId)
        ? parsed.textColorId
        : DEFAULT_TEXT_COLOR_ID;
    return {
      avatar: normalizeRef(parsed.avatar, DEFAULT_AVATAR_ID, AVATAR_PRESETS),
      cover: normalizeRef(parsed.cover, DEFAULT_COVER_ID, COVER_PRESETS),
      textColorId,
    };
  } catch {
    return defaultAppearance();
  }
}

export function saveProfileAppearance(
  userId: string | number,
  appearance: ProfileAppearance,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    appearanceStorageKey(userId),
    JSON.stringify(appearance),
  );
}

function normalizeRef(
  ref: AppearanceRef | undefined,
  fallbackId: string,
  presets: { id: string }[],
): AppearanceRef {
  if (!ref) return { type: "preset", id: fallbackId };
  if (ref.type === "upload" && typeof ref.dataUrl === "string" && ref.dataUrl.startsWith("data:")) {
    return ref;
  }
  if (ref.type === "preset" && presets.some((p) => p.id === ref.id)) {
    return ref;
  }
  return { type: "preset", id: fallbackId };
}

export function resolveAvatarPreset(ref: AppearanceRef): AvatarPreset | null {
  if (ref.type !== "preset") return null;
  return AVATAR_PRESETS.find((p) => p.id === ref.id) ?? AVATAR_PRESETS[0];
}

export function resolveCoverPreset(ref: AppearanceRef): CoverPreset | null {
  if (ref.type !== "preset") return null;
  return COVER_PRESETS.find((p) => p.id === ref.id) ?? COVER_PRESETS[0];
}

export function coverBackground(ref: AppearanceRef): string {
  if (ref.type === "upload") {
    return `url("${ref.dataUrl}") center / cover no-repeat`;
  }
  const preset = resolveCoverPreset(ref);
  return preset?.background ?? COVER_PRESETS[0].background;
}

/** Comprime una imagen a data URL (JPEG) para no saturar localStorage. */
export async function fileToAppearanceDataUrl(
  file: File,
  opts: { maxEdge: number; quality?: number },
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Elige una imagen (JPG, PNG o WebP).");
  }
  // ~1.8 MB crudo ≈ data URL grande; avisamos antes de leer.
  if (file.size > 6 * 1024 * 1024) {
    throw new Error("La imagen pesa demasiado (máx. 6 MB).");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, opts.maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", opts.quality ?? 0.82);
    // localStorage suele fallar cerca de 5 MB; cortamos con margen.
    if (dataUrl.length > 1_400_000) {
      throw new Error("La imagen sigue siendo muy pesada. Prueba otra más liviana.");
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
