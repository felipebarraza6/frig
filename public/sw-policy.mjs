// Qué respuestas de /_next/static se pueden guardar.
// Un 404 reescrito a HTML no debe quedar cacheado como si fuera el chunk.

const CACHEABLE = [
  "javascript",
  "ecmascript",
  "css",
  "font",
  "image",
  "wasm",
];

export function isCacheableStatic(response) {
  if (!response || !response.ok) return false;
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (type.includes("text/html")) return false;
  return CACHEABLE.some((kind) => type.includes(kind));
}
