"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Palette, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useToast } from "@/lib/store/toast";
import { useSessionStore } from "@/lib/store/session";
import {
  fetchBranchThemeById,
  updateBranchTheme,
  applyThemeConfig,
  type BranchThemeConfigPayload,
} from "@/lib/api/branches";
import { branchName } from "@/lib/types";
import type { Branch } from "@/lib/types";

interface BranchThemeDialogProps {
  branch: Branch;
  onClose: () => void;
}

function fileOrNull(file?: File | null): File | null | undefined {
  return file === null ? null : file;
}

export function BranchThemeDialog({ branch, onClose }: BranchThemeDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const setTheme = useSessionStore((s) => s.setTheme);

  const [appName, setAppName] = useState("");
  const [loginWelcome, setLoginWelcome] = useState("");
  const [tagline, setTagline] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2f6b3c");
  const [secondaryColor, setSecondaryColor] = useState("#f2e8cf");
  const [algorithm, setAlgorithm] = useState<"light" | "dark" | "auto">("light");
  const [borderRadius, setBorderRadius] = useState("12");
  const [motion, setMotion] = useState(true);
  const [compact, setCompact] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null | undefined>(undefined);
  const [faviconFile, setFaviconFile] = useState<File | null | undefined>(undefined);
  const [bannerFile, setBannerFile] = useState<File | null | undefined>(undefined);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const branchId = String(branch.branch_id ?? branch.id ?? "");

  const { data: theme, isLoading } = useQuery({
    queryKey: ["branches", branchId, "theme-config"],
    queryFn: () => fetchBranchThemeById(branchId),
    enabled: Boolean(branchId),
  });

  // Sincroniza el formulario local con el tema cargado del servidor.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!theme) return;
    setAppName(theme.app_name ?? "");
    setLoginWelcome(theme.login_welcome_message ?? "");
    setTagline(theme.tagline ?? "");
    setPrimaryColor(theme.primary_color ?? "#2f6b3c");
    setSecondaryColor(theme.secondary_color ?? "#f2e8cf");
    setAlgorithm((theme.algorithm as "light" | "dark" | "auto") ?? "light");
    setBorderRadius(String(theme.borderRadius ?? 12));
    setMotion(theme.motion ?? true);
    setCompact(theme.compact ?? false);
    setLogoPreview(theme.logo ?? null);
    setBannerPreview((theme as unknown as { banner_image?: string | null }).banner_image ?? null);
  }, [theme]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useMutation({
    mutationFn: () => {
      const payload: BranchThemeConfigPayload = {
        app_name: appName || undefined,
        login_welcome_message: loginWelcome || undefined,
        tagline: tagline || undefined,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        algorithm,
        borderRadius: Number(borderRadius) || 0,
        motion,
        compact,
        logo: fileOrNull(logoFile),
        favicon: fileOrNull(faviconFile),
        banner_image: fileOrNull(bannerFile),
      };
      return updateBranchTheme(branchId, payload);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["branches", branchId, "theme-config"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      // Si estamos editando la sucursal activa, aplicar el tema en caliente.
      if (branchId === currentBranchId) {
        setTheme(updated);
        applyThemeConfig(updated);
      }
      toast.success("Tema actualizado correctamente");
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo guardar el tema");
    },
  });

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null | undefined) => void,
    previewSetter?: (url: string | null) => void,
  ) {
    const file = e.target.files?.[0];
    if (file === undefined) return;
    setter(file);
    if (previewSetter) {
      if (file) {
        previewSetter(URL.createObjectURL(file));
      } else {
        previewSetter(null);
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold">Tema de {branchName(branch)}</h2>
              <p className="text-xs text-muted-foreground">Personaliza colores, logo y mensajes.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          id="theme-form"
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          {isLoading ? (
            <div className="grid flex-1 place-items-center py-12">
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="app_name" className="text-sm font-medium">
                      Nombre de la app
                    </label>
                    <Input
                      id="app_name"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="Ej: Macanuo Bowl"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login_welcome" className="text-sm font-medium">
                      Mensaje de bienvenida (login)
                    </label>
                    <Input
                      id="login_welcome"
                      value={loginWelcome}
                      onChange={(e) => setLoginWelcome(e.target.value)}
                      placeholder="Ej: Bienvenido a tu punto de venta"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="tagline" className="text-sm font-medium">
                      Slogan
                    </label>
                    <Input
                      id="tagline"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Ej: Comida bowl saludable"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="algorithm" className="text-sm font-medium">
                      Modo de color
                    </label>
                    <Select
                      id="algorithm"
                      value={algorithm}
                      onChange={(e) => setAlgorithm(e.target.value as "light" | "dark" | "auto")}
                    >
                      <option value="light">Claro</option>
                      <option value="dark">Oscuro</option>
                      <option value="auto">Auto</option>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="primary_color" className="text-sm font-medium">
                      Color primario
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="primary_color"
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent p-1"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#FF6B35"
                        className="flex-1"
                      />
                    </div>
                    <div
                      className="mt-1 h-2 w-full rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="secondary_color" className="text-sm font-medium">
                      Color secundario
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="secondary_color"
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent p-1"
                      />
                      <Input
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        placeholder="#f2e8cf"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="borderRadius" className="text-sm font-medium">
                      Radio de bordes (px)
                    </label>
                    <Input
                      id="borderRadius"
                      type="number"
                      min={0}
                      max={32}
                      value={borderRadius}
                      onChange={(e) => setBorderRadius(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-6 rounded-xl border border-border bg-muted/50 p-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={motion}
                      onChange={(e) => setMotion(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary"
                    />
                    Animaciones
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={compact}
                      onChange={(e) => setCompact(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary"
                    />
                    Modo compacto
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="logo" className="text-sm font-medium">
                      Logo
                    </label>
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setLogoFile, setLogoPreview)}
                    />
                    {logoPreview && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        <img
                          src={logoPreview}
                          alt="Vista previa del logo"
                          className="h-10 w-10 rounded-md object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreview(null);
                          }}
                          className="ml-auto text-xs text-danger hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="favicon" className="text-sm font-medium">
                      Favicon
                    </label>
                    <Input
                      id="favicon"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setFaviconFile)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label htmlFor="banner" className="text-sm font-medium">
                      Banner de login
                    </label>
                    <Input
                      id="banner"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setBannerFile, setBannerPreview)}
                    />
                    {bannerPreview && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-border">
                        <img
                          src={bannerPreview}
                          alt="Vista previa del banner"
                          className="h-32 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setBannerFile(null);
                            setBannerPreview(null);
                          }}
                          className="w-full bg-muted py-1 text-xs text-danger hover:underline"
                        >
                          Quitar banner
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3 md:px-6">
                <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                  Guardar tema
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </AnimatedOverlay>
  );
}
