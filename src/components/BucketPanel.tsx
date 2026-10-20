import { type FC, useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Trash2 } from 'lucide-react';
import styles from './BucketPanel.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { setStatusHint, clearStatusHint } from '../utils/statusHint';
import { usePanelDrag } from '../hooks/usePanelDrag';
import { ObjectiveCard } from './ObjectiveCard';
import { TemplateButtons } from './TemplateButtons';
import type { Bucket, StrategicObjective } from '../types';

interface BucketPanelProps {
  bucket: Bucket;
  objectives: StrategicObjective[];
  zoom: number;
  zIndex: number; // from stackingOrder (sort_order); a panel being moved/resized is lifted above all others
  onOpenDetails: (id: number) => void;
  onManageCategories: () => void;
}

// A dragged bucket lifts above other buckets but stays below every note (BucketsPage NOTE_Z_BASE = 10000)
const DRAGGING_Z_INDEX = 9999;

export const BucketPanel: FC<BucketPanelProps> = ({ bucket, objectives, zoom, zIndex, onOpenDetails, onManageCategories }) => {
  const { categories, viewedObjectiveId, addObjective, updateBucket, updateBucketGeometry, bringBucketToFront, deleteBucket } = useFocus();
  const isMissionPanel = bucket.kind === 'mission';
  // Drop target ids parsed by BucketsPage: 'mission' or 'bucket-<id>'
  const containerId = isMissionPanel ? 'mission' : `bucket-${bucket.id}`;

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
      className={`${styles.panel} ${isDragging ? styles.dragging : ''}`}
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

      <TemplateButtons
        className={styles.templates}
        defaultBucketId={isMissionPanel ? undefined : bucket.id}
        // Same as this panel's add box: Mission panel adds to Mission, a bucket panel only to its bucket
        defaultInMission={isMissionPanel}
      />

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
