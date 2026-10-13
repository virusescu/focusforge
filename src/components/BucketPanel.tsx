import { type FC, useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Trash2 } from 'lucide-react';
import styles from './BucketPanel.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { setStatusHint, clearStatusHint } from '../utils/statusHint';
import { movePanel, resizePanel } from '../utils/canvas';
import { ObjectiveCard } from './ObjectiveCard';
import type { Bucket, BucketGeometry, StrategicObjective } from '../types';

interface BucketPanelProps {
  bucket: Bucket;
  objectives: StrategicObjective[];
  zoom: number;
  zIndex: number; // from stackingOrder (sort_order); a panel being moved/resized is lifted above all others
  onOpenDetails: (id: number) => void;
  onManageCategories: () => void;
}

const DRAGGING_Z_INDEX = 100000;

interface PointerDrag {
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  start: BucketGeometry;
  captured: boolean;
}

// Pointer travel (screen px) before a header press becomes a move. Capturing earlier would
// retarget the click/dblclick to the header and break double-click rename.
const DRAG_THRESHOLD_PX = 3;

export const BucketPanel: FC<BucketPanelProps> = ({ bucket, objectives, zoom, zIndex, onOpenDetails, onManageCategories }) => {
  const { categories, viewedObjectiveId, addObjective, updateBucket, updateBucketGeometry, bringBucketToFront, deleteBucket } = useFocus();
  const isMissionPanel = bucket.kind === 'mission';
  // Drop target ids parsed by BucketsPage: 'mission' or 'bucket-<id>'
  const containerId = isMissionPanel ? 'mission' : `bucket-${bucket.id}`;

  // Geometry while a move/resize is in progress; null means "use the bucket's stored geometry"
  const [dragGeom, setDragGeom] = useState<BucketGeometry | null>(null);
  const dragRef = useRef<PointerDrag | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameText, setNameText] = useState(bucket.name);
  const [newText, setNewText] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: containerId, data: { containerId } });

  useEffect(() => {
    if (isRenaming && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isRenaming]);

  const geom: BucketGeometry = dragGeom ?? { x: bucket.x, y: bucket.y, w: bucket.w, h: bucket.h };

  const beginPointerDrag = (e: React.PointerEvent<HTMLElement>, mode: PointerDrag['mode']) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // The resize handle has no click behaviour, so it captures right away
    const captured = mode === 'resize';
    if (captured) e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: geom, captured };
  };

  // Shift snaps to the SNAP_STEP grid
  const geometryAt = (drag: PointerDrag, e: React.PointerEvent): BucketGeometry => {
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    return drag.mode === 'move'
      ? movePanel(drag.start, dx, dy, zoom, e.shiftKey)
      : resizePanel(drag.start, dx, dy, zoom, e.shiftKey);
  };

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as Element).closest('button, input')) return;
    beginPointerDrag(e, 'move');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    if (!drag.captured) {
      // Released outside the header before the drag started; we never saw the pointerup
      if ((e.buttons & 1) === 0) {
        dragRef.current = null;
        return;
      }
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      drag.captured = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    setDragGeom(geometryAt(drag, e));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    dragRef.current = null;
    setDragGeom(null);
    if (!drag.captured) return; // a click, not a drag
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // From the event, not dragGeom: the last pointermove may not have rendered yet.
    // A cancelled pointer has no meaningful position, so it keeps the last rendered geometry.
    const final = e.type === 'pointercancel' ? dragGeom : geometryAt(drag, e);
    if (!final) return;
    // The last panel moved or resized stays on top
    bringBucketToFront(bucket.id);
    const s = drag.start;
    if (final.x !== s.x || final.y !== s.y || final.w !== s.w || final.h !== s.h) {
      updateBucketGeometry(bucket.id, final);
    }
  };

  const startRename = (e: React.MouseEvent) => {
    if (isMissionPanel || isRenaming) return;
    if ((e.target as Element).closest('button, input')) return;
    e.stopPropagation();
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

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateBucket(bucket.id, bucket.name, e.target.value);
  };

  const handleDelete = () => {
    if (!window.confirm(`DELETE_BUCKET "${bucket.name}"? Its objectives move to UNSORTED.`)) return;
    soundEngine.playClick();
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
      className={`${styles.panel} ${dragGeom ? styles.dragging : ''}`}
      data-bucket-id={bucket.id}
      data-details-barrier
      style={{
        left: geom.x,
        top: geom.y,
        width: geom.w,
        height: geom.h,
        zIndex: dragGeom ? DRAGGING_Z_INDEX : zIndex,
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
        onDoubleClick={startRename}
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
        ) : (
          <span
            className={styles.title}
            onMouseEnter={() => setStatusHint('RENAME_BUCKET')}
            onMouseLeave={clearStatusHint}
          >
            {bucket.name}
          </span>
        )}
        <span className={styles.count}>{objectives.length}</span>
        <input
          type="color"
          className={styles.colorInput}
          value={bucket.color}
          onChange={handleColorChange}
          title="Bucket color"
        />
        {bucket.kind === 'custom' && (
          <button
            className={styles.deleteBtn}
            onClick={handleDelete}
            onMouseEnter={() => setStatusHint('DELETE_BUCKET')}
            onMouseLeave={clearStatusHint}
            title="Delete bucket"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div
        ref={setDropRef}
        className={`${styles.body} ${isOver ? styles.over : ''}`}
        data-canvas-scroll
      >
        <SortableContext items={objectives.map(o => `obj-${o.id}@${containerId}`)} strategy={verticalListSortingStrategy}>
          {objectives.map(obj => (
            <ObjectiveCard
              key={obj.id}
              obj={obj}
              containerId={containerId}
              categories={categories}
              isViewed={viewedObjectiveId === obj.id}
              inMissionPanel={isMissionPanel}
              onOpenDetails={onOpenDetails}
              onManageCategories={onManageCategories}
              zoom={zoom}
            />
          ))}
        </SortableContext>
        {objectives.length === 0 && <div className={styles.empty}>EMPTY</div>}
      </div>

      <div className={styles.footer}>
        <input
          type="text"
          className={styles.addInput}
          placeholder="Add Objective..."
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={handleAddKeyDown}
        />
        <button className={styles.addBtn} onClick={submitNew} title="Add objective">
          <Plus size={14} />
        </button>
      </div>

      <div
        className={styles.resizeHandle}
        onPointerDown={e => beginPointerDrag(e, 'resize')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Resize"
      />
    </div>
  );
};
