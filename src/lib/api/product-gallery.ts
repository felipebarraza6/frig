import { apiFetch, mediaUrl } from "./client";
import { fetchAllPages } from "./pagination";
import type { YggdraSchemas } from "@/lib/api/types";

export type ProductGalleryImage = YggdraSchemas["ProductGallery"];

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;

/** Tope del cliente. El ImageField de ProductGallery no declara validador de tamaño. */
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function validateProductImageFile(file: File): string | null {
  const typeOk = ALLOWED_TYPES.has(file.type);
  const extOk = ALLOWED_EXT.test(file.name);
  if (!typeOk && !extOk) {
    return "Solo se aceptan imágenes JPG, PNG o WebP.";
  }
  if (file.type && !typeOk) {
    return "Solo se aceptan imágenes JPG, PNG o WebP.";
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return "La imagen pesa demasiado (máx. 5 MB).";
  }
  if (file.size <= 0) {
    return "El archivo está vacío.";
  }
  return null;
}

export function galleryImageSrc(image: Pick<ProductGalleryImage, "image_url" | "image">): string | null {
  return mediaUrl(image.image_url || image.image || null);
}

/** Elige la principal activa, o la primera activa si ninguna está marcada. */
export function pickPrimaryGalleryImage(
  images: ProductGalleryImage[],
): ProductGalleryImage | null {
  const active = images.filter((img) => img.is_active !== false);
  return active.find((img) => img.is_primary) ?? active[0] ?? null;
}

export async function fetchProductGallery(productId: number): Promise<ProductGalleryImage[]> {
  return fetchAllPages<ProductGalleryImage>(
    `/inventory/gallery/?product_id=${productId}&is_active=true`,
  );
}

/** Galería activa de la sucursal (el listado de productos no trae primary_image). */
export async function fetchBranchProductGallery(): Promise<ProductGalleryImage[]> {
  return fetchAllPages<ProductGalleryImage>("/inventory/gallery/?is_active=true");
}

export function primaryImageByProduct(
  images: ProductGalleryImage[],
): Map<number, string> {
  const grouped = new Map<number, ProductGalleryImage[]>();
  for (const image of images) {
    const bucket = grouped.get(image.product) ?? [];
    bucket.push(image);
    grouped.set(image.product, bucket);
  }
  const urls = new Map<number, string>();
  for (const [productId, bucket] of grouped) {
    const primary = pickPrimaryGalleryImage(bucket);
    const src = primary ? galleryImageSrc(primary) : null;
    if (src) urls.set(productId, src);
  }
  return urls;
}

export async function uploadProductImage(input: {
  productId: number;
  file: File;
  isPrimary?: boolean;
  altText?: string;
}): Promise<ProductGalleryImage> {
  const error = validateProductImageFile(input.file);
  if (error) throw new Error(error);
  const form = new FormData();
  form.append("product", String(input.productId));
  form.append("image", input.file);
  form.append("is_primary", input.isPrimary ? "true" : "false");
  if (input.altText) form.append("alt_text", input.altText);
  return apiFetch<ProductGalleryImage>("/inventory/gallery/", {
    method: "POST",
    body: form,
  });
}

/**
 * El update de galería no acepta un archivo nuevo (ProductGalleryUpdateSerializer).
 * Reemplazar es borrar la fila y crear otra con el mismo rol de principal.
 */
export async function replaceProductImage(input: {
  productId: number;
  imageId: number;
  file: File;
  isPrimary: boolean;
}): Promise<ProductGalleryImage> {
  await deleteProductImage(input.imageId);
  return uploadProductImage({
    productId: input.productId,
    file: input.file,
    isPrimary: input.isPrimary,
  });
}

export async function deleteProductImage(imageId: number): Promise<void> {
  await apiFetch(`/inventory/gallery/${imageId}/`, { method: "DELETE" });
}

export async function setPrimaryProductImage(
  productId: number,
  imageId: number,
): Promise<void> {
  await apiFetch(`/inventory/gallery/set_primary/?product_id=${productId}`, {
    method: "POST",
    body: { image_id: imageId },
  });
}
