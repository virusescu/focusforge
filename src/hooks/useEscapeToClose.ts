import { useEffect } from 'react';

// While `active`, Escape calls `onClose` and goes no further: it must not also end the session, leave the
// page or close a dialog. Capture phase on window, like ContextMenu.
export function useEscapeToClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [active, onClose]);
}
