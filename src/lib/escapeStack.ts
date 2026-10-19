import { useEffect, useRef } from 'react';

/**
 * escapeStack.ts — Escape closes the panel on top, and only that one.
 *
 * Several things can be open at once (the info panel, the layers list, the ⋮
 * menu, the About window over all of them). One shared key listener hands
 * Escape to whichever opened LAST, so a single press never closes the lot.
 *
 * Two cases are left alone:
 *   • typing in a text box — the search box uses Escape to clear itself;
 *   • a full-screen window that handles Escape on its own (the 3D viewer, the
 *     manifest, the welcome card) — a panel underneath must not close too.
 */
interface Entry {
  close: () => void;
  /** A full-screen window: it still gets Escape when one is open. */
  modal: boolean;
}

const stack: Entry[] = [];

/** Add a closer to the top of the stack; returns its remover. */
export function pushEscape(close: () => void, modal = false): () => void {
  const entry: Entry = { close, modal };
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  };
}

export interface EscapeContext {
  /** The key event's target is a text field. */
  typing: boolean;
  /** A full-screen window (overlay or aria-modal) is on screen. */
  overlayOpen: boolean;
}

/** Close the top entry if it should take this Escape. True when it did. */
export function handleEscape(ctx: EscapeContext): boolean {
  if (ctx.typing) return false;
  const top = stack[stack.length - 1];
  if (!top) return false;
  if (ctx.overlayOpen && !top.modal) return false;
  top.close();
  return true;
}

function contextFor(e: KeyboardEvent): EscapeContext {
  const t = e.target as HTMLElement | null;
  const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const overlayOpen = !!document.querySelector('.bv-overlay, [aria-modal="true"]');
  return { typing, overlayOpen };
}

let listening = false;
function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (handleEscape(contextFor(e))) e.preventDefault();
  });
}

/** Close this panel with Escape while `active`. */
export function useEscape(onClose: () => void, active = true, modal = false): void {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    listen();
    return pushEscape(() => ref.current(), modal);
  }, [active, modal]);
}
