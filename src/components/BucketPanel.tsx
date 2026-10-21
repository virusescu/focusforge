import { type FC, useState, useRef, useEffect, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ArrowDownNarrowWide, ArrowUpNarrowWide, Pencil, Trash2 } from 'lucide-react';
import styles from './BucketPanel.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { usePanelDrag } from '../hooks/usePanelDrag';
import { sortByDeadline } from '../utils/deadline';
import { ObjectiveCard } from './ObjectiveCard';
import { TemplateButtons } from './TemplateButtons';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu } from './ContextMenu';
import type { Bucket, StrategicObjective } from '../types';

interface BucketPanelProps {
  bucket: Bucket;
  objectives: StrategicObjective[];
  zoom: number;
  dimmed?: boolean; // another panel is focused
  zIndex: number; // from stackingOrder (sort_order); a panel being moved/resized is lifted above all others
  onOpenDetails: (id: number) => void;
  onManageCategories: () => void;
}

// A dragged bucket lifts above other buckets but stays below every note (BucketsPage NOTE_Z_BASE = 10000)
const DRAGGING_Z_INDEX = 9999;

// The Deadlines panel's sort direction is remembered on this machine
const SORT_KEY = 'deadlines_sort_dir';
const loadSortDirection = (): 'asc' | 'desc' => (localStorage.getItem(SORT_KEY) === 'desc' ? 'desc' : 'asc');

