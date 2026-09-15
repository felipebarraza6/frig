"use client";

import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

/**
 * Caldero humeante nórdico (Saehrímnir / Banquete de Valhalla)
 */
export function NordicCauldron({ className = "h-4 w-4", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Vapor / humo del guiso */}
      <path d="M5 1h1v2H5zm5 0h1v2h-1zm-3 1h2v1H7z" opacity="0.75" />
      {/* Asas del caldero */}
      <path d="M1 6h2v3H1zm12 0h2v3h-2z" opacity="0.6" />
      {/* Borde superior */}
      <path d="M2 5h12v2H2z" />
      {/* Cuerpo del caldero */}
      <path d="M3 7h10v5H3z" />
      {/* Fondo y patas */}
      <path d="M4 12h8v1H4zm-1 1h2v2H3zm8 0h2v2h-2z" />
      {/* Detalle de caldo dorado */}
      <path d="M5 8h6v1H5z" fill="#d97706" />
    </svg>
  );
}

/**
 * Cuerno nórdico de hidromiel con ribete dorado
 */
export function NordicHorn({ className = "h-4 w-4", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Boquilla */}
      <path d="M10 1h5v2h-5z" fill="#d4a373" />
      {/* Espuma de hidromiel */}
      <path d="M11 0h3v1h-3z" fill="#ffffff" opacity="0.9" />
      {/* Cuerpo curvo del cuerno */}
      <path d="M9 3h5v2H9zm-2 2h5v2H7zm-2 2h5v2H5zm-2 2h5v2H3zm-1 2h4v2H2zm0 2h2v2H2z" />
      {/* Grabado rúnico / ribete central */}
      <path d="M6 6h2v2H6z" fill="#d4a373" />
      <path d="M4 8h2v2H4z" fill="#d4a373" />
    </svg>
  );
}

/**
 * Pierna de asado nórdico (Banquete Vikingo)
 */
export function NordicMeat({ className = "h-4 w-4", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Hueso blanco */}
      <path d="M1 12h2v3H1zm2 1h2v2H3zm1-3h2v2H4z" fill="#f7f6f0" />
      {/* Carne asada dorada */}
      <path d="M6 6h7v7H6z" fill="#8c3a1d" />
      <path d="M7 5h7v7H7z" fill="#b85128" />
      <path d="M9 3h5v4H9z" fill="#d96b34" />
      {/* Brillo del asado */}
      <path d="M10 4h3v2h-3z" fill="#f97316" />
      <path d="M8 8h3v2H8z" fill="#fed7aa" opacity="0.6" />
    </svg>
  );
}

/**
 * Salmón / pescado ahumado de fiordo
 */
export function NordicFish({ className = "h-4 w-4", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Cola de pez */}
      <path d="M1 4h2v3H1zm0 5h2v3H1zm2-2h2v2H3z" />
      {/* Cuerpo del pez */}
      <path d="M5 5h7v6H5z" />
      <path d="M6 4h5v8H6z" />
      {/* Cabeza */}
      <path d="M12 6h3v4h-3z" />
      {/* Ojo y escamas */}
      <path d="M13 7h1v1h-1z" fill="#38bdf8" />
      <path d="M7 6h2v2H7zm2 2h2v2H9z" fill="#94a3b8" opacity="0.75" />
    </svg>
  );
}

/**
 * Hogaza de centeno / pan nórdico trenzado
 */
export function NordicBread({ className = "h-4 w-4", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Base del pan */}
      <path d="M3 8h10v4H3zm1 4h8v2H4z" fill="#8c5828" />
      {/* Corteza dorada */}
      <path d="M4 6h8v3H4zm1-2h6v3H5z" fill="#c4873b" />
      {/* Cortes y semillas de centeno */}
      <path d="M6 5h1v3H6zm3 5h1v3H9zm2-4h1v3h-1z" fill="#fde047" />
    </svg>
  );
}

/**
 * Tarro nórdico de madera / jarra de ale
 */
export function NordicAle({ className = "h-4 w-4", size }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Espuma desbordante */}
      <path d="M4 1h8v3H4z" fill="#ffffff" />
      <path d="M3 2h2v2H3zm8 0h2v3h-2z" fill="#ffffff" opacity="0.9" />
      {/* Asa de madera */}
      <path d="M12 5h3v6h-3zm1 2h1v3h-1z" />
      {/* Cuerpo del tarro */}
      <path d="M4 4h8v10H4z" fill="#7a441e" />
      {/* Flejes de hierro nórdico */}
      <path d="M4 6h8v1H4zm0 4h8v1H4z" fill="#64748b" />
    </svg>
  );
}
