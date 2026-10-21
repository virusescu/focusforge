import { type FC, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import styles from './BucketSelect.module.scss';
import { soundEngine } from '../utils/audio';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import type { Bucket } from '../types';

interface BucketSelectProps {
  buckets: Bucket[];
  value: number | null;
  onChange: (bucketId: number) => void;
  id?: string;
  ariaLabel?: string;
  title?: string;
  className?: string; // styles the trigger button
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const EDGE_MARGIN = 6;

// A drop-down that shows each bucket's color as a small rectangle beside its name (a native <select>
// cannot draw one). The list is portalled to document.body: the sidebar and dialogs clip overflow.
export const BucketSelect: FC<BucketSelectProps> = ({ buckets: bucketList, value, onChange, id, ariaLabel, title, className, onMouseEnter, onMouseLeave }) => {
  // Unsorted always comes first; the rest keep the order they were given
  const buckets = [...bucketList.filter(b => b.kind === 'unsorted'), ...bucketList.filter(b => b.kind !== 'unsorted')];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; minWidth: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = buckets.find(b => b.id === value);

  const openList = () => {
    soundEngine.playClick();
    setActive(Math.max(0, buckets.findIndex(b => b.id === value)));
    setPos(null);
    setOpen(true);
  };

  const closeList = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  // Escape closes the list wherever the focus is (the list takes focus on open, but a click elsewhere can move it)
  useEscapeToClose(open, () => closeList(true));

  const choose = (bucketId: number) => {
    soundEngine.playClick();
    if (bucketId !== value) onChange(bucketId);
    closeList(true);
  };

  // Below the trigger, or above it when there is no room; kept inside the window
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const list = listRef.current?.getBoundingClientRect();
    if (!trigger || !list) return;
    const fitsBelow = trigger.bottom + list.height + EDGE_MARGIN <= window.innerHeight;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos({
      left: Math.max(EDGE_MARGIN, Math.min(trigger.left, window.innerWidth - Math.max(list.width, trigger.width) - EDGE_MARGIN)),
      top: fitsBelow ? trigger.bottom : Math.max(EDGE_MARGIN, trigger.top - list.height),
      minWidth: trigger.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleClose = () => setOpen(false);
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('blur', handleClose);
    window.addEventListener('resize', handleClose);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('blur', handleClose);
      window.removeEventListener('resize', handleClose);
    };
  }, [open]);

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    // Handled keys stay here: Space/Enter/arrows must not reach the HUD shortcuts or a dialog's Enter-to-submit
    const handled = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'ArrowDown') {
      handled();
      setActive(i => Math.min(buckets.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      handled();
      setActive(i => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      handled();
      setActive(0);
    } else if (e.key === 'End') {
      handled();
      setActive(buckets.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      handled();
      if (buckets[active]) choose(buckets[active].id);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={title}
        className={`${styles.trigger} ${className ?? ''}`}
        onClick={() => (open ? closeList(false) : openList())}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {selected && <span className={styles.swatch} style={{ backgroundColor: selected.color }} />}
        <span className={styles.name}>{selected?.name ?? ''}</span>
        <ChevronDown size={10} className={styles.chevron} />
      </button>
      {open && createPortal(
        <div
          ref={listRef}
          className={styles.list}
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, minWidth: pos?.minWidth, visibility: pos ? 'visible' : 'hidden' }}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel ? `${ariaLabel} list` : undefined}
          // Escape closes just this list (useEscapeToClose), not the dialog or page that holds it; ModalFrame looks for this marker
          data-handles-escape
          data-details-barrier
          onKeyDown={handleListKeyDown}
          // React events bubble out of portals: keep presses here from reaching the row or dialog that holds the select
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
        >
          {buckets.map((b, i) => (
            <div
              key={b.id}
              role="option"
              aria-selected={b.id === value}
              className={`${styles.option} ${i === active ? styles.active : ''} ${b.id === value ? styles.selected : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(b.id)}
            >
              <span className={styles.swatch} style={{ backgroundColor: b.color }} />
              <span className={styles.name}>{b.name}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};