export const BucketPanel: FC<BucketPanelProps> = ({ bucket, objectives, zoom, zIndex, dimmed = false, onOpenDetails, onManageCategories }) => {
  const { categories, viewedObjectiveId, addObjective, updateBucket, updateBucketGeometry, bringBucketToFront, deleteBucket } = useFocus();
  const isMissionPanel = bucket.kind === 'mission';
  // The Deadlines panel lists every task that has a deadline; nothing can be dropped into it or dragged out of it
  const isDeadlinesPanel = bucket.kind === 'deadlines';
  // Drop target ids parsed by BucketsPage: 'mission', 'deadlines' or 'bucket-<id>'
  const containerId = isMissionPanel ? 'mission' : isDeadlinesPanel ? 'deadlines' : `bucket-${bucket.id}`;
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(loadSortDirection);
  const shown = isDeadlinesPanel ? sortByDeadline(objectives, sortDirection) : objectives;

  const { geom, isDragging, beginPointerDrag, handlePointerMove, handlePointerUp } = usePanelDrag({
    geometry: { x: bucket.x, y: bucket.y, w: bucket.w, h: bucket.h },
    zoom,
    onDragEnd: (final, changed) => {
      // The last panel moved or resized stays on top
      bringBucketToFront(bucket.id);
      if (changed) updateBucketGeometry(bucket.id, final);
    },
  });

  const [isRenaming, setIsRenaming] = useState(false);
  const [nameText, setNameText] = useState(bucket.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [newText, setNewText] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: containerId, data: { containerId } });

  useEffect(() => {
    if (isRenaming && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as Element).closest('button, input')) return;
    beginPointerDrag(e, 'move');
  };

  // Rename and Delete live in the header's right-click menu; Mission and Deadlines have neither
  const canRename = !isMissionPanel && !isDeadlinesPanel;

  const handleHeaderContextMenu = (e: React.MouseEvent) => {
    if (!canRename || isRenaming) return; // keep the native menu in the rename box
    e.preventDefault();
    soundEngine.playClick();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const startRename = () => {
    if (!canRename || isRenaming) return;
    soundEngine.playEditStart();
    setNameText(bucket.name);
    setIsRenaming(true);
  };

  const saveRename = () => {
    const name = nameText.trim();
    if (name && name !== bucket.name) {
      updateBucket(bucket.id, name, bucket.color);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      saveRename();
    } else if (e.key === 'Escape') {
      setNameText(bucket.name);
      setIsRenaming(false);
    }
  };

  const toggleSort = () => {
    soundEngine.playClick();
    const next = sortDirection === 'asc' ? 'desc' : 'asc';
    localStorage.setItem(SORT_KEY, next);
    setSortDirection(next);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateBucket(bucket.id, bucket.name, e.target.value);
  };

  const confirmDelete = () => {
    soundEngine.playClick();
    setConfirmingDelete(false);
    deleteBucket(bucket.id);
  };

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitNew();
    }
  };

  const submitNew = () => {
    const text = newText.trim();
    if (!text) return;
    soundEngine.playClick();
    addObjective(text, null, false, isMissionPanel ? { inMission: true } : { bucketId: bucket.id, inMission: false });
    setNewText('');
  };

  return (
    <div
      className={`${styles.panel} ${isDragging ? styles.dragging : ''} ${dimmed ? styles.dimmed : ''}`}
      data-bucket-id={bucket.id}
      data-details-barrier
      style={{
        left: geom.x,
        top: geom.y,
        width: geom.w,
        height: geom.h,
        zIndex: isDragging ? DRAGGING_Z_INDEX : zIndex,
        // Opaque so stacked panels don't show through each other
        background: `color-mix(in srgb, ${bucket.color} 10%, var(--bg-dark))`,
        borderColor: bucket.color,
      }}
    >
      <div
        className={styles.header}
        style={{ borderTopColor: bucket.color }}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleHeaderContextMenu}
      >
        {isMissionPanel ? (
          <span className={styles.title}>MISSION_OBJECTIVES</span>
        ) : isRenaming ? (
          <input
            ref={nameInputRef}
            className={styles.nameInput}
            value={nameText}
            onChange={e => setNameText(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={saveRename}
          />
        ) : isDeadlinesPanel ? (
          <span className={styles.title}>DEADLINES</span>
        ) : (
          <span className={styles.title}>{bucket.name}</span>
        )}
        <span className={styles.count}>{objectives.length}</span>
        {isDeadlinesPanel && (
          <button
            className={styles.sortBtn}
            onClick={toggleSort}
            title={sortDirection === 'asc' ? 'Soonest first (click for latest first)' : 'Latest first (click for soonest first)'}
            aria-label={sortDirection === 'asc' ? 'Sort: soonest first' : 'Sort: latest first'}
          >
            {sortDirection === 'asc' ? <ArrowDownNarrowWide size={13} /> : <ArrowUpNarrowWide size={13} />}
          </button>
        )}
        <input
          type="color"
          className={styles.colorInput}
          value={bucket.color}
          onChange={handleColorChange}
          title="Bucket color"
        />
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          items={[
            { label: 'Rename', icon: <Pencil size={12} />, onSelect: startRename },
            ...(bucket.kind === 'custom' ? [{ label: 'Delete', icon: <Trash2 size={12} />, onSelect: () => setConfirmingDelete(true) }] : []),
          ]}
        />
      )}

      <div
        ref={setDropRef}
        className={`${styles.body} ${isOver ? styles.over : ''}`}
        data-canvas-scroll
      >
        <SortableContext items={shown.map(o => `obj-${o.id}@${containerId}`)} strategy={verticalListSortingStrategy}>
          {shown.map(obj => (
            <ObjectiveCard
              key={obj.id}
              obj={obj}
              containerId={containerId}
              categories={categories}
              isViewed={viewedObjectiveId === obj.id}
              inMissionPanel={isMissionPanel}
              inDeadlinesPanel={isDeadlinesPanel}
              onOpenDetails={onOpenDetails}
              onManageCategories={onManageCategories}
              zoom={zoom}
            />
          ))}
        </SortableContext>
        {shown.length === 0 && <div className={styles.empty}>{isDeadlinesPanel ? 'NO_DEADLINES' : 'EMPTY'}</div>}
      </div>

      {/* One footer, one divider: template buttons (if any) above the add box, evenly spaced */}
      {!isDeadlinesPanel && (
        <div className={styles.footer}>
          <TemplateButtons defaultBucketId={isMissionPanel ? undefined : bucket.id} />
          <div className={styles.addRow}>
            <input
              type="text"
              className={styles.addInput}
              placeholder="Add Objective..."
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={handleAddKeyDown}
            />
          </div>
        </div>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="DELETE_BUCKET"
          message={`"${bucket.name}" will be deleted. Its objectives move to UNSORTED.`}
          confirmLabel="DELETE"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      <div
        className={styles.resizeHandle}
        data-no-focus
        onPointerDown={e => beginPointerDrag(e, 'resize')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Resize"
      />
    </div>
  );
};
