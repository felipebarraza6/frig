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
}

export function DropdownPortal({
  triggerRef,
  open,
  onClose,
  children,
  className = "",
  minWidth = 140,
  align = "left",
}: DropdownPortalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    let left = align === "left" ? rect.left : rect.right;
    const width = Math.max(rect.width, minWidth);

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
    });
  }, [triggerRef, align, minWidth]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

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
