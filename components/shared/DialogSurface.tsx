"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Native dialog supplies focus trapping, Escape and focus restoration. */
export function DialogSurface({ children, label, onClose, className = "" }: {
  children: ReactNode; label: string; onClose: () => void; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog ref={ref} aria-label={label} className={`experience-dialog ${className}`} data-lenis-prevent
      onCancel={(e) => { e.preventDefault(); closeRef.current(); }}
      onClick={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}>
      {children}
    </dialog>, document.body,
  );
}
