import { type FC, useState, useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, Target, MinusCircle, CopyPlus, Copy, BookmarkPlus, Pencil, Trash2 } from 'lucide-react';
import styles from './ObjectiveCard.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { setStatusHint, clearStatusHint } from '../utils/statusHint';
import { isTypingTarget } from '../utils/canvas';
import { copyPlain } from '../utils/clipboard';
import { ContextMenu } from './ContextMenu';
import { moveToBucketItem } from './bucketMoveItem';
import { isHoldingBucket } from '../utils/buckets';
import { SaveTemplateModal } from './SaveTemplateModal';
import { CategoryDotPicker } from './CategoryDotPicker';
import { DeadlineBadge } from './DeadlineBadge';
import type { StrategicObjective, ObjectiveCategory } from '../types';

interface ObjectiveCardProps {
  obj: StrategicObjective;
  containerId: string;
  categories: ObjectiveCategory[];
  isViewed: boolean;
  inMissionPanel: boolean;
  inDeadlinesPanel?: boolean; // shows the deadline date; the card cannot be dragged there
  onOpenDetails: (id: number) => void;
  onManageCategories: () => void;
  zoom?: number; // canvas zoom; sortable offsets are screen px but the card lives inside the scaled world
}

export const ObjectiveCard: FC<ObjectiveCardProps> = ({ obj, containerId, categories, isViewed, inMissionPanel, inDeadlinesPanel = false, onOpenDetails, onManageCategories, zoom = 1 }) => {
  const { buckets, updateObjective, deleteObjective, duplicateObjective, updateObjectiveCategory, setObjectiveMission, moveObjectiveToBucket } = useFocus();
  // The same objective can appear in the Mission panel and in its bucket, so the id includes the container
  const [isEditing, setIsEditing] = useState(false);
  // The whole card is the drag source (the sensor's 5px threshold keeps clicks and double-clicks
  // working); disabled while renaming so the input's text can be selected.
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `obj-${obj.id}@${containerId}`,
    data: { objectiveId: obj.id, containerId },
    disabled: isEditing || inDeadlinesPanel,
  });
  const [editText, setEditText] = useState(obj.text);
  const [showPicker, setShowPicker] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const closeSaveTemplate = useCallback(() => setSavingTemplate(false), []);
  const inputRef = useRef<HTMLInputElement>(null);

  const categoryColor = categories.find(c => c.id === obj.category_id)?.color;
  const bucketColor = inMissionPanel || inDeadlinesPanel ? buckets.find(b => b.id === obj.bucket_id)?.color : undefined;
  const isMission = obj.is_mission === 1;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // F2 renames the viewed card
  useEffect(() => {
    if (!isViewed) return;
    const handleF2 = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !isEditing && !isTypingTarget(e.target)) {
        e.preventDefault();
        soundEngine.playEditStart();
        setEditText(obj.text);
        setIsEditing(true);
      }
    };
    window.addEventListener('keydown', handleF2);
    return () => window.removeEventListener('keydown', handleF2);
  }, [isViewed, isEditing, obj.text]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform ? { ...transform, x: transform.x / zoom, y: transform.y / zoom } : null),
    transition,
    opacity: isDragging ? 0.4 : 1,
    // In the Mission panel the card carries its bucket's color: a border in that color and a dark shade as background
    ...(bucketColor ? { borderColor: bucketColor } : {}),
    ...(bucketColor ? { background: `color-mix(in srgb, ${bucketColor} 22%, var(--bg-dark))` } : {}),
  };

  const startRename = () => {
    soundEngine.playEditStart();
    setEditText(obj.text);
    setIsEditing(true);
  };

  const handleSave = () => {
    const text = editText.trim();
    if (text && text !== obj.text) {
      updateObjective(obj.id, text);
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(obj.text);
      setIsEditing(false);
    }
  };

  const handleClick = () => {
    if (isEditing) return;
    soundEngine.playClick();
    onOpenDetails(obj.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isEditing) return; // keep the native menu (paste, etc.) in the rename box
    e.preventDefault();
    soundEngine.playClick();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const handleMissionToggle = () => {
    soundEngine.playClick();
    setObjectiveMission(obj.id, inMissionPanel ? false : !isMission);
  };

  const handleDelete = () => {
    soundEngine.playClick();
    deleteObjective(obj.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isViewed ? styles.viewed : ''} ${inDeadlinesPanel ? styles.fixed : ''}`}
      {...(inDeadlinesPanel ? {} : listeners)}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      data-objective-id={obj.id}
      data-tinted={bucketColor ? '' : undefined}
    >
      <span
        className={styles.categoryBullet}
        style={{ backgroundColor: categoryColor || '#333333' }}
        data-no-focus
        onClick={(e) => { e.stopPropagation(); setShowPicker(prev => !prev); }}
        onMouseEnter={() => setStatusHint('SET_CATEGORY')}
        onMouseLeave={clearStatusHint}
      />

      {showPicker && (
        <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }} data-no-focus>
          <CategoryDotPicker
            categories={categories}
            selectedCategoryId={obj.category_id ?? null}
            onSelect={(catId) => {
              updateObjectiveCategory(obj.id, catId);
              setShowPicker(false);
            }}
            onManage={() => { setShowPicker(false); onManageCategories(); }}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}

      {isEditing ? (
        <input
          ref={inputRef}
          className={styles.editInput}
          value={editText}
          onClick={e => e.stopPropagation()}
          onChange={e => setEditText(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={handleSave}
        />
      ) : (
        <span className={styles.text}>
          {!inMissionPanel && isMission && <span className={styles.missionMarker} title="In Mission">★</span>}
          {obj.text}
        </span>
      )}

      {/* Rows show just the icon; the Deadlines panel shows the date as well */}
      {obj.deadline_at && !isEditing && <DeadlineBadge deadline={obj.deadline_at} showText={inDeadlinesPanel} className={styles.deadline} />}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          items={[
            { label: 'Rename', icon: <Pencil size={12} />, onSelect: startRename },
            { label: 'Details', icon: <FileText size={12} />, onSelect: () => onOpenDetails(obj.id) },
            moveToBucketItem(buckets.filter(isHoldingBucket), obj.bucket_id, bucketId => { soundEngine.playClick(); void moveObjectiveToBucket(obj.id, bucketId); }),
            inMissionPanel || isMission
              ? { label: 'Remove from Mission', icon: <MinusCircle size={12} />, onSelect: handleMissionToggle }
              : { label: 'Add to Mission', icon: <Target size={12} />, onSelect: handleMissionToggle },
            { label: 'Duplicate', icon: <CopyPlus size={12} />, onSelect: () => { void duplicateObjective(obj.id); } },
            { label: 'Copy text', icon: <Copy size={12} />, onSelect: () => { void copyPlain(obj.text); } },
            { label: 'Create template from task', icon: <BookmarkPlus size={12} />, onSelect: () => setSavingTemplate(true) },
            { label: 'Delete', icon: <Trash2 size={12} />, onSelect: handleDelete },
          ]}
        />
      )}
      {savingTemplate && <SaveTemplateModal task={obj} onClose={closeSaveTemplate} />}
    </div>
  );
};
