import { type CSSProperties, type FC, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight } from 'lucide-react';
import styles from './ContextMenu.module.scss';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  submenu?: ContextMenuItem[]; // a nested list that opens beside the item on hover or click
  checked?: boolean;           // marks the current choice in a list
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const EDGE_MARGIN = 6;

// The nested list: beside its item, flipped to the left or nudged up when it would run off the window
const Submenu: FC<{ items: ContextMenuItem[]; onPick: (item: ContextMenuItem) => void }> = ({ items, onPick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const flip = rect.right > window.innerWidth - EDGE_MARGIN;
    const up = Math.max(0, rect.bottom - (window.innerHeight - EDGE_MARGIN));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlacement({ ...(flip ? { left: 'auto', right: '100%', marginLeft: 0, marginRight: 2 } : {}), top: -up });
  }, []);

  return (
    <div ref={ref} className={styles.submenu} role="menu" style={{ ...placement, visibility: placement ? 'visible' : 'hidden' }}>
      {items.map(item => (
        <button key={item.label} className={styles.item} role="menuitem" onClick={() => onPick(item)}>
          {item.icon}
          <span>{item.label}</span>
          {item.checked && <Check size={12} className={styles.trailing} />}
        </button>
      ))}
    </div>
  );
};

// Rendered in a portal: the canvas world is CSS-scaled, which would break `position: fixed` and offset the menu.
export const ContextMenu: FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  // Keep the menu inside the window
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos({
      left: Math.max(EDGE_MARGIN, Math.min(x, window.innerWidth - width - EDGE_MARGIN)),
      top: Math.max(EDGE_MARGIN, Math.min(y, window.innerHeight - height - EDGE_MARGIN)),
    });
  }, [x, y]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // Capture + stop: Escape must close only the menu, not end the session or leave the page
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const pick = (item: ContextMenuItem) => {
    item.onSelect?.();
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      className={styles.menu}
      style={pos}
      role="menu"
      // Using the menu must not close the details pane, which closes itself on outside presses
      data-details-barrier
      onContextMenu={e => e.preventDefault()}
      // React events bubble out of portals: keep clicks here from selecting or dragging the row underneath
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      {items.map(item => item.submenu ? (
        <div key={item.label} className={styles.group} onMouseEnter={() => setOpenSubmenu(item.label)}>
          <button
            className={styles.item}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openSubmenu === item.label}
            onClick={() => setOpenSubmenu(open => (open === item.label ? null : item.label))}
          >
            {item.icon}
            <span>{item.label}</span>
            <ChevronRight size={12} className={styles.trailing} />
          </button>
          {openSubmenu === item.label && <Submenu items={item.submenu} onPick={pick} />}
        </div>
      ) : (
        <button
          key={item.label}
          className={styles.item}
          role="menuitem"
          onMouseEnter={() => setOpenSubmenu(null)}
          onClick={() => pick(item)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
};
