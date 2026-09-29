"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Camera, ImagePlus, Check } from "lucide-react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/store/toast";
import {
  AVATAR_PRESETS,
  COVER_PRESETS,
  TEXT_COLOR_PRESETS,
  fileToAppearanceDataUrl,
  type AppearanceRef,
  type ProfileAppearance,
} from "@/lib/profile-appearance";
import { cn } from "@/lib/utils";

type PickerTarget = "avatar" | "cover";

interface ProfileAppearancePickerProps {
  open: boolean;
  target: PickerTarget;
  appearance: ProfileAppearance;
  initials: string;
  onClose: () => void;
  onSave: (next: ProfileAppearance) => void;
}

export function ProfileAppearancePicker({
  open,
  target,
  appearance,
  initials,
  onClose,
  onSave,
}: ProfileAppearancePickerProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<AppearanceRef>(
    () => (target === "avatar" ? appearance.avatar : appearance.cover),
  );
  const [textColorId, setTextColorId] = useState(appearance.textColorId);
  const [busy, setBusy] = useState(false);

  // Resetea el draft al abrir o cambiar de target/apariencia (ajuste en render).
  const syncKey = open
    ? JSON.stringify([target, appearance.avatar, appearance.cover, appearance.textColorId])
    : null;
  const [pickerKey, setPickerKey] = useState<string | null>(syncKey);
  if (pickerKey !== syncKey) {
    setPickerKey(syncKey);
    if (open) {
      setDraft(target === "avatar" ? appearance.avatar : appearance.cover);
      setTextColorId(appearance.textColorId);
    }
  }

  const title = target === "avatar" ? "Foto de perfil" : "Imagen de fondo";
  const description =
    target === "avatar"
      ? "Elige un estilo o sube tu propia foto."
      : "Elige un fondo o sube una imagen propia.";

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToAppearanceDataUrl(file, {
        maxEdge: target === "avatar" ? 512 : 1400,
        quality: target === "avatar" ? 0.85 : 0.8,
      });
      setDraft({ type: "upload", dataUrl });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la imagen");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleConfirm() {
    onSave(
      target === "avatar"
        ? { ...appearance, avatar: draft }
        : { ...appearance, cover: draft, textColorId },
    );
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="lg">
      <ModalBody className="space-y-5">
        <div className="flex justify-center">
          {target === "avatar" ? (
            <AvatarPreview refStyle={draft} initials={initials} size="lg" />
          ) : (
            <div
              className="h-28 w-full max-w-lg overflow-hidden rounded-2xl ring-1 ring-border"
              style={coverPreviewStyle(draft)}
            />
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Predeterminados</p>
          {target === "avatar" ? (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-5 md:grid-cols-10">
              {AVATAR_PRESETS.map((preset) => {
                const selected =
                  draft.type === "preset" && draft.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    onClick={() => setDraft({ type: "preset", id: preset.id })}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-full ring-2 transition-transform hover:scale-105",
                      selected ? "ring-primary" : "ring-transparent",
                    )}
                    style={{ background: preset.background }}
                  >
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white drop-shadow sm:text-base">
                      {preset.emoji || initials.slice(0, 1) || "?"}
                    </span>
                    {selected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <Check className="h-4 w-4 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {COVER_PRESETS.map((preset) => {
                const selected =
                  draft.type === "preset" && draft.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    onClick={() => setDraft({ type: "preset", id: preset.id })}
                    className={cn(
                      "relative h-16 overflow-hidden rounded-xl ring-2 transition-transform hover:scale-[1.02]",
                      selected ? "ring-primary" : "ring-border/60",
                    )}
                    style={{ background: preset.background }}
                  >
                    <span className="absolute bottom-1 left-1.5 rounded bg-black/35 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                      {preset.label}
                    </span>
                    {selected && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {target === "cover" && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Color del nombre sobre el fondo
            </p>
            <div className="flex flex-wrap gap-2">
              {TEXT_COLOR_PRESETS.map((tone) => {
                const selected = textColorId === tone.id;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    title={tone.label}
                    onClick={() => setTextColorId(tone.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-border shadow-sm"
                      style={{ background: tone.swatch }}
                    />
                    {tone.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <ImagePlus className="h-4 w-4 text-primary" />
                Subir imagen propia
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                JPG, PNG o WebP. Se guarda en este dispositivo.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              isLoading={busy}
              onClick={() => fileRef.current?.click()}
            >
              {!busy && <Camera className="mr-1.5 h-3.5 w-3.5" />}
              Elegir archivo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {draft.type === "upload" && (
            <p className="mt-2 text-[11px] font-medium text-success">
              Imagen propia lista · confirmar para aplicar
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleConfirm} disabled={busy}>
          Aplicar
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function coverPreviewStyle(ref: AppearanceRef): CSSProperties {
  if (ref.type === "upload") {
    return {
      backgroundImage: `url("${ref.dataUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  const preset = COVER_PRESETS.find((p) => p.id === ref.id) ?? COVER_PRESETS[0];
  return { background: preset.background };
}

export function AvatarPreview({
  refStyle,
  initials,
  size = "md",
  className,
}: {
  refStyle: AppearanceRef;
  initials: string;
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const dims =
    size === "xl"
      ? "h-28 w-28 text-3xl sm:h-32 sm:w-32"
      : size === "lg"
        ? "h-24 w-24 text-2xl"
        : "h-20 w-20 text-xl sm:h-24 sm:w-24 sm:text-2xl";

  if (refStyle.type === "upload") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={refStyle.dataUrl}
        alt=""
        className={cn(
          "rounded-full border-4 border-background object-cover shadow-md",
          dims,
          className,
        )}
      />
    );
  }

  const preset = AVATAR_PRESETS.find((p) => p.id === refStyle.id) ?? AVATAR_PRESETS[0];
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border-4 border-background font-bold text-white shadow-md",
        dims,
        className,
      )}
      style={{ background: preset.background }}
      aria-hidden
    >
      {preset.emoji ? (
        <span className="drop-shadow-sm">{preset.emoji}</span>
      ) : (
        <span className="drop-shadow-sm">{initials || "?"}</span>
      )}
    </div>
  );
}
