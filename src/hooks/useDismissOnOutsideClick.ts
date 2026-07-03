import { useEffect, useRef } from 'react';

// Universal "click anywhere outside this to close it" behavior, used for
// every modal/popup/inline form in the app. Attach `ref` to the popup's
// content element (not its backdrop, if it has one) — a click landing
// outside that element dismisses it, exactly like clicking a modal's
// backdrop, whether or not a backdrop element actually exists.
//
// `canDismiss` is the safety gate: pass `true` only when the popup holds no
// unsaved input (so an accidental outside click can't destroy typed work).
// While `canDismiss` is false, outside clicks are ignored entirely — the
// caller must render a visible, explicit close (X) control instead.
export function useDismissOnOutsideClick<T extends HTMLElement>(
  active: boolean,
  canDismiss: boolean,
  onDismiss: () => void
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!canDismiss) return;
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismiss();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [active, canDismiss, onDismiss]);

  return ref;
}
