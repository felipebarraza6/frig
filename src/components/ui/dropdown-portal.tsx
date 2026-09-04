"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface DropdownPortalProps {
  triggerRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
  align?: "left" | "right";
  /** Ensanchar el panel al ancho natural del contenido (evita cortar etiquetas largas). */
  autoWidth?: boolean;
}

/** Estado previo a la medición: fuera de pantalla, oculto y sin ancho
 *  (un elemento fixed con width auto hace shrink-to-fit al contenido). */
const HIDDEN_STYLE: React.CSSProperties = {
  position: "fixed",
  top: -10000,
  left: 0,
  visibility: "hidden",
};

export function DropdownPortal({
  triggerRef,
  open,
  onClose,
  children,
  className = "",
  minWidth = 140,
  align = "left",
  autoWidth = false,
}: DropdownPortalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  // Estado inicial fuera de pantalla y sin ancho: un elemento fixed con
  // width auto hace shrink-to-fit, así se puede medir el ancho natural.
  const [style, setStyle] = useState<React.CSSProperties>(HIDDEN_STYLE);
  const naturalWidthRef = useRef(0);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    let width = Math.max(rect.width, minWidth);
    if (autoWidth) {
      // Ancho natural medido con el panel en shrink-to-fit (ver useEffect).
      width = Math.max(width, naturalWidthRef.current);
    }
    // Nunca más ancho que la ventana
    width = Math.min(width, window.innerWidth - margin * 2);
    let left = align === "left" ? rect.left : rect.right - width;

    // Evitar que se salga por la derecha
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - width - margin);
    }
    // Evitar que se salga por la izquierda
    if (left < margin) {
      left = margin;
    }

    let top = rect.bottom + 4;
    const contentHeight = contentRef.current?.offsetHeight ?? 240;
    if (top + contentHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - contentHeight - 4);
    }

    setStyle({
      position: "fixed",
      top,
      left,
      width,
      zIndex: 9999,
      visibility: "visible",
    });
  }, [triggerRef, align, minWidth, autoWidth]);

  useEffect(() => {
    if (!open) return;
    if (autoWidth && contentRef.current) {
      // Medir el ancho natural quitando el width fijo momentáneamente:
      // al ser position:fixed con width auto, el panel hace shrink-to-fit.
      const el = contentRef.current;
      const prevWidth = el.style.width;
      el.style.width = "auto";
      naturalWidthRef.current = el.offsetWidth;
      el.style.width = prevWidth;
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition, autoWidth]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={contentRef}
      style={style}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
