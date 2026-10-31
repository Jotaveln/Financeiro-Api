"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable=\"true\"]",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

export function Modal({ open, onClose, title, children }) {
  const closeButton = useRef(null);
  const dialog = useRef(null);
  const opener = useRef(null);
  const wasOpen = useRef(false);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      if (!wasOpen.current) {
        const active = document.activeElement;
        opener.current = active && typeof active.focus === "function" ? active : null;
        wasOpen.current = true;
      }

      closeButton.current?.focus();
      return undefined;
    }

    if (wasOpen.current) {
      wasOpen.current = false;
      const element = opener.current;
      opener.current = null;
      if (element?.isConnected) element.focus();
    }

    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const currentDialog = dialog.current;
      if (!currentDialog) return;

      const focusable = [...currentDialog.querySelectorAll(focusableSelector)];

      if (!focusable.length) {
        event.preventDefault();
        currentDialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !currentDialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !currentDialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return <div
    className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4"
    onMouseDown={(event) => event.target === event.currentTarget && onClose()}
  >
    <div
      ref={dialog}
      className="card max-h-[90vh] w-full max-w-lg overflow-auto p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 id={titleId} className="text-xl font-black">{title}</h2>
        <button
          ref={closeButton}
          type="button"
          className="icon-btn !min-h-9 !min-w-9 !p-2"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={17} />
        </button>
      </div>
      {children}
    </div>
  </div>;
}
