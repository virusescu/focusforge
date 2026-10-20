import { type FC, type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './ModalFrame.module.scss';

interface ModalFrameProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  // Enter in a text input submits (not in a textarea, select or button)
  onSubmit?: () => void;
  wide?: boolean;
}

// Shared shell for the template dialogs. Portalled so it escapes transformed ancestors and sits above
// Settings; it does not close on a backdrop click (forms hold typed text), only via Escape, X or Cancel.
export const ModalFrame: FC<ModalFrameProps> = ({ title, onClose, children, footer, onSubmit, wide }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Keys go to whatever has focus. With no input to grab it (a template without fields) focus would stay
  // on the button underneath, so Space would start the timer and Enter would click that button again.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (overlay && !overlay.contains(document.activeElement)) overlay.focus();
  }, []);

  useEffect(() => {
    // Capture + stop: Escape closes only this dialog, not Settings, the canvas page or the session
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Typing here must not reach the HUD shortcuts (Space starts the timer, A/I/V/B switch views)
    e.stopPropagation();
    if (e.key !== 'Enter' || !onSubmit) return;
    const target = e.target as HTMLElement;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement) return;
    e.preventDefault();
    onSubmit();
  };

  return createPortal(
    <div
      ref={overlayRef}
      // Focusable so a click on blank space keeps focus in the dialog instead of dropping it to <body>
      tabIndex={-1}
      className={styles.overlay}
      onKeyDown={handleKeyDown}
      // React events bubble out of portals: keep clicks here from reaching whatever opened the dialog
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onContextMenu={e => e.stopPropagation()}
    >
      <div className={`${styles.modal} ${wide ? styles.wide : ''}`} role="dialog" aria-label={title}>
        <div className={styles.header}>
          <h2>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className={styles.content}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};
