import { type FC, useState, useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, Target, MinusCircle, CopyPlus, Copy, X } from 'lucide-react';
import styles from './ObjectiveCard.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { setStatusHint, clearStatusHint } from '../utils/statusHint';
import { isTypingTarget } from '../utils/canvas';
import { copyPlain } from '../utils/clipboard';
import { ContextMenu } from './ContextMenu';
import { CategoryDotPicker } from './CategoryDotPicker';
import type { StrategicObjective, ObjectiveCategory } from '../types';

interface ObjectiveCardProps {
  obj: StrategicObjective;
  containerId: string;
  categories: ObjectiveCategory[];
  isViewed: boolean;
  inMissionPanel: boolean;
  onOpenDetails: (id: number) => void;
  onManageCategories: () => void;
  zoom?: number; // canvas zoom; sortable offsets are screen px but the card lives inside the scaled world
}

export const ObjectiveCard: FC<ObjectiveCardProps> = ({ obj, containerId, categories, isViewed, inMissionPanel, onOpenDetails, onManageCategories, zoom = 1 }) => {
  const { buckets, updateObjective, deleteObjective, duplicateObjective, updateObjectiveCategory, setObjectiveMission, setViewedObjective } = useFocus();
  // The same objective can appear in the Mission panel and in its bucket, so the id includes the container
  const [isEditing, setIsEditing] = useState(false);
  // The whole card is the drag source (the sensor's 5px threshold keeps clicks and double-clicks
  // working); disabled while renaming so the input's text can be selected.
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `obj-${obj.id}@${containerId}`,
    data: { objectiveId: obj.id, containerId },
    disabled: isEditing,
  });
  const [editText, setEditText] = useState(obj.text);
  const [showPicker, setShowPicker] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const inputRef = useRef<HTMLInputElement>(null);

  const categoryColor = categories.find(c => c.id === obj.category_id)?.color;
  const bucketColor = inMissionPanel ? buckets.find(b => b.id === obj.bucket_id)?.color : undefined;
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
    borderLeft: bucketColor ? `3px solid ${bucketColor}` : undefined,
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    setViewedObjective(obj.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isEditing) return; // keep the native menu (paste, etc.) in the rename box
    e.preventDefault();
    soundEngine.playClick();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const handleMissionToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playClick();
    setObjectiveMission(obj.id, inMissionPanel ? false : !isMission);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playClick();
    deleteObjective(obj.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isViewed ? styles.viewed : ''}`}
      {...listeners}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      data-objective-id={obj.id}
    >
      <span
        className={styles.categoryBullet}
        style={{ backgroundColor: categoryColor || '#333333' }}
        onClick={(e) => { e.stopPropagation(); setShowPicker(prev => !prev); }}
        onMouseEnter={() => setStatusHint('SET_CATEGORY')}
        onMouseLeave={clearStatusHint}
      />

      {showPicker && (
        <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <CategoryDotPicker
            categories={categories}
            selectedCategoryId={obj.category_id ?? null}
            onSelect={(catId) => {
              updateObjectiveCategory(obj.id, catId);
              setShowPicker(false);
            }}
            onManage={onManageCategories}
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
        <span className={styles.text} onDoubleClick={startEditing}>
          {!inMissionPanel && isMission && <span className={styles.missionMarker} title="In Mission">★</span>}
          {obj.text}
        </span>
      )}

      <div className={styles.actions}>
        <button
          className={styles.actionBtn}
          onClick={(e) => { e.stopPropagation(); soundEngine.playClick(); onOpenDetails(obj.id); }}
          onMouseEnter={() => setStatusHint('OPEN_DETAILS')}
          onMouseLeave={clearStatusHint}
          title="Details"
        >
          <FileText size={12} />
        </button>
        {inMissionPanel ? (
          <button
            className={styles.actionBtn}
            onClick={handleMissionToggle}
            onMouseEnter={() => setStatusHint('REMOVE_FROM_MISSION')}
            onMouseLeave={clearStatusHint}
            title="Remove from Mission"
          >
            <MinusCircle size={12} />
          </button>
        ) : (
          <button
            className={`${styles.actionBtn} ${isMission ? styles.actionActive : ''}`}
            onClick={handleMissionToggle}
            onMouseEnter={() => setStatusHint(isMission ? 'REMOVE_FROM_MISSION' : 'ADD_TO_MISSION')}
            onMouseLeave={clearStatusHint}
            title={isMission ? 'Remove from Mission' : 'Add to Mission'}
          >
            <Target size={12} />
          </button>
        )}
        <button
          className={`${styles.actionBtn} ${styles.deleteBtn}`}
          onClick={handleDelete}
          onMouseEnter={() => setStatusHint('DELETE_OBJECTIVE')}
          onMouseLeave={clearStatusHint}
          title="Delete"
        >
          <X size={12} />
        </button>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          items={[
            { label: 'Duplicate', icon: <CopyPlus size={12} />, onSelect: () => { void duplicateObjective(obj.id); } },
            { label: 'Copy text', icon: <Copy size={12} />, onSelect: () => { void copyPlain(obj.text); } },
          ]}
        />
      )}
    </div>
  );
};
