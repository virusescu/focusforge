import { FolderInput } from 'lucide-react';
import styles from './ContextMenu.module.scss';
import type { ContextMenuItem } from './ContextMenu';
import type { Bucket } from '../types';

// The "Move to bucket" menu entry: a list of the buckets tasks can live in (Unsorted first, like the bucket
// drop-down), each with its color and a check on the current one. Picking the current bucket does nothing.
export function moveToBucketItem(holdingBuckets: Bucket[], currentBucketId: number | null | undefined, onMove: (bucketId: number) => void): ContextMenuItem {
  const ordered = [...holdingBuckets.filter(b => b.kind === 'unsorted'), ...holdingBuckets.filter(b => b.kind !== 'unsorted')];
  return {
    label: 'Move to bucket',
    icon: <FolderInput size={12} />,
    submenu: ordered.map(b => ({
      label: b.name,
      icon: <span className={styles.swatch} style={{ backgroundColor: b.color }} />,
      checked: b.id === currentBucketId,
      onSelect: () => { if (b.id !== currentBucketId) onMove(b.id); },
    })),
  };
}
