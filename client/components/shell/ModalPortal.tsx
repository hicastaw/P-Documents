import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body instead of in-place.
 *
 * AppShell's <main> keeps a residual `transform` from its mount fade-in
 * animation (animation-fill-mode: forwards), which makes it a CSS
 * containing block for any `position: fixed` descendant — so a modal
 * rendered inline ends up centered within the full scrollable page
 * height instead of the viewport. Portaling to <body> sidesteps that.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
