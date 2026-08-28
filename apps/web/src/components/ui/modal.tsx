"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m, LazyMotion, domAnimation } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalContextValue {
  titleId: string;
  descriptionId: string;
  onClose: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext(component: string) {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error(`<Modal.${component}> debe estar dentro de <Modal>.`);
  }
  return ctx;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  hideCloseButton?: boolean;
  closeOnOverlay?: boolean;
  className?: string;
  overlayClassName?: string;
  initialFocusRef?: React.RefObject<HTMLElement>;
  children: ReactNode;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal compartido: overlay + Escape + focus trap + animación + scroll lock.
 * Reemplaza los `fixed inset-0 z-50` ad-hoc que estaban dispersos en la app.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  hideCloseButton,
  closeOnOverlay = true,
  className,
  overlayClassName,
  initialFocusRef,
  children,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Scroll lock del body.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Guardar/restaurar foco.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const t = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const node = panelRef.current;
      if (!node) return;
      const first = node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? node).focus();
    }, 30);

    return () => {
      window.clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open, initialFocusRef]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (typeof window === "undefined") return null;

  const ctxValue: ModalContextValue = { titleId, descriptionId, onClose };

  return createPortal(
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            onKeyDown={handleKeyDown}
          >
            <m.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => {
                if (closeOnOverlay) onClose();
              }}
              className={cn(
                "absolute inset-0 bg-black/50 backdrop-blur-sm",
                overlayClassName,
              )}
            />
            <m.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descriptionId : undefined}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "relative z-10 flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none",
                SIZE_CLASS[size],
                size === "full" && "h-full",
                size !== "full" && "max-h-[calc(100vh-2rem)]",
                className,
              )}
            >
              <ModalContext.Provider value={ctxValue}>
                {(title || !hideCloseButton) && (
                  <ModalHeader hideCloseButton={hideCloseButton}>
                    {title ? (
                      <ModalTitle>{title}</ModalTitle>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    {description ? (
                      <ModalDescription>{description}</ModalDescription>
                    ) : null}
                  </ModalHeader>
                )}
                {children}
              </ModalContext.Provider>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    document.body,
  );
}

interface ModalHeaderProps {
  hideCloseButton?: boolean;
  children: ReactNode;
  className?: string;
}

function ModalHeader({ hideCloseButton, children, className }: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start gap-4 border-b border-border px-6 py-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {!hideCloseButton && <ModalClose />}
    </div>
  );
}

function ModalTitle({ children }: { children: ReactNode }) {
  const { titleId } = useModalContext("Title");
  return (
    <h2 id={titleId} className="truncate text-lg font-semibold tracking-tight">
      {children}
    </h2>
  );
}

function ModalDescription({ children }: { children: ReactNode }) {
  const { descriptionId } = useModalContext("Description");
  return (
    <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

const ModalClose = forwardRef<HTMLButtonElement, { className?: string }>(
  function ModalClose({ className }, ref) {
    const { onClose } = useModalContext("Close");
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <X className="h-4 w-4" />
      </button>
    );
  },
);

interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}
function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)}>{children}</div>
  );
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}
function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ModalSectionProps {
  children: ReactNode;
  className?: string;
}
function ModalSection({ children, className }: ModalSectionProps) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

export {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalSection,
};
